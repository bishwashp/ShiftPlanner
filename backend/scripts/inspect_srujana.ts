
import { PrismaClient } from '../generated/prisma';

const prisma = new PrismaClient();

async function inspect() {
    console.log('🕵️‍♂️ Inspecting Srujana DB Records (Feb 2026)...');

    const records = await prisma.schedule.findMany({
        where: {
            date: {
                gte: new Date('2026-02-01'),
                lte: new Date('2026-02-28')
            },
            // search by name if possible, or fetch all and filter
        },
        include: {
            analyst: true
        }
    });

    const srujanaRecords = records.filter(r => r.analyst.name === 'Srujana');

    console.log(`Found ${srujanaRecords.length} records for Srujana.`);
    srujanaRecords.sort((a, b) => a.date.getTime() - b.date.getTime());

    srujanaRecords.forEach(r => {
        console.log(`- ${r.date.toISOString()} | Shift: ${r.shiftType} | Screener: ${r.isScreener}`);
    });
}

inspect()
    .catch(e => console.error(e))
    .finally(() => prisma.$disconnect());
