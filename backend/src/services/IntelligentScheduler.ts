import { PrismaClient } from '@prisma/client';
import moment from 'moment-timezone';
import HolidayService from './HolidayService';
import AbsenceService from './AbsenceService';
import { SchedulingStrategy } from './scheduling/strategies/SchedulingStrategy';
import { SchedulingContext, SchedulingResult, ProposedSchedule, DEFAULT_ALGORITHM_CONFIG } from './scheduling/algorithms/types';
import { RotationManager } from './scheduling/RotationManager';
import { fairnessCalculator } from './scheduling/FairnessCalculator';
import { constraintEngine, ConstraintEngine } from './scheduling/algorithms/ConstraintEngine';
import { fairnessEngine } from './scheduling/algorithms/FairnessEngine';
import { optimizationEngine } from './scheduling/algorithms/OptimizationEngine';
import { PatternContinuityService } from './scheduling/PatternContinuityService';
import { scoringEngine } from './scheduling/algorithms/ScoringEngine';
import { ScreenerFairnessTracker } from './scheduling/ScreenerFairnessTracker';
import { WeekendRotationAlgorithm } from './scheduling/algorithms/WeekendRotationAlgorithm';
import { isWeekend } from '../utils/dateUtils';

export interface AssignmentStrategy {
  id: string;
  name: string;
  priority: number;
  conditions: {
    workWeightThreshold?: number;
    dayOfWeek?: string[];
    analystAvailability?: boolean;
  };
  logic: 'ROUND_ROBIN' | 'EXPERIENCE_BASED' | 'WORKLOAD_BALANCE' | 'HOLIDAY_COVERAGE';
}

export interface AssignmentReason {
  primaryReason: string;
  secondaryFactors: string[];
  workWeight: number;
  computationCost: 'LOW' | 'MEDIUM' | 'HIGH';
  confidence?: number;
}

export interface ProposedAssignment {
  date: string;
  shiftType: 'MORNING' | 'EVENING' | 'WEEKEND';
  analystId: string;
  analystName: string;
  reason: AssignmentReason;
  strategy: string;
}

export interface ConflictResolution {
  priority: 'critical' | 'warning' | 'info';
  autoFixable: boolean;
  suggestedAssignments: ProposedAssignment[];
  summary: {
    totalConflicts: number;
    criticalConflicts: number;
    assignmentsNeeded: number;
    estimatedTime: string;
  };
}

export class IntelligentScheduler implements SchedulingStrategy {
  name = 'Intelligent Scheduler';
  description = 'AI-driven scheduler that balances workload, experience, and constraints.';

  private prisma: PrismaClient;
  private holidayService: HolidayService;
  private absenceService: AbsenceService;
  private shiftDefinitions: any;
  private rotationManager: RotationManager;
  private patternContinuityService: PatternContinuityService;
  private weekendRotationAlgorithm: WeekendRotationAlgorithm;
  private constraintEngine: ConstraintEngine;
  private currentContextTimezone: string = 'America/New_York'; // Default to US, updated during generation

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
    this.holidayService = new HolidayService(prisma);
    this.absenceService = new AbsenceService(prisma);

    // Initialize pattern continuity and rotation management
    this.patternContinuityService = new PatternContinuityService(prisma);
    this.rotationManager = new RotationManager(this.patternContinuityService);

    // Initialize Specialized Algorithms
    this.weekendRotationAlgorithm = new WeekendRotationAlgorithm(this.rotationManager);
    this.constraintEngine = constraintEngine; // Use the exported singleton

    // this.shiftDefinitions will be loaded dynamically per region
    // Leaving empty initialization or relying on dynamic loading
    this.shiftDefinitions = {};
  }

  /**
   * Generate a comprehensive schedule based on the provided context
   * Incorporates rotation planning, fairness optimization, and screener assignments
   */
  async generate(context: SchedulingContext): Promise<SchedulingResult> {
    const startTime = Date.now();
    console.log(`🚀 Starting Intelligent Scheduler with ${context.analysts.length} analysts`);

    // Use default config if not provided
    // Use config from context, or fall back to "Known Good" Manual Script configuration
    // (Overrides DEFAULT_ALGORITHM_CONFIG to ensure parity with run_generation.ts)
    const config = context.algorithmConfig || {
      ...DEFAULT_ALGORITHM_CONFIG,
      optimizationStrategy: 'GREEDY', // Hill Climbing caused regression in weekend balance
      fairnessWeight: 1.0,            // Increased from 0.4 to prioritize fairness
      screenerAssignmentStrategy: 'ROUND_ROBIN', // Match script
      maxIterations: 1 // Greedy doesn't iterate much
    };

    // Multi-Region Validation
    if (!context.regionId) {
      throw new Error('Multi-Region Error: SchedulingContext must include a valid regionId.');
    }
    this.currentContextTimezone = context.timezone || 'America/New_York';
    console.log(`🌍 Generating schedule for Region ID: ${context.regionId} in Timezone: ${this.currentContextTimezone}`);

    // 1. Generate initial schedules using rotation logic
    const initialSchedules = await this.generateInitialSchedules(context);

    // 2. Validate constraints
    const constraintValidation = constraintEngine.validateConstraints(
      initialSchedules,
      context.globalConstraints
    );

    // 3. Calculate initial fairness metrics
    const fairnessMetrics = fairnessEngine.calculateFairness(initialSchedules, context.analysts);

    // 4. Optimize schedules if needed
    let optimizedSchedules = initialSchedules;
    if (config.optimizationStrategy !== 'GREEDY' || fairnessMetrics.overallFairnessScore < 0.7) {
      console.log(`🔧 Optimizing schedules using ${config.optimizationStrategy} strategy`);
      optimizedSchedules = await optimizationEngine.optimizeSchedules(initialSchedules, context);
    }

    // 5. Recalculate metrics after optimization
    const finalFairnessMetrics = fairnessEngine.calculateFairness(optimizedSchedules, context.analysts);
    const finalConstraintValidation = constraintEngine.validateConstraints(
      optimizedSchedules,
      context.globalConstraints
    );

    // 6. Generate conflicts and overwrites
    const conflicts = this.generateConflicts(optimizedSchedules, context);
    const overwrites = this.generateOverwrites(optimizedSchedules, context.existingSchedules);

    // 7. Calculate performance metrics
    const executionTime = Date.now() - startTime;
    const performanceMetrics = {
      totalQueries: 0,
      averageQueryTime: 0,
      slowQueries: 0,
      cacheHitRate: 0,
      algorithmExecutionTime: executionTime,
      memoryUsage: process.memoryUsage().heapUsed / 1024 / 1024,
      optimizationIterations: 0
    };

    console.log(`✅ Intelligent Scheduler completed in ${executionTime}ms`);
    console.log(`📊 Fairness Score: ${finalFairnessMetrics.overallFairnessScore?.toFixed(4) || 'N/A'}`);
    console.log(`🔒 Constraint Score: ${finalConstraintValidation.score?.toFixed(4) || 'N/A'}`);

    return {
      proposedSchedules: optimizedSchedules,
      conflicts,
      overwrites,
      fairnessMetrics: finalFairnessMetrics,
      performanceMetrics
    };
  }

  /**
   * Generate initial schedules using rotation logic
   */
  private async generateInitialSchedules(context: SchedulingContext): Promise<ProposedSchedule[]> {
    const { startDate, endDate, analysts, existingSchedules, globalConstraints } = context;

    // Fetch Dynamic Shift Configuration for this Region
    // Assuming context.regionId is present (validated in generate())
    const regionShifts = await this.prisma.shiftDefinition.findMany({
      where: { regionId: context.regionId },
      orderBy: { startResult: 'asc' } // Earliest shifts first (e.g. AM before PM)
    });

    if (regionShifts.length === 0) {
      throw new Error(`No Shift Definitions found for Region ID: ${context.regionId}`);
    }

    console.log(`⏰ Loaded ${regionShifts.length} Dynamic Shifts for Region: ${regionShifts.map((s: { name: string }) => s.name).join(', ')}`);

    const regularSchedules = await this.generateRegularWorkSchedules(
      startDate, endDate, analysts, existingSchedules, globalConstraints, regionShifts
    );

    const screenerSchedules = await this.generateScreenerSchedules(
      startDate, endDate, analysts, existingSchedules, globalConstraints, regularSchedules.proposedSchedules
    );

    const allSchedules = [...regularSchedules.proposedSchedules];

    screenerSchedules.proposedSchedules.forEach(screenerSchedule => {
      const index = allSchedules.findIndex(
        p => p.analystId === screenerSchedule.analystId && p.date === screenerSchedule.date
      );
      if (index !== -1) {
        allSchedules[index].isScreener = true;
      } else {
        allSchedules.push(screenerSchedule);
      }
    });

    return allSchedules;
  }

  /**
   * Calculate the initial consecutive work day streak for an analyst leading up to the start date
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

  /**
   * Generate regular work schedules using dynamic shifts.
   * Supports both Unified Pools (with Rotation) and Strict Shifts (No Rotation).
   */
  /**
   * Generate regular work schedules using dynamic shifts.
   * Supports both Unified Pools (with Rotation) and Strict Shifts (No Rotation).
   * REFACTORED: Now orchestrates specialized services (Constraint, Holiday, Weekend)
   */
  private async generateRegularWorkSchedules(
    startDate: Date,
    endDate: Date,
    analysts: any[],
    existingSchedules: any[],
    globalConstraints: any[],
    shiftDefinitions: any[] // Passed from generateInitialSchedules
  ): Promise<{ proposedSchedules: any[]; conflicts: any[]; overwrites: any[] }> {
    const result = { proposedSchedules: [] as any[], conflicts: [] as any[], overwrites: [] as any[] };

    // Categorize Analysts by Compatible Shift
    const analystsByShift = new Map<string, any[]>();
    for (const def of shiftDefinitions) {
      const matchingAnalysts = analysts.filter(a =>
        a.shiftType === def.name ||
        (def.name === 'AM' && a.shiftType === 'MORNING') ||
        (def.name === 'PM' && a.shiftType === 'EVENING')
      );
      analystsByShift.set(def.name, matchingAnalysts);
    }

    const isMultiShift = shiftDefinitions.length > 1;

    // Plan Rotation (Only if Multi-Shift or for Pattern Tracking)
    // CRITICAL: We need rotation plans to enforce Pattern Continuity (WKD-8)
    const rotationPlans = await this.rotationManager.planRotation(
      this.name, 'WEEKEND_ROTATION', startDate, endDate, analysts, existingSchedules
    );

    // Plan AM to PM Rotations (Only if Multi-Shift)
    let amToPmRotationMap = new Map<string, string[]>();
    if (isMultiShift) {
      const earliestShift = shiftDefinitions[0];
      const latestShift = shiftDefinitions[shiftDefinitions.length - 1];
      const sourceAnalysts = analystsByShift.get(earliestShift.name) || [];
      const targetAnalysts = analystsByShift.get(latestShift.name) || [];

      if (sourceAnalysts.length > 0) {
        amToPmRotationMap = await this.rotationManager.planAMToPMRotation(
          startDate, endDate, sourceAnalysts, targetAnalysts.length, existingSchedules, this.absenceService, rotationPlans
        );
      }
    }

    // Weekend analyst limit & streaks state
    const weekendAnalystsPerShift = 1;
    const maxConsecutiveDays = 5;
    const analystStreaks = new Map<string, number>();
    for (const analyst of analysts) {
      analystStreaks.set(analyst.id, this.calculateInitialStreak(analyst.id, startDate, existingSchedules));
    }

    // Track weekend schedules specifically for WKD-3/WKD-8 history context
    // We seed this with existing schedules (historical) + push new ones as we generate
    const simulatedWeekendSchedules = [...existingSchedules];

    // HOLISTIC FIX: Enforce timezone context (e.g. America/New_York) to prevent UTC/Local shifting
    const currentMoment = moment.tz(startDate, this.currentContextTimezone).startOf('day');
    const endMoment = moment.tz(endDate, this.currentContextTimezone).endOf('day');

    while (currentMoment.isSameOrBefore(endMoment, 'day')) {
      const dateStr = currentMoment.format('YYYY-MM-DD');

      // HOLISTIC FIX: Force currentDate to be UTC Midnight of the loop string.
      // This ensures 100% alignment between "Working Date" and "Logic Date",
      // ignoring any timezone drift (e.g. 19:00 offsets) in currentMoment.
      const currentDate = moment.utc(dateStr).toDate();

      // Check Weekend using strict UTC day index
      const dayIndex = moment.utc(currentDate).day();
      const isWeekendDay = (dayIndex === 0 || dayIndex === 6);

      if (dateStr === '2026-02-01') {
        console.log(`🚨 [CRITICAL DEBUG] ${dateStr}: dayIndex=${dayIndex}, isWeekendDay=${isWeekendDay}`);
      }

      // 1. DELEGATION: Check Constraints (Blackouts)
      if (this.constraintEngine.isDateBlocked(currentDate, globalConstraints)) {
        console.log(`🚫 [DEBUG] ${dateStr} BLOCKED by constraint. Skipping.`);
        currentMoment.add(1, 'day');
        continue;
      }

      // 2. DELEGATION: Check Holidays
      if (await this.holidayService.isHoliday(dateStr)) {
        //   console.log(`🎉 [DEBUG] ${dateStr} is HOLIDAY. Skipping regular work.`);
        //   currentMoment.add(1, 'day');
        //   continue;
      }

      // 3. DELEGATION: Weekend Logic (The "Hippocampus" Call)
      if (isWeekendDay) {
        // Gather all available analysts (Unified Pool)
        const pool = [...analysts]; // Pass everyone, let algorithm sort it out

        const weekendAssignments = await this.weekendRotationAlgorithm.processWeekendDay(
          currentDate,
          pool,
          simulatedWeekendSchedules, // History Context
          rotationPlans,             // Pattern Truth Context
          analystStreaks             // Fatigue Context
        );

        if (weekendAssignments.length > 0) {
          result.proposedSchedules.push(...weekendAssignments);

          // Update State: Local History & Streaks
          for (const assign of weekendAssignments) {
            simulatedWeekendSchedules.push({
              analystId: assign.analystId,
              date: currentDate, // Store as Date object for consistency
              shiftType: assign.shiftType
            });
            // Note: streaks updated at end of loop shared with weekdays?
            // Let's rely on the shared end-of-loop streak updater.
          }
        }

      } else {
        // 4. WEEKDAY Processing (Existing Logic - Pending Extraction)
        if (dateStr === '2026-02-01') console.log(`🛑 [CRITICAL DEBUG] Entering WEEKDAY Block for ${dateStr}`);
        // Iterate OVER DEFINED SHIFTS
        for (const shiftDef of shiftDefinitions) {
          const shiftName = shiftDef.name;
          const pool = analystsByShift.get(shiftName) || [];
          const isEarliestShift = (shiftDef.id === shiftDefinitions[0].id);

          for (const analyst of pool) {
            const shouldWork = this.rotationManager.shouldAnalystWork(analyst.id, currentDate, rotationPlans);
            const isAbsent = await this.absenceService.isAnalystAbsent(analyst.id, dateStr);
            const streak = analystStreaks.get(analyst.id) || 0;

            if (shouldWork && !isAbsent && streak < maxConsecutiveDays) {
              let assignedShift = shiftName;
              let assignmentType = 'NEW_SCHEDULE';

              // AM->PM Rotation
              if (isMultiShift && isEarliestShift) {
                const rotatedIds = amToPmRotationMap.get(dateStr) || [];
                if (rotatedIds.includes(analyst.id)) {
                  assignedShift = shiftDefinitions[shiftDefinitions.length - 1].name;
                  assignmentType = 'AM_TO_PM_ROTATION';
                }
              }

              result.proposedSchedules.push({
                date: dateStr, analystId: analyst.id, analystName: analyst.name,
                shiftType: assignedShift, isScreener: false, type: assignmentType
              });
            }
          }
        }
      }

      // Update streaks for everyone based on assignments made today (Weekend OR Weekday)
      // HOLISTIC FIX: Handle both Date objects (Weekend) and Strings (Weekday)
      const targetDateStr = dateStr; // YYYY-MM-DD
      const workedTodayIds = new Set(
        result.proposedSchedules
          .filter(s => {
            const sDateStr = moment.utc(s.date).format('YYYY-MM-DD');
            return sDateStr === targetDateStr;
          })
          .map(s => s.analystId)
      );

      for (const analyst of analysts) {
        if (workedTodayIds.has(analyst.id)) {
          analystStreaks.set(analyst.id, (analystStreaks.get(analyst.id) || 0) + 1);
        } else {
          analystStreaks.set(analyst.id, 0);
        }
      }

      currentMoment.add(1, 'day');
    }

    return result;
  }

  /**
   * Generate screener assignments
   * HOLISTIC FIX: Uses unified ScreenerFairnessTracker (per-analyst, not per-shift)
   * PHASE 1 UPDATE: Now works with dynamic shift types, not just MORNING/EVENING
   */
  private async generateScreenerSchedules(
    startDate: Date, endDate: Date, analysts: any[], existingSchedules: any[],
    globalConstraints: any[], baseSchedules: any[]
  ): Promise<{ proposedSchedules: any[]; conflicts: any[]; overwrites: any[] }> {
    const result = { proposedSchedules: [] as any[], conflicts: [] as any[], overwrites: [] as any[] };

    // HOLISTIC FIX: Use unified tracker instead of naive counters
    const screenerTracker = new ScreenerFairnessTracker();
    screenerTracker.initializeFromHistory(existingSchedules);

    // CRITICAL FIX: Also load weekend screener assignments from the current run (baseSchedules)
    // This prevents "Invisible Debt" where weekend workers are treated as fresh for weekday screening
    // UPDATED: Count ALL weekend shifts as "screener debt" because weekend work is burdensome
    screenerTracker.initializeFromHistory(baseSchedules.filter(s => {
      const date = new Date(s.date);
      const isWeekend = date.getDay() === 0 || date.getDay() === 6;
      return s.isScreener || isWeekend;
    }));

    // HOLISTIC FIX: Enforce timezone context to prevent "Jan 31" off-by-one errors
    const currentMoment = moment.tz(startDate, this.currentContextTimezone).startOf('day');
    const endMoment = moment.tz(endDate, this.currentContextTimezone).endOf('day');

    while (currentMoment.isSameOrBefore(endMoment, 'day')) {
      const dateStr = currentMoment.format('YYYY-MM-DD');
      const currentDate = currentMoment.toDate();
      const daySchedules = baseSchedules.filter(s => s.date === dateStr);

      // PHASE 1 UPDATE: Group by shiftType dynamically instead of hardcoded MORNING/EVENING
      const schedulesByShift = new Map<string, any[]>();
      for (const schedule of daySchedules) {
        const shiftType = schedule.shiftType;
        if (!schedulesByShift.has(shiftType)) {
          schedulesByShift.set(shiftType, []);
        }
        schedulesByShift.get(shiftType)!.push(schedule);
      }

      // For each shift type, assign one screener
      for (const [shiftType, shiftSchedules] of schedulesByShift) {
        if (shiftSchedules.length > 0) {
          const available = [];
          for (const schedule of shiftSchedules) {
            const isAbsent = await this.absenceService.isAnalystAbsent(schedule.analystId, dateStr);
            if (!isAbsent) {
              available.push({ id: schedule.analystId, name: schedule.analystName, ...schedule });
            }
          }

          if (available.length > 0) {
            // Use unified fairness tracker
            const selectedAnalyst = screenerTracker.selectScreener(available, currentDate);
            if (selectedAnalyst) {
              const selectedSchedule = available.find(s => s.id === selectedAnalyst.id);
              if (selectedSchedule) {
                result.proposedSchedules.push({ ...selectedSchedule, isScreener: true });
                screenerTracker.recordScreenerAssignment(selectedAnalyst.id, currentDate);
              }
            }
          }
        }
      }

      currentMoment.add(1, 'day');
    }

    return result;
  }


  /**
   * Detect conflicts in proposed schedules
   * PHASE 1 UPDATE: Now works with dynamic shift types
   */
  private generateConflicts(schedules: any[], context: SchedulingContext): any[] {
    const conflicts: any[] = [];
    // PHASE 1 UPDATE: Track coverage per shift type dynamically
    const dailyCoverage = new Map<string, Map<string, number>>();

    for (const schedule of schedules) {
      const date = schedule.date;
      if (!dailyCoverage.has(date)) {
        dailyCoverage.set(date, new Map<string, number>());
      }
      const dateCoverage = dailyCoverage.get(date)!;
      const shiftType = schedule.shiftType;
      dateCoverage.set(shiftType, (dateCoverage.get(shiftType) || 0) + 1);
    }

    // Collect all unique shift types from schedules
    const allShiftTypes = new Set<string>();
    for (const schedule of schedules) {
      allShiftTypes.add(schedule.shiftType);
    }

    // Check each date has at least one analyst per shift type
    for (const [date, shiftCoverage] of dailyCoverage) {
      for (const shiftType of allShiftTypes) {
        if ((shiftCoverage.get(shiftType) || 0) === 0) {
          conflicts.push({
            date,
            type: 'INSUFFICIENT_STAFF',
            description: `No ${shiftType} shift coverage`,
            severity: 'HIGH',
            suggestedResolution: `Assign additional ${shiftType} analyst`
          });
        }
      }
    }

    return conflicts;
  }


  /**
   * Detect overwrites where proposed schedules differ from existing
   */
  private generateOverwrites(schedules: any[], existingSchedules: any[]): any[] {
    const overwrites: any[] = [];

    for (const schedule of schedules) {
      const existing = existingSchedules.find(s =>
        s.analystId === schedule.analystId &&
        moment.utc(s.date).format('YYYY-MM-DD') === schedule.date
      );

      if (existing && (existing.shiftType !== schedule.shiftType || existing.isScreener !== schedule.isScreener)) {
        overwrites.push({
          date: schedule.date, analystId: schedule.analystId, analystName: schedule.analystName,
          from: { shiftType: existing.shiftType, isScreener: existing.isScreener },
          to: { shiftType: schedule.shiftType, isScreener: schedule.isScreener },
          reason: 'Algorithm optimization'
        });
      }
    }

    return overwrites;
  }

  /**
   * Main method to resolve conflicts intelligently
   */
  async resolveConflicts(
    conflicts: Array<{ date: string; missingShifts: string[]; severity: string }>,
    startDate: string,
    endDate: string,
    regionId?: string
  ): Promise<ConflictResolution> {
    const startTime = Date.now();

    // Get all available analysts
    const whereClause: any = { isActive: true };
    if (regionId) {
      whereClause.regionId = regionId;
    }

    const analysts = await this.prisma.analyst.findMany({
      where: whereClause,
      include: {
        schedules: {
          where: {
            date: {
              gte: moment.utc(startDate).toDate(),
              lte: moment.utc(endDate).toDate()
            }
          }
        }
      }
    });

    console.log(`👥 Found ${analysts.length} active analysts for conflict resolution`);
    console.log('📅 Date range:', startDate, 'to', endDate);

    const proposedAssignments: ProposedAssignment[] = [];
    let criticalConflicts = 0;

    for (const conflict of conflicts) {
      if (conflict.severity === 'critical') {
        criticalConflicts++;
      }

      for (const shiftType of conflict.missingShifts) {
        console.log(`🔧 Attempting to assign ${shiftType} shift for ${conflict.date}`);
        const assignment = await this.assignAnalyst(
          conflict.date,
          shiftType as 'MORNING' | 'EVENING' | 'WEEKEND',
          analysts,
          startDate,
          endDate
        );

        if (assignment) {
          console.log(`✅ Successfully assigned analyst ${assignment.analystId} for ${shiftType} on ${conflict.date}`);
          proposedAssignments.push(assignment);
        } else {
          console.log(`❌ No suitable analyst found for ${shiftType} shift on ${conflict.date}`);
        }
      }
    }

    const endTime = Date.now();
    const computationTime = endTime - startTime;

    return {
      priority: criticalConflicts > 0 ? 'critical' : 'warning',
      autoFixable: true,
      suggestedAssignments: proposedAssignments,
      summary: {
        totalConflicts: conflicts.length,
        criticalConflicts,
        assignmentsNeeded: proposedAssignments.length,
        estimatedTime: `${computationTime}ms`
      }
    };
  }

  /**
   * Core assignment logic with strategy selection
   */
  /**
   * Core assignment logic with strategy selection
   */
  private async assignAnalyst(
    date: string,
    shiftType: 'MORNING' | 'EVENING' | 'WEEKEND',
    analysts: any[],
    startDate: string,
    endDate: string
  ): Promise<ProposedAssignment | null> {
    const strategy = await this.getAssignmentStrategy(date, shiftType);
    const availableAnalysts = await this.getAvailableAnalysts(date, shiftType);

    console.log(`🔍 Assignment strategy for ${date} ${shiftType}:`, strategy.logic);
    console.log(`👥 Available analysts: ${availableAnalysts.length}/${analysts.length}`);

    if (availableAnalysts.length === 0) {
      console.log(`❌ No available analysts for ${shiftType} on ${date}`);
      return null;
    }

    // Fetch history for scoring
    // We need history to calculate fatigue, consecutive days, etc.
    // Ideally we should fetch this once at the top level, but for now we'll fetch it here or assume it's available.
    // The 'analysts' array passed here includes 'schedules' which is the history within the window.
    // We might need more history (past schedules) for accurate consecutive day calculation.
    // For this implementation, we'll use what we have in 'analysts' (which includes schedules in the window).
    // To be more robust, we should ensure 'analysts' includes past schedules too.

    // Let's assume analysts have their schedules loaded.
    // We need to flatten all schedules to pass to ScoringEngine
    const history = analysts.flatMap(a => a.schedules.map((s: any) => ({
      analystId: a.id,
      date: moment.utc(s.date).format('YYYY-MM-DD'),
      shiftType: s.shiftType
    })));

    // Use ScoringEngine to rank analysts
    const scoredCandidates = scoringEngine.calculateScores(availableAnalysts, date, shiftType, history);

    // Sort by score (descending)
    scoredCandidates.sort((a, b) => b.score - a.score);

    const bestCandidate = scoredCandidates[0];

    if (!bestCandidate) return null;

    const selectedAnalyst = availableAnalysts.find(a => a.id === bestCandidate.analystId);

    const shiftDef = this.shiftDefinitions[shiftType];
    const shiftDate = moment.tz(date, shiftDef.tz).hour(shiftDef.startHour).minute(0).second(0).utc().format();

    return {
      date: shiftDate,
      shiftType,
      analystId: selectedAnalyst.id,
      analystName: selectedAnalyst.name,
      reason: {
        primaryReason: `Smart Auto-Fix (Score: ${bestCandidate.score})`,
        secondaryFactors: bestCandidate.reasoning,
        workWeight: bestCandidate.score,
        computationCost: 'MEDIUM',
        confidence: bestCandidate.score / 100 // Normalize to 0-1
      },
      strategy: 'SMART_SCORING'
    };
  }

  /**
   * Determine which assignment strategy to use
   */
  private async getAssignmentStrategy(date: string, shiftType: 'MORNING' | 'EVENING' | 'WEEKEND'): Promise<AssignmentStrategy> {
    const dayOfWeek = moment(date).day();
    const isHoliday = await this.isHoliday(date, this.currentContextTimezone);
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

    if (isHoliday) {
      return {
        id: 'holiday-coverage',
        name: 'Holiday Coverage',
        priority: 1,
        conditions: { workWeightThreshold: 2.0 },
        logic: 'HOLIDAY_COVERAGE'
      };
    }

    if (isWeekend) {
      return {
        id: 'weekend-coverage',
        name: 'Weekend Coverage',
        priority: 2,
        conditions: { workWeightThreshold: 1.5 },
        logic: 'EXPERIENCE_BASED'
      };
    }

    return {
      id: 'round-robin',
      name: 'Round Robin',
      priority: 3,
      conditions: {},
      logic: 'ROUND_ROBIN'
    };
  }



  /**
   * Round-robin assignment strategy
   */
  private assignRoundRobin(date: string, shiftType: 'MORNING' | 'EVENING' | 'WEEKEND', analysts: any[]): any {
    // Simple round-robin: select the first available analyst
    return analysts[0];
  }

  /**
   * Holiday coverage assignment strategy
   */
  private assignHolidayCoverage(date: string, shiftType: 'MORNING' | 'EVENING' | 'WEEKEND', analysts: any[]): any {
    // For holidays, prefer analysts with more experience (created earlier)
    return analysts.sort((a: any, b: any) =>
      moment.utc(a.createdAt).valueOf() - moment.utc(b.createdAt).valueOf()
    )[0];
  }

  /**
   * Workload balance assignment strategy
   */
  private assignWorkloadBalance(
    date: string,
    shiftType: 'MORNING' | 'EVENING' | 'WEEKEND',
    analysts: any[],
    startDate: string,
    endDate: string
  ): any {
    // For now, use round-robin as fallback
    // TODO: Implement actual workload calculation
    return analysts[0];
  }

  /**
   * Experience-based assignment strategy
   */
  private assignExperienceBased(date: string, shiftType: 'MORNING' | 'EVENING' | 'WEEKEND', analysts: any[]): any {
    // Prefer analysts with more experience (created earlier)
    return analysts.sort((a: any, b: any) =>
      moment.utc(a.createdAt).valueOf() - moment.utc(b.createdAt).valueOf()
    )[0];
  }

  /**
   * Check if a date is a holiday
   */
  private async isHoliday(date: string, timezone: string = 'America/New_York'): Promise<boolean> {
    return await this.holidayService.isHoliday(date, timezone);
  }

  /**
   * Check if an analyst is absent on a specific date
   */
  private async isAnalystAbsent(analystId: string, date: string): Promise<boolean> {
    return await this.absenceService.isAnalystAbsent(analystId, date);
  }

  /**
   * Get available analysts for a specific date (excluding absent ones)
   */
  private async getAvailableAnalysts(date: string, shiftType: 'MORNING' | 'EVENING' | 'WEEKEND'): Promise<any[]> {
    // Get all active analysts for the shift type
    const allAnalysts = await this.prisma.analyst.findMany({
      where: {
        isActive: true,
        shiftType: shiftType
      }
    });

    // Filter out absent analysts
    const availableAnalysts = [];
    for (const analyst of allAnalysts) {
      const isAbsent = await this.isAnalystAbsent(analyst.id, date);
      if (!isAbsent) {
        availableAnalysts.push(analyst);
      }
    }

    return availableAnalysts;
  }

  /**
   * Legacy method for backward compatibility - filters analysts by availability
   */
  private filterAvailableAnalysts(date: string, shiftType: 'MORNING' | 'EVENING' | 'WEEKEND', analysts: any[]): any[] {
    // This method is kept for backward compatibility but should be replaced
    // with the async getAvailableAnalysts method
    return analysts.filter(analyst => analyst.isActive && analyst.shiftType === shiftType);
  }
}