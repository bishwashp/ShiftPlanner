import { PrismaClient } from '../../generated/prisma';

const prisma = new PrismaClient();

async function main() {
    console.log('🔄 Migrating Legacy Shift Types (MORNING/EVENING -> AM/PM)...');

    // 1. Get AMR Region
    const amr = await prisma.region.findUnique({ where: { name: 'AMR' } });
    if (!amr) throw new Error('AMR Region not found');

    // 2. Update MORNING -> AM
    const morningUpdate = await prisma.analyst.updateMany({
        where: {
            regionId: amr.id,
            shiftType: 'MORNING'
        },
        data: {
            shiftType: 'AM'
        }
    });
    console.log(`✅ Updated ${morningUpdate.count} analysts from MORNING -> AM`);

    // 3. Update EVENING -> PM
    const eveningUpdate = await prisma.analyst.updateMany({
        where: {
            regionId: amr.id,
            shiftType: 'EVENING'
        },
        data: {
            shiftType: 'PM'
        }
    });
    console.log(`✅ Updated ${eveningUpdate.count} analysts from EVENING -> PM`);

    console.log('🏁 Shift Data Alignment Complete.');
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
