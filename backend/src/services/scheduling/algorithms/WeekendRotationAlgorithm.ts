import { SchedulingAlgorithm, SchedulingContext, SchedulingResult, DEFAULT_ALGORITHM_CONFIG } from './types';
import { Analyst, Schedule, SchedulingConstraint } from '../../../../generated/prisma';
import { fairnessEngine } from './FairnessEngine';
import { constraintEngine } from './ConstraintEngine';
import { optimizationEngine } from './OptimizationEngine';
import { PatternContinuityService } from '../PatternContinuityService';
import { rotationManager, RotationManager } from '../RotationManager';
import { fairnessCalculator } from '../FairnessCalculator';
import { prisma } from '../../../lib/prisma';
import { createLocalDate, isWeekend } from '../../../utils/dateUtils';
import { SchedulingStrategy } from '../strategies/SchedulingStrategy';
import moment from 'moment';

export class WeekendRotationAlgorithm implements SchedulingAlgorithm, SchedulingStrategy {
  name = 'WeekendRotationAlgorithm';
  description = 'Advanced weekend rotation algorithm with fairness optimization and constraint satisfaction';
  version = '2.0.0';
  supportedFeatures = [
    'Fairness Optimization',
    'Constraint Validation',
    'Multiple Optimization Strategies',
    'Workload Balancing',
    'Screener Assignment Optimization',
    'Weekend Rotation Fairness',
    'Pattern Continuity'
  ];

  private patternContinuityService: PatternContinuityService;

  private injectedRotationManager: RotationManager | null = null;

  constructor(rotationManagerInstance?: RotationManager) {
    this.patternContinuityService = new PatternContinuityService(prisma);

    if (rotationManagerInstance) {
      // Use injected rotation manager (from IntelligentScheduler)
      this.injectedRotationManager = rotationManagerInstance;
    } else {
      // Initialize rotation manager with pattern continuity service (standalone usage)
      (rotationManager as any) = new RotationManager(this.patternContinuityService);
    }
  }

  /**
   * Get the active rotation manager (injected or singleton)
   */
  private getRotationManager(): RotationManager {
    return this.injectedRotationManager || rotationManager;
  }

  /**
   * Implementation of SchedulingStrategy interface
   */
  async generate(context: SchedulingContext): Promise<SchedulingResult> {
    return this.generateSchedules(context);
  }

  async generateSchedules(context: SchedulingContext): Promise<SchedulingResult> {
    const startTime = Date.now();
    console.log(`🚀 Starting ${this.name} v${this.version} with ${context.analysts.length} analysts`);

    // Use default config if not provided
    const config = context.algorithmConfig || DEFAULT_ALGORITHM_CONFIG;

    // Generate initial schedules
    const initialSchedules = await this.generateInitialSchedules(context);

    // Validate constraints
    const constraintValidation = constraintEngine.validateConstraints(initialSchedules, context.globalConstraints);

    // Calculate initial fairness metrics
    const fairnessMetrics = fairnessEngine.calculateFairness(initialSchedules, context.analysts);

    // Optimize schedules if needed
    let optimizedSchedules = initialSchedules;
    if (config.optimizationStrategy !== 'GREEDY' || fairnessMetrics.overallFairnessScore < 0.7) {
      console.log(`🔧 Optimizing schedules using ${config.optimizationStrategy} strategy`);
      optimizedSchedules = await optimizationEngine.optimizeSchedules(initialSchedules, context);
    }

    // Recalculate metrics after optimization
    const finalFairnessMetrics = fairnessEngine.calculateFairness(optimizedSchedules, context.analysts);
    const finalConstraintValidation = constraintEngine.validateConstraints(optimizedSchedules, context.globalConstraints);

    // Generate conflicts and overwrites
    const conflicts = this.generateConflicts(optimizedSchedules, context);
    const overwrites = this.generateOverwrites(optimizedSchedules, context.existingSchedules);

    // Calculate performance metrics
    const executionTime = Date.now() - startTime;
    const performanceMetrics = {
      totalQueries: 0, // Will be updated by Prisma client
      averageQueryTime: 0,
      slowQueries: 0,
      cacheHitRate: 0,
      algorithmExecutionTime: executionTime,
      memoryUsage: process.memoryUsage().heapUsed / 1024 / 1024, // MB
      optimizationIterations: 0 // Will be updated by optimization engine
    };

    console.log(`✅ ${this.name} completed in ${executionTime}ms`);
    console.log(`📊 Fairness Score: ${finalFairnessMetrics.overallFairnessScore.toFixed(4)}`);
    console.log(`🔒 Constraint Score: ${finalConstraintValidation.score.toFixed(4)}`);

    return {
      proposedSchedules: optimizedSchedules,
      conflicts,
      overwrites,
      fairnessMetrics: finalFairnessMetrics,
      performanceMetrics
    };
  }

  /**
   * Process a single weekend day and return analyst assignments.
   * This is the "hippocampus" method called by IntelligentScheduler for weekend delegation.
   * 
   * @param currentDate - The weekend date to process
   * @param pool - All analysts in the unified regional pool
   * @param historySchedules - Existing + simulated schedules for fairness context
   * @param rotationPlans - Pattern rotation plans for shouldWork determination
   * @param analystStreaks - Map of analyst ID to consecutive work day count
   * @returns Array of proposed schedule assignments for this weekend day
   */
  async processWeekendDay(
    currentDate: Date,
    pool: any[],
    historySchedules: any[],
    rotationPlans: any[],
    analystStreaks: Map<string, number>
  ): Promise<any[]> {
    const dateStr = moment.utc(currentDate).format('YYYY-MM-DD');
    const maxConsecutiveDays = 5;
    const weekendAnalystsPerDay = 1; // Could be made configurable per region

    const rm = this.getRotationManager();

    // Filter available analysts based on rotation, absence (vacation), and fatigue
    // CRITICAL: The shouldWork check from RotationManager respects the analyst's assigned pattern.
    // Only analysts whose pattern includes this weekend day (Sun=0 or Sat=6) will pass.
    // - SUN_THU pattern includes Sunday (day 0)
    // - TUE_SAT pattern includes Saturday (day 6)
    // - MON_FRI pattern includes neither (so they won't be eligible for weekend work)
    const available: any[] = [];
    for (const analyst of pool) {
      // Check rotation pattern - THIS IS THE KEY FILTER
      const shouldWork = rm.shouldAnalystWork(analyst.id, currentDate, rotationPlans);

      // DEBUG: Trace Srujana on Saturdays
      if (analyst.name === 'Srujana' || analyst.name === 'Sarahi') {
        const plan = rotationPlans.find(p => p.analystId === analyst.id && moment(currentDate).isBetween(p.startDate, p.endDate, 'day', '[]'));
        const currentDayStr = moment(currentDate).format('YYYY-MM-DD');
        console.log(`🕵️‍♀️ [WeekendDebug] ${analyst.name} on ${currentDayStr}: Pattern=${plan?.pattern}, ShouldWork=${shouldWork}, Streak=${analystStreaks.get(analyst.id)}`);
      }

      if (!shouldWork) {
        continue;
      }

      // Check vacation
      const onVacation = analyst.vacations?.some((v: any) =>
        new Date(v.startDate) <= currentDate && new Date(v.endDate) >= currentDate
      ) || false;

      if (onVacation) {
        continue;
      }

      // Check consecutive workday limit (max 5 days)
      const streak = analystStreaks.get(analyst.id) || 0;
      if (streak >= maxConsecutiveDays) {
        console.log(`⚠️ [WeekendRotation] ${analyst.name} skipped - streak ${streak} >= max ${maxConsecutiveDays}`);
        continue;
      }

      // DEBUG: Trace Bish specifically
      if (analyst.name.includes('Bish')) {
        const plan = rotationPlans.find(p => p.analystId === analyst.id && moment(currentDate).isBetween(p.startDate, p.endDate, 'day', '[]'));
        console.log(`🕵️‍♂️ [BishDebug] ${dateStr}: Pattern=${plan?.pattern}, ShouldWork=${shouldWork}, Streak=${streak}, Vacation=${onVacation}`);
      }

      available.push(analyst);
    }

    if (available.length === 0) {
      console.log(`⚠️ [WeekendRotation] No available analysts for ${dateStr}`);
      return [];
    }

    // Calculate fairness scores to select the most equitable analyst(s)
    const fairnessData = fairnessCalculator.calculateRotationFairnessScores(
      available,
      historySchedules,
      currentDate
    );

    // Sort by fairness score (higher = more fair to assign)
    const sortedAnalysts = available.sort((a, b) => {
      const scoreA = fairnessData.scores.get(a.id) || 0;
      const scoreB = fairnessData.scores.get(b.id) || 0;
      return scoreB - scoreA;
    });

    // Select top N analysts based on weekendAnalystsPerDay limit
    console.log(`🔍 [SliceDebug] limit=${weekendAnalystsPerDay}, sorted=${sortedAnalysts.length}`);

    // MANDATORY PATTERN CHECK:
    const dayOfWeek = moment.utc(currentDate).day();
    const mandatoryAnalysts: any[] = [];
    const optionalAnalysts: any[] = [];

    // Group 1: Mandatory Contract (Pattern requires this specific day)
    for (const analyst of sortedAnalysts) {
      const plan = rotationPlans.find(p => p.analystId === analyst.id && moment(currentDate).isBetween(p.startDate, p.endDate, 'day', '[]'));
      const patternName = plan?.pattern || '';

      const isMandatorySat = dayOfWeek === 6 && patternName === 'TUE_SAT';
      const isMandatorySun = dayOfWeek === 0 && patternName === 'SUN_THU';

      if (isMandatorySat || isMandatorySun) {
        mandatoryAnalysts.push(analyst);
      } else {
        optionalAnalysts.push(analyst);
      }
    }

    // Fill output: Mandatory first, then Optional up to limit
    const finalSelection: any[] = [...mandatoryAnalysts];

    // Fill remaining slots with Pattern-Eligible Optional analysts
    // Note: We respect the limit for optionals, but Mandatory forced their way in.
    if (finalSelection.length < weekendAnalystsPerDay) {
      const needed = weekendAnalystsPerDay - finalSelection.length;
      const recruited = optionalAnalysts.slice(0, needed);
      recruited.forEach(r => finalSelection.push(r));
    }

    // COMMON SENSE FALLBACK (Availability First):
    // If we STILL have gaps (because no one matched the Pattern ticket),
    // we recruit from the GENERAL POOL (ignoring the 'shouldWork' pattern constraint).
    if (finalSelection.length < weekendAnalystsPerDay) {
      console.log(`⚠️ [WeekendRotation] Gap detected for ${dateStr}! Triggering Common Sense Fallback.`);
      const needed = weekendAnalystsPerDay - finalSelection.length;

      // Find candidates from the original POOL who are NOT already selected
      // We re-apply only HARD/SAFETY constraints (Vacation, Streak)
      // We IGNORE the 'shouldWork' (Pattern) constraint
      const fallbackCandidates = pool.filter(analyst => {
        // fast skip if already picked
        if (finalSelection.some(s => s.id === analyst.id)) return false;

        // Check Vacation
        const onVacation = analyst.vacations?.some((v: any) =>
          new Date(v.startDate) <= currentDate && new Date(v.endDate) >= currentDate
        ) || false;
        if (onVacation) return false;

        // Check Streak (Safety First - don't burn them out)
        const streak = analystStreaks.get(analyst.id) || 0;
        if (streak >= maxConsecutiveDays) return false;

        return true;
      });

      // Calculate fairness for these candidates (if not already in map)
      // (They should be in map if fairnessCalculator ran on 'whole pool', but previous call ran on 'available' subset)
      // Let's assume fairnessData covers the subset passed to it.
      // We might need to look up scores or assume 0 (or re-calc, but expensive).
      // Safest: Use existing scores if available, else prioritized by lower streak?
      // Actually, fairnessCalculator usually takes 'available'.
      // Let's sort by streak (freshest first) then arbitrary/fairness if available.

      const sortedFallback = fallbackCandidates.sort((a, b) => {
        const scoreA = fairnessData.scores.get(a.id) || 0;
        const scoreB = fairnessData.scores.get(b.id) || 0;
        // Preference: High Fairness Score -> Low Streak
        if (scoreA !== scoreB) return scoreB - scoreA;
        return (analystStreaks.get(a.id) || 0) - (analystStreaks.get(b.id) || 0);
      });

      const recruits = sortedFallback.slice(0, needed);
      recruits.forEach(r => {
        console.log(`🚑 [Fallback] Recruited ${r.name} to fill empty slot.`);
        finalSelection.push(r);
      });
    }

    const selectedAnalysts = finalSelection;

    if (mandatoryAnalysts.length > weekendAnalystsPerDay) {
      console.log(`⚠️ [WeekendRotation] Override: Assigned ${mandatoryAnalysts.length} mandatory analysts (Limit: ${weekendAnalystsPerDay})`);
    }

    // Build proposed schedule entries
    const assignments: any[] = [];
    for (const analyst of selectedAnalysts) {
      assignments.push({
        date: moment.utc(currentDate).format('YYYY-MM-DD'), // Hardened: Ensure UTC date string prevents timezone shifts
        analystId: analyst.id,
        analystName: analyst.name,
        shiftType: analyst.shiftType || 'WEEKEND', // Preserve original shift type
        isScreener: false,
        type: 'WEEKEND_COVERAGE'
      });
    }

    console.log(`📅 [WeekendRotation] ${dateStr}: Assigned ${assignments.length} analyst(s) - ${assignments.map(a => a.analystName).join(', ')}`);

    return assignments;
  }

  validateConstraints(schedules: any[], constraints: SchedulingConstraint[]): any {
    return constraintEngine.validateConstraints(schedules, constraints);
  }

  calculateFairness(schedules: any[], analysts: Analyst[]): any {
    return fairnessEngine.calculateFairness(schedules, analysts);
  }

  async optimizeSchedules(schedules: any[], context: SchedulingContext): Promise<any[]> {
    return optimizationEngine.optimizeSchedules(schedules, context);
  }

  private async generateInitialSchedules(context: SchedulingContext): Promise<any[]> {
    // ITERATIVE GENERATION (Month-by-Month)
    // This ensures that Month N+1 'sees' the actual assignments (including overrides/fallbacks) from Month N.
    const allProposedSchedules: any[] = [];
    const allConflicts: any[] = [];
    const allOverwrites: any[] = [];

    // Clone existing schedules to serve as the growing history
    let accumulatedHistory: any[] = [...context.existingSchedules];

    let currentStart = moment.utc(context.startDate).startOf('month');
    const finalEnd = moment.utc(context.endDate).endOf('day');

    console.log(`🔄 Starting Iterative Generation from ${currentStart.format('YYYY-MM-DD')} to ${finalEnd.format('YYYY-MM-DD')}`);

    while (currentStart.isBefore(finalEnd)) {
      const monthEnd = moment(currentStart).endOf('month');
      const loopEnd = monthEnd.isAfter(finalEnd) ? finalEnd : monthEnd;

      const loopStartStr = currentStart.format('YYYY-MM-DD');
      const loopEndStr = loopEnd.format('YYYY-MM-DD');

      console.log(`\n📅 Processing Month: ${loopStartStr} -> ${loopEndStr}`);
      console.log(`   History Context: ${accumulatedHistory.length} records`);

      // 1. Generate Regular Schedules for this Month
      // Note: passing 'accumulatedHistory' allows RotationManager to see previous month's actuals
      const regularResult = await this.generateRegularWorkSchedules(
        currentStart.toDate(),
        loopEnd.toDate(),
        context.analysts,
        accumulatedHistory, // Critical: Update history
        context.globalConstraints
      );

      // 2. Generate Screener Schedules for this Month
      const screenerResult = await this.generateScreenerSchedules(
        currentStart.toDate(),
        loopEnd.toDate(),
        context.analysts,
        accumulatedHistory,
        context.globalConstraints,
        regularResult.proposedSchedules // Pass current month's regular schedules for context
      );

      // 3. Merge & Resolve for this Month
      const monthProposed = [...regularResult.proposedSchedules];
      const monthConflicts = [...regularResult.conflicts, ...screenerResult.conflicts];
      const monthOverwrites = [...regularResult.overwrites, ...screenerResult.overwrites];

      // Apply Screener Overwrites locally
      screenerResult.proposedSchedules.forEach(screenerSchedule => {
        const index = monthProposed.findIndex(p => p.analystId === screenerSchedule.analystId && p.date === screenerSchedule.date);
        if (index !== -1) {
          monthProposed[index].isScreener = true;
          if (screenerSchedule.type === 'OVERWRITE_SCHEDULE' && monthProposed[index].type !== 'OVERWRITE_SCHEDULE') {
            monthProposed[index].type = 'OVERWRITE_SCHEDULE';
            // Add overwrite record
            if (!monthOverwrites.some(o => o.date === screenerSchedule.date && o.analystId === screenerSchedule.analystId)) {
              monthOverwrites.push({
                date: screenerSchedule.date,
                analystId: screenerSchedule.analystId,
                analystName: screenerSchedule.analystName,
                from: { shiftType: monthProposed[index].shiftType, isScreener: false },
                to: { shiftType: monthProposed[index].shiftType, isScreener: true }
              });
            }
          }
        } else {
          monthProposed.push(screenerSchedule);
        }
      });

      // 4. Accumulate Results
      allProposedSchedules.push(...monthProposed);
      allConflicts.push(...monthConflicts);
      allOverwrites.push(...monthOverwrites);

      // 5. Update History for Next Iteration
      // We convert proposed schedules to 'Schedule-like' objects for history
      monthProposed.forEach(p => {
        accumulatedHistory.push({
          analystId: p.analystId,
          date: new Date(p.date), // Ensure Date object
          shiftType: p.shiftType,
          isScreener: p.isScreener || false,
          regionId: 'simulated-region', // Mock ID
          id: `simulated-${Date.now()}-${Math.random()}`, // Mock ID
          createdAt: new Date(),
          updatedAt: new Date(),
          // minimal fields needed for history check
        });
      });

      // Advance to next month
      currentStart.add(1, 'month').startOf('month');
    }

    return allProposedSchedules;
  }

  private async generateRegularWorkSchedules(
    startDate: Date,
    endDate: Date,
    analysts: any[],
    existingSchedules: any[],
    globalConstraints: any[]
  ) {
    const result = {
      proposedSchedules: [] as any[],
      conflicts: [] as any[],
      overwrites: [] as any[]
    };

    console.log(`🔄 Planning rotation for date range: ${startDate.toISOString().split('T')[0]} to ${endDate.toISOString().split('T')[0]}`);

    // UNIFIED POOL REFACTOR: Treat all analysts as one pool for weekend rotation
    // This allows equitable rotation regardless of AM/PM status (10 AM + 3 PM = 13 Total Pool)
    console.log(`🔄 Planning rotation for FULL POOL of ${analysts.length} analysts`);

    const allRotationPlans = await rotationManager.planRotation(
      this.name,
      'WEEKEND', // Use generic context
      startDate,
      endDate,
      analysts,
      existingSchedules
    );

    // For compatibility with downstream logic, we can still filter these plans if needed,
    // or just pass them all. The key was generating them from a Shared State.
    console.log(`📊 Generated ${allRotationPlans.length} rotation plans from unified pool`);

    // Maintain AM/PM lists for shift assignment (not rotation selection)
    const morningAnalysts = analysts.filter((a: any) => ['MORNING', 'AM'].includes(a.shiftType));
    const eveningAnalysts = analysts.filter((a: any) => ['EVENING', 'PM'].includes(a.shiftType));

    // Fallback variables for existing logic references
    const morningRotationPlans = allRotationPlans.filter(p => morningAnalysts.some((a: any) => a.id === p.analystId));
    // Note: evening plans now come from the SAME fair pool distribution
    const eveningRotationPlans = allRotationPlans.filter(p => eveningAnalysts.some((a: any) => a.id === p.analystId));


    // ============ AM -> PM ROTATION INTEGRATION ============
    // Fix: Integrate the AM->PM rotation logic that was missing (but present in IntelligentScheduler)

    // 1. Create simple absence service adapter
    const simpleAbsenceService = {
      isAnalystAbsent: async (analystId: string, dateStr: string) => {
        const analyst = analysts.find(a => a.id === analystId);
        if (!analyst) return true;
        return analyst.vacations?.some((v: any) =>
          new Date(v.startDate) <= new Date(dateStr) &&
          new Date(v.endDate) >= new Date(dateStr)
        ) || false;
      }
    };

    // 2. Plan AM->PM rotations
    let amToPmRotationMap = new Map<string, string[]>();
    const eveningAnalystCount = eveningAnalysts.length;

    // Only separate if we have distinct pools
    if (morningAnalysts.length > 0 && eveningAnalysts.length > 0) {
      console.log(`🔄 Planning AM->PM rotations to balance ${morningAnalysts.length} AM vs ${eveningAnalystCount} PM analysts`);
      amToPmRotationMap = await rotationManager.planAMToPMRotation(
        startDate,
        endDate,
        morningAnalysts,
        eveningAnalystCount,
        existingSchedules,
        simpleAbsenceService,
        morningRotationPlans
      );
    }


    // Track weekend assignments for within-generation fairness
    const simulatedWeekendSchedules = [...existingSchedules];

    // Track consecutive work day streaks - Phase 1 fix for Priyesh 6-day issue
    const maxConsecutiveDays = 5;
    const analystStreaks = new Map<string, number>();
    const allAnalysts = [...morningAnalysts, ...eveningAnalysts];
    for (const analyst of allAnalysts) {
      analystStreaks.set(analyst.id, this.calculateInitialStreak(analyst.id, startDate, existingSchedules));
    }

    // Generate schedules day by day
    const currentDate = new Date(startDate);

    while (currentDate <= endDate) {
      const dateStr = currentDate.toISOString().split('T')[0];
      const dayOfWeek = currentDate.getDay();

      // Check for blackout dates
      const blackoutConstraint = globalConstraints.find(c =>
        new Date((c as any).startDate) <= currentDate &&
        new Date((c as any).endDate) >= currentDate &&
        (c as any).constraintType === 'BLACKOUT_DATE'
      );

      if (blackoutConstraint) {
        result.conflicts.push({
          date: dateStr,
          type: 'BLACKOUT_DATE',
          description: (blackoutConstraint as any).description || 'No scheduling allowed on this date',
          severity: 'CRITICAL'
        });
        currentDate.setDate(currentDate.getDate() + 1);
        continue;
      }

      // Check for holidays
      const holidayConstraint = globalConstraints.find(c =>
        new Date((c as any).startDate) <= currentDate &&
        new Date((c as any).endDate) >= currentDate &&
        (c as any).constraintType === 'HOLIDAY'
      );

      if (holidayConstraint) {
        result.conflicts.push({
          date: dateStr,
          type: 'HOLIDAY',
          description: (holidayConstraint as any).description || 'Holiday - no regular scheduling',
          severity: 'INFO'
        });
        currentDate.setDate(currentDate.getDate() + 1);
        continue;
      }

      // ============ WEEKEND HANDLING: Unified Regional Pool ============
      if (isWeekend(currentDate)) {
        // Get weekendAnalystsPerDay from region config (default: 1)
        // TODO: Fetch from region, for now use 1
        const weekendAnalystsPerDay = 1;

        // Check how many analysts already assigned to this date (Phase 2 fix)
        const alreadyAssignedToday = result.proposedSchedules.filter(
          s => s.date === dateStr
        ).length;

        if (alreadyAssignedToday >= weekendAnalystsPerDay) {
          // Already at limit for this date, skip
          currentDate.setDate(currentDate.getDate() + 1);
          continue;
        }

        const remainingSlots = weekendAnalystsPerDay - alreadyAssignedToday;

        // Weekend rotation uses unified pool (all analysts regardless of shift type)
        const allRegionalAnalysts = [...morningAnalysts, ...eveningAnalysts];

        // Filter out analysts on vacation AND those at max consecutive days
        const availableAnalysts = allRegionalAnalysts.filter(analyst => {
          const onVacation = analyst.vacations?.some((v: any) =>
            new Date(v.startDate) <= currentDate &&
            new Date(v.endDate) >= currentDate
          ) || false;
          const streak = analystStreaks.get(analyst.id) || 0;

          // Unconditional Log
          console.log(`🕵️‍♂️ [FilterAudit] ${analyst.name} (${dateStr}): Streak=${streak}, Vacation=${onVacation}`);

          return !onVacation && streak < maxConsecutiveDays;
        });

        if (availableAnalysts.length > 0) {
          // Calculate fairness scores for weekend rotation selection
          // Use simulatedWeekendSchedules which includes newly proposed weekend assignments
          const fairnessData = fairnessCalculator.calculateRotationFairnessScores(
            availableAnalysts,
            simulatedWeekendSchedules,
            currentDate
          );

          // Select the analyst(s) with highest fairness score (least recently rotated)
          // Select the analyst(s) with highest fairness score (least recently rotated)
          const sortedAnalysts = availableAnalysts.sort((a, b) => {
            const scoreA = fairnessData.scores.get(a.id) || 0;
            const scoreB = fairnessData.scores.get(b.id) || 0;
            return scoreB - scoreA; // Higher score = more fair to select
          });

          // MANDATORY PATTERN CHECK (Inlined Fix):
          const dayOfWeek = moment.utc(currentDate).day();
          const mandatoryAnalysts: any[] = [];
          const optionalAnalysts: any[] = [];

          for (const analyst of sortedAnalysts) {
            // Find rotation plan for this analyst
            // Note: allRotationPlans is available from scope above (line 298)
            const plan = allRotationPlans.find(p => p.analystId === analyst.id && moment(currentDate).isBetween(p.startDate, p.endDate, 'day', '[]'));
            const patternName = plan?.pattern || '';

            const isMandatorySat = dayOfWeek === 6 && patternName === 'TUE_SAT';
            const isMandatorySun = dayOfWeek === 0 && patternName === 'SUN_THU';

            if (analyst.name.includes('Bish')) {
              console.log(`🕵️‍♂️ [BishDebugInlined] ${dateStr}: PlanFound=${!!plan}, Pattern=${patternName}, Day=${dayOfWeek}, IsMandatory=${isMandatorySat}`);
            }

            if (isMandatorySat || isMandatorySun) {
              mandatoryAnalysts.push(analyst);
            } else {
              optionalAnalysts.push(analyst);
            }
          }

          // Fill output: Mandatory first, then Optional up to limit
          const finalSelection: any[] = [...mandatoryAnalysts];

          if (finalSelection.length < remainingSlots) {
            const needed = remainingSlots - finalSelection.length;
            const recruited = optionalAnalysts.slice(0, needed);
            recruited.forEach(r => finalSelection.push(r));
          }

          // COMMON SENSE FALLBACK (Inlined):
          if (finalSelection.length < remainingSlots) {
            console.log(`⚠️ [WeekendRotation] Gap detected (Inlined) for ${dateStr}! Triggering Fallback.`);
            const needed = remainingSlots - finalSelection.length;

            // Reuse 'allRegionalAnalysts' (original pool)
            const fallbackCandidates = allRegionalAnalysts.filter(analyst => {
              if (finalSelection.some(s => s.id === analyst.id)) return false;

              const onVacation = analyst.vacations?.some((v: any) =>
                new Date(v.startDate) <= currentDate && new Date(v.endDate) >= currentDate
              ) || false;
              if (onVacation) return false;

              const streak = analystStreaks.get(analyst.id) || 0;
              if (streak >= maxConsecutiveDays) return false;

              return true;
            });

            const sortedFallback = fallbackCandidates.sort((a, b) => {
              const scoreA = fairnessData.scores.get(a.id) || 0;
              const scoreB = fairnessData.scores.get(b.id) || 0;
              if (scoreA !== scoreB) return scoreB - scoreA;
              return (analystStreaks.get(a.id) || 0) - (analystStreaks.get(b.id) || 0);
            });

            const recruits = sortedFallback.slice(0, needed);
            recruits.forEach(r => {
              console.log(`🚑 [Fallback] Recruited ${r.name} to fill empty slot.`);
              finalSelection.push(r);
            });
          }

          const selectedWeekendAnalysts = finalSelection;

          if (mandatoryAnalysts.length > remainingSlots) {
            console.log(`⚠️ [WeekendRotation] Override: Assigned ${mandatoryAnalysts.length} mandatory analysts (Limit: ${remainingSlots} left)`);
          }

          for (const analyst of selectedWeekendAnalysts) {
            // Weekend shifts use "WEEKEND" as shift type or the analyst's original shift
            const schedule = this.createScheduleEntry(
              analyst,
              currentDate,
              analyst.shiftType, // Keep their original shift type for data consistency
              false,
              existingSchedules,
              result.overwrites
            );

            if (schedule) {
              result.proposedSchedules.push(schedule);
              // Add to simulated schedules so next weekend day considers this assignment
              simulatedWeekendSchedules.push({
                analystId: analyst.id,
                date: currentDate,
                shiftType: analyst.shiftType
              });
            }
          }
        }
      } else {
        // ============ WEEKDAY HANDLING: Shift-based Pools ============
        // Process morning analysts
        for (const analyst of morningAnalysts) {
          // Check if analyst should work based on rotation
          const shouldWork = rotationManager.shouldAnalystWork(
            analyst.id,
            currentDate,
            morningRotationPlans
          );

          // Check for vacations
          const onVacation = analyst.vacations?.some((v: any) =>
            new Date(v.startDate) <= currentDate &&
            new Date(v.endDate) >= currentDate
          ) || false;

          // Check consecutive workday limit
          const streak = analystStreaks.get(analyst.id) || 0;

          if (shouldWork && !onVacation && streak < maxConsecutiveDays) {

            // CHECK AM->PM ROTATION
            const dateStr = currentDate.toISOString().split('T')[0];
            const rotatedIds = amToPmRotationMap.get(dateStr) || [];
            const isRotatedToPM = rotatedIds.includes(analyst.id);
            const finalShiftType = isRotatedToPM ? 'PM' : 'AM';
            const assignmentType = isRotatedToPM ? 'AM_TO_PM_ROTATION' : 'NEW_SCHEDULE';

            // Create schedule entry
            const schedule = this.createScheduleEntry(
              analyst,
              currentDate,
              finalShiftType,
              false,
              existingSchedules,
              result.overwrites
            );

            if (schedule) {
              schedule.type = assignmentType; // Override type if needed
              result.proposedSchedules.push(schedule);
            }
          }
        }

        // Process evening analysts
        for (const analyst of eveningAnalysts) {
          // Check if analyst should work based on rotation
          const shouldWork = rotationManager.shouldAnalystWork(
            analyst.id,
            currentDate,
            eveningRotationPlans
          );

          // Check for vacations
          const onVacation = analyst.vacations?.some((v: any) =>
            new Date(v.startDate) <= currentDate &&
            new Date(v.endDate) >= currentDate
          ) || false;

          // Check consecutive workday limit
          const streakPM = analystStreaks.get(analyst.id) || 0;

          if (shouldWork && !onVacation && streakPM < maxConsecutiveDays) {
            // Create schedule entry
            const schedule = this.createScheduleEntry(
              analyst,
              currentDate,
              'PM',
              false,
              existingSchedules,
              result.overwrites
            );

            if (schedule) {
              result.proposedSchedules.push(schedule);
            }
          }
        }
      }
      // ============ END DAY PROCESSING ============

      // Update consecutive work day streaks
      for (const analyst of allAnalysts) {
        const workedToday = result.proposedSchedules.some(
          s => s.date === dateStr && s.analystId === analyst.id
        );
        if (workedToday) {
          analystStreaks.set(analyst.id, (analystStreaks.get(analyst.id) || 0) + 1);
        } else {
          analystStreaks.set(analyst.id, 0);
        }
      }

      // Move to next day
      currentDate.setDate(currentDate.getDate() + 1);
    }

    return result;
  }

  private async assignAnalystsWithContinuity(
    analysts: any[],
    patterns: any[],
    continuityData: Map<string, any>,
    startDate: Date
  ) {
    const assignments: { [key: string]: { pattern: any; analysts: any[] } } = {};
    patterns.forEach(p => {
      assignments[p.name] = { pattern: p, analysts: [] };
    });

    // First, assign analysts based on continuity data
    const assignedAnalystIds = new Set<string>();

    analysts.forEach(analyst => {
      const analystContinuity = continuityData.get(analyst.id);
      if (analystContinuity) {
        // Calculate which pattern this analyst should be on based on continuity
        const weeksSinceLastWork = Math.floor(
          (startDate.getTime() - analystContinuity.lastWorkDate.getTime()) / (1000 * 60 * 60 * 24 * 7)
        );

        // Determine the pattern based on rotation
        let currentPattern = analystContinuity.lastPattern;
        for (let i = 0; i < weeksSinceLastWork; i++) {
          const pattern = patterns.find(p => p.name === currentPattern);
          if (pattern) {
            currentPattern = pattern.nextPattern;
          }
        }

        if (assignments[currentPattern]) {
          assignments[currentPattern].analysts.push(analyst);
          assignedAnalystIds.add(analyst.id);
        }
      }
    });

    // Then assign remaining analysts using the enhanced logic
    const unassignedAnalysts = analysts.filter(a => !assignedAnalystIds.has(a.id));
    if (unassignedAnalysts.length > 0) {
      const tempAssignments = this.assignAnalystsToPatterns(unassignedAnalysts, patterns);

      // Merge the temporary assignments
      for (const patternName in tempAssignments) {
        assignments[patternName].analysts.push(...tempAssignments[patternName].analysts);
      }
    }

    return assignments;
  }

  private async savePatternContinuity(
    morningPatterns: any,
    eveningPatterns: any,
    endDate: Date
  ) {
    const continuityData: any[] = [];
    const workPatterns = [
      { name: 'SUN_THU', days: [0, 1, 2, 3, 4], nextPattern: 'TUE_SAT' },
      { name: 'MON_FRI', days: [1, 2, 3, 4, 5], nextPattern: 'SUN_THU' },
      { name: 'TUE_SAT', days: [2, 3, 4, 5, 6], nextPattern: 'MON_FRI' }
    ];

    // Calculate week number based on a 3-week rotation cycle
    const cycleStartDate = new Date('2025-01-01'); // Reference date for cycle calculation
    const weekNumber = Math.floor((endDate.getTime() - cycleStartDate.getTime()) / (1000 * 60 * 60 * 24 * 7)) % 3 + 1;

    // Process morning patterns
    for (const patternName in morningPatterns) {
      const assignment = morningPatterns[patternName];
      assignment.analysts.forEach((analyst: any) => {
        continuityData.push({
          analystId: analyst.id,
          lastPattern: patternName,
          lastWorkDate: endDate,
          weekNumber: weekNumber,
          metadata: { shiftType: 'MORNING' }
        });
      });
    }

    // Process evening patterns
    for (const patternName in eveningPatterns) {
      const assignment = eveningPatterns[patternName];
      assignment.analysts.forEach((analyst: any) => {
        continuityData.push({
          analystId: analyst.id,
          lastPattern: patternName,
          lastWorkDate: endDate,
          weekNumber: weekNumber,
          metadata: { shiftType: 'EVENING' }
        });
      });
    }

    if (continuityData.length > 0) {
      await this.patternContinuityService.saveContinuityData(this.name, continuityData);
    }
  }

  private assignAnalystsToPatterns(analysts: any[], patterns: any[]) {
    const assignments: { [key: string]: { pattern: any; analysts: any[] } } = {};
    patterns.forEach(p => {
      assignments[p.name] = { pattern: p, analysts: [] };
    });

    // Enhanced assignment logic to ensure coverage
    if (analysts.length < patterns.length) {
      // If we have fewer analysts than patterns, ensure every analyst works
      // and some analysts work multiple patterns to ensure full coverage
      analysts.forEach((analyst, index) => {
        // Primary assignment
        const primaryPattern = patterns[index % patterns.length];
        assignments[primaryPattern.name].analysts.push(analyst);

        // Additional assignments to ensure coverage
        // Calculate how many patterns need coverage
        const patternsNeedingCoverage = patterns.filter(p =>
          assignments[p.name].analysts.length === 0
        );

        // Assign analysts to uncovered patterns
        if (patternsNeedingCoverage.length > 0 && index < patternsNeedingCoverage.length) {
          const additionalPattern = patternsNeedingCoverage[index];
          if (additionalPattern && additionalPattern.name !== primaryPattern.name) {
            assignments[additionalPattern.name].analysts.push(analyst);
          }
        }
      });

      // Final check: ensure all patterns have at least one analyst
      patterns.forEach(pattern => {
        if (assignments[pattern.name].analysts.length === 0 && analysts.length > 0) {
          // Assign the analyst with the least assignments
          const analystWorkload = new Map<string, number>();
          analysts.forEach(a => analystWorkload.set(a.id, 0));

          // Count current assignments
          Object.values(assignments).forEach(assignment => {
            assignment.analysts.forEach(a => {
              analystWorkload.set(a.id, (analystWorkload.get(a.id) || 0) + 1);
            });
          });

          // Find analyst with least assignments
          let minWorkload = Infinity;
          let selectedAnalyst = analysts[0];
          analysts.forEach(a => {
            const workload = analystWorkload.get(a.id) || 0;
            if (workload < minWorkload) {
              minWorkload = workload;
              selectedAnalyst = a;
            }
          });

          assignments[pattern.name].analysts.push(selectedAnalyst);
        }
      });
    } else {
      // Standard assignment when we have enough analysts - distribute evenly across patterns
      const analystsPerPattern = Math.floor(analysts.length / patterns.length);
      const remainingAnalysts = analysts.length % patterns.length;

      let analystIndex = 0;
      patterns.forEach((pattern, patternIndex) => {
        // Calculate how many analysts this pattern should get
        const analystsForThisPattern = analystsPerPattern + (patternIndex < remainingAnalysts ? 1 : 0);

        // Assign analysts to this pattern
        for (let i = 0; i < analystsForThisPattern; i++) {
          if (analystIndex < analysts.length) {
            assignments[pattern.name].analysts.push(analysts[analystIndex]);
            analystIndex++;
          }
        }
      });
    }

    return assignments;
  }

  private rotatePatterns(
    patternAssignments: { [key: string]: { pattern: any; analysts: any[] } },
    patterns: any[]
  ) {
    const newAssignments: { [key: string]: { pattern: any; analysts: any[] } } = {};
    patterns.forEach(p => {
      newAssignments[p.name] = { pattern: p, analysts: [] };
    });

    for (const patternName in patternAssignments) {
      const assignment = patternAssignments[patternName];
      const nextPatternName = assignment.pattern.nextPattern;
      newAssignments[nextPatternName].analysts.push(...assignment.analysts);
    }

    return newAssignments;
  }

  private getWeekStart(date: Date): Date {
    const result = new Date(date);
    result.setHours(0, 0, 0, 0);
    const day = result.getDay();
    result.setDate(result.getDate() - day);
    return result;
  }

  /**
   * Calculate the initial consecutive work day streak for an analyst leading up to the start date
   * Used to enforce maxConsecutiveDays constraint with continuity from seeded schedules
   */
  private calculateInitialStreak(analystId: string, startDate: Date, existingSchedules: any[]): number {
    let streak = 0;
    const startMoment = moment.utc(startDate);

    // Check up to 5 days back
    for (let i = 1; i <= 5; i++) {
      const checkDate = startMoment.clone().subtract(i, 'days').format('YYYY-MM-DD');
      const hasSchedule = existingSchedules.some(s =>
        s.analystId === analystId &&
        moment.utc(s.date).format('YYYY-MM-DD') === checkDate
      );

      if (hasSchedule) {
        streak++;
      } else {
        break;
      }
    }

    return streak;
  }

  private generateWeekSchedules(
    weekStart: Date,
    weekEnd: Date,
    morningPatterns: any,
    eveningPatterns: any,
    existingSchedules: any[],
    globalConstraints: any[],
    overwrites: any[]
  ) {
    const result = {
      proposedSchedules: [] as any[],
      conflicts: [] as any[],
    };

    const currentDate = new Date(weekStart);
    while (currentDate <= weekEnd) {
      const dayOfWeek = currentDate.getDay();

      const blackoutConstraint = globalConstraints.find(c => new Date((c as any).startDate) <= currentDate && new Date((c as any).endDate) >= currentDate && (c as any).constraintType === 'BLACKOUT_DATE');
      if (blackoutConstraint) {
        result.conflicts.push({
          date: currentDate.toISOString().split('T')[0],
          type: 'BLACKOUT_DATE',
          description: (blackoutConstraint as any).description || 'No scheduling allowed on this date',
          severity: 'CRITICAL'
        });
        currentDate.setDate(currentDate.getDate() + 1);
        continue;
      }

      // Check if it's a holiday (treated as weekend - no screeners needed)
      const holidayConstraint = globalConstraints.find(c =>
        new Date((c as any).startDate) <= currentDate &&
        new Date((c as any).endDate) >= currentDate &&
        (c as any).constraintType === 'HOLIDAY'
      );
      const isHoliday = !!holidayConstraint;

      const processShift = (analysts: any[], shiftType: 'MORNING' | 'EVENING') => {
        analysts.forEach(analyst => {
          const schedule = this.createScheduleEntry(analyst, currentDate, shiftType, false, existingSchedules, overwrites);
          if (schedule) result.proposedSchedules.push(schedule);
        });
      };

      processShift(this.getAnalystsForDay(morningPatterns, dayOfWeek), 'MORNING');
      processShift(this.getAnalystsForDay(eveningPatterns, dayOfWeek), 'EVENING');

      currentDate.setDate(currentDate.getDate() + 1);
    }

    return result;
  }

  private getAnalystsForDay(patternAssignments: any, dayOfWeek: number) {
    const workingAnalysts: any[] = [];
    const addedAnalystIds = new Set<string>();

    for (const patternName in patternAssignments) {
      const assignment = patternAssignments[patternName];
      if (assignment.pattern.days.includes(dayOfWeek)) {
        // Avoid duplicates when an analyst works multiple patterns
        assignment.analysts.forEach((analyst: any) => {
          if (!addedAnalystIds.has(analyst.id)) {
            workingAnalysts.push(analyst);
            addedAnalystIds.add(analyst.id);
          }
        });
      }
    }
    return workingAnalysts;
  }

  private createScheduleEntry(
    analyst: any,
    date: Date,
    shiftType: string,
    isScreener: boolean,
    existingSchedules: any[],
    overwrites: any[]
  ) {
    const dateStr = date.toISOString().split('T')[0];

    const onVacation = analyst.vacations?.some((v: any) => new Date(v.startDate) <= date && new Date(v.endDate) >= date) || false;
    if (onVacation) return null;

    const existingSchedule = existingSchedules.find(s => (s as any).analystId === analyst.id && new Date((s as any).date).toISOString().split('T')[0] === dateStr);

    const scheduleData = {
      date: dateStr,
      analystId: analyst.id,
      analystName: analyst.name,
      shiftType,
      isScreener
    };

    if (existingSchedule) {
      if ((existingSchedule as any).shiftType !== shiftType || (existingSchedule as any).isScreener !== isScreener) {
        overwrites.push({
          date: dateStr,
          analystId: analyst.id,
          analystName: analyst.name,
          from: { shiftType: (existingSchedule as any).shiftType, isScreener: (existingSchedule as any).isScreener },
          to: { shiftType, isScreener }
        });
        return { ...scheduleData, type: 'OVERWRITE_SCHEDULE' };
      }
      return null;
    }

    return { ...scheduleData, type: 'NEW_SCHEDULE' };
  }

  private async generateScreenerSchedules(
    startDate: Date,
    endDate: Date,
    analysts: any[],
    existingSchedules: any[],
    globalConstraints: any[],
    regularSchedules: any[]
  ) {
    // Get rotation plans for both shifts
    const morningAnalysts = analysts.filter((a: any) => ['MORNING', 'AM'].includes(a.shiftType));
    const eveningAnalysts = analysts.filter((a: any) => ['EVENING', 'PM'].includes(a.shiftType));

    const morningRotationPlans = await rotationManager.planRotation(
      this.name,
      'AM',
      startDate,
      endDate,
      morningAnalysts,
      existingSchedules
    );

    const eveningRotationPlans = await rotationManager.planRotation(
      this.name,
      'PM',
      startDate,
      endDate,
      eveningAnalysts,
      existingSchedules
    );
    const result = {
      proposedSchedules: [] as any[],
      conflicts: [] as any[],
      overwrites: [] as any[]
    };

    // Track screener assignments for spacing
    const screenerAssignmentHistory = new Map<string, Date[]>();
    analysts.forEach(a => screenerAssignmentHistory.set(a.id, []));

    // Load recent screener assignments from existing schedules
    const lookbackDate = new Date(startDate);
    lookbackDate.setDate(lookbackDate.getDate() - 7);
    existingSchedules.forEach(schedule => {
      if (schedule.isScreener && new Date(schedule.date) >= lookbackDate && new Date(schedule.date) < startDate) {
        const history = screenerAssignmentHistory.get(schedule.analystId) || [];
        history.push(new Date(schedule.date));
        screenerAssignmentHistory.set(schedule.analystId, history);
      }
    });

    const currentDate = new Date(startDate);
    let screenerIndex = 0;

    while (currentDate <= endDate) {
      const dateStr = currentDate.toISOString().split('T')[0];
      const dayOfWeek = currentDate.getDay();

      // Check if it's weekend
      if (isWeekend(currentDate)) {
        currentDate.setDate(currentDate.getDate() + 1);
        continue;
      }

      // Check if it's a holiday (treated as weekend)
      const holidayConstraint = globalConstraints.find(c =>
        new Date((c as any).startDate) <= currentDate &&
        new Date((c as any).endDate) >= currentDate &&
        (c as any).constraintType === 'HOLIDAY'
      );
      if (holidayConstraint) {
        currentDate.setDate(currentDate.getDate() + 1);
        continue;
      }

      const blackoutConstraint = globalConstraints.find(c => new Date((c as any).startDate) <= currentDate && new Date((c as any).endDate) >= currentDate && (c as any).constraintType === 'BLACKOUT_DATE');
      if (blackoutConstraint) {
        result.conflicts.push({
          date: dateStr,
          type: 'BLACKOUT_DATE',
          description: (blackoutConstraint as any).description || 'No scheduling allowed on this date',
          severity: 'CRITICAL'
        });
        currentDate.setDate(currentDate.getDate() + 1);
        continue;
      }

      // Find working analysts from both proposed and existing schedules
      const proposedWorkingAnalysts = regularSchedules
        .filter(s => s.date === dateStr && !s.isScreener)
        .map(s => analysts.find(a => a.id === s.analystId))
        .filter(Boolean);

      const existingWorkingAnalysts = existingSchedules
        .filter(s => new Date((s as any).date).toISOString().split('T')[0] === dateStr && !(s as any).isScreener)
        .map(s => analysts.find(a => a.id === (s as any).analystId))
        .filter(Boolean);

      // Combine both lists, avoiding duplicates
      const workingAnalystIds = new Set<string>();
      const workingAnalysts: any[] = [];

      [...proposedWorkingAnalysts, ...existingWorkingAnalysts].forEach(analyst => {
        if (analyst && !workingAnalystIds.has(analyst.id)) {
          workingAnalystIds.add(analyst.id);
          workingAnalysts.push(analyst);
        }
      });

      // DYNAMIC POOL SELECTION: Use the ACTUAL scheduled shift type, not the static analyst property
      // This ensures AM analysts rotated to PM are considered for PM screening
      const morningAnalysts = workingAnalysts.filter((a: any) => {
        // Find their schedule for today
        const schedule = regularSchedules.find(s => s.date === dateStr && s.analystId === a.id) ||
          existingSchedules.find(s => (s as any).date.toISOString().split('T')[0] === dateStr && (s as any).analystId === a.id);

        if (!schedule) return ['MORNING', 'AM'].includes(a.shiftType); // Fallback
        const sType = (schedule as any).shiftType || schedule.shiftType;
        return ['MORNING', 'AM'].includes(sType);
      });

      const eveningAnalysts = workingAnalysts.filter((a: any) => {
        // Find their schedule for today
        const schedule = regularSchedules.find(s => s.date === dateStr && s.analystId === a.id) ||
          existingSchedules.find(s => (s as any).date.toISOString().split('T')[0] === dateStr && (s as any).analystId === a.id);

        if (!schedule) return ['EVENING', 'PM'].includes(a.shiftType); // Fallback
        const sType = (schedule as any).shiftType || schedule.shiftType;
        return ['EVENING', 'PM'].includes(sType);
      });

      const assignScreener = (shiftAnalysts: any[], shiftType: string) => {
        if (shiftAnalysts.length > 0) {
          const eligibleAnalysts = shiftAnalysts.filter(a => !a.vacations?.some((v: any) => new Date(v.startDate) <= currentDate && new Date(v.endDate) >= currentDate));
          if (eligibleAnalysts.length > 0) {

            // Enhanced screener assignment with spacing logic
            const analystScores = eligibleAnalysts.map(analyst => {
              const history = screenerAssignmentHistory.get(analyst.id) || [];
              let score = 0;

              // Check consecutive screener days in the past week
              const recentScreenerDays = history.filter(d => {
                const daysDiff = Math.floor((currentDate.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
                return daysDiff <= 7 && daysDiff >= 0;
              }).length;

              // Penalize if already screened 2 days this week
              if (recentScreenerDays >= 2) score -= 1000;

              // Check if screened yesterday (avoid consecutive days)
              const yesterday = new Date(currentDate);
              yesterday.setDate(yesterday.getDate() - 1);
              const screenedYesterday = history.some(d =>
                d.toISOString().split('T')[0] === yesterday.toISOString().split('T')[0]
              );
              if (screenedYesterday) score -= 500;

              // Check if analyst is in weekend rotation
              const rotationPlans = shiftType === 'MORNING' ?
                morningRotationPlans : eveningRotationPlans;

              const isInRotation = rotationPlans.some(plan =>
                plan.analystId === analyst.id &&
                plan.startDate && plan.endDate &&
                currentDate >= plan.startDate && currentDate <= plan.endDate
              );

              // Penalize analysts in weekend rotation
              if (isInRotation) {
                // Check how many screener days they already have this week
                const weekStartDate = new Date(currentDate);
                weekStartDate.setDate(weekStartDate.getDate() - weekStartDate.getDay());

                const weekScreenerDays = history.filter(d => {
                  return d >= weekStartDate && d <= currentDate;
                }).length;

                // If they already have one screener day this week, heavily penalize
                if (weekScreenerDays >= 1) {
                  score -= 2000; // Make them very unlikely to be chosen
                } else {
                  score -= 200; // Small penalty for first screener day
                }
              }

              // Prefer skilled analysts
              if (analyst.skills?.includes('screener-training')) score += 100;

              // Add some rotation fairness
              score -= history.length * 10;

              return { analyst, score };
            });

            // Sort by score (highest first)
            analystScores.sort((a, b) => b.score - a.score);
            const selectedScreener = analystScores[0].analyst;

            const screenerSchedule = this.createScreenerSchedule(selectedScreener, currentDate, shiftType, existingSchedules, result.overwrites);
            if (screenerSchedule) {
              result.proposedSchedules.push(screenerSchedule);

              // Update history
              const history = screenerAssignmentHistory.get(selectedScreener.id) || [];
              history.push(new Date(currentDate));
              screenerAssignmentHistory.set(selectedScreener.id, history);
            }
          }
        }
      };

      assignScreener(morningAnalysts, 'AM');
      assignScreener(eveningAnalysts, 'PM');

      screenerIndex++;
      currentDate.setDate(currentDate.getDate() + 1);
    }

    return result;
  }

  private createScreenerSchedule(
    analyst: any,
    date: Date,
    shiftType: string,
    existingSchedules: any[],
    overwrites: any[]
  ) {
    const dateStr = date.toISOString().split('T')[0];

    const scheduleData = {
      date: dateStr,
      analystId: analyst.id,
      analystName: analyst.name,
      shiftType,
      isScreener: true,
    };

    const existingSchedule = existingSchedules.find(s => (s as any).analystId === analyst.id && new Date((s as any).date).toISOString().split('T')[0] === dateStr);

    if (existingSchedule) {
      if (!(existingSchedule as any).isScreener) {
        overwrites.push({
          date: dateStr,
          analystId: analyst.id,
          analystName: analyst.name,
          from: { shiftType: (existingSchedule as any).shiftType, isScreener: false },
          to: { shiftType, isScreener: true }
        });
        return { ...scheduleData, type: 'OVERWRITE_SCHEDULE' };
      }
      return null;
    }

    return { ...scheduleData, type: 'NEW_SCHEDULE' };
  }

  private generateConflicts(schedules: any[], context: SchedulingContext): any[] {
    const conflicts: any[] = [];

    // Check for insufficient staff
    const dailyCoverage = new Map<string, { morning: number; evening: number }>();

    for (const schedule of schedules) {
      const date = schedule.date;
      if (!dailyCoverage.has(date)) {
        dailyCoverage.set(date, { morning: 0, evening: 0 });
      }

      const coverage = dailyCoverage.get(date)!;
      if (['MORNING', 'AM'].includes(schedule.shiftType)) {
        coverage.morning++;
      } else if (['EVENING', 'PM'].includes(schedule.shiftType)) {
        coverage.evening++;
      }
    }

    // Check for coverage issues
    for (const [date, coverage] of dailyCoverage) {
      if (coverage.morning === 0) {
        conflicts.push({
          date,
          type: 'INSUFFICIENT_STAFF',
          description: 'No morning shift coverage',
          severity: 'HIGH',
          suggestedResolution: 'Assign additional morning analyst'
        });
      }

      if (coverage.evening === 0) {
        conflicts.push({
          date,
          type: 'INSUFFICIENT_STAFF',
          description: 'No evening shift coverage',
          severity: 'HIGH',
          suggestedResolution: 'Assign additional evening analyst'
        });
      }
    }

    return conflicts;
  }

  private generateOverwrites(schedules: any[], existingSchedules: any[]): any[] {
    const overwrites: any[] = [];

    for (const schedule of schedules) {
      const existing = existingSchedules.find(s =>
        s.analystId === schedule.analystId &&
        new Date(s.date).toISOString().split('T')[0] === schedule.date
      );

      if (existing && (existing.shiftType !== schedule.shiftType || existing.isScreener !== schedule.isScreener)) {
        overwrites.push({
          date: schedule.date,
          analystId: schedule.analystId,
          analystName: schedule.analystName,
          from: { shiftType: existing.shiftType, isScreener: existing.isScreener },
          to: { shiftType: schedule.shiftType, isScreener: schedule.isScreener },
          reason: 'Algorithm optimization'
        });
      }
    }

    return overwrites;
  }
}

export default new WeekendRotationAlgorithm(); 