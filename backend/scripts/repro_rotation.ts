
import { PrismaClient } from '../generated/prisma';
import { PatternContinuityService } from '../src/services/scheduling/PatternContinuityService';
import { RotationManager } from '../src/services/scheduling/RotationManager';
import moment from 'moment-timezone';

const prisma = new PrismaClient();

async function repro() {
    console.log('🔬 Reproducing Rotation Logic...');
    const timezone = 'America/New_York';

    const analysts = await prisma.analyst.findMany({
        where: { isActive: true, region: { name: 'AMR' } }
    });

    const continuity = new PatternContinuityService(prisma);
    const rm = new RotationManager(continuity);

    // Simulate Planning for Feb 2026
    const startDate = moment.tz('2026-02-01', timezone).toDate();
    const endDate = moment.tz('2026-02-28', timezone).toDate();

    console.log(`📅 Planning from ${startDate.toISOString()} to ${endDate.toISOString()}`);

    const plans = await rm.planRotation(
        'Intelligent Scheduler',
        'WEEKEND_ROTATION',
        startDate,
        endDate,
        analysts,
        [] // No history for clean repro
    );

    // Inspect Srujana's Plans
    const srujana = analysts.find(a => a.name === 'Srujana');
    if (!srujana) {
        console.error('Srujana not found');
        return;
    }

    const srujanaPlans = plans.filter(p => p.analystId === srujana.id);
    console.log('\n📋 Srujana Rotation Plans:');
    srujanaPlans.forEach(p => {
        console.log(`- ${p.pattern}: ${moment(p.startDate).format('YYYY-MM-DD')} to ${moment(p.endDate).format('YYYY-MM-DD')}`);
    });

    // Check Days
    console.log('\n🕵️‍♀️ Daily Authorization Check (Feb 8 - Feb 14):');
    const checkStart = moment.tz('2026-02-08', timezone); // Sunday
    for (let i = 0; i < 7; i++) {
        const day = checkStart.clone().add(i, 'days');
        const shouldWork = rm.shouldAnalystWork(srujana.id, day.toDate(), plans);
        console.log(`  ${day.format('YYYY-MM-DD (ddd)')}: ${shouldWork ? '✅ YES' : '❌ NO'}`);
    }
}

repro()
    .catch(e => console.error(e))
    .finally(() => prisma.$disconnect());
