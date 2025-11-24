import { prisma } from '../lib/prisma';

// Remove local instantiation since we import the singleton
// const prisma = new PrismaClient();

async function main() {
    console.log('🌱 Seeding test data...');

    // 1. Create Test Analysts
    const analysts = [
        {
            name: 'Alice Morning',
            email: 'alice@example.com',
            shiftType: 'MORNING',
            employeeType: 'EMPLOYEE',
            isActive: true,
        },
        {
            name: 'Bob Evening',
            email: 'bob@example.com',
            shiftType: 'EVENING',
            employeeType: 'EMPLOYEE',
            isActive: true,
        },
        {
            name: 'Charlie Contractor',
            email: 'charlie@example.com',
            shiftType: 'MORNING',
            employeeType: 'CONTRACTOR',
            isActive: true,
        },
        {
            name: 'Diana Screener',
            email: 'diana@example.com',
            shiftType: 'EVENING',
            employeeType: 'EMPLOYEE',
            isActive: true,
        },
        {
            name: 'Evan Weekend',
            email: 'evan@example.com',
            shiftType: 'WEEKEND',
            employeeType: 'EMPLOYEE',
            isActive: true,
        }
    ];

    for (const analyst of analysts) {
        const exists = await prisma.analyst.findUnique({ where: { email: analyst.email } });
        if (!exists) {
            await prisma.analyst.create({ data: analyst });
            console.log(`✅ Created analyst: ${analyst.name}`);
        } else {
            console.log(`ℹ️ Analyst ${analyst.name} already exists`);
        }
    }

    // 2. Create Test Constraints (Blackout Dates)
    // Create a blackout date for next Monday
    const today = new Date();
    const nextMonday = new Date(today);
    nextMonday.setDate(today.getDate() + ((1 + 7 - today.getDay()) % 7 || 7)); // Next Monday

    const blackoutStart = new Date(nextMonday);
    const blackoutEnd = new Date(nextMonday);

    const constraint = {
        startDate: blackoutStart,
        endDate: blackoutEnd,
        constraintType: 'BLACKOUT_DATE',
        description: 'System Maintenance Day',
        isActive: true,
    };

    // Check if constraint exists (simple check by description/date)
    const existingConstraint = await prisma.schedulingConstraint.findFirst({
        where: {
            description: constraint.description,
            startDate: constraint.startDate
        }
    });

    if (!existingConstraint) {
        await prisma.schedulingConstraint.create({ data: constraint });
        console.log(`✅ Created blackout date constraint for: ${blackoutStart.toDateString()}`);
    } else {
        console.log(`ℹ️ Constraint already exists`);
    }

    console.log('✨ Seeding completed!');
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
