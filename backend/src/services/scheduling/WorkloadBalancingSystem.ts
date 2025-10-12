import { prisma } from '../../lib/prisma';
import { compOffBankService } from './CompOffBankService';
import { autoCompAssignmentEngine } from './AutoCompAssignmentEngine';

export interface WeeklyWorkload {
  analystId: string;
  weekStart: Date;
  weekEnd: Date;
  scheduledWorkDays: number;
  weekendWorkDays: number;
  holidayWorkDays: number;
  overtimeDays: number;
  autoCompOffDays: number;
  bankedCompOffDays: number;
  totalWorkDays: number;
  isBalanced: boolean;
  violations: WorkloadViolation[];
}

export interface WorkloadViolation {
  type: 'OVERTIME' | 'MISSING_COMP_OFF' | 'UNBALANCED_WEEK' | 'EXCESSIVE_CONSECUTIVE_DAYS';
  description: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  suggestedFix: string;
  affectedDate?: Date;
}

export interface WorkloadBalanceResult {
  workloads: WeeklyWorkload[];
  overallBalance: {
    isBalanced: boolean;
    totalViolations: number;
    criticalViolations: number;
    averageWorkload: number;
    standardDeviation: number;
  };
  recommendations: string[];
}

export interface WorkloadAnalysis {
  analystId: string;
  analystName: string;
  totalWorkDays: number;
  regularShiftDays: number;
  screenerDays: number;
  weekendDays: number;
  consecutiveWorkDays: number;
  averageWorkloadPerWeek: number;
  fairnessScore: number;
  compOffBalance: number;
  recommendations: string[];
}

export class WorkloadBalancingSystem {
  
  /**
   * Analyze workload for a specific week
   */
  async analyzeWeeklyWorkload(
    analystId: string,
    weekStart: Date
  ): Promise<WeeklyWorkload> {
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    
    // Get all schedules for the week
    const schedules = await prisma.schedule.findMany({
      where: {
        analystId,
        date: {
          gte: weekStart,
          lte: weekEnd
        }
      }
    });
    
    // Get comp-off transactions for the week
    const compOffTransactions = await compOffBankService.getCompOffTransactions(
      analystId,
      weekStart,
      weekEnd
    );
    
    // Calculate workload metrics
    const scheduledWorkDays = schedules.length;
    const weekendWorkDays = schedules.filter(s => {
      const dayOfWeek = s.date.getDay();
      return dayOfWeek === 0 || dayOfWeek === 6;
    }).length;
    
    const holidayWorkDays = schedules.filter(s => {
      // Check if it's a holiday (this would need holiday data)
      return false; // Placeholder - would check against holiday table
    }).length;
    
    const autoCompOffDays = compOffTransactions.filter(t => 
      t.type === 'AUTO_ASSIGNED' && t.isAutoAssigned
    ).length;
    
    const bankedCompOffDays = compOffTransactions.filter(t => 
      t.type === 'EARNED' && t.isBanked
    ).length;
    
    const totalWorkDays = scheduledWorkDays - autoCompOffDays;
    const overtimeDays = Math.max(0, totalWorkDays - 5);
    
    // Validate workload balance
    const violations = this.validateWorkloadBalance({
      scheduledWorkDays,
      weekendWorkDays,
      holidayWorkDays,
      overtimeDays,
      autoCompOffDays,
      bankedCompOffDays,
      totalWorkDays
    });
    
    const isBalanced = violations.filter(v => v.severity === 'CRITICAL' || v.severity === 'HIGH').length === 0;
    
    return {
      analystId,
      weekStart,
      weekEnd,
      scheduledWorkDays,
      weekendWorkDays,
      holidayWorkDays,
      overtimeDays,
      autoCompOffDays,
      bankedCompOffDays,
      totalWorkDays,
      isBalanced,
      violations
    };
  }

  /**
   * Analyze workload for multiple analysts and weeks
   */
  async analyzeWorkloadBalance(
    analystIds: string[],
    startDate: Date,
    endDate: Date
  ): Promise<WorkloadBalanceResult> {
    const workloads: WeeklyWorkload[] = [];
    
    // Generate all weeks in the date range
    const weeks = this.generateWeeksInRange(startDate, endDate);
    
    // Analyze workload for each analyst for each week
    for (const analystId of analystIds) {
      for (const weekStart of weeks) {
        const workload = await this.analyzeWeeklyWorkload(analystId, weekStart);
        workloads.push(workload);
      }
    }
    
    // Calculate overall balance metrics
    const totalViolations = workloads.reduce((sum, w) => sum + w.violations.length, 0);
    const criticalViolations = workloads.reduce((sum, w) => 
      sum + w.violations.filter(v => v.severity === 'CRITICAL').length, 0
    );
    
    const totalWorkDays = workloads.map(w => w.totalWorkDays);
    const averageWorkload = totalWorkDays.reduce((sum, days) => sum + days, 0) / totalWorkDays.length;
    const standardDeviation = this.calculateStandardDeviation(totalWorkDays);
    
    const isBalanced = criticalViolations === 0 && 
      workloads.filter(w => !w.isBalanced).length === 0;
    
    // Generate recommendations
    const recommendations = this.generateWorkloadRecommendations(workloads);
    
    return {
      workloads,
      overallBalance: {
        isBalanced,
        totalViolations,
        criticalViolations,
        averageWorkload,
        standardDeviation
      },
      recommendations
    };
  }

  /**
   * Validate workload balance and identify violations
   */
  private validateWorkloadBalance(workload: {
    scheduledWorkDays: number;
    weekendWorkDays: number;
    holidayWorkDays: number;
    overtimeDays: number;
    autoCompOffDays: number;
    bankedCompOffDays: number;
    totalWorkDays: number;
  }): WorkloadViolation[] {
    const violations: WorkloadViolation[] = [];
    
    // Check overtime violation
    if (workload.overtimeDays > 0) {
      violations.push({
        type: 'OVERTIME',
        description: `Analyst worked ${workload.scheduledWorkDays} days, exceeding 5-day limit by ${workload.overtimeDays} days`,
        severity: workload.overtimeDays > 2 ? 'CRITICAL' : 'HIGH',
        suggestedFix: `Credit ${workload.overtimeDays} comp-off day(s) to analyst's bank`
      });
    }
    
    // Check missing comp-off for weekend work
    if (workload.weekendWorkDays > 0 && workload.autoCompOffDays === 0 && workload.bankedCompOffDays === 0) {
      violations.push({
        type: 'MISSING_COMP_OFF',
        description: `Analyst worked ${workload.weekendWorkDays} weekend day(s) but received no comp-off`,
        severity: 'CRITICAL',
        suggestedFix: 'Assign comp-off for weekend work or bank comp-off days'
      });
    }
    
    // Check unbalanced week
    if (workload.totalWorkDays < 3) {
      violations.push({
        type: 'UNBALANCED_WEEK',
        description: `Analyst only worked ${workload.totalWorkDays} days this week`,
        severity: 'MEDIUM',
        suggestedFix: 'Consider increasing workload or check for missing assignments'
      });
    }
    
    return violations;
  }

  /**
   * Generate workload recommendations
   */
  private generateWorkloadRecommendations(workloads: WeeklyWorkload[]): string[] {
    const recommendations: string[] = [];
    
    // Find analysts with high overtime
    const highOvertimeAnalysts = workloads.filter(w => w.overtimeDays > 0);
    if (highOvertimeAnalysts.length > 0) {
      const analystIds = [...new Set(highOvertimeAnalysts.map(w => w.analystId))];
      recommendations.push(`Consider crediting comp-off to analysts with overtime: ${analystIds.join(', ')}`);
    }
    
    // Find analysts with missing comp-off
    const missingCompOffAnalysts = workloads.filter(w => 
      w.weekendWorkDays > 0 && w.autoCompOffDays === 0 && w.bankedCompOffDays === 0
    );
    if (missingCompOffAnalysts.length > 0) {
      const analystIds = [...new Set(missingCompOffAnalysts.map(w => w.analystId))];
      recommendations.push(`Assign comp-off for weekend work to analysts: ${analystIds.join(', ')}`);
    }
    
    // Find analysts with low workload
    const lowWorkloadAnalysts = workloads.filter(w => w.totalWorkDays < 3);
    if (lowWorkloadAnalysts.length > 0) {
      const analystIds = [...new Set(lowWorkloadAnalysts.map(w => w.analystId))];
      recommendations.push(`Consider increasing workload for analysts: ${analystIds.join(', ')}`);
    }
    
    return recommendations;
  }

  /**
   * Process overtime and credit comp-off bank
   */
  async processOvertimeViolations(workloads: WeeklyWorkload[]): Promise<void> {
    for (const workload of workloads) {
      if (workload.overtimeDays > 0) {
        await autoCompAssignmentEngine.processOvertimeWork(
          workload.analystId,
          workload.weekStart,
          workload.overtimeDays
        );
      }
    }
  }

  /**
   * Get comprehensive workload analysis for an analyst
   */
  async getAnalystWorkloadAnalysis(
    analystId: string,
    startDate: Date,
    endDate: Date
  ): Promise<WorkloadAnalysis> {
    // Get analyst info
    const analyst = await prisma.analyst.findUnique({
      where: { id: analystId }
    });
    
    if (!analyst) {
      throw new Error(`Analyst with ID ${analystId} not found`);
    }
    
    // Get all schedules in date range
    const schedules = await prisma.schedule.findMany({
      where: {
        analystId,
        date: {
          gte: startDate,
          lte: endDate
        }
      },
      orderBy: { date: 'asc' }
    });
    
    // Calculate metrics
    const totalWorkDays = schedules.length;
    const regularShiftDays = schedules.filter(s => !s.isScreener).length;
    const screenerDays = schedules.filter(s => s.isScreener).length;
    const weekendDays = schedules.filter(s => {
      const dayOfWeek = s.date.getDay();
      return dayOfWeek === 0 || dayOfWeek === 6;
    }).length;
    
    // Calculate consecutive work days
    const consecutiveWorkDays = this.calculateConsecutiveWorkDays(schedules);
    
    // Calculate average workload per week
    const weeksDiff = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24 * 7));
    const averageWorkloadPerWeek = totalWorkDays / Math.max(1, weeksDiff);
    
    // Get comp-off balance
    const compOffBalance = await compOffBankService.getCompOffBalance(analystId);
    
    // Calculate fairness score (simplified)
    const fairnessScore = this.calculateFairnessScore({
      totalWorkDays,
      screenerDays,
      weekendDays,
      consecutiveWorkDays
    });
    
    // Generate recommendations
    const recommendations = this.generateAnalystRecommendations({
      totalWorkDays,
      screenerDays,
      weekendDays,
      consecutiveWorkDays,
      compOffBalance: compOffBalance.availableBalance
    });
    
    return {
      analystId,
      analystName: analyst.name,
      totalWorkDays,
      regularShiftDays,
      screenerDays,
      weekendDays,
      consecutiveWorkDays,
      averageWorkloadPerWeek,
      fairnessScore,
      compOffBalance: compOffBalance.availableBalance,
      recommendations
    };
  }

  /**
   * Calculate consecutive work days
   */
  private calculateConsecutiveWorkDays(schedules: any[]): number {
    if (schedules.length === 0) return 0;
    
    const sortedDates = schedules
      .map(s => s.date)
      .sort((a, b) => a.getTime() - b.getTime());
    
    let maxConsecutive = 1;
    let currentConsecutive = 1;
    
    for (let i = 1; i < sortedDates.length; i++) {
      const daysDiff = (sortedDates[i].getTime() - sortedDates[i-1].getTime()) / (1000 * 60 * 60 * 24);
      
      if (daysDiff === 1) {
        currentConsecutive++;
        maxConsecutive = Math.max(maxConsecutive, currentConsecutive);
      } else {
        currentConsecutive = 1;
      }
    }
    
    return maxConsecutive;
  }

  /**
   * Calculate fairness score
   */
  private calculateFairnessScore(metrics: {
    totalWorkDays: number;
    screenerDays: number;
    weekendDays: number;
    consecutiveWorkDays: number;
  }): number {
    // Simplified fairness calculation
    let score = 1.0;
    
    // Penalize excessive consecutive days
    if (metrics.consecutiveWorkDays > 5) {
      score -= 0.2;
    }
    
    // Penalize high screener ratio
    const screenerRatio = metrics.screenerDays / Math.max(1, metrics.totalWorkDays);
    if (screenerRatio > 0.3) {
      score -= 0.1;
    }
    
    // Penalize high weekend ratio
    const weekendRatio = metrics.weekendDays / Math.max(1, metrics.totalWorkDays);
    if (weekendRatio > 0.2) {
      score -= 0.1;
    }
    
    return Math.max(0, score);
  }

  /**
   * Generate analyst-specific recommendations
   */
  private generateAnalystRecommendations(metrics: {
    totalWorkDays: number;
    screenerDays: number;
    weekendDays: number;
    consecutiveWorkDays: number;
    compOffBalance: number;
  }): string[] {
    const recommendations: string[] = [];
    
    if (metrics.consecutiveWorkDays > 5) {
      recommendations.push('Consider adding breaks between consecutive work days');
    }
    
    if (metrics.screenerDays > metrics.totalWorkDays * 0.3) {
      recommendations.push('High screener workload - consider reducing screener assignments');
    }
    
    if (metrics.weekendDays > metrics.totalWorkDays * 0.2) {
      recommendations.push('High weekend workload - consider reducing weekend assignments');
    }
    
    if (metrics.compOffBalance > 5) {
      recommendations.push('High comp-off balance - consider using banked comp-off days');
    }
    
    return recommendations;
  }

  /**
   * Generate weeks in date range
   */
  private generateWeeksInRange(startDate: Date, endDate: Date): Date[] {
    const weeks: Date[] = [];
    const current = new Date(startDate);
    
    // Start from Sunday of the week containing startDate (calendar week Sun–Sat)
    const dayOfWeek = current.getDay();
    const daysSinceSunday = dayOfWeek; // 0..6
    current.setDate(current.getDate() - daysSinceSunday);
    
    while (current <= endDate) {
      weeks.push(new Date(current));
      current.setDate(current.getDate() + 7);
    }
    
    return weeks;
  }

  /**
   * Calculate standard deviation
   */
  private calculateStandardDeviation(values: number[]): number {
    if (values.length === 0) return 0;
    
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const squaredDiffs = values.map(val => Math.pow(val - mean, 2));
    const variance = squaredDiffs.reduce((sum, val) => sum + val, 0) / values.length;
    
    return Math.sqrt(variance);
  }
}

export const workloadBalancingSystem = new WorkloadBalancingSystem();
