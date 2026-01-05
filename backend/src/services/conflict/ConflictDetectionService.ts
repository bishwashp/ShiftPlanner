import { PrismaClient } from '@prisma/client';
import moment from 'moment';

// Types
export interface Conflict {
  date: string;
  message: string;
  type: ConflictType;
  missingShifts: string[];
  severity: ConflictSeverity;
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

export interface ScheduledShifts {
  morning: boolean;
  evening: boolean;
  weekend: boolean;
}

export interface ScreenerAssignments {
  morning: number;
  evening: number;
}

export class ConflictDetectionService {
  private prisma: PrismaClient;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  /**
   * Detect conflicts for a given date range
   */
  async detectConflicts(startDate: Date, endDate: Date): Promise<ConflictResult> {
    console.log(`🔍 Detecting conflicts from ${startDate.toISOString()} to ${endDate.toISOString()}`);

    // Get all dates in the range
    const allDates = this.generateDateRange(startDate, endDate);

    // Get all schedules in the range
    const schedules = await this.prisma.schedule.findMany({
      where: {
        date: {
          gte: startDate,
          lte: endDate,
        },
      },
    });

    // Get shift definitions to know what shifts each region has
    const shiftDefinitions = await this.prisma.shiftDefinition.findMany({
      include: { region: true }
    });

    // Build a map of region -> configured shift types (morning/evening based on shift name)
    const regionShiftConfig = new Map<string, Set<string>>();
    for (const shift of shiftDefinitions) {
      if (!regionShiftConfig.has(shift.regionId)) {
        regionShiftConfig.set(shift.regionId, new Set());
      }
      const shiftSet = regionShiftConfig.get(shift.regionId)!;
      // Map shift names to MORNING/EVENING based on common patterns
      const nameLower = shift.name.toLowerCase();
      if (nameLower.includes('am') || nameLower.includes('morning')) {
        shiftSet.add('MORNING');
      } else if (nameLower.includes('pm') || nameLower.includes('evening')) {
        shiftSet.add('EVENING');
      } else {
        // Single shift regions (like LDN) - add as both to indicate they only need one
        // Actually, mark them specially so we know they're single-shift
        shiftSet.add('SINGLE');
      }
    }

    console.log(`🔍 Found ${schedules.length} schedules in date range`);

    // Process schedules and detect conflicts
    const conflicts = this.processSchedules(schedules, allDates, startDate, endDate, regionShiftConfig);

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
   * Process schedules and detect conflicts
   */
  private processSchedules(
    schedules: any[],
    allDates: Set<string>,
    startDate: Date,
    endDate: Date,
    regionShiftConfig?: Map<string, Set<string>>
  ): Conflict[] {
    const conflicts: Conflict[] = [];

    // Map schedules by date
    const scheduledDates = new Map<string, ScheduledShifts>();

    for (const schedule of schedules) {
      const scheduleDate = moment.utc(schedule.date);
      const dateStr = scheduleDate.format('YYYY-MM-DD');

      if (!scheduledDates.has(dateStr)) {
        scheduledDates.set(dateStr, { morning: false, evening: false, weekend: false });
      }
      const shifts = scheduledDates.get(dateStr)!;
      if (schedule.shiftType === 'MORNING') {
        shifts.morning = true;
      }
      if (schedule.shiftType === 'EVENING') {
        shifts.evening = true;
      }

      const day = scheduleDate.day();
      if (day === 0 || day === 6) { // 0=Sun, 6=Sat
        shifts.weekend = true;
      }
    }

    // SIMPLIFIED LOGIC: Check for complete, partial, and missing schedules
    if (schedules.length === 0) {
      // No schedules exist at all for the entire period
      conflicts.push(this.createNoScheduleConflict(startDate, endDate));
      return conflicts;
    }

    // Categorize dates
    const datesWithCompleteSchedules = new Set<string>();
    const datesWithPartialSchedules = new Set<string>();
    const datesWithNoSchedules = new Set<string>();

    // First, mark all dates as having no schedules
    Array.from(allDates).forEach(dateStr => {
      datesWithNoSchedules.add(dateStr);
    });

    // Then, check each date with schedules
    // Then, check each date with schedules
    scheduledDates.forEach((shifts, dateStr) => {
      // Remove from datesWithNoSchedules since we have at least one shift
      datesWithNoSchedules.delete(dateStr);

      const dayOfWeek = moment.utc(dateStr).day();
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6; // 0=Sun, 6=Sat

      if (isWeekend) {
        // Weekend logic: Complete if 'weekend' shift exists OR (morning AND evening)
        // Some implementations might just use 'WEEKEND' shift type, others might use M/E.
        // We'll accept either 'WEEKEND' shift OR (Morning + Evening) as complete, 
        // OR just Morning or Evening if that's the weekend model (often reduced staff).
        // Based on user feedback, let's assume Weekends just need *coverage*.

        if (shifts.weekend || shifts.morning || shifts.evening) {
          datesWithCompleteSchedules.add(dateStr);
        } else {
          datesWithPartialSchedules.add(dateStr);
        }
      } else {
        // Weekday logic: Needs Morning AND Evening
        if (shifts.morning && shifts.evening) {
          datesWithCompleteSchedules.add(dateStr);
        } else {
          datesWithPartialSchedules.add(dateStr);
        }
      }
    });

    // Calculate the percentage of days with no schedules
    const totalDays = allDates.size;
    const daysWithNoSchedules = datesWithNoSchedules.size;
    const noSchedulePercentage = (daysWithNoSchedules / totalDays) * 100;

    // If more than 70% of days have no schedules, treat it as "no schedules exist"
    if (noSchedulePercentage > 70) {
      // Most days have no schedules - treat as "no schedules exist"
      conflicts.push(this.createNoScheduleConflict(startDate, endDate));
      return conflicts;
    }

    // Add conflict for dates with no schedules (if less than 70% of days)
    if (datesWithNoSchedules.size > 0) {
      conflicts.push(this.createMissingSchedulesConflict(datesWithNoSchedules));
    }

    // Add conflict for dates with partial schedules
    if (datesWithPartialSchedules.size > 0) {
      conflicts.push(this.createIncompleteSchedulesConflict(datesWithPartialSchedules));
    }

    // Check for missing shifts in partial schedules
    this.detectMissingShifts(scheduledDates, datesWithPartialSchedules, datesWithNoSchedules, conflicts);

    // Check for screener conflicts in complete schedules
    this.detectScreenerConflicts(schedules, datesWithCompleteSchedules, conflicts, regionShiftConfig);

    // HOLISTIC FIX: Check for over-staffing (too many analysts per shift)
    this.detectOverstaffing(schedules, conflicts);

    // HOLISTIC FIX: Check for consecutive-day violations (>5 days)
    this.detectConsecutiveDayViolations(schedules, conflicts);

    return conflicts;
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
   * HOLISTIC FIX: Detect consecutive-day violations (>5 days in a row)
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

  /**
   * Create a conflict for no schedules
   */
  private createNoScheduleConflict(startDate: Date, endDate: Date): Conflict {
    return {
      date: startDate.toISOString().split('T')[0],
      message: `Schedule does not exist for the next 30 days (${moment(startDate).format('MMM D')} - ${moment(endDate).format('MMM D')})`,
      type: 'NO_SCHEDULE_EXISTS',
      missingShifts: [],
      severity: 'recommended'
    };
  }

  /**
   * Create a conflict for missing schedules
   */
  private createMissingSchedulesConflict(datesWithNoSchedules: Set<string>): Conflict {
    const noScheduleDates = Array.from(datesWithNoSchedules).sort();
    return {
      date: noScheduleDates[0],
      message: `No schedules generated for ${noScheduleDates.length} day(s) in the selected period`,
      type: 'NO_SCHEDULE_EXISTS',
      missingShifts: [],
      severity: 'recommended'
    };
  }

  /**
   * Create a conflict for incomplete schedules
   */
  private createIncompleteSchedulesConflict(datesWithPartialSchedules: Set<string>): Conflict {
    const partialDates = Array.from(datesWithPartialSchedules).sort();
    return {
      date: partialDates[0],
      message: `Incomplete schedules detected for ${partialDates.length} day(s). Complete schedules are required for proper operations.`,
      type: 'INCOMPLETE_SCHEDULES',
      missingShifts: [],
      severity: 'recommended'
    };
  }

  /**
   * Detect missing shifts in partial schedules
   */
  private detectMissingShifts(
    scheduledDates: Map<string, ScheduledShifts>,
    datesWithPartialSchedules: Set<string>,
    datesWithNoSchedules: Set<string>,
    conflicts: Conflict[]
  ): void {
    scheduledDates.forEach((shifts, dateStr) => {
      // Skip dates with no schedules - they're handled separately
      if (datesWithNoSchedules.has(dateStr)) {
        return;
      }

      const dayOfWeek = moment.utc(dateStr).day();
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

      let missingShifts: string[] = [];

      if (isWeekend) {
        // Weekend logic: If we have ANY coverage, we might be good, or we might need 'WEEKEND' shift.
        // If the system uses 'WEEKEND' shift type:
        if (!shifts.weekend && !shifts.morning && !shifts.evening) {
          missingShifts.push('Weekend Coverage');
        }
      } else {
        // Weekday logic
        if (!shifts.morning) {
          missingShifts.push('Morning');
        }
        if (!shifts.evening) {
          missingShifts.push('Evening');
        }
      }

      // Add missing shift conflicts for partial schedules
      if (missingShifts.length > 0 && datesWithPartialSchedules.has(dateStr)) {
        conflicts.push({
          date: dateStr,
          message: `Missing ${missingShifts.join(' and ')} shift(s) on ${moment.utc(dateStr).format('MMM D')}`,
          type: 'NO_ANALYST_ASSIGNED',
          missingShifts,
          severity: 'critical'
        });
      }
    });
  }

  /**
   * Detect screener conflicts in complete schedules
   * FIXED: Now counts screeners PER REGION and respects region shift configurations
   */
  private detectScreenerConflicts(
    schedules: any[],
    datesWithCompleteSchedules: Set<string>,
    conflicts: Conflict[],
    regionShiftConfig?: Map<string, Set<string>>
  ): void {
    // Get screener assignments for each region + date combination
    // Key format: "regionId:dateStr"
    const screenerAssignments = new Map<string, ScreenerAssignments>();
    // Track which regions have data
    const regionDateKeys = new Set<string>();

    schedules.forEach(schedule => {
      const dateStr = schedule.date.toISOString().split('T')[0];
      const regionId = schedule.regionId || 'unknown';
      const key = `${regionId}:${dateStr}`;

      if (datesWithCompleteSchedules.has(dateStr) && schedule.isScreener) {
        if (!screenerAssignments.has(key)) {
          screenerAssignments.set(key, { morning: 0, evening: 0 });
        }
        const assignments = screenerAssignments.get(key)!;
        if (schedule.shiftType === 'MORNING') {
          assignments.morning++;
        } else if (schedule.shiftType === 'EVENING') {
          assignments.evening++;
        }
      }

      // Track all region+date combinations to check for missing screeners
      if (datesWithCompleteSchedules.has(dateStr)) {
        regionDateKeys.add(key);
      }
    });

    // Check each region + date combination for screener conflicts
    regionDateKeys.forEach(key => {
      const [regionId, dateStr] = key.split(':');

      // Use UTC day to avoid timezone issues with the date string
      const dayOfWeek = moment.utc(dateStr).day();

      // Skip screener conflict checks for weekends (Saturday=6, Sunday=0)
      // Weekends should have analysts but no screeners per business requirements
      if (dayOfWeek === 0 || dayOfWeek === 6) {
        return;
      }

      const screeners = screenerAssignments.get(key) || { morning: 0, evening: 0 };
      let screenerIssues: string[] = [];

      // Get this region's configured shift types
      const regionShifts = regionShiftConfig?.get(regionId) || new Set(['MORNING', 'EVENING']);
      const isSingleShiftRegion = regionShifts.has('SINGLE');
      const hasMorningShift = regionShifts.has('MORNING');
      const hasEveningShift = regionShifts.has('EVENING');

      // For single-shift regions (like LDN), only need one screener total
      if (isSingleShiftRegion) {
        const totalScreeners = screeners.morning + screeners.evening;
        if (totalScreeners === 0) {
          screenerIssues.push('Screener missing');
        } else if (totalScreeners > 1) {
          screenerIssues.push(`Multiple screeners (${totalScreeners})`);
        }
      } else {
        // Standard regions with morning/evening shifts
        if (hasMorningShift && screeners.morning === 0) {
          screenerIssues.push('Morning screener missing');
        }
        if (hasEveningShift && screeners.evening === 0) {
          screenerIssues.push('Evening screener missing');
        }
        if (screeners.morning > 1) {
          screenerIssues.push(`Multiple morning screeners (${screeners.morning})`);
        }
        if (screeners.evening > 1) {
          screenerIssues.push(`Multiple evening screeners (${screeners.evening})`);
        }
      }

      // Add screener conflicts
      if (screenerIssues.length > 0) {
        conflicts.push({
          date: dateStr,
          message: `${screenerIssues.join(', ')} on ${moment.utc(dateStr).format('MMM D')}`,
          type: 'SCREENER_CONFLICT',
          missingShifts: screenerIssues,
          severity: screenerIssues.some(issue => issue.includes('missing')) ? 'critical' : 'recommended'
        });
      }
    });
  }
}

// Create a singleton instance for use throughout the app
import { prisma } from '../../lib/prisma';
export const conflictDetectionService = new ConflictDetectionService(prisma);
