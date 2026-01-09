import { PrismaClient } from '@prisma/client';
import moment from 'moment';

// Types
export interface Conflict {
  date: string;
  message: string;
  type: ConflictType;
  missingShifts: string[];
  severity: ConflictSeverity;
  regionId?: string;
}

export type ConflictType =
  | 'NO_SCHEDULE_EXISTS'
  | 'INCOMPLETE_SCHEDULES'
  | 'NO_ANALYST_ASSIGNED'
  | 'SCREENER_CONFLICT'
  | 'OVERSTAFFING'
  | 'CONSECUTIVE_DAY_VIOLATION';

export type ConflictSeverity = 'critical' | 'recommended';

export interface ConflictResult {
  critical: Conflict[];
  recommended: Conflict[];
}

export class ConflictDetectionService {
  private prisma: PrismaClient;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  /**
   * Detect conflicts for a given date range
   */
  async detectConflicts(startDate: Date, endDate: Date, regionId?: string): Promise<ConflictResult> {
    console.log(`🔍 Detecting conflicts from ${startDate.toISOString()} to ${endDate.toISOString()} ${regionId ? `for region ${regionId}` : '(Global)'}`);

    // Get all dates in the range
    const allDates = this.generateDateRange(startDate, endDate);

    // Get all schedules in the range
    const scheduleWhere: any = {
      date: {
        gte: startDate,
        lte: endDate,
      },
    };
    if (regionId) {
      scheduleWhere.regionId = regionId;
    }

    const schedules = await this.prisma.schedule.findMany({
      where: scheduleWhere,
      include: { analyst: true } // Include analyst to get their data if needed
    });

    // Get shift definitions to know what shifts each region has
    const shiftDefWhere: any = {};
    if (regionId) {
      shiftDefWhere.regionId = regionId;
    }
    const shiftDefinitions = await this.prisma.shiftDefinition.findMany({
      where: shiftDefWhere,
      include: { region: true }
    });

    // Build a map of region -> Set of configured shift names (e.g. "AM", "PM", "DAY")
    const regionShiftConfig = new Map<string, Set<string>>();
    for (const shift of shiftDefinitions) {
      if (!regionShiftConfig.has(shift.regionId)) {
        regionShiftConfig.set(shift.regionId, new Set<string>());
      }
      // Store the actual shift name
      regionShiftConfig.get(shift.regionId)!.add(shift.name);
    }

    // If specific region requested but no config found, try to look up region manually to ensure we process it
    if (regionId && !regionShiftConfig.has(regionId)) {
      // Fallback: If no definitions, we might still want to check basic coverage if legacy?
      // For now, let's trust the DB. If no definitions, maybe no conflicts?
      // Or better, fetch the region to confirm it exists and initialize empty set
      regionShiftConfig.set(regionId, new Set<string>());
    }

    console.log(`🔍 Found ${schedules.length} schedules in date range`);

    // Process schedules and detect conflicts
    const conflicts = this.processSchedules(schedules, allDates, startDate, endDate, regionShiftConfig, regionId);

    // Categorize conflicts by severity
    const criticalConflicts = conflicts.filter(c => c.severity === 'critical');
    const recommendedConflicts = conflicts.filter(c => c.severity === 'recommended');

    return {
      critical: criticalConflicts,
      recommended: recommendedConflicts,
    };
  }

  /**
   * Generate an array of all dates in the range
   */
  private generateDateRange(startDate: Date, endDate: Date): Set<string> {
    const allDates = new Set<string>();
    const current = moment.utc(startDate).startOf('day');
    const end = moment.utc(endDate).startOf('day');

    while (current.isSameOrBefore(end)) {
      allDates.add(current.format('YYYY-MM-DD'));
      current.add(1, 'day');
    }

    return allDates;
  }

  /**
   * Helper: Check if two shifts are equivalent (Legacy Support)
   */
  private areShiftsEquivalent(shiftA: string, shiftB: string): boolean {
    if (!shiftA || !shiftB) return false;
    if (shiftA === shiftB) return true;

    const normalize = (s: string) => {
      const upper = s.toUpperCase();
      if (upper === 'MORNING') return 'AM';
      if (upper === 'EVENING') return 'PM';
      return upper;
    };

    return normalize(shiftA) === normalize(shiftB);
  }

  /**
   * Process schedules and detect conflicts
   */
  private processSchedules(
    schedules: any[],
    allDates: Set<string>,
    startDate: Date,
    endDate: Date,
    regionShiftConfig: Map<string, Set<string>>,
    targetRegionId?: string
  ): Conflict[] {
    const conflicts: Conflict[] = [];

    // Map schedules by Region -> Date -> Set<ShiftType>
    const regionDateCoverage = new Map<string, Map<string, Set<string>>>();
    const regionsToProcess = targetRegionId ? [targetRegionId] : Array.from(regionShiftConfig.keys());

    // Initialize coverage map
    regionsToProcess.forEach(rid => {
      regionDateCoverage.set(rid, new Map());
      allDates.forEach(date => {
        regionDateCoverage.get(rid)!.set(date, new Set<string>());
      });
    });

    // Populate coverage from schedules
    for (const schedule of schedules) {
      // Use schedule.regionId if avail, else fallback (legacy data might lack it, but we filtered query by it so safe if targetRegionId set)
      const rId = schedule.regionId || schedule.analyst?.regionId;
      if (!rId) continue;

      // If we are filtering by region, skip others (double check)
      if (targetRegionId && rId !== targetRegionId) continue;

      const dateStr = moment.utc(schedule.date).format('YYYY-MM-DD');

      if (!regionDateCoverage.has(rId)) {
        // If we encounter a region purely from schedule data that wasn't in definitions
        if (!targetRegionId) {
          regionDateCoverage.set(rId, new Map());
        } else {
          continue; // Should not happen given query
        }
      }

      const dateMap = regionDateCoverage.get(rId)!;
      if (!dateMap.has(dateStr)) {
        dateMap.set(dateStr, new Set<string>());
      }
      dateMap.get(dateStr)!.add(schedule.shiftType);
    }

    // Iterate per region to check compliance
    regionsToProcess.forEach(regionId => {
      const dateMap = regionDateCoverage.get(regionId);
      if (!dateMap) return;

      const requiredShifts = regionShiftConfig.get(regionId) || new Set<string>();

      // Track stats for this region
      const datesWithNoSchedules = new Set<string>();
      const datesWithPartialSchedules = new Set<string>();
      const datesWithCompleteSchedules = new Set<string>();

      // Check each date
      allDates.forEach(dateStr => {
        const coveredShifts = dateMap.get(dateStr) || new Set<string>();

        if (coveredShifts.size === 0) {
          datesWithNoSchedules.add(dateStr);
          return;
        }

        const dayOfWeek = moment.utc(dateStr).day();
        const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

        let isComplete = false;

        if (isWeekend) {
          // Weekend Logic
          if (requiredShifts.has('WEEKEND')) {
            // Check if we have 'WEEKEND' or equivalent
            isComplete = false;
            for (const s of coveredShifts) {
              if (this.areShiftsEquivalent(s, 'WEEKEND')) { isComplete = true; break; }
            }
          } else {
            // Fallback: any coverage
            isComplete = coveredShifts.size > 0;
          }
        } else {
          // Weekday Logic
          let missing = false;
          for (const req of requiredShifts) {
            if (req === 'WEEKEND') continue;

            // Check equivalence
            let found = false;
            for (const covered of coveredShifts) {
              if (this.areShiftsEquivalent(req, covered)) {
                found = true;
                break;
              }
            }

            if (!found) {
              missing = true;
              break;
            }
          }
          isComplete = !missing && (requiredShifts.size > 0 || coveredShifts.size > 0);
          // Edge case: No requirements logic -> if we have coverage it's "complete" enough?
          if (requiredShifts.size === 0 && coveredShifts.size > 0) isComplete = true;
        }

        if (isComplete) {
          datesWithCompleteSchedules.add(dateStr);
        } else {
          datesWithPartialSchedules.add(dateStr);
        }
      });

      // 1. Check No Schedules (Critical mass?)
      // Only trigger "No Schedules" warning if we actually expect activity? 
      // For now, keep existing logic but scoped to region.
      if (datesWithNoSchedules.size === allDates.size && schedules.length === 0) {
        // Only push this if context implies we should have schedules? 
        // The user complained about empty regions showing errors.
        // If the region is totally empty, we report ONE "No Schedule" warning, not 30 "Missing Shift" errors.
        conflicts.push(this.createNoScheduleConflict(startDate, endDate, regionId));
      } else {
        // If we have mixed content, report specific gaps
        if (datesWithNoSchedules.size > 0) {
          // Only report "No Schedules generated" if it's a bulk block? 
          // Actually, let's be more specific. 
          // If > 70% empty, report generic warning
          if ((datesWithNoSchedules.size / allDates.size) > 0.7) {
            conflicts.push(this.createNoScheduleConflict(startDate, endDate, regionId));
          } else {
            conflicts.push(this.createMissingSchedulesConflict(datesWithNoSchedules, regionId));
          }
        }

        if (datesWithPartialSchedules.size > 0) {
          conflicts.push(this.createIncompleteSchedulesConflict(datesWithPartialSchedules, regionId));

          // Detail missing shifts
          this.detectMissingShifts(
            dateMap,
            datesWithPartialSchedules,
            conflicts,
            requiredShifts,
            regionId
          );
        }

        // Check screeners, etc. scoped to this region
        this.detectRegionScreenerConflicts(
          schedules.filter(s => (s.regionId === regionId || s.analyst?.regionId === regionId)),
          datesWithCompleteSchedules,
          conflicts,
          requiredShifts,
          regionId
        );
      }
    });

    // Note: Overstaffing and Consecutive days are Analyst-centric, not strict region-centric (though usually same region).
    // pass filtered schedules?
    const regionSchedules = targetRegionId
      ? schedules.filter(s => (s.regionId === targetRegionId || s.analyst?.regionId === targetRegionId))
      : schedules;

    this.detectOverstaffing(regionSchedules, conflicts);
    this.detectConsecutiveDayViolations(regionSchedules, conflicts);

    return conflicts;
  }

  /**
   * Create a conflict for no schedules
   */
  private createNoScheduleConflict(startDate: Date, endDate: Date, regionId?: string): Conflict {
    return {
      date: startDate.toISOString().split('T')[0],
      message: `[${regionId || 'Global'}] Schedule does not exist for the next 30 days (${moment(startDate).format('MMM D')} - ${moment(endDate).format('MMM D')})`,
      type: 'NO_SCHEDULE_EXISTS',
      missingShifts: [],
      severity: 'recommended',
      regionId
    };
  }

  /**
   * Create a conflict for missing schedules
   */
  private createMissingSchedulesConflict(datesWithNoSchedules: Set<string>, regionId?: string): Conflict {
    const noScheduleDates = Array.from(datesWithNoSchedules).sort();
    return {
      date: noScheduleDates[0],
      message: `[${regionId || 'Global'}] No schedules generated for ${noScheduleDates.length} day(s) in the selected period`,
      type: 'NO_SCHEDULE_EXISTS',
      missingShifts: [],
      severity: 'recommended',
      regionId
    };
  }

  /**
   * Create a conflict for incomplete schedules
   */
  private createIncompleteSchedulesConflict(datesWithPartialSchedules: Set<string>, regionId?: string): Conflict {
    const partialDates = Array.from(datesWithPartialSchedules).sort();
    return {
      date: partialDates[0],
      message: `[${regionId || 'Global'}] Incomplete schedules detected for ${partialDates.length} day(s). Complete schedules are required for proper operations.`,
      type: 'INCOMPLETE_SCHEDULES',
      missingShifts: [],
      severity: 'recommended',
      regionId
    };
  }

  /**
   * Detect missing shifts in partial schedules (Region Aware)
   */
  private detectMissingShifts(
    dateCoverageMap: Map<string, Set<string>>, // Date -> Shifts
    datesWithPartialSchedules: Set<string>,
    conflicts: Conflict[],
    requiredShifts: Set<string>,
    regionId: string
  ): void {

    datesWithPartialSchedules.forEach(dateStr => {
      const coveredShifts = dateCoverageMap.get(dateStr)!;
      const dayOfWeek = moment.utc(dateStr).day();
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

      let missingShifts: string[] = [];

      if (isWeekend) {
        if (requiredShifts.has('WEEKEND')) {
          let hasWeekend = false;
          for (const s of coveredShifts) {
            if (this.areShiftsEquivalent(s, 'WEEKEND')) { hasWeekend = true; break; }
          }
          if (!hasWeekend) missingShifts.push('WEEKEND');
        } else if (coveredShifts.size === 0) {
          missingShifts.push('Weekend Coverage');
        }
      } else {
        for (const req of requiredShifts) {
          if (req === 'WEEKEND') continue;

          let found = false;
          for (const covered of coveredShifts) {
            if (this.areShiftsEquivalent(req, covered)) { found = true; break; }
          }

          if (!found) {
            missingShifts.push(req);
          }
        }
      }

      if (missingShifts.length > 0) {
        conflicts.push({
          date: dateStr,
          message: `[${regionId}] Missing ${missingShifts.join(' and ')} shift(s) on ${moment.utc(dateStr).format('MMM D')}`,
          type: 'NO_ANALYST_ASSIGNED',
          missingShifts,
          severity: 'critical',
          regionId
        });
      }
    });
  }

  /**
   * Detect screener conflicts in complete schedules (Region Scoped)
   */
  private detectRegionScreenerConflicts(
    regionSchedules: any[],
    datesWithCompleteSchedules: Set<string>,
    conflicts: Conflict[],
    requiredShifts: Set<string>,
    regionId: string
  ): void {
    // Map: "dateStr" -> Map<shiftType, count>
    const screenerAssignments = new Map<string, Map<string, number>>();
    const activeDates = new Set<string>();

    regionSchedules.forEach(schedule => {
      const dateStr = schedule.date.toISOString().split('T')[0];

      if (datesWithCompleteSchedules.has(dateStr)) {
        activeDates.add(dateStr);
        if (schedule.isScreener) {
          if (!screenerAssignments.has(dateStr)) {
            screenerAssignments.set(dateStr, new Map());
          }
          const shiftCounts = screenerAssignments.get(dateStr)!;
          // Normalize shift type key? safer to rely on raw first, checking equivalent later?
          // Actually, for counting purposes, we need to group AM/MORNING together.

          let normalizedShift = schedule.shiftType;
          if (this.areShiftsEquivalent(schedule.shiftType, 'MORNING')) normalizedShift = 'AM'; // Canonicalize?
          // Let's use simple normalization
          const simpleNorm = (s: string) => {
            if (s === 'MORNING') return 'AM';
            if (s === 'EVENING') return 'PM';
            return s;
          }
          normalizedShift = simpleNorm(schedule.shiftType);

          shiftCounts.set(normalizedShift, (shiftCounts.get(normalizedShift) || 0) + 1);
        }
      }
    });

    activeDates.forEach(dateStr => {
      const dayOfWeek = moment.utc(dateStr).day();
      if (dayOfWeek === 0 || dayOfWeek === 6) return; // Skip weekends

      const screeners = screenerAssignments.get(dateStr) || new Map();
      let screenerIssues: string[] = [];

      // Use required shifts to check coverage
      // We must normalize required shifts too if they are stored as AM/PM
      const simpleNorm = (s: string) => {
        if (s === 'MORNING') return 'AM';
        if (s === 'EVENING') return 'PM';
        return s;
      }

      for (const shift of requiredShifts) {
        if (shift === 'WEEKEND') continue;

        const normShift = simpleNorm(shift);
        const count = screeners.get(normShift) || 0;

        if (count === 0) {
          screenerIssues.push(`${normShift} screener missing`);
        } else if (count > 1) {
          screenerIssues.push(`Multiple ${normShift} screeners (${count})`);
        }
      }

      if (screenerIssues.length > 0) {
        conflicts.push({
          date: dateStr,
          message: `[${regionId}] ${screenerIssues.join(', ')} on ${moment.utc(dateStr).format('MMM D')}`,
          type: 'SCREENER_CONFLICT',
          missingShifts: screenerIssues,
          severity: screenerIssues.some(issue => issue.includes('missing')) ? 'critical' : 'recommended',
          regionId
        });
      }
    });
  }

  /**
   * HOLISTIC FIX: Detect over-staffing (more analysts than expected per shift)
   */
  private detectOverstaffing(schedules: any[], conflicts: Conflict[]): void {
    const weekendLimit = 1; // Configurable, default 1

    // Group by date and shift type
    const dayShiftCounts = new Map<string, Map<string, number>>();

    for (const schedule of schedules) {
      const dateStr = schedule.date.toISOString().split('T')[0];
      if (!dayShiftCounts.has(dateStr)) {
        dayShiftCounts.set(dateStr, new Map());
      }
      const shiftCounts = dayShiftCounts.get(dateStr)!;
      const shiftType = schedule.shiftType;
      shiftCounts.set(shiftType, (shiftCounts.get(shiftType) || 0) + 1);
    }

    for (const [dateStr, shiftCounts] of dayShiftCounts) {
      const dayOfWeek = moment.utc(dateStr).day();
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

      if (isWeekend) {
        for (const [shiftType, count] of shiftCounts) {
          if (count > weekendLimit) {
            conflicts.push({
              date: dateStr,
              message: `Over-staffing: ${count} analysts on ${shiftType} shift (limit: ${weekendLimit}) on ${moment.utc(dateStr).format('MMM D')} (Weekend)`,
              type: 'OVERSTAFFING',
              missingShifts: [],
              severity: 'recommended'
            });
          }
        }
      }
    }
  }

  /**
   * HOLISTIC FIX: Detect consecutive-day violations (>5 days)
   */
  private detectConsecutiveDayViolations(schedules: any[], conflicts: Conflict[]): void {
    const maxConsecutive = 5;

    // Group schedules by analyst
    const analystSchedules = new Map<string, { date: string; name: string }[]>();

    for (const schedule of schedules) {
      const dateStr = schedule.date.toISOString().split('T')[0];
      if (!analystSchedules.has(schedule.analystId)) {
        analystSchedules.set(schedule.analystId, []);
      }
      analystSchedules.get(schedule.analystId)!.push({ date: dateStr, name: schedule.analyst?.name || schedule.analystId });
    }

    for (const [analystId, days] of analystSchedules) {
      const uniqueDates = [...new Set(days.map(d => d.date))].sort();
      const analystName = days[0]?.name || analystId;

      let streak = 1;
      for (let i = 1; i < uniqueDates.length; i++) {
        const prev = moment.utc(uniqueDates[i - 1]);
        const curr = moment.utc(uniqueDates[i]);
        if (curr.diff(prev, 'days') === 1) {
          streak++;
          if (streak > maxConsecutive) {
            conflicts.push({
              date: uniqueDates[i],
              message: `${analystName} working ${streak} consecutive days (max: ${maxConsecutive})`,
              type: 'CONSECUTIVE_DAY_VIOLATION',
              missingShifts: [],
              severity: 'critical'
            });
            break; // Only report once per analyst
          }
        } else {
          streak = 1;
        }
      }
    }
  }
}

// Create a singleton instance for use throughout the app
import { prisma } from '../../lib/prisma';
export const conflictDetectionService = new ConflictDetectionService(prisma);
