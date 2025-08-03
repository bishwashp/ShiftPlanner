import { PrismaClient } from '@prisma/client';
import { cacheService } from '../lib/cache';
import { PredictiveFairnessService } from './PredictiveFairnessService';
import { KPITrackingService } from './KPITrackingService';

export interface TimeRange {
  startDate: Date;
  endDate: Date;
}

// Executive Analytics Interfaces
export interface ExecutiveMetrics {
  overallFairnessScore: number;
  utilizationRate: number;
  constraintViolationRate: number;
  systemPerformance: {
    uptime: number;
    responseTime: number;
    errorRate: number;
  };
  costOptimization: {
    efficiencyGain: number;
    timeSaved: number;
    costSavings: number;
  };
  trends: {
    fairness: 'IMPROVING' | 'STABLE' | 'DETERIORATING';
    utilization: 'IMPROVING' | 'STABLE' | 'DETERIORATING';
    violations: 'IMPROVING' | 'STABLE' | 'DETERIORATING';
  };
  strategicInsights: string[];
  alerts: string[];
}

// Manager Analytics Interfaces
export interface ManagerMetrics {
  teamId: string;
  teamFairnessScore: number;
  workloadDistribution: {
    standardDeviation: number;
    giniCoefficient: number;
    maxMinRatio: number;
  };
  upcomingConflicts: Array<{
    id: string;
    type: string;
    severity: 'LOW' | 'MEDIUM' | 'HIGH';
    description: string;
    affectedAnalysts: string[];
    resolutionStrategy: string;
  }>;
  individualPerformance: Array<{
    analystId: string;
    analystName: string;
    fairnessScore: number;
    workload: number;
    satisfaction: number;
    trend: 'IMPROVING' | 'STABLE' | 'DETERIORATING';
  }>;
  constraintEffectiveness: {
    complianceRate: number;
    violationTrend: 'IMPROVING' | 'STABLE' | 'DETERIORATING';
    topViolations: string[];
  };
  recommendations: string[];
}

// Analyst Analytics Interfaces
export interface AnalystMetrics {
  analystId: string;
  personalFairnessScore: number;
  workloadTrend: 'IMPROVING' | 'STABLE' | 'DETERIORATING';
  upcomingSchedule: Array<{
    date: Date;
    shiftType: string;
    isScreener: boolean;
    fairnessImpact: number;
  }>;
  historicalPerformance: Array<{
    date: Date;
    fairnessScore: number;
    workload: number;
    satisfaction: number;
  }>;
  constraintCompliance: {
    complianceRate: number;
    violations: Array<{
      date: Date;
      type: string;
      description: string;
    }>;
  };
  improvementOpportunities: string[];
}

// Benchmark Comparison Interface
export interface BenchmarkComparison {
  metric: string;
  currentValue: number;
  industryAverage: number;
  percentile: number;
  status: 'EXCELLENT' | 'GOOD' | 'AVERAGE' | 'BELOW_AVERAGE' | 'POOR';
  improvement: number;
}

export class AnalyticsService {
  private prisma: PrismaClient;
  private cache: typeof cacheService;
  private predictiveFairness: PredictiveFairnessService;
  private kpiTracking: KPITrackingService;

  constructor(
    prisma: PrismaClient, 
    cache: typeof cacheService,
    predictiveFairness: PredictiveFairnessService,
    kpiTracking: KPITrackingService
  ) {
    this.prisma = prisma;
    this.cache = cache;
    this.predictiveFairness = predictiveFairness;
    this.kpiTracking = kpiTracking;
  }

  /**
   * Get executive-level analytics for strategic decision making
   */
  async getExecutiveMetrics(timeRange: TimeRange): Promise<ExecutiveMetrics> {
    try {
      const cacheKey = `executive_metrics_${timeRange.startDate.toISOString()}_${timeRange.endDate.toISOString()}`;
      const cached = await this.cache.get(cacheKey);
      if (cached) return JSON.parse(cached as string);

      // Get current KPI metrics
      const kpiMetrics = await this.kpiTracking.getCurrentKPIMetrics();
      
      // Calculate utilization rate
      const utilizationRate = await this.calculateUtilizationRate(timeRange);
      
      // Get system performance metrics
      const systemPerformance = await this.getSystemPerformanceMetrics(timeRange);
      
      // Calculate cost optimization metrics
      const costOptimization = await this.calculateCostOptimization(timeRange);
      
      // Get trends
      const trends = await this.calculateExecutiveTrends(timeRange);
      
      // Generate strategic insights
      const strategicInsights = await this.generateStrategicInsights(kpiMetrics, utilizationRate);
      
      // Get alerts
      const alerts = await this.getExecutiveAlerts(kpiMetrics, utilizationRate);

      const metrics: ExecutiveMetrics = {
        overallFairnessScore: kpiMetrics.averageFairnessScore,
        utilizationRate,
        constraintViolationRate: kpiMetrics.constraintViolationRate,
        systemPerformance,
        costOptimization,
        trends,
        strategicInsights,
        alerts
      };

      await this.cache.set(cacheKey, JSON.stringify(metrics), 300); // Cache for 5 minutes
      return metrics;
    } catch (error) {
      console.error('Error getting executive metrics:', error);
      throw new Error('Failed to retrieve executive metrics');
    }
  }

  /**
   * Get manager-level analytics for team management
   */
  async getManagerMetrics(teamId: string, timeRange: TimeRange): Promise<ManagerMetrics> {
    try {
      const cacheKey = `manager_metrics_${teamId}_${timeRange.startDate.toISOString()}_${timeRange.endDate.toISOString()}`;
      const cached = await this.cache.get(cacheKey);
      if (cached) return JSON.parse(cached as string);

      // Get team analysts
      const teamAnalysts = await this.prisma.analyst.findMany({
        where: { teamId },
        include: { schedules: true }
      });

      // Calculate team fairness score
      const teamFairnessScore = await this.calculateTeamFairnessScore(teamAnalysts, timeRange);
      
      // Calculate workload distribution
      const workloadDistribution = await this.calculateWorkloadDistribution(teamAnalysts, timeRange);
      
      // Get upcoming conflicts
      const upcomingConflicts = await this.getUpcomingConflicts(teamId, timeRange);
      
      // Get individual performance
      const individualPerformance = await this.getIndividualPerformance(teamAnalysts, timeRange);
      
      // Get constraint effectiveness
      const constraintEffectiveness = await this.getConstraintEffectiveness(teamId, timeRange);
      
      // Generate recommendations
      const recommendations = await this.generateManagerRecommendations(
        teamFairnessScore, 
        workloadDistribution, 
        upcomingConflicts
      );

      const metrics: ManagerMetrics = {
        teamId,
        teamFairnessScore,
        workloadDistribution,
        upcomingConflicts,
        individualPerformance,
        constraintEffectiveness,
        recommendations
      };

      await this.cache.set(cacheKey, JSON.stringify(metrics), 300); // Cache for 5 minutes
      return metrics;
    } catch (error) {
      console.error('Error getting manager metrics:', error);
      throw new Error('Failed to retrieve manager metrics');
    }
  }

  /**
   * Get analyst-specific analytics for personal insights
   */
  async getAnalystMetrics(analystId: string, timeRange: TimeRange): Promise<AnalystMetrics> {
    try {
      const cacheKey = `analyst_metrics_${analystId}_${timeRange.startDate.toISOString()}_${timeRange.endDate.toISOString()}`;
      const cached = await this.cache.get(cacheKey);
      if (cached) return JSON.parse(cached as string);

      // Get analyst data
      const analyst = await this.prisma.analyst.findUnique({
        where: { id: analystId },
        include: { schedules: true }
      });

      if (!analyst) {
        throw new Error('Analyst not found');
      }

      // Calculate personal fairness score
      const personalFairnessScore = await this.calculatePersonalFairnessScore(analyst, timeRange);
      
      // Get workload trend
      const workloadTrend = await this.calculateWorkloadTrend(analyst, timeRange);
      
      // Get upcoming schedule
      const upcomingSchedule = await this.getUpcomingSchedule(analystId, timeRange);
      
      // Get historical performance
      const historicalPerformance = await this.getHistoricalPerformance(analystId, timeRange);
      
      // Get constraint compliance
      const constraintCompliance = await this.getConstraintCompliance(analystId, timeRange);
      
      // Generate improvement opportunities
      const improvementOpportunities = await this.generateImprovementOpportunities(
        personalFairnessScore, 
        historicalPerformance
      );

      const metrics: AnalystMetrics = {
        analystId,
        personalFairnessScore,
        workloadTrend,
        upcomingSchedule,
        historicalPerformance,
        constraintCompliance,
        improvementOpportunities
      };

      await this.cache.set(cacheKey, JSON.stringify(metrics), 300); // Cache for 5 minutes
      return metrics;
    } catch (error) {
      console.error('Error getting analyst metrics:', error);
      throw new Error('Failed to retrieve analyst metrics');
    }
  }

  /**
   * Get benchmark comparison data
   */
  async getBenchmarkComparison(): Promise<BenchmarkComparison[]> {
    try {
      const cacheKey = 'benchmark_comparison';
      const cached = await this.cache.get(cacheKey);
      if (cached) return JSON.parse(cached as string);

      const kpiMetrics = await this.kpiTracking.getCurrentKPIMetrics();
      
      const benchmarks: BenchmarkComparison[] = [
        {
          metric: 'Schedule Success Rate',
          currentValue: kpiMetrics.scheduleSuccessRate,
          industryAverage: 0.92,
          percentile: this.calculatePercentile(kpiMetrics.scheduleSuccessRate, 0.92),
          status: this.getStatus(kpiMetrics.scheduleSuccessRate, 0.92, true),
          improvement: Math.max(0, 0.95 - kpiMetrics.scheduleSuccessRate)
        },
        {
          metric: 'Fairness Score',
          currentValue: kpiMetrics.averageFairnessScore,
          industryAverage: 0.78,
          percentile: this.calculatePercentile(kpiMetrics.averageFairnessScore, 0.78),
          status: this.getStatus(kpiMetrics.averageFairnessScore, 0.78, true),
          improvement: Math.max(0, 0.85 - kpiMetrics.averageFairnessScore)
        },
        {
          metric: 'Constraint Violation Rate',
          currentValue: kpiMetrics.constraintViolationRate,
          industryAverage: 0.08,
          percentile: this.calculatePercentile(kpiMetrics.constraintViolationRate, 0.08),
          status: this.getStatus(kpiMetrics.constraintViolationRate, 0.08, false),
          improvement: Math.max(0, kpiMetrics.constraintViolationRate - 0.05)
        },
        {
          metric: 'User Satisfaction',
          currentValue: kpiMetrics.userSatisfactionScore,
          industryAverage: 7.2,
          percentile: this.calculatePercentile(kpiMetrics.userSatisfactionScore, 7.2),
          status: this.getStatus(kpiMetrics.userSatisfactionScore, 7.2, true),
          improvement: Math.max(0, 8.5 - kpiMetrics.userSatisfactionScore)
        },
        {
          metric: 'Conflict Resolution Time',
          currentValue: kpiMetrics.conflictResolutionTime,
          industryAverage: 18.5,
          percentile: this.calculatePercentile(kpiMetrics.conflictResolutionTime, 18.5),
          status: this.getStatus(kpiMetrics.conflictResolutionTime, 18.5, false),
          improvement: Math.max(0, kpiMetrics.conflictResolutionTime - 12)
        }
      ];

      await this.cache.set(cacheKey, JSON.stringify(benchmarks), 600); // Cache for 10 minutes
      return benchmarks;
    } catch (error) {
      console.error('Error getting benchmark comparison:', error);
      throw new Error('Failed to retrieve benchmark comparison');
    }
  }

  // Private helper methods

  private async calculateUtilizationRate(timeRange: TimeRange): Promise<number> {
    const totalSchedules = await this.prisma.schedule.count({
      where: {
        date: {
          gte: timeRange.startDate,
          lte: timeRange.endDate
        }
      }
    });

    const totalPossibleSlots = await this.getTotalPossibleSlots(timeRange);
    return totalPossibleSlots > 0 ? totalSchedules / totalPossibleSlots : 0;
  }

  private async getSystemPerformanceMetrics(timeRange: TimeRange) {
    // This would typically come from monitoring data
    // For now, return mock data
    return {
      uptime: 99.9,
      responseTime: 150, // ms
      errorRate: 0.1
    };
  }

  private async calculateCostOptimization(timeRange: TimeRange) {
    // Calculate efficiency gains and cost savings
    const kpiMetrics = await this.kpiTracking.getCurrentKPIMetrics();
    const efficiencyGain = (kpiMetrics.scheduleSuccessRate - 0.85) * 100;
    
    return {
      efficiencyGain: Math.max(0, efficiencyGain),
      timeSaved: efficiencyGain * 2, // hours per week
      costSavings: efficiencyGain * 50 // estimated cost savings
    };
  }

  private async calculateExecutiveTrends(timeRange: TimeRange) {
    // Get historical data and calculate trends
    const historicalData = await this.prisma.kPIMetrics.findMany({
      where: {
        date: {
          gte: new Date(timeRange.startDate.getTime() - 30 * 24 * 60 * 60 * 1000), // 30 days ago
          lte: timeRange.endDate
        }
      },
      orderBy: { date: 'asc' }
    });

    if (historicalData.length < 2) {
      return {
        fairness: 'STABLE' as const,
        utilization: 'STABLE' as const,
        violations: 'STABLE' as const
      };
    }

    const recent = historicalData[historicalData.length - 1];
    const previous = historicalData[historicalData.length - 2];

    return {
      fairness: this.determineTrend(recent.averageFairnessScore, previous.averageFairnessScore),
      utilization: this.determineTrend(recent.scheduleSuccessRate, previous.scheduleSuccessRate),
      violations: this.determineTrend(previous.constraintViolationRate, recent.constraintViolationRate) // Lower is better
    };
  }

  private async generateStrategicInsights(kpiMetrics: any, utilizationRate: number): Promise<string[]> {
    const insights: string[] = [];

    if (kpiMetrics.averageFairnessScore < 0.8) {
      insights.push('Fairness score below target - consider reviewing workload distribution');
    }

    if (utilizationRate < 0.85) {
      insights.push('Low utilization rate - opportunity to optimize resource allocation');
    }

    if (kpiMetrics.constraintViolationRate > 0.05) {
      insights.push('High constraint violation rate - review constraint definitions');
    }

    if (kpiMetrics.userSatisfactionScore < 7.5) {
      insights.push('User satisfaction below target - gather feedback for improvement');
    }

    return insights;
  }

  private async getExecutiveAlerts(kpiMetrics: any, utilizationRate: number): Promise<string[]> {
    const alerts: string[] = [];

    if (kpiMetrics.averageFairnessScore < 0.7) {
      alerts.push('CRITICAL: Fairness score critically low - immediate intervention required');
    }

    if (utilizationRate < 0.7) {
      alerts.push('WARNING: Resource utilization below acceptable threshold');
    }

    if (kpiMetrics.constraintViolationRate > 0.1) {
      alerts.push('WARNING: Constraint violations exceeding acceptable limits');
    }

    return alerts;
  }

  private async calculateTeamFairnessScore(analysts: any[], timeRange: TimeRange): Promise<number> {
    if (analysts.length === 0) return 0;

    const fairnessScores = await Promise.all(
      analysts.map(analyst => this.calculatePersonalFairnessScore(analyst, timeRange))
    );

    return fairnessScores.reduce((sum, score) => sum + score, 0) / fairnessScores.length;
  }

  private async calculateWorkloadDistribution(analysts: any[], timeRange: TimeRange) {
    const workloads = await Promise.all(
      analysts.map(analyst => this.calculateAnalystWorkload(analyst, timeRange))
    );

    const values = workloads.map(w => w.totalDays);
    return {
      standardDeviation: this.calculateStandardDeviation(values),
      giniCoefficient: this.calculateGiniCoefficient(values),
      maxMinRatio: Math.max(...values) / Math.min(...values)
    };
  }

  private async getUpcomingConflicts(teamId: string, timeRange: TimeRange) {
    // This would integrate with the conflict detection system
    // For now, return mock data
    return [
      {
        id: 'conflict-1',
        type: 'WORKLOAD_OVERLOAD',
        severity: 'MEDIUM' as const,
        description: 'Analyst John Doe has 5 consecutive work days',
        affectedAnalysts: ['analyst-1'],
        resolutionStrategy: 'Consider redistributing workload'
      }
    ];
  }

  private async getIndividualPerformance(analysts: any[], timeRange: TimeRange) {
    return Promise.all(
      analysts.map(async (analyst) => {
        const fairnessScore = await this.calculatePersonalFairnessScore(analyst, timeRange);
        const workload = await this.calculateAnalystWorkload(analyst, timeRange);
        const trend = await this.calculateWorkloadTrend(analyst, timeRange);

        return {
          analystId: analyst.id,
          analystName: analyst.name,
          fairnessScore,
          workload: workload.totalDays,
          satisfaction: 8.0, // Mock data
          trend
        };
      })
    );
  }

  private async getConstraintEffectiveness(teamId: string, timeRange: TimeRange) {
    // This would analyze constraint violations and effectiveness
    return {
      complianceRate: 0.92,
      violationTrend: 'IMPROVING' as const,
      topViolations: ['Consecutive days limit', 'Weekend rotation', 'Screener assignment']
    };
  }

  private async generateManagerRecommendations(
    teamFairnessScore: number, 
    workloadDistribution: any, 
    upcomingConflicts: any[]
  ): Promise<string[]> {
    const recommendations: string[] = [];

    if (teamFairnessScore < 0.8) {
      recommendations.push('Implement workload balancing strategies to improve team fairness');
    }

    if (workloadDistribution.giniCoefficient > 0.3) {
      recommendations.push('Redistribute workload to reduce inequality among team members');
    }

    if (upcomingConflicts.length > 0) {
      recommendations.push('Address upcoming conflicts proactively to prevent schedule disruptions');
    }

    return recommendations;
  }

  private async calculatePersonalFairnessScore(analyst: any, timeRange: TimeRange): Promise<number> {
    const schedules = analyst.schedules.filter((s: any) => 
      s.date >= timeRange.startDate && s.date <= timeRange.endDate
    );

    if (schedules.length === 0) return 0;

    const totalDays = schedules.length;
    const screenerDays = schedules.filter((s: any) => s.isScreener).length;
    const weekendDays = schedules.filter((s: any) => 
      s.date.getDay() === 0 || s.date.getDay() === 6
    ).length;

    // Calculate fairness based on workload distribution, screener assignments, and weekend work
    const workloadFairness = 1 - Math.abs(totalDays - 20) / 20; // Assuming 20 days is fair
    const screenerFairness = 1 - Math.abs(screenerDays - totalDays * 0.2) / totalDays; // 20% screener ratio
    const weekendFairness = 1 - Math.abs(weekendDays - totalDays * 0.3) / totalDays; // 30% weekend ratio

    return (workloadFairness + screenerFairness + weekendFairness) / 3;
  }

  private async calculateWorkloadTrend(analyst: any, timeRange: TimeRange): Promise<'IMPROVING' | 'STABLE' | 'DETERIORATING'> {
    // Compare current period with previous period
    const currentPeriod = timeRange;
    const previousPeriod = {
      startDate: new Date(currentPeriod.startDate.getTime() - (currentPeriod.endDate.getTime() - currentPeriod.startDate.getTime())),
      endDate: currentPeriod.startDate
    };

    const currentWorkload = await this.calculateAnalystWorkload(analyst, currentPeriod);
    const previousWorkload = await this.calculateAnalystWorkload(analyst, previousPeriod);

    return this.determineTrend(currentWorkload.totalDays, previousWorkload.totalDays);
  }

  private async getUpcomingSchedule(analystId: string, timeRange: TimeRange) {
    const schedules = await this.prisma.schedule.findMany({
      where: {
        analystId,
        date: {
          gte: timeRange.startDate,
          lte: timeRange.endDate
        }
      },
      orderBy: { date: 'asc' }
    });

    return schedules.map((schedule: any) => ({
      date: schedule.date,
      shiftType: schedule.shiftType,
      isScreener: schedule.isScreener,
      fairnessImpact: 0.1 // Mock data - would be calculated based on impact
    }));
  }

  private async getHistoricalPerformance(analystId: string, timeRange: TimeRange) {
    // Get historical data for the analyst
    const schedules = await this.prisma.schedule.findMany({
      where: {
        analystId,
        date: {
          gte: new Date(timeRange.startDate.getTime() - 90 * 24 * 60 * 60 * 1000), // 90 days ago
          lte: timeRange.endDate
        }
      },
      orderBy: { date: 'asc' }
    });

    // Group by week and calculate metrics
    const weeklyData = this.groupSchedulesByWeek(schedules);
    
    return weeklyData.map(week => ({
      date: week.startDate,
      fairnessScore: week.fairnessScore,
      workload: week.totalDays,
      satisfaction: 8.0 // Mock data
    }));
  }

  private async getConstraintCompliance(analystId: string, timeRange: TimeRange) {
    // This would analyze constraint violations for the analyst
    return {
      complianceRate: 0.95,
      violations: [
        {
          date: new Date(),
          type: 'Consecutive days limit',
          description: 'Exceeded 5 consecutive work days'
        }
      ]
    };
  }

  private async generateImprovementOpportunities(
    personalFairnessScore: number, 
    historicalPerformance: any[]
  ): Promise<string[]> {
    const opportunities: string[] = [];

    if (personalFairnessScore < 0.8) {
      opportunities.push('Request workload adjustment to improve fairness score');
    }

    if (historicalPerformance.length > 0) {
      const recentScores = historicalPerformance.slice(-4).map(p => p.fairnessScore);
      const trend = this.calculateTrend(recentScores);
      
      if (trend === 'DETERIORATING') {
        opportunities.push('Schedule review meeting to address declining fairness trend');
      }
    }

    return opportunities;
  }

  private async getTotalPossibleSlots(timeRange: TimeRange): Promise<number> {
    const analysts = await this.prisma.analyst.count();
    const daysDiff = Math.ceil((timeRange.endDate.getTime() - timeRange.startDate.getTime()) / (1000 * 60 * 60 * 24));
    return analysts * daysDiff;
  }

  private async calculateAnalystWorkload(analyst: any, timeRange: TimeRange) {
    const schedules = analyst.schedules.filter((s: any) => 
      s.date >= timeRange.startDate && s.date <= timeRange.endDate
    );

    return {
      totalDays: schedules.length,
      screenerDays: schedules.filter((s: any) => s.isScreener).length,
      weekendDays: schedules.filter((s: any) => 
        s.date.getDay() === 0 || s.date.getDay() === 6
      ).length
    };
  }

  private groupSchedulesByWeek(schedules: any[]) {
    const weeklyData: any[] = [];
    const weekMap = new Map<string, any[]>();

    schedules.forEach(schedule => {
      const weekStart = this.getWeekStart(schedule.date);
      const weekKey = weekStart.toISOString().split('T')[0];
      
      if (!weekMap.has(weekKey)) {
        weekMap.set(weekKey, []);
      }
      weekMap.get(weekKey)!.push(schedule);
    });

    weekMap.forEach((weekSchedules, weekKey) => {
      const totalDays = weekSchedules.length;
      const screenerDays = weekSchedules.filter(s => s.isScreener).length;
      const weekendDays = weekSchedules.filter(s => 
        s.date.getDay() === 0 || s.date.getDay() === 6
      ).length;

      const fairnessScore = this.calculateWeeklyFairnessScore(totalDays, screenerDays, weekendDays);

      weeklyData.push({
        startDate: new Date(weekKey),
        totalDays,
        screenerDays,
        weekendDays,
        fairnessScore
      });
    });

    return weeklyData.sort((a, b) => a.startDate.getTime() - b.startDate.getTime());
  }

  private getWeekStart(date: Date): Date {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    return new Date(d.setDate(diff));
  }

  private calculateWeeklyFairnessScore(totalDays: number, screenerDays: number, weekendDays: number): number {
    const workloadFairness = 1 - Math.abs(totalDays - 5) / 5; // Assuming 5 days is fair
    const screenerFairness = 1 - Math.abs(screenerDays - totalDays * 0.2) / totalDays;
    const weekendFairness = 1 - Math.abs(weekendDays - totalDays * 0.3) / totalDays;

    return (workloadFairness + screenerFairness + weekendFairness) / 3;
  }

  private calculateTrend(values: number[]): 'IMPROVING' | 'STABLE' | 'DETERIORATING' {
    if (values.length < 2) return 'STABLE';
    
    const first = values[0];
    const last = values[values.length - 1];
    const change = last - first;
    
    if (Math.abs(change) < 0.05) return 'STABLE';
    return change > 0 ? 'IMPROVING' : 'DETERIORATING';
  }

  private determineTrend(current: number, previous: number): 'IMPROVING' | 'STABLE' | 'DETERIORATING' {
    const change = current - previous;
    if (Math.abs(change) < 0.05) return 'STABLE';
    return change > 0 ? 'IMPROVING' : 'DETERIORATING';
  }

  private calculateStandardDeviation(values: number[]): number {
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const squaredDiffs = values.map(val => Math.pow(val - mean, 2));
    const variance = squaredDiffs.reduce((sum, val) => sum + val, 0) / values.length;
    return Math.sqrt(variance);
  }

  private calculateGiniCoefficient(values: number[]): number {
    if (values.length === 0) return 0;
    
    const sorted = [...values].sort((a, b) => a - b);
    const n = sorted.length;
    const sum = sorted.reduce((acc, val, i) => acc + val * (n - i), 0);
    const total = sorted.reduce((acc, val) => acc + val, 0);
    
    return (2 * sum) / (n * total) - (n + 1) / n;
  }

  private calculatePercentile(current: number, benchmark: number): number {
    // Simplified percentile calculation
    if (current >= benchmark) {
      return 50 + (current - benchmark) / benchmark * 25;
    } else {
      return 50 - (benchmark - current) / benchmark * 25;
    }
  }

  private getStatus(
    current: number, 
    benchmark: number, 
    higherIsBetter: boolean
  ): 'EXCELLENT' | 'GOOD' | 'AVERAGE' | 'BELOW_AVERAGE' | 'POOR' {
    const ratio = current / benchmark;
    
    if (higherIsBetter) {
      if (ratio >= 1.1) return 'EXCELLENT';
      if (ratio >= 1.0) return 'GOOD';
      if (ratio >= 0.9) return 'AVERAGE';
      if (ratio >= 0.8) return 'BELOW_AVERAGE';
      return 'POOR';
    } else {
      if (ratio <= 0.9) return 'EXCELLENT';
      if (ratio <= 1.0) return 'GOOD';
      if (ratio <= 1.1) return 'AVERAGE';
      if (ratio <= 1.2) return 'BELOW_AVERAGE';
      return 'POOR';
    }
  }
} 