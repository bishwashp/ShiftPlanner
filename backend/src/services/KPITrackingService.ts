import { PrismaClient } from '@prisma/client';
import { cacheService } from '../lib/cache';

export interface KPIMetrics {
  scheduleSuccessRate: number;
  averageFairnessScore: number;
  constraintViolationRate: number;
  userSatisfactionScore: number;
  conflictResolutionTime: number;
  lastUpdated: Date;
  trend: 'IMPROVING' | 'STABLE' | 'DETERIORATING';
}

export interface ConstraintViolation {
  id: string;
  analystId?: string;
  constraintType: string;
  description: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH';
  detectedAt: Date;
  resolvedAt?: Date;
  resolutionTime?: number; // in hours
}

export interface KPIReport {
  timeRange: {
    startDate: Date;
    endDate: Date;
  };
  metrics: KPIMetrics;
  trends: {
    scheduleSuccess: 'IMPROVING' | 'STABLE' | 'DETERIORATING';
    fairness: 'IMPROVING' | 'STABLE' | 'DETERIORATING';
    violations: 'IMPROVING' | 'STABLE' | 'DETERIORATING';
    satisfaction: 'IMPROVING' | 'STABLE' | 'DETERIORATING';
    resolutionTime: 'IMPROVING' | 'STABLE' | 'DETERIORATING';
  };
  alerts: string[];
  recommendations: string[];
}

export interface BenchmarkComparison {
  metric: string;
  currentValue: number;
  industryAverage: number;
  percentile: number;
  status: 'EXCELLENT' | 'GOOD' | 'AVERAGE' | 'BELOW_AVERAGE' | 'POOR';
  improvement: number;
}

export class KPITrackingService {
  private prisma: PrismaClient;
  private cache: typeof cacheService;

  constructor(prisma: PrismaClient, cache: typeof cacheService) {
    this.prisma = prisma;
    this.cache = cache;
  }

  /**
   * Track schedule generation success
   */
  async trackScheduleGeneration(success: boolean, quality: number): Promise<void> {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Get or create today's KPI record
      let kpiRecord = await this.prisma.kPIMetrics.findFirst({
        where: { date: today }
      });

      if (!kpiRecord) {
        kpiRecord = await this.prisma.kPIMetrics.create({
          data: {
            date: today,
            scheduleSuccessRate: 0,
            averageFairnessScore: 0,
            constraintViolationRate: 0,
            userSatisfactionScore: 0,
            conflictResolutionTime: 0,
            metadata: {
              generationAttempts: 0,
              successfulGenerations: 0,
              totalQuality: 0
            }
          }
        });
      }

      // Update metrics
      const metadata = kpiRecord.metadata as any || {};
      metadata.generationAttempts = (metadata.generationAttempts || 0) + 1;
      
      if (success) {
        metadata.successfulGenerations = (metadata.successfulGenerations || 0) + 1;
      }
      
      metadata.totalQuality = (metadata.totalQuality || 0) + quality;

      const successRate = metadata.successfulGenerations / metadata.generationAttempts;
      const avgQuality = metadata.totalQuality / metadata.generationAttempts;

      await this.prisma.kPIMetrics.update({
        where: { id: kpiRecord.id },
        data: {
          scheduleSuccessRate: successRate,
          metadata
        }
      });

      // Cache the updated metrics
      await this.cache.set(`kpi:${today.toISOString().split('T')[0]}`, {
        scheduleSuccessRate: successRate,
        averageFairnessScore: Number(kpiRecord.averageFairnessScore),
        constraintViolationRate: Number(kpiRecord.constraintViolationRate),
        userSatisfactionScore: Number(kpiRecord.userSatisfactionScore),
        conflictResolutionTime: Number(kpiRecord.conflictResolutionTime)
      }, 3600); // Cache for 1 hour

    } catch (error) {
      console.error('Error tracking schedule generation:', error);
      // Don't throw - KPI tracking should not break main functionality
    }
  }

  /**
   * Track fairness score
   */
  async trackFairnessScore(score: number): Promise<void> {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Get or create today's KPI record
      let kpiRecord = await this.prisma.kPIMetrics.findFirst({
        where: { date: today }
      });

      if (!kpiRecord) {
        kpiRecord = await this.prisma.kPIMetrics.create({
          data: {
            date: today,
            scheduleSuccessRate: 0,
            averageFairnessScore: 0,
            constraintViolationRate: 0,
            userSatisfactionScore: 0,
            conflictResolutionTime: 0,
            metadata: {
              fairnessScores: [],
              totalFairness: 0
            }
          }
        });
      }

      // Update fairness metrics
      const metadata = kpiRecord.metadata as any || {};
      metadata.fairnessScores = metadata.fairnessScores || [];
      metadata.fairnessScores.push(score);
      metadata.totalFairness = (metadata.totalFairness || 0) + score;

      const averageFairness = metadata.totalFairness / metadata.fairnessScores.length;

      await this.prisma.kPIMetrics.update({
        where: { id: kpiRecord.id },
        data: {
          averageFairnessScore: averageFairness,
          metadata
        }
      });

      // Also store in fairness metrics table
      await this.prisma.fairnessMetrics.create({
        data: {
          date: today,
          overallScore: averageFairness,
          workloadFairness: score, // Simplified - would need more detailed calculation
          weekendFairness: score,
          assignmentFairness: score,
          confidenceScore: 0.8, // Default confidence
          metadata: {
            scoreCount: metadata.fairnessScores.length,
            latestScore: score
          }
        }
      });

    } catch (error) {
      console.error('Error tracking fairness score:', error);
    }
  }

  /**
   * Track constraint violation
   */
  async trackConstraintViolation(violation: ConstraintViolation): Promise<void> {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Get or create today's KPI record
      let kpiRecord = await this.prisma.kPIMetrics.findFirst({
        where: { date: today }
      });

      if (!kpiRecord) {
        kpiRecord = await this.prisma.kPIMetrics.create({
          data: {
            date: today,
            scheduleSuccessRate: 0,
            averageFairnessScore: 0,
            constraintViolationRate: 0,
            userSatisfactionScore: 0,
            conflictResolutionTime: 0,
            metadata: {
              violations: [],
              totalViolations: 0
            }
          }
        });
      }

      // Update violation metrics
      const metadata = kpiRecord.metadata as any || {};
      metadata.violations = metadata.violations || [];
      metadata.violations.push(violation);
      metadata.totalViolations = (metadata.totalViolations || 0) + 1;

      // Calculate violation rate (simplified - would need total constraints)
      const violationRate = Math.min(1, metadata.totalViolations / 100); // Assume 100 total constraints per day

      await this.prisma.kPIMetrics.update({
        where: { id: kpiRecord.id },
        data: {
          constraintViolationRate: violationRate,
          metadata
        }
      });

    } catch (error) {
      console.error('Error tracking constraint violation:', error);
    }
  }

  /**
   * Track user satisfaction
   */
  async trackUserSatisfaction(score: number, feedback: string): Promise<void> {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Get or create today's KPI record
      let kpiRecord = await this.prisma.kPIMetrics.findFirst({
        where: { date: today }
      });

      if (!kpiRecord) {
        kpiRecord = await this.prisma.kPIMetrics.create({
          data: {
            date: today,
            scheduleSuccessRate: 0,
            averageFairnessScore: 0,
            constraintViolationRate: 0,
            userSatisfactionScore: 0,
            conflictResolutionTime: 0,
            metadata: {
              satisfactionScores: [],
              totalSatisfaction: 0,
              feedback: []
            }
          }
        });
      }

      // Update satisfaction metrics
      const metadata = kpiRecord.metadata as any || {};
      metadata.satisfactionScores = metadata.satisfactionScores || [];
      metadata.satisfactionScores.push(score);
      metadata.totalSatisfaction = (metadata.totalSatisfaction || 0) + score;
      metadata.feedback = metadata.feedback || [];
      metadata.feedback.push({ score, feedback, timestamp: new Date() });

      const averageSatisfaction = metadata.totalSatisfaction / metadata.satisfactionScores.length;

      await this.prisma.kPIMetrics.update({
        where: { id: kpiRecord.id },
        data: {
          userSatisfactionScore: averageSatisfaction,
          metadata
        }
      });

    } catch (error) {
      console.error('Error tracking user satisfaction:', error);
    }
  }

  /**
   * Generate KPI report for a time range
   */
  async generateKPIReport(timeRange: { startDate: Date; endDate: Date }): Promise<KPIReport> {
    try {
      // Get KPI data for the time range
      const kpiData = await this.prisma.kPIMetrics.findMany({
        where: {
          date: {
            gte: timeRange.startDate,
            lte: timeRange.endDate
          }
        },
        orderBy: { date: 'asc' }
      });

      if (kpiData.length === 0) {
        return {
          timeRange,
          metrics: {
            scheduleSuccessRate: 0,
            averageFairnessScore: 0,
            constraintViolationRate: 0,
            userSatisfactionScore: 0,
            conflictResolutionTime: 0,
            lastUpdated: new Date(),
            trend: 'STABLE'
          },
          trends: {
            scheduleSuccess: 'STABLE',
            fairness: 'STABLE',
            violations: 'STABLE',
            satisfaction: 'STABLE',
            resolutionTime: 'STABLE'
          },
          alerts: ['No KPI data available for the specified time range'],
          recommendations: ['Start tracking KPIs to generate meaningful reports']
        };
      }

      // Calculate averages
      const avgScheduleSuccess = kpiData.reduce((sum: number, kpi: any) => sum + Number(kpi.scheduleSuccessRate), 0) / kpiData.length;
      const avgFairness = kpiData.reduce((sum: number, kpi: any) => sum + Number(kpi.averageFairnessScore), 0) / kpiData.length;
      const avgViolations = kpiData.reduce((sum: number, kpi: any) => sum + Number(kpi.constraintViolationRate), 0) / kpiData.length;
      const avgSatisfaction = kpiData.reduce((sum: number, kpi: any) => sum + Number(kpi.userSatisfactionScore), 0) / kpiData.length;
      const avgResolutionTime = kpiData.reduce((sum: number, kpi: any) => sum + Number(kpi.conflictResolutionTime), 0) / kpiData.length;

      // Calculate trends
      const trends = this.calculateTrends(kpiData);

      // Generate alerts
      const alerts = this.generateAlertsFromMetrics({
        scheduleSuccess: avgScheduleSuccess,
        fairness: avgFairness,
        violations: avgViolations,
        satisfaction: avgSatisfaction,
        resolutionTime: avgResolutionTime
      });

      // Generate recommendations
      const recommendations = this.generateRecommendations({
        scheduleSuccess: avgScheduleSuccess,
        fairness: avgFairness,
        violations: avgViolations,
        satisfaction: avgSatisfaction,
        resolutionTime: avgResolutionTime
      });

      return {
        timeRange,
        metrics: {
          scheduleSuccessRate: avgScheduleSuccess,
          averageFairnessScore: avgFairness,
          constraintViolationRate: avgViolations,
          userSatisfactionScore: avgSatisfaction,
          conflictResolutionTime: avgResolutionTime,
          lastUpdated: new Date(),
          trend: this.calculateOverallTrend(trends)
        },
        trends,
        alerts,
        recommendations
      };

    } catch (error) {
      console.error('Error generating KPI report:', error);
      throw new Error('Failed to generate KPI report');
    }
  }

  /**
   * Get current KPI metrics
   */
  async getCurrentKPIMetrics(): Promise<KPIMetrics> {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Try to get from cache first
      const cached = await this.cache.get(`kpi:${today.toISOString().split('T')[0]}`) as any;
      if (cached) {
        return {
          scheduleSuccessRate: cached.scheduleSuccessRate || 0,
          averageFairnessScore: cached.averageFairnessScore || 0,
          constraintViolationRate: cached.constraintViolationRate || 0,
          userSatisfactionScore: cached.userSatisfactionScore || 0,
          conflictResolutionTime: cached.conflictResolutionTime || 0,
          lastUpdated: new Date(),
          trend: 'STABLE' as const // Would need to calculate from historical data
        };
      }

      // Get from database
      const kpiRecord = await this.prisma.kPIMetrics.findFirst({
        where: { date: today }
      });

      if (!kpiRecord) {
        return {
          scheduleSuccessRate: 0,
          averageFairnessScore: 0,
          constraintViolationRate: 0,
          userSatisfactionScore: 0,
          conflictResolutionTime: 0,
          lastUpdated: new Date(),
          trend: 'STABLE' as const
        };
      }

      return {
        scheduleSuccessRate: Number(kpiRecord.scheduleSuccessRate),
        averageFairnessScore: Number(kpiRecord.averageFairnessScore),
        constraintViolationRate: Number(kpiRecord.constraintViolationRate),
        userSatisfactionScore: Number(kpiRecord.userSatisfactionScore),
        conflictResolutionTime: Number(kpiRecord.conflictResolutionTime),
        lastUpdated: new Date(),
        trend: 'STABLE' // Would need to calculate from historical data
      };

    } catch (error) {
      console.error('Error getting current KPI metrics:', error);
      throw new Error('Failed to get current KPI metrics');
    }
  }

  /**
   * Get benchmark comparison
   */
  async getBenchmarkComparison(): Promise<BenchmarkComparison[]> {
    try {
      const currentMetrics = await this.getCurrentKPIMetrics();

      // Industry benchmarks (these would come from research or config)
      const benchmarks = {
        scheduleSuccessRate: 0.95,
        averageFairnessScore: 0.8,
        constraintViolationRate: 0.05,
        userSatisfactionScore: 8.0,
        conflictResolutionTime: 24.0
      };

      const comparisons: BenchmarkComparison[] = [];

      // Schedule Success Rate
      comparisons.push({
        metric: 'Schedule Success Rate',
        currentValue: currentMetrics.scheduleSuccessRate,
        industryAverage: benchmarks.scheduleSuccessRate,
        percentile: this.calculatePercentile(currentMetrics.scheduleSuccessRate, benchmarks.scheduleSuccessRate),
        status: this.getStatus(currentMetrics.scheduleSuccessRate, benchmarks.scheduleSuccessRate, true),
        improvement: benchmarks.scheduleSuccessRate - currentMetrics.scheduleSuccessRate
      });

      // Fairness Score
      comparisons.push({
        metric: 'Average Fairness Score',
        currentValue: currentMetrics.averageFairnessScore,
        industryAverage: benchmarks.averageFairnessScore,
        percentile: this.calculatePercentile(currentMetrics.averageFairnessScore, benchmarks.averageFairnessScore),
        status: this.getStatus(currentMetrics.averageFairnessScore, benchmarks.averageFairnessScore, true),
        improvement: benchmarks.averageFairnessScore - currentMetrics.averageFairnessScore
      });

      // Constraint Violation Rate (lower is better)
      comparisons.push({
        metric: 'Constraint Violation Rate',
        currentValue: currentMetrics.constraintViolationRate,
        industryAverage: benchmarks.constraintViolationRate,
        percentile: this.calculatePercentile(currentMetrics.constraintViolationRate, benchmarks.constraintViolationRate),
        status: this.getStatus(currentMetrics.constraintViolationRate, benchmarks.constraintViolationRate, false),
        improvement: currentMetrics.constraintViolationRate - benchmarks.constraintViolationRate
      });

      // User Satisfaction
      comparisons.push({
        metric: 'User Satisfaction Score',
        currentValue: currentMetrics.userSatisfactionScore,
        industryAverage: benchmarks.userSatisfactionScore,
        percentile: this.calculatePercentile(currentMetrics.userSatisfactionScore, benchmarks.userSatisfactionScore),
        status: this.getStatus(currentMetrics.userSatisfactionScore, benchmarks.userSatisfactionScore, true),
        improvement: benchmarks.userSatisfactionScore - currentMetrics.userSatisfactionScore
      });

      // Conflict Resolution Time (lower is better)
      comparisons.push({
        metric: 'Conflict Resolution Time (hours)',
        currentValue: currentMetrics.conflictResolutionTime,
        industryAverage: benchmarks.conflictResolutionTime,
        percentile: this.calculatePercentile(currentMetrics.conflictResolutionTime, benchmarks.conflictResolutionTime),
        status: this.getStatus(currentMetrics.conflictResolutionTime, benchmarks.conflictResolutionTime, false),
        improvement: currentMetrics.conflictResolutionTime - benchmarks.conflictResolutionTime
      });

      return comparisons;

    } catch (error) {
      console.error('Error getting benchmark comparison:', error);
      throw new Error('Failed to get benchmark comparison');
    }
  }

  /**
   * Get KPI history for trend analysis
   */
  async getKPIHistory(timeRange: { startDate: Date; endDate: Date }): Promise<KPIMetrics[]> {
    try {
      const kpiData = await this.prisma.kPIMetrics.findMany({
        where: {
          date: {
            gte: timeRange.startDate,
            lte: timeRange.endDate
          }
        },
        orderBy: { date: 'asc' }
      });

      return kpiData.map((kpi: any) => ({
        scheduleSuccessRate: Number(kpi.scheduleSuccessRate),
        averageFairnessScore: Number(kpi.averageFairnessScore),
        constraintViolationRate: Number(kpi.constraintViolationRate),
        userSatisfactionScore: Number(kpi.userSatisfactionScore),
        conflictResolutionTime: Number(kpi.conflictResolutionTime),
        lastUpdated: kpi.createdAt,
        trend: 'STABLE' as const // Would be calculated from historical data
      }));
    } catch (error) {
      console.error('Error getting KPI history:', error);
      throw new Error('Failed to get KPI history');
    }
  }

  /**
   * Generate automated alerts for KPI threshold breaches
   */
  async generateAlerts(): Promise<string[]> {
    try {
      const currentMetrics = await this.getCurrentKPIMetrics();
      const alerts: string[] = [];

      // Schedule Success Rate alerts
      if (currentMetrics.scheduleSuccessRate < 0.90) {
        alerts.push(`⚠️ Schedule success rate (${(currentMetrics.scheduleSuccessRate * 100).toFixed(1)}%) is below target (90%)`);
      }

      // Fairness Score alerts
      if (currentMetrics.averageFairnessScore < 0.75) {
        alerts.push(`⚠️ Average fairness score (${(currentMetrics.averageFairnessScore * 100).toFixed(1)}%) is below target (75%)`);
      }

      // Constraint Violation Rate alerts
      if (currentMetrics.constraintViolationRate > 0.10) {
        alerts.push(`⚠️ Constraint violation rate (${(currentMetrics.constraintViolationRate * 100).toFixed(1)}%) is above target (10%)`);
      }

      // User Satisfaction alerts
      if (currentMetrics.userSatisfactionScore < 7.0) {
        alerts.push(`⚠️ User satisfaction score (${currentMetrics.userSatisfactionScore.toFixed(1)}) is below target (7.0)`);
      }

      // Conflict Resolution Time alerts
      if (currentMetrics.conflictResolutionTime > 48) {
        alerts.push(`⚠️ Conflict resolution time (${currentMetrics.conflictResolutionTime.toFixed(1)}h) is above target (48h)`);
      }

      return alerts;
    } catch (error) {
      console.error('Error generating alerts:', error);
      // Return empty alerts array instead of throwing
      return [];
    }
  }

  /**
   * Get performance trends for the last 30 days
   */
  async getPerformanceTrends(): Promise<{
    scheduleSuccess: { date: string; value: number }[];
    fairness: { date: string; value: number }[];
    violations: { date: string; value: number }[];
    satisfaction: { date: string; value: number }[];
    resolutionTime: { date: string; value: number }[];
  }> {
    try {
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(endDate.getDate() - 30);

      const kpiHistory = await this.getKPIHistory({ startDate, endDate });

      return {
        scheduleSuccess: kpiHistory.map(kpi => ({
          date: kpi.lastUpdated.toISOString().split('T')[0],
          value: kpi.scheduleSuccessRate
        })),
        fairness: kpiHistory.map(kpi => ({
          date: kpi.lastUpdated.toISOString().split('T')[0],
          value: kpi.averageFairnessScore
        })),
        violations: kpiHistory.map(kpi => ({
          date: kpi.lastUpdated.toISOString().split('T')[0],
          value: kpi.constraintViolationRate
        })),
        satisfaction: kpiHistory.map(kpi => ({
          date: kpi.lastUpdated.toISOString().split('T')[0],
          value: kpi.userSatisfactionScore
        })),
        resolutionTime: kpiHistory.map(kpi => ({
          date: kpi.lastUpdated.toISOString().split('T')[0],
          value: kpi.conflictResolutionTime
        }))
      };
    } catch (error) {
      console.error('Error getting performance trends:', error);
      throw new Error('Failed to get performance trends');
    }
  }

  /**
   * Get comprehensive KPI summary for dashboard
   */
  async getKPISummary(): Promise<{
    currentMetrics: KPIMetrics;
    trends: 'IMPROVING' | 'STABLE' | 'DETERIORATING';
    alerts: string[];
    benchmarks: BenchmarkComparison[];
    performanceHealth: 'EXCELLENT' | 'GOOD' | 'AVERAGE' | 'POOR';
  }> {
    try {
      const [currentMetrics, alerts, benchmarks, trends] = await Promise.all([
        this.getCurrentKPIMetrics(),
        this.generateAlerts(),
        this.getBenchmarkComparison(),
        this.getPerformanceTrends()
      ]);

      // Calculate overall trend
      const trendDirection = this.calculateOverallTrendFromData(trends);
      
      // Calculate performance health
      const performanceHealth = this.calculatePerformanceHealth(currentMetrics, benchmarks);

      return {
        currentMetrics,
        trends: trendDirection,
        alerts,
        benchmarks,
        performanceHealth
      };
    } catch (error) {
      console.error('Error getting KPI summary:', error);
      throw new Error('Failed to get KPI summary');
    }
  }

  // Private helper methods

  private calculateTrends(kpiData: any[]) {
    if (kpiData.length < 2) {
      return {
        scheduleSuccess: 'STABLE' as const,
        fairness: 'STABLE' as const,
        violations: 'STABLE' as const,
        satisfaction: 'STABLE' as const,
        resolutionTime: 'STABLE' as const
      };
    }

    const firstHalf = kpiData.slice(0, Math.floor(kpiData.length / 2));
    const secondHalf = kpiData.slice(Math.floor(kpiData.length / 2));

    const avgFirst = {
      scheduleSuccess: firstHalf.reduce((sum, kpi) => sum + Number(kpi.scheduleSuccessRate), 0) / firstHalf.length,
      fairness: firstHalf.reduce((sum, kpi) => sum + Number(kpi.averageFairnessScore), 0) / firstHalf.length,
      violations: firstHalf.reduce((sum, kpi) => sum + Number(kpi.constraintViolationRate), 0) / firstHalf.length,
      satisfaction: firstHalf.reduce((sum, kpi) => sum + Number(kpi.userSatisfactionScore), 0) / firstHalf.length,
      resolutionTime: firstHalf.reduce((sum, kpi) => sum + Number(kpi.conflictResolutionTime), 0) / firstHalf.length
    };

    const avgSecond = {
      scheduleSuccess: secondHalf.reduce((sum, kpi) => sum + Number(kpi.scheduleSuccessRate), 0) / secondHalf.length,
      fairness: secondHalf.reduce((sum, kpi) => sum + Number(kpi.averageFairnessScore), 0) / secondHalf.length,
      violations: secondHalf.reduce((sum, kpi) => sum + Number(kpi.constraintViolationRate), 0) / secondHalf.length,
      satisfaction: secondHalf.reduce((sum, kpi) => sum + Number(kpi.userSatisfactionScore), 0) / secondHalf.length,
      resolutionTime: secondHalf.reduce((sum, kpi) => sum + Number(kpi.conflictResolutionTime), 0) / secondHalf.length
    };

    return {
      scheduleSuccess: this.determineTrend(avgFirst.scheduleSuccess, avgSecond.scheduleSuccess),
      fairness: this.determineTrend(avgFirst.fairness, avgSecond.fairness),
      violations: this.determineTrend(avgFirst.violations, avgSecond.violations),
      satisfaction: this.determineTrend(avgFirst.satisfaction, avgSecond.satisfaction),
      resolutionTime: this.determineTrend(avgFirst.resolutionTime, avgSecond.resolutionTime)
    };
  }

  private determineTrend(first: number, second: number): 'IMPROVING' | 'STABLE' | 'DETERIORATING' {
    const diff = second - first;
    if (Math.abs(diff) < 0.05) return 'STABLE';
    return diff > 0 ? 'IMPROVING' : 'DETERIORATING';
  }

  private calculateOverallTrend(trends: any): 'IMPROVING' | 'STABLE' | 'DETERIORATING' {
    const trendCounts = {
      IMPROVING: 0,
      STABLE: 0,
      DETERIORATING: 0
    };

    Object.values(trends).forEach((trend: any) => {
      trendCounts[trend as keyof typeof trendCounts]++;
    });

    if (trendCounts.IMPROVING > trendCounts.DETERIORATING) return 'IMPROVING';
    if (trendCounts.DETERIORATING > trendCounts.IMPROVING) return 'DETERIORATING';
    return 'STABLE';
  }

  private generateAlertsFromMetrics(metrics: any): string[] {
    const alerts: string[] = [];

    if (metrics.scheduleSuccess < 0.9) {
      alerts.push('Schedule generation success rate is below target (90%)');
    }

    if (metrics.fairness < 0.7) {
      alerts.push('Fairness score is below acceptable threshold (70%)');
    }

    if (metrics.violations > 0.1) {
      alerts.push('Constraint violation rate is above acceptable level (10%)');
    }

    if (metrics.satisfaction < 7.0) {
      alerts.push('User satisfaction score is below target (7.0/10)');
    }

    if (metrics.resolutionTime > 48) {
      alerts.push('Conflict resolution time is above target (48 hours)');
    }

    return alerts;
  }

  private generateRecommendations(metrics: any): string[] {
    const recommendations: string[] = [];

    if (metrics.scheduleSuccess < 0.9) {
      recommendations.push('Review scheduling algorithm performance and constraints');
      recommendations.push('Consider adding more flexible constraint handling');
    }

    if (metrics.fairness < 0.7) {
      recommendations.push('Implement fairness optimization in scheduling algorithm');
      recommendations.push('Review workload distribution patterns');
    }

    if (metrics.violations > 0.1) {
      recommendations.push('Review constraint definitions and priorities');
      recommendations.push('Implement better constraint validation');
    }

    if (metrics.satisfaction < 7.0) {
      recommendations.push('Gather user feedback to identify improvement areas');
      recommendations.push('Review user interface and workflow');
    }

    if (metrics.resolutionTime > 48) {
      recommendations.push('Implement automated conflict resolution');
      recommendations.push('Improve conflict detection and notification system');
    }

    return recommendations;
  }

  private calculatePercentile(current: number, benchmark: number): number {
    // Simplified percentile calculation
    const ratio = current / benchmark;
    if (ratio >= 1.2) return 95;
    if (ratio >= 1.1) return 85;
    if (ratio >= 1.0) return 75;
    if (ratio >= 0.9) return 60;
    if (ratio >= 0.8) return 40;
    if (ratio >= 0.7) return 25;
    return 10;
  }

  private getStatus(current: number, benchmark: number, higherIsBetter: boolean): 'EXCELLENT' | 'GOOD' | 'AVERAGE' | 'BELOW_AVERAGE' | 'POOR' {
    const ratio = current / benchmark;
    
    if (higherIsBetter) {
      if (ratio >= 1.2) return 'EXCELLENT';
      if (ratio >= 1.1) return 'GOOD';
      if (ratio >= 1.0) return 'AVERAGE';
      if (ratio >= 0.9) return 'BELOW_AVERAGE';
      return 'POOR';
    } else {
      if (ratio <= 0.8) return 'EXCELLENT';
      if (ratio <= 0.9) return 'GOOD';
      if (ratio <= 1.0) return 'AVERAGE';
      if (ratio <= 1.1) return 'BELOW_AVERAGE';
      return 'POOR';
    }
  }

  private calculateOverallTrendFromData(trends: any): 'IMPROVING' | 'STABLE' | 'DETERIORATING' {
    // Simple trend calculation based on recent data
    const recentData = trends.scheduleSuccess.slice(-7); // Last 7 days
    if (recentData.length < 2) return 'STABLE';
    
    const firstHalf = recentData.slice(0, Math.floor(recentData.length / 2));
    const secondHalf = recentData.slice(Math.floor(recentData.length / 2));
    
    const avgFirst = firstHalf.reduce((sum: number, item: any) => sum + item.value, 0) / firstHalf.length;
    const avgSecond = secondHalf.reduce((sum: number, item: any) => sum + item.value, 0) / secondHalf.length;
    
    const change = avgSecond - avgFirst;
    
    if (change > 0.05) return 'IMPROVING';
    if (change < -0.05) return 'DETERIORATING';
    return 'STABLE';
  }

  private calculatePerformanceHealth(metrics: KPIMetrics, benchmarks: BenchmarkComparison[]): 'EXCELLENT' | 'GOOD' | 'AVERAGE' | 'POOR' {
    let excellentCount = 0;
    let goodCount = 0;
    let averageCount = 0;
    let poorCount = 0;

    benchmarks.forEach(benchmark => {
      switch (benchmark.status) {
        case 'EXCELLENT':
          excellentCount++;
          break;
        case 'GOOD':
          goodCount++;
          break;
        case 'AVERAGE':
          averageCount++;
          break;
        case 'BELOW_AVERAGE':
        case 'POOR':
          poorCount++;
          break;
      }
    });

    const total = benchmarks.length;
    
    if (excellentCount >= total * 0.6) return 'EXCELLENT';
    if (excellentCount + goodCount >= total * 0.8) return 'GOOD';
    if (poorCount <= total * 0.2) return 'AVERAGE';
    return 'POOR';
  }
} 