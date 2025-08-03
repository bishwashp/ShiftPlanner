import { PrismaClient, ShiftType } from '../generated/prisma';

const prisma = new PrismaClient();

async function main() {
  try {
    console.log('Starting to seed analysts...');
    
    // Check if analysts already exist
    const existingCount = await prisma.analyst.count();
    console.log(`Existing analysts count: ${existingCount}`);
    
    const result = await prisma.analyst.createMany({
      data: [
        { name: 'Alice Morning', email: 'alice.morning@example.com', shiftType: 'MORNING' },
        { name: 'Bob Morning', email: 'bob.morning@example.com', shiftType: 'MORNING' },
        { name: 'Carol Evening', email: 'carol.evening@example.com', shiftType: 'EVENING' },
        { name: 'Dave Evening', email: 'dave.evening@example.com', shiftType: 'EVENING' }
      ],
      skipDuplicates: true
    });
    
    console.log(`Created ${result.count} new analysts`);
    
    // Verify the total count
    const totalCount = await prisma.analyst.count();
    console.log(`Total analysts in database: ${totalCount}`);
    
    // List all analysts
    const analysts = await prisma.analyst.findMany();
    console.log('All analysts:', analysts.map(a => ({ id: a.id, name: a.name, email: a.email })));
    
  } catch (error) {
    console.error('Error seeding analysts:', error);
    throw error;
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect()); 