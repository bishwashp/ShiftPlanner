import { prisma } from '../lib/prisma';
import moment from 'moment';

async function fetchFeb2026Schedules() {
    const startDate = new Date('2026-02-01');
    const endDate = new Date('2026-02-28');

    console.log(`\n📅 Fetching schedules from ${startDate.toISOString().split('T')[0]} to ${endDate.toISOString().split('T')[0]}\n`);

    const schedules = await prisma.schedule.findMany({
        where: {
            date: {
                gte: startDate,
                lte: endDate
            }
        },
        include: {
            analyst: true
        },
        orderBy: [
            { date: 'asc' },
            { shiftType: 'asc' }
        ]
    });

    if (schedules.length === 0) {
        console.log('❌ No schedules found for February 2026.');
        return;
    }

    console.log(`✅ Found ${schedules.length} schedule entries.\n`);

    // Group by date
    const byDate = new Map<string, any[]>();
    for (const s of schedules) {
        const dateStr = moment.utc(s.date).format('YYYY-MM-DD');
        if (!byDate.has(dateStr)) byDate.set(dateStr, []);
        byDate.get(dateStr)!.push(s);
    }

    // Print table
    console.log('| Date       | Day       | Shift   | Analyst Name         | Screener |');
    console.log('|------------|-----------|---------|----------------------|----------|');

    for (const [dateStr, entries] of [...byDate.entries()].sort()) {
        const dayOfWeek = moment.utc(dateStr).format('dddd');
        for (const e of entries) {
            const screenerMark = e.isScreener ? '✓' : '';
            console.log(`| ${dateStr} | ${dayOfWeek.padEnd(9)} | ${e.shiftType.padEnd(7)} | ${e.analyst.name.padEnd(20)} | ${screenerMark.padEnd(8)} |`);
        }
    }

    console.log('\n--- Analysis ---');

    // Analyze for violations
    // Core rules (inferred):
    //   1. Weekdays: Need 1 Morning + 1 Evening shift.
    //   2. Weekends: Need 1 Weekend shift OR (1 Morning + 1 Evening). 
    //      User Hint: "Multiple weekend shift analysts" - implies only 1 analyst should cover weekend? Or 1 per type?
    //   3. Rotation: Each analyst should work ~5 days on, ~2 days off pattern. Check for anomalies.

    // Check for duplicate shifts (same date, same shift type, multiple analysts)
    for (const [dateStr, entries] of byDate) {
        const shiftCounts = new Map<string, number>();
        for (const e of entries) {
            const key = e.shiftType;
            shiftCounts.set(key, (shiftCounts.get(key) || 0) + 1);
        }
        for (const [shift, count] of shiftCounts) {
            if (count > 1) {
                console.log(`⚠️  VIOLATION: ${dateStr} has ${count} analysts assigned to ${shift} shift.`);
            }
        }
    }

    // Check for weekday coverage
    for (const [dateStr, entries] of byDate) {
        const dayOfWeek = moment.utc(dateStr).day(); // 0=Sun, 6=Sat
        const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

        const shiftTypes = new Set(entries.map(e => e.shiftType));

        if (!isWeekend) {
            // Weekday: Need MORNING and EVENING
            if (!shiftTypes.has('MORNING')) {
                console.log(`⚠️  VIOLATION: ${dateStr} (Weekday) missing MORNING shift.`);
            }
            if (!shiftTypes.has('EVENING')) {
                console.log(`⚠️  VIOLATION: ${dateStr} (Weekday) missing EVENING shift.`);
            }
        } else {
            // Weekend: Need WEEKEND or (MORNING + EVENING)
            if (!shiftTypes.has('WEEKEND') && !(shiftTypes.has('MORNING') && shiftTypes.has('EVENING'))) {
                console.log(`⚠️  VIOLATION: ${dateStr} (Weekend) has incomplete coverage. Shifts: ${[...shiftTypes].join(', ')}`);
            }
        }
    }

    // Check rotation: Analyst working > 5 consecutive days
    const analystWorkDays = new Map<string, string[]>();
    for (const [dateStr, entries] of byDate) {
        for (const e of entries) {
            if (!analystWorkDays.has(e.analystId)) analystWorkDays.set(e.analystId, []);
            analystWorkDays.get(e.analystId)!.push(dateStr);
        }
    }

    for (const [analystId, days] of analystWorkDays) {
        const sorted = [...new Set(days)].sort();
        let streak = 1;
        for (let i = 1; i < sorted.length; i++) {
            const prev = moment.utc(sorted[i - 1]);
            const curr = moment.utc(sorted[i]);
            if (curr.diff(prev, 'days') === 1) {
                streak++;
                if (streak > 5) {
                    const analyst = schedules.find(s => s.analystId === analystId)?.analyst.name;
                    console.log(`⚠️  VIOLATION: ${analyst} worked ${streak} consecutive days (ending ${sorted[i]}).`);
                }
            } else {
                streak = 1;
            }
        }
    }

    console.log('\n--- End of Analysis ---');
}

fetchFeb2026Schedules().catch(console.error).finally(() => prisma.$disconnect());
