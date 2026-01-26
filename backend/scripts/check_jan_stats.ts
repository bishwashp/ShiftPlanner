
import { PrismaClient } from '../generated/prisma';

const prisma = new PrismaClient();

async function checkJan() {
    console.log('📊 Analyzing January 2026 Statistics...');

    const start = new Date('2026-01-01T00:00:00.000Z');
    const end = new Date('2026-02-01T00:00:00.000Z');

    const schedules = await prisma.schedule.findMany({
        where: {
            date: { gte: start, lt: end }
        },
        include: { analyst: true }
    });

    const counts: Record<string, number> = {};

    schedules.forEach(s => {
        counts[s.analyst.name] = (counts[s.analyst.name] || 0) + 1;
    });

    console.log('\n--- Shift Counts (Jan 2026) ---');
    Object.entries(counts)
        .sort(([, a], [, b]) => a - b) // Sort Low to High
        .forEach(([name, count]) => {
            console.log(`${name}: ${count}`);
        });
}

checkJan()
    .catch(e => console.error(e))
    .finally(() => prisma.$disconnect());
