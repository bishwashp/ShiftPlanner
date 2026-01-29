
import { PrismaClient } from '@prisma/client';
import moment from 'moment-timezone';
import { shiftSwapService } from '../src/services/ShiftSwapService';
import { prisma } from '../src/lib/prisma';

async function main() {
    console.log('--- Verifying Time-Slice Range Swap (The "Bad Case") ---');

    // 1. Setup Data
    const startDate = moment.utc('2026-02-01').toDate(); // Sunday
    const endDate = moment.utc('2026-02-14').toDate();   // Saturday (14 days)

    // IDs (assuming seed data exists, or we create temp users)
    // We'll Create 2 Temp Analysts for safety
    const bishName = `Bish_Temp_${Date.now()}`;
    const sarahiName = `Sarahi_Temp_${Date.now()}`;
    const regionId = 'test-region-1'; // Ensure this exists or create

    // Ensure Region
    await prisma.region.upsert({
        where: { id: regionId },
        update: {},
        create: { id: regionId, name: 'Test Region', timezone: 'UTC' }
    });

    const bish = await prisma.analyst.create({
        data: { id: `bish_${Date.now()}`, name: bishName, regionId, email: `b_${Date.now()}@test.com` }
    });

    const sarahi = await prisma.analyst.create({
        data: { id: `sarahi_${Date.now()}`, name: sarahiName, regionId, email: `s_${Date.now()}@test.com` }
    });

    console.log(`Created Analysts: ${bish.name}, ${sarahi.name}`);

    // 2. Seed Schedules (The "Bad Case")

    // Bish: [Feb 1-5 Work], [Feb 6-9 BREAK], [Feb 10-14 Work]
    const bishWorkDays = [1, 2, 3, 4, 5, 10, 11, 12, 13, 14];
    for (const d of bishWorkDays) {
        const date = moment.utc('2026-02-01').date(d).toDate();
        await prisma.schedule.create({
            data: { analystId: bish.id, date, shiftType: 'DS', regionId }
        });
    }

    // Sarahi: [Feb 2-6 Work], [Feb 6 is SCREENER], [Feb 8-12 Work]
    // Note: Feb 6, 8, 9 overlap with Bish's Break!
    const sarahiWorkDays = [2, 3, 4, 5, 6, 8, 9, 10, 11, 12];
    for (const d of sarahiWorkDays) {
        const date = moment.utc('2026-02-01').date(d).toDate();
        await prisma.schedule.create({
            data: {
                analystId: sarahi.id,
                date,
                shiftType: 'DS',
                isScreener: d === 6, // Feb 6 is Screener
                regionId
            }
        });
    }

    console.log('Seeded Initial Schedules.');

    // 3. Execute Swap
    console.log('Executing Range Swap...');
    await shiftSwapService.executeManagerRangeSwap(
        bish.id,
        sarahi.id,
        startDate,
        endDate,
        { force: true } // Bypass logic validation for this test of MECHANISM
    );

    // 4. Verify Outcome
    console.log('Verifying Results...');

    // A. Check Sarahi (Former Target)
    // She should have Bish's schedule: Work 1-5, Break 6-9.
    // KEY CHECK: Does she have shifts on Feb 6, 8, 9? (Should be NO)
    const sarahiNewShifts = await prisma.schedule.findMany({
        where: { analystId: sarahi.id, date: { gte: startDate, lte: endDate } },
        orderBy: { date: 'asc' }
    });

    const sarahiDates = sarahiNewShifts.map(s => moment.utc(s.date).date());
    console.log('Sarahi New Work Days:', sarahiDates);

    // Bish's original work days: 1, 2, 3, 4, 5, 10, 11, 12, 13, 14
    // Sarahi should now strictly match this set.
    const expected = [1, 2, 3, 4, 5, 10, 11, 12, 13, 14];
    const unexpected = sarahiDates.filter(d => !expected.includes(d));
    const missing = expected.filter(d => !sarahiDates.includes(d));

    if (unexpected.length > 0 || missing.length > 0) {
        console.error('FAIL: Sarahi schedule mismatch.');
        console.error('Unexpected (Should contain NONE):', unexpected);
        console.error('Missing (Should contain NONE):', missing);
    } else {
        console.log('PASS: Sarahi correctly took Bish\'s schedule (and accepted Breaks).');
    }

    // B. Check Bish (Former Source)
    // He should have Sarahi's schedule: Including the Screener on Feb 6.
    const bishNewShifts = await prisma.schedule.findMany({
        where: { analystId: bish.id, date: { gte: startDate, lte: endDate } }
    });

    const bishScreener = bishNewShifts.find(s => moment.utc(s.date).date() === 6);
    if (bishScreener && bishScreener.isScreener) {
        console.log('PASS: Bish inherited the Screener shift on Feb 6.');
    } else {
        console.error('FAIL: Bish did not inherit the Screener shift!');
    }

    // Cleanup
    await prisma.schedule.deleteMany({ where: { analystId: { in: [bish.id, sarahi.id] } } });
    await prisma.analyst.deleteMany({ where: { id: { in: [bish.id, sarahi.id] } } });
    console.log('Test Complete.');
}

main()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect());
