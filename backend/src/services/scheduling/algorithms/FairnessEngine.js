"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.fairnessEngine = exports.FairnessEngine = void 0;
class FairnessEngine {
    /**
     * Calculate comprehensive fairness metrics for a set of schedules
     */
    calculateFairness(schedules, analysts) {
        const workloadAnalysis = this.analyzeWorkloads(schedules, analysts);
        const workloadDistribution = this.calculateWorkloadDistribution(workloadAnalysis);
        const screenerDistribution = this.calculateScreenerDistribution(schedules, analysts);
        const weekendDistribution = this.calculateWeekendDistribution(schedules, analysts);
        const overallFairnessScore = this.calculateOverallFairnessScore(workloadDistribution, screenerDistribution, weekendDistribution);
        const recommendations = this.generateFairnessRecommendations(workloadAnalysis, screenerDistribution, weekendDistribution);
        return {
            workloadDistribution,
            screenerDistribution,
            weekendDistribution,
            overallFairnessScore,
            recommendations
        };
    }
    /**
     * Analyze individual workload for each analyst
     */
    analyzeWorkloads(schedules, analysts) {
        const analysis = [];
        for (const analyst of analysts) {
            const analystSchedules = schedules.filter(s => s.analystId === analyst.id);
            const totalWorkDays = analystSchedules.length;
            const regularShiftDays = analystSchedules.filter(s => !s.isScreener).length;
            const screenerDays = analystSchedules.filter(s => s.isScreener).length;
            const weekendDays = analystSchedules.filter(s => {
                const dayOfWeek = new Date(s.date).getDay();
                return dayOfWeek === 0 || dayOfWeek === 6;
            }).length;
            const consecutiveWorkDays = this.calculateConsecutiveWorkDays(analystSchedules);
            const averageWorkloadPerWeek = this.calculateAverageWorkloadPerWeek(analystSchedules);
            const fairnessScore = this.calculateIndividualFairnessScore(analystSchedules, analysts.length);
            const recommendations = this.generateIndividualRecommendations(analystSchedules, totalWorkDays, screenerDays, weekendDays, consecutiveWorkDays);
            analysis.push({
                analystId: analyst.id,
                analystName: analyst.name,
                totalWorkDays,
                regularShiftDays,
                screenerDays,
                weekendDays,
                consecutiveWorkDays,
                averageWorkloadPerWeek,
                fairnessScore,
                recommendations
            });
        }
        return analysis;
    }
    /**
     * Calculate workload distribution fairness metrics
     */
    calculateWorkloadDistribution(analysis) {
        const workloads = analysis.map(a => a.totalWorkDays);
        return {
            standardDeviation: this.calculateStandardDeviation(workloads),
            giniCoefficient: this.calculateGiniCoefficient(workloads),
            maxMinRatio: Math.max(...workloads) / Math.min(...workloads)
        };
    }
    /**
     * Calculate screener assignment distribution fairness
     */
    calculateScreenerDistribution(schedules, analysts) {
        const screenerCounts = analysts.map(analyst => {
            return schedules.filter(s => s.analystId === analyst.id && s.isScreener).length;
        });
        const standardDeviation = this.calculateStandardDeviation(screenerCounts);
        const maxMinRatio = Math.max(...screenerCounts) / Math.min(...screenerCounts);
        const fairnessScore = this.calculateDistributionFairnessScore(screenerCounts);
        return {
            standardDeviation,
            maxMinRatio,
            fairnessScore
        };
    }
    /**
     * Calculate weekend assignment distribution fairness
     */
    calculateWeekendDistribution(schedules, analysts) {
        const weekendCounts = analysts.map(analyst => {
            return schedules.filter(s => {
                if (s.analystId !== analyst.id)
                    return false;
                const dayOfWeek = new Date(s.date).getDay();
                return dayOfWeek === 0 || dayOfWeek === 6;
            }).length;
        });
        const standardDeviation = this.calculateStandardDeviation(weekendCounts);
        const maxMinRatio = Math.max(...weekendCounts) / Math.min(...weekendCounts);
        const fairnessScore = this.calculateDistributionFairnessScore(weekendCounts);
        return {
            standardDeviation,
            maxMinRatio,
            fairnessScore
        };
    }
    /**
     * Calculate overall fairness score
     */
    calculateOverallFairnessScore(workloadDistribution, screenerDistribution, weekendDistribution) {
        // Weighted combination of different fairness aspects
        const workloadFairness = 1 / (1 + workloadDistribution.standardDeviation);
        const screenerFairness = screenerDistribution.fairnessScore;
        const weekendFairness = weekendDistribution.fairnessScore;
        // Weighted average (workload is most important)
        return (workloadFairness * 0.5 + screenerFairness * 0.3 + weekendFairness * 0.2);
    }
    /**
     * Calculate standard deviation
     */
    calculateStandardDeviation(values) {
        const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
        const squaredDiffs = values.map(val => Math.pow(val - mean, 2));
        const variance = squaredDiffs.reduce((sum, val) => sum + val, 0) / values.length;
        return Math.sqrt(variance);
    }
    /**
     * Calculate Gini coefficient for inequality measurement
     */
    calculateGiniCoefficient(values) {
        const sorted = [...values].sort((a, b) => a - b);
        const n = sorted.length;
        let sum = 0;
        for (let i = 0; i < n; i++) {
            sum += (2 * (i + 1) - n - 1) * sorted[i];
        }
        const total = sorted.reduce((sum, val) => sum + val, 0);
        return sum / (n * total);
    }
    /**
     * Calculate distribution fairness score (0-1, higher is fairer)
     */
    calculateDistributionFairnessScore(values) {
        const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
        const standardDeviation = this.calculateStandardDeviation(values);
        // Convert to fairness score (lower standard deviation = higher fairness)
        return Math.max(0, 1 - (standardDeviation / mean));
    }
    /**
     * Calculate consecutive work days
     */
    calculateConsecutiveWorkDays(schedules) {
        if (schedules.length === 0)
            return 0;
        const sortedDates = schedules
            .map(s => new Date(s.date))
            .sort((a, b) => a.getTime() - b.getTime());
        let maxConsecutive = 1;
        let currentConsecutive = 1;
        for (let i = 1; i < sortedDates.length; i++) {
            const daysDiff = (sortedDates[i].getTime() - sortedDates[i - 1].getTime()) / (1000 * 60 * 60 * 24);
            if (daysDiff === 1) {
                currentConsecutive++;
                maxConsecutive = Math.max(maxConsecutive, currentConsecutive);
            }
            else {
                currentConsecutive = 1;
            }
        }
        return maxConsecutive;
    }
    /**
     * Calculate average workload per week
     */
    calculateAverageWorkloadPerWeek(schedules) {
        if (schedules.length === 0)
            return 0;
        const dates = schedules.map(s => new Date(s.date));
        const minDate = new Date(Math.min(...dates.map(d => d.getTime())));
        const maxDate = new Date(Math.max(...dates.map(d => d.getTime())));
        const weeksDiff = (maxDate.getTime() - minDate.getTime()) / (1000 * 60 * 60 * 24 * 7);
        return schedules.length / Math.max(1, weeksDiff);
    }
    /**
     * Calculate individual fairness score
     */
    calculateIndividualFairnessScore(schedules, totalAnalysts) {
        const totalWorkDays = schedules.length;
        const screenerDays = schedules.filter(s => s.isScreener).length;
        const weekendDays = schedules.filter(s => {
            const dayOfWeek = new Date(s.date).getDay();
            return dayOfWeek === 0 || dayOfWeek === 6;
        }).length;
        // Normalize by expected values
        const expectedWorkDays = schedules.length / totalAnalysts;
        const expectedScreenerDays = screenerDays / totalAnalysts;
        const expectedWeekendDays = weekendDays / totalAnalysts;
        const workDayScore = Math.max(0, 1 - Math.abs(totalWorkDays - expectedWorkDays) / expectedWorkDays);
        const screenerScore = Math.max(0, 1 - Math.abs(screenerDays - expectedScreenerDays) / Math.max(1, expectedScreenerDays));
        const weekendScore = Math.max(0, 1 - Math.abs(weekendDays - expectedWeekendDays) / Math.max(1, expectedWeekendDays));
        return (workDayScore * 0.6 + screenerScore * 0.3 + weekendScore * 0.1);
    }
    /**
     * Generate fairness recommendations
     */
    generateFairnessRecommendations(analysis, screenerDistribution, weekendDistribution) {
        const recommendations = [];
        // Workload balance recommendations
        const avgWorkload = analysis.reduce((sum, a) => sum + a.totalWorkDays, 0) / analysis.length;
        const highWorkloadAnalysts = analysis.filter(a => a.totalWorkDays > avgWorkload * 1.2);
        const lowWorkloadAnalysts = analysis.filter(a => a.totalWorkDays < avgWorkload * 0.8);
        if (highWorkloadAnalysts.length > 0) {
            recommendations.push(`Consider reducing workload for ${highWorkloadAnalysts.map(a => a.analystName).join(', ')}`);
        }
        if (lowWorkloadAnalysts.length > 0) {
            recommendations.push(`Consider increasing workload for ${lowWorkloadAnalysts.map(a => a.analystName).join(', ')}`);
        }
        // Screener distribution recommendations
        if (screenerDistribution.fairnessScore < 0.7) {
            recommendations.push('Screener assignments are unevenly distributed. Consider rebalancing.');
        }
        // Weekend distribution recommendations
        if (weekendDistribution.fairnessScore < 0.7) {
            recommendations.push('Weekend assignments are unevenly distributed. Consider rebalancing.');
        }
        // Consecutive work days recommendations
        const analystsWithLongStreaks = analysis.filter(a => a.consecutiveWorkDays > 5);
        if (analystsWithLongStreaks.length > 0) {
            recommendations.push(`Analysts with long consecutive work streaks: ${analystsWithLongStreaks.map(a => a.analystName).join(', ')}`);
        }
        return recommendations;
    }
    /**
     * Generate individual recommendations
     */
    generateIndividualRecommendations(schedules, totalWorkDays, screenerDays, weekendDays, consecutiveWorkDays) {
        const recommendations = [];
        if (consecutiveWorkDays > 5) {
            recommendations.push('Consider adding breaks between consecutive work days');
        }
        if (screenerDays > totalWorkDays * 0.3) {
            recommendations.push('High screener workload - consider reducing screener assignments');
        }
        if (weekendDays > totalWorkDays * 0.2) {
            recommendations.push('High weekend workload - consider reducing weekend assignments');
        }
        return recommendations;
    }
}
exports.FairnessEngine = FairnessEngine;
exports.fairnessEngine = new FairnessEngine();
