import moment from 'moment-timezone';

export interface ScoringFactors {
    consecutiveDays: number;
    turnaroundTime: number;
    workload: number;
    rolePreference: number;
    weekendFairness: number;
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
        WEEKEND_FAIRNESS: 25
    };

    /**
     * Calculate scores for a list of candidates for a specific shift
     */
    calculateScores(
        candidates: any[],
        targetDate: string,
        shiftType: 'MORNING' | 'EVENING' | 'WEEKEND',
        history: any[]
    ): ScoredCandidate[] {
        return candidates.map(candidate => this.scoreCandidate(candidate, targetDate, shiftType, history));
    }

    /**
     * Score a single candidate
     */
    private scoreCandidate(
        candidate: any,
        targetDate: string,
        shiftType: 'MORNING' | 'EVENING' | 'WEEKEND',
        history: any[]
    ): ScoredCandidate {
        const factors: ScoringFactors = {
            consecutiveDays: this.calculateConsecutiveDaysScore(candidate, targetDate, history),
            turnaroundTime: this.calculateTurnaroundScore(candidate, targetDate, shiftType, history),
            workload: this.calculateWorkloadScore(candidate, targetDate, history),
            rolePreference: this.calculatePreferenceScore(candidate, targetDate, shiftType),
            weekendFairness: this.calculateWeekendScore(candidate, targetDate, shiftType, history)
        };

        const score =
            (factors.consecutiveDays * this.weights.CONSECUTIVE_DAYS) +
            (factors.turnaroundTime * this.weights.TURNAROUND_TIME) +
            (factors.workload * this.weights.WORKLOAD) +
            (factors.rolePreference * this.weights.ROLE_PREFERENCE) +
            (factors.weekendFairness * this.weights.WEEKEND_FAIRNESS);

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
        // Check for "Clopening" (Evening -> Morning)
        if (shiftType !== 'MORNING') return 1.0; // Only relevant for morning shifts

        const prevDate = moment(targetDate).subtract(1, 'days').format('YYYY-MM-DD');
        const workedEveningBefore = history.some(h =>
            h.analystId === candidate.id &&
            h.date === prevDate &&
            h.shiftType === 'EVENING'
        );

        return workedEveningBefore ? 0.0 : 1.0; // 0 score if clopening
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
        // If candidate prefers weekends (assuming candidate.shiftType can be 'WEEKEND')
        if (candidate.shiftType === 'WEEKEND' && isTargetWeekend) return 1.0;

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

    private generateReasoning(factors: ScoringFactors): string[] {
        const reasons: string[] = [];
        if (factors.turnaroundTime < 0.5) reasons.push("Avoids clopening risk");
        if (factors.consecutiveDays < 0.5) reasons.push("High consecutive days warning");
        if (factors.consecutiveDays === 1.0) reasons.push("Fresh (low consecutive days)");
        if (factors.workload === 1.0) reasons.push("Good workload balance");
        if (factors.rolePreference === 1.0) reasons.push("Matches shift preference");
        return reasons;
    }
}

export const scoringEngine = new ScoringEngine();
