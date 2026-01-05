import { PrismaClient } from '../../generated/prisma';
import { IntelligentScheduler } from '../services/IntelligentScheduler';
import moment from 'moment-timezone';

const prisma = new PrismaClient();

async function main() {
    console.log('🇸🇬 TEST: SGP Schedule Generation');

    // 1. Get SGP Region
    const region = await prisma.region.findUnique({ where: { name: 'SGP' } });
    if (!region) throw new Error('SGP Region not found!');
    console.log(`Region Found: ${region.name} (${region.id})`);

    // 2. Setup Context
    const startDate = moment.utc('2026-03-01').toDate();
    const endDate = moment.utc('2026-03-07').toDate(); // 1 week

    // 3. Create Dummy Analysts for SGP if none exist
    // We need enough for AM and PM
    const analysts = await prisma.analyst.findMany({ where: { regionId: region.id } });
    if (analysts.length < 4) {
        console.log('Creating temporary test analysts for SGP...');
        // Clean up previous test data if any specific ones exist? No, just add more if needed.
    }

    // 4. Run Scheduler
    const scheduler = new IntelligentScheduler(prisma);

    // NOTE: We need analysts in the context!
    // If DB is empty for SGP, we won't generate anything.
    // Let's create mock analysts in memory if we don't want to pollute DB? 
    // Scheduler logic reads from DB for constraints, but takes analysts array as input.

    // Creating fast mock analysts in memory
    const mockAnalysts: any[] = [
        { id: 'sgp-1', name: 'SGP Analyst 1', shiftType: 'AM', regionId: region.id, isActive: true, schedules: [] },
        { id: 'sgp-2', name: 'SGP Analyst 2', shiftType: 'AM', regionId: region.id, isActive: true, schedules: [] },
        { id: 'sgp-3', name: 'SGP Analyst 3', shiftType: 'PM', regionId: region.id, isActive: true, schedules: [] },
        { id: 'sgp-4', name: 'SGP Analyst 4', shiftType: 'PM', regionId: region.id, isActive: true, schedules: [] },
    ];

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
    const amShifts = result.proposedSchedules.filter(s => s.shiftType === 'AM').length;
    const pmShifts = result.proposedSchedules.filter(s => s.shiftType === 'PM').length;
    console.log(`AM Shifts: ${amShifts}`);
    console.log(`PM Shifts: ${pmShifts}`);

    result.proposedSchedules.forEach(s => {
        console.log(`[${s.date}] ${s.analystName} -> ${s.shiftType} (${s.type})`);
    });

    if (amShifts > 0 && pmShifts > 0) {
        console.log('✅ SUCCESS: Multi-shift generation working.');
    } else {
        console.error('❌ FAILURE: SGP should have both AM and PM shifts.');
    }

}

main().catch(console.error).finally(() => prisma.$disconnect());
