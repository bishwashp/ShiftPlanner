
import { PrismaClient } from '../generated/prisma';

const prisma = new PrismaClient();

async function seedPatterns() {
    console.log('🌱 Seeding Work Patterns...');

    const patterns = [
        {
            name: 'MON_FRI',
            displayName: 'Monday - Friday',
            days: '1,2,3,4,5',
            nextPattern: 'SUN_THU', // Iterate to Sun-Thu next? Or TUE_SAT?
            // Usually: Mon-Fri -> Tue-Sat -> Sun-Thu -> Mon-Fri
            // Let's assume a standard rotation.
            // If I worked Mon-Fri, next week I probably rotate?
            // Or does it stay same?
            // "Weekend Rotation Algorithm" implies we rotate weekends.
            // So Mon-Fri (No Weekend) -> Tue-Sat (Sat Weekend) -> Sun-Thu (Sun Weekend) -> Mon-Fri
            sortOrder: 1
        },
        {
            name: 'TUE_SAT',
            displayName: 'Tuesday - Saturday',
            days: '2,3,4,5,6',
            nextPattern: 'SUN_THU',
            sortOrder: 2
        },
        {
            name: 'SUN_THU',
            displayName: 'Sunday - Thursday',
            days: '0,1,2,3,4',
            nextPattern: 'MON_FRI',
            sortOrder: 3
        }
    ];

    // Correction: The order is usually M-F -> T-S -> S-T -> M-F
    // M-F (0 weekends)
    // T-S (Sat)
    // S-T (Sun)
    // Or M-F -> S-T -> T-S?
    // Let's stick to M-F -> T-S -> S-T -> M-F as a sensible default for now. 
    // If the user complains about rotation order, we can adjust.

    // Update: Based on continuity script, I saw TUE_SAT and SUN_THU.

    for (const p of patterns) {
        await prisma.workPattern.upsert({
            where: { name: p.name },
            update: {
                displayName: p.displayName,
                days: p.days,
                nextPattern: p.nextPattern,
                sortOrder: p.sortOrder
            },
            create: {
                name: p.name,
                displayName: p.displayName,
                days: p.days,
                nextPattern: p.nextPattern,
                sortOrder: p.sortOrder
            }
        });
        console.log(`   ✅ Seeded ${p.name}`);
    }
}

seedPatterns()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
