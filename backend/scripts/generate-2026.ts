/**
 * Generate Feb-Dec 2026 schedules for AMR region
 * One-off script to fix the regionId issue
 */

import { PrismaClient } from '../generated/prisma';
import { WeekendRotationAlgorithm } from '../src/services/scheduling/algorithms/WeekendRotationAlgorithm';
import { createLocalDate } from '../src/utils/dateUtils';

const prisma = new PrismaClient();
const AMR_REGION_ID = 'cmk0t1uax0000vzkhod02ojnm';

async function generate() {
    const startDate = createLocalDate('2026-02-01');
    const endDate = createLocalDate('2026-12-31');

    console.log('🚀 Generating Feb-Dec 2026 schedules for AMR region');
    console.log(`📅 Date range: ${startDate.toISOString().split('T')[0]} to ${endDate.toISOString().split('T')[0]}`);

    // Get analysts
    const analysts = await prisma.analyst.findMany({
        where: { isActive: true, regionId: AMR_REGION_ID },
        include: { vacations: { where: { isApproved: true } } }
    });
    console.log(`👥 Found ${analysts.length} AMR analysts`);

    // Get existing schedules (for continuity from Jan 2026)
    const existingSchedules = await prisma.schedule.findMany({
        where: {
            date: { gte: new Date('2026-01-01'), lt: startDate },
            regionId: AMR_REGION_ID
        }
    });
    console.log(`📋 Found ${existingSchedules.length} existing Jan 2026 schedules`);

    // Clear Feb-Dec 2026 schedules
    console.log('🧹 Clearing existing Feb-Dec 2026 schedules...');
    const deleted = await prisma.schedule.deleteMany({
        where: {
            date: { gte: startDate, lte: endDate },
            regionId: AMR_REGION_ID
        }
    });
    console.log(`   Deleted ${deleted.count} records`);

    // Generate new schedules
    console.log('🔄 Generating schedules...');
    const algorithm = new WeekendRotationAlgorithm();
    const result = await algorithm.generateSchedules({
        startDate,
        endDate,
        analysts,
        existingSchedules,
        globalConstraints: [],
        regionId: AMR_REGION_ID,
        algorithmConfig: {
            optimizationStrategy: 'HILL_CLIMBING',
            maxIterations: 1000,
            convergenceThreshold: 0.001,
            fairnessWeight: 0.4,
            efficiencyWeight: 0.3,
            constraintWeight: 0.3,
            randomizationFactor: 0.1,
            screenerAssignmentStrategy: 'WORKLOAD_BALANCE',
            weekendRotationStrategy: 'FAIRNESS_OPTIMIZED'
        }
    });

    console.log(`✅ Generated ${result.proposedSchedules.length} schedules`);
    console.log(`📊 Fairness Score: ${result.fairnessMetrics?.overallFairnessScore?.toFixed(4) || 'N/A'}`);

    // Prepare data for insert
    const schedules = result.proposedSchedules.map((s: any) => ({
        analystId: s.analystId,
        date: createLocalDate(s.date),
        shiftType: s.shiftType,
        isScreener: s.isScreener ?? false,
        regionId: AMR_REGION_ID
    }));

    // Save to database
    console.log('💾 Saving to database...');
    const saved = await prisma.schedule.createMany({
        data: schedules
    });
    console.log(`✅ Saved ${saved.count} schedules`);

    await prisma.$disconnect();
    console.log('🔌 Done!');
}

generate().catch(e => {
    console.error('❌ Error:', e);
    prisma.$disconnect();
    process.exit(1);
});
