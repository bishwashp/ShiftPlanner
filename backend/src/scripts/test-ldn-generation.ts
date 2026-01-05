import { PrismaClient } from '../../generated/prisma';
import { IntelligentScheduler } from '../services/IntelligentScheduler';
import moment from 'moment-timezone';

const prisma = new PrismaClient();

async function main() {
    console.log('🇬🇧 TEST: LDN Schedule Generation');

    // 1. Get LDN Region
    const region = await prisma.region.findUnique({ where: { name: 'LDN' } });
    if (!region) throw new Error('LDN Region not found!');
    console.log(`Region Found: ${region.name} (${region.id})`);

    // 2. Setup Context
    const startDate = moment.utc('2026-03-01').toDate();
    const endDate = moment.utc('2026-03-07').toDate(); // 1 week

    // 3. Mock Analysts for LDN (Single Shift: DAY)
    const mockAnalysts: any[] = [
        { id: 'ldn-1', name: 'LDN Analyst 1', shiftType: 'DAY', regionId: region.id, isActive: true, schedules: [] },
        { id: 'ldn-2', name: 'LDN Analyst 2', shiftType: 'DAY', regionId: region.id, isActive: true, schedules: [] },
        { id: 'ldn-3', name: 'LDN Analyst 3', shiftType: 'DAY', regionId: region.id, isActive: true, schedules: [] },
    ];

    // 4. Run Scheduler
    const scheduler = new IntelligentScheduler(prisma);

    console.log('🚀 Running Scheduler...');
    const result = await scheduler.generate({
        startDate,
        endDate,
        regionId: region.id,
        analysts: mockAnalysts,
        existingSchedules: [],
        globalConstraints: []
    });

    console.log(`✅ Generated ${result.proposedSchedules.length} schedules.`);

    // 5. Inspect Output
    const dayShifts = result.proposedSchedules.filter(s => s.shiftType === 'DAY').length;
    const amShifts = result.proposedSchedules.filter(s => s.shiftType === 'AM').length; // Should be 0
    const pmShifts = result.proposedSchedules.filter(s => s.shiftType === 'PM').length; // Should be 0

    console.log(`DAY Shifts: ${dayShifts}`);
    console.log(`AM Shifts: ${amShifts} (Should be 0)`);
    console.log(`PM Shifts: ${pmShifts} (Should be 0)`);

    result.proposedSchedules.forEach(s => {
        console.log(`[${s.date}] ${s.analystName} -> ${s.shiftType} (${s.type})`);
    });

    if (dayShifts > 0 && amShifts === 0) {
        console.log('✅ SUCCESS: Single-shift LDN generation working.');
    } else {
        console.error('❌ FAILURE: LDN generation produced unexpected shifts.');
    }

}

main().catch(console.error).finally(() => prisma.$disconnect());
