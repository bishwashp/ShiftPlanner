/**
 * LEGACY SEED FILE - DO NOT USE
 * 
 * This seed file is outdated and does not include required regionId.
 * The actual analyst data has been migrated via migrate-analyst-shift-definitions.ts
 * 
 * If you need to seed test analysts, use the seed_region_aware.ts script instead.
 */

import { PrismaClient } from '../generated/prisma';

const prisma = new PrismaClient();

async function main() {
  console.log('⚠️  This seed file is deprecated. Use seed_region_aware.ts instead.');
  console.log('    Analysts require regionId for multi-region support.');

  // Get default region (AMR)
  const region = await prisma.region.findFirst({ where: { name: 'AMR' } });
  if (!region) {
    console.log('❌ No AMR region found. Run migrate-multiregion.ts first.');
    return;
  }

  // Example of how to seed with region:
  // await prisma.analyst.createMany({
  //   data: [
  //     { name: 'Test Analyst', email: 'test@example.com', shiftType: 'AM', regionId: region.id },
  //   ]
  // });

  console.log('✅ No-op complete. Existing analysts already have regions assigned.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());