/**
 * Verification script for Phase 3: Check weekend rotation distribution
 * No analyst should work excessive consecutive weekends if pool is large enough
 */
import { prisma } from '../src/lib/prisma';
import { WeekendRotationAlgorithm } from '../src/services/scheduling/algorithms/WeekendRotationAlgorithm';
import moment from 'moment';

async function verifyPhase3() {
    console.log('🔍 Phase 3 Verification: Check weekend rotation distribution\n');

    const startDate = new Date('2026-02-01');
    const endDate = new Date('2026-06-30'); // 5 months for thorough test

    // Get AMR region
    const region = await prisma.region.findFirst({ where: { name: 'AMR' } });
    if (!region) {
        console.log('❌ AMR region not found');
        return;
    }

    // Fetch only analysts in AMR region
    const analysts = await prisma.analyst.findMany({
        where: { isActive: true, regionId: region.id },
        include: {
            vacations: { where: { isApproved: true } },
            constraints: { where: { isActive: true } }
        }
    });

    console.log(`👥 Found ${analysts.length} active analysts in AMR`);

    const existingSchedules = await prisma.schedule.findMany({
        where: {
            date: { gte: new Date('2026-01-01'), lt: new Date('2026-02-01') },
            regionId: region.id
        }
    });

    console.log(`📋 Found ${existingSchedules.length} existing Jan 2026 schedules\n`);

    const algorithm = new WeekendRotationAlgorithm();
    const result = await algorithm.generateSchedules({
        startDate,
        endDate,
        analysts,
        existingSchedules,
        globalConstraints: [],
        regionId: region.id
    });

    console.log(`✅ Generated ${result.proposedSchedules.length} proposed schedules\n`);

    // Track weekend assignments per analyst
    const weekendCountByAnalyst = new Map<string, { name: string; sundays: string[]; saturdays: string[] }>();

    for (const analyst of analysts) {
        weekendCountByAnalyst.set(analyst.id, { name: analyst.name, sundays: [], saturdays: [] });
    }

    for (const s of result.proposedSchedules) {
        const dateStr = s.date;
        const dayOfWeek = moment(dateStr).day();

        if (dayOfWeek === 0) { // Sunday
            weekendCountByAnalyst.get(s.analystId)?.sundays.push(dateStr);
        } else if (dayOfWeek === 6) { // Saturday
            weekendCountByAnalyst.get(s.analystId)?.saturdays.push(dateStr);
        }
    }

    // Check for consecutive Sundays (5+ in a row)
    console.log('📊 Weekend Distribution:\n');
    let hasViolation = false;

    for (const [analystId, data] of weekendCountByAnalyst) {
        const totalWeekends = data.sundays.length + data.saturdays.length;
        console.log(`  ${data.name}: ${data.sundays.length} Sundays, ${data.saturdays.length} Saturdays (${totalWeekends} total)`);

        // Check for 5+ consecutive Sundays
        if (data.sundays.length >= 5) {
            data.sundays.sort();
            let consecutiveCount = 1;
            for (let i = 1; i < data.sundays.length; i++) {
                const prevDate = moment(data.sundays[i - 1]);
                const currDate = moment(data.sundays[i]);
                const weekDiff = currDate.diff(prevDate, 'weeks');

                if (weekDiff === 1) {
                    consecutiveCount++;
                    if (consecutiveCount >= 5) {
                        console.log(`    ❌ ${data.name} has ${consecutiveCount}+ consecutive Sundays!`);
                        hasViolation = true;
                    }
                } else {
                    consecutiveCount = 1;
                }
            }
        }
    }

    console.log('');
    if (!hasViolation) {
        console.log('✅ SUCCESS! No analyst has 5+ consecutive Sundays.\n');
    } else {
        console.log('❌ VIOLATION: Some analysts have 5+ consecutive Sundays.\n');
    }

    await prisma.$disconnect();
}

verifyPhase3().catch(console.error);
