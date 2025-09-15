import { PrismaClient } from '../generated/prisma';

const prisma = new PrismaClient();

async function main() {
  await prisma.analyst.createMany({
    data: [
      { name: 'Alice Morning', email: 'alice.morning@example.com', shiftType: 'MORNING' },
      { name: 'Bob Morning', email: 'bob.morning@example.com', shiftType: 'MORNING' },
      { name: 'Carol Evening', email: 'carol.evening@example.com', shiftType: 'EVENING' },
      { name: 'Dave Evening', email: 'dave.evening@example.com', shiftType: 'EVENING' }
    ]
  });
  console.log('Dummy analysts created');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect()); 