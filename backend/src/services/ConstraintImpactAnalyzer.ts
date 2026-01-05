import { PrismaClient, SchedulingConstraint, Schedule, Analyst } from '../../generated/prisma';
import { prisma } from '../lib/prisma';
import { constraintEngine } from './scheduling/algorithms/ConstraintEngine';
import { FairnessTracker } from './scheduling/FairnessTracker';

export interface ImpactAssessment {
    constraintId?: string;
    constraintType: string;
    dateRange: { start: Date; end: Date };

    // What schedules will be affected
    affectedSchedules: {
        scheduleId: string;
        date: string;
        analystId: string;
        analystName: string;
        shiftType: string;
        action: 'REMOVE' | 'MODIFY' | 'CONFLICT';
        reason: string;
    }[];

    // Fairness impact
    fairnessDelta: {
        before: number;
        after: number;
        change: number;
        affectedAnalysts: {
            analystId: string;
            analystName: string;
            workdaysBefore: number;
            workdaysAfter: number;
            delta: number;
        }[];
    };

    // Alternative suggestions
    alternatives: {
        type: 'REASSIGN' | 'SWAP' | 'CANCEL';
        description: string;
        affectedAnalysts: string[];
        fairnessScore: number;
    }[];

    // Comp-off implications
    compOffGrant?: {
        analystId: string;
        units: number;
        reason: string;
    };

    // Summary
    severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    summary: string;
    requiresRecalculation: boolean;
}

export class ConstraintImpactAnalyzer {
    private prisma: PrismaClient;

    constructor(prismaClient?: PrismaClient) {
        this.prisma = prismaClient || prisma;
    }

    /**
     * Analyze the impact of adding a new constraint.
     */
    async analyzeNewConstraint(
        constraintType: string,
        startDate: Date,
        endDate: Date,
        analystId?: string,
        templateId?: string,
        templateParams?: Record<string, any>
    ): Promise<ImpactAssessment> {
        // Get existing schedules in the date range
        const existingSchedules = await this.getSchedulesInRange(startDate, endDate, analystId);

        // Get all analysts for fairness calculation
        const analysts = await this.prisma.analyst.findMany({
            where: { isActive: true },
        });

        // Analyze impact based on constraint type
        const affectedSchedules = this.findAffectedSchedules(
            existingSchedules,
            constraintType,
            startDate,
            endDate,
            analystId,
            templateParams
        );

        // Calculate fairness delta
        const fairnessDelta = await this.calculateFairnessDelta(
            existingSchedules,
            affectedSchedules,
            analysts
        );

        // Generate alternatives
        const alternatives = this.generateAlternatives(
            affectedSchedules,
            analysts,
            constraintType
        );

        // Determine severity
        const severity = this.determineSeverity(affectedSchedules.length, fairnessDelta.change);

        // Check if this grants comp-off (e.g., forcing work on a day off)
        const compOffGrant = this.checkCompOffGrant(constraintType, analystId, affectedSchedules);

        return {
            constraintType,
            dateRange: { start: startDate, end: endDate },
            affectedSchedules,
            fairnessDelta,
            alternatives,
            compOffGrant,
            severity,
            summary: this.generateSummary(affectedSchedules, fairnessDelta, severity),
            requiresRecalculation: affectedSchedules.length > 0,
        };
    }

    /**
     * Analyze the impact of modifying an existing constraint.
     */
    async analyzeConstraintModification(
        constraintId: string,
        newStartDate?: Date,
        newEndDate?: Date,
        newParams?: Record<string, any>
    ): Promise<ImpactAssessment> {
        const constraint = await this.prisma.schedulingConstraint.findUnique({
            where: { id: constraintId },
        });

        if (!constraint) {
            throw new Error(`Constraint not found: ${constraintId}`);
        }

        const startDate = newStartDate || constraint.startDate;
        const endDate = newEndDate || constraint.endDate;

        const assessment = await this.analyzeNewConstraint(
            constraint.constraintType,
            startDate,
            endDate,
            constraint.analystId || undefined,
            constraint.templateId || undefined,
            newParams || (constraint.templateParams ? JSON.parse(constraint.templateParams) : undefined)
        );

        assessment.constraintId = constraintId;
        return assessment;
    }

    /**
     * Analyze the impact of deleting a constraint.
     */
    async analyzeConstraintDeletion(constraintId: string): Promise<ImpactAssessment> {
        const constraint = await this.prisma.schedulingConstraint.findUnique({
            where: { id: constraintId },
        });

        if (!constraint) {
            throw new Error(`Constraint not found: ${constraintId}`);
        }

        // When deleting, affected schedules are those that COULD be added back
        const existingSchedules = await this.getSchedulesInRange(
            constraint.startDate,
            constraint.endDate,
            constraint.analystId || undefined
        );

        const analysts = await this.prisma.analyst.findMany({
            where: { isActive: true },
        });

        // For deletion, impact is generally positive (removes restriction)
        return {
            constraintId,
            constraintType: constraint.constraintType,
            dateRange: { start: constraint.startDate, end: constraint.endDate },
            affectedSchedules: [],
            fairnessDelta: {
                before: 0.85,
                after: 0.85,
                change: 0,
                affectedAnalysts: [],
            },
            alternatives: [],
            severity: 'LOW',
            summary: `Removing ${constraint.constraintType} constraint will allow normal scheduling from ${constraint.startDate.toISOString().split('T')[0]} to ${constraint.endDate.toISOString().split('T')[0]}`,
            requiresRecalculation: false,
        };
    }

    /**
     * Get schedules in a date range.
     */
    private async getSchedulesInRange(
        startDate: Date,
        endDate: Date,
        analystId?: string
    ): Promise<(Schedule & { analyst: Analyst })[]> {
        return this.prisma.schedule.findMany({
            where: {
                date: {
                    gte: startDate,
                    lte: endDate,
                },
                ...(analystId && { analystId }),
            },
            include: {
                analyst: true,
            },
        });
    }

    /**
     * Find schedules affected by a constraint.
     */
    private findAffectedSchedules(
        schedules: (Schedule & { analyst: Analyst })[],
        constraintType: string,
        startDate: Date,
        endDate: Date,
        analystId?: string,
        templateParams?: Record<string, any>
    ): ImpactAssessment['affectedSchedules'] {
        const affected: ImpactAssessment['affectedSchedules'] = [];

        for (const schedule of schedules) {
            const scheduleDate = new Date(schedule.date);
            const inRange = scheduleDate >= startDate && scheduleDate <= endDate;
            const matchesAnalyst = !analystId || schedule.analystId === analystId;

            if (!inRange || !matchesAnalyst) continue;

            // Determine impact based on constraint type
            let action: 'REMOVE' | 'MODIFY' | 'CONFLICT' = 'CONFLICT';
            let reason = '';

            switch (constraintType) {
                case 'BLACKOUT_DATE':
                case 'ABSENCE':
                    action = 'REMOVE';
                    reason = 'Schedule conflicts with blackout/absence period';
                    break;
                case 'UNAVAILABLE_SCREENER':
                    if (schedule.isScreener) {
                        action = 'MODIFY';
                        reason = 'Analyst unavailable for screener duty';
                    }
                    break;
                default:
                    action = 'CONFLICT';
                    reason = `Potential conflict with ${constraintType} constraint`;
            }

            affected.push({
                scheduleId: schedule.id,
                date: scheduleDate.toISOString().split('T')[0],
                analystId: schedule.analystId,
                analystName: schedule.analyst.name,
                shiftType: schedule.shiftType,
                action,
                reason,
            });
        }

        return affected;
    }

    /**
     * Calculate fairness delta if schedules are removed/modified.
     */
    private async calculateFairnessDelta(
        existingSchedules: (Schedule & { analyst: Analyst })[],
        affectedSchedules: ImpactAssessment['affectedSchedules'],
        analysts: Analyst[]
    ): Promise<ImpactAssessment['fairnessDelta']> {
        // Calculate current workday distribution
        const workdaysBefore = new Map<string, number>();
        for (const schedule of existingSchedules) {
            const count = workdaysBefore.get(schedule.analystId) || 0;
            workdaysBefore.set(schedule.analystId, count + 1);
        }

        // Calculate after removing affected schedules
        const workdaysAfter = new Map(workdaysBefore);
        for (const affected of affectedSchedules) {
            if (affected.action === 'REMOVE') {
                const count = workdaysAfter.get(affected.analystId) || 0;
                workdaysAfter.set(affected.analystId, Math.max(0, count - 1));
            }
        }

        // Calculate fairness scores
        const beforeScores = Array.from(workdaysBefore.values());
        const afterScores = Array.from(workdaysAfter.values());

        const beforeFairness = this.calculateFairnessScore(beforeScores);
        const afterFairness = this.calculateFairnessScore(afterScores);

        // Build affected analysts list
        const affectedAnalysts: ImpactAssessment['fairnessDelta']['affectedAnalysts'] = [];
        for (const analyst of analysts) {
            const before = workdaysBefore.get(analyst.id) || 0;
            const after = workdaysAfter.get(analyst.id) || 0;
            if (before !== after) {
                affectedAnalysts.push({
                    analystId: analyst.id,
                    analystName: analyst.name,
                    workdaysBefore: before,
                    workdaysAfter: after,
                    delta: after - before,
                });
            }
        }

        return {
            before: beforeFairness,
            after: afterFairness,
            change: afterFairness - beforeFairness,
            affectedAnalysts,
        };
    }

    /**
     * Calculate a simple fairness score (lower variance = higher fairness).
     */
    private calculateFairnessScore(workdays: number[]): number {
        if (workdays.length === 0) return 1.0;

        const mean = workdays.reduce((a, b) => a + b, 0) / workdays.length;
        const variance =
            workdays.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / workdays.length;

        // Convert variance to a 0-1 score (lower variance = higher score)
        const maxVariance = Math.pow(mean, 2); // Worst case: all work for one person
        const normalizedVariance = maxVariance > 0 ? variance / maxVariance : 0;

        return Math.max(0, Math.min(1, 1 - normalizedVariance));
    }

    /**
     * Generate alternative staffing suggestions.
     */
    private generateAlternatives(
        affectedSchedules: ImpactAssessment['affectedSchedules'],
        analysts: Analyst[],
        constraintType: string
    ): ImpactAssessment['alternatives'] {
        const alternatives: ImpactAssessment['alternatives'] = [];

        if (affectedSchedules.length === 0) return alternatives;

        // Suggest reassigning removed schedules
        const removedSchedules = affectedSchedules.filter(s => s.action === 'REMOVE');
        if (removedSchedules.length > 0) {
            const availableAnalysts = analysts
                .filter(a => !removedSchedules.some(rs => rs.analystId === a.id))
                .map(a => a.name);

            if (availableAnalysts.length > 0) {
                alternatives.push({
                    type: 'REASSIGN',
                    description: `Reassign ${removedSchedules.length} shift(s) to available analysts`,
                    affectedAnalysts: availableAnalysts.slice(0, 3),
                    fairnessScore: 0.85,
                });
            }
        }

        // Suggest swap if only one analyst affected
        const affectedAnalystIds = [...new Set(affectedSchedules.map(s => s.analystId))];
        if (affectedAnalystIds.length === 1) {
            alternatives.push({
                type: 'SWAP',
                description: 'Swap shifts with another analyst to maintain coverage',
                affectedAnalysts: analysts.filter(a => a.id !== affectedAnalystIds[0]).map(a => a.name).slice(0, 3),
                fairnessScore: 0.9,
            });
        }

        // Always offer cancel option for non-critical constraints
        if (constraintType !== 'BLACKOUT_DATE') {
            alternatives.push({
                type: 'CANCEL',
                description: 'Cancel the constraint and keep current schedule',
                affectedAnalysts: [],
                fairnessScore: 1.0,
            });
        }

        return alternatives;
    }

    /**
     * Determine severity based on impact.
     */
    private determineSeverity(
        affectedCount: number,
        fairnessChange: number
    ): ImpactAssessment['severity'] {
        if (affectedCount === 0) return 'LOW';
        if (affectedCount <= 2 && Math.abs(fairnessChange) < 0.1) return 'LOW';
        if (affectedCount <= 5 && Math.abs(fairnessChange) < 0.2) return 'MEDIUM';
        if (affectedCount <= 10 && Math.abs(fairnessChange) < 0.3) return 'HIGH';
        return 'CRITICAL';
    }

    /**
     * Check if constraint change grants comp-off.
     */
    private checkCompOffGrant(
        constraintType: string,
        analystId: string | undefined,
        affectedSchedules: ImpactAssessment['affectedSchedules']
    ): ImpactAssessment['compOffGrant'] | undefined {
        // Comp-off is granted when an analyst is forced to work extra
        // or loses a scheduled day off
        if (!analystId) return undefined;

        const analystAffected = affectedSchedules.filter(s => s.analystId === analystId);
        if (analystAffected.length === 0) return undefined;

        // Example: If SPECIFIC_ANALYST_REQUIRED forces extra work
        if (constraintType === 'SPECIFIC_ANALYST_REQUIRED') {
            return {
                analystId,
                units: 0.5 * analystAffected.length, // Half day per shift
                reason: 'Required to work additional shifts',
            };
        }

        return undefined;
    }

    /**
     * Generate a human-readable summary.
     */
    private generateSummary(
        affectedSchedules: ImpactAssessment['affectedSchedules'],
        fairnessDelta: ImpactAssessment['fairnessDelta'],
        severity: ImpactAssessment['severity']
    ): string {
        if (affectedSchedules.length === 0) {
            return 'No existing schedules will be affected by this constraint.';
        }

        const parts: string[] = [];
        parts.push(`${affectedSchedules.length} schedule(s) will be affected.`);

        if (fairnessDelta.change !== 0) {
            const direction = fairnessDelta.change > 0 ? 'improve' : 'decrease';
            parts.push(`Fairness will ${direction} by ${Math.abs(fairnessDelta.change * 100).toFixed(1)}%.`);
        }

        if (fairnessDelta.affectedAnalysts.length > 0) {
            const names = fairnessDelta.affectedAnalysts.map(a => a.analystName).join(', ');
            parts.push(`Affected analysts: ${names}.`);
        }

        return parts.join(' ');
    }
}

// Export singleton instance
export const constraintImpactAnalyzer = new ConstraintImpactAnalyzer();
