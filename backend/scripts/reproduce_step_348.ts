
import { PrismaClient } from '@prisma/client';
import { SwapValidator } from '../src/services/SwapValidator';
import moment from 'moment';

const prisma = new PrismaClient();
const validator = new SwapValidator(prisma);

async function reproduce() {
    // 1. Setup Data for Bish and Sarahi
    // Scenario:
    // Sarahi: Works Jan 27-31 (5 days). Receives Feb 1. -> 6 days (Violation).
    // Bish: Works Jan 28-Feb 1 (5 days). Gives Feb 1. Receives Feb 2 (from Sarahi).

    // Clean up
    await prisma.schedule.deleteMany({
        where: {
            date: {
                gte: new Date('2026-01-26'),
                lte: new Date('2026-02-10')
            }
        }
    });

    const bish = await prisma.analyst.findFirst({ where: { name: { contains: 'Bish' } } });
    const sarahi = await prisma.analyst.findFirst({ where: { name: { contains: 'Sarahi' } } });

    if (!bish || !sarahi) {
        console.error("Analysts not found");
        return;
    }

    console.log(`Bish ID: ${bish.id}`);
    console.log(`Sarahi ID: ${sarahi.id}`);

    // Create Schedules
    const creates = [];

    // Sarahi: Jan 27, 28, 29, 30, 31 (5 days)
    // Target Shift: She HAS Feb 2 (which she gives to Bish)
    ['2026-01-27', '2026-01-28', '2026-01-29', '2026-01-30', '2026-01-31', '2026-02-02'].forEach(date => {
        creates.push({
            analystId: sarahi.id,
            date: new Date(date),
            shiftType: 'DAY',
            isScreener: false
        });
    });

    // Bish: Jan 28, 29, 30, 31, Feb 1 (5 days)
    // Source Shift: Feb 1 (he gives this to Sarahi)
    // Note: If he works Jan 27 too, he would have 6 days. Let's assume he works a standard 5 day block ending Feb 1.
    ['2026-01-28', '2026-01-29', '2026-01-30', '2026-01-31', '2026-02-01'].forEach(date => {
        creates.push({
            analystId: bish.id,
            date: new Date(date),
            shiftType: 'DAY',
            isScreener: false
        });
    });

    await prisma.schedule.createMany({ data: creates });

    console.log("Setup Complete.");

    // TEST: Swap Bish's Feb 1 with Sarahi's Feb 2
    const violations = await validator.validateManagerSwap(
        bish.id,
        new Date('2026-02-01'), // Bish gives Feb 1
        sarahi.id,
        new Date('2026-02-02')  // Sarahi gives Feb 2
    );

    console.log("\n--- Validation Results ---");
    console.log(JSON.stringify(violations, null, 2));

    // Analyze Bish's simulated timeline manually to explain WHY he is clean
    // Bish Original: Jan 28, 29, 30, 31, Feb 1
    // Bish New: Jan 28, 29, 30, 31, [GAP], Feb 2
    // Streak 1: Jan 28-31 (4 days)
    // Streak 2: Feb 2 (1 day)
    // NO VIOLATION.
}

reproduce()
    .catch(console.error)
    .finally(async () => await prisma.$disconnect());
