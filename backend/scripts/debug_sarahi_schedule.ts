
import { PrismaClient } from '@prisma/client';
import moment from 'moment';

const prisma = new PrismaClient();

async function checkSarahi() {
    const sarahi = await prisma.analyst.findFirst({
        where: { name: { contains: 'Sarahi' } }
    });

    if (!sarahi) {
        console.log("Sarahi not found");
        return;
    }

    console.log(`Checking Schedule for: ${sarahi.name} (${sarahi.id})`);

    const schedules = await prisma.schedule.findMany({
        where: {
            analystId: sarahi.id,
            date: {
                gte: new Date('2026-01-20'),
                lte: new Date('2026-02-10')
            }
        },
        orderBy: { date: 'asc' }
    });

    console.log("--- Existing Shifts ---");
    schedules.forEach((s: any) => {
        console.log(`${moment(s.date).format('YYYY-MM-DD')} (${moment(s.date).format('ddd')}) - ${s.shiftType} ${s.isScreener ? '(Screener)' : ''}`);
    });
}

checkSarahi()
    .catch(console.error)
    .finally(async () => await prisma.$disconnect());
