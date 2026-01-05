import { PrismaClient } from '../../generated/prisma';
import { IntelligentScheduler } from '../services/IntelligentScheduler';
import { ConflictDetectionService } from '../services/conflict/ConflictDetectionService';
import moment from 'moment-timezone';

const prisma = new PrismaClient();

async function main() {
    const scheduler = new IntelligentScheduler(prisma);
    const conflictService = new ConflictDetectionService(prisma);

    // Define full range
    const startDate = moment.utc('2025-12-01').toDate();
    const endDate = moment.utc('2027-01-31').toDate();

    console.log(`\n🧹 Clearing schedules from ${moment.utc(startDate).format('YYYY-MM-DD')} to ${moment.utc(endDate).format('YYYY-MM-DD')}...`);

    const deleteResult = await prisma.schedule.deleteMany({
        where: {
            date: {
                gte: startDate,
                lte: endDate
            }
        }
    });

    console.log(`✅ Deleted ${deleteResult.count} existing schedules`);

    // Fetch analysts
    const analysts = await prisma.analyst.findMany({
        where: { isActive: true },
        include: {
            schedules: {
                where: {
                    date: { lt: startDate } // Fetch history before this period for context
                }
            }
        }
    });

    console.log(`👥 Loaded ${analysts.length} analysts`);

    // Regenerate
    console.log('\n🚀 Regenerating schedules...');
    const result = await scheduler.generate({
        startDate,
        endDate,
        analysts,
        existingSchedules: [], // generating fresh
        globalConstraints: []
    });

    console.log(`✅ Generated ${result.proposedSchedules.length} schedules`);

    // Persist
    console.log('\n💾 Saving to database...');

    // Batch insert
    await prisma.$transaction(
        result.proposedSchedules.map(s => prisma.schedule.create({
            data: {
                date: moment.utc(s.date).toDate(),
                shiftType: s.shiftType,
                analystId: s.analystId,
                isScreener: s.isScreener
            }
        }))
    );
    console.log('✅ Saved to database');

    // Verify
    console.log('\n🔍 Verifying with ConflictDetectionService...');

    // We rely on the service fetching from DB
    const conflictResult = await conflictService.detectConflicts(
        startDate,
        endDate
    );

    const conflicts = [...conflictResult.critical, ...conflictResult.recommended];

    console.log(`\n📊 Verification Results:`);
    console.log(`Total Conflicts: ${conflicts.length}`);
    console.log(`Critical: ${conflictResult.critical.length}`);
    console.log(`Recommended: ${conflictResult.recommended.length}`);

    const byType = conflicts.reduce((acc: Record<string, number>, c: any) => {
        acc[c.type] = (acc[c.type] || 0) + 1;
        return acc;
    }, {});

    console.table(byType);

    if (conflicts.length > 0) {
        console.log('\nTop 5 Conflicts:');
        conflicts.slice(0, 5).forEach(c => {
            console.log(`- [${c.type}] ${c.date}: ${c.message}`);
        });
    }

    // Specific check for weekends
    console.log('\n🔎 Detailed Weekend Check (Feb 2026):');
    // We need to fetch the newly saved schedules to analyze them
    const savedSchedules = await prisma.schedule.findMany({
        where: {
            date: {
                gte: startDate,
                lte: endDate
            }
        }
    });

    const feb2026 = savedSchedules.filter((s: any) => s.date.toISOString().startsWith('2026-02'));
    const febWeekends = feb2026.filter((s: any) => {
        const d = moment.utc(s.date);
        return d.day() === 0 || d.day() === 6;
    });
    console.log(`Total Feb 2026 Weekend Shifts: ${febWeekends.length}`);
    // Group by date
    const byDate = new Map<string, number>();
    febWeekends.forEach((s: any) => {
        const d = s.date.toISOString().slice(0, 10);
        byDate.set(d, (byDate.get(d) || 0) + 1);
    });
    let maxPerDay = 0;
    for (const [d, count] of byDate) {
        if (count > maxPerDay) maxPerDay = count;
    }
    console.log(`Max analysts per weekend day in Feb 2026: ${maxPerDay} (Expect 1: Single rotation track)`);

}

main()
    .catch(e => console.error(e))
    .finally(() => prisma.$disconnect());
