import { compOffBankService, CompOffTransaction } from './CompOffBankService';
import { prisma } from '../../lib/prisma';

export interface AutoCompAssignment {
  analystId: string;
  earnedDate: Date;
  compOffDate: Date;
  reason: 'WEEKEND_WORK' | 'HOLIDAY_WORK';
  isAutoAssigned: boolean;
  isBanked: boolean;
  transaction: CompOffTransaction;
}

export interface CompOffAssignmentResult {
  assignments: AutoCompAssignment[];
  conflicts: CompOffConflict[];
  summary: {
    totalAutoAssigned: number;
    totalBanked: number;
    totalConflicts: number;
  };
}

export interface CompOffConflict {
  analystId: string;
  earnedDate: Date;
  proposedCompOffDate: Date;
  conflictReason: string;
  suggestedResolution: string;
}

export class AutoCompAssignmentEngine {
  
  /**
   * Process weekend work and assign comp-off
   */
  async processWeekendWork(
    analystId: string,
    workDate: Date,
    workType: 'WEEKEND' | 'HOLIDAY'
  ): Promise<AutoCompAssignment> {
    // Policy:
    // - Sunday: target Friday (same calendar week). If blocked by holiday/leave/assignment → bank.
    // - Saturday: no extra auto-comp (rotation already provided Mon off) → bank nothing and return a no-op assignment.
    // - Holiday (non-Friday): next weekday if rotation-safe; else bank.

    const day = workDate.getDay();

    if (workType === 'WEEKEND' && day === 6) {
      // Saturday: no-op, no extra auto-comp
      return {
        analystId,
        earnedDate: workDate,
        compOffDate: workDate,
        reason: 'WEEKEND_WORK',
        isAutoAssigned: false,
        isBanked: false,
        transaction: {
          id: 'noop',
          analystId,
          type: 'EARNED',
          earnedDate: workDate,
          compOffDate: undefined,
          reason: 'WEEKEND_WORK',
          days: 0,
          isAutoAssigned: false,
          isBanked: false,
          description: 'No auto-comp for Saturday per rotation policy',
          createdAt: new Date()
        }
      };
    }

    const compOffDate = this.calculateCompOffDate(workDate, workType);
    const hasConflict = await this.checkCompOffConflict(analystId, compOffDate);

    if (hasConflict) {
      const transaction = await compOffBankService.bankCompOff(
        analystId,
        workDate,
        workType === 'WEEKEND' ? 'WEEKEND_WORK' : 'HOLIDAY_WORK',
        1,
        `Banked comp-off due to policy/conflict on ${compOffDate.toDateString()}`
      );
      return {
        analystId,
        earnedDate: workDate,
        compOffDate,
        reason: workType === 'WEEKEND' ? 'WEEKEND_WORK' : 'HOLIDAY_WORK',
        isAutoAssigned: false,
        isBanked: true,
        transaction
      };
    }

    const transaction = await compOffBankService.autoAssignCompOff(
      analystId,
      workDate,
      compOffDate,
      workType === 'WEEKEND' ? 'WEEKEND_WORK' : 'HOLIDAY_WORK',
      `Auto-assigned comp-off per policy`
    );
    return {
      analystId,
      earnedDate: workDate,
      compOffDate,
      reason: workType === 'WEEKEND' ? 'WEEKEND_WORK' : 'HOLIDAY_WORK',
      isAutoAssigned: true,
      isBanked: false,
      transaction
    };
  }

  /**
   * Process multiple weekend work assignments
   */
  async processWeekendWorkBatch(
    assignments: Array<{ analystId: string; workDate: Date; workType: 'WEEKEND' | 'HOLIDAY' }>
  ): Promise<CompOffAssignmentResult> {
    const results: AutoCompAssignment[] = [];
    const conflicts: CompOffConflict[] = [];
    
    for (const assignment of assignments) {
      try {
        const result = await this.processWeekendWork(
          assignment.analystId,
          assignment.workDate,
          assignment.workType
        );
        results.push(result);
        
        if (!result.isAutoAssigned && result.isBanked) {
          conflicts.push({
            analystId: assignment.analystId,
            earnedDate: assignment.workDate,
            proposedCompOffDate: result.compOffDate,
            conflictReason: 'Analyst already scheduled to work on comp-off date',
            suggestedResolution: 'Comp-off has been banked for future use'
          });
        }
      } catch (error: any) {
        conflicts.push({
          analystId: assignment.analystId,
          earnedDate: assignment.workDate,
          proposedCompOffDate: this.calculateCompOffDate(assignment.workDate, assignment.workType),
          conflictReason: `Error processing comp-off: ${error.message}`,
          suggestedResolution: 'Manual review required'
        });
      }
    }
    
    const summary = {
      totalAutoAssigned: results.filter(r => r.isAutoAssigned).length,
      totalBanked: results.filter(r => r.isBanked).length,
      totalConflicts: conflicts.length
    };
    
    return { assignments: results, conflicts, summary };
  }

  /**
   * Calculate comp-off date based on work date and type
   */
  private calculateCompOffDate(workDate: Date, workType: 'WEEKEND' | 'HOLIDAY'): Date {
    const dayOfWeek = workDate.getDay();
    
    if (workType === 'WEEKEND') {
      if (dayOfWeek === 0) { // Sunday
        // Get Friday of the same week
        return this.getFridayOfWeek(workDate);
      } else if (dayOfWeek === 6) { // Saturday
        // Policy: no extra auto-comp for Saturday
        return workDate;
      }
    }
    
    // For holiday work or other cases, assign to next available weekday
    return this.getNextAvailableWeekday(workDate);
  }

  /**
   * Get Friday of the same week
   */
  private getFridayOfWeek(date: Date): Date {
    const friday = new Date(date);
    const dayOfWeek = date.getDay();
    const daysUntilFriday = (5 - dayOfWeek + 7) % 7;
    friday.setDate(date.getDate() + daysUntilFriday);
    return friday;
  }

  /**
   * Get Monday of the next week
   */
  private getMondayOfNextWeek(date: Date): Date {
    const monday = new Date(date);
    const dayOfWeek = date.getDay();
    const daysUntilMonday = (1 - dayOfWeek + 7) % 7;
    monday.setDate(date.getDate() + daysUntilMonday);
    return monday;
  }

  /**
   * Get next available weekday
   */
  private getNextAvailableWeekday(date: Date): Date {
    const nextDay = new Date(date);
    nextDay.setDate(date.getDate() + 1);
    
    // Skip weekends
    while (nextDay.getDay() === 0 || nextDay.getDay() === 6) {
      nextDay.setDate(nextDay.getDate() + 1);
    }
    
    return nextDay;
  }

  /**
   * Check if there's a conflict with comp-off assignment
   */
  private async checkCompOffConflict(analystId: string, compOffDate: Date): Promise<boolean> {
    // Check if analyst is already scheduled to work on comp-off date
    const existingSchedule = await prisma.schedule.findFirst({
      where: {
        analystId,
        date: {
          gte: new Date(compOffDate.toISOString().split('T')[0] + 'T00:00:00.000Z'),
          lt: new Date(compOffDate.toISOString().split('T')[0] + 'T23:59:59.999Z')
        }
      }
    });
    
    if (existingSchedule) {
      return true;
    }
    
    // Check if analyst already has comp-off on this date
    const hasCompOff = await compOffBankService.hasCompOffOnDate(analystId, compOffDate);
    if (hasCompOff) {
      return true;
    }
    
    // Check for vacation or other constraints
    const vacation = await prisma.vacation.findFirst({
      where: {
        analystId,
        startDate: { lte: compOffDate },
        endDate: { gte: compOffDate },
        isApproved: true
      }
    });
    
    if (vacation) {
      return true;
    }
    
    return false;
  }

  /**
   * Validate comp-off assignment rules
   */
  async validateCompOffAssignment(
    analystId: string,
    workDate: Date,
    compOffDate: Date
  ): Promise<{
    isValid: boolean;
    violations: string[];
    warnings: string[];
  }> {
    const violations: string[] = [];
    const warnings: string[] = [];
    
    // Check if work date is weekend or holiday
    const dayOfWeek = workDate.getDay();
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      violations.push('Comp-off can only be earned for weekend or holiday work');
    }
    
    // Check if comp-off date is reasonable (within same week or next week)
    const daysDiff = Math.floor((compOffDate.getTime() - workDate.getTime()) / (1000 * 60 * 60 * 24));
    if (daysDiff > 14) {
      warnings.push('Comp-off date is more than 2 weeks after work date');
    }
    
    // Check if analyst has sufficient comp-off balance for banking
    const balance = await compOffBankService.getCompOffBalance(analystId);
    if (balance.availableBalance > 10) {
      warnings.push('Analyst has high comp-off balance, consider using banked days');
    }
    
    return {
      isValid: violations.length === 0,
      violations,
      warnings
    };
  }

  /**
   * Get comp-off assignment recommendations
   */
  async getCompOffRecommendations(
    analystId: string,
    workDate: Date
  ): Promise<{
    recommendedCompOffDate: Date;
    alternativeDates: Date[];
    reasoning: string;
  }> {
    const dayOfWeek = workDate.getDay();
    let recommendedDate: Date;
    let reasoning: string;
    
    if (dayOfWeek === 0) { // Sunday
      recommendedDate = this.getFridayOfWeek(workDate);
      reasoning = 'Sunday work earns Friday comp-off in the same week';
    } else if (dayOfWeek === 6) { // Saturday
      recommendedDate = this.getMondayOfNextWeek(workDate);
      reasoning = 'Saturday work earns Monday comp-off in the next week';
    } else {
      recommendedDate = this.getNextAvailableWeekday(workDate);
      reasoning = 'Holiday work earns comp-off on next available weekday';
    }
    
    // Generate alternative dates if recommended date has conflicts
    const alternatives: Date[] = [];
    let currentDate = new Date(recommendedDate);
    
    for (let i = 0; i < 5; i++) {
      currentDate.setDate(currentDate.getDate() + 1);
      if (currentDate.getDay() !== 0 && currentDate.getDay() !== 6) {
        alternatives.push(new Date(currentDate));
      }
    }
    
    return {
      recommendedCompOffDate: recommendedDate,
      alternativeDates: alternatives,
      reasoning
    };
  }

  /**
   * Process overtime work and credit comp-off bank
   */
  async processOvertimeWork(
    analystId: string,
    workDate: Date,
    overtimeDays: number
  ): Promise<CompOffTransaction> {
    if (overtimeDays <= 0) {
      throw new Error('Overtime days must be greater than 0');
    }
    
    return await compOffBankService.earnCompOff(
      analystId,
      workDate,
      'OVERTIME',
      overtimeDays,
      `Earned ${overtimeDays} comp-off day(s) for overtime work exceeding 5-day limit`
    );
  }

  /**
   * Get comp-off assignment summary for analytics
   */
  async getCompOffAssignmentSummary(
    startDate: Date,
    endDate: Date
  ): Promise<{
    totalAssignments: number;
    autoAssigned: number;
    banked: number;
    conflicts: number;
    byReason: Record<string, number>;
    byAnalyst: Record<string, { autoAssigned: number; banked: number; conflicts: number }>;
  }> {
    const transactions = await prisma.compOffTransaction.findMany({
      where: {
        createdAt: {
          gte: startDate,
          lte: endDate
        }
      }
    });
    
    const summary = {
      totalAssignments: 0,
      autoAssigned: 0,
      banked: 0,
      conflicts: 0,
      byReason: {} as Record<string, number>,
      byAnalyst: {} as Record<string, { autoAssigned: number; banked: number; conflicts: number }>
    };
    
    transactions.forEach(transaction => {
      summary.totalAssignments++;
      
      if (transaction.isAutoAssigned) {
        summary.autoAssigned++;
      }
      
      if (transaction.isBanked) {
        summary.banked++;
      }
      
      // Initialize analyst summary if not exists
      if (!summary.byAnalyst[transaction.analystId]) {
        summary.byAnalyst[transaction.analystId] = { autoAssigned: 0, banked: 0, conflicts: 0 };
      }
      
      if (transaction.isAutoAssigned) {
        summary.byAnalyst[transaction.analystId].autoAssigned++;
      }
      
      if (transaction.isBanked) {
        summary.byAnalyst[transaction.analystId].banked++;
      }
      
      // Count by reason
      const reason = transaction.reason;
      summary.byReason[reason] = (summary.byReason[reason] || 0) + 1;
    });
    
    return summary;
  }
}

export const autoCompAssignmentEngine = new AutoCompAssignmentEngine();
