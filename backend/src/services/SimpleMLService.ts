import { PrismaClient } from '@prisma/client';
import { cacheService } from '../lib/cache';

export interface WorkloadPrediction {
  date: Date;
  predictedRequiredStaff: number;
  confidence: number;
  factors: string[];
}

export interface BurnoutRiskAssessment {
  analystId: string;
  analystName: string;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  riskScore: number;
  factors: string[];
  recommendations: string[];
  lastAssessment: Date;
}

export interface OptimalAssignment {
  date: Date;
  shiftType: 'MORNING' | 'EVENING';
  recommendedAnalyst: {
    id: string;
    name: string;
    score: number;
    reasons: string[];
  };
  alternatives: Array<{
    id: string;
    name: string;
    score: number;
  }>;
}

export interface DemandForecast {
  period: string;
  predictedDemand: number;
  confidence: number;
  trend: 'INCREASING' | 'STABLE' | 'DECREASING';
  factors: string[];
}

export interface ConflictPrediction {
  date: Date;
  probability: number;
  conflictType: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  description: string;
  preventiveActions: string[];
}

export class SimpleMLService {
  private prisma: PrismaClient;
  private cache: typeof cacheService;

  constructor(prisma: PrismaClient, cache: typeof cacheService) {
    this.prisma = prisma;
    this.cache = cache;
  }

  // 1. Smart Workload Prediction
  async predictWorkloadNeeds(futureDate: Date): Promise<WorkloadPrediction> {
    const cacheKey = `workload_prediction_${futureDate.toISOString().split('T')[0]}`;
    
    const cached = await this.cache.get(cacheKey);
    if (cached) {
      return cached as WorkloadPrediction;
    }

    // Get historical data for similar days (same day of week, same month)
    const historicalData = await this.prisma.schedule.findMany({
      where: {
        date: {
          gte: new Date(futureDate.getFullYear() - 1, 0, 1),
          lte: new Date(futureDate.getFullYear(), futureDate.getMonth(), 0),
        },
      },
    });

    // Simple linear regression: predict based on day of week and month
    const dayOfWeek = futureDate.getDay();
    const month = futureDate.getMonth();
    
    // Group by day of week and month
    const dailyStaffing = new Map<string, number>();
    for (const schedule of historicalData) {
      const scheduleDate = new Date(schedule.date);
      const key = `${scheduleDate.getDay()}_${scheduleDate.getMonth()}`;
      dailyStaffing.set(key, (dailyStaffing.get(key) || 0) + 1);
    }

    // Calculate average staffing for similar days
    const similarDays = Array.from(dailyStaffing.entries())
      .filter(([key]) => key.startsWith(`${dayOfWeek}_`))
      .map(([_, count]) => count);

    const avgStaffing = similarDays.length > 0 
      ? similarDays.reduce((a, b) => a + b, 0) / similarDays.length
      : 4; // Default fallback

    // Calculate confidence based on data consistency
    const variance = similarDays.length > 0 
      ? similarDays.reduce((sum, val) => sum + Math.pow(val - avgStaffing, 2), 0) / similarDays.length
      : 0;
    const confidence = Math.max(0.3, 1 - (Math.sqrt(variance) / avgStaffing));

    const prediction: WorkloadPrediction = {
      date: futureDate,
      predictedRequiredStaff: Math.round(avgStaffing),
      confidence,
      factors: [
        `Historical patterns for ${this.getDayName(dayOfWeek)}`,
        `Seasonal trends for ${this.getMonthName(month)}`,
        `Data from ${similarDays.length} similar days`
      ],
    };

    await this.cache.set(cacheKey, prediction, 3600);
    return prediction;
  }

  // 2. Burnout Risk Scoring
  async assessBurnoutRisk(analysts: any[]): Promise<BurnoutRiskAssessment[]> {
    const assessments: BurnoutRiskAssessment[] = [];

    for (const analyst of analysts) {
      // Get recent schedule data (last 30 days)
      const recentSchedules = await this.prisma.schedule.findMany({
        where: {
          analystId: analyst.id,
          date: {
            gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
          },
        },
        orderBy: { date: 'asc' },
      });

      // Calculate risk factors
      const totalWorkDays = recentSchedules.length;
      const consecutiveStreaks = this.calculateConsecutiveStreaks(recentSchedules);
      const weekendDays = recentSchedules.filter((s: any) => s.shiftType === 'WEEKEND').length;
      const screenerDays = recentSchedules.filter((s: any) => s.isScreener).length;
      
      // Simple ML scoring algorithm
      let riskScore = 0;
      const factors: string[] = [];

      // High workload factor (0-40 points)
      if (totalWorkDays > 20) {
        riskScore += Math.min(40, (totalWorkDays - 20) * 2);
        factors.push(`High workload: ${totalWorkDays} days in 30 days`);
      }

      // Consecutive work days factor (0-30 points)
      if (consecutiveStreaks > 5) {
        riskScore += Math.min(30, (consecutiveStreaks - 5) * 5);
        factors.push(`Long consecutive streak: ${consecutiveStreaks} days`);
      }

      // Weekend work factor (0-20 points)
      if (weekendDays > 4) {
        riskScore += Math.min(20, (weekendDays - 4) * 4);
        factors.push(`High weekend work: ${weekendDays} weekend days`);
      }

      // Screener duty factor (0-10 points)
      if (screenerDays > 6) {
        riskScore += Math.min(10, (screenerDays - 6) * 2);
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
      if (recommendations.length === 0) {
        recommendations.push('Workload is balanced - maintain current schedule');
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

  // 3. Optimal Shift Assignment
  async getOptimalAssignment(date: Date, shiftType: 'MORNING' | 'EVENING'): Promise<OptimalAssignment> {
    const analysts = await this.prisma.analyst.findMany({
      where: { isActive: true },
    });

    const recentSchedules = await this.prisma.schedule.findMany({
      where: {
        date: {
          gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        },
      },
    });

    const assignments: Array<{
      analyst: any;
      score: number;
      reasons: string[];
    }> = [];

    for (const analyst of analysts) {
      let score = 100; // Start with perfect score
      const reasons: string[] = [];

      // Check workload balance
      const analystSchedules = recentSchedules.filter((s: any) => s.analystId === analyst.id);
      const workload = analystSchedules.length;
      const avgWorkload = recentSchedules.length / analysts.length;

      if (workload < avgWorkload * 0.8) {
        score += 20; // Bonus for underutilized analyst
        reasons.push('Underutilized - needs more shifts');
      } else if (workload > avgWorkload * 1.2) {
        score -= 30; // Penalty for overworked analyst
        reasons.push('Overworked - needs rest');
      }

      // Check shift type preference
      if (analyst.shiftType === shiftType) {
        score += 15; // Bonus for preferred shift type
        reasons.push('Preferred shift type');
      }

      // Check consecutive work days
      const consecutiveStreaks = this.calculateConsecutiveStreaks(analystSchedules);
      if (consecutiveStreaks > 5) {
        score -= 25; // Penalty for long streaks
        reasons.push('Long consecutive work streak');
      }

      // Check screener balance
      const screenerDays = analystSchedules.filter((s: any) => s.isScreener).length;
      const avgScreeners = analystSchedules.filter((s: any) => s.isScreener).length / analysts.length;
      
      if (screenerDays < avgScreeners * 0.5) {
        score += 10; // Bonus for fewer screener duties
        reasons.push('Low screener duty load');
      }

      // Check weekend work balance
      const weekendDays = analystSchedules.filter((s: any) => s.shiftType === 'WEEKEND').length;
      if (weekendDays < 2) {
        score += 5; // Small bonus for weekend availability
        reasons.push('Available for weekend work');
      }

      assignments.push({
        analyst,
        score: Math.max(0, score),
        reasons,
      });
    }

    // Sort by score (highest first)
    assignments.sort((a, b) => b.score - a.score);

    const recommended = assignments[0];
    const alternatives = assignments.slice(1, 4).map((a: any) => ({
      id: a.analyst.id,
      name: a.analyst.name,
      score: a.score,
    }));

    return {
      date,
      shiftType,
      recommendedAnalyst: {
        id: recommended.analyst.id,
        name: recommended.analyst.name,
        score: recommended.score,
        reasons: recommended.reasons,
      },
      alternatives,
    };
  }

  // 4. Demand Forecasting
  async forecastDemand(period: 'WEEK' | 'MONTH'): Promise<DemandForecast> {
    const cacheKey = `demand_forecast_${period}`;
    
    const cached = await this.cache.get(cacheKey);
    if (cached) {
      return cached as DemandForecast;
    }

    // Get historical data for trend analysis
    const historicalData = await this.prisma.schedule.findMany({
      where: {
        date: {
          gte: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000), // Last 90 days
        },
      },
    });

    // Group by week or month
    const groupedData = new Map<string, number>();
    for (const schedule of historicalData) {
      const date = new Date(schedule.date);
      let key: string;
      
      if (period === 'WEEK') {
        const weekStart = new Date(date);
        weekStart.setDate(date.getDate() - date.getDay());
        key = weekStart.toISOString().split('T')[0];
      } else {
        key = `${date.getFullYear()}-${date.getMonth()}`;
      }
      
      groupedData.set(key, (groupedData.get(key) || 0) + 1);
    }

    // Calculate trend using simple linear regression
    const dataPoints = Array.from(groupedData.values());
    const avgDemand = dataPoints.reduce((a, b) => a + b, 0) / dataPoints.length;
    
    // Simple trend calculation
    const recentAvg = dataPoints.slice(-4).reduce((a, b) => a + b, 0) / 4;
    const olderAvg = dataPoints.slice(0, -4).reduce((a, b) => a + b, 0) / Math.max(1, dataPoints.length - 4);
    
    let trend: 'INCREASING' | 'STABLE' | 'DECREASING' = 'STABLE';
    if (recentAvg > olderAvg * 1.1) trend = 'INCREASING';
    else if (recentAvg < olderAvg * 0.9) trend = 'DECREASING';

    // Calculate confidence based on data consistency
    const variance = dataPoints.reduce((sum, val) => sum + Math.pow(val - avgDemand, 2), 0) / dataPoints.length;
    const confidence = Math.max(0.3, 1 - (Math.sqrt(variance) / avgDemand));

    const forecast: DemandForecast = {
      period,
      predictedDemand: Math.round(avgDemand),
      confidence,
      trend,
      factors: [
        `Historical average: ${avgDemand.toFixed(1)}`,
        `Trend: ${trend.toLowerCase()}`,
        `Based on ${dataPoints.length} data points`
      ],
    };

    await this.cache.set(cacheKey, forecast, 1800);
    return forecast;
  }

  // 5. Conflict Prevention
  async predictConflicts(startDate: Date, endDate: Date): Promise<ConflictPrediction[]> {
    const predictions: ConflictPrediction[] = [];

    // Get all constraints
    const constraints = await this.prisma.schedulingConstraint.findMany({
      where: { isActive: true },
      include: { analyst: true },
    });

    // Get existing schedules
    const existingSchedules = await this.prisma.schedule.findMany({
      where: {
        date: { gte: startDate, lte: endDate },
      },
    });

    // Check for potential conflicts
    for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
      const currentDate = new Date(d);
      
      // Check staffing shortage
      const daySchedules = existingSchedules.filter((s: any) => 
        s.date.toDateString() === currentDate.toDateString()
      );
      
      if (daySchedules.length < 4) { // Minimum staffing requirement
        predictions.push({
          date: currentDate,
          probability: 0.8,
          conflictType: 'STAFFING_SHORTAGE',
          severity: 'HIGH',
          description: `Insufficient staff scheduled: ${daySchedules.length} analysts`,
          preventiveActions: [
            'Schedule additional analysts',
            'Check analyst availability',
            'Consider overtime or temporary staff'
          ],
        });
      }

      // Check constraint violations
      for (const constraint of constraints) {
        if (constraint.startDate <= currentDate && currentDate <= constraint.endDate) {
          const analystSchedules = daySchedules.filter((s: any) => s.analystId === constraint.analystId);
          
          if (analystSchedules.length > 0) {
            predictions.push({
              date: currentDate,
              probability: 0.9,
              conflictType: 'CONSTRAINT_VIOLATION',
              severity: 'CRITICAL',
              description: `${constraint.analyst?.name} scheduled during ${constraint.constraintType}`,
              preventiveActions: [
                'Reschedule affected analyst',
                'Find alternative coverage',
                'Review constraint validity'
              ],
            });
          }
        }
      }

      // Check workload imbalance
      const workloads = new Map<string, number>();
      for (const schedule of daySchedules) {
        workloads.set(schedule.analystId, (workloads.get(schedule.analystId) || 0) + 1);
      }

      if (workloads.size > 0) {
        const workloadValues = Array.from(workloads.values());
        const maxWorkload = Math.max(...workloadValues);
        const minWorkload = Math.min(...workloadValues);
        
        if (maxWorkload - minWorkload > 2) {
          predictions.push({
            date: currentDate,
            probability: 0.6,
            conflictType: 'WORKLOAD_IMBALANCE',
            severity: 'MEDIUM',
            description: `Workload imbalance: ${maxWorkload} vs ${minWorkload} shifts`,
            preventiveActions: [
              'Redistribute shifts more evenly',
              'Review scheduling algorithm',
              'Consider analyst preferences'
            ],
          });
        }
      }
    }

    return predictions;
  }

  // Helper methods
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

  private getDayName(dayOfWeek: number): string {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    return days[dayOfWeek];
  }

  private getMonthName(month: number): string {
    const months = ['January', 'February', 'March', 'April', 'May', 'June',
                   'July', 'August', 'September', 'October', 'November', 'December'];
    return months[month];
  }
}
