
import { PrismaClient } from '../generated/prisma';
import { RotationManager } from '../src/services/scheduling/RotationManager';
import { PatternContinuityService } from '../src/services/scheduling/PatternContinuityService';
import moment from 'moment-timezone';

const prisma = new PrismaClient();

async function analyze() {
    console.log('🕵️‍♂️ Analyzing Weekend Eligibility...');

    const analysts = await prisma.analyst.findMany({
        where: { isActive: true, region: { name: 'AMR' } },
        include: {
            patternContinuity: true
        }
    });

    // Initialize dependencies
    const pcs = new PatternContinuityService(prisma);
    const rm = new RotationManager(pcs);

    // Test distinct dates
    const dates = [
        '2026-02-07', // Saturday
        '2026-02-08', // Sunday
        '2026-06-20', // Saturday
    ];

    console.log('🔄 Generating Rotation Plan for 2026...');
    // planRotation(type, shift, start, end, analysts, history)
    const plans = await rm.planRotation(
        'FAIRNESS_OPTIMIZED',
        'AM', // Assume AM for testing rotation logic
        new Date('2026-01-01'),
        new Date('2026-12-31'),
        analysts,
        []
    );
    console.log(`✅ Generated ${plans.length} rotation segments.`);

    for (const dateStr of dates) {
        console.log(`\n📅 Testing Date: ${dateStr}`);
        const date = moment.utc(dateStr).toDate();

        for (const analyst of analysts) {
            const plan = plans.find((p: any) => p.analystId === analyst.id && moment(date).isBetween(p.startDate, p.endDate, 'day', '[]'));
            const shouldWork = rm.shouldAnalystWork(analyst.id, date, plans);

            // Log relevant analysts
            if (['Bish', 'Sarahi', 'Sukhvinder', 'Srujana'].includes(analyst.name)) {
                console.log(`   👤 ${analyst.name}: Pattern=${plan?.pattern || 'None/Default'} | ShouldWork=${shouldWork}`);
            }
        }
    }
}

analyze()
    .catch(e => console.error(e))
    .finally(() => prisma.$disconnect());
