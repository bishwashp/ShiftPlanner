// @ts-nocheck
import { PrismaClient } from '../generated/prisma';
import { WeekendRotationAlgorithm } from '../src/services/scheduling/algorithms/WeekendRotationAlgorithm';
import { RotationManager } from '../src/services/scheduling/RotationManager';
import { PatternContinuityService } from '../src/services/scheduling/PatternContinuityService';
import moment from 'moment';

const prisma = new PrismaClient();

async function auditBishApril() {
    console.log('🔍 Auditing Bish Schedule for April 4-5...');

    // 1. Check if Bish is Active and Region
    const bish = await prisma.analyst.findFirst({
        where: { name: { contains: 'Bish' } },
        include: { vacations: true }
    });

    if (!bish) {
        console.error('❌ Bish not found!');
        return;
    }
    console.log(`👤 Analyst: ${bish.name} (${bish.id})`);
    console.log(`Region: ${bish.regionId}`);

    // 2. Check Vacations
    const apr4 = new Date('2026-04-04');
    const apr5 = new Date('2026-04-05');
    const onVacation = bish.vacations.some((v: any) =>
        new Date(v.startDate) <= apr5 && new Date(v.endDate) >= apr4
    );
    console.log(`🏖️ On Vacation: ${onVacation}`);

    // 3. Simulate Weekend Rotation for April 4 (Saturday)
    console.log('\n--- Simulating Saturday April 4 ---');
    const continuityService = new PatternContinuityService(prisma);
    const rm = new RotationManager(continuityService);
    const algo = new WeekendRotationAlgorithm(rm);

    const regionalAnalysts = await prisma.analyst.findMany({
        where: { regionId: bish.regionId, isActive: true },
        include: { vacations: true, constraints: true }
    });

    // Mock existing schedules up to Apr 3
    const existingSchedules = await prisma.schedule.findMany({
        where: {
            regionId: bish.regionId,
            date: { lt: new Date('2026-02-01') } // Changed to reflect new start date
        }
    });

    // We need to see FAIRNESS SCORES
    // MODIFIED to Verify Iterative Loop (Feb-April)
    const startDate = new Date('2026-02-01');
    const endDate = new Date('2026-04-30');

    // Clean up current month for Bish to ensure clean slate (Optional, skipping for now)

    const context: SchedulingContext = {
        startDate,
        endDate,
        analysts: regionalAnalysts, // Use regionalAnalysts as defined above
        existingSchedules: existingSchedules,
        globalConstraints: [],
        regionId: bish.regionId // Added regionId to context as it was in the original call
    };

    const result = await algo.generateSchedules(context);

    console.log('\n--- PROPOSED SCHEDULES DEBUG ---');
    const proposed = (result as any).proposedSchedules || [];
    proposed.forEach((s: any) => {
        console.log(`📅 ${s.date}: Assigned to ${s.analystId}`);
    });

    // Explicit casting to handle potential type divergence
    const satAssigned = proposed.find((s: any) => s.date === '2026-04-04');
    const sunAssigned = proposed.find((s: any) => s.date === '2026-04-05');

    console.log(`\n📅 April 4 Assignment: ${satAssigned ? satAssigned.analystId : 'NONE'}`);
    if (satAssigned?.analystId === bish.id) console.log('✅ Bish Assigned Saturday');
    else console.log('❌ Bish NOT Assigned Saturday');

    console.log(`📅 April 5 Assignment: ${sunAssigned ? sunAssigned.analystId : 'NONE'}`);
    if (sunAssigned?.analystId === bish.id) console.log('✅ Bish Assigned Sunday');
    else console.log('❌ Bish NOT Assigned Sunday');

    await prisma.$disconnect();
}

auditBishApril().catch(console.error);
