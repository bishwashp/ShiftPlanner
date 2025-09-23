# ShiftPlanner Scripts

This directory contains utility scripts for managing the ShiftPlanner application.

## Available Scripts

### 1. Clear Schedules

Removes schedules and optionally pattern continuity data from the database.

```bash
npx ts-node scripts/clear-schedules.ts [options]
```

**Options:**
- `--keep-continuity`: Don't delete pattern continuity data
- `--date-range <start> <end>`: Only delete schedules in this date range (YYYY-MM-DD format)
- `--analyst <id>`: Only delete schedules for a specific analyst
- `--help`: Show usage information

**Examples:**
```bash
# Clear all schedules and pattern continuity data
npx ts-node scripts/clear-schedules.ts

# Clear schedules but keep pattern continuity data
npx ts-node scripts/clear-schedules.ts --keep-continuity

# Clear schedules for a specific date range
npx ts-node scripts/clear-schedules.ts --date-range 2025-10-01 2025-10-31

# Clear schedules for a specific analyst
npx ts-node scripts/clear-schedules.ts --analyst cmfvx76zg0000z6xj8e2vf9ib
```

### 2. Test Weekend Rotation

Tests the Weekend Rotation Algorithm with various options.

```bash
npx ts-node scripts/test-weekend-rotation.ts [options]
```

**Options:**
- `--start-date <date>`: Start date for test (YYYY-MM-DD format)
- `--end-date <date>`: End date for test (YYYY-MM-DD format)
- `--algorithm <type>`: Algorithm type (default: weekend-rotation)
- `--clear`: Clear existing schedules before testing
- `--help`: Show usage information

**Examples:**
```bash
# Test with default options (Oct 5 to Nov 1, 2025)
npx ts-node scripts/test-weekend-rotation.ts

# Test with custom date range
npx ts-node scripts/test-weekend-rotation.ts --start-date 2025-11-01 --end-date 2025-11-30

# Test with clearing existing schedules
npx ts-node scripts/test-weekend-rotation.ts --clear
```

### 3. Generate Schedules

Generates and applies schedules to the database.

```bash
npx ts-node scripts/generate-schedules.ts [options]
```

**Options:**
- `--start-date <date>`: Start date for generation (YYYY-MM-DD format)
- `--end-date <date>`: End date for generation (YYYY-MM-DD format)
- `--algorithm <type>`: Algorithm type (default: weekend-rotation)
- `--clear`: Clear existing schedules before generating
- `--dry-run`: Generate but don't save to database
- `--generated-by <user>`: User who generated the schedules (default: script)
- `--help`: Show usage information

**Examples:**
```bash
# Generate schedules with default options
npx ts-node scripts/generate-schedules.ts

# Generate schedules with custom date range
npx ts-node scripts/generate-schedules.ts --start-date 2025-11-01 --end-date 2025-11-30

# Generate schedules in dry-run mode (don't save to database)
npx ts-node scripts/generate-schedules.ts --dry-run

# Generate schedules and clear existing ones
npx ts-node scripts/generate-schedules.ts --clear
```

## Using Scripts in Code

You can also import and use these scripts in your own code:

```typescript
import { clearSchedules } from './scripts/clear-schedules';
import { testWeekendRotation } from './scripts/test-weekend-rotation';
import { generateSchedules } from './scripts/generate-schedules';

// Clear schedules
await clearSchedules({
  keepContinuity: false,
  startDate: new Date('2025-10-01'),
  endDate: new Date('2025-10-31')
});

// Test weekend rotation
await testWeekendRotation({
  startDate: new Date('2025-10-01'),
  endDate: new Date('2025-10-31'),
  algorithmType: 'weekend-rotation',
  clearExisting: true
});

// Generate schedules
await generateSchedules({
  startDate: new Date('2025-10-01'),
  endDate: new Date('2025-10-31'),
  algorithmType: 'weekend-rotation',
  clearExisting: true,
  dryRun: false,
  generatedBy: 'admin'
});
```
