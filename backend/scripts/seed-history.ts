/**
 * Historical Schedule Seeding Script
 *
 * This script imports iCal data from the migrate/ folder into the database
 * to establish historical context for the scheduling algorithm.
 *
 * Usage:
 *   npx ts-node scripts/seed-history.ts [--dry-run]
 *
 * Filters applied:
 *   - Only 2025 events
 *   - Exact name match to existing DB analysts
 *   - Skip OOO entries
 *   - Skip combined entries (e.g., "Marty + Justin")
 */

import * as fs from 'fs';
import * as path from 'path';
import * as ical from 'node-ical';
import { PrismaClient } from '../generated/prisma';

const prisma = new PrismaClient();

// Configuration
const MIGRATE_DIR = path.join(__dirname, '..', '..', 'migrate');
const REGION_NAME = 'AMR';
const YEAR_FILTER = 2026;
// Only import Jan (0)
const MAX_MONTH_FILTER = 0;

// File to shift type mapping
const FILE_SHIFT_MAP: Record<string, { shiftType: string; isScreener: boolean }> = {
  'AMR AM Analysts.ics': { shiftType: 'AM', isScreener: false },
  'AMR AM Screener.ics': { shiftType: 'AM', isScreener: true },
  'AMR PM Analysts.ics': { shiftType: 'PM', isScreener: false },
  'AMR PM Screener.ics': { shiftType: 'PM', isScreener: true },
};

// Patterns to skip
const SKIP_PATTERNS = [
  /OOO/i,           // Out of office
  /\+/,             // Combined entries like "Marty + Justin"
  /&/,              // Combined entries like "Chris & Noelani"
  /Special Schedule/i,
  /🤝/,             // Handover markers
  /http/i,          // URLs
];

interface ParsedEvent {
  summary: string;
  startDate: Date;
  endDate: Date;
}

interface ImportStats {
  totalEvents: number;
  skippedYear: number;
  skippedMonth: number;
  skippedPattern: number;
  skippedNoMatch: number;
  imported: number;
  duplicates: number;
}

async function loadAnalysts(): Promise<Map<string, { id: string; name: string; shiftType: string; regionId: string }>> {
  const analysts = await prisma.analyst.findMany({
    where: {
      region: { name: REGION_NAME },
      isActive: true,
    },
    select: {
      id: true,
      name: true,
      shiftType: true,
      regionId: true,
    },
  });

  const nameMap = new Map<string, { id: string; name: string; shiftType: string; regionId: string }>();
  for (const analyst of analysts) {
    // Store both exact name and trimmed version
    nameMap.set(analyst.name.toLowerCase().trim(), {
      id: analyst.id,
      name: analyst.name,
      shiftType: analyst.shiftType || '',
      regionId: analyst.regionId,
    });
  }

  console.log(`📋 Loaded ${nameMap.size} analysts from ${REGION_NAME} region`);
  return nameMap;
}

function shouldSkipEvent(summary: string): boolean {
  return SKIP_PATTERNS.some(pattern => pattern.test(summary));
}

function parseIcsFile(filePath: string): ParsedEvent[] {
  const events: ParsedEvent[] = [];
  const data = ical.sync.parseFile(filePath);

  for (const key in data) {
    const event = data[key];
    if (event.type !== 'VEVENT') continue;

    const summary = event.summary?.toString().trim() || '';
    if (!summary) continue;

    // Handle date parsing
    let startDate: Date;
    let endDate: Date;

    if (event.start) {
      startDate = new Date(event.start);
    } else {
      continue;
    }

    if (event.end) {
      endDate = new Date(event.end);
    } else {
      // Single day event - end is same as start
      endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + 1);
    }

    // For all-day events, the end date is exclusive
    // So we need to subtract 1 day to get the actual last day (inclusive)
    if (endDate.getTime() > startDate.getTime()) {
      endDate.setDate(endDate.getDate() - 1);
    }

    events.push({ summary, startDate, endDate });
  }

  return events;
}

function expandMultiDayEvent(event: ParsedEvent): Date[] {
  const dates: Date[] = [];
  const current = new Date(event.startDate);
  const end = new Date(event.endDate);

  // Normalize to start of day
  current.setHours(0, 0, 0, 0);
  end.setHours(0, 0, 0, 0);

  while (current <= end) {
    dates.push(new Date(current));
    current.setDate(current.getDate() + 1);
  }

  return dates;
}

async function seedHistory(dryRun: boolean): Promise<void> {
  console.log(`\n🚀 Starting Historical Schedule Seeding (${dryRun ? 'DRY RUN' : 'LIVE'})\n`);
  console.log(`📁 Migration directory: ${MIGRATE_DIR}`);
  console.log(`📅 Year filter: ${YEAR_FILTER}`);
  console.log(`🌍 Region: ${REGION_NAME}\n`);

  const analystMap = await loadAnalysts();
  const totalStats: ImportStats = {
    totalEvents: 0,
    skippedYear: 0,
    skippedMonth: 0,
    skippedPattern: 0,
    skippedNoMatch: 0,
    imported: 0,
    duplicates: 0,
  };


  // Get region ID for schedule insertion
  const region = await prisma.region.findFirst({ where: { name: REGION_NAME } });
  if (!region) {
    throw new Error(`Region ${REGION_NAME} not found in database`);
  }

  // 0. CLEANUP: Clear 2026 schedules if not dry run
  if (!dryRun) {
    console.log(`🧹 Clearing existing schedules for ${YEAR_FILTER} in region ${REGION_NAME}...`);
    const deleteResult = await prisma.schedule.deleteMany({
      where: {
        regionId: region.id,
        date: {
          gte: new Date(`${YEAR_FILTER}-01-01`),
          lt: new Date(`${YEAR_FILTER + 1}-01-01`),
        },
      },
    });
    console.log(`   Deleted ${deleteResult.count} existing records.`);
  }

  // Map to aggregate schedules across files (handling isScreener merges)
  const aggregatedSchedules = new Map<string, {
    analystId: string;
    date: Date;
    shiftType: string;
    isScreener: boolean;
    regionId: string;
  }>();

  for (const [fileName, shiftConfig] of Object.entries(FILE_SHIFT_MAP)) {
    const filePath = path.join(MIGRATE_DIR, fileName);

    if (!fs.existsSync(filePath)) {
      console.log(`⚠️  File not found: ${fileName}, skipping...`);
      continue;
    }

    console.log(`\n📄 Processing: ${fileName}`);
    console.log(`   Shift Type: ${shiftConfig.shiftType}, Screener: ${shiftConfig.isScreener}`);

    const events = parseIcsFile(filePath);
    console.log(`   Found ${events.length} events`);

    const fileStats: ImportStats = {
      totalEvents: events.length,
      skippedYear: 0,
      skippedMonth: 0,
      skippedPattern: 0,
      skippedNoMatch: 0,
      imported: 0,
      duplicates: 0,
    };

    for (const event of events) {
      // Expand multi-day events
      const dates = expandMultiDayEvent(event);

      for (const date of dates) {
        // Year filter
        if (date.getFullYear() !== YEAR_FILTER) {
          fileStats.skippedYear++;
          continue;
        }

        // Month filter (Jan/Feb only)
        if (date.getMonth() > MAX_MONTH_FILTER) {
          fileStats.skippedMonth++;
          continue;
        }

        // Pattern filter
        if (shouldSkipEvent(event.summary)) {
          fileStats.skippedPattern++;
          continue;
        }

        // Name matching (exact, case-insensitive, trimmed)
        const normalizedName = event.summary.toLowerCase().trim();
        const analyst = analystMap.get(normalizedName);

        if (!analyst) {
          fileStats.skippedNoMatch++;
          continue;
        }

        // Create unique key for aggregation
        const dateStr = date.toISOString().split('T')[0];
        const key = `${analyst.id}-${dateStr}`;

        const existing = aggregatedSchedules.get(key);

        if (existing) {
          // Merge logic: ensure isScreener is true if EITHER source says true
          // Also prefer non-null shift types? (Usually consistent)
          existing.isScreener = existing.isScreener || shiftConfig.isScreener;
          fileStats.duplicates++; // Count as duplicate/merge
        } else {
          aggregatedSchedules.set(key, {
            analystId: analyst.id,
            date: date,
            shiftType: shiftConfig.shiftType,
            isScreener: shiftConfig.isScreener,
            regionId: region.id,
          });
          fileStats.imported++;
        }
      }
    }

    console.log(`   ✅ Valid events: ${fileStats.imported}`);
    console.log(`   ⏭️  Skipped (year): ${fileStats.skippedYear}`);
    console.log(`   ⏭️  Skipped (month): ${fileStats.skippedMonth}`);
    console.log(`   ⏭️  Skipped (pattern): ${fileStats.skippedPattern}`);
    console.log(`   ⏭️  Skipped (no match): ${fileStats.skippedNoMatch}`);
    console.log(`   🔄 Merged/Dups: ${fileStats.duplicates}`);

    // Aggregate stats
    totalStats.totalEvents += fileStats.totalEvents;
    totalStats.skippedYear += fileStats.skippedYear;
    totalStats.skippedMonth = (totalStats.skippedMonth || 0) + fileStats.skippedMonth;
    totalStats.skippedPattern += fileStats.skippedPattern;
    totalStats.skippedNoMatch += fileStats.skippedNoMatch;
    totalStats.imported += fileStats.imported;
    totalStats.duplicates += fileStats.duplicates;
  }

  // Batch Insert/Upsert step
  if (!dryRun && aggregatedSchedules.size > 0) {
    console.log(`\n💾 Inserting/Upserting ${aggregatedSchedules.size} aggregated schedules...`);

    for (const schedule of aggregatedSchedules.values()) {
      await prisma.schedule.upsert({
        where: {
          analystId_date: {
            analystId: schedule.analystId,
            date: schedule.date,
          },
        },
        update: {
          shiftType: schedule.shiftType,
          isScreener: schedule.isScreener,
        },
        create: {
          analystId: schedule.analystId,
          date: schedule.date,
          shiftType: schedule.shiftType,
          isScreener: schedule.isScreener,
          regionId: schedule.regionId,
        },
      });
    }
    console.log(`   ✅ Successfully processed all schedules.`);
  }

  console.log(`\n${'='.repeat(50)}`);
  console.log(`📊 TOTAL SUMMARY`);
  console.log(`${'='.repeat(50)}`);
  console.log(`   Total events processed: ${totalStats.totalEvents}`);
  console.log(`   Unique records to write: ${aggregatedSchedules.size}`);
  console.log(`   Merged overlaps: ${totalStats.duplicates}`);


  console.log(`\n${'='.repeat(50)}`);
  console.log(`📊 TOTAL SUMMARY`);
  console.log(`${'='.repeat(50)}`);
  console.log(`   Total events processed: ${totalStats.totalEvents}`);
  console.log(`   Imported: ${totalStats.imported}`);
  console.log(`   Skipped (year): ${totalStats.skippedYear}`);
  console.log(`   Skipped (pattern): ${totalStats.skippedPattern}`);
  console.log(`   Skipped (no match): ${totalStats.skippedNoMatch}`);
  console.log(`   Duplicates: ${totalStats.duplicates}`);

  if (dryRun) {
    console.log(`\n⚠️  DRY RUN - No changes were made to the database`);
    console.log(`   Run without --dry-run to apply changes`);
  }

  await prisma.$disconnect();
}

// Main execution
const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');

seedHistory(dryRun)
  .then(() => {
    console.log(`\n✅ Seeding complete`);
    process.exit(0);
  })
  .catch((error) => {
    console.error(`\n❌ Error during seeding:`, error);
    process.exit(1);
  });
