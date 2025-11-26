import { Analyst, SchedulingConstraint } from '../../../../generated/prisma';
import { ProposedSchedule, FairnessMetrics, WorkloadAnalysis } from './types';

export class FairnessEngine {

    /**
     * Calculate comprehensive fairness metrics for a set of schedules
     */
    calculateFairness(schedules: ProposedSchedule[], analysts: Analyst[]): FairnessMetrics {
        const workloadAnalysis = this.analyzeWorkloads(schedules, analysts);

        const workloadDistribution = this.calculateWorkloadDistribution(workloadAnalysis);
        const screenerDistribution = this.calculateScreenerDistribution(schedules, analysts);
        const weekendDistribution = this.calculateWeekendDistribution(schedules, analysts);

        const overallFairnessScore = this.calculateOverallFairnessScore(
            workloadDistribution,
            screenerDistribution,
            weekendDistribution
        );

        const recommendations = this.generateFairnessRecommendations(
            workloadAnalysis,
            screenerDistribution,
            weekendDistribution
        );

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
    analyzeWorkloads(schedules: ProposedSchedule[], analysts: Analyst[]): WorkloadAnalysis[] {
        const analysis: WorkloadAnalysis[] = [];

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

            const recommendations = this.generateIndividualRecommendations(
                analystSchedules,
                totalWorkDays,
                screenerDays,
                weekendDays,
                consecutiveWorkDays
            );

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
    private calculateWorkloadDistribution(analysis: WorkloadAnalysis[]) {
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
    /**
     * Calculate screener assignment distribution fairness (Stratified by Shift Type)
     */
    private calculateScreenerDistribution(schedules: ProposedSchedule[], analysts: Analyst[]) {
        // Stratify analysts by shift type
        const morningAnalysts = analysts.filter(a => a.shiftType === 'MORNING');
        const eveningAnalysts = analysts.filter(a => a.shiftType === 'EVENING');

        // Helper to calculate metrics for a group
        const calculateGroupMetrics = (group: Analyst[]) => {
            if (group.length === 0) return { standardDeviation: 0, maxMinRatio: 1, fairnessScore: 1 };

            const activeRatios = group.map(analyst => {
                const analystSchedules = schedules.filter(s => s.analystId === analyst.id);
                if (analystSchedules.length === 0) return null;
                const screenerShifts = analystSchedules.filter(s => s.isScreener).length;
                return screenerShifts / analystSchedules.length;
            }).filter(r => r !== null) as number[];

            if (activeRatios.length === 0) return { standardDeviation: 0, maxMinRatio: 1, fairnessScore: 1 };

            const standardDeviation = this.calculateStandardDeviation(activeRatios);
            const maxMinRatio = Math.min(...activeRatios) > 0 ? Math.max(...activeRatios) / Math.min(...activeRatios) : 0;
            const fairnessScore = this.calculateDistributionFairnessScore(activeRatios);

            return { standardDeviation, maxMinRatio, fairnessScore };
        };

        const morningMetrics = calculateGroupMetrics(morningAnalysts);
        const eveningMetrics = calculateGroupMetrics(eveningAnalysts);

        // Combine metrics (Weighted average based on pool size? Or simple average? Simple average is fairer to the "concept" of fairness)
        // Actually, if we want the "Overall System Fairness", we should average the scores.

        return {
            standardDeviation: (morningMetrics.standardDeviation + eveningMetrics.standardDeviation) / 2,
            maxMinRatio: (morningMetrics.maxMinRatio + eveningMetrics.maxMinRatio) / 2,
            fairnessScore: (morningMetrics.fairnessScore + eveningMetrics.fairnessScore) / 2
        };
    }

    /**
     * Calculate weekend assignment distribution fairness
     */
    private calculateWeekendDistribution(schedules: ProposedSchedule[], analysts: Analyst[]) {
        const weekendCounts = analysts.map(analyst => {
            return schedules.filter(s => {
                if (s.analystId !== analyst.id) return false;
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
    private calculateOverallFairnessScore(
        workloadDistribution: any,
        screenerDistribution: any,
        weekendDistribution: any
    ): number {
        // Weighted combination of different fairness aspects

        // Use CV-based fairness for workload too, consistent with others
        // We need mean for CV. workloadDistribution has SD but maybe not mean?
        // Let's assume we can't easily get mean here without changing calculateWorkloadDistribution.
        // But wait, 1 / (1 + SD) is very harsh. 
        // If we don't have mean, we can't use CV.
        // Let's check calculateWorkloadDistribution again. It calculates SD from raw values.

        // Alternative: Use Gini coefficient which is 0 (perfect) to 1 (unfair).
        // Fairness = 1 - Gini.
        const workloadFairness = 1 - workloadDistribution.giniCoefficient;

        const screenerFairness = screenerDistribution.fairnessScore;
        const weekendFairness = weekendDistribution.fairnessScore;

        // Weighted average (workload is most important)
        return (workloadFairness * 0.5 + screenerFairness * 0.3 + weekendFairness * 0.2);
    }

    /**
     * Calculate standard deviation
     */
    private calculateStandardDeviation(values: number[]): number {
        if (values.length === 0) return 0;
        const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
        const squaredDiffs = values.map(val => Math.pow(val - mean, 2));
        const variance = squaredDiffs.reduce((sum, val) => sum + val, 0) / values.length;
        return Math.sqrt(variance);
    }

    /**
     * Calculate Gini coefficient for inequality measurement
     */
    private calculateGiniCoefficient(values: number[]): number {
        if (values.length === 0) return 0;
        const sorted = [...values].sort((a, b) => a - b);
        const n = sorted.length;
        let sum = 0;

        for (let i = 0; i < n; i++) {
            sum += (2 * (i + 1) - n - 1) * sorted[i];
        }

        const total = sorted.reduce((sum, val) => sum + val, 0);
        if (total === 0) return 0; // Perfect equality (everyone has 0)
        return sum / (n * total);
    }

    /**
     * Calculate distribution fairness score (0-1, higher is fairer)
     */
    private calculateDistributionFairnessScore(values: number[]): number {
        if (values.length === 0) return 1;
        const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
        if (mean === 0) return 1; // Everyone has 0, perfectly fair

        const standardDeviation = this.calculateStandardDeviation(values);

        // Convert to fairness score (lower standard deviation = higher fairness)
        // CV = SD / Mean
        // Fairness = 1 - CV
        return Math.max(0, 1 - (standardDeviation / mean));
    }

    /**
     * Calculate consecutive work days
     */
    private calculateConsecutiveWorkDays(schedules: ProposedSchedule[]): number {
        if (schedules.length === 0) return 0;

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
            } else {
                currentConsecutive = 1;
            }
        }

        return maxConsecutive;
    }

    /**
     * Calculate average workload per week
     */
    private calculateAverageWorkloadPerWeek(schedules: ProposedSchedule[]): number {
        if (schedules.length === 0) return 0;

        const dates = schedules.map(s => new Date(s.date));
        const minDate = new Date(Math.min(...dates.map(d => d.getTime())));
        const maxDate = new Date(Math.max(...dates.map(d => d.getTime())));

        const weeksDiff = (maxDate.getTime() - minDate.getTime()) / (1000 * 60 * 60 * 24 * 7);
        return schedules.length / Math.max(1, weeksDiff);
    }

    /**
     * Calculate individual fairness score
     */
    public calculateIndividualFairnessScore(schedules: ProposedSchedule[], totalAnalysts: number): number {
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
    private generateFairnessRecommendations(
        analysis: WorkloadAnalysis[],
        screenerDistribution: any,
        weekendDistribution: any
    ): string[] {
        const recommendations: string[] = [];

        // Workload balance recommendations
        const avgWorkload = analysis.reduce((sum, a) => sum + a.totalWorkDays, 0) / analysis.length;
        const highWorkloadAnalysts = analysis.filter(a => a.totalWorkDays > avgWorkload * 1.2);
        const lowWorkloadAnalysts = analysis.filter(a => a.totalWorkDays < avgWorkload * 0.8);

        if (highWorkloadAnalysts.length > 0) {
            recommendations.push(
                `Consider reducing workload for ${highWorkloadAnalysts.map(a => a.analystName).join(', ')}`
            );
        }

        if (lowWorkloadAnalysts.length > 0) {
            recommendations.push(
                `Consider increasing workload for ${lowWorkloadAnalysts.map(a => a.analystName).join(', ')}`
            );
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
            recommendations.push(
                `Analysts with long consecutive work streaks: ${analystsWithLongStreaks.map(a => a.analystName).join(', ')}`
            );
        }

        return recommendations;
    }

    /**
     * Generate individual recommendations
     */
    private generateIndividualRecommendations(
        schedules: ProposedSchedule[],
        totalWorkDays: number,
        screenerDays: number,
        weekendDays: number,
        consecutiveWorkDays: number
    ): string[] {
        const recommendations: string[] = [];

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

export const fairnessEngine = new FairnessEngine(); 