import { PatternContinuityService } from './PatternContinuityService';
import { fairnessCalculator } from './FairnessCalculator';
import { isWeekend } from '../../utils/dateUtils';
import { prisma } from '../../lib/prisma';
import moment from 'moment';

interface WorkPattern {
  name: string;
  days: number[];
  nextPattern: string | null;
  breakDays?: number;
}

interface RotationPlan {
  analystId: string | null;
  pattern: string;
  startDate: Date;
  endDate: Date;
}

export class RotationManager {
  private patternContinuityService: PatternContinuityService;
  private workPatterns: WorkPattern[];
  private patternsLoaded: boolean = false;

  constructor(patternContinuityService: PatternContinuityService) {
    this.patternContinuityService = patternContinuityService;
    this.workPatterns = [];
  }

  private async loadWorkPatterns(): Promise<void> {
    if (this.patternsLoaded) return;

    // Hardcoded patterns based on business logic
    this.workPatterns = [
      { name: 'SUN_THU', days: [0, 1, 2, 3, 4], nextPattern: 'TUE_SAT', breakDays: 4 },
      { name: 'TUE_SAT', days: [2, 3, 4, 5, 6], nextPattern: null, breakDays: 0 }, // Ends rotation
      { name: 'MON_FRI', days: [1, 2, 3, 4, 5], nextPattern: null, breakDays: 0 } // Default
    ];
    this.patternsLoaded = true;
  }

  /**
   * Plan rotation for the unified pool of analysts
   * Ensures weekend coverage by pipelining analysts through SUN_THU -> TUE_SAT
   */
  async planRotation(
    algorithmType: string,
    shiftType: string,
    startDate: Date,
    endDate: Date,
    allAnalysts: any[],
    historicalSchedules: any[] = []
  ): Promise<RotationPlan[]> {
    await this.loadWorkPatterns();
    const rotationPlans: RotationPlan[] = [];

    const current = moment.utc(startDate).startOf('week');
    const end = moment.utc(endDate).endOf('week');

    while (current.isBefore(end)) {
      const weekStart = current.toDate();

      // 1. Pipeline: Move last week's SUN_THU analyst to TUE_SAT
      // Find who had SUN_THU last week
      const lastWeekSunThuPlan = rotationPlans.find(p =>
        p.pattern === 'SUN_THU' &&
        moment.utc(p.startDate).isSame(moment.utc(weekStart).subtract(1, 'week'), 'week')
      );

      if (lastWeekSunThuPlan && lastWeekSunThuPlan.analystId) {
        // Assign TUE_SAT for THIS week
        rotationPlans.push({
          analystId: lastWeekSunThuPlan.analystId,
          pattern: 'TUE_SAT',
          startDate: weekStart, // Start Sunday (Monday is off)
          endDate: moment.utc(weekStart).endOf('week').toDate()
        });
      }

      // 2. Bootstrap TUE_SAT if needed (First week only)
      // If no one was pipelined (e.g. first week), we need to pick someone for TUE_SAT
      const tueSatCovered = rotationPlans.some(p =>
        p.pattern === 'TUE_SAT' &&
        moment.utc(p.startDate).isSame(weekStart, 'week')
      );

      if (!tueSatCovered) {
        const fairnessData = fairnessCalculator.calculateRotationFairnessScores(
          allAnalysts,
          historicalSchedules,
          weekStart
        );
        const tueSatAnalyst = fairnessCalculator.selectNextAnalystForRotation(
          allAnalysts,
          fairnessData
        );

        if (tueSatAnalyst) {
          rotationPlans.push({
            analystId: tueSatAnalyst.id,
            pattern: 'TUE_SAT',
            startDate: weekStart, // Start Sunday (Monday is off)
            endDate: moment.utc(weekStart).endOf('week').toDate()
          });
        }
      }

      // 3. Select NEW analyst for SUN_THU
      // Exclude:
      // - Anyone already assigned TUE_SAT this week
      // - Anyone who had TUE_SAT LAST week (Streak Fix)
      const excludeAnalysts = new Set<string>();

      // Exclude current TUE_SAT
      const currentTueSatPlan = rotationPlans.find(p =>
        p.pattern === 'TUE_SAT' && moment.utc(p.startDate).isSame(weekStart, 'week')
      );
      if (currentTueSatPlan && currentTueSatPlan.analystId) excludeAnalysts.add(currentTueSatPlan.analystId);

      // Exclude LAST week's TUE_SAT (Streak Fix)
      const lastWeekTueSatPlan = rotationPlans.find(p =>
        p.pattern === 'TUE_SAT' &&
        moment.utc(p.startDate).isSame(moment.utc(weekStart).subtract(1, 'week'), 'week')
      );
      if (lastWeekTueSatPlan && lastWeekTueSatPlan.analystId) excludeAnalysts.add(lastWeekTueSatPlan.analystId);

      // SIMULATE HISTORY: Convert current rotation plans to schedule entries so FairnessCalculator knows about them
      const simulatedSchedules = [...historicalSchedules];
      rotationPlans.forEach(plan => {
        if (plan.pattern === 'TUE_SAT') {
          // Covers Saturday
          simulatedSchedules.push({
            analystId: plan.analystId,
            date: moment.utc(plan.endDate).toDate(), // Saturday
            shiftType: 'WEEKEND' // Dummy type, calculator only checks date
          });
        } else if (plan.pattern === 'SUN_THU') {
          // Covers Sunday
          simulatedSchedules.push({
            analystId: plan.analystId,
            date: moment.utc(plan.startDate).toDate(), // Sunday
            shiftType: 'WEEKEND'
          });
        }
      });

      const fairnessData = fairnessCalculator.calculateRotationFairnessScores(
        allAnalysts,
        simulatedSchedules,
        weekStart
      );

      // We need to manually filter candidates because selectNextAnalystForRotation doesn't support exclusions yet
      // So we'll just iterate until we find a valid one
      // UPDATE: We should use selectNextAnalystForRotation with exclusions if possible,
      // but since we modified it to take exclusions, let's use it!
      // Wait, did I modify selectNextAnalystForRotation to take exclusions?
      // Yes, it takes `unavailableAnalystIds`.

      const nextAnalyst = fairnessCalculator.selectNextAnalystForRotation(
        allAnalysts,
        fairnessData,
        excludeAnalysts
      );

      if (nextAnalyst) {
        rotationPlans.push({
          analystId: nextAnalyst.id,
          pattern: 'SUN_THU',
          startDate: weekStart,
          endDate: moment.utc(weekStart).endOf('week').toDate()
        });
      }

      current.add(1, 'week');
    }

    return rotationPlans;
  }

  /**
   * Check if an analyst should work on a specific date
   * Defaults to M-F unless a specific rotation plan exists
   */
  shouldAnalystWork(
    analystId: string,
    date: Date,
    rotationPlans: RotationPlan[]
  ): boolean {
    // Use moment for consistent day of week calculation
    const mDate = moment.utc(date);

    // Check if analyst has a specific rotation plan for this date
    const plan = rotationPlans.find(p =>
      p.analystId === analystId &&
      mDate.isSameOrAfter(moment.utc(p.startDate), 'day') &&
      mDate.isSameOrBefore(moment.utc(p.endDate), 'day')
    );

    if (plan) {
      const pattern = this.workPatterns.find(p => p.name === plan.pattern);
      // Use moment().day() (0-6, Sun-Sat)
      return pattern ? pattern.days.includes(mDate.day()) : false;
    }

    // Default: M-F (Mon=1 to Fri=5)
    const day = mDate.day();
    return day >= 1 && day <= 5;
  }

  getAnalystPattern(
    analystId: string,
    date: Date,
    rotationPlans: RotationPlan[]
  ): string {
    const mDate = moment.utc(date);
    const plan = rotationPlans.find(p =>
      p.analystId === analystId &&
      mDate.isSameOrAfter(moment.utc(p.startDate), 'day') &&
      mDate.isSameOrBefore(moment.utc(p.endDate), 'day')
    );
    return plan ? plan.pattern : 'MON_FRI';
  }


  /**
   * Plan AM to PM rotation for weekdays
   * Selects 2 AM analysts to work PM shift each weekday
   */
  async planAMToPMRotation(
    startDate: Date,
    endDate: Date,
    amAnalysts: any[],
    historicalSchedules: any[] = [],
    absenceService: any // Avoid circular dependency import for now, or use interface
  ): Promise<Map<string, string[]>> {
    // Map of Date (YYYY-MM-DD) -> Array of Analyst IDs working PM
    const rotationMap = new Map<string, string[]>();

    const current = moment.utc(startDate);
    const end = moment.utc(endDate);

    // Track local history to ensure fairness within the generation window
    const localSchedules = [...historicalSchedules];

    while (current.isSameOrBefore(end, 'day')) {
      const dayOfWeek = current.day();
      const dateStr = current.format('YYYY-MM-DD');

      // Only rotate on weekdays (Mon=1 to Fri=5)
      if (dayOfWeek >= 1 && dayOfWeek <= 5) {
        // Filter out absent analysts for this specific date
        const availableAnalysts = [];
        for (const analyst of amAnalysts) {
          const isAbsent = await absenceService.isAnalystAbsent(analyst.id, dateStr);
          if (!isAbsent) {
            availableAnalysts.push(analyst);
          }
        }

        // Calculate fairness scores based on history + local decisions
        const fairnessData = fairnessCalculator.calculateAMToPMFairnessScores(
          availableAnalysts, // Use available analysts only
          localSchedules,
          current.toDate()
        );

        // Select 2 analysts
        const selectedAnalysts = fairnessCalculator.selectNextAnalystsForAMToPMRotation(
          availableAnalysts, // Use available analysts only
          fairnessData,
          2
        );

        const selectedIds = selectedAnalysts.map(a => a.id);
        rotationMap.set(dateStr, selectedIds);

        // Update local history so next day's calculation knows about this assignment
        selectedIds.forEach(id => {
          localSchedules.push({
            analystId: id,
            date: current.toDate(),
            shiftType: 'EVENING'
          });
        });
      }

      current.add(1, 'day');
    }

    return rotationMap;
  }
}

export const rotationManager = new RotationManager(null as any);
