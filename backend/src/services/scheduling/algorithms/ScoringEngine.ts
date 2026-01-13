import moment from 'moment-timezone';

export interface ScoringFactors {
    consecutiveDays: number;
    turnaroundTime: number;
    workload: number;
    rolePreference: number;
    weekendFairness: number;
    debtRepayment: number;
    coverageFatigue: number;
}

export interface ScoredCandidate {
    analystId: string;
    analystName: string;
    score: number;
    factors: ScoringFactors;
    reasoning: string[];
}

export class ScoringEngine {
    // Weights for different factors (can be tuned)
    private weights = {
        CONSECUTIVE_DAYS: 20,
        TURNAROUND_TIME: 30,
        WORKLOAD: 15,
        ROLE_PREFERENCE: 10,
        WEEKEND_FAIRNESS: 25,
        DEBT_REPAYMENT: 50, // High priority to repay debt
        COVERAGE_FATIGUE: 30 // Penalty for overuse
    };

    /**
     * Calculate scores for a list of candidates for a specific shift
     */
    calculateScores(
        candidates: any[],
        targetDate: string,
        shiftType: string, // Dynamic shift type from ShiftDefinition
        history: any[],
        debtMap: Map<string, number> = new Map(),
        coverageCounts: Map<string, number> = new Map()
    ): ScoredCandidate[] {
        return candidates.map(candidate => this.scoreCandidate(candidate, targetDate, shiftType, history, debtMap, coverageCounts));
    }

    /**
     * Score a single candidate
     */
    private scoreCandidate(
        candidate: any,
        targetDate: string,
        shiftType: string, // Dynamic shift type
        history: any[],
        debtMap: Map<string, number>,
        coverageCounts: Map<string, number>
    ): ScoredCandidate {
        const factors: ScoringFactors = {
            consecutiveDays: this.calculateConsecutiveDaysScore(candidate, targetDate, history),
            turnaroundTime: this.calculateTurnaroundScore(candidate, targetDate, shiftType, history),
            workload: this.calculateWorkloadScore(candidate, targetDate, history),
            rolePreference: this.calculatePreferenceScore(candidate, targetDate, shiftType),
            weekendFairness: this.calculateWeekendScore(candidate, targetDate, shiftType, history),
            debtRepayment: this.calculateDebtScore(candidate, debtMap),
            coverageFatigue: this.calculateCoverageFatigueScore(candidate, coverageCounts)
        };

        // Base score calculation
        let score =
            (factors.consecutiveDays * this.weights.CONSECUTIVE_DAYS) +
            (factors.turnaroundTime * this.weights.TURNAROUND_TIME) +
            (factors.workload * this.weights.WORKLOAD) +
            (factors.rolePreference * this.weights.ROLE_PREFERENCE) +
            (factors.weekendFairness * this.weights.WEEKEND_FAIRNESS);

        // Add Debt Repayment Boost (Add directly to score, don't just weight 0-1)
        // Actually, let's stick to 0-1 normalized factors * weight
        score += factors.debtRepayment * this.weights.DEBT_REPAYMENT;

        // Subtract Coverage Fatigue (Penalty)
        // Factor is 0.0 (bad) to 1.0 (good). So we ADD it.
        // If fatigue is high, score is low.
        // Wait, calculateCoverageFatigueScore should return 1.0 for NO fatigue, 0.0 for HIGH fatigue.
        score += factors.coverageFatigue * this.weights.COVERAGE_FATIGUE;

        const reasoning = this.generateReasoning(factors);

        return {
            analystId: candidate.id,
            analystName: candidate.name,
            score: Math.round(score), // Normalize to integer
            factors,
            reasoning
        };
    }

    private calculateConsecutiveDaysScore(candidate: any, targetDate: string, history: any[]): number {
        // Check how many consecutive days worked leading up to targetDate
        let consecutive = 0;
        const targetMoment = moment(targetDate);

        // Look back up to 10 days
        for (let i = 1; i <= 10; i++) {
            const checkDate = moment(targetMoment).subtract(i, 'days').format('YYYY-MM-DD');
            const worked = history.some(h => h.analystId === candidate.id && h.date === checkDate);
            if (worked) {
                consecutive++;
            } else {
                break;
            }
        }

        // Score: 1.0 for 0-4 days, drops sharply after 5
        if (consecutive < 5) return 1.0;
        if (consecutive === 5) return 0.5;
        if (consecutive === 6) return 0.1;
        return 0.0;
    }

    private calculateTurnaroundScore(candidate: any, targetDate: string, shiftType: string, history: any[]): number {
        // Check for "Clopening" (late shift -> early shift)
        // Early shifts: AM, MORNING, or any shift starting before noon
        const isEarlyShift = shiftType === 'AM' || shiftType === 'MORNING' || shiftType.toUpperCase().includes('AM');
        if (!isEarlyShift) return 1.0; // Only relevant for early/morning shifts

        const prevDate = moment(targetDate).subtract(1, 'days').format('YYYY-MM-DD');
        // Check if worked a late shift before (PM, EVENING, or any shift containing 'PM'/'EVENING')
        const workedLateShiftBefore = history.some(h =>
            h.analystId === candidate.id &&
            h.date === prevDate &&
            (h.shiftType === 'PM' || h.shiftType === 'EVENING' || (h.shiftType && h.shiftType.toUpperCase().includes('PM')))
        );

        return workedLateShiftBefore ? 0.0 : 1.0; // 0 score if clopening
    }

    private calculateWorkloadScore(candidate: any, targetDate: string, history: any[]): number {
        // Check total shifts in the last 7 days
        const startWindow = moment(targetDate).subtract(7, 'days');
        const shiftsInWindow = history.filter(h =>
            h.analystId === candidate.id &&
            moment(h.date).isAfter(startWindow) &&
            moment(h.date).isBefore(targetDate)
        ).length;

        // Ideal: 3-4 shifts. >5 is heavy.
        if (shiftsInWindow <= 4) return 1.0;
        if (shiftsInWindow === 5) return 0.7;
        if (shiftsInWindow >= 6) return 0.3;
        return 1.0;
    }

    private calculatePreferenceScore(candidate: any, targetDate: string, shiftType: string): number {
        // If candidate has a preferred shift type
        if (candidate.shiftType === shiftType) return 1.0;

        const isTargetWeekend = moment(targetDate).day() === 0 || moment(targetDate).day() === 6;
        // If candidate works weekends and target is weekend
        if (isTargetWeekend && candidate.worksWeekends) return 1.0;

        return 0.5; // Neutral if not preferred
    }

    private calculateWeekendScore(candidate: any, targetDate: string, shiftType: string, history: any[]): number {
        const isWeekend = moment(targetDate).day() === 0 || moment(targetDate).day() === 6;
        if (!isWeekend) return 1.0; // Not relevant for weekdays

        // Check if worked last weekend
        const lastWeekend = moment(targetDate).subtract(7, 'days'); // Approx
        // This is a simplified check. Real logic might be more complex.

        // For now, just check total weekend shifts in history
        const weekendShifts = history.filter(h =>
            h.analystId === candidate.id &&
            (moment(h.date).day() === 0 || moment(h.date).day() === 6)
        ).length;

        // Inverse to number of weekend shifts (fewer is better for fairness)
        // Normalize: assume max 4 weekend shifts in recent history is "bad"
        return Math.max(0, 1.0 - (weekendShifts * 0.2));
    }

    private calculateDebtScore(candidate: any, debtMap: Map<string, number>): number {
        const debt = debtMap.get(candidate.id) || 0;
        if (debt > 0) return 1.0; // Has debt, prioritize (High score)
        if (debt < 0) return 0.0; // Has credit, deprioritize (Low score)
        return 0.5; // Neutral
    }

    private calculateCoverageFatigueScore(candidate: any, coverageCounts: Map<string, number>): number {
        const count = coverageCounts.get(candidate.id) || 0;
        // 0 coverage = 1.0 (Fresh)
        // 1 coverage = 0.8
        // 2 coverage = 0.5
        // 3+ coverage = 0.0 (Fatigued)
        if (count === 0) return 1.0;
        if (count === 1) return 0.8;
        if (count === 2) return 0.5;
        return 0.0;
    }

    private generateReasoning(factors: ScoringFactors): string[] {
        const reasons: string[] = [];
        if (factors.turnaroundTime < 0.5) reasons.push("Avoids clopening risk");
        if (factors.consecutiveDays < 0.5) reasons.push("High consecutive days warning");
        if (factors.consecutiveDays === 1.0) reasons.push("Fresh (low consecutive days)");
        if (factors.workload === 1.0) reasons.push("Good workload balance");
        if (factors.rolePreference === 1.0) reasons.push("Matches shift preference");
        if (factors.debtRepayment === 1.0) reasons.push("Repaying fairness debt");
        if (factors.coverageFatigue < 0.5) reasons.push("High coverage fatigue");
        return reasons;
    }
}

export const scoringEngine = new ScoringEngine();
