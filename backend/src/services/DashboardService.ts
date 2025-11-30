import { PrismaClient } from '@prisma/client';
import { cacheService } from '../lib/cache';
import { AnalyticsEngine } from './AnalyticsEngine';
import { PredictiveEngine } from './PredictiveEngine';

export interface DashboardData {
  summary: DashboardSummary;
  fairnessMetrics: FairnessMetrics;
  workloadDistribution: WorkloadDistribution;
  recentActivity: RecentActivity[];
  alerts: DashboardAlert[];
  predictions: PredictionData;
  performanceMetrics: PerformanceMetrics;
}

export interface DashboardSummary {
  totalAnalysts: number;
  activeAnalysts: number;
  totalSchedules: number;
  upcomingSchedules: number;
  conflicts: number;
  averageFairnessScore: number;
}

export interface FairnessMetrics {
  overallScore: number;
  workloadFairness: number;
  screenerFairness: number;
  weekendFairness: number;
  trend: 'IMPROVING' | 'STABLE' | 'DECLINING';
}

export interface WorkloadDistribution {
  averageWorkload: number;
  standardDeviation: number;
  distribution: Array<{
    analystName: string;
    workload: number;
    fairnessScore: number;
  }>;
}

export interface RecentActivity {
  id: string;
  type: 'SCHEDULE_CREATED' | 'SCHEDULE_UPDATED' | 'CONFLICT_RESOLVED' | 'ALGORITHM_RUN';
  description: string;
  timestamp: Date;
  analystName?: string;
  impact: 'LOW' | 'MEDIUM' | 'HIGH';
}

export interface DashboardAlert {
  id: string;
  type: 'FAIRNESS_VIOLATION' | 'WORKLOAD_IMBALANCE' | 'CONFLICT_DETECTED' | 'PERFORMANCE_ISSUE';
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  message: string;
  timestamp: Date;
  actionable: boolean;
  suggestedActions?: string[];
}

export interface PredictionData {
  staffingNeeds: Array<{
    date: Date;
    required: number;
    confidence: number;
  }>;
  burnoutRisks: Array<{
    analystName: string;
    riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    riskScore: number;
  }>;
  conflictForecasts: Array<{
    date: Date;
    probability: number;
    type: string;
    severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  }>;
}

export interface PerformanceMetrics {
  averageQueryTime: number;
  cacheHitRate: number;
  activeConnections: number;
  systemHealth: 'HEALTHY' | 'WARNING' | 'CRITICAL';
}

export interface ReportConfig {
  type: 'FAIRNESS_REPORT' | 'WORKLOAD_REPORT' | 'CONFLICT_REPORT' | 'PERFORMANCE_REPORT';
  dateRange: {
    startDate: Date;
    endDate: Date;
  };
  filters?: {
    analystIds?: string[];
    shiftTypes?: string[];
    includeInactive?: boolean;
  };
  metrics: string[];
  format: 'JSON' | 'CSV' | 'PDF';
}

export interface CustomReport {
  id: string;
  name: string;
  type: string;
  generatedAt: Date;
  data: any;
  summary: string;
  recommendations: string[];
}

export interface ExportFormat {
  type: 'JSON' | 'CSV' | 'PDF' | 'EXCEL';
  includeCharts?: boolean;
  includeRecommendations?: boolean;
}

export interface AnalyticsFilters {
  dateRange?: {
    startDate: Date;
    endDate: Date;
  };
  analystIds?: string[];
  shiftTypes?: string[];
  includeInactive?: boolean;
  minFairnessScore?: number;
  maxWorkload?: number;
}

export interface ExportResult {
  success: boolean;
  data?: any;
  fileUrl?: string;
  error?: string;
  generatedAt: Date;
}

export class DashboardService {
  private prisma: PrismaClient;
  private cache: typeof cacheService;
  private analyticsEngine: AnalyticsEngine;
  private predictiveEngine: PredictiveEngine;

  constructor(
    prisma: PrismaClient,
    cache: typeof cacheService,
    analyticsEngine: AnalyticsEngine,
    predictiveEngine: PredictiveEngine
  ) {
    this.prisma = prisma;
    this.cache = cache;
    this.analyticsEngine = analyticsEngine;
    this.predictiveEngine = predictiveEngine;
  }

  async generateRealTimeDashboard(): Promise<DashboardData> {
    const cacheKey = 'real_time_dashboard';

    // Try to get from cache first (cache for 5 minutes)
    const cached = await this.cache.get(cacheKey);
    if (cached) {
      return cached as DashboardData;
    }

    // Generate summary
    const summary = await this.generateSummary();

    // Generate fairness metrics
    const fairnessMetrics = await this.generateFairnessMetrics();

    // Generate workload distribution
    const workloadDistribution = await this.generateWorkloadDistribution();

    // Get recent activity
    const recentActivity = await this.getRecentActivity();

    // Get alerts
    const alerts = await this.generateAlerts();

    // Get predictions
    const predictions = await this.generatePredictions();

    // Get performance metrics
    const performanceMetrics = await this.getPerformanceMetrics();

    const dashboardData: DashboardData = {
      summary,
      fairnessMetrics,
      workloadDistribution,
      recentActivity,
      alerts,
      predictions,
      performanceMetrics,
    };

    // Cache for 5 minutes
    await this.cache.set(cacheKey, dashboardData, 300);

    return dashboardData;
  }

  async createCustomReport(config: ReportConfig): Promise<CustomReport> {
    const reportId = `report_${Date.now()}`;

    let data: any;
    let summary: string;
    let recommendations: string[] = [];

    switch (config.type) {
      case 'FAIRNESS_REPORT':
        const fairnessReport = await this.analyticsEngine.generateFairnessReport(config.dateRange);
        data = fairnessReport;
        summary = `Fairness analysis for ${config.dateRange.startDate.toDateString()} to ${config.dateRange.endDate.toDateString()}. Overall fairness score: ${(fairnessReport.overallFairnessScore * 100).toFixed(1)}%`;
        recommendations = fairnessReport.recommendations;
        break;

      case 'WORKLOAD_REPORT':
        const monthlyTallies = await this.analyticsEngine.calculateMonthlyTallies(
          config.dateRange.startDate.getMonth() + 1,
          config.dateRange.startDate.getFullYear()
        );
        data = monthlyTallies;
        summary = `Workload analysis for ${config.dateRange.startDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}. Average workload: ${(monthlyTallies.reduce((sum, tally) => sum + tally.totalWorkDays, 0) / monthlyTallies.length).toFixed(1)} days`;
        break;

      case 'CONFLICT_REPORT':
        const conflicts = await this.prisma.schedulingConstraint.findMany({
          where: {
            startDate: { gte: config.dateRange.startDate },
            endDate: { lte: config.dateRange.endDate },
          },
          include: { analyst: true },
        });
        data = conflicts;
        summary = `Conflict analysis for ${config.dateRange.startDate.toDateString()} to ${config.dateRange.endDate.toDateString()}. Total conflicts: ${conflicts.length}`;
        break;

      case 'PERFORMANCE_REPORT':
        const performanceData = await this.getPerformanceMetrics();
        data = performanceData;
        summary = `Performance analysis. System health: ${performanceData.systemHealth}, Average query time: ${performanceData.averageQueryTime}ms`;
        break;

      default:
        throw new Error(`Unknown report type: ${config.type}`);
    }

    const report: CustomReport = {
      id: reportId,
      name: `${config.type} - ${new Date().toISOString()}`,
      type: config.type,
      generatedAt: new Date(),
      data,
      summary,
      recommendations,
    };

    return report;
  }

  async exportAnalytics(format: ExportFormat, filters: AnalyticsFilters): Promise<ExportResult> {
    try {
      let data: any;

      if (filters.dateRange) {
        // Export data for specific date range
        const schedules = await this.prisma.schedule.findMany({
          where: {
            date: {
              gte: filters.dateRange.startDate,
              lte: filters.dateRange.endDate,
            },
            ...(filters.analystIds && { analystId: { in: filters.analystIds } }),
            ...(filters.shiftTypes && { shiftType: { in: filters.shiftTypes } }),
          },
          include: { analyst: true },
        });

        data = schedules.map((schedule: any) => ({
          date: schedule.date,
          analystName: schedule.analyst.name,
          shiftType: schedule.shiftType,
          isScreener: schedule.isScreener,
        }));
      } else {
        // Export all data
        const schedules = await this.prisma.schedule.findMany({
          include: { analyst: true },
        });

        data = schedules.map((schedule: any) => ({
          date: schedule.date,
          analystName: schedule.analyst.name,
          shiftType: schedule.shiftType,
          isScreener: schedule.isScreener,
        }));
      }

      // Apply additional filters
      if (filters.minFairnessScore || filters.maxWorkload) {
        // This would require additional processing to apply fairness/workload filters
        // For now, return the basic data
      }

      let exportData: any;
      let fileUrl: string | undefined;

      switch (format.type) {
        case 'JSON':
          exportData = data;
          break;

        case 'CSV':
          exportData = this.convertToCSV(data);
          break;

        case 'PDF':
          // This would require a PDF generation library
          exportData = { message: 'PDF export not implemented yet' };
          break;

        case 'EXCEL':
          // This would require an Excel generation library
          exportData = { message: 'Excel export not implemented yet' };
          break;

        default:
          throw new Error(`Unsupported export format: ${format.type}`);
      }

      return {
        success: true,
        data: exportData,
        fileUrl,
        generatedAt: new Date(),
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        generatedAt: new Date(),
      };
    }
  }

  private async generateSummary(): Promise<DashboardSummary> {
    const [
      totalAnalysts,
      activeAnalysts,
      totalSchedules,
      upcomingSchedules,
      conflicts,
    ] = await Promise.all([
      this.prisma.analyst.count(),
      this.prisma.analyst.count({ where: { isActive: true } }),
      this.prisma.schedule.count(),
      this.prisma.schedule.count({
        where: { date: { gte: new Date() } },
      }),
      this.prisma.schedulingConstraint.count(),
    ]);

    // Calculate average fairness score
    const fairnessReport = await this.analyticsEngine.generateFairnessReport({
      startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Last 30 days
      endDate: new Date(),
    });

    return {
      totalAnalysts,
      activeAnalysts,
      totalSchedules,
      upcomingSchedules,
      conflicts,
      averageFairnessScore: fairnessReport.overallFairnessScore,
    };
  }

  private async generateFairnessMetrics(): Promise<FairnessMetrics> {
    const fairnessReport = await this.analyticsEngine.generateFairnessReport({
      startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Last 30 days
      endDate: new Date(),
    });

    // Determine trend (simplified - would need historical data for real trend analysis)
    const trend: 'IMPROVING' | 'STABLE' | 'DECLINING' = 'STABLE';

    return {
      overallScore: fairnessReport.overallFairnessScore,
      workloadFairness: 1 - (fairnessReport.workloadDistribution.standardDeviation / 10), // Normalize
      screenerFairness: fairnessReport.screenerDistribution.fairnessScore,
      weekendFairness: fairnessReport.weekendDistribution.fairnessScore,
      trend,
    };
  }

  private async generateWorkloadDistribution(): Promise<WorkloadDistribution> {
    const analysts = await this.prisma.analyst.findMany({
      where: { isActive: true },
    });

    const schedules = await this.prisma.schedule.findMany({
      where: {
        date: {
          gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Last 30 days
        },
      },
    });

    const distribution = analysts.map((analyst: any) => {
      const analystSchedules = schedules.filter((s: any) => s.analystId === analyst.id);
      const workload = analystSchedules.length;

      // Calculate fairness score for this analyst
      const fairnessScore = this.calculateIndividualFairnessScore({
        totalWorkDays: workload,
        screenerDays: analystSchedules.filter((s: any) => s.isScreener).length,
        weekendDays: analystSchedules.filter((s: any) => {
          const d = new Date(s.date);
          return d.getDay() === 0 || d.getDay() === 6;
        }).length,
        consecutiveWorkDayStreaks: this.calculateConsecutiveStreaks(analystSchedules),
      }, analystSchedules);

      return {
        analystName: analyst.name,
        workload,
        fairnessScore,
      };
    });

    const workloads = distribution.map((d: any) => d.workload);
    const averageWorkload = workloads.reduce((a: any, b: any) => a + b, 0) / workloads.length;
    const standardDeviation = this.calculateStandardDeviation(workloads);

    return {
      averageWorkload,
      standardDeviation,
      distribution,
    };
  }

  private async getRecentActivity(): Promise<RecentActivity[]> {
    // This would typically come from an activity log table
    // For now, return mock data
    return [
      {
        id: '1',
        type: 'SCHEDULE_CREATED',
        description: 'New schedule created for Alice Morning',
        timestamp: new Date(Date.now() - 1000 * 60 * 30), // 30 minutes ago
        analystName: 'Alice Morning',
        impact: 'LOW',
      },
      {
        id: '2',
        type: 'CONFLICT_RESOLVED',
        description: 'Conflict resolved for Bob Evening',
        timestamp: new Date(Date.now() - 1000 * 60 * 60), // 1 hour ago
        analystName: 'Bob Evening',
        impact: 'MEDIUM',
      },
    ];
  }

  private async generateAlerts(): Promise<DashboardAlert[]> {
    const alerts: DashboardAlert[] = [];

    // Check for fairness violations
    const fairnessReport = await this.analyticsEngine.generateFairnessReport({
      startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // Last 7 days
      endDate: new Date(),
    });

    if (fairnessReport.overallFairnessScore < 0.6) {
      alerts.push({
        id: '1',
        type: 'FAIRNESS_VIOLATION',
        severity: 'HIGH',
        message: `Low fairness score detected: ${(fairnessReport.overallFairnessScore * 100).toFixed(1)}%`,
        timestamp: new Date(),
        actionable: true,
        suggestedActions: fairnessReport.recommendations,
      });
    }

    // Check for workload imbalances
    const workloadDistribution = await this.generateWorkloadDistribution();
    if (workloadDistribution.standardDeviation > 3) {
      alerts.push({
        id: '2',
        type: 'WORKLOAD_IMBALANCE',
        severity: 'MEDIUM',
        message: `Workload imbalance detected. Standard deviation: ${workloadDistribution.standardDeviation.toFixed(2)}`,
        timestamp: new Date(),
        actionable: true,
        suggestedActions: ['Redistribute workload', 'Review scheduling algorithm'],
      });
    }

    return alerts;
  }

  private async generatePredictions(): Promise<PredictionData> {
    // Generate staffing predictions for next 7 days
    const staffingNeeds = [];
    for (let i = 1; i <= 7; i++) {
      const futureDate = new Date(Date.now() + i * 24 * 60 * 60 * 1000);
      const prediction = await this.predictiveEngine.predictStaffingNeeds(futureDate);
      staffingNeeds.push({
        date: futureDate,
        required: prediction.predictedRequiredStaff,
        confidence: prediction.confidence,
      });
    }

    // Get burnout risk assessments
    const analysts = await this.prisma.analyst.findMany({ where: { isActive: true } });
    const burnoutAssessments = await this.predictiveEngine.identifyBurnoutRisk(analysts);
    const burnoutRisks = burnoutAssessments
      .filter(assessment => assessment.riskLevel !== 'LOW')
      .map(assessment => ({
        analystName: assessment.analystName,
        riskLevel: assessment.riskLevel,
        riskScore: assessment.riskScore,
      }));

    // Generate conflict forecasts
    const conflictForecasts = [
      {
        date: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
        probability: 0.3,
        type: 'STAFFING_SHORTAGE',
        severity: 'MEDIUM' as const,
      },
    ];

    return {
      staffingNeeds,
      burnoutRisks,
      conflictForecasts,
    };
  }

  private async getPerformanceMetrics(): Promise<PerformanceMetrics> {
    // This would typically come from monitoring systems
    // For now, return mock data
    return {
      averageQueryTime: 150,
      cacheHitRate: 0.85,
      activeConnections: 12,
      systemHealth: 'HEALTHY',
    };
  }

  private calculateIndividualFairnessScore(tally: any, schedules: any[]): number {
    const baseScore = 1.0;
    const streakPenalty = Math.max(0, (tally.consecutiveWorkDayStreaks - 5) * 0.1);
    const screenerBalance = tally.screenerDays > 0 ? 0.1 : 0;
    const weekendBalance = tally.weekendDays > 0 ? 0.1 : 0;

    return Math.max(0, Math.min(1, baseScore - streakPenalty + screenerBalance + weekendBalance));
  }

  private calculateConsecutiveStreaks(schedules: any[]): number {
    if (schedules.length === 0) return 0;

    const sortedSchedules = schedules.sort((a, b) => a.date.getTime() - b.date.getTime());
    let maxStreak = 1;
    let currentStreak = 1;

    for (let i = 1; i < sortedSchedules.length; i++) {
      const prevDate = new Date(sortedSchedules[i - 1].date);
      const currDate = new Date(sortedSchedules[i].date);

      const diffTime = currDate.getTime() - prevDate.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      if (diffDays === 1) {
        currentStreak++;
        maxStreak = Math.max(maxStreak, currentStreak);
      } else {
        currentStreak = 1;
      }
    }

    return maxStreak;
  }

  private calculateStandardDeviation(values: number[]): number {
    if (values.length === 0) return 0;

    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const squaredDiffs = values.map(value => Math.pow(value - mean, 2));
    const variance = squaredDiffs.reduce((a, b) => a + b, 0) / values.length;

    return Math.sqrt(variance);
  }

  private convertToCSV(data: any[]): string {
    if (data.length === 0) return '';

    const headers = Object.keys(data[0]);
    const csvRows = [headers.join(',')];

    for (const row of data) {
      const values = headers.map(header => {
        const value = row[header];
        return typeof value === 'string' ? `"${value}"` : value;
      });
      csvRows.push(values.join(','));
    }

    return csvRows.join('\n');
  }
} 