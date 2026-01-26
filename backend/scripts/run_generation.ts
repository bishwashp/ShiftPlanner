
import { PrismaClient } from '../generated/prisma';
import { IntelligentScheduler } from '../src/services/IntelligentScheduler';
import { SchedulingContext } from '../src/services/scheduling/algorithms/types';
import moment from 'moment-timezone';

const prisma = new PrismaClient();

async function runGen() {
    console.log('🚀 Triggering Debug Generation (Full Year)...');

    const analysts = await prisma.analyst.findMany({
        where: { isActive: true, region: { name: 'AMR' } }
    });

    const scheduler = new IntelligentScheduler(prisma);

    // Fetch January History to provide context (Dave Jan 25 -> Feb 3 pipeline)
    const janHistory = await prisma.schedule.findMany({
        where: {
            date: {
                gte: new Date('2026-01-01T00:00:00.000Z'),
                lt: new Date('2026-02-01T00:00:00.000Z')
            }
        }
    });
    console.log(`📜 Loaded ${janHistory.length} historical records from Jan 2026 for context.`);

    const context: SchedulingContext = {
        regionId: analysts[0].regionId,
        timezone: 'America/New_York',
        startDate: new Date('2026-02-01'),
        endDate: new Date('2026-12-31'), // Full year run
        analysts: analysts,
        existingSchedules: janHistory, // PASS HISTORY HERE
        globalConstraints: [],
        algorithmConfig: {
            optimizationStrategy: 'GREEDY',
            maxIterations: 1,
            fairnessWeight: 1,
            constraintWeight: 1,
            efficiencyWeight: 0,
            convergenceThreshold: 0,
            randomizationFactor: 0,
            screenerAssignmentStrategy: 'ROUND_ROBIN',
            weekendRotationStrategy: 'FAIRNESS_OPTIMIZED'
        }
    };

    const result = await scheduler.generate(context);

    // VERIFICATION: Check in-memory result for Feb 1
    const feb1 = result.proposedSchedules.filter(s =>
        s.date === '2026-02-01' ||
        ((s.date as any) instanceof Date && (s.date as any).toISOString().includes('2026-02-01'))
    );
    console.log(`🔎 [IN-MEMORY DEBUG] Generated ${feb1.length} assignments for Feb 1.`);
    feb1.forEach(s => console.log(`   - ${s.analystName} (${s.shiftType})`));

    // Verification Block
    console.log('🔍 verifying Output for Srujana (Feb 14)...');
    const srujanaCheck = result.proposedSchedules.find(s =>
        (s.analystName === 'Srujana' || s.analystId === 'cmjdyxxwk0004vu64b5p3v96r') &&
        (s.date === '2026-02-14' || new Date(s.date).toISOString().includes('2026-02-14'))
    );

    if (srujanaCheck) {
        console.error(`🚨 SRUJANA FOUND IN OUTPUT for Feb 14! Type=${srujanaCheck.type}, Shift=${srujanaCheck.shiftType}`);
    } else {
        console.log(`✅ Srujana NOT found in output for Feb 14.`);
    }

    // Transactional Save
    console.log(`💾 Starting transactional save for ${result.proposedSchedules.length} schedules...`);

    // Deduplicate and Normalize
    const uniqueSchedules = new Map<string, any>();
    result.proposedSchedules.forEach(s => {
        const dateObj = new Date(s.date);
        // Force UTC Midnight using UTC getters to avoid Local Time rollback (e.g. 00:00Z -> 19:00 EST Prev Day)
        const utcDate = new Date(Date.UTC(dateObj.getUTCFullYear(), dateObj.getUTCMonth(), dateObj.getUTCDate()));
        const key = `${s.analystId}_${utcDate.toISOString()}`;
        const normalizedSchedule = { ...s, date: utcDate };
        if (uniqueSchedules.has(key)) {
            const existing = uniqueSchedules.get(key);
            if (s.isScreener) existing.isScreener = true;
        } else {
            uniqueSchedules.set(key, normalizedSchedule);
        }
    });

    const uniqueList = Array.from(uniqueSchedules.values());
    console.log(`ℹ️ Normalized to ${uniqueList.length} unique records.`);

    try {
        await prisma.$transaction(async (tx) => {
            // 1. Delete (Strict)
            // Use UTC Midnight boundary
            // Use UTC Midnight boundary for Feb 1 Start
            const deleteStart = new Date('2026-01-31T23:59:59.000Z');
            const deleted = await tx.schedule.deleteMany({
                where: { date: { gt: deleteStart } }
            });
            console.log(`🧹 [TX] Deleted ${deleted.count} existing records.`);

            // 2. Create (Sequential Loop for safety)
            let createdCount = 0;
            for (const s of uniqueList) {
                await tx.schedule.create({
                    data: {
                        analystId: s.analystId,
                        date: s.date,
                        shiftType: s.shiftType,
                        isScreener: s.isScreener,
                        regionId: s.analystId ? analysts.find(a => a.id === s.analystId)?.regionId || context.regionId : context.regionId
                    }
                });
                createdCount++;
            }
            console.log(`✅ [TX] Created ${createdCount} records successfully.`);
        }, {
            timeout: 60000 // 60s timeout
        });
        console.log('🎉 Generation and Save Complete!');
    } catch (error) {
        console.error('🔥 Transaction Failed:', error);
    }
}

runGen()
    .catch(e => console.error(e))
    .finally(() => prisma.$disconnect());
