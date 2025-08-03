import { SchedulingConstraint, Schedule, Analyst } from '../../generated/prisma';
import { prisma } from '../lib/prisma';
import { predictiveAnalyticsEngine } from './PredictiveAnalyticsEngine';
import moment from 'moment';

export interface ConflictProbabilityScore {
  date: string;
  overallRisk: number; // 0-1
  riskLevel: 'VERY_LOW' | 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  riskFactors: Array<{
    type: 'CONSTRAINT_VIOLATION' | 'WORKLOAD_IMBALANCE' | 'COVERAGE_GAP' | 'FAIRNESS_ISSUE' | 'ANALYST_UNAVAILABILITY';
    probability: number;
    severity: 'LOW' | 'MEDIUM' | 'HIGH';
    description: string;
    affectedAnalysts?: string[];
    mitigation?: string;
  }>;
  confidence: number; // 0-1
  historicalPatterns: {
    similarDatesRisk: number;
    seasonalTrend: 'IMPROVING' | 'STABLE' | 'DETERIORATING';
    dayOfWeekPattern: number;
  };
  recommendations: string[];
}

export interface DateRangeRiskAssessment {
  startDate: string;
  endDate: string;
  totalDays: number;
  averageRisk: number;
  highRiskDays: number;
  criticalRiskDays: number;
  dailyScores: ConflictProbabilityScore[];
  trendAnalysis: {
    direction: 'IMPROVING' | 'STABLE' | 'DETERIORATING';
    volatility: 'LOW' | 'MEDIUM' | 'HIGH';
    peakRiskDate: string;
    lowestRiskDate: string;
  };
  riskDistribution: {
    veryLow: number;
    low: number;
    medium: number;
    high: number;
    critical: number;
  };
  strategicRecommendations: string[];
}

export interface RiskFactorAnalysis {
  factorType: string;
  historicalFrequency: number;
  averageImpact: number;
  typicalResolutionTime: number;
  preventionStrategies: string[];
  earlyWarningSignals: string[];
}

export interface ConflictProbabilityConfig {
  enabled: boolean;
  defaultLookAheadDays: number;
  updateIntervalHours: number;
  useHistoricalData: boolean;
  historicalDataMonths: number;
  weightFactors: {
    constraints: number;
    workload: number;
    coverage: number;
    fairness: number;
    seasonal: number;
    historical: number;
  };
  riskThresholds: {
    low: number;
    medium: number;
    high: number;
    critical: number;
  };
}

export class ConflictProbabilityScorer {
  private config: ConflictProbabilityConfig;
  private scoreCache: Map<string, { score: ConflictProbabilityScore; timestamp: Date }> = new Map();
  private cacheTimeout = 3600000; // 1 hour

  constructor(config?: Partial<ConflictProbabilityConfig>) {
    this.config = {
      enabled: true,
      defaultLookAheadDays: 30,
      updateIntervalHours: 6,
      useHistoricalData: true,
      historicalDataMonths: 12,
      weightFactors: {
        constraints: 0.25,
        workload: 0.20,
        coverage: 0.20,
        fairness: 0.15,
        seasonal: 0.10,
        historical: 0.10
      },
      riskThresholds: {
        low: 0.3,
        medium: 0.5,
        high: 0.7,
        critical: 0.85
      },
      ...config
    };
  }

  /**
   * Calculate conflict probability for a specific date
   */
  async calculateDateRisk(date: Date): Promise<ConflictProbabilityScore> {
    const dateKey = moment(date).format('YYYY-MM-DD');
    
    // Check cache first
    const cached = this.scoreCache.get(dateKey);
    if (cached && (Date.now() - cached.timestamp.getTime()) < this.cacheTimeout) {
      return cached.score;
    }

    console.log(`🔍 Calculating conflict probability for ${dateKey}`);

    // Collect risk factors
    const [
      constraintRisk,
      workloadRisk,
      coverageRisk,
      fairnessRisk,
      seasonalRisk,
      historicalRisk
    ] = await Promise.all([
      this.analyzeConstraintRisk(date),
      this.analyzeWorkloadRisk(date),
      this.analyzeCoverageRisk(date),
      this.analyzeFairnessRisk(date),
      this.analyzeSeasonalRisk(date),
      this.analyzeHistoricalRisk(date)
    ]);

    // Combine all risk factors
    const allRiskFactors = [
      ...constraintRisk,
      ...workloadRisk,
      ...coverageRisk,
      ...fairnessRisk,
      ...seasonalRisk,
      ...historicalRisk
    ];

    // Calculate overall risk score
    const overallRisk = this.calculateWeightedRisk(allRiskFactors);

    // Determine risk level
    const riskLevel = this.determineRiskLevel(overallRisk);

    // Calculate confidence based on data quality
    const confidence = this.calculateConfidence(allRiskFactors, date);

    // Get historical patterns
    const historicalPatterns = await this.getHistoricalPatterns(date);

    // Generate recommendations
    const recommendations = this.generateRecommendations(allRiskFactors, riskLevel);

    const score: ConflictProbabilityScore = {
      date: dateKey,
      overallRisk,
      riskLevel,
      riskFactors: allRiskFactors,
      confidence,
      historicalPatterns,
      recommendations
    };

    // Cache the result
    this.scoreCache.set(dateKey, { score, timestamp: new Date() });

    return score;
  }

  /**
   * Calculate risk for a date range
   */
  async calculateRangeRisk(startDate: Date, endDate: Date): Promise<DateRangeRiskAssessment> {
    console.log(`📊 Calculating range risk from ${moment(startDate).format('YYYY-MM-DD')} to ${moment(endDate).format('YYYY-MM-DD')}`);

    const dates = this.getDateRange(startDate, endDate);
    const dailyScores = await Promise.all(
      dates.map(date => this.calculateDateRisk(date))
    );

    const totalDays = dailyScores.length;
    const averageRisk = dailyScores.reduce((sum, score) => sum + score.overallRisk, 0) / totalDays;
    
    const riskCounts = {
      veryLow: dailyScores.filter(s => s.overallRisk < this.config.riskThresholds.low).length,
      low: dailyScores.filter(s => s.overallRisk >= this.config.riskThresholds.low && s.overallRisk < this.config.riskThresholds.medium).length,
      medium: dailyScores.filter(s => s.overallRisk >= this.config.riskThresholds.medium && s.overallRisk < this.config.riskThresholds.high).length,
      high: dailyScores.filter(s => s.overallRisk >= this.config.riskThresholds.high && s.overallRisk < this.config.riskThresholds.critical).length,
      critical: dailyScores.filter(s => s.overallRisk >= this.config.riskThresholds.critical).length
    };

    const highRiskDays = riskCounts.high + riskCounts.critical;
    const criticalRiskDays = riskCounts.critical;

    // Find peak and lowest risk dates
    const sortedByRisk = [...dailyScores].sort((a, b) => b.overallRisk - a.overallRisk);
    const peakRiskDate = sortedByRisk[0].date;
    const lowestRiskDate = sortedByRisk[sortedByRisk.length - 1].date;

    // Analyze trend
    const trendAnalysis = this.analyzeTrend(dailyScores);

    // Generate strategic recommendations
    const strategicRecommendations = this.generateStrategicRecommendations(dailyScores, trendAnalysis);

    return {
      startDate: moment(startDate).format('YYYY-MM-DD'),
      endDate: moment(endDate).format('YYYY-MM-DD'),
      totalDays,
      averageRisk,
      highRiskDays,
      criticalRiskDays,
      dailyScores,
      trendAnalysis: {
        direction: trendAnalysis.direction,
        volatility: trendAnalysis.volatility,
        peakRiskDate,
        lowestRiskDate
      },
      riskDistribution: {
        veryLow: riskCounts.veryLow / totalDays,
        low: riskCounts.low / totalDays,
        medium: riskCounts.medium / totalDays,
        high: riskCounts.high / totalDays,
        critical: riskCounts.critical / totalDays
      },
      strategicRecommendations
    };
  }

  /**
   * Analyze constraint-related risk factors
   */
  private async analyzeConstraintRisk(date: Date): Promise<any[]> {
    const riskFactors: any[] = [];

    // Get active constraints for this date
    const constraints = await prisma.schedulingConstraint.findMany({
      where: {
        isActive: true,
        startDate: { lte: date },
        endDate: { gte: date }
      },
      include: { analyst: true }
    });

    // Get existing schedules for context
    const existingSchedules = await prisma.schedule.findMany({
      where: { date: date },
      include: { analyst: true }
    });

    for (const constraint of constraints) {
      let riskProbability = 0;
      let description = '';

      switch (constraint.constraintType) {
        case 'BLACKOUT_DATE':
          // Risk if someone is already scheduled during blackout
          const blackoutViolations = existingSchedules.filter(s => 
            !constraint.analystId || s.analystId === constraint.analystId
          );
          
          if (blackoutViolations.length > 0) {
            riskProbability = 0.9;
            description = `Blackout date violation: ${blackoutViolations.length} existing schedule(s)`;
          } else {
            riskProbability = 0.1;
            description = 'Blackout date protected - low assignment risk';
          }
          break;

        case 'MAX_SCREENER_DAYS':
          // Risk if analyst is approaching max screener days
          const maxDays = parseInt(constraint.description || '10');
          const currentScreenerDays = await this.getAnalystScreenerDays(constraint.analystId!, date);
          const utilization = currentScreenerDays / maxDays;
          
          riskProbability = Math.min(utilization, 0.95);
          description = `Max screener days risk: ${currentScreenerDays}/${maxDays} (${(utilization * 100).toFixed(1)}%)`;
          break;

        case 'MIN_SCREENER_DAYS':
          // Risk if analyst won't meet minimum
          const minDays = parseInt(constraint.description || '2');
          const currentMin = await this.getAnalystScreenerDays(constraint.analystId!, date);
          const remainingDays = this.getRemainingDaysInPeriod(date);
          
          if (currentMin + remainingDays < minDays) {
            riskProbability = 0.8;
            description = `Minimum screener days at risk: needs ${minDays - currentMin} more days`;
          } else {
            riskProbability = 0.2;
            description = 'Minimum screener days on track';
          }
          break;
      }

      if (riskProbability > 0.1) {
        riskFactors.push({
          type: 'CONSTRAINT_VIOLATION',
          probability: riskProbability,
          severity: riskProbability > 0.7 ? 'HIGH' : riskProbability > 0.4 ? 'MEDIUM' : 'LOW',
          description,
          affectedAnalysts: constraint.analystId ? [constraint.analystId] : [],
          mitigation: this.getConstraintMitigation(constraint.constraintType)
        });
      }
    }

    return riskFactors;
  }

  /**
   * Analyze workload-related risk factors
   */
  private async analyzeWorkloadRisk(date: Date): Promise<any[]> {
    const riskFactors: any[] = [];

    // Get analyst workloads around this date
    const weekStart = moment(date).startOf('week').toDate();
    const weekEnd = moment(date).endOf('week').toDate();

    const analysts = await prisma.analyst.findMany({
      include: {
        schedules: {
          where: {
            date: { gte: weekStart, lte: weekEnd }
          }
        }
      }
    });

    // Calculate workload distribution
    const workloads = analysts.map(analyst => ({
      analystId: analyst.id,
      analystName: analyst.name,
      weeklyHours: analyst.schedules.length * 8, // Assuming 8-hour shifts
      consecutiveDays: this.calculateConsecutiveDays(analyst.schedules, date)
    }));

    // Check for imbalances
    const avgWeeklyHours = workloads.reduce((sum, w) => sum + w.weeklyHours, 0) / workloads.length;
    const workloadVariance = this.calculateVariance(workloads.map(w => w.weeklyHours));

    if (workloadVariance > 100) { // Hours variance threshold
      riskFactors.push({
        type: 'WORKLOAD_IMBALANCE',
        probability: Math.min(workloadVariance / 200, 0.9),
        severity: workloadVariance > 200 ? 'HIGH' : 'MEDIUM',
        description: `High workload variance detected: ${workloadVariance.toFixed(1)} hours`,
        affectedAnalysts: workloads.filter(w => Math.abs(w.weeklyHours - avgWeeklyHours) > 16).map(w => w.analystId),
        mitigation: 'Redistribute assignments to balance workload'
      });
    }

    // Check for overworked analysts
    const overworkedAnalysts = workloads.filter(w => w.consecutiveDays > 5);
    if (overworkedAnalysts.length > 0) {
      riskFactors.push({
        type: 'WORKLOAD_IMBALANCE',
        probability: 0.7,
        severity: 'HIGH',
        description: `${overworkedAnalysts.length} analyst(s) working excessive consecutive days`,
        affectedAnalysts: overworkedAnalysts.map(w => w.analystId),
        mitigation: 'Schedule mandatory rest days'
      });
    }

    return riskFactors;
  }

  /**
   * Analyze coverage-related risk factors
   */
  private async analyzeCoverageRisk(date: Date): Promise<any[]> {
    const riskFactors: any[] = [];

    const daySchedules = await prisma.schedule.findMany({
      where: { date: date }
    });

    // Check basic coverage requirements
    const hasScreener = daySchedules.some(s => s.isScreener);
    const hasMorningShift = daySchedules.some(s => s.shiftType === 'MORNING');
    const hasEveningShift = daySchedules.some(s => s.shiftType === 'EVENING');
    const totalCoverage = daySchedules.length;

    // Minimum coverage requirements
    const requiredMinimum = 3; // At least 3 people scheduled
    const coverageRatio = totalCoverage / requiredMinimum;

    if (!hasScreener) {
      riskFactors.push({
        type: 'COVERAGE_GAP',
        probability: 0.9,
        severity: 'HIGH',
        description: 'No screener assigned',
        mitigation: 'Assign screener role immediately'
      });
    }

    if (!hasMorningShift || !hasEveningShift) {
      riskFactors.push({
        type: 'COVERAGE_GAP',
        probability: 0.8,
        severity: 'HIGH',
        description: `Missing ${!hasMorningShift ? 'morning' : 'evening'} shift coverage`,
        mitigation: 'Assign missing shift coverage'
      });
    }

    if (coverageRatio < 1) {
      riskFactors.push({
        type: 'COVERAGE_GAP',
        probability: 1 - coverageRatio,
        severity: coverageRatio < 0.6 ? 'HIGH' : 'MEDIUM',
        description: `Insufficient coverage: ${totalCoverage}/${requiredMinimum} minimum`,
        mitigation: 'Add additional analyst assignments'
      });
    }

    return riskFactors;
  }

  /**
   * Analyze fairness-related risk factors
   */
  private async analyzeFairnessRisk(date: Date): Promise<any[]> {
    const riskFactors: any[] = [];

    // Use predictive analytics for fairness predictions
    const monthStart = moment(date).startOf('month').toDate();
    const monthEnd = moment(date).endOf('month').toDate();

    try {
      const predictions = await predictiveAnalyticsEngine.predictViolations({
        startDate: date,
        endDate: moment(date).add(7, 'days').toDate(),
        minProbability: 0.3,
        minConfidence: 0.6
      });

      const fairnessPredictions = predictions.filter(p => p.conflictType === 'FAIRNESS_ISSUE');

      for (const prediction of fairnessPredictions) {
        if (moment(prediction.date).isSame(date, 'day')) {
          riskFactors.push({
            type: 'FAIRNESS_ISSUE',
            probability: prediction.probability,
            severity: prediction.probability > 0.7 ? 'HIGH' : 'MEDIUM',
            description: prediction.description,
            affectedAnalysts: prediction.affectedAnalysts,
            mitigation: 'Review assignment fairness and adjust rotation'
          });
        }
      }
    } catch (error) {
      console.error('Error analyzing fairness risk:', error);
    }

    return riskFactors;
  }

  /**
   * Analyze seasonal risk factors
   */
  private async analyzeSeasonalRisk(date: Date): Promise<any[]> {
    const riskFactors: any[] = [];

    const dayOfWeek = moment(date).day(); // 0 = Sunday, 6 = Saturday
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    const isMonday = dayOfWeek === 1;
    const isFriday = dayOfWeek === 5;

    // Weekend risk patterns
    if (isWeekend) {
      riskFactors.push({
        type: 'ANALYST_UNAVAILABILITY',
        probability: 0.4,
        severity: 'MEDIUM',
        description: 'Weekend scheduling challenges - limited analyst availability',
        mitigation: 'Ensure weekend rotation is properly planned'
      });
    }

    // Monday/Friday patterns
    if (isMonday || isFriday) {
      riskFactors.push({
        type: 'ANALYST_UNAVAILABILITY',
        probability: 0.2,
        severity: 'LOW',
        description: `${isMonday ? 'Monday' : 'Friday'} - potential availability constraints`,
        mitigation: 'Monitor for vacation/PTO requests'
      });
    }

    // Holiday proximity check
    const isNearHoliday = await this.checkHolidayProximity(date);
    if (isNearHoliday) {
      riskFactors.push({
        type: 'ANALYST_UNAVAILABILITY',
        probability: 0.6,
        severity: 'MEDIUM',
        description: 'Near holiday period - increased availability constraints',
        mitigation: 'Plan for reduced analyst availability'
      });
    }

    return riskFactors;
  }

  /**
   * Analyze historical risk patterns
   */
  private async analyzeHistoricalRisk(date: Date): Promise<any[]> {
    const riskFactors: any[] = [];

    if (!this.config.useHistoricalData) {
      return riskFactors;
    }

    // Look at same date in previous years
    const historicalRisk = await this.getHistoricalRiskForDate(date);

    if (historicalRisk > 0.3) {
      riskFactors.push({
        type: 'CONSTRAINT_VIOLATION',
        probability: historicalRisk,
        severity: historicalRisk > 0.6 ? 'MEDIUM' : 'LOW',
        description: `Historical pattern indicates ${(historicalRisk * 100).toFixed(1)}% risk on similar dates`,
        mitigation: 'Apply lessons learned from historical issues'
      });
    }

    return riskFactors;
  }

  // Utility and helper methods

  private calculateWeightedRisk(riskFactors: any[]): number {
    if (riskFactors.length === 0) return 0;

    const weightedScore = riskFactors.reduce((sum, factor) => {
      const weight = this.getFactorWeight(factor.type);
      return sum + (factor.probability * weight);
    }, 0);

    const totalWeight = riskFactors.reduce((sum, factor) => {
      return sum + this.getFactorWeight(factor.type);
    }, 0);

    return totalWeight > 0 ? Math.min(weightedScore / totalWeight, 1) : 0;
  }

  private getFactorWeight(type: string): number {
    switch (type) {
      case 'CONSTRAINT_VIOLATION': return this.config.weightFactors.constraints;
      case 'WORKLOAD_IMBALANCE': return this.config.weightFactors.workload;
      case 'COVERAGE_GAP': return this.config.weightFactors.coverage;
      case 'FAIRNESS_ISSUE': return this.config.weightFactors.fairness;
      case 'ANALYST_UNAVAILABILITY': return this.config.weightFactors.seasonal;
      default: return 0.1;
    }
  }

  private determineRiskLevel(overallRisk: number): 'VERY_LOW' | 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' {
    if (overallRisk >= this.config.riskThresholds.critical) return 'CRITICAL';
    if (overallRisk >= this.config.riskThresholds.high) return 'HIGH';
    if (overallRisk >= this.config.riskThresholds.medium) return 'MEDIUM';
    if (overallRisk >= this.config.riskThresholds.low) return 'LOW';
    return 'VERY_LOW';
  }

  private calculateConfidence(riskFactors: any[], date: Date): number {
    // Base confidence on data availability and recency
    let confidence = 0.7; // Base confidence

    // Adjust based on number of factors
    if (riskFactors.length > 3) confidence += 0.1;
    if (riskFactors.length > 6) confidence += 0.1;

    // Adjust based on date proximity
    const daysFromNow = Math.abs(moment(date).diff(moment(), 'days'));
    if (daysFromNow <= 7) confidence += 0.1;
    else if (daysFromNow > 30) confidence -= 0.2;

    return Math.min(Math.max(confidence, 0.3), 0.95);
  }

  private async getHistoricalPatterns(date: Date): Promise<any> {
    const dayOfWeek = moment(date).day();
    const monthOfYear = moment(date).month();

    return {
      similarDatesRisk: await this.getHistoricalRiskForDate(date),
      seasonalTrend: 'STABLE', // Placeholder
      dayOfWeekPattern: this.getDayOfWeekRiskPattern(dayOfWeek)
    };
  }

  private generateRecommendations(riskFactors: any[], riskLevel: string): string[] {
    const recommendations: string[] = [];

    if (riskLevel === 'CRITICAL' || riskLevel === 'HIGH') {
      recommendations.push('⚠️ High-risk date detected - require management approval for changes');
      recommendations.push('🔍 Perform detailed conflict analysis before scheduling');
    }

    if (riskFactors.some(f => f.type === 'COVERAGE_GAP')) {
      recommendations.push('📅 Ensure all shift types and roles are covered');
    }

    if (riskFactors.some(f => f.type === 'WORKLOAD_IMBALANCE')) {
      recommendations.push('⚖️ Review workload distribution and balance assignments');
    }

    if (riskFactors.some(f => f.type === 'CONSTRAINT_VIOLATION')) {
      recommendations.push('📋 Verify all constraints are properly configured and active');
    }

    if (recommendations.length === 0) {
      recommendations.push('✅ Low-risk date - standard scheduling procedures apply');
    }

    return recommendations;
  }

  private getDateRange(startDate: Date, endDate: Date): Date[] {
    const dates: Date[] = [];
    const currentDate = new Date(startDate);
    
    while (currentDate <= endDate) {
      dates.push(new Date(currentDate));
      currentDate.setDate(currentDate.getDate() + 1);
    }
    
    return dates;
  }

  private analyzeTrend(dailyScores: ConflictProbabilityScore[]): any {
    const scores = dailyScores.map(s => s.overallRisk);
    const firstHalf = scores.slice(0, Math.floor(scores.length / 2));
    const secondHalf = scores.slice(Math.floor(scores.length / 2));

    const firstAvg = firstHalf.reduce((sum, score) => sum + score, 0) / firstHalf.length;
    const secondAvg = secondHalf.reduce((sum, score) => sum + score, 0) / secondHalf.length;

    const difference = secondAvg - firstAvg;
    const direction = difference > 0.05 ? 'DETERIORATING' : difference < -0.05 ? 'IMPROVING' : 'STABLE';

    const variance = this.calculateVariance(scores);
    const volatility = variance > 0.1 ? 'HIGH' : variance > 0.05 ? 'MEDIUM' : 'LOW';

    return { direction, volatility };
  }

  private generateStrategicRecommendations(dailyScores: ConflictProbabilityScore[], trendAnalysis: any): string[] {
    const recommendations: string[] = [];
    const highRiskDays = dailyScores.filter(s => s.riskLevel === 'HIGH' || s.riskLevel === 'CRITICAL');

    if (highRiskDays.length > dailyScores.length * 0.3) {
      recommendations.push('🚨 High proportion of risky dates - consider comprehensive schedule review');
    }

    if (trendAnalysis.direction === 'DETERIORATING') {
      recommendations.push('📈 Risk trend is deteriorating - implement preventive measures');
    }

    if (trendAnalysis.volatility === 'HIGH') {
      recommendations.push('📊 High risk volatility - ensure flexible scheduling practices');
    }

    return recommendations;
  }

  // Placeholder helper methods (would be implemented with real data)
  private async getAnalystScreenerDays(analystId: string, date: Date): Promise<number> {
    const monthStart = moment(date).startOf('month').toDate();
    const schedules = await prisma.schedule.findMany({
      where: {
        analystId,
        date: { gte: monthStart, lte: date },
        isScreener: true
      }
    });
    return schedules.length;
  }

  private getRemainingDaysInPeriod(date: Date): number {
    const monthEnd = moment(date).endOf('month');
    return monthEnd.diff(moment(date), 'days');
  }

  private getConstraintMitigation(constraintType: string): string {
    switch (constraintType) {
      case 'BLACKOUT_DATE': return 'Remove conflicting schedules or adjust blackout period';
      case 'MAX_SCREENER_DAYS': return 'Redistribute screener assignments to other analysts';
      case 'MIN_SCREENER_DAYS': return 'Prioritize screener assignments for this analyst';
      default: return 'Review constraint configuration';
    }
  }

  private calculateConsecutiveDays(schedules: Schedule[], referenceDate: Date): number {
    // Simplified calculation - would implement proper consecutive day logic
    return schedules.length;
  }

  private calculateVariance(values: number[]): number {
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const squaredDiffs = values.map(val => Math.pow(val - mean, 2));
    return squaredDiffs.reduce((sum, diff) => sum + diff, 0) / values.length;
  }

  private async checkHolidayProximity(date: Date): Promise<boolean> {
    // Placeholder - would check against holiday calendar
    const holidays = ['2024-01-01', '2024-07-04', '2024-12-25']; // Example
    const dateStr = moment(date).format('YYYY-MM-DD');
    return holidays.some(holiday => Math.abs(moment(holiday).diff(moment(dateStr), 'days')) <= 3);
  }

  private async getHistoricalRiskForDate(date: Date): Promise<number> {
    // Placeholder - would analyze historical data for similar dates
    const dayOfWeek = moment(date).day();
    const monthOfYear = moment(date).month();
    
    // Simulate higher risk for certain patterns
    let risk = 0.2; // Base risk
    if (dayOfWeek === 1) risk += 0.1; // Mondays slightly riskier
    if (monthOfYear === 11) risk += 0.2; // December riskier (holidays)
    
    return Math.min(risk, 0.8);
  }

  private getDayOfWeekRiskPattern(dayOfWeek: number): number {
    // 0 = Sunday, 6 = Saturday
    const patterns = [0.4, 0.3, 0.2, 0.2, 0.3, 0.3, 0.4]; // Weekend higher risk
    return patterns[dayOfWeek] || 0.2;
  }

  // Public API methods

  /**
   * Get risk assessment for the next N days
   */
  async getUpcomingRisks(days: number = this.config.defaultLookAheadDays): Promise<DateRangeRiskAssessment> {
    const startDate = new Date();
    const endDate = moment().add(days, 'days').toDate();
    return this.calculateRangeRisk(startDate, endDate);
  }

  /**
   * Get risk factors analysis
   */
  getRiskFactorAnalysis(): RiskFactorAnalysis[] {
    return [
      {
        factorType: 'CONSTRAINT_VIOLATION',
        historicalFrequency: 0.15,
        averageImpact: 0.7,
        typicalResolutionTime: 2,
        preventionStrategies: ['Regular constraint validation', 'Automated conflict detection'],
        earlyWarningSignals: ['Approaching constraint limits', 'High utilization rates']
      },
      {
        factorType: 'WORKLOAD_IMBALANCE',
        historicalFrequency: 0.25,
        averageImpact: 0.5,
        typicalResolutionTime: 3,
        preventionStrategies: ['Fair rotation algorithms', 'Workload monitoring'],
        earlyWarningSignals: ['High variance in assignments', 'Consecutive work days']
      },
      {
        factorType: 'COVERAGE_GAP',
        historicalFrequency: 0.10,
        averageImpact: 0.8,
        typicalResolutionTime: 1,
        preventionStrategies: ['Minimum coverage validation', 'Redundant scheduling'],
        earlyWarningSignals: ['Insufficient assignments', 'Missing role coverage']
      }
    ];
  }

  /**
   * Update configuration
   */
  updateConfiguration(newConfig: Partial<ConflictProbabilityConfig>): void {
    this.config = { ...this.config, ...newConfig };
    
    // Clear cache if significant config changes
    if (newConfig.riskThresholds || newConfig.weightFactors) {
      this.scoreCache.clear();
    }
  }

  /**
   * Clear prediction cache
   */
  clearCache(): void {
    this.scoreCache.clear();
    console.log('🗑️ Conflict probability cache cleared');
  }
}

// Export singleton instance
export const conflictProbabilityScorer = new ConflictProbabilityScorer({
  enabled: true,
  defaultLookAheadDays: 30,
  updateIntervalHours: 6,
  useHistoricalData: true,
  historicalDataMonths: 12
});