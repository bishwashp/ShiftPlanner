
import { PrismaClient } from '../../generated/prisma';

const prisma = new PrismaClient();

async function clearSchedules() {
    try {
        console.log('🗑️  Clearing all schedule data...');

        // Delete in order of dependencies (though Cascade might handle it, explicit is safer)

        // 1. Clear Schedules
        const deletedSchedules = await prisma.schedule.deleteMany({});
        console.log(`✅ Deleted ${deletedSchedules.count} schedules.`);

        // 2. Clear Generation Logs
        const deletedLogs = await prisma.scheduleGenerationLog.deleteMany({});
        console.log(`✅ Deleted ${deletedLogs.count} generation logs.`);

        // 3. Clear Pattern Continuity (Reset rotation state)
        const deletedContinuity = await prisma.patternContinuity.deleteMany({});
        console.log(`✅ Deleted ${deletedContinuity.count} pattern continuity records.`);

        console.log('✨ Database cleared successfully!');
    } catch (error) {
        console.error('❌ Error clearing schedules:', error);
    } finally {
        await prisma.$disconnect();
    }
}

clearSchedules();
