
import { PrismaClient } from '../generated/prisma';

const prisma = new PrismaClient();

async function clearFuture() {
    console.log('🧹 Clearing schedules from Feb 1, 2026 onwards...');

    const result = await prisma.schedule.deleteMany({
        where: {
            date: {
                gte: new Date('2026-02-01')
            }
        }
    });

    console.log(`✅ Deleted ${result.count} schedule entries.`);
}

clearFuture()
    .catch(e => console.error(e))
    .finally(() => prisma.$disconnect());
