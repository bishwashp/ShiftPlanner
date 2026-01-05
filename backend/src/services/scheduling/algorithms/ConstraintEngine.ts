import { SchedulingConstraint, ConstraintTemplate } from '../../../../generated/prisma';
import { ProposedSchedule, ConstraintValidationResult, ConstraintViolation } from './types';
import { constraintTemplateService } from '../../ConstraintTemplateService';

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
                type: 'SOFT',
                severity: 'MEDIUM',
                description: `Analyst ${schedule.analystName} is assigned to ${schedule.analystShiftType} shift, but scheduled for ${schedule.shiftType}`,
                affectedSchedules: [`${schedule.analystName} on ${schedule.date}`],
                suggestedFix: `Change the Shift Type to ${schedule.analystShiftType}`
            });
        }

        return violations;
    }

    /**
     * Validate template-based constraints.
     * This method evaluates constraints that have a templateId.
     */
    async validateTemplateConstraints(
        schedules: ProposedSchedule[],
        constraints: SchedulingConstraint[]
    ): Promise<ConstraintViolation[]> {
        const violations: ConstraintViolation[] = [];
        const templateConstraints = constraints.filter(c => c.templateId);

        for (const constraint of templateConstraints) {
            if (!constraint.templateId) continue;

            const template = await constraintTemplateService.getTemplateById(constraint.templateId);
            if (!template) continue;

            const params = constraint.templateParams ? JSON.parse(constraint.templateParams) : {};
            const templateViolations = this.evaluateTemplateConstraint(
                schedules,
                constraint,
                template,
                params
            );
            violations.push(...templateViolations);
        }

        return violations;
    }

    /**
     * Evaluate a single template-based constraint.
     */
    private evaluateTemplateConstraint(
        schedules: ProposedSchedule[],
        constraint: SchedulingConstraint,
        template: ConstraintTemplate,
        params: Record<string, any>
    ): ConstraintViolation[] {
        switch (template.name) {
            case 'ANALYSTS_PER_DAY':
                return this.validateAnalystsPerDay(schedules, constraint, params as any);
            case 'SPECIFIC_ANALYST_REQUIRED':
                return this.validateSpecificAnalystRequired(schedules, constraint, params as any);
            case 'BLACKOUT_PERIOD':
                return this.validateBlackoutPeriod(schedules, constraint, params as any);
            case 'REDUCED_STAFFING':
                return this.validateReducedStaffing(schedules, constraint, params as any);
            default:
                return [];
        }
    }

    /**
     * Validate ANALYSTS_PER_DAY template constraint.
     * Ensures exactly the specified number of analysts are scheduled.
     */
    private validateAnalystsPerDay(
        schedules: ProposedSchedule[],
        constraint: SchedulingConstraint,
        params: { count: number; shiftType?: string }
    ): ConstraintViolation[] {
        const violations: ConstraintViolation[] = [];
        const startDate = new Date(constraint.startDate);
        const endDate = new Date(constraint.endDate);

        // Group schedules by date
        const schedulesByDate = new Map<string, ProposedSchedule[]>();
        for (const schedule of schedules) {
            const scheduleDate = new Date(schedule.date);
            if (scheduleDate >= startDate && scheduleDate <= endDate) {
                // Filter by shift type if specified
                if (params.shiftType && schedule.shiftType !== params.shiftType) continue;

                const dateKey = this.toDateString(schedule.date);
                if (!schedulesByDate.has(dateKey)) {
                    schedulesByDate.set(dateKey, []);
                }
                schedulesByDate.get(dateKey)!.push(schedule);
            }
        }

        // Check each date
        for (const [dateKey, daySchedules] of schedulesByDate) {
            const actualCount = daySchedules.length;
            const requiredCount = params.count;

            if (actualCount !== requiredCount) {
                const shiftInfo = params.shiftType ? ` (${params.shiftType})` : '';
                violations.push({
                    type: 'HARD',
                    severity: actualCount < requiredCount ? 'CRITICAL' : 'HIGH',
                    description: `${dateKey}${shiftInfo}: ${actualCount} analysts scheduled, but ${requiredCount} required`,
                    affectedSchedules: daySchedules.map(s => `${s.analystName}`),
                    suggestedFix: actualCount < requiredCount
                        ? `Add ${requiredCount - actualCount} more analyst(s) on ${dateKey}`
                        : `Remove ${actualCount - requiredCount} analyst(s) from ${dateKey}`
                });
            }
        }

        return violations;
    }

    /**
     * Validate SPECIFIC_ANALYST_REQUIRED template constraint.
     * Ensures a specific analyst is scheduled during the constraint period.
     */
    private validateSpecificAnalystRequired(
        schedules: ProposedSchedule[],
        constraint: SchedulingConstraint,
        params: { analystId: string; shiftType?: string }
    ): ConstraintViolation[] {
        const violations: ConstraintViolation[] = [];
        const startDate = new Date(constraint.startDate);
        const endDate = new Date(constraint.endDate);

        // Find schedules for this analyst in the date range
        const analystSchedules = schedules.filter(schedule => {
            const scheduleDate = new Date(schedule.date);
            const inRange = scheduleDate >= startDate && scheduleDate <= endDate;
            const matchesAnalyst = schedule.analystId === params.analystId;
            const matchesShift = !params.shiftType || schedule.shiftType === params.shiftType;
            return inRange && matchesAnalyst && matchesShift;
        });

        // Generate all dates in range
        const datesInRange: string[] = [];
        const current = new Date(startDate);
        while (current <= endDate) {
            datesInRange.push(this.toDateString(current));
            current.setDate(current.getDate() + 1);
        }

        // Find missing dates
        const scheduledDates = new Set(analystSchedules.map(s => this.toDateString(s.date)));
        const missingDates = datesInRange.filter(d => !scheduledDates.has(d));

        if (missingDates.length > 0) {
            const shiftInfo = params.shiftType ? ` for ${params.shiftType}` : '';
            violations.push({
                type: 'HARD',
                severity: 'HIGH',
                description: `Required analyst not scheduled${shiftInfo} on: ${missingDates.join(', ')}`,
                affectedSchedules: missingDates,
                suggestedFix: `Schedule the required analyst for the missing dates`
            });
        }

        return violations;
    }

    /**
     * Validate BLACKOUT_PERIOD template constraint.
     * No scheduling allowed during this period.
     */
    private validateBlackoutPeriod(
        schedules: ProposedSchedule[],
        constraint: SchedulingConstraint,
        params: { reason?: string }
    ): ConstraintViolation[] {
        // Delegate to existing blackout validation
        return this.validateBlackoutDate(schedules, constraint);
    }

    /**
     * Validate REDUCED_STAFFING template constraint.
     * Allows reduced staffing levels for specific shifts.
     */
    private validateReducedStaffing(
        schedules: ProposedSchedule[],
        constraint: SchedulingConstraint,
        params: { morningCount: number; eveningCount: number }
    ): ConstraintViolation[] {
        const violations: ConstraintViolation[] = [];
        const startDate = new Date(constraint.startDate);
        const endDate = new Date(constraint.endDate);

        // Group schedules by date and shift
        const schedulesByDateShift = new Map<string, { morning: number; evening: number }>();

        for (const schedule of schedules) {
            const scheduleDate = new Date(schedule.date);
            if (scheduleDate >= startDate && scheduleDate <= endDate) {
                const dateKey = this.toDateString(schedule.date);
                if (!schedulesByDateShift.has(dateKey)) {
                    schedulesByDateShift.set(dateKey, { morning: 0, evening: 0 });
                }
                const counts = schedulesByDateShift.get(dateKey)!;
                if (schedule.shiftType === 'MORNING') {
                    counts.morning++;
                } else if (schedule.shiftType === 'EVENING') {
                    counts.evening++;
                }
            }
        }

        // Check each date
        for (const [dateKey, counts] of schedulesByDateShift) {
            if (counts.morning > params.morningCount) {
                violations.push({
                    type: 'SOFT',
                    severity: 'LOW',
                    description: `${dateKey} MORNING: ${counts.morning} analysts, reduced limit is ${params.morningCount}`,
                    affectedSchedules: [`${dateKey} MORNING shift`],
                    suggestedFix: `Reduce morning staff by ${counts.morning - params.morningCount} - this is a reduced staffing period`
                });
            }
            if (counts.evening > params.eveningCount) {
                violations.push({
                    type: 'SOFT',
                    severity: 'LOW',
                    description: `${dateKey} EVENING: ${counts.evening} analysts, reduced limit is ${params.eveningCount}`,
                    affectedSchedules: [`${dateKey} EVENING shift`],
                    suggestedFix: `Reduce evening staff by ${counts.evening - params.eveningCount} - this is a reduced staffing period`
                });
            }
        }

        return violations;
    }

    /**
     * Check if a constraint's template overrides weekend rules.
     */
    async shouldOverrideWeekendRules(constraint: SchedulingConstraint): Promise<boolean> {
        if (!constraint.templateId) return false;
        return constraintTemplateService.checkOverridesWeekend(constraint.templateId);
    }

    /**
     * Check if a constraint's template overrides screener rules.
     */
    async shouldOverrideScreenerRules(constraint: SchedulingConstraint): Promise<boolean> {
        if (!constraint.templateId) return false;
        return constraintTemplateService.checkOverridesScreener(constraint.templateId);
    }

    /**
     * Get the Holiday Constraint config for a given date.
     * Returns null if date is not a holiday or no config exists.
     */
    async getHolidayConstraintConfig(date: Date): Promise<{
        staffingCount: number | null;
        screenerCount: number | null;
        skipScreener: boolean;
        skipConsecutive: boolean;
    } | null> {
        const { prisma } = await import('../../../lib/prisma');

        // Check if this date is a holiday
        const dateStr = this.toDateString(date);
        const holiday = await prisma.holiday.findFirst({
            where: {
                date: {
                    gte: new Date(dateStr),
                    lt: new Date(new Date(dateStr).getTime() + 24 * 60 * 60 * 1000)
                }
            }
        });

        if (!holiday) return null;

        // Get the global holiday constraint config
        const config = await prisma.holidayConstraintConfig.findFirst({
            where: { isActive: true }
        });

        return config || {
            staffingCount: null,
            screenerCount: null,
            skipScreener: false,
            skipConsecutive: false
        };
    }

    /**
     * Get Special Event constraint for a given date.
     * Special Events have higher priority than Holiday constraints.
     */
    async getSpecialEventForDate(date: Date): Promise<SchedulingConstraint | null> {
        const { prisma } = await import('../../../lib/prisma');
        const dateObj = new Date(date);

        const specialEvent = await prisma.schedulingConstraint.findFirst({
            where: {
                isSpecialEvent: true,
                isActive: true,
                startDate: { lte: dateObj },
                endDate: { gte: dateObj }
            }
        });

        return specialEvent;
    }

    /**
     * Get effective constraint config for a date.
     * Priority: Special Event > Holiday Constraint > Default
     */
    async getEffectiveConstraintForDate(date: Date): Promise<{
        source: 'SPECIAL_EVENT' | 'HOLIDAY' | 'DEFAULT';
        skipContinuity: boolean;
        skipConflictCheck: boolean;
        staffingCount: number | null;
        screenerCount: number | null;
        grantCompOff: boolean;
    }> {
        // Check for Special Event first (highest priority)
        const specialEvent = await this.getSpecialEventForDate(date);
        if (specialEvent) {
            return {
                source: 'SPECIAL_EVENT',
                skipContinuity: (specialEvent as any).skipContinuity ?? false,
                skipConflictCheck: (specialEvent as any).skipConflictCheck ?? false,
                staffingCount: null, // Use template params if needed
                screenerCount: null,
                grantCompOff: specialEvent.grantsCompOff
            };
        }

        // Check for Holiday Constraint
        const holidayConfig = await this.getHolidayConstraintConfig(date);
        if (holidayConfig) {
            return {
                source: 'HOLIDAY',
                skipContinuity: holidayConfig.skipConsecutive,
                skipConflictCheck: false,
                staffingCount: holidayConfig.staffingCount,
                screenerCount: holidayConfig.screenerCount,
                grantCompOff: false
            };
        }

        // Default (no special rules)
        return {
            source: 'DEFAULT',
            skipContinuity: false,
            skipConflictCheck: false,
            staffingCount: null,
            screenerCount: null,
            grantCompOff: false
        };
    }

    /**
     * Check if continuity checks should be skipped for a date.
     * Used by scheduling algorithms to respect Special Event/Holiday rules.
     */
    async shouldSkipContinuityCheck(date: Date): Promise<boolean> {
        const config = await this.getEffectiveConstraintForDate(date);
        return config.skipContinuity;
    }

    /**
     * Check if conflict checks should be skipped for a date.
     * Used by scheduling algorithms for Special Event isolation.
     */
    async shouldSkipConflictCheck(date: Date): Promise<boolean> {
        const config = await this.getEffectiveConstraintForDate(date);
        return config.skipConflictCheck;
    }
}

export const constraintEngine = new ConstraintEngine(); 