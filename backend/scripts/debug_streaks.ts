
import { PrismaClient } from '../generated/prisma';
import moment from 'moment';

const prisma = new PrismaClient();

async function analyzeStreaks() {
    console.log('🕵️‍♂️ Starting Streak Analysis...');

    const analysts = await prisma.analyst.findMany({
        where: { isActive: true, region: { name: 'AMR' } }
    });

    const schedules = await prisma.schedule.findMany({
        where: {
            date: {
                gte: new Date('2026-02-01'),
                lte: new Date('2026-04-01') // Check first 2 months
            }
        },
        orderBy: { date: 'asc' }
    });

    for (const analyst of analysts) {
        const mySchedules = schedules.filter(s => s.analystId === analyst.id);
        let streak = 0;
        let maxStreak = 0;
        let streakStart = null;
        let streakEnd = null;
        let currentStreakDays: string[] = [];

        // Sort by date just in case
        mySchedules.sort((a, b) => a.date.getTime() - b.date.getTime());

        let lastDate: moment.Moment | null = null;

        for (const s of mySchedules) {
            const currentDate = moment.utc(s.date);

            if (lastDate && currentDate.diff(lastDate, 'days') === 1) {
                streak++;
                currentStreakDays.push(currentDate.format('YYYY-MM-DD'));
            } else {
                // Reset
                streak = 1;
                currentStreakDays = [currentDate.format('YYYY-MM-DD')];
            }

            if (streak > maxStreak) {
                maxStreak = streak;
                streakEnd = currentDate;
            }

            // Log individual breaches
            if (streak > 5) {
                console.warn(`🚨 BREACH [${analyst.name}]: ${streak} days ending ${currentDate.format('YYYY-MM-DD')}`);
                console.warn(`   Sequence: ${currentStreakDays.slice(-6).join(' -> ')}`);
            }

            lastDate = currentDate;
        }

        if (maxStreak > 5) {
            console.log(`❌ ${analyst.name} Max Streak: ${maxStreak}`);
        } else {
            console.log(`✅ ${analyst.name} Max Streak: ${maxStreak}`);
        }
    }
}

analyzeStreaks()
    .catch(e => console.error(e))
    .finally(() => prisma.$disconnect());
