import { PrismaClient } from '@prisma/client';
import { cacheService } from '../lib/cache';

export interface StaffingPrediction {
  date: Date;
  predictedRequiredStaff: number;
  confidence: number;
  factors: string[];
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
}

export interface BurnoutAssessment {
  analystId: string;
  analystName: string;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  riskScore: number;
  factors: string[];
  recommendations: string[];
  lastAssessment: Date;
}

export interface RotationSuggestion {
  type: 'WEEKEND_ROTATION' | 'SCREENER_ROTATION' | 'SHIFT_ROTATION';
  description: string;
  expectedImpact: number;
  implementationSteps: string[];
  affectedAnalysts: string[];
  priority: 'LOW' | 'MEDIUM' | 'HIGH';
}

export interface ConflictForecast {
  date: Date;
  probability: number;
  conflictType: 'STAFFING_SHORTAGE' | 'CONSTRAINT_VIOLATION' | 'FAIRNESS_VIOLATION';
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  description: string;
  preventiveActions: string[];
}

export interface SchedulePattern {
  startDate: Date;
  endDate: Date;
  analystCount: number;
  shiftTypes: string[];
  constraints: any[];
}

export interface ManualAdjustment {
  id: string;
  analystId: string;
  originalSchedule: any;
  adjustedSchedule: any;
  reason: string;
  timestamp: Date;
  impact: {
    fairnessScoreChange: number;
    workloadChange: number;
  };
}

export interface Improvement {
  type: 'WORKLOAD_BALANCE' | 'FAIRNESS' | 'EFFICIENCY' | 'CONSTRAINT_SATISFACTION';
  description: string;
  expectedBenefit: number;
  implementationComplexity: 'LOW' | 'MEDIUM' | 'HIGH';
  suggestedChanges: any[];
}

export interface UsagePattern {
  analystId: string;
  pattern: {
    preferredShifts: string[];
    averageWorkload: number;
    weekendPreference: number;
    screenerWillingness: number;
  };
  frequency: number;
  lastUpdated: Date;
}

export class PredictiveEngine {
  private prisma: PrismaClient;
  private cache: typeof cacheService;

  constructor(prisma: PrismaClient, cache: typeof cacheService) {
    this.prisma = prisma;
    this.cache = cache;
  }

  async predictStaffingNeeds(futureDate: Date): Promise<StaffingPrediction> {
    const cacheKey = `staffing_prediction_${futureDate.toISOString().split('T')[0]}`;
    
    const cached = await this.cache.get(cacheKey);
    if (cached) {
      return cached as StaffingPrediction;
    }

    // Get historical data for the same day of week and month
    const historicalData = await this.prisma.schedule.findMany({
      where: {
        date: {
          gte: new Date(futureDate.getFullYear() - 1, 0, 1),
          lte: new Date(futureDate.getFullYear(), futureDate.getMonth(), 0),
        },
      },
    });

    // Analyze patterns for the same day of week and month
    const sameDayOfWeek = futureDate.getDay();
    const sameMonth = futureDate.getMonth();
    
    const relevantSchedules = historicalData.filter((schedule: any) => {
      const scheduleDate = new Date(schedule.date);
      return scheduleDate.getDay() === sameDayOfWeek && scheduleDate.getMonth() === sameMonth;
    });

    // Calculate average staffing needs
    const dailyStaffing = new Map<string, number>();
    for (const schedule of relevantSchedules) {
      const dateKey = schedule.date.toISOString().split('T')[0];
      dailyStaffing.set(dateKey, (dailyStaffing.get(dateKey) || 0) + 1);
    }

    const staffingValues = Array.from(dailyStaffing.values());
    const averageStaffing = staffingValues.length > 0 
      ? staffingValues.reduce((a, b) => a + b, 0) / staffingValues.length
      : 4; // Default staffing

    // Calculate confidence based on data consistency
    const variance = staffingValues.length > 0 
      ? staffingValues.reduce((sum, val) => sum + Math.pow(val - averageStaffing, 2), 0) / staffingValues.length
      : 0;
    const confidence = Math.max(0.3, 1 - (Math.sqrt(variance) / averageStaffing));

    // Determine risk level
    let riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' = 'LOW';
    if (confidence < 0.6) riskLevel = 'HIGH';
    else if (confidence < 0.8) riskLevel = 'MEDIUM';

    const factors = [
      'Historical patterns',
      'Day of week analysis',
      'Seasonal trends',
      'Staff availability'
    ];

    const prediction: StaffingPrediction = {
      date: futureDate,
      predictedRequiredStaff: Math.round(averageStaffing),
      confidence,
      factors,
      riskLevel,
    };

    // Cache for 1 hour
    await this.cache.set(cacheKey, prediction, 3600);
    
    return prediction;
  }

  async identifyBurnoutRisk(analysts: any[]): Promise<BurnoutAssessment[]> {
    const assessments: BurnoutAssessment[] = [];

    for (const analyst of analysts) {
      // Get recent schedule data
      const recentSchedules = await this.prisma.schedule.findMany({
        where: {
          analystId: analyst.id,
          date: {
            gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Last 30 days
          },
        },
        orderBy: { date: 'asc' },
      });

      // Calculate risk factors
      const totalWorkDays = recentSchedules.length;
      const consecutiveStreaks = this.calculateConsecutiveStreaks(recentSchedules);
      const weekendDays = recentSchedules.filter((s: any) => s.shiftType === 'WEEKEND').length;
      const screenerDays = recentSchedules.filter((s: any) => s.isScreener).length;
      
      // Calculate risk score (0-100)
      let riskScore = 0;
      const factors: string[] = [];

      // High workload factor
      if (totalWorkDays > 20) {
        riskScore += 30;
        factors.push(`High workload: ${totalWorkDays} days in 30 days`);
      }

      // Consecutive work days factor
      if (consecutiveStreaks > 5) {
        riskScore += 25;
        factors.push(`Long consecutive streak: ${consecutiveStreaks} days`);
      }

      // Weekend work factor
      if (weekendDays > 4) {
        riskScore += 20;
        factors.push(`High weekend work: ${weekendDays} weekend days`);
      }

      // Screener duty factor
      if (screenerDays > 6) {
        riskScore += 15;
        factors.push(`High screener duty: ${screenerDays} screener days`);
      }

      // Determine risk level
      let riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' = 'LOW';
      if (riskScore >= 70) riskLevel = 'CRITICAL';
      else if (riskScore >= 50) riskLevel = 'HIGH';
      else if (riskScore >= 30) riskLevel = 'MEDIUM';

      // Generate recommendations
      const recommendations: string[] = [];
      if (totalWorkDays > 20) {
        recommendations.push('Consider reducing workload for next period');
      }
      if (consecutiveStreaks > 5) {
        recommendations.push('Add rest days between work periods');
      }
      if (weekendDays > 4) {
        recommendations.push('Reduce weekend assignments');
      }
      if (screenerDays > 6) {
        recommendations.push('Rotate screener duties more evenly');
      }

      assessments.push({
        analystId: analyst.id,
        analystName: analyst.name,
        riskLevel,
        riskScore,
        factors,
        recommendations,
        lastAssessment: new Date(),
      });
    }

    return assessments;
  }

  async suggestOptimalRotations(constraints: any[]): Promise<RotationSuggestion[]> {
    const suggestions: RotationSuggestion[] = [];

    // Analyze current rotation patterns
    const analysts = await this.prisma.analyst.findMany({
      where: { isActive: true },
    });

    const recentSchedules = await this.prisma.schedule.findMany({
      where: {
        date: {
          gte: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000), // Last 60 days
        },
      },
      include: { analyst: true },
    });

    // Weekend rotation analysis
    const weekendDistribution = new Map<string, number>();
    for (const analyst of analysts) {
      const analystWeekends = recentSchedules.filter(
        (s: any) => s.analystId === analyst.id && s.shiftType === 'WEEKEND'
      ).length;
      weekendDistribution.set(analyst.id, analystWeekends);
    }

    const weekendValues = Array.from(weekendDistribution.values());
    const avgWeekends = weekendValues.reduce((a: any, b: any) => a + b, 0) / weekendValues.length;
    const weekendVariance = weekendValues.reduce((sum: any, val: any) => sum + Math.pow(val - avgWeekends, 2), 0) / weekendValues.length;

    if (weekendVariance > 2) {
      suggestions.push({
        type: 'WEEKEND_ROTATION',
        description: 'Implement equitable weekend rotation to balance workload',
        expectedImpact: 0.8,
        implementationSteps: [
          'Calculate optimal weekend distribution',
          'Implement rotation algorithm',
          'Monitor fairness metrics',
        ],
        affectedAnalysts: Array.from(weekendDistribution.entries())
          .filter(([_, count]) => Math.abs(count - avgWeekends) > 1)
          .map(([analystId, _]) => analystId),
        priority: weekendVariance > 4 ? 'HIGH' : 'MEDIUM',
      });
    }

    // Screener rotation analysis
    const screenerDistribution = new Map<string, number>();
    for (const analyst of analysts) {
      const analystScreeners = recentSchedules.filter(
        (s: any) => s.analystId === analyst.id && s.isScreener
      ).length;
      screenerDistribution.set(analyst.id, analystScreeners);
    }

    const screenerValues = Array.from(screenerDistribution.values());
    const avgScreeners = screenerValues.reduce((a: any, b: any) => a + b, 0) / screenerValues.length;
    const screenerVariance = screenerValues.reduce((sum: any, val: any) => sum + Math.pow(val - avgScreeners, 2), 0) / screenerValues.length;

    if (screenerVariance > 1) {
      suggestions.push({
        type: 'SCREENER_ROTATION',
        description: 'Balance screener duties across all qualified analysts',
        expectedImpact: 0.6,
        implementationSteps: [
          'Identify qualified screener analysts',
          'Create rotation schedule',
          'Train additional analysts if needed',
        ],
        affectedAnalysts: Array.from(screenerDistribution.entries())
          .filter(([_, count]) => Math.abs(count - avgScreeners) > 0.5)
          .map(([analystId, _]) => analystId),
        priority: screenerVariance > 2 ? 'HIGH' : 'MEDIUM',
      });
    }

    return suggestions;
  }

  async forecastConflicts(schedulePattern: SchedulePattern): Promise<ConflictForecast[]> {
    const forecasts: ConflictForecast[] = [];

    // Analyze staffing requirements vs availability
    const requiredStaff = schedulePattern.analystCount;
    const availableAnalysts = await this.prisma.analyst.count({
      where: { isActive: true },
    });

    if (requiredStaff > availableAnalysts) {
      forecasts.push({
        date: schedulePattern.startDate,
        probability: 0.9,
        conflictType: 'STAFFING_SHORTAGE',
        severity: requiredStaff - availableAnalysts > 2 ? 'CRITICAL' : 'HIGH',
        description: `Insufficient staff: ${requiredStaff} required, ${availableAnalysts} available`,
        preventiveActions: [
          'Hire additional analysts',
          'Adjust schedule requirements',
          'Cross-train existing staff',
        ],
      });
    }

    // Check for constraint violations
    const constraintViolations = await this.checkConstraintViolations(schedulePattern);
    for (const violation of constraintViolations) {
      forecasts.push({
        date: violation.date,
        probability: violation.probability,
        conflictType: 'CONSTRAINT_VIOLATION',
        severity: violation.severity,
        description: violation.description,
        preventiveActions: violation.preventiveActions,
      });
    }

    // Check for fairness violations
    const fairnessViolations = await this.checkFairnessViolations(schedulePattern);
    for (const violation of fairnessViolations) {
      forecasts.push({
        date: violation.date,
        probability: violation.probability,
        conflictType: 'FAIRNESS_VIOLATION',
        severity: violation.severity,
        description: violation.description,
        preventiveActions: violation.preventiveActions,
      });
    }

    return forecasts;
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

  private async checkConstraintViolations(pattern: SchedulePattern): Promise<any[]> {
    // This would check against actual constraints in the database
    // For now, return empty array as placeholder
    return [];
  }

  private async checkFairnessViolations(pattern: SchedulePattern): Promise<any[]> {
    // This would check for potential fairness issues
    // For now, return empty array as placeholder
    return [];
  }
} 