import { PrismaClient } from '../../generated/prisma';

const prisma = new PrismaClient();

async function main() {
    console.log('🌍 Seeding Global Regions & Shift Definitions...');

    // ========================================================================
    // 1. AMR (Americas) - Update details
    // ========================================================================
    console.log('🇺🇸 Configuring AMR (America/Chicago)...');
    const amr = await prisma.region.upsert({
        where: { name: 'AMR' },
        update: { timezone: 'America/Chicago' },
        create: { name: 'AMR', timezone: 'America/Chicago' },
    });

    // AMR AM: 09:00-18:00 CST
    await prisma.shiftDefinition.upsert({
        where: { regionId_name: { regionId: amr.id, name: 'AM' } },
        update: { startResult: '09:00', endResult: '18:00' },
        create: { regionId: amr.id, name: 'AM', startResult: '09:00', endResult: '18:00' },
    });

    // AMR PM: 11:00-20:00 CST
    await prisma.shiftDefinition.upsert({
        where: { regionId_name: { regionId: amr.id, name: 'PM' } },
        update: { startResult: '11:00', endResult: '20:00' },
        create: { regionId: amr.id, name: 'PM', startResult: '11:00', endResult: '20:00' },
    });


    // ========================================================================
    // 2. LDN (London/EMEA)
    // ========================================================================
    console.log('🇬🇧 Configuring LDN (Europe/London)...');
    const ldn = await prisma.region.upsert({
        where: { name: 'LDN' },
        update: { timezone: 'Europe/London' },
        create: { name: 'LDN', timezone: 'Europe/London' },
    });

    // LDN DAY: 09:00-18:00 BST
    await prisma.shiftDefinition.upsert({
        where: { regionId_name: { regionId: ldn.id, name: 'DAY' } },
        update: { startResult: '09:00', endResult: '18:00' },
        create: { regionId: ldn.id, name: 'DAY', startResult: '09:00', endResult: '18:00' },
    });


    // ========================================================================
    // 3. SGP (Singapore/APAC)
    // ========================================================================
    console.log('🇸🇬 Configuring SGP (Asia/Singapore)...');
    const sgp = await prisma.region.upsert({
        where: { name: 'SGP' },
        update: { timezone: 'Asia/Singapore' },
        create: { name: 'SGP', timezone: 'Asia/Singapore' },
    });

    // SGP AM: 08:30-17:30 SGT
    await prisma.shiftDefinition.upsert({
        where: { regionId_name: { regionId: sgp.id, name: 'AM' } },
        update: { startResult: '08:30', endResult: '17:30' },
        create: { regionId: sgp.id, name: 'AM', startResult: '08:30', endResult: '17:30' },
    });

    // SGP PM: 11:30-20:30 SGT
    await prisma.shiftDefinition.upsert({
        where: { regionId_name: { regionId: sgp.id, name: 'PM' } },
        update: { startResult: '11:30', endResult: '20:30' },
        create: { regionId: sgp.id, name: 'PM', startResult: '11:30', endResult: '20:30' },
    });

    console.log('✅ Global Config Applied Successfully.');
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
