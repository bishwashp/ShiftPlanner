

import { PrismaClient } from '../generated/prisma';
import moment from 'moment';

const prisma = new PrismaClient();

async function benchmark() {
    console.log('📊 Starting Schedule Benchmark Analysis...');

    // Get all active analysts
    const analysts = await prisma.analyst.findMany({
        where: {
            isActive: true,
            region: {
                name: 'AMR'
            }
        }
    });

    // Get all schedules for 2026
    const schedules = await prisma.schedule.findMany({
        where: {
            date: {
                gte: new Date('2026-02-01'),
                lte: new Date('2026-12-31')
            }
        }
    });

    console.log(`Found ${analysts.length} analysts and ${schedules.length} schedule entries.`);

    const stats = new Map<string, {
        name: string,
        totalDays: number,
        weekendDays: number,
        screenerDays: number,
        maxScreenerStreak: number,
        shiftType: string
    }>();

    // Initialize
    analysts.forEach((a: any) => {
        stats.set(a.id, {
            name: a.name,
            totalDays: 0,
            weekendDays: 0,
            screenerDays: 0,
            maxScreenerStreak: 0,
            shiftType: a.shiftType
        });
    });

    // Tally
    schedules.forEach((s: any) => {
        const stat = stats.get(s.analystId);
        if (!stat) return;

        stat.totalDays++;

        const date = moment(s.date);
        const day = date.day(); // 0=Sun, 6=Sat
        if (day === 0 || day === 6) {
            stat.weekendDays++;
        }

        if (s.isScreener) {
            stat.screenerDays++;
        }
    });

    // Print Table
    console.table(Array.from(stats.values()).map(s => ({
        Name: s.name,
        Shift: s.shiftType,
        'Total Days': s.totalDays,
        'Weekend Days': s.weekendDays,
        'Screener Days': s.screenerDays,
        'Screener %': (s.screenerDays / s.totalDays * 100).toFixed(1) + '%'
    })));

    // Analyze Variance
    const screeners = Array.from(stats.values()).map(s => s.screenerDays);
    const min = Math.min(...screeners);
    const max = Math.max(...screeners);
    const mean = screeners.reduce((a, b) => a + b, 0) / screeners.length;
    const sd = Math.sqrt(screeners.map(x => Math.pow(x - mean, 2)).reduce((a, b) => a + b, 0) / screeners.length);

    console.log('\n📉 Statistics:');
    console.log(`Screener Range: ${min} - ${max}`);
    console.log(`Standard Deviation: ${sd.toFixed(2)}`);
    console.log(`Coefficient of Variation: ${(sd / mean).toFixed(2)}`);

    // Integrity Check
    console.log('\n🔍 Integrity Check:');
    const zeroScreener = Array.from(stats.values()).filter(s => s.screenerDays === 0);
    if (zeroScreener.length > 0) {
        console.warn(`⚠️ Analysts with ZERO screener shifts: ${zeroScreener.map(s => s.name).join(', ')}`);
    }
}

benchmark()
    .catch(e => console.error(e))
    .finally(() => prisma.$disconnect());
