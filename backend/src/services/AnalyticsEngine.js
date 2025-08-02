"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AnalyticsEngine = void 0;
class AnalyticsEngine {
    constructor(prisma, cache) {
        this.prisma = prisma;
        this.cache = cache;
    }
    calculateMonthlyTallies(month, year) {
        return __awaiter(this, void 0, void 0, function* () {
            const cacheKey = `monthly_tallies_${year}_${month}`;
            // Try to get from cache first
            const cached = yield this.cache.get(cacheKey);
            if (cached) {
                return cached;
            }
            const startDate = new Date(year, month - 1, 1);
            const endDate = new Date(year, month, 0);
            const schedules = yield this.prisma.schedule.findMany({
                where: {
                    date: {
                        gte: startDate,
                        lte: endDate,
                    },
                },
                include: {
                    analyst: true,
                },
                orderBy: {
                    date: 'asc',
                },
            });
            const analystMap = new Map();
            for (const schedule of schedules) {
                const analystId = schedule.analystId;
                if (!analystMap.has(analystId)) {
                    analystMap.set(analystId, {
                        analystId,
                        analystName: schedule.analyst.name,
                        month,
                        year,
                        totalWorkDays: 0,
                        regularShiftDays: 0,
                        screenerDays: 0,
                        weekendDays: 0,
                        consecutiveWorkDayStreaks: 0,
                        fairnessScore: 0,
                    });
                }
                const tally = analystMap.get(analystId);
                tally.totalWorkDays++;
                if (schedule.isScreener) {
                    tally.screenerDays++;
                }
                else {
                    tally.regularShiftDays++;
                }
                if (schedule.shiftType === 'WEEKEND') {
                    tally.weekendDays++;
                }
            }
            // Calculate consecutive work day streaks and fairness scores
            for (const [analystId, tally] of analystMap) {
                const analystSchedules = schedules.filter((s) => s.analystId === analystId);
                tally.consecutiveWorkDayStreaks = this.calculateConsecutiveStreaks(analystSchedules);
                tally.fairnessScore = this.calculateIndividualFairnessScore(tally, analystSchedules);
            }
            const result = Array.from(analystMap.values());
            // Cache the result for 1 hour
            yield this.cache.set(cacheKey, result, 3600);
            return result;
        });
    }
    generateFairnessReport(dateRange) {
        return __awaiter(this, void 0, void 0, function* () {
            const cacheKey = `fairness_report_${dateRange.startDate.toISOString()}_${dateRange.endDate.toISOString()}`;
            const cached = yield this.cache.get(cacheKey);
            if (cached) {
                return cached;
            }
            const schedules = yield this.prisma.schedule.findMany({
                where: {
                    date: {
                        gte: dateRange.startDate,
                        lte: dateRange.endDate,
                    },
                },
                include: {
                    analyst: true,
                },
            });
            const analysts = yield this.prisma.analyst.findMany({
                where: { isActive: true },
            });
            // Calculate workload distribution
            const workloads = analysts.map((analyst) => {
                const analystSchedules = schedules.filter((s) => s.analystId === analyst.id);
                return analystSchedules.length;
            });
            const workloadDistribution = {
                standardDeviation: this.calculateStandardDeviation(workloads),
                giniCoefficient: this.calculateGiniCoefficient(workloads),
                maxMinRatio: Math.max(...workloads) / Math.min(...workloads),
            };
            // Calculate screener distribution
            const screenerCounts = analysts.map((analyst) => {
                const analystSchedules = schedules.filter((s) => s.analystId === analyst.id && s.isScreener);
                return analystSchedules.length;
            });
            const screenerDistribution = {
                fairnessScore: this.calculateDistributionFairness(screenerCounts),
                distribution: Object.fromEntries(analysts.map((analyst, index) => [analyst.name, screenerCounts[index]])),
            };
            // Calculate weekend distribution
            const weekendCounts = analysts.map((analyst) => {
                const analystSchedules = schedules.filter((s) => s.analystId === analyst.id && s.shiftType === 'WEEKEND');
                return analystSchedules.length;
            });
            const weekendDistribution = {
                fairnessScore: this.calculateDistributionFairness(weekendCounts),
                distribution: Object.fromEntries(analysts.map((analyst, index) => [analyst.name, weekendCounts[index]])),
            };
            // Calculate individual scores
            const individualScores = analysts.map((analyst) => {
                const analystSchedules = schedules.filter((s) => s.analystId === analyst.id);
                const workload = analystSchedules.length;
                const screenerDays = analystSchedules.filter((s) => s.isScreener).length;
                const weekendDays = analystSchedules.filter((s) => s.shiftType === 'WEEKEND').length;
                return {
                    analystId: analyst.id,
                    analystName: analyst.name,
                    fairnessScore: this.calculateIndividualFairnessScore({
                        totalWorkDays: workload,
                        screenerDays,
                        weekendDays,
                        consecutiveWorkDayStreaks: this.calculateConsecutiveStreaks(analystSchedules),
                    }, analystSchedules),
                    workload,
                    screenerDays,
                    weekendDays,
                };
            });
            // Generate recommendations
            const recommendations = this.generateRecommendations({
                workloadDistribution,
                screenerDistribution,
                weekendDistribution,
                individualScores,
            });
            const overallFairnessScore = (workloadDistribution.standardDeviation * 0.4 +
                screenerDistribution.fairnessScore * 0.3 +
                weekendDistribution.fairnessScore * 0.3);
            const result = {
                dateRange,
                overallFairnessScore,
                workloadDistribution,
                screenerDistribution,
                weekendDistribution,
                individualScores,
                recommendations,
            };
            // Cache for 30 minutes
            yield this.cache.set(cacheKey, result, 1800);
            return result;
        });
    }
    predictWorkloadTrends(futureMonths) {
        return __awaiter(this, void 0, void 0, function* () {
            const predictions = [];
            const currentDate = new Date();
            // Get historical data for the last 6 months
            const historicalData = yield this.prisma.schedule.findMany({
                where: {
                    date: {
                        gte: new Date(currentDate.getFullYear(), currentDate.getMonth() - 6, 1),
                        lte: currentDate,
                    },
                },
            });
            // Simple trend analysis (can be enhanced with ML)
            for (let i = 1; i <= futureMonths; i++) {
                const futureDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + i, 1);
                // Calculate average workload for the same month in historical data
                const sameMonthData = historicalData.filter((s) => s.date.getMonth() === futureDate.getMonth());
                const averageWorkload = sameMonthData.length > 0
                    ? sameMonthData.length / 6 // Average per month
                    : 20; // Default prediction
                predictions.push({
                    date: futureDate,
                    predictedWorkload: Math.round(averageWorkload),
                    confidence: 0.7, // 70% confidence for simple prediction
                    factors: ['Historical trend', 'Seasonal patterns'],
                });
            }
            return predictions;
        });
    }
    identifyOptimizationOpportunities(schedules) {
        return __awaiter(this, void 0, void 0, function* () {
            const opportunities = [];
            // Analyze workload balance
            const workloads = new Map();
            for (const schedule of schedules) {
                const current = workloads.get(schedule.analystId) || 0;
                workloads.set(schedule.analystId, current + 1);
            }
            const workloadValues = Array.from(workloads.values());
            const avgWorkload = workloadValues.reduce((a, b) => a + b, 0) / workloadValues.length;
            const maxWorkload = Math.max(...workloadValues);
            const minWorkload = Math.min(...workloadValues);
            if (maxWorkload - minWorkload > avgWorkload * 0.3) {
                opportunities.push({
                    type: 'WORKLOAD_BALANCE',
                    severity: maxWorkload - minWorkload > avgWorkload * 0.5 ? 'HIGH' : 'MEDIUM',
                    description: `Workload imbalance detected. Max: ${maxWorkload}, Min: ${minWorkload}, Avg: ${Math.round(avgWorkload)}`,
                    impact: (maxWorkload - minWorkload) / avgWorkload,
                    suggestedActions: [
                        'Redistribute shifts from high-workload analysts',
                        'Increase shifts for low-workload analysts',
                        'Review scheduling algorithm parameters',
                    ],
                    affectedAnalysts: Array.from(workloads.entries())
                        .filter(([_, workload]) => workload > avgWorkload * 1.2 || workload < avgWorkload * 0.8)
                        .map(([analystId, _]) => analystId),
                });
            }
            // Analyze screener distribution
            const screenerCounts = new Map();
            for (const schedule of schedules) {
                if (schedule.isScreener) {
                    const current = screenerCounts.get(schedule.analystId) || 0;
                    screenerCounts.set(schedule.analystId, current + 1);
                }
            }
            const screenerValues = Array.from(screenerCounts.values());
            if (screenerValues.length > 0) {
                const avgScreeners = screenerValues.reduce((a, b) => a + b, 0) / screenerValues.length;
                const maxScreeners = Math.max(...screenerValues);
                const minScreeners = Math.min(...screenerValues);
                if (maxScreeners - minScreeners > 2) {
                    opportunities.push({
                        type: 'SCREENER_DISTRIBUTION',
                        severity: maxScreeners - minScreeners > 4 ? 'HIGH' : 'MEDIUM',
                        description: `Uneven screener distribution. Max: ${maxScreeners}, Min: ${minScreeners}, Avg: ${Math.round(avgScreeners)}`,
                        impact: (maxScreeners - minScreeners) / avgScreeners,
                        suggestedActions: [
                            'Rotate screener assignments more evenly',
                            'Train more analysts for screener duties',
                            'Implement screener rotation algorithm',
                        ],
                        affectedAnalysts: Array.from(screenerCounts.entries())
                            .filter(([_, count]) => count > avgScreeners * 1.5 || count < avgScreeners * 0.5)
                            .map(([analystId, _]) => analystId),
                    });
                }
            }
            return opportunities;
        });
    }
    calculateConsecutiveStreaks(schedules) {
        if (schedules.length === 0)
            return 0;
        const sortedSchedules = schedules.sort((a, b) => a.date.getTime() - b.date.getTime());
        let maxStreak = 1;
        let currentStreak = 1;
        for (let i = 1; i < sortedSchedules.length; i++) {
            const prevDate = new Date(sortedSchedules[i - 1].date);
            const currDate = new Date(sortedSchedules[i].date);
            // Check if dates are consecutive
            const diffTime = currDate.getTime() - prevDate.getTime();
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            if (diffDays === 1) {
                currentStreak++;
                maxStreak = Math.max(maxStreak, currentStreak);
            }
            else {
                currentStreak = 1;
            }
        }
        return maxStreak;
    }
    calculateIndividualFairnessScore(tally, schedules) {
        // Simple fairness score based on workload balance
        // Higher score = more fair
        const baseScore = 1.0;
        // Penalize for very high consecutive streaks
        const streakPenalty = Math.max(0, (tally.consecutiveWorkDayStreaks - 5) * 0.1);
        // Bonus for balanced screener and weekend distribution
        const screenerBalance = tally.screenerDays > 0 ? 0.1 : 0;
        const weekendBalance = tally.weekendDays > 0 ? 0.1 : 0;
        return Math.max(0, Math.min(1, baseScore - streakPenalty + screenerBalance + weekendBalance));
    }
    calculateStandardDeviation(values) {
        if (values.length === 0)
            return 0;
        const mean = values.reduce((a, b) => a + b, 0) / values.length;
        const squaredDiffs = values.map(value => Math.pow(value - mean, 2));
        const variance = squaredDiffs.reduce((a, b) => a + b, 0) / values.length;
        return Math.sqrt(variance);
    }
    calculateGiniCoefficient(values) {
        if (values.length === 0)
            return 0;
        const sorted = [...values].sort((a, b) => a - b);
        const n = sorted.length;
        let sum = 0;
        for (let i = 0; i < n; i++) {
            sum += (2 * (i + 1) - n - 1) * sorted[i];
        }
        return sum / (n * sorted.reduce((a, b) => a + b, 0));
    }
    calculateDistributionFairness(values) {
        if (values.length === 0)
            return 1;
        const mean = values.reduce((a, b) => a + b, 0) / values.length;
        const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
        const standardDeviation = Math.sqrt(variance);
        // Convert to fairness score (0-1, where 1 is perfectly fair)
        return Math.max(0, 1 - (standardDeviation / mean));
    }
    generateRecommendations(data) {
        const recommendations = [];
        if (data.workloadDistribution.standardDeviation > 2) {
            recommendations.push('Consider redistributing workload to reduce variance');
        }
        if (data.screenerDistribution.fairnessScore < 0.7) {
            recommendations.push('Implement more equitable screener rotation');
        }
        if (data.weekendDistribution.fairnessScore < 0.7) {
            recommendations.push('Balance weekend assignments across all analysts');
        }
        const lowFairnessAnalysts = data.individualScores.filter((s) => s.fairnessScore < 0.5);
        if (lowFairnessAnalysts.length > 0) {
            recommendations.push(`Review scheduling for ${lowFairnessAnalysts.length} analysts with low fairness scores`);
        }
        return recommendations;
    }
}
exports.AnalyticsEngine = AnalyticsEngine;
