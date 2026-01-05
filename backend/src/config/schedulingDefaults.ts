/**
 * Scheduling Defaults Configuration
 * System-wide defaults for schedule generation rules
 */

export const SCHEDULING_DEFAULTS = {
    /**
     * Number of analysts per shift on weekends
     * Default: 1 (single coverage)
     */
    weekendAnalystsPerShift: 1,

    /**
     * Maximum consecutive work days before mandatory break
     * Default: 5 days
     */
    maxConsecutiveDays: 5,

    /**
     * Minimum break days after max consecutive days reached
     * Default: 2 days
     */
    minBreakDays: 2,

    /**
     * Number of AM analysts to rotate to PM shift each weekday
     * Default: 2
     */
    amToPmRotationCount: 2
};

export type SchedulingDefaults = typeof SCHEDULING_DEFAULTS;
