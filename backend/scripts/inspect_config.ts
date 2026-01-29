
import { prisma } from '../src/lib/prisma';

async function inspectConfig() {
    console.log('🔍 INSPECTING DB CONFIGURATION');

    const region = await prisma.region.findFirst({ where: { name: 'AMR' } });
    console.log('Region AMR:', region);

    const constraints = await prisma.schedulingConstraint.findMany({
        where: {
            isActive: true
        }
    });
    console.log(`Found ${constraints.length} active constraints.`);
    constraints.forEach(c => console.log(` - ${c.constraintType} (${c.startDate} to ${c.endDate})`));

    // Check analysts vacations for April
    const analysts = await prisma.analyst.findMany({
        where: { regionId: region?.id, isActive: true },
        include: {
            vacations: {
                where: {
                    startDate: { gte: new Date('2026-03-25') },
                    endDate: { lte: new Date('2026-04-25') }
                }
            }
        }
    });

    console.log('\nAnalyst Vacations (Apr Window):');
    analysts.forEach(a => {
        if (a.vacations.length > 0) {
            console.log(` - ${a.name}: ${a.vacations.length} vacations`);
            a.vacations.forEach(v => console.log(`    ${v.startDate.toISOString()} - ${v.endDate.toISOString()}`));
        }
    });

    await prisma.$disconnect();
}

inspectConfig().catch(console.error);
