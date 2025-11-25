import { prisma } from '../lib/prisma';

// Remove local instantiation since we import the singleton
// const prisma = new PrismaClient();

async function main() {
    console.log('🌱 Seeding test data...');

    // 0. Clear existing data
    console.log('🧹 Clearing existing analysts...');
    await prisma.analyst.deleteMany({});

    // 1. Create Test Analysts
    const analysts = [
        // Morning Shift (7 Total: 2 Employees, 5 Contractors)
        { name: 'Alice Morning (Emp)', email: 'alice@example.com', shiftType: 'MORNING', employeeType: 'EMPLOYEE', isActive: true },
        { name: 'Bob Morning (Emp)', email: 'bob@example.com', shiftType: 'MORNING', employeeType: 'EMPLOYEE', isActive: true },
        { name: 'Charlie Morning (Cont)', email: 'charlie@example.com', shiftType: 'MORNING', employeeType: 'CONTRACTOR', isActive: true },
        { name: 'David Morning (Cont)', email: 'david@example.com', shiftType: 'MORNING', employeeType: 'CONTRACTOR', isActive: true },
        { name: 'Eve Morning (Cont)', email: 'eve@example.com', shiftType: 'MORNING', employeeType: 'CONTRACTOR', isActive: true },
        { name: 'Frank Morning (Cont)', email: 'frank@example.com', shiftType: 'MORNING', employeeType: 'CONTRACTOR', isActive: true },
        { name: 'Grace Morning (Cont)', email: 'grace@example.com', shiftType: 'MORNING', employeeType: 'CONTRACTOR', isActive: true },

        // Evening Shift (3 Total: 1 Employee, 2 Contractors)
        { name: 'Helen Evening (Emp)', email: 'helen@example.com', shiftType: 'EVENING', employeeType: 'EMPLOYEE', isActive: true },
        { name: 'Ivan Evening (Cont)', email: 'ivan@example.com', shiftType: 'EVENING', employeeType: 'CONTRACTOR', isActive: true },
        { name: 'Jack Evening (Cont)', email: 'jack@example.com', shiftType: 'EVENING', employeeType: 'CONTRACTOR', isActive: true },
    ];

    for (const analyst of analysts) {
        await prisma.analyst.create({ data: analyst });
        console.log(`✅ Created analyst: ${analyst.name}`);
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
