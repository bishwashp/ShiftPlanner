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
      let lastWeekSunThuPlan = rotationPlans.find(p =>
        p.pattern === 'SUN_THU' &&
        moment.utc(p.startDate).isSame(moment.utc(weekStart).subtract(1, 'week'), 'week')
      );

      // HOLISTIC FIX: If not found internally, checking HISTORY (Jan 25 Bridge)
      if (!lastWeekSunThuPlan) {
        const checkDate = moment.utc(weekStart).subtract(1, 'week').startOf('week').toDate(); // Sunday
        // Find who worked this specific Sunday in history
        // We look for strict match on Sunday date
        const histPlan = historicalSchedules.find(s =>
          moment.utc(s.date).isSame(moment.utc(checkDate), 'day') &&
          // Heuristic: If they worked Sunday, they likely started SUN_THU
          // We could check other days, but Sunday is the anchor.
          (s.shiftType === 'AM' || s.shiftType === 'PM')
        );

        if (histPlan) {
          console.log(`🌉 [PipelineBridge] Found History for ${moment.utc(checkDate).format('YYYY-MM-DD')}: ${histPlan.analystId} (Assuming SUN_THU start)`);
          lastWeekSunThuPlan = {
            analystId: histPlan.analystId,
            pattern: 'SUN_THU',
            startDate: checkDate,
            endDate: moment.utc(checkDate).add(4, 'days').toDate() // Dummy end
          };
        }
      }

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

      // HOLISTIC FIX: Enforce Round Robin by excluding anyone who rotated recently.
      // Dynamic lookback based on pool size to ensure full cycle before repetition.
      const poolSize = allAnalysts.length;
      // Per user request: Strict 100% cycle. 
      // ensuring 100% cycle before repeating anyone.
      // FIX: Remove Math.max(4) constraint which breaks small pools (e.g. 3 people).
      const lookbackWeeks = Math.max(1, Math.floor(poolSize * 1.0));


      const lookbackStart = moment.utc(weekStart).subtract(lookbackWeeks, 'weeks');

      console.log(`🔒 [RotationDebug] PoolSize: ${poolSize}, LookbackWeeks: ${lookbackWeeks}, LookbackStart: ${lookbackStart.format('YYYY-MM-DD')}`);

      const recentRotations = rotationPlans.filter(p =>
        (p.pattern === 'SUN_THU' || p.pattern === 'TUE_SAT') &&
        moment.utc(p.startDate).startOf('day').isAfter(lookbackStart.startOf('day')) &&
        moment.utc(p.startDate).startOf('day').isBefore(moment.utc(weekStart).startOf('day'))
      );

      // ADDED: Check History for rotations too (Crucial for first few weeks of generation)
      // Heuristic: If they worked a Sunday in the lookback window, count it as a rotation
      const historyRotations = historicalSchedules.filter(s =>
        (s.shiftType === 'AM' || s.shiftType === 'PM') && // Filter for rotation shifts if needed, or just existence
        moment.utc(s.date).day() === 0 && // Sunday = start of SUN_THU (proxy)
        moment.utc(s.date).startOf('day').isAfter(lookbackStart.startOf('day')) &&
        moment.utc(s.date).startOf('day').isBefore(moment.utc(weekStart).startOf('day'))
      );

      recentRotations.forEach(plan => {
        if (plan.analystId) excludeAnalysts.add(plan.analystId);
      });

      historyRotations.forEach(s => {
        excludeAnalysts.add(s.analystId);
      });

      // console.log(`🔒 [RotationDebug] Excluding ${excludeAnalysts.size} analysts due to recent rotation`);

      // SIMULATE HISTORY for fairness calculation
      const simulatedSchedules = [...historicalSchedules];
      rotationPlans.forEach(plan => {
        if (plan.pattern === 'TUE_SAT') {
          simulatedSchedules.push({
            analystId: plan.analystId,
            date: moment.utc(plan.endDate).toDate(),
            shiftType: 'ROTATION_WEEKEND' // Internal marker for simulated weekend rotation
          });
        } else if (plan.pattern === 'SUN_THU') {
          simulatedSchedules.push({
            analystId: plan.analystId,
            date: moment.utc(plan.startDate).toDate(),
            shiftType: 'ROTATION_WEEKEND' // Internal marker for simulated weekend rotation
          });
        }
      });

      const fairnessData = fairnessCalculator.calculateRotationFairnessScores(
        allAnalysts,
        simulatedSchedules,
        weekStart
      );

      // DEBUG: Trace Srujana and PM analysts
      const traceNames = ['Srujana', 'Neha', 'Bish'];
      traceNames.forEach(name => {
        const analyst = allAnalysts.find(a => a.name === name);
        if (analyst) {
          const score = fairnessData.scores.get(analyst.id);
          const isExcluded = excludeAnalysts.has(analyst.id);
          console.log(`🔍 [RotationDebug] ${name}: Score=${score}, Excluded=${isExcluded}`);
        }
      });

      const nextAnalyst = fairnessCalculator.selectNextAnalystForRotation(
        allAnalysts,
        fairnessData,
        excludeAnalysts
      );

      if (nextAnalyst) {
        console.log(`🎯 [RotationDebug] Selected for SUN_THU: ${nextAnalyst.name} (Score: ${fairnessData.scores.get(nextAnalyst.id)})`);

        rotationPlans.push({
          analystId: nextAnalyst.id,
          pattern: 'SUN_THU',
          startDate: weekStart,
          endDate: weekEnd
        });
        assignedThisWeek.add(nextAnalyst.id);
      } else {
        console.warn(`⚠️ [RotationDebug] NO ANALYST SELECTED for SUN_THU on ${moment(weekStart).format('YYYY-MM-DD')}`);
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
        } else {
          // DEBUG: Catch overlapping assignments if any logic failed above
          // console.warn(`⚠️ [RotationDebug] Analyst ${analyst.name} skipped MON_FRI assignment (already assigned pattern)`);
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
      const allowed = pattern ? pattern.days.includes(mDate.day()) : false;

      // DEBUG Trace Swati/Bish
      if (analystId === 'cmjdyxxwi0002vu64lj6jk1t1' || analystId === 'cmjdyxxwf0000vu64hn1iz79w') {
        console.log(`🔍 [ShouldWorkTrace] ${analystId} on ${date.toISOString()}: Plan=${plan.pattern}, Days=${pattern?.days}, Result=${allowed}`);
      }

      return allowed;
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
  /**
   * Plan AM → PM rotation using balance-based logic.
   * 
   * DESIGN:
   * - Goal: Balance analyst counts between AM and PM shifts
   * - Constraint: Never leave AM with fewer than minimumRetention analysts (default: 2)
   * - Only rotate when PM needs help AND AM can spare
   */
  async planAMToPMRotation(
    startDate: Date,
    endDate: Date,
    amAnalysts: any[],
    pmAnalystCount: number, // How many PM analysts are available
    historicalSchedules: any[] = [],
    absenceService: any,
    rotationPlans: RotationPlan[], // NEW Dependency
    config: { minimumRetention: number } = { minimumRetention: 2 }
  ): Promise<Map<string, string[]>> {
    const rotationMap = new Map<string, string[]>();
    const { minimumRetention } = config;
    const amCount = amAnalysts.length;

    // BALANCE-BASED ROTATION CHECK
    // Goal: Equalize AM and PM counts as much as possible
    // Constraint: Never leave AM below minimumRetention

    const totalAnalysts = amCount + pmAnalystCount;
    const idealPerShift = Math.floor(totalAnalysts / 2);

    // How many can AM spare while keeping minimumRetention?
    const amSurplus = Math.max(0, amCount - minimumRetention);

    // How many does PM need to reach ideal balance?
    const pmDeficit = Math.max(0, idealPerShift - pmAnalystCount);

    // Rotate the minimum of what AM can spare and what PM needs
    const rotationCount = Math.min(amSurplus, pmDeficit);

    console.log(`AM→PM Rotation Check: AM=${amCount}, PM=${pmAnalystCount}, ideal=${idealPerShift}, surplus=${amSurplus}, deficit=${pmDeficit}, rotation=${rotationCount}`);

    if (rotationCount === 0) {
      console.log(`Skipping AM→PM rotation: AM cannot spare or PM doesn't need help`);
      return rotationMap;
    }

    const current = moment.utc(startDate);
    const end = moment.utc(endDate);

    // Track local history to ensure fairness within the generation window
    const localSchedules = [...historicalSchedules];

    while (current.isSameOrBefore(end, 'day')) {
      const dayOfWeek = current.day();
      const dateStr = current.format('YYYY-MM-DD');

      // Only rotate on weekdays (Mon=1 to Fri=5)
      if (dayOfWeek >= 1 && dayOfWeek <= 5) {
        // Filter out absent OR rotated-out analysts for this specific date
        const availableAnalysts = [];
        for (const analyst of amAnalysts) {
          const isAbsent = await absenceService.isAnalystAbsent(analyst.id, dateStr);
          // CRITICAL FIX: Check if they are actually working today (Pattern Check)
          const shouldWork = this.shouldAnalystWork(analyst.id, current.toDate(), rotationPlans);

          if (!isAbsent && shouldWork) {
            availableAnalysts.push(analyst);
          }
        }

        // Recalculate available surplus for this specific day
        const dailyAmSurplus = Math.max(0, availableAnalysts.length - minimumRetention);
        const dailyRotationCount = Math.min(dailyAmSurplus, rotationCount);

        if (dailyRotationCount === 0) {
          current.add(1, 'day');
          continue;
        }

        // Calculate fairness scores based on history + local decisions
        const fairnessData = fairnessCalculator.calculateAMToPMFairnessScores(
          availableAnalysts,
          localSchedules,
          current.toDate()
        );

        // Select analysts based on calculated rotation count (not hardcoded 2)
        const selectedAnalysts = fairnessCalculator.selectNextAnalystsForAMToPMRotation(
          availableAnalysts,
          fairnessData,
          dailyRotationCount // DYNAMIC: Based on balance calculation
        );

        const selectedIds = selectedAnalysts.map(a => a.id);
        rotationMap.set(dateStr, selectedIds);

        // Update local history so next day's calculation knows about this assignment
        selectedIds.forEach(id => {
          localSchedules.push({
            analystId: id,
            date: current.toDate(),
            shiftType: 'PM'
          });
        });
      }

      current.add(1, 'day');
    }

    return rotationMap;
  }
}

export const rotationManager = new RotationManager(null as any);
