/**
 * Swap Bish ↔ Sarahi for Feb 1 & Feb 7 rotation
 * One-time graceful swap to honor natural succession
 */

import { PrismaClient } from '../generated/prisma';
const prisma = new PrismaClient();

async function swap() {
    // Get analyst IDs
    const bish = await prisma.analyst.findFirst({ where: { name: 'Bish' } });
    const sarahi = await prisma.analyst.findFirst({ where: { name: 'Sarahi' } });

    if (!bish || !sarahi) {
        console.log('Could not find analysts:', { bish, sarahi });
        return;
    }

    console.log('Bish ID:', bish.id);
    console.log('Sarahi ID:', sarahi.id);

    // Find Feb 1 schedule (currently Bish based on generation)
    const feb1 = await prisma.schedule.findFirst({
        where: {
            date: new Date('2026-02-01'),
            analystId: bish.id,
            isScreener: false
        }
    });

    // Find Feb 7 schedule (currently Sarahi based on generation)
    const feb7 = await prisma.schedule.findFirst({
        where: {
            date: new Date('2026-02-07'),
            analystId: sarahi.id,
            isScreener: false
        }
    });

    console.log('Feb 1 schedule:', feb1);
    console.log('Feb 7 schedule:', feb7);

    if (!feb1 || !feb7) {
        console.log('Could not find schedules to swap');
        await prisma.$disconnect();
        return;
    }

    // Perform the swap
    await prisma.schedule.update({
        where: { id: feb1.id },
        data: { analystId: sarahi.id }
    });

    await prisma.schedule.update({
        where: { id: feb7.id },
        data: { analystId: bish.id }
    });

    console.log('✅ Swap complete! Feb 1 -> Sarahi, Feb 7 -> Bish');

    await prisma.$disconnect();
}

swap().catch(e => {
    console.error('Error:', e);
    prisma.$disconnect();
});
