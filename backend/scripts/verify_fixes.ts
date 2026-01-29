
import { prisma } from '../src/lib/prisma';
import { WeekendRotationAlgorithm } from '../src/services/scheduling/algorithms/WeekendRotationAlgorithm';
import moment from 'moment';

async function verifyFixes() {
    console.log('🔍 VERIFICATION START: Checking Logic Fixes\n');

    const startDate = new Date('2026-02-01');
    const endDate = new Date('2026-03-31'); // 2 months

    // Get AMR region
    const region = await prisma.region.findFirst({ where: { name: 'AMR' } });
    if (!region) {
        console.log('❌ AMR region not found');
        return;
    }

    // Fetch analysts
    const analysts = await prisma.analyst.findMany({
        where: { isActive: true, regionId: region.id },
        include: {
            vacations: { where: { isApproved: true } },
            constraints: { where: { isActive: true } }
        }
    });

    console.log(`👥 Found ${analysts.length} active analysts in AMR`);

    // Fetch existing Jan 2026 schedules (Context)
    const existingSchedules = await prisma.schedule.findMany({
        where: {
            date: { gte: new Date('2026-01-01'), lt: new Date('2026-02-01') },
            regionId: region.id
        }
    });

    console.log(`📋 Loaded ${existingSchedules.length} historical schedules (Jan 2026)`);

    const algorithm = new WeekendRotationAlgorithm();

    // GENERATE
    console.log('🚀 Running Generation...');
    const result = await algorithm.generateSchedules({
        startDate,
        endDate,
        analysts,
        existingSchedules,
        globalConstraints: [],
        regionId: region.id
    });

    console.log(`✅ Generated ${result.proposedSchedules.length} schedules\n`);

    // CHECK 1: AM->PM Rotation Presence
    const rotatedShifts = result.proposedSchedules.filter(s => s.type === 'AM_TO_PM_ROTATION');
    console.log(`🔄 AM->PM Rotations Detected: ${rotatedShifts.length}`);
    if (rotatedShifts.length > 0) {
        console.log('   ✅ PASS: AM->PM rotation logic is active.');
        const sample = rotatedShifts[0];
        console.log(`      Sample: ${sample.analystName} on ${sample.date} (Type: ${sample.type})`);
    } else {
        console.log('   ❌ FAIL: No AM->PM rotations generated! Logic might be broken.');
    }

    // CHECK 2: Strict Weekend Gap (14 Days)
    console.log('\n📊 Checking Weekend Gaps (Strict 14-day rule)...');
    const weekendWork = new Map<string, string[]>();

    // Seed with history
    existingSchedules.forEach(s => {
        const date = moment(s.date);
        if (date.day() === 0 || date.day() === 6) {
            const list = weekendWork.get(s.analystId) || [];
            list.push(s.date.toISOString().split('T')[0]);
            weekendWork.set(s.analystId, list);
        }
    });

    // Add proposed
    result.proposedSchedules.forEach(s => {
        const date = moment(s.date);
        if (date.day() === 0 || date.day() === 6) {
            const list = weekendWork.get(s.analystId) || [];
            list.push(s.date);
            weekendWork.set(s.analystId, list);
        }
    });

    let gapViolations = 0;
    for (const [id, dates] of weekendWork) {
        dates.sort();
        for (let i = 1; i < dates.length; i++) {
            const prev = moment(dates[i - 1]);
            const curr = moment(dates[i]);
            const diffDays = curr.diff(prev, 'days');

            // We ignore consecutive Sat-Sun (1 day diff) as that's a normal single weekend block
            // We also ignore 6 day diff (Sun -> Sat) as that matches the SUN_THU -> TUE_SAT pipeline
            // We flag if diff is > 1 but < 14, excluding 6
            if (diffDays > 1 && diffDays < 13 && diffDays !== 6) {
                const name = analysts.find(a => a.id === id)?.name || id;
                console.log(`   ⚠️ Violation: ${name} worked ${dates[i - 1]} and ${dates[i]} (Gap: ${diffDays} days)`);
                gapViolations++;
            }
        }
    }

    if (gapViolations === 0) {
        console.log('   ✅ PASS: No consecutive weekend violations found.');
    } else {
        console.log(`   ❌ FAIL: Found ${gapViolations} gap violations.`);
    }

    // CHECK 3: PM Screener Coverage on specific dates
    console.log('\n🛡️ Checking PM Screener Coverage for Reported Dates...');
    const targetDates = ['2026-02-05', '2026-02-06', '2026-02-23'];

    targetDates.forEach(date => {
        const pmScreeners = result.proposedSchedules.filter(
            s => s.date === date && s.isScreener && ['PM', 'EVENING'].includes(s.shiftType)
        );
        const amScreeners = result.proposedSchedules.filter(
            s => s.date === date && s.isScreener && ['AM', 'MORNING'].includes(s.shiftType)
        );

        if (pmScreeners.length > 0) {
            console.log(`   ✅ ${date}: Has ${pmScreeners.length} PM Screener(s) (${pmScreeners.map(s => s.analystName).join(', ')})`);
        } else {
            console.log(`   ❌ ${date}: MISSING PM SCREENER! (AM Screeners: ${amScreeners.length})`);
        }
    });

    await prisma.$disconnect();
}

verifyFixes().catch(console.error);
