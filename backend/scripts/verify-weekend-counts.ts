/**
 * Verification script for Phase 2: Check weekend date assignments
 * Each weekend date should have exactly 1 analyst (weekendAnalystsPerDay = 1)
 */
import { prisma } from '../src/lib/prisma';
import { WeekendRotationAlgorithm } from '../src/services/scheduling/algorithms/WeekendRotationAlgorithm';
import moment from 'moment';

async function verifyPhase2() {
    console.log('🔍 Phase 2 Verification: Check weekend assignments per date\n');

    const startDate = new Date('2026-02-01');
    const endDate = new Date('2026-04-30'); // 3 months

    // Get AMR region first
    const region = await prisma.region.findFirst({ where: { name: 'AMR' } });
    if (!region) {
        console.log('❌ AMR region not found');
        return;
    }

    // Fetch only analysts in AMR region (FIX: was fetching all regions)
    const analysts = await prisma.analyst.findMany({
        where: { isActive: true, regionId: region.id },
        include: {
            vacations: { where: { isApproved: true } },
            constraints: { where: { isActive: true } }
        }
    });

    console.log(`👥 Found ${analysts.length} active analysts in AMR`);

    const existingSchedules = await prisma.schedule.findMany({
        where: {
            date: { gte: new Date('2026-01-01'), lt: new Date('2026-02-01') },
            regionId: region.id  // Also filter schedules by region
        }
    });

    console.log(`📋 Found ${existingSchedules.length} existing Jan 2026 schedules in AMR\n`);

    const algorithm = new WeekendRotationAlgorithm();
    const result = await algorithm.generateSchedules({
        startDate,
        endDate,
        analysts,
        existingSchedules,
        globalConstraints: [],
        regionId: region.id
    });

    console.log(`✅ Generated ${result.proposedSchedules.length} proposed schedules\n`);

    // Count analysts per weekend date
    const weekendAnalystsPerDay = 1; // Expected
    const assignmentsByDate = new Map<string, string[]>();

    for (const s of result.proposedSchedules) {
        const dateStr = s.date;
        const dayOfWeek = moment(dateStr).day();

        // Only check weekends (Sat=6, Sun=0)
        if (dayOfWeek === 0 || dayOfWeek === 6) {
            if (!assignmentsByDate.has(dateStr)) {
                assignmentsByDate.set(dateStr, []);
            }
            assignmentsByDate.get(dateStr)!.push(s.analystName);
        }
    }

    // Find violations
    const violations: { date: string; analysts: string[]; count: number }[] = [];

    for (const [date, analystNames] of assignmentsByDate) {
        if (analystNames.length !== weekendAnalystsPerDay) {
            violations.push({ date, analysts: analystNames, count: analystNames.length });
        }
    }

    if (violations.length === 0) {
        console.log(`✅ SUCCESS! All ${assignmentsByDate.size} weekend dates have exactly ${weekendAnalystsPerDay} analyst(s).\n`);
    } else {
        console.log(`❌ Found ${violations.length} violations:\n`);
        for (const v of violations.slice(0, 20)) {
            console.log(`  - ${v.date}: ${v.count} analysts (${v.analysts.join(', ')})`);
        }
        if (violations.length > 20) {
            console.log(`  ... and ${violations.length - 20} more`);
        }
    }

    await prisma.$disconnect();
}

verifyPhase2().catch(console.error);
