
import { PrismaClient } from '../generated/prisma';

const prisma = new PrismaClient();

async function inspect() {
    console.log('🕵️‍♂️ Inspecting Schedule for Sunday Feb 1 2026...');

    // Search for records on Feb 1 (UTC Midnight, which corresponds to schedule normalized date)
    // We need to look for dates that cover this range.
    // Our new logic saves as UTC Midnight.
    const targetDate = new Date('2026-02-01T00:00:00.000Z');

    const records = await prisma.schedule.findMany({
        where: {
            date: targetDate
        },
        include: {
            analyst: true
        }
    });

    console.log(`Found ${records.length} assignments for Feb 1.`);
    records.forEach(r => {
        console.log(`- ${r.analyst.name} (${r.shiftType})`);
    });

    if (records.length > 2) {
        console.error('🚨 Feb 1 has > 2 assignments! Still treating as Weekday?');
    } else {
        console.log('✅ Feb 1 has weekend staffing levels.');
    }
}

inspect()
    .catch(e => console.error(e))
    .finally(() => prisma.$disconnect());
