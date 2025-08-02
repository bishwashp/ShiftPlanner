"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.constraintEngine = exports.ConstraintEngine = void 0;
class ConstraintEngine {
    /**
     * Validate all constraints against proposed schedules
     */
    validateConstraints(schedules, constraints) {
        const violations = [];
        // Validate hard constraints first
        const hardConstraints = constraints.filter(c => c.constraintType === 'BLACKOUT_DATE');
        const hardViolations = this.validateHardConstraints(schedules, hardConstraints);
        violations.push(...hardViolations);
        // Validate soft constraints
        const softConstraints = constraints.filter(c => c.constraintType !== 'BLACKOUT_DATE');
        const softViolations = this.validateSoftConstraints(schedules, softConstraints);
        violations.push(...softViolations);
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
    validateHardConstraints(schedules, constraints) {
        const violations = [];
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
    validateSoftConstraints(schedules, constraints) {
        const violations = [];
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
     * Validate blackout date constraints
     */
    validateBlackoutDate(schedules, constraint) {
        const violations = [];
        const startDate = new Date(constraint.startDate);
        const endDate = new Date(constraint.endDate);
        const conflictingSchedules = schedules.filter(schedule => {
            const scheduleDate = new Date(schedule.date);
            return scheduleDate >= startDate && scheduleDate <= endDate;
        });
        if (conflictingSchedules.length > 0) {
            violations.push({
                type: 'HARD',
                severity: 'CRITICAL',
                description: `Scheduling not allowed during blackout period: ${startDate.toDateString()} to ${endDate.toDateString()}`,
                affectedSchedules: conflictingSchedules.map(s => `${s.analystName} on ${s.date}`),
                suggestedFix: 'Remove all schedules during blackout period or adjust blackout dates'
            });
        }
        return violations;
    }
    /**
     * Validate maximum screener days constraint
     */
    validateMaxScreenerDays(schedules, constraint) {
        const violations = [];
        // Group schedules by analyst
        const analystSchedulesMap = this.groupSchedulesByAnalyst(schedules);
        for (const [analystId, analystSchedules] of analystSchedulesMap) {
            const screenerDays = analystSchedules.filter((s) => s.isScreener).length;
            // Extract max screener days from constraint description or use default
            const maxDays = this.extractNumericValue(constraint.description) || 10;
            if (screenerDays > maxDays) {
                violations.push({
                    type: 'SOFT',
                    severity: 'HIGH',
                    description: `Analyst has ${screenerDays} screener days, exceeding maximum of ${maxDays}`,
                    affectedSchedules: analystSchedules.filter((s) => s.isScreener).map((s) => `${s.analystName} on ${s.date}`),
                    suggestedFix: `Reduce screener assignments for ${analystSchedules[0].analystName}`
                });
            }
        }
        return violations;
    }
    /**
     * Validate minimum screener days constraint
     */
    validateMinScreenerDays(schedules, constraint) {
        const violations = [];
        // Group schedules by analyst
        const analystSchedulesMap = this.groupSchedulesByAnalyst(schedules);
        for (const [analystId, analystSchedules] of analystSchedulesMap) {
            const screenerDays = analystSchedules.filter((s) => s.isScreener).length;
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
    validatePreferredScreener(schedules, constraint) {
        const violations = [];
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
     * Validate unavailable screener constraint
     */
    validateUnavailableScreener(schedules, constraint) {
        const violations = [];
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
    calculateValidationScore(violations, totalSchedules) {
        if (violations.length === 0)
            return 1.0;
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
    generateViolationSuggestions(violations) {
        const suggestions = [];
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
        const screenerViolations = violations.filter(v => v.description.includes('screener') || v.description.includes('Screener'));
        if (screenerViolations.length > 0) {
            suggestions.push('Consider rebalancing screener assignments across analysts');
        }
        const blackoutViolations = violations.filter(v => v.description.includes('blackout') || v.description.includes('Blackout'));
        if (blackoutViolations.length > 0) {
            suggestions.push('Review and adjust blackout date constraints');
        }
        return suggestions;
    }
    /**
     * Group schedules by analyst
     */
    groupSchedulesByAnalyst(schedules) {
        const grouped = new Map();
        for (const schedule of schedules) {
            if (!grouped.has(schedule.analystId)) {
                grouped.set(schedule.analystId, []);
            }
            grouped.get(schedule.analystId).push(schedule);
        }
        return grouped;
    }
    /**
     * Extract numeric value from constraint description
     */
    extractNumericValue(description) {
        if (!description)
            return null;
        const match = description.match(/\d+/);
        return match ? parseInt(match[0]) : null;
    }
    /**
     * Check if a schedule violates any constraints
     */
    checkScheduleConstraints(schedule, allSchedules, constraints) {
        const violations = [];
        // Check blackout dates
        const blackoutConstraints = constraints.filter(c => c.constraintType === 'BLACKOUT_DATE');
        for (const constraint of blackoutConstraints) {
            const scheduleDate = new Date(schedule.date);
            const startDate = new Date(constraint.startDate);
            const endDate = new Date(constraint.endDate);
            if (scheduleDate >= startDate && scheduleDate <= endDate) {
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
            const screenerConstraints = constraints.filter(c => c.analystId === schedule.analystId &&
                (c.constraintType === 'UNAVAILABLE_SCREENER' || c.constraintType === 'PREFERRED_SCREENER'));
            for (const constraint of screenerConstraints) {
                const scheduleDate = new Date(schedule.date);
                const startDate = new Date(constraint.startDate);
                const endDate = new Date(constraint.endDate);
                if (scheduleDate >= startDate && scheduleDate <= endDate) {
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
        return violations;
    }
}
exports.ConstraintEngine = ConstraintEngine;
exports.constraintEngine = new ConstraintEngine();
