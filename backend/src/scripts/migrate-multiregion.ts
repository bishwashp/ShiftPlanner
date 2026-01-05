import { PrismaClient } from '../../generated/prisma';

const prisma = new PrismaClient();

async function main() {
    console.log('🌍 Starting Multi-Region Migration...');

    // 1. Create or Find AMR Region
    console.log('📍 Ensuring AMR Region exists...');
    const amrRegion = await prisma.region.upsert({
        where: { name: 'AMR' },
        update: {},
        create: {
            name: 'AMR',
            timezone: 'America/New_York', // Defaulting to NY/Eastern for AMR base
            isActive: true,
        },
    });
    console.log(`✅ AMR Region ID: ${amrRegion.id}`);

    // 2. Create Default AMR Shift Definitions
    console.log('⏰ Creating Default AMR Shift Definitions...');

    // Morning Shift (AM)
    await prisma.shiftDefinition.upsert({
        where: {
            regionId_name: {
                regionId: amrRegion.id,
                name: 'AM',
            },
        },
        update: {},
        create: {
            regionId: amrRegion.id,
            name: 'AM',
            startResult: '09:00',
            endResult: '17:00',
            isOvernight: false,
        },
    });

    // Evening Shift (PM)
    await prisma.shiftDefinition.upsert({
        where: {
            regionId_name: {
                regionId: amrRegion.id,
                name: 'PM',
            },
        },
        update: {},
        create: {
            regionId: amrRegion.id,
            name: 'PM',
            startResult: '14:00',
            endResult: '23:00', // Assuming 2pm-11pm for typical evening
            isOvernight: false,
        },
    });

    // Create mapping for legacy "MORNING" / "EVENING" enums to new Definition Names if needed
    // But for now we are just linking regions.

    // 3. Migrate Analysts
    console.log('👥 Migrating Analysts to AMR...');
    const analystUpdate = await prisma.analyst.updateMany({
        where: {
            regionId: null,
        },
        data: {
            regionId: amrRegion.id,
        },
    });
    console.log(`✅ Updated ${analystUpdate.count} Analysts.`);

    // 4. Migrate Schedules
    console.log('📅 Migrating Schedules to AMR...');
    // Update in batches if massive, but for now assuming reasonable size
    const scheduleUpdate = await prisma.schedule.updateMany({
        where: {
            regionId: null,
        },
        data: {
            regionId: amrRegion.id,
        },
    });
    console.log(`✅ Updated ${scheduleUpdate.count} Schedules.`);

    // 5. Migrate Holidays
    console.log('🎉 Migrating Holidays to AMR...');
    const holidayUpdate = await prisma.holiday.updateMany({
        where: {
            regionId: null,
        },
        data: {
            regionId: amrRegion.id,
        },
    });
    console.log(`✅ Updated ${holidayUpdate.count} Holidays.`);

    console.log('🏁 Migration Complete!');
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
