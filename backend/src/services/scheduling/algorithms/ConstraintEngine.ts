import { SchedulingConstraint } from '../../../../generated/prisma';
import { ProposedSchedule, ConstraintValidationResult, ConstraintViolation } from './types';

export class ConstraintEngine {

    /**
     * Validate all constraints against proposed schedules
     */
    validateConstraints(
        schedules: ProposedSchedule[],
        constraints: SchedulingConstraint[]
    ): ConstraintValidationResult {
        const violations: ConstraintViolation[] = [];

        // Validate hard constraints first
        const hardConstraints = constraints.filter(c => c.constraintType === 'BLACKOUT_DATE');
        const hardViolations = this.validateHardConstraints(schedules, hardConstraints);
        violations.push(...hardViolations);

        // Validate soft constraints
        const softConstraints = constraints.filter(c => c.constraintType !== 'BLACKOUT_DATE');
        const softViolations = this.validateSoftConstraints(schedules, softConstraints);
        violations.push(...softViolations);

        // Validate rolling 7-day window (CRITICAL system constraint)
        const rolling7DayViolations = this.validateRolling7DayLimit(schedules);
        violations.push(...rolling7DayViolations);

        // Calculate overall validation score
        const score = this.calculateValidationScore(violations, schedules.length);
        const isValid = violations.filter(v => v.type === 'HARD').length === 0;

        // Generate suggestions for fixing violations
        const suggestions = this.generateViolationSuggestions(violations);

        return {
            isValid,
            violations,
            score,
            suggestions
        };
    }

    /**
     * Validate hard constraints (must be satisfied)
     */
    private validateHardConstraints(
        schedules: ProposedSchedule[],
        constraints: SchedulingConstraint[]
    ): ConstraintViolation[] {
        const violations: ConstraintViolation[] = [];

        for (const constraint of constraints) {
            if (constraint.constraintType === 'BLACKOUT_DATE') {
                const blackoutViolations = this.validateBlackoutDate(schedules, constraint);
                violations.push(...blackoutViolations);
            }
        }

        return violations;
    }

    /**
     * Validate soft constraints (preferred but not required)
     */
    private validateSoftConstraints(
        schedules: ProposedSchedule[],
        constraints: SchedulingConstraint[]
    ): ConstraintViolation[] {
        const violations: ConstraintViolation[] = [];

        for (const constraint of constraints) {
            switch (constraint.constraintType) {
                case 'MAX_SCREENER_DAYS':
                    const maxScreenerViolations = this.validateMaxScreenerDays(schedules, constraint);
                    violations.push(...maxScreenerViolations);
                    break;

                case 'MIN_SCREENER_DAYS':
                    const minScreenerViolations = this.validateMinScreenerDays(schedules, constraint);
                    violations.push(...minScreenerViolations);
                    break;

                case 'PREFERRED_SCREENER':
                    const preferredScreenerViolations = this.validatePreferredScreener(schedules, constraint);
                    violations.push(...preferredScreenerViolations);
                    break;

                case 'UNAVAILABLE_SCREENER':
                    const unavailableScreenerViolations = this.validateUnavailableScreener(schedules, constraint);
                    violations.push(...unavailableScreenerViolations);
                    break;
            }
        }

        return violations;
    }

    /**
     * Helper to normalize date to YYYY-MM-DD string
     */
    private toDateString(date: Date | string): string {
        const d = new Date(date);
        return d.toISOString().split('T')[0];
    }

    /**
     * Validate blackout date constraints
     */
    private validateBlackoutDate(
        schedules: ProposedSchedule[],
        constraint: SchedulingConstraint
    ): ConstraintViolation[] {
        const violations: ConstraintViolation[] = [];
        const startDateStr = this.toDateString(constraint.startDate);
        const endDateStr = this.toDateString(constraint.endDate);

        const conflictingSchedules = schedules.filter(schedule => {
            const scheduleDateStr = this.toDateString(schedule.date);
            return scheduleDateStr >= startDateStr && scheduleDateStr <= endDateStr;
        });

        if (conflictingSchedules.length > 0) {
            violations.push({
                type: 'HARD',
                severity: 'CRITICAL',
                description: `Scheduling not allowed during blackout period: ${startDateStr} to ${endDateStr}`,
                affectedSchedules: conflictingSchedules.map(s => `${s.analystName} on ${s.date}`),
                suggestedFix: 'Remove all schedules during blackout period or adjust blackout dates'
            });
        }

        return violations;
    }

    /**
     * Validate maximum screener days constraint
     */
    private validateMaxScreenerDays(
        schedules: ProposedSchedule[],
        constraint: SchedulingConstraint
    ): ConstraintViolation[] {
        const violations: ConstraintViolation[] = [];

        // Group schedules by analyst
        const analystSchedulesMap = this.groupSchedulesByAnalyst(schedules);

        for (const [analystId, analystSchedules] of analystSchedulesMap) {
            const screenerDays = analystSchedules.filter((s: ProposedSchedule) => s.isScreener).length;

            // Extract max screener days from constraint description or use default
            const maxDays = this.extractNumericValue(constraint.description) || 10;

            if (screenerDays > maxDays) {
                violations.push({
                    type: 'SOFT',
                    severity: 'HIGH',
                    description: `Analyst has ${screenerDays} screener days, exceeding maximum of ${maxDays}`,
                    affectedSchedules: analystSchedules.filter((s: ProposedSchedule) => s.isScreener).map((s: ProposedSchedule) => `${s.analystName} on ${s.date}`),
                    suggestedFix: `Reduce screener assignments for ${analystSchedules[0].analystName}`
                });
            }
        }

        return violations;
    }

    /**
     * Validate minimum screener days constraint
     */
    private validateMinScreenerDays(
        schedules: ProposedSchedule[],
        constraint: SchedulingConstraint
    ): ConstraintViolation[] {
        const violations: ConstraintViolation[] = [];

        // Group schedules by analyst
        const analystSchedulesMap = this.groupSchedulesByAnalyst(schedules);

        for (const [analystId, analystSchedules] of analystSchedulesMap) {
            const screenerDays = analystSchedules.filter((s: ProposedSchedule) => s.isScreener).length;

            // Extract min screener days from constraint description or use default
            const minDays = this.extractNumericValue(constraint.description) || 2;

            if (screenerDays < minDays) {
                violations.push({
                    type: 'SOFT',
                    severity: 'MEDIUM',
                    description: `Analyst has ${screenerDays} screener days, below minimum of ${minDays}`,
                    affectedSchedules: [analystSchedules[0].analystName],
                    suggestedFix: `Increase screener assignments for ${analystSchedules[0].analystName}`
                });
            }
        }

        return violations;
    }

    /**
     * Validate preferred screener constraint
     */
    private validatePreferredScreener(
        schedules: ProposedSchedule[],
        constraint: SchedulingConstraint
    ): ConstraintViolation[] {
        const violations: ConstraintViolation[] = [];

        if (!constraint.analystId) {
            return violations;
        }

        const startDate = new Date(constraint.startDate);
        const endDate = new Date(constraint.endDate);

        const preferredAnalystSchedules = schedules.filter(schedule => {
            const scheduleDate = new Date(schedule.date);
            return schedule.analystId === constraint.analystId &&
                scheduleDate >= startDate &&
                scheduleDate <= endDate &&
                !schedule.isScreener;
        });

        if (preferredAnalystSchedules.length > 0) {
            violations.push({
                type: 'SOFT',
                severity: 'LOW',
                description: `Preferred screener not assigned during specified period`,
                affectedSchedules: preferredAnalystSchedules.map(s => `${s.analystName} on ${s.date}`),
                suggestedFix: 'Consider assigning screener role to preferred analyst during this period'
            });
        }

        return violations;
    }

    /**
     * Validate rolling 7-day window limit (max 5 days worked in any 7-day period)
     * This is a CRITICAL system constraint to prevent analyst burnout
     */
    private validateRolling7DayLimit(
        schedules: ProposedSchedule[]
    ): ConstraintViolation[] {
        const violations: ConstraintViolation[] = [];
        const analystSchedulesMap = this.groupSchedulesByAnalyst(schedules);

        for (const [analystId, analystSchedules] of analystSchedulesMap) {
            // Sort by date
            const sorted = analystSchedules.sort((a, b) =>
                new Date(a.date).getTime() - new Date(b.date).getTime()
            );

            // Check each date and its 7-day window
            for (let i = 0; i < sorted.length; i++) {
                const currentDate = new Date(sorted[i].date);
                const windowStart = new Date(currentDate);
                windowStart.setDate(windowStart.getDate() - 6); // 7-day window including current date

                const daysInWindow = sorted.filter(s => {
                    const sDate = new Date(s.date);
                    return sDate >= windowStart && sDate <= currentDate;
                }).length;

                if (daysInWindow > 5) {
                    const windowSchedules = sorted.filter(s => {
                        const sDate = new Date(s.date);
                        return sDate >= windowStart && sDate <= currentDate;
                    });

                    violations.push({
                        type: 'HARD',
                        severity: 'CRITICAL',
                        description: `${sorted[i].analystName} working ${daysInWindow} days in a 7-day period (max 5 allowed)`,
                        affectedSchedules: windowSchedules.map(s => `${s.analystName} on ${s.date}`),
                        suggestedFix: `Reduce shifts for ${sorted[i].analystName} - remove at least ${daysInWindow - 5} shift(s) in this period`
                    });
                    break; // Only report once per analyst to avoid duplicate violations
                }
            }
        }

        return violations;
    }

    /**
     * Validate unavailable screener constraint
     */
    private validateUnavailableScreener(
        schedules: ProposedSchedule[],
        constraint: SchedulingConstraint
    ): ConstraintViolation[] {
        const violations: ConstraintViolation[] = [];

        if (!constraint.analystId) {
            return violations;
        }

        const startDate = new Date(constraint.startDate);
        const endDate = new Date(constraint.endDate);

        const unavailableScreenerSchedules = schedules.filter(schedule => {
            const scheduleDate = new Date(schedule.date);
            return schedule.analystId === constraint.analystId &&
                scheduleDate >= startDate &&
                scheduleDate <= endDate &&
                schedule.isScreener;
        });

        if (unavailableScreenerSchedules.length > 0) {
            violations.push({
                type: 'SOFT',
                severity: 'MEDIUM',
                description: `Analyst assigned as screener during unavailable period`,
                affectedSchedules: unavailableScreenerSchedules.map(s => `${s.analystName} on ${s.date}`),
                suggestedFix: 'Remove screener assignments for this analyst during unavailable period'
            });
        }

        return violations;
    }

    /**
     * Calculate validation score (0-1, higher is better)
     */
    private calculateValidationScore(violations: ConstraintViolation[], totalSchedules: number): number {
        if (violations.length === 0) return 1.0;

        let totalPenalty = 0;

        for (const violation of violations) {
            let penalty = 0;

            switch (violation.severity) {
                case 'CRITICAL':
                    penalty = 1.0;
                    break;
                case 'HIGH':
                    penalty = 0.7;
                    break;
                case 'MEDIUM':
                    penalty = 0.4;
                    break;
                case 'LOW':
                    penalty = 0.1;
                    break;
            }

            // Weight by number of affected schedules
            penalty *= violation.affectedSchedules.length / totalSchedules;
            totalPenalty += penalty;
        }

        return Math.max(0, 1 - totalPenalty);
    }

    /**
     * Generate suggestions for fixing violations
     */
    private generateViolationSuggestions(violations: ConstraintViolation[]): string[] {
        const suggestions: string[] = [];

        // Group violations by type
        const hardViolations = violations.filter(v => v.type === 'HARD');
        const softViolations = violations.filter(v => v.type === 'SOFT');

        if (hardViolations.length > 0) {
            suggestions.push(`Critical: ${hardViolations.length} hard constraint violations must be resolved`);
        }

        if (softViolations.length > 0) {
            suggestions.push(`Warning: ${softViolations.length} soft constraint violations detected`);
        }

        // Add specific suggestions
        const screenerViolations = violations.filter(v =>
            v.description.includes('screener') || v.description.includes('Screener')
        );

        if (screenerViolations.length > 0) {
            suggestions.push('Consider rebalancing screener assignments across analysts');
        }

        const blackoutViolations = violations.filter(v =>
            v.description.includes('blackout') || v.description.includes('Blackout')
        );

        if (blackoutViolations.length > 0) {
            suggestions.push('Review and adjust blackout date constraints');
        }

        return suggestions;
    }

    /**
     * Group schedules by analyst
     */
    private groupSchedulesByAnalyst(schedules: ProposedSchedule[]): Map<string, ProposedSchedule[]> {
        const grouped = new Map<string, ProposedSchedule[]>();

        for (const schedule of schedules) {
            if (!grouped.has(schedule.analystId)) {
                grouped.set(schedule.analystId, []);
            }
            grouped.get(schedule.analystId)!.push(schedule);
        }

        return grouped;
    }

    /**
     * Extract numeric value from constraint description
     */
    private extractNumericValue(description: string | null): number | null {
        if (!description) return null;

        const match = description.match(/\d+/);
        return match ? parseInt(match[0]) : null;
    }

    /**
     * Check if a schedule violates any constraints
     */
    checkScheduleConstraints(
        schedule: ProposedSchedule,
        allSchedules: ProposedSchedule[],
        constraints: SchedulingConstraint[]
    ): ConstraintViolation[] {
        const violations: ConstraintViolation[] = [];

        // Check blackout dates
        const blackoutConstraints = constraints.filter(c => c.constraintType === 'BLACKOUT_DATE');
        for (const constraint of blackoutConstraints) {
            const scheduleDateStr = this.toDateString(schedule.date);
            const startDateStr = this.toDateString(constraint.startDate);
            const endDateStr = this.toDateString(constraint.endDate);

            if (scheduleDateStr >= startDateStr && scheduleDateStr <= endDateStr) {
                violations.push({
                    type: 'HARD',
                    severity: 'CRITICAL',
                    description: `Schedule conflicts with blackout period`,
                    affectedSchedules: [`${schedule.analystName} on ${schedule.date}`],
                    suggestedFix: 'Remove or reschedule this assignment'
                });
            }
        }

        // Check screener constraints
        if (schedule.isScreener) {
            const screenerConstraints = constraints.filter(c =>
                c.analystId === schedule.analystId &&
                (c.constraintType === 'UNAVAILABLE_SCREENER' || c.constraintType === 'PREFERRED_SCREENER')
            );

            for (const constraint of screenerConstraints) {
                const scheduleDateStr = this.toDateString(schedule.date);
                const startDateStr = this.toDateString(constraint.startDate);
                const endDateStr = this.toDateString(constraint.endDate);

                if (scheduleDateStr >= startDateStr && scheduleDateStr <= endDateStr) {
                    if (constraint.constraintType === 'UNAVAILABLE_SCREENER') {
                        violations.push({
                            type: 'SOFT',
                            severity: 'MEDIUM',
                            description: `Analyst unavailable for screener assignment`,
                            affectedSchedules: [`${schedule.analystName} on ${schedule.date}`],
                            suggestedFix: 'Assign different analyst as screener'
                        });
                    }
                }
            }
        }

        // Check shift type mismatch
        if (schedule.analystShiftType && schedule.shiftType !== schedule.analystShiftType) {
            violations.push({
                type: 'HARD',
                severity: 'CRITICAL',
                description: `Analyst ${schedule.analystName} is assigned to ${schedule.analystShiftType} shift, cannot schedule for ${schedule.shiftType}`,
                affectedSchedules: [`${schedule.analystName} on ${schedule.date}`],
                suggestedFix: `Schedule for ${schedule.analystShiftType} instead`
            });
        }

        return violations;
    }
}

export const constraintEngine = new ConstraintEngine(); 