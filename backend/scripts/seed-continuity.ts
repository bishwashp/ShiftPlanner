
import { PrismaClient } from '../generated/prisma';

const prisma = new PrismaClient();

const ALGORITHM_TYPE = 'WeekendRotationAlgorithm';

async function seedContinuity() {
    console.log('🚀 Starting Pattern Continuity Seeding (Jan 2026)...');

    // 1. Fetch all analysts in AMR
    const analysts = await prisma.analyst.findMany({
        where: { region: { name: 'AMR' } },
    });
    console.log(`📋 Found ${analysts.length} analysts.`);

    // 2. Fetch Jan 2026 schedules
    const startDate = new Date('2026-01-01');
    const endDate = new Date('2026-02-01');

    const schedules = await prisma.schedule.findMany({
        where: {
            date: {
                gte: startDate,
                lt: endDate,
            },
            analystId: { in: analysts.map((a: { id: string }) => a.id) },
        },
    });
    console.log(`📅 Found ${schedules.length} schedules in Jan 2026.`);

    // 3. Process each analyst
    for (const analyst of analysts) {
        const analystSchedules = schedules.filter((s: { analystId: string }) => s.analystId === analyst.id);

        // Check for specific weekend dates to determine pattern
        // Ideally check the LAST occurrence of a pattern day

        // Sort schedules by date desc
        analystSchedules.sort((a: { date: Date }, b: { date: Date }) => b.date.getTime() - a.date.getTime());

        let deducedPattern = 'MON_FRI'; // Default
        let lastWorkDate = new Date('2026-01-30'); // Default to last Friday of Jan

        // Find last worked weekend day
        const lastWeekendShift = analystSchedules.find((s: { date: Date }) => {
            const day = s.date.getDay();
            return day === 0 || day === 6; // Sun or Sat
        });

        if (lastWeekendShift) {
            const day = lastWeekendShift.date.getDay();
            lastWorkDate = lastWeekendShift.date;

            if (day === 0) { // Sunday
                deducedPattern = 'SUN_THU';
            } else if (day === 6) { // Saturday
                deducedPattern = 'TUE_SAT';
            }
        } else {
            // If no weekend work, assume MON_FRI
            // set work date to last Friday schedule if exists, else generic Jan 30
            const lastFri = analystSchedules.find((s: { date: Date }) => s.date.getDay() === 5);
            if (lastFri) lastWorkDate = lastFri.date;
        }

        console.log(`   👤 ${analyst.name}: ${deducedPattern} (Last Work: ${lastWorkDate.toISOString().split('T')[0]})`);

        // 4. Save to PatternContinuity
        await prisma.patternContinuity.upsert({
            where: {
                algorithmType_analystId: {
                    algorithmType: ALGORITHM_TYPE,
                    analystId: analyst.id
                }
            },
            update: {
                lastPattern: deducedPattern,
                lastWorkDate: lastWorkDate,
                weekNumber: 1, // Placeholder
            },
            create: {
                algorithmType: ALGORITHM_TYPE,
                analystId: analyst.id,
                lastPattern: deducedPattern,
                lastWorkDate: lastWorkDate,
                weekNumber: 1,
            }
        });
    }

    console.log('✅ Continuity seeding complete.');
}

seedContinuity()
    .catch((e: Error) => console.error(e))
    .finally(async () => {
        await prisma.$disconnect();
    });
