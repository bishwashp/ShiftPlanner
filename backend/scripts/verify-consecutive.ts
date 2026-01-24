/**
 * Verification script for Phase 1: Generate fresh and check for consecutive workday violations
 * Tests the algorithm WITHOUT saving to DB
 */
import { prisma } from '../src/lib/prisma';
import { WeekendRotationAlgorithm } from '../src/services/scheduling/algorithms/WeekendRotationAlgorithm';
import moment from 'moment';

async function verifyPhase1() {
    console.log('🔍 Phase 1 Verification: Generate fresh and check consecutive days\n');

    const startDate = new Date('2026-02-01');
    const endDate = new Date('2026-03-31'); // Generate 2 months for thorough test

    // Get analysts
    const analysts = await prisma.analyst.findMany({
        where: { isActive: true },
        include: {
            vacations: { where: { isApproved: true } },
            constraints: { where: { isActive: true } }
        }
    });

    console.log(`👥 Found ${analysts.length} active analysts`);

    // Get existing Jan 2026 schedules as seed for continuity
    const existingSchedules = await prisma.schedule.findMany({
        where: {
            date: {
                gte: new Date('2026-01-01'),
                lt: new Date('2026-02-01')
            }
        }
    });

    console.log(`📋 Found ${existingSchedules.length} existing Jan 2026 schedules for continuity\n`);

    // Get region
    const region = await prisma.region.findFirst({ where: { name: 'AMR' } });
    if (!region) {
        console.log('❌ AMR region not found');
        return;
    }

    // Generate schedules (no algorithmConfig - uses defaults)
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

    // Check for consecutive violations in GENERATED schedules
    const byAnalyst = new Map<string, { name: string; dates: string[] }>();
    for (const s of result.proposedSchedules) {
        const analystId = s.analystId;
        const name = s.analystName || 'Unknown';
        const dateStr = s.date;

        if (!byAnalyst.has(analystId)) {
            byAnalyst.set(analystId, { name, dates: [] });
        }
        byAnalyst.get(analystId)!.dates.push(dateStr);
    }

    let violations: { analyst: string; streak: number; from: string; to: string }[] = [];

    for (const [analystId, data] of byAnalyst) {
        // Sort dates
        data.dates.sort();

        let streak = 1;
        for (let i = 1; i < data.dates.length; i++) {
            const prevDate = moment(data.dates[i - 1]);
            const currDate = moment(data.dates[i]);
            const diff = currDate.diff(prevDate, 'days');

            if (diff === 1) {
                streak++;
                if (streak > 5) {
                    violations.push({
                        analyst: data.name,
                        streak,
                        from: data.dates[i - streak + 1],
                        to: data.dates[i]
                    });
                }
            } else {
                streak = 1;
            }
        }
    }

    if (violations.length === 0) {
        console.log('✅ SUCCESS! No consecutive violations in GENERATED schedules!\n');
        console.log('   All analysts have <= 5 consecutive workdays.\n');
    } else {
        console.log(`❌ Found ${violations.length} violations in GENERATED schedules:\n`);
        const seen = new Set<string>();
        for (const v of violations) {
            const key = `${v.analyst}-${v.from}-${v.to}`;
            if (!seen.has(key)) {
                seen.add(key);
                console.log(`  - ${v.analyst}: ${v.streak} consecutive days from ${v.from} to ${v.to}`);
            }
        }
    }

    await prisma.$disconnect();
}

verifyPhase1().catch(console.error);
