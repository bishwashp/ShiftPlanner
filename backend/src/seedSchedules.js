const { PrismaClient } = require('../generated/prisma');

const prisma = new PrismaClient();

async function main() {
  try {
    // Get all analysts
    const analysts = await prisma.analyst.findMany();
    
    if (analysts.length === 0) {
      console.log('No analysts found. Please run seedAnalysts.js first.');
      return;
    }

    console.log(`Found ${analysts.length} analysts`);

    // Generate schedules for August 2025
    const augustSchedules = [];
    const startDate = new Date('2025-08-01');
    const endDate = new Date('2025-08-31');

    // Morning analysts
    const morningAnalysts = analysts.filter(a => a.shiftType === 'MORNING');
    const eveningAnalysts = analysts.filter(a => a.shiftType === 'EVENING');

    for (let date = new Date(startDate); date <= endDate; date.setDate(date.getDate() + 1)) {
      const dayOfWeek = date.getDay(); // 0 = Sunday, 1 = Monday, etc.
      
      // Skip weekends for now (Saturday = 6, Sunday = 0)
      if (dayOfWeek === 0 || dayOfWeek === 6) continue;

      // Assign morning shift
      if (morningAnalysts.length > 0) {
        const morningAnalyst = morningAnalysts[Math.floor(Math.random() * morningAnalysts.length)];
        augustSchedules.push({
          analystId: morningAnalyst.id,
          date: new Date(date), // Use Date object
          shiftType: 'MORNING',
          isScreener: Math.random() > 0.7 // 30% chance of being screener
        });
      }

      // Assign evening shift
      if (eveningAnalysts.length > 0) {
        const eveningAnalyst = eveningAnalysts[Math.floor(Math.random() * eveningAnalysts.length)];
        augustSchedules.push({
          analystId: eveningAnalyst.id,
          date: new Date(date), // Use Date object
          shiftType: 'EVENING',
          isScreener: Math.random() > 0.7 // 30% chance of being screener
        });
      }
    }

    console.log(`Generated ${augustSchedules.length} schedules for August 2025`);

    // Insert schedules
    await prisma.schedule.createMany({
      data: augustSchedules,
      skipDuplicates: true
    });

    console.log('Schedules created successfully!');
    
    // Verify the data
    const scheduleCount = await prisma.schedule.count();
    console.log(`Total schedules in database: ${scheduleCount}`);

  } catch (error) {
    console.error('Error creating schedules:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main(); 