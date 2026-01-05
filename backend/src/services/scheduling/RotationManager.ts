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
   * HOLISTIC FIX: All analysts get assigned to a pattern (no defaults)
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
      const weekEnd = moment.utc(weekStart).endOf('week').toDate();

      // Track who gets assigned this week
      const assignedThisWeek = new Set<string>();

      // 1. Pipeline: Move last week's SUN_THU analyst to TUE_SAT
      const lastWeekSunThuPlan = rotationPlans.find(p =>
        p.pattern === 'SUN_THU' &&
        moment.utc(p.startDate).isSame(moment.utc(weekStart).subtract(1, 'week'), 'week')
      );

      if (lastWeekSunThuPlan && lastWeekSunThuPlan.analystId) {
        rotationPlans.push({
          analystId: lastWeekSunThuPlan.analystId,
          pattern: 'TUE_SAT',
          startDate: weekStart,
          endDate: weekEnd
        });
        assignedThisWeek.add(lastWeekSunThuPlan.analystId);
      }

      // 2. Bootstrap TUE_SAT if needed (First week only)
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
            startDate: weekStart,
            endDate: weekEnd
          });
          assignedThisWeek.add(tueSatAnalyst.id);
        }
      } else {
        // Mark the pipelined TUE_SAT analyst as assigned
        const tueSatPlan = rotationPlans.find(p =>
          p.pattern === 'TUE_SAT' &&
          moment.utc(p.startDate).isSame(weekStart, 'week')
        );
        if (tueSatPlan && tueSatPlan.analystId) {
          assignedThisWeek.add(tueSatPlan.analystId);
        }
      }

      // 3. Select NEW analyst for SUN_THU
      const excludeAnalysts = new Set<string>(assignedThisWeek);

      // Also exclude LAST week's TUE_SAT (Streak Fix - prevent consecutive weekend rotation)
      const lastWeekTueSatPlan = rotationPlans.find(p =>
        p.pattern === 'TUE_SAT' &&
        moment.utc(p.startDate).isSame(moment.utc(weekStart).subtract(1, 'week'), 'week')
      );
      if (lastWeekTueSatPlan && lastWeekTueSatPlan.analystId) {
        excludeAnalysts.add(lastWeekTueSatPlan.analystId);
      }

      // SIMULATE HISTORY for fairness calculation
      const simulatedSchedules = [...historicalSchedules];
      rotationPlans.forEach(plan => {
        if (plan.pattern === 'TUE_SAT') {
          simulatedSchedules.push({
            analystId: plan.analystId,
            date: moment.utc(plan.endDate).toDate(),
            shiftType: 'WEEKEND'
          });
        } else if (plan.pattern === 'SUN_THU') {
          simulatedSchedules.push({
            analystId: plan.analystId,
            date: moment.utc(plan.startDate).toDate(),
            shiftType: 'WEEKEND'
          });
        }
      });

      const fairnessData = fairnessCalculator.calculateRotationFairnessScores(
        allAnalysts,
        simulatedSchedules,
        weekStart
      );

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
          endDate: weekEnd
        });
        assignedThisWeek.add(nextAnalyst.id);
      }

      // 4. HOLISTIC FIX: Assign remaining analysts to MON_FRI
      for (const analyst of allAnalysts) {
        if (!assignedThisWeek.has(analyst.id)) {
          rotationPlans.push({
            analystId: analyst.id,
            pattern: 'MON_FRI',
            startDate: weekStart,
            endDate: weekEnd
          });
          assignedThisWeek.add(analyst.id);
        }
      }

      current.add(1, 'week');
    }

    return rotationPlans;
  }

  /**
   * Check if an analyst should work on a specific date
   * HOLISTIC FIX: Removed M-F default. Returns false if no plan exists (fail-safe).
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

    // HOLISTIC FIX: No plan = no work (fail-safe)
    // This should never happen if planRotation assigns all analysts
    console.warn(`⚠️ No rotation plan found for analyst ${analystId} on ${mDate.format('YYYY-MM-DD')}`);
    return false;
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
