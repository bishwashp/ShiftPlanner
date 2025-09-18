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
  | 'SCREENER_CONFLICT';

export type ConflictSeverity = 'critical' | 'recommended';

export interface ConflictResult {
  critical: Conflict[];
  recommended: Conflict[];
}

export interface ScheduledShifts {
  morning: boolean;
  evening: boolean;
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
    
    console.log(`🔍 Found ${schedules.length} schedules in date range`);
    
    // Process schedules and detect conflicts
    const conflicts = this.processSchedules(schedules, allDates, startDate, endDate);
    
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
    const currentDate = new Date(startDate);
    
    while (currentDate <= endDate) {
      allDates.add(currentDate.toISOString().split('T')[0]);
      currentDate.setDate(currentDate.getDate() + 1);
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
    endDate: Date
  ): Conflict[] {
    const conflicts: Conflict[] = [];
    
    // Map schedules by date
    const scheduledDates = new Map<string, ScheduledShifts>();
    
    for (const schedule of schedules) {
      const dateStr = schedule.date.toISOString().split('T')[0];
      if (!scheduledDates.has(dateStr)) {
        scheduledDates.set(dateStr, { morning: false, evening: false });
      }
      const shifts = scheduledDates.get(dateStr)!;
      if (schedule.shiftType === 'MORNING') {
        shifts.morning = true;
      }
      if (schedule.shiftType === 'EVENING') {
        shifts.evening = true;
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
    scheduledDates.forEach((shifts, dateStr) => {
      // Remove from datesWithNoSchedules since we have at least one shift
      datesWithNoSchedules.delete(dateStr);
      
      if (shifts.morning && shifts.evening) {
        // Complete schedule exists (both morning and evening)
        datesWithCompleteSchedules.add(dateStr);
      } else {
        // Partial schedule exists (only morning OR evening, not both)
        datesWithPartialSchedules.add(dateStr);
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
    this.detectScreenerConflicts(schedules, datesWithCompleteSchedules, conflicts);
    
    return conflicts;
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
      message: `Incomplete schedules detected for ${partialDates.length} day(s). Complete schedules (both morning and evening shifts) are required for proper operations.`,
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
      
      let missingShifts: string[] = [];
      
      // Check for missing shifts in partial schedules
      if (!shifts.morning) {
        missingShifts.push('Morning');
      }
      if (!shifts.evening) {
        missingShifts.push('Evening');
      }
      
      // Add missing shift conflicts for partial schedules
      if (missingShifts.length > 0 && datesWithPartialSchedules.has(dateStr)) {
        conflicts.push({
          date: dateStr,
          message: `Missing ${missingShifts.join(' and ')} shift(s) on ${moment(dateStr).format('MMM D')}`,
          type: 'NO_ANALYST_ASSIGNED',
          missingShifts,
          severity: 'critical'
        });
      }
    });
  }
  
  /**
   * Detect screener conflicts in complete schedules
   */
  private detectScreenerConflicts(
    schedules: any[],
    datesWithCompleteSchedules: Set<string>,
    conflicts: Conflict[]
  ): void {
    // Get screener assignments for each date with complete schedules
    const screenerAssignments = new Map<string, ScreenerAssignments>();
    
    schedules.forEach(schedule => {
      const dateStr = schedule.date.toISOString().split('T')[0];
      if (datesWithCompleteSchedules.has(dateStr) && schedule.isScreener) {
        if (!screenerAssignments.has(dateStr)) {
          screenerAssignments.set(dateStr, { morning: 0, evening: 0 });
        }
        const assignments = screenerAssignments.get(dateStr)!;
        if (schedule.shiftType === 'MORNING') {
          assignments.morning++;
        } else if (schedule.shiftType === 'EVENING') {
          assignments.evening++;
        }
      }
    });
    
    // Check each date with complete schedules for screener conflicts
    datesWithCompleteSchedules.forEach(dateStr => {
      const screeners = screenerAssignments.get(dateStr) || { morning: 0, evening: 0 };
      let screenerIssues: string[] = [];
      
      // Check for screener requirements
      if (screeners.morning === 0) {
        screenerIssues.push('Morning screener missing');
      }
      if (screeners.evening === 0) {
        screenerIssues.push('Evening screener missing');
      }
      if (screeners.morning > 1) {
        screenerIssues.push(`Multiple morning screeners (${screeners.morning})`);
      }
      if (screeners.evening > 1) {
        screenerIssues.push(`Multiple evening screeners (${screeners.evening})`);
      }
      
      // Add screener conflicts
      if (screenerIssues.length > 0) {
        conflicts.push({
          date: dateStr,
          message: `${screenerIssues.join(', ')} on ${moment(dateStr).format('MMM D')}`,
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
