import { PrismaClient } from '@prisma/client';
import moment from 'moment-timezone';

interface FairnessMetrics {
  analystId: string;
  analystName: string;
  totalDaysWorked: number;
  weekendDaysWorked: number;
  holidayDaysWorked: number;
  screenerDaysAssigned: number;
  consecutiveWorkDays: number[];
  lastWorkPattern?: string;
  lastWorkDate?: Date;
  averageWorkload: number;
}

interface ScheduleAssignment {
  analystId: string;
  date: Date;
  shiftType: string;
  isScreener: boolean;
  isWeekend: boolean;
  isHoliday: boolean;
}

export class FairnessTracker {
  private prisma: PrismaClient;
  private metrics: Map<string, FairnessMetrics> = new Map();
  private holidays: Set<string> = new Set();

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  /**
   * Initialize fairness metrics from existing schedules
   */
  async initialize(startDate: Date, analysts: any[], holidays: Date[] = []): Promise<void> {
    // Set holidays
    holidays.forEach(holiday => {
      this.holidays.add(moment(holiday).format('YYYY-MM-DD'));
    });

    // Initialize metrics for all analysts
    analysts.forEach(analyst => {
      this.metrics.set(analyst.id, {
        analystId: analyst.id,
        analystName: analyst.name,
        totalDaysWorked: 0,
        weekendDaysWorked: 0,
        holidayDaysWorked: 0,
        screenerDaysAssigned: 0,
        consecutiveWorkDays: [],
        averageWorkload: 0
      });
    });

    // Load historical data from the last 90 days to establish patterns
    const historicalStartDate = new Date(startDate);
    historicalStartDate.setDate(historicalStartDate.getDate() - 90);

    const historicalSchedules = await this.prisma.schedule.findMany({
      where: {
        date: {
          gte: historicalStartDate,
          lt: startDate
        }
      },
      orderBy: {
        date: 'asc'
      }
    });

    // Process historical schedules to build fairness metrics
    historicalSchedules.forEach(schedule => {
      const metrics = this.metrics.get(schedule.analystId);
      if (!metrics) return;

      const date = new Date(schedule.date);
      const dayOfWeek = date.getDay();
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
      const isHoliday = this.holidays.has(moment(date).format('YYYY-MM-DD'));

      metrics.totalDaysWorked++;
      if (isWeekend) metrics.weekendDaysWorked++;
      if (isHoliday) metrics.holidayDaysWorked++;
      if (schedule.isScreener) metrics.screenerDaysAssigned++;
      metrics.lastWorkDate = date;

      // Track consecutive work days
      this.updateConsecutiveWorkDays(metrics, date);
    });

    // Calculate average workload for each analyst
    this.calculateAverageWorkloads();
  }

  /**
   * Get fairness score for a proposed schedule
   */
  calculateFairnessScore(assignments: ScheduleAssignment[]): number {
    const tempMetrics = this.cloneMetrics();
    
    // Apply assignments to temporary metrics
    assignments.forEach(assignment => {
      const metrics = tempMetrics.get(assignment.analystId);
      if (!metrics) return;

      metrics.totalDaysWorked++;
      if (assignment.isWeekend) metrics.weekendDaysWorked++;
      if (assignment.isHoliday) metrics.holidayDaysWorked++;
      if (assignment.isScreener) metrics.screenerDaysAssigned++;
    });

    // Calculate fairness components
    const workloadFairness = this.calculateWorkloadFairness(tempMetrics);
    const weekendFairness = this.calculateWeekendFairness(tempMetrics);
    const screenerFairness = this.calculateScreenerFairness(tempMetrics);
    const holidayFairness = this.calculateHolidayFairness(tempMetrics);

    // Weighted average of fairness components
    const fairnessScore = (
      workloadFairness * 0.4 +
      weekendFairness * 0.25 +
      screenerFairness * 0.25 +
      holidayFairness * 0.1
    );

    return fairnessScore;
  }

  /**
   * Get the most fair analyst for a given shift
   */
  getMostFairAnalyst(
    availableAnalysts: any[],
    date: Date,
    shiftType: string,
    isScreener: boolean
  ): string | null {
    if (availableAnalysts.length === 0) return null;

    const dayOfWeek = date.getDay();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    const isHoliday = this.holidays.has(moment(date).format('YYYY-MM-DD'));

    let bestAnalyst = availableAnalysts[0];
    let bestScore = -Infinity;

    availableAnalysts.forEach(analyst => {
      const metrics = this.metrics.get(analyst.id);
      if (!metrics) return;

      // Calculate a score that favors analysts with lower workload
      let score = 0;

      // Base score on inverse of total days worked
      score -= metrics.totalDaysWorked * 10;

      // Penalize if this would create excessive consecutive days
      const wouldCreateConsecutive = this.wouldCreateExcessiveConsecutiveDays(
        metrics,
        date,
        5 // max consecutive days
      );
      if (wouldCreateConsecutive) score -= 1000;

      // For screeners, heavily penalize if assigned recently
      if (isScreener) {
        score -= metrics.screenerDaysAssigned * 50;
        
        // Check if screener was assigned in the last 2 days
        const recentScreenerDays = this.getRecentScreenerDays(analyst.id, date, 2);
        if (recentScreenerDays >= 2) score -= 2000; // Max 2 consecutive screener days
      }

      // Weekend fairness
      if (isWeekend) {
        score -= metrics.weekendDaysWorked * 30;
      }

      // Holiday fairness
      if (isHoliday) {
        score -= metrics.holidayDaysWorked * 40;
      }

      if (score > bestScore) {
        bestScore = score;
        bestAnalyst = analyst;
      }
    });

    return bestAnalyst.id;
  }

  /**
   * Update metrics after schedule is applied
   */
  updateMetrics(assignments: ScheduleAssignment[]): void {
    assignments.forEach(assignment => {
      const metrics = this.metrics.get(assignment.analystId);
      if (!metrics) return;

      metrics.totalDaysWorked++;
      if (assignment.isWeekend) metrics.weekendDaysWorked++;
      if (assignment.isHoliday) metrics.holidayDaysWorked++;
      if (assignment.isScreener) metrics.screenerDaysAssigned++;
      metrics.lastWorkDate = assignment.date;

      this.updateConsecutiveWorkDays(metrics, assignment.date);
    });

    this.calculateAverageWorkloads();
  }

  /**
   * Get pattern continuity data for next generation
   */
  getPatternContinuityData(): { [analystId: string]: { lastPattern: string; lastWorkDate: Date } } {
    const continuityData: { [key: string]: { lastPattern: string; lastWorkDate: Date } } = {};
    
    this.metrics.forEach((metrics, analystId) => {
      if (metrics.lastWorkPattern && metrics.lastWorkDate) {
        continuityData[analystId] = {
          lastPattern: metrics.lastWorkPattern,
          lastWorkDate: metrics.lastWorkDate
        };
      }
    });

    return continuityData;
  }

  /**
   * Analyze schedules and update metrics
   */
  async analyzeSchedules(schedules: any[], startDate: Date, endDate: Date): Promise<void> {
    // Reset metrics for the period
    this.metrics.forEach(metric => {
      metric.totalDaysWorked = 0;
      metric.weekendDaysWorked = 0;
      metric.holidayDaysWorked = 0;
      metric.screenerDaysAssigned = 0;
      metric.consecutiveWorkDays = [];
    });

    // Group schedules by analyst
    const schedulesByAnalyst = new Map<string, any[]>();
    schedules.forEach(schedule => {
      const analystSchedules = schedulesByAnalyst.get(schedule.analystId) || [];
      analystSchedules.push(schedule);
      schedulesByAnalyst.set(schedule.analystId, analystSchedules);
    });

    // Update metrics for each analyst
    schedulesByAnalyst.forEach((analystSchedules, analystId) => {
      const metrics = this.metrics.get(analystId);
      if (!metrics) return;

      // Sort schedules by date
      analystSchedules.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

      let consecutiveDays = 0;
      let lastDate: Date | null = null;

      analystSchedules.forEach(schedule => {
        const date = new Date(schedule.date);
        const dayOfWeek = date.getDay();
        const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
        const isHoliday = this.holidays.has(moment(date).format('YYYY-MM-DD'));

        metrics.totalDaysWorked++;
        if (isWeekend) metrics.weekendDaysWorked++;
        if (isHoliday) metrics.holidayDaysWorked++;
        if (schedule.isScreener) metrics.screenerDaysAssigned++;

        // Track consecutive days
        if (lastDate) {
          const daysDiff = Math.floor((date.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24));
          if (daysDiff === 1) {
            consecutiveDays++;
          } else {
            if (consecutiveDays > 0) {
              metrics.consecutiveWorkDays.push(consecutiveDays + 1);
            }
            consecutiveDays = 0;
          }
        }
        lastDate = date;
      });

      // Add final consecutive days
      if (consecutiveDays > 0) {
        metrics.consecutiveWorkDays.push(consecutiveDays + 1);
      }
    });

    // Calculate average workload
    this.calculateAverageWorkloads();
  }

  /**
   * Get detailed fairness report
   */
  getFairnessReport(): {
    overallScore: number;
    components: {
      workload: number;
      weekend: number;
      screener: number;
      holiday: number;
    };
    analystMetrics: FairnessMetrics[];
    recommendations: string[];
  } {
    const workloadFairness = this.calculateWorkloadFairness(this.metrics);
    const weekendFairness = this.calculateWeekendFairness(this.metrics);
    const screenerFairness = this.calculateScreenerFairness(this.metrics);
    const holidayFairness = this.calculateHolidayFairness(this.metrics);

    const overallScore = (
      workloadFairness * 0.4 +
      weekendFairness * 0.25 +
      screenerFairness * 0.25 +
      holidayFairness * 0.1
    );

    const recommendations = this.generateRecommendations(
      workloadFairness,
      weekendFairness,
      screenerFairness,
      holidayFairness
    );

    return {
      overallScore,
      components: {
        workload: workloadFairness,
        weekend: weekendFairness,
        screener: screenerFairness,
        holiday: holidayFairness
      },
      analystMetrics: Array.from(this.metrics.values()),
      recommendations
    };
  }

  // Private helper methods

  private cloneMetrics(): Map<string, FairnessMetrics> {
    const clone = new Map<string, FairnessMetrics>();
    this.metrics.forEach((metrics, id) => {
      clone.set(id, { ...metrics, consecutiveWorkDays: [...metrics.consecutiveWorkDays] });
    });
    return clone;
  }

  private updateConsecutiveWorkDays(metrics: FairnessMetrics, date: Date): void {
    if (!metrics.lastWorkDate) {
      metrics.consecutiveWorkDays = [1];
      return;
    }

    const daysDiff = Math.floor((date.getTime() - metrics.lastWorkDate.getTime()) / (1000 * 60 * 60 * 24));
    
    if (daysDiff === 1) {
      // Consecutive day
      const lastConsecutive = metrics.consecutiveWorkDays[metrics.consecutiveWorkDays.length - 1] || 0;
      metrics.consecutiveWorkDays[metrics.consecutiveWorkDays.length - 1] = lastConsecutive + 1;
    } else {
      // New sequence
      metrics.consecutiveWorkDays.push(1);
    }
  }

  private wouldCreateExcessiveConsecutiveDays(
    metrics: FairnessMetrics,
    date: Date,
    maxConsecutive: number
  ): boolean {
    if (!metrics.lastWorkDate) return false;

    const daysDiff = Math.floor((date.getTime() - metrics.lastWorkDate.getTime()) / (1000 * 60 * 60 * 24));
    
    if (daysDiff === 1) {
      const currentConsecutive = metrics.consecutiveWorkDays[metrics.consecutiveWorkDays.length - 1] || 0;
      return currentConsecutive >= maxConsecutive;
    }

    return false;
  }

  private async getRecentScreenerDays(analystId: string, date: Date, days: number): Promise<number> {
    const startDate = new Date(date);
    startDate.setDate(startDate.getDate() - days);

    const recentScreenerSchedules = await this.prisma.schedule.count({
      where: {
        analystId,
        date: {
          gte: startDate,
          lt: date
        },
        isScreener: true
      }
    });

    return recentScreenerSchedules;
  }

  private calculateAverageWorkloads(): void {
    const totalDays = Array.from(this.metrics.values())
      .reduce((sum, m) => sum + m.totalDaysWorked, 0);
    const avgWorkload = totalDays / this.metrics.size;

    this.metrics.forEach(metrics => {
      metrics.averageWorkload = avgWorkload;
    });
  }

  private calculateWorkloadFairness(metrics: Map<string, FairnessMetrics>): number {
    const workloads = Array.from(metrics.values()).map(m => m.totalDaysWorked);
    if (workloads.length === 0) return 1;

    const avg = workloads.reduce((a, b) => a + b, 0) / workloads.length;
    if (avg === 0) return 1;

    const variance = workloads.reduce((sum, w) => sum + Math.pow(w - avg, 2), 0) / workloads.length;
    const stdDev = Math.sqrt(variance);
    const cv = stdDev / avg; // Coefficient of variation

    // Convert to 0-1 scale (lower CV = higher fairness)
    return Math.max(0, 1 - cv);
  }

  private calculateWeekendFairness(metrics: Map<string, FairnessMetrics>): number {
    const weekendDays = Array.from(metrics.values()).map(m => m.weekendDaysWorked);
    if (weekendDays.length === 0) return 1;

    const avg = weekendDays.reduce((a, b) => a + b, 0) / weekendDays.length;
    if (avg === 0) return 1;

    const variance = weekendDays.reduce((sum, w) => sum + Math.pow(w - avg, 2), 0) / weekendDays.length;
    const stdDev = Math.sqrt(variance);
    const cv = stdDev / avg;

    return Math.max(0, 1 - cv);
  }

  private calculateScreenerFairness(metrics: Map<string, FairnessMetrics>): number {
    const screenerDays = Array.from(metrics.values()).map(m => m.screenerDaysAssigned);
    if (screenerDays.length === 0) return 1;

    const avg = screenerDays.reduce((a, b) => a + b, 0) / screenerDays.length;
    if (avg === 0) return 1;

    const variance = screenerDays.reduce((sum, w) => sum + Math.pow(w - avg, 2), 0) / screenerDays.length;
    const stdDev = Math.sqrt(variance);
    const cv = stdDev / avg;

    return Math.max(0, 1 - cv);
  }

  private calculateHolidayFairness(metrics: Map<string, FairnessMetrics>): number {
    const holidayDays = Array.from(metrics.values()).map(m => m.holidayDaysWorked);
    if (holidayDays.length === 0) return 1;

    const avg = holidayDays.reduce((a, b) => a + b, 0) / holidayDays.length;
    if (avg === 0) return 1;

    const variance = holidayDays.reduce((sum, w) => sum + Math.pow(w - avg, 2), 0) / holidayDays.length;
    const stdDev = Math.sqrt(variance);
    const cv = stdDev / avg;

    return Math.max(0, 1 - cv);
  }

  private generateRecommendations(
    workloadFairness: number,
    weekendFairness: number,
    screenerFairness: number,
    holidayFairness: number
  ): string[] {
    const recommendations: string[] = [];

    if (workloadFairness < 0.7) {
      recommendations.push('Workload distribution is uneven. Consider rebalancing analyst schedules.');
    }

    if (weekendFairness < 0.7) {
      recommendations.push('Weekend assignments are not fairly distributed. Review weekend rotation patterns.');
    }

    if (screenerFairness < 0.7) {
      recommendations.push('Screener duties are unevenly assigned. Ensure fair rotation of screener responsibilities.');
    }

    if (holidayFairness < 0.7) {
      recommendations.push('Holiday coverage is imbalanced. Consider rotating holiday assignments more equitably.');
    }

    // Check for specific analyst issues
    const metricsArray = Array.from(this.metrics.values());
    const avgWorkload = metricsArray.reduce((sum, m) => sum + m.totalDaysWorked, 0) / metricsArray.length;

    metricsArray.forEach(metric => {
      if (metric.totalDaysWorked > avgWorkload * 1.3) {
        recommendations.push(`Analyst ${metric.analystName} is overworked compared to average.`);
      }
      if (metric.totalDaysWorked < avgWorkload * 0.7) {
        recommendations.push(`Analyst ${metric.analystName} has significantly fewer assignments than average.`);
      }
    });

    if (recommendations.length === 0) {
      recommendations.push('Schedule distribution is fair and well-balanced across all metrics.');
    }

    return recommendations;
  }
}
