import { prisma } from '../lib/prisma';

async function seedWorkPatterns() {
    console.log('🌱 Seeding work patterns...');

    const patterns = [
        {
            name: 'SUN_THU',
            displayName: 'Sunday-Thursday',
            days: '0,1,2,3,4', // Sunday (0) through Thursday (4)
            nextPattern: 'TUE_SAT',
            breakDays: 4, // 4-day break after SUN-THU
            sortOrder: 1,
            isActive: true
        },
        {
            name: 'MON_FRI',
            displayName: 'Monday-Friday',
            days: '1,2,3,4,5', // Monday (1) through Friday (5)
            nextPattern: 'SUN_THU',
            breakDays: 0, // No break after MON-FRI, rotation ends
            sortOrder: 3,
            isActive: true
        },
        {
            name: 'TUE_SAT',
            displayName: 'Tuesday-Saturday',
            days: '2,3,4,5,6', // Tuesday (2) through Saturday (6)
            nextPattern: 'MON_FRI',
            breakDays: 0, // No break after TUE-SAT
            sortOrder: 2,
            isActive: true
        }
    ];

    for (const pattern of patterns) {
        const existing = await prisma.workPattern.findUnique({
            where: { name: pattern.name }
        });

        if (existing) {
            console.log(`  ↻ Updating pattern: ${pattern.displayName}`);
            await prisma.workPattern.update({
                where: { name: pattern.name },
                data: pattern
            });
        } else {
            console.log(`  ✓ Creating pattern: ${pattern.displayName}`);
            await prisma.workPattern.create({
                data: pattern
            });
        }
    }

    console.log('✅ Work patterns seeded successfully!');
}

seedWorkPatterns()
    .catch((e) => {
        console.error('❌ Error seeding work patterns:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
