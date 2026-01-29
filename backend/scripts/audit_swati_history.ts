
import { PrismaClient } from '../generated/prisma';
import moment from 'moment';

const prisma = new PrismaClient();

async function auditSwati() {
    console.log('🔍 Auditing Swati History...');

    // 1. Get Swati
    const swati = await prisma.analyst.findFirst({ where: { name: 'Swati' } });
    if (!swati) { console.log('❌ Swati not found'); return; }
    console.log(`👤 Found Swati: ${swati.id}`);

    // 2. Check Mar 29 Shift
    const shift = await prisma.schedule.findFirst({
        where: {
            analystId: swati.id,
            date: new Date('2026-03-29')
        }
    });

    if (shift) {
        console.log(`✅ Found Mar 29 Shift: type=${shift.shiftType}, date=${shift.date}`);
    } else {
        console.log('❌ No shift found for Swati on Mar 29');
    }

    // 3. Simulate Rotation Logic Lookback check
    const weekStart = moment.utc('2026-04-05').startOf('week'); // April 5 is Sunday
    const lookbackWeeks = 4; // Assume 4
    const lookbackStart = moment.utc(weekStart).subtract(lookbackWeeks, 'weeks');

    console.log(`📅 WeekStart: ${weekStart.format()}, LookbackStart: ${lookbackStart.format()}`);

    if (shift) {
        const shiftDate = moment.utc(shift.date);
        const isSunday = shiftDate.day() === 0;
        const isAfter = shiftDate.startOf('day').isAfter(lookbackStart.startOf('day'));
        const isBefore = shiftDate.startOf('day').isBefore(weekStart.startOf('day'));

        console.log(`Running Logic Check:`);
        console.log(`- Is Sunday (0)? ${shiftDate.day()} -> ${isSunday}`);
        console.log(`- Is After Lookback? ${isAfter}`);
        console.log(`- Is Before WeekStart? ${isBefore}`);
        console.log(`- Is AM/PM? ${shift.shiftType}`);
    }

}

auditSwati()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
