import { PrismaClient } from '@prisma/client';
import { cacheService } from '../lib/cache';

export interface LeaveRequest {
  id: string;
  analystId: string;
  startDate: Date;
  endDate: Date;
  reason?: string;
}

export interface LeaveRequestImpact {
  requestId: string;
  analystId: string;
  startDate: Date;
  endDate: Date;
  fairnessImpact: {
    beforeScore: number;
    afterScore: number;
    change: number;
    riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  };
  recommendations: string[];
  alternativeDates?: Date[];
  metadata?: any;
}

export interface FairnessTrend {
  currentScore: number;
  predictedScore: number;
  trend: 'IMPROVING' | 'STABLE' | 'DETERIORATING';
  confidence: number;
  riskFactors: string[];
  mitigationStrategies: string[];
  timeRange: {
    startDate: Date;
    endDate: Date;
  };
}

export interface FairnessRecommendation {
  id: string;
  type: 'WORKLOAD_BALANCE' | 'WEEKEND_ROTATION' | 'SCREENER_DISTRIBUTION' | 'CONSECUTIVE_DAYS';
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  description: string;
  expectedImprovement: number;
  confidence: number;
  affectedAnalysts: string[];
  suggestedActions: string[];
}

export interface FairnessAnomaly {
  id: string;
  type: 'UNUSUAL_WORKLOAD' | 'WEEKEND_IMBALANCE' | 'SCREENER_OVERLOAD' | 'FAIRNESS_DROP';
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  description: string;
  detectedAt: Date;
  affectedAnalysts: string[];
  impact: number;
  recommendations: string[];
}

export class PredictiveFairnessService {
  private prisma: PrismaClient;
  private cache: typeof cacheService;

  constructor(prisma: PrismaClient, cache: typeof cacheService) {
    this.prisma = prisma;
    this.cache = cache;
  }

  /**
   * Calculate the impact of a leave request on fairness
   */
  async calculateLeaveRequestImpact(request: LeaveRequest): Promise<LeaveRequestImpact> {
    try {
      // Get current fairness metrics
      const currentFairness = await this.getCurrentFairnessScore();
      
      // Simulate the schedule without this analyst
      const simulatedSchedule = await this.simulateScheduleWithoutAnalyst(
        request.analystId,
        request.startDate,
        request.endDate
      );
      
      // Calculate fairness after the leave
      const afterFairness = await this.calculateFairnessFromSchedule(simulatedSchedule);
      
      // Calculate impact
      const impact = currentFairness - afterFairness;
      const riskLevel = this.calculateRiskLevel(impact);
      
      // Generate recommendations
      const recommendations = await this.generateLeaveRecommendations(request, impact);
      
      // Find alternative dates if high risk
      const alternativeDates = riskLevel === 'HIGH' 
        ? await this.findAlternativeDates(request)
        : undefined;

      return {
        requestId: request.id,
        analystId: request.analystId,
        startDate: request.startDate,
        endDate: request.endDate,
        fairnessImpact: {
          beforeScore: currentFairness,
          afterScore: afterFairness,
          change: impact,
          riskLevel
        },
        recommendations,
        alternativeDates,
        metadata: {
          requestReason: request.reason,
          calculatedAt: new Date()
        }
      };
    } catch (error) {
      console.error('Error calculating leave request impact:', error);
      throw new Error('Failed to calculate leave request impact');
    }
  }

  /**
   * Predict fairness trends for the next 4 weeks
   */
  async predictFairnessTrend(timeRange: { startDate: Date; endDate: Date }): Promise<FairnessTrend> {
    try {
      // Get historical fairness data
      const historicalData = await this.getHistoricalFairnessData(timeRange);
      
      // Calculate current fairness
      const currentScore = await this.getCurrentFairnessScore();
      
      // Use simple linear regression for prediction
      const predictedScore = this.predictLinearTrend(historicalData, currentScore);
      
      // Determine trend direction
      const trend = this.determineTrendDirection(currentScore, predictedScore);
      
      // Calculate confidence based on data consistency
      const confidence = this.calculatePredictionConfidence(historicalData);
      
      // Identify risk factors
      const riskFactors = await this.identifyRiskFactors(timeRange);
      
      // Generate mitigation strategies
      const mitigationStrategies = await this.generateMitigationStrategies(riskFactors);

      return {
        currentScore,
        predictedScore,
        trend,
        confidence,
        riskFactors,
        mitigationStrategies,
        timeRange
      };
    } catch (error) {
      console.error('Error predicting fairness trend:', error);
      throw new Error('Failed to predict fairness trend');
    }
  }

  /**
   * Generate fairness improvement recommendations
   */
  async generateFairnessRecommendations(): Promise<FairnessRecommendation[]> {
    try {
      const recommendations: FairnessRecommendation[] = [];
      
      // Analyze workload distribution
      const workloadAnalysis = await this.analyzeWorkloadDistribution();
      if (workloadAnalysis.imbalance > 0.2) {
        recommendations.push({
          id: `workload_${Date.now()}`,
          type: 'WORKLOAD_BALANCE',
          priority: workloadAnalysis.imbalance > 0.4 ? 'HIGH' : 'MEDIUM',
          description: `Workload imbalance detected with ${(workloadAnalysis.imbalance * 100).toFixed(1)}% variance`,
          expectedImprovement: workloadAnalysis.imbalance * 0.8,
          confidence: 0.85,
          affectedAnalysts: workloadAnalysis.overloadedAnalysts,
          suggestedActions: [
            'Redistribute workload among analysts',
            'Consider temporary analyst assignments',
            'Review shift allocation patterns'
          ]
        });
      }
      
      // Analyze weekend rotation
      const weekendAnalysis = await this.analyzeWeekendRotation();
      if (weekendAnalysis.unfairness > 0.15) {
        recommendations.push({
          id: `weekend_${Date.now()}`,
          type: 'WEEKEND_ROTATION',
          priority: weekendAnalysis.unfairness > 0.3 ? 'HIGH' : 'MEDIUM',
          description: `Weekend rotation unfairness detected with ${(weekendAnalysis.unfairness * 100).toFixed(1)}% variance`,
          expectedImprovement: weekendAnalysis.unfairness * 0.7,
          confidence: 0.9,
          affectedAnalysts: weekendAnalysis.overloadedAnalysts,
          suggestedActions: [
            'Implement fair weekend rotation algorithm',
            'Balance weekend assignments across analysts',
            'Consider weekend preference system'
          ]
        });
      }
      
      // Analyze screener distribution
      const screenerAnalysis = await this.analyzeScreenerDistribution();
      if (screenerAnalysis.unfairness > 0.2) {
        recommendations.push({
          id: `screener_${Date.now()}`,
          type: 'SCREENER_DISTRIBUTION',
          priority: screenerAnalysis.unfairness > 0.4 ? 'HIGH' : 'MEDIUM',
          description: `Screener assignment unfairness detected with ${(screenerAnalysis.unfairness * 100).toFixed(1)}% variance`,
          expectedImprovement: screenerAnalysis.unfairness * 0.75,
          confidence: 0.88,
          affectedAnalysts: screenerAnalysis.overloadedAnalysts,
          suggestedActions: [
            'Implement fair screener selection algorithm',
            'Rotate screener assignments more evenly',
            'Consider screener preference system'
          ]
        });
      }

      return recommendations;
    } catch (error) {
      console.error('Error generating fairness recommendations:', error);
      throw new Error('Failed to generate fairness recommendations');
    }
  }

  /**
   * Analyze fairness anomalies
   */
  async analyzeFairnessAnomalies(): Promise<FairnessAnomaly[]> {
    try {
      const anomalies: FairnessAnomaly[] = [];
      
      // Check for unusual workload patterns
      const workloadAnomalies = await this.detectWorkloadAnomalies();
      anomalies.push(...workloadAnomalies);
      
      // Check for weekend imbalances
      const weekendAnomalies = await this.detectWeekendAnomalies();
      anomalies.push(...weekendAnomalies);
      
      // Check for fairness score drops
      const fairnessDrops = await this.detectFairnessDrops();
      anomalies.push(...fairnessDrops);

      return anomalies;
    } catch (error) {
      console.error('Error analyzing fairness anomalies:', error);
      throw new Error('Failed to analyze fairness anomalies');
    }
  }

  // Private helper methods

  private async getCurrentFairnessScore(): Promise<number> {
    // Get the most recent fairness metric or calculate from current schedule
    const latestMetric = await this.prisma.fairnessMetrics.findFirst({
      orderBy: { date: 'desc' }
    });

    if (latestMetric) {
      return Number(latestMetric.overallScore);
    }

    // Calculate from current schedule if no metric exists
    return await this.calculateCurrentFairness();
  }

  private async calculateCurrentFairness(): Promise<number> {
    // Get current month's schedules
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    const schedules = await this.prisma.schedule.findMany({
      where: {
        date: {
          gte: startOfMonth,
          lte: endOfMonth
        }
      },
      include: {
        analyst: true
      }
    });

    // Calculate workload distribution
    const workloadByAnalyst = new Map<string, number>();
    schedules.forEach((schedule: any) => {
      const current = workloadByAnalyst.get(schedule.analystId) || 0;
      workloadByAnalyst.set(schedule.analystId, current + 1);
    });

    const workloads = Array.from(workloadByAnalyst.values());
    return this.calculateGiniCoefficient(workloads);
  }

  private async simulateScheduleWithoutAnalyst(
    analystId: string, 
    startDate: Date, 
    endDate: Date
  ): Promise<any[]> {
    // Get schedules for the period
    const schedules = await this.prisma.schedule.findMany({
      where: {
        date: {
          gte: startDate,
          lte: endDate
        },
        analystId: {
          not: analystId
        }
      },
      include: {
        analyst: true
      }
    });

    return schedules;
  }

  private async calculateFairnessFromSchedule(schedules: any[]): Promise<number> {
    if (schedules.length === 0) return 0;

    const workloadByAnalyst = new Map<string, number>();
    schedules.forEach((schedule: any) => {
      const current = workloadByAnalyst.get(schedule.analystId) || 0;
      workloadByAnalyst.set(schedule.analystId, current + 1);
    });

    const workloads = Array.from(workloadByAnalyst.values());
    return this.calculateGiniCoefficient(workloads);
  }

  private calculateRiskLevel(impact: number): 'LOW' | 'MEDIUM' | 'HIGH' {
    if (Math.abs(impact) < 0.1) return 'LOW';
    if (Math.abs(impact) < 0.25) return 'MEDIUM';
    return 'HIGH';
  }

  private async generateLeaveRecommendations(
    request: LeaveRequest, 
    impact: number
  ): Promise<string[]> {
    const recommendations: string[] = [];

    if (impact > 0.2) {
      recommendations.push('Consider redistributing workload during this period');
      recommendations.push('Review other analysts\' availability for coverage');
    }

    if (impact > 0.1) {
      recommendations.push('Monitor fairness metrics during this period');
    }

    if (impact < -0.1) {
      recommendations.push('This leave may actually improve fairness balance');
    }

    return recommendations;
  }

  private async findAlternativeDates(request: LeaveRequest): Promise<Date[]> {
    // Simple implementation - find dates with lower impact
    const alternatives: Date[] = [];
    const currentDate = new Date(request.startDate);
    
    // Check next 2 weeks for better dates
    for (let i = 0; i < 14; i++) {
      const testDate = new Date(currentDate);
      testDate.setDate(testDate.getDate() + i);
      
      // Simple heuristic - avoid weekends and busy periods
      const dayOfWeek = testDate.getDay();
      if (dayOfWeek !== 0 && dayOfWeek !== 6) { // Not Sunday or Saturday
        alternatives.push(testDate);
      }
    }

    return alternatives.slice(0, 3); // Return top 3 alternatives
  }

  private async getHistoricalFairnessData(timeRange: { startDate: Date; endDate: Date }) {
    return await this.prisma.fairnessMetrics.findMany({
      where: {
        date: {
          gte: timeRange.startDate,
          lte: timeRange.endDate
        }
      },
      orderBy: { date: 'asc' }
    });
  }

  private predictLinearTrend(historicalData: any[], currentScore: number): number {
    if (historicalData.length < 2) return currentScore;

    // Simple linear regression
    const n = historicalData.length;
    const sumX = n * (n + 1) / 2;
    const sumY = historicalData.reduce((sum, data) => sum + Number(data.overallScore), 0);
    const sumXY = historicalData.reduce((sum, data, i) => sum + (i + 1) * Number(data.overallScore), 0);
    const sumXX = n * (n + 1) * (2 * n + 1) / 6;

    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;

    // Predict next value
    return Math.max(0, Math.min(1, intercept + slope * (n + 1)));
  }

  private determineTrendDirection(current: number, predicted: number): 'IMPROVING' | 'STABLE' | 'DETERIORATING' {
    const diff = predicted - current;
    if (Math.abs(diff) < 0.05) return 'STABLE';
    return diff > 0 ? 'IMPROVING' : 'DETERIORATING';
  }

  private calculatePredictionConfidence(historicalData: any[]): number {
    if (historicalData.length < 3) return 0.5;

    // Calculate variance in recent data
    const recentScores = historicalData.slice(-5).map(d => Number(d.overallScore));
    const mean = recentScores.reduce((sum, score) => sum + score, 0) / recentScores.length;
    const variance = recentScores.reduce((sum, score) => sum + Math.pow(score - mean, 2), 0) / recentScores.length;
    
    // Lower variance = higher confidence
    return Math.max(0.3, Math.min(0.95, 1 - variance));
  }

  private async identifyRiskFactors(timeRange: { startDate: Date; endDate: Date }): Promise<string[]> {
    const factors: string[] = [];
    
    // Check for upcoming vacations
    const vacations = await this.prisma.vacation.findMany({
      where: {
        startDate: {
          gte: timeRange.startDate,
          lte: timeRange.endDate
        },
        isApproved: true
      }
    });

    if (vacations.length > 3) {
      factors.push('Multiple approved vacations in the period');
    }

    // Check for constraints
    const constraints = await this.prisma.schedulingConstraint.findMany({
      where: {
        startDate: {
          gte: timeRange.startDate,
          lte: timeRange.endDate
        },
        isActive: true
      }
    });

    if (constraints.length > 5) {
      factors.push('High number of active constraints');
    }

    return factors;
  }

  private async generateMitigationStrategies(riskFactors: string[]): Promise<string[]> {
    const strategies: string[] = [];

    if (riskFactors.some(f => f.includes('vacations'))) {
      strategies.push('Implement temporary analyst assignments');
      strategies.push('Review and optimize workload distribution');
    }

    if (riskFactors.some(f => f.includes('constraints'))) {
      strategies.push('Review constraint priorities');
      strategies.push('Consider constraint relaxation for critical periods');
    }

    return strategies;
  }

  private async analyzeWorkloadDistribution() {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    const schedules = await this.prisma.schedule.findMany({
      where: {
        date: {
          gte: startOfMonth,
          lte: endOfMonth
        }
      },
      include: {
        analyst: true
      }
    });

    const workloadByAnalyst = new Map<string, number>();
    schedules.forEach((schedule: any) => {
      const current = workloadByAnalyst.get(schedule.analystId) || 0;
      workloadByAnalyst.set(schedule.analystId, current + 1);
    });

    const workloads = Array.from(workloadByAnalyst.values());
    const imbalance = this.calculateGiniCoefficient(workloads);
    
    const avgWorkload = workloads.reduce((sum, w) => sum + w, 0) / workloads.length;
    const overloadedAnalysts = Array.from(workloadByAnalyst.entries())
      .filter(([_, workload]) => workload > avgWorkload * 1.2)
      .map(([analystId, _]) => analystId);

    return { imbalance, overloadedAnalysts };
  }

  private async analyzeWeekendRotation() {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    const weekendSchedules = await this.prisma.schedule.findMany({
      where: {
        date: {
          gte: startOfMonth,
          lte: endOfMonth
        }
      },
      include: {
        analyst: true
      }
    });

    const weekendWorkByAnalyst = new Map<string, number>();
    weekendSchedules.forEach((schedule: any) => {
      const dayOfWeek = schedule.date.getDay();
      if (dayOfWeek === 0 || dayOfWeek === 6) { // Weekend
        const current = weekendWorkByAnalyst.get(schedule.analystId) || 0;
        weekendWorkByAnalyst.set(schedule.analystId, current + 1);
      }
    });

    const weekendWorkloads = Array.from(weekendWorkByAnalyst.values());
    const unfairness = weekendWorkloads.length > 0 ? this.calculateGiniCoefficient(weekendWorkloads) : 0;
    
    const avgWeekendWork = weekendWorkloads.length > 0 
      ? weekendWorkloads.reduce((sum, w) => sum + w, 0) / weekendWorkloads.length 
      : 0;
    
    const overloadedAnalysts = Array.from(weekendWorkByAnalyst.entries())
      .filter(([_, workload]) => workload > avgWeekendWork * 1.5)
      .map(([analystId, _]) => analystId);

    return { unfairness, overloadedAnalysts };
  }

  private async analyzeScreenerDistribution() {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    const screenerSchedules = await this.prisma.schedule.findMany({
      where: {
        date: {
          gte: startOfMonth,
          lte: endOfMonth
        },
        isScreener: true
      },
      include: {
        analyst: true
      }
    });

    const screenerWorkByAnalyst = new Map<string, number>();
    screenerSchedules.forEach((schedule: any) => {
      const current = screenerWorkByAnalyst.get(schedule.analystId) || 0;
      screenerWorkByAnalyst.set(schedule.analystId, current + 1);
    });

    const screenerWorkloads = Array.from(screenerWorkByAnalyst.values());
    const unfairness = screenerWorkloads.length > 0 ? this.calculateGiniCoefficient(screenerWorkloads) : 0;
    
    const avgScreenerWork = screenerWorkloads.length > 0 
      ? screenerWorkloads.reduce((sum, w) => sum + w, 0) / screenerWorkloads.length 
      : 0;
    
    const overloadedAnalysts = Array.from(screenerWorkByAnalyst.entries())
      .filter(([_, workload]) => workload > avgScreenerWork * 1.3)
      .map(([analystId, _]) => analystId);

    return { unfairness, overloadedAnalysts };
  }

  private async detectWorkloadAnomalies(): Promise<FairnessAnomaly[]> {
    const anomalies: FairnessAnomaly[] = [];
    
    // Check for analysts with unusually high workload
    const workloadAnalysis = await this.analyzeWorkloadDistribution();
    if (workloadAnalysis.imbalance > 0.4) {
      anomalies.push({
        id: `workload_anomaly_${Date.now()}`,
        type: 'UNUSUAL_WORKLOAD',
        severity: 'HIGH',
        description: `High workload imbalance detected: ${(workloadAnalysis.imbalance * 100).toFixed(1)}%`,
        detectedAt: new Date(),
        affectedAnalysts: workloadAnalysis.overloadedAnalysts,
        impact: workloadAnalysis.imbalance,
        recommendations: [
          'Immediately redistribute workload',
          'Review scheduling algorithm',
          'Consider temporary analyst assignments'
        ]
      });
    }

    return anomalies;
  }

  private async detectWeekendAnomalies(): Promise<FairnessAnomaly[]> {
    const anomalies: FairnessAnomaly[] = [];
    
    const weekendAnalysis = await this.analyzeWeekendRotation();
    if (weekendAnalysis.unfairness > 0.3) {
      anomalies.push({
        id: `weekend_anomaly_${Date.now()}`,
        type: 'WEEKEND_IMBALANCE',
        severity: 'MEDIUM',
        description: `Weekend rotation imbalance detected: ${(weekendAnalysis.unfairness * 100).toFixed(1)}%`,
        detectedAt: new Date(),
        affectedAnalysts: weekendAnalysis.overloadedAnalysts,
        impact: weekendAnalysis.unfairness,
        recommendations: [
          'Review weekend rotation algorithm',
          'Balance weekend assignments',
          'Implement weekend preference system'
        ]
      });
    }

    return anomalies;
  }

  private async detectFairnessDrops(): Promise<FairnessAnomaly[]> {
    const anomalies: FairnessAnomaly[] = [];
    
    // Get recent fairness metrics
    const recentMetrics = await this.prisma.fairnessMetrics.findMany({
      orderBy: { date: 'desc' },
      take: 7 // Last week
    });

    if (recentMetrics.length >= 2) {
      const latest = Number(recentMetrics[0].overallScore);
      const previous = Number(recentMetrics[1].overallScore);
      const drop = previous - latest;

      if (drop > 0.1) {
        anomalies.push({
          id: `fairness_drop_${Date.now()}`,
          type: 'FAIRNESS_DROP',
          severity: drop > 0.2 ? 'HIGH' : 'MEDIUM',
          description: `Significant fairness score drop detected: ${(drop * 100).toFixed(1)}%`,
          detectedAt: new Date(),
          affectedAnalysts: [], // Would need to analyze which analysts caused the drop
          impact: drop,
          recommendations: [
            'Investigate recent schedule changes',
            'Review scheduling algorithm performance',
            'Check for constraint violations'
          ]
        });
      }
    }

    return anomalies;
  }

  private calculateGiniCoefficient(values: number[]): number {
    if (values.length === 0) return 0;
    if (values.length === 1) return 0;

    const sorted = [...values].sort((a, b) => a - b);
    const n = sorted.length;
    const sum = sorted.reduce((acc, val, i) => acc + val * (n - i), 0);
    const total = sorted.reduce((acc, val) => acc + val, 0);
    
    return (2 * sum) / (n * total) - (n + 1) / n;
  }
} 