
import { prisma } from '../src/lib/prisma';
import { WeekendRotationAlgorithm } from '../src/services/scheduling/algorithms/WeekendRotationAlgorithm';

async function previewFeb2026() {
    console.log('🔮 Generating Feb 2026 Preview (Dry Run)...');

    const startDate = new Date('2026-02-01');
    const endDate = new Date('2026-03-01'); // Exclusive end date usually

    // Get Region ID
    const region = await prisma.region.findFirst({ where: { name: 'AMR' } });
    if (!region) throw new Error('Region AMR not found');

    // 1. Load context
    const analysts = await prisma.analyst.findMany({
        where: { isActive: true, region: { name: 'AMR' } },
        include: {
            vacations: { where: { isApproved: true } },
            constraints: { where: { isActive: true } }
        }
    });

    // Load existing (Jan 2026) for continuity
    const existingSchedules = await prisma.schedule.findMany({
        where: {
            date: {
                gte: new Date('2026-01-01'),
                lt: startDate
            },
            analyst: { region: { name: 'AMR' } }
        }
    });

    const globalConstraints = await prisma.schedulingConstraint.findMany({
        where: {
            analystId: null,
            isActive: true,
            OR: [
                { startDate: { lte: endDate }, endDate: { gte: startDate } }
            ]
        }
    });

    // 2. Generate
    const algorithm = new WeekendRotationAlgorithm();
    const result = await algorithm.generateSchedules({
        startDate,
        endDate,
        regionId: region.id,
        analysts,
        existingSchedules,
        globalConstraints,
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

    // 3. Format Output
    // Map: Date -> { AM: string, PM: string, AMScreener: string, PMScreener: string }
    const scheduleMap = new Map<string, { AM: string, PM: string, AMScreener: string, PMScreener: string, isWeekend: boolean }>();

    // Initialize all days
    const current = new Date(startDate);
    while (current < endDate) {
        const dStr = current.toISOString().split('T')[0];
        const day = current.getDay();
        const isWeekend = day === 0 || day === 6;
        scheduleMap.set(dStr, {
            AM: 'NA',
            PM: 'NA',
            AMScreener: 'NA',
            PMScreener: 'NA',
            isWeekend
        });
        current.setDate(current.getDate() + 1);
    }

    // Populate from results
    const schedules = result.proposedSchedules as any[];
    for (const s of schedules) {
        const dStr = typeof s.date === 'string' ? s.date.split('T')[0] : s.date.toISOString().split('T')[0];
        const entry = scheduleMap.get(dStr);

        if (entry) {
            // Find analyst name
            const analyst = analysts.find(a => a.id === s.analystId);
            const name = analyst ? analyst.name : 'Unknown';

            // Assuming 1 per slot for simplicity in preview
            if (s.isScreener) {
                if (s.shiftType === 'AM') entry.AMScreener = name;
                if (s.shiftType === 'PM') entry.PMScreener = name;
            } else {
                if (s.shiftType === 'AM') entry.AM = name;
                if (s.shiftType === 'PM') entry.PM = name;
            }
        }
    }

    // Print Table
    console.log('\n📅 Feb 2026 Schedule Preview');
    console.log('---------------------------------------------------------------------------------');
    console.log('| Date       | AMR AM         | AMR PM         | AM Screener    | PM Screener    |');
    console.log('|------------|----------------|----------------|----------------|----------------|');

    const sortedDates = [...scheduleMap.keys()].sort();
    for (const d of sortedDates) {
        const r = scheduleMap.get(d)!;

        let amDisplay = r.AM;
        let pmDisplay = r.PM;

        const pad = (s: string) => s.padEnd(14, ' ');

        console.log(`| ${d} | ${pad(amDisplay)} | ${pad(pmDisplay)} | ${pad(r.AMScreener)} | ${pad(r.PMScreener)} |`);
    }
    console.log('---------------------------------------------------------------------------------');
}

previewFeb2026()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
