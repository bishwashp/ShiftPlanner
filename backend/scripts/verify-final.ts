/**
 * Final comprehensive verification of Feb-Dec 2026 schedules in database
 * Updated to use UTC dates for accurate verification
 */
import { prisma } from '../src/lib/prisma';
import moment from 'moment';

async function finalVerification() {
    console.log('🔍 Final Verification: Feb-Dec 2026 Schedules in Database\n');

    // Get AMR region
    const region = await prisma.region.findFirst({ where: { name: 'AMR' } });
    if (!region) {
        console.log('❌ AMR region not found');
        return;
    }

    // Fetch all schedules for Feb-Dec 2026
    const schedules = await prisma.schedule.findMany({
        where: {
            date: { gte: new Date('2026-02-01'), lte: new Date('2026-12-31') },
            regionId: region.id
        },
        include: { analyst: true },
        orderBy: [{ analystId: 'asc' }, { date: 'asc' }]
    });

    console.log(`📊 Found ${schedules.length} schedules for AMR in Feb-Dec 2026\n`);

    // Get AMR analysts
    const analysts = await prisma.analyst.findMany({
        where: { isActive: true, regionId: region.id }
    });
    console.log(`👥 ${analysts.length} active analysts in AMR\n`);

    // === CHECK 1: Consecutive workdays ===
    console.log('=== CHECK 1: Consecutive Workdays ===');
    const byAnalyst = new Map<string, { name: string; dates: Date[] }>();
    for (const s of schedules) {
        if (!byAnalyst.has(s.analystId)) {
            byAnalyst.set(s.analystId, { name: s.analyst?.name || 'Unknown', dates: [] });
        }
        byAnalyst.get(s.analystId)!.dates.push(s.date);
    }

    let consecutiveViolations = 0;
    for (const [analystId, data] of byAnalyst) {
        data.dates.sort((a, b) => a.getTime() - b.getTime());
        let streak = 1;
        for (let i = 1; i < data.dates.length; i++) {
            const diff = (data.dates[i].getTime() - data.dates[i - 1].getTime()) / (1000 * 60 * 60 * 24);
            if (Math.abs(diff - 1) < 0.5) {
                streak++;
                if (streak > 5) {
                    console.log(`  ❌ ${data.name}: ${streak} consecutive days`);
                    consecutiveViolations++;
                }
            } else {
                streak = 1;
            }
        }
    }
    if (consecutiveViolations === 0) {
        console.log('  ✅ No consecutive workday violations (all <= 5)\n');
    }

    // === CHECK 2: Weekend Analyst Count ===
    console.log('=== CHECK 2: Weekend Analyst Count ===');
    const weekendByDate = new Map<string, number>();
    for (const s of schedules) {
        // FIX: Use moment.utc() to properly determine day of week and date string
        // This prevents local timezone shifts (e.g., UTC Monday becoming Local Sunday)
        const dayOfWeek = moment.utc(s.date).day();
        if (dayOfWeek === 0 || dayOfWeek === 6) {
            const dateStr = s.date.toISOString().split('T')[0];
            weekendByDate.set(dateStr, (weekendByDate.get(dateStr) || 0) + 1);
        }
    }

    let weekendViolations = 0;
    for (const [date, count] of weekendByDate) {
        if (count !== 1) {
            console.log(`  ❌ ${date}: ${count} analysts (should be 1)`);
            weekendViolations++;
        }
    }
    if (weekendViolations === 0) {
        console.log(`  ✅ All ${weekendByDate.size} weekend dates have exactly 1 analyst\n`);
    }

    // === CHECK 3: Weekend distribution ===
    console.log('=== CHECK 3: Weekend Distribution ===');
    const weekendCountByAnalyst = new Map<string, { sundays: number; saturdays: number }>();
    for (const a of analysts) {
        weekendCountByAnalyst.set(a.id, { sundays: 0, saturdays: 0 });
    }
    for (const s of schedules) {
        // FIX: Use moment.utc() here too
        const dayOfWeek = moment.utc(s.date).day();
        const counts = weekendCountByAnalyst.get(s.analystId);
        if (counts) {
            if (dayOfWeek === 0) counts.sundays++;
            else if (dayOfWeek === 6) counts.saturdays++;
        }
    }

    for (const [analystId, counts] of weekendCountByAnalyst) {
        const analyst = analysts.find(a => a.id === analystId);
        const total = counts.sundays + counts.saturdays;
        console.log(`  ${analyst?.name}: ${counts.sundays} Sun, ${counts.saturdays} Sat (${total} total)`);
    }

    console.log('\n=== SUMMARY ===');
    console.log(`Consecutive violations: ${consecutiveViolations}`);
    console.log(`Weekend count violations: ${weekendViolations}`);

    if (consecutiveViolations === 0 && weekendViolations === 0) {
        console.log('\n✅ ALL CHECKS PASSED!\n');
    } else {
        console.log('\n❌ SOME CHECKS FAILED!\n');
    }

    await prisma.$disconnect();
}

finalVerification().catch(console.error);
