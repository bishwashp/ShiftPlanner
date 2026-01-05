import { PrismaClient } from '@prisma/client';
import moment from 'moment-timezone';
import HolidayService from './HolidayService';
import AbsenceService from './AbsenceService';
import { SchedulingStrategy } from './scheduling/strategies/SchedulingStrategy';
import { SchedulingContext, SchedulingResult, ProposedSchedule } from './scheduling/algorithms/types';
import { RotationManager } from './scheduling/RotationManager';
import { fairnessCalculator } from './scheduling/FairnessCalculator';
import { constraintEngine } from './scheduling/algorithms/ConstraintEngine';
import { fairnessEngine } from './scheduling/algorithms/FairnessEngine';
import { optimizationEngine } from './scheduling/algorithms/OptimizationEngine';
import { PatternContinuityService } from './scheduling/PatternContinuityService';
import { scoringEngine } from './scheduling/algorithms/ScoringEngine';
import { ScreenerFairnessTracker } from './scheduling/ScreenerFairnessTracker';

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

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
    this.holidayService = new HolidayService(prisma);
    this.absenceService = new AbsenceService(prisma);

    // Initialize pattern continuity and rotation management
    this.patternContinuityService = new PatternContinuityService(prisma);
    this.rotationManager = new RotationManager(this.patternContinuityService);

    this.shiftDefinitions = {
      MORNING: { startHour: 9, endHour: 18, tz: 'America/Chicago' },
      EVENING: { startHour: 9, endHour: 18, tz: 'America/Los_Angeles' },
      WEEKEND: { startHour: 9, endHour: 18, tz: 'America/Los_Angeles' },
    };
  }

  /**
   * Generate a comprehensive schedule based on the provided context
   * Incorporates rotation planning, fairness optimization, and screener assignments
   */
  async generate(context: SchedulingContext): Promise<SchedulingResult> {
    const startTime = Date.now();
    console.log(`🚀 Starting Intelligent Scheduler with ${context.analysts.length} analysts`);

    // Use default config if not provided
    const config = context.algorithmConfig || {
      optimizationStrategy: 'GREEDY',
      maxIterations: 100,
      fairnessWeight: 0.5,
      constraintWeight: 0.5
    };

    // Multi-Region Validation
    if (!context.regionId) {
      throw new Error('Multi-Region Error: SchedulingContext must include a valid regionId.');
    }
    console.log(`🌍 Generating schedule for Region ID: ${context.regionId}`);

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
    // Currently, we map analyst.shiftType (String) to shiftDefinition.name (String)
    // NOTE: If data is not migrated (e.g. "MORNING" vs "AM"), this will map to null.
    // Ideally, we run a migration script to align data. For now, we assume strings match or we handle fallback?
    // User requested strict "no rotation" for single-shift regions.

    const analystsByShift = new Map<string, any[]>();
    for (const def of shiftDefinitions) {
      // Simple case-insensitive match or exact match
      const matchingAnalysts = analysts.filter(a =>
        a.shiftType === def.name ||
        (def.name === 'AM' && a.shiftType === 'MORNING') || // Fallback compatibility
        (def.name === 'PM' && a.shiftType === 'EVENING')     // Fallback compatibility
      );
      analystsByShift.set(def.name, matchingAnalysts);
    }

    // Check if Rotation is Required (More than 1 shift defined)
    // If only 1 shift (e.g. LDN "DAY"), we skip rotation logic entirely.
    const isMultiShift = shiftDefinitions.length > 1;

    // Plan Rotation (Only if Multi-Shift)
    // If Single Shift, rotationPlans is effectively "MON_FRI" for everyone (handled by RotationManager defaults or we skip it)
    // RotationManager also handles Weekend Pipelining (Sun-Thu -> Tue-Sat). This is valid even for single shift regions?
    // YES: Weekend rotation is independent of AM/PM rotation. All regions need Weekend fairness.
    const rotationPlans = await this.rotationManager.planRotation(
      this.name, 'WEEKEND_ROTATION', startDate, endDate, analysts, existingSchedules
    );

    // Plan AM to PM Rotations (Only if Multi-Shift)
    let amToPmRotationMap = new Map<string, string[]>();
    if (isMultiShift) {
      // Assume first shift is "Source" (AM) and last shift is "Target" (PM) for rotation
      // Or strictly look for "AM" and "PM" / "MORNING" and "EVENING"
      // For general safety, we only rotate if we explicitly identify "AM" and "PM" logic, 
      // OR we just say "Earliest shift rotates to Latest shift".
      // Current Logic: strictly rotates 'MORNING' (aka AM) analysts to 'EVENING' (aka PM).

      // Find "Morning" equivalent (first shift)
      const earliestShift = shiftDefinitions[0];

      // Find analysts currently assigned to this earliest shift
      const sourceAnalysts = analystsByShift.get(earliestShift.name) || [];

      if (sourceAnalysts.length > 0) {
        amToPmRotationMap = await this.rotationManager.planAMToPMRotation(
          startDate,
          endDate,
          sourceAnalysts,
          existingSchedules,
          this.absenceService
        );
      }
    }

    // Weekend analyst limit
    const weekendAnalystsPerShift = 1;
    const maxConsecutiveDays = 5;

    // Track streaks
    const analystStreaks = new Map<string, number>();
    for (const analyst of analysts) {
      analystStreaks.set(analyst.id, this.calculateInitialStreak(analyst.id, startDate, existingSchedules));
    }

    const currentMoment = moment.utc(startDate);
    const endMoment = moment.utc(endDate);

    while (currentMoment.isSameOrBefore(endMoment, 'day')) {
      const dateStr = currentMoment.format('YYYY-MM-DD');
      const currentDate = currentMoment.toDate();
      const dayOfWeek = currentMoment.day();
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

      // Check Blackouts
      const blackoutConstraint = globalConstraints.find(c =>
        moment((c as any).startDate).isSameOrBefore(currentMoment, 'day') &&
        moment((c as any).endDate).isSameOrAfter(currentMoment, 'day') &&
        (c as any).constraintType === 'BLACKOUT_DATE'
      );

      if (blackoutConstraint) {
        // ... (existing logging)
        currentMoment.add(1, 'day');
        continue;
      }

      // ITERATE OVER DEFINED SHIFTS (Dynamic)
      for (const shiftDef of shiftDefinitions) {
        const shiftName = shiftDef.name; // "AM", "PM", "DAY"
        const pool = analystsByShift.get(shiftName) || []; // Base pool for this shift

        // Determining Candidates
        if (isWeekend) {
          // FOR WEEKEND: Simple Coverage using Fairness
          // We select N analysts from the pool for this specific shift
          const available = [];
          for (const analyst of pool) {
            const shouldWork = this.rotationManager.shouldAnalystWork(analyst.id, currentDate, rotationPlans);
            const isAbsent = await this.absenceService.isAnalystAbsent(analyst.id, dateStr);
            const streak = analystStreaks.get(analyst.id) || 0;

            if (shouldWork && !isAbsent && streak < maxConsecutiveDays) {
              available.push(analyst);
            }
          }

          // Select Top N
          // Note: weekendAnalystsPerShift might need to be dynamic per shift definition later?
          // For now, assume 1 per shift type.
          const selected = available.slice(0, weekendAnalystsPerShift);
          for (const analyst of selected) {
            result.proposedSchedules.push({
              date: dateStr, analystId: analyst.id, analystName: analyst.name,
              shiftType: shiftName, isScreener: false, type: 'WEEKEND_COVERAGE'
            });
          }

        } else {
          // FOR WEEKDAY
          // Check rotation logic if Multi-Shift

          // If we are iterating only the "PM/Later" shift, we need to see who rotated INTO it
          // If we are iterating the "AM/Earlier" shift, we need to see who rotated OUT of it

          // But simpler: Just iterate the POOL.
          // If an analyst is in "AM" pool, but is in rotationMap for today -> Assign "PM" (Or "Later" shift)
          // If an analyst is in "PM" pool -> Assign "PM" 

          // Wait, shiftDefinitions loop handles "Creating Slots". 
          // But here we are iterating "Who works".
          // The logic structure used to be: Iterate Morning Pool -> Assign. Iterate Evening Pool -> Assign.

          const isEarliestShift = (shiftDef.id === shiftDefinitions[0].id);
          const isTargetRotationShift = (shiftDef.id === shiftDefinitions[shiftDefinitions.length - 1].id) && isMultiShift;
          // Assuming rotation target is always the LAST shift defined.

          // Iterate THIS shift's pool
          for (const analyst of pool) {
            const shouldWork = this.rotationManager.shouldAnalystWork(analyst.id, currentDate, rotationPlans);
            const isAbsent = await this.absenceService.isAnalystAbsent(analyst.id, dateStr);
            const streak = analystStreaks.get(analyst.id) || 0;

            if (shouldWork && !isAbsent && streak < maxConsecutiveDays) {

              let assignedShift = shiftName;
              let assignmentType = 'NEW_SCHEDULE';

              // ROTATION LOGIC (AM -> PM)
              // Only applies if Multi-Shift AND this is the Earliest Shift Pool
              if (isMultiShift && isEarliestShift) {
                const rotatedIds = amToPmRotationMap.get(dateStr) || [];
                if (rotatedIds.includes(analyst.id)) {
                  // Analyst rotates TO the target shift/later shift
                  // We need to know the Name of that target shift. 
                  // Assuming last one.
                  assignedShift = shiftDefinitions[shiftDefinitions.length - 1].name;
                  assignmentType = 'AM_TO_PM_ROTATION';

                  // Optimization: prevent duplicate assignments if we iterate the second shift loop later?
                  // But this analyst belongs to "AM" pool. They won't appear in "PM" pool loop.
                  // So it's safe.
                }
              }

              result.proposedSchedules.push({
                date: dateStr, analystId: analyst.id, analystName: analyst.name,
                shiftType: assignedShift, isScreener: false, type: assignmentType
              });
            }
          }
        }
      } // End Shift Def Loop

      // Updates streaks...
      const workedTodayIds = new Set(
        result.proposedSchedules
          .filter(s => s.date === dateStr)
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
   */
  private async generateScreenerSchedules(
    startDate: Date, endDate: Date, analysts: any[], existingSchedules: any[],
    globalConstraints: any[], baseSchedules: any[]
  ): Promise<{ proposedSchedules: any[]; conflicts: any[]; overwrites: any[] }> {
    const result = { proposedSchedules: [] as any[], conflicts: [] as any[], overwrites: [] as any[] };

    // HOLISTIC FIX: Use unified tracker instead of naive counters
    const screenerTracker = new ScreenerFairnessTracker();
    screenerTracker.initializeFromHistory(existingSchedules);

    const currentMoment = moment(startDate);
    const endMoment = moment(endDate);

    while (currentMoment.isSameOrBefore(endMoment, 'day')) {
      const dateStr = currentMoment.format('YYYY-MM-DD');
      const currentDate = currentMoment.toDate();
      const daySchedules = baseSchedules.filter(s => s.date === dateStr);
      const morningSchedules = daySchedules.filter(s => s.shiftType === 'MORNING');
      const eveningSchedules = daySchedules.filter(s => s.shiftType === 'EVENING');

      // MORNING SCREENER
      if (morningSchedules.length > 0) {
        const availableMorning = [];
        for (const schedule of morningSchedules) {
          const isAbsent = await this.absenceService.isAnalystAbsent(schedule.analystId, dateStr);
          if (!isAbsent) {
            // Build analyst object for tracker
            availableMorning.push({ id: schedule.analystId, name: schedule.analystName, ...schedule });
          }
        }

        if (availableMorning.length > 0) {
          // Use unified fairness tracker
          const selectedAnalyst = screenerTracker.selectScreener(availableMorning, currentDate);
          if (selectedAnalyst) {
            const selectedSchedule = availableMorning.find(s => s.id === selectedAnalyst.id);
            if (selectedSchedule) {
              result.proposedSchedules.push({ ...selectedSchedule, isScreener: true });
              screenerTracker.recordScreenerAssignment(selectedAnalyst.id, currentDate);
            }
          }
        }
      }

      // EVENING SCREENER
      if (eveningSchedules.length > 0) {
        const availableEvening = [];
        for (const schedule of eveningSchedules) {
          const isAbsent = await this.absenceService.isAnalystAbsent(schedule.analystId, dateStr);
          if (!isAbsent) {
            availableEvening.push({ id: schedule.analystId, name: schedule.analystName, ...schedule });
          }
        }

        if (availableEvening.length > 0) {
          // Use unified fairness tracker
          const selectedAnalyst = screenerTracker.selectScreener(availableEvening, currentDate);
          if (selectedAnalyst) {
            const selectedSchedule = availableEvening.find(s => s.id === selectedAnalyst.id);
            if (selectedSchedule) {
              result.proposedSchedules.push({ ...selectedSchedule, isScreener: true });
              screenerTracker.recordScreenerAssignment(selectedAnalyst.id, currentDate);
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
   */
  private generateConflicts(schedules: any[], context: SchedulingContext): any[] {
    const conflicts: any[] = [];
    const dailyCoverage = new Map<string, { morning: number; evening: number }>();

    for (const schedule of schedules) {
      const date = schedule.date;
      if (!dailyCoverage.has(date)) {
        dailyCoverage.set(date, { morning: 0, evening: 0 });
      }
      const coverage = dailyCoverage.get(date)!;
      if (schedule.shiftType === 'MORNING') coverage.morning++;
      else if (schedule.shiftType === 'EVENING') coverage.evening++;
    }

    for (const [date, coverage] of dailyCoverage) {
      if (coverage.morning === 0) {
        conflicts.push({
          date, type: 'INSUFFICIENT_STAFF', description: 'No morning shift coverage',
          severity: 'HIGH', suggestedResolution: 'Assign additional morning analyst'
        });
      }
      if (coverage.evening === 0) {
        conflicts.push({
          date, type: 'INSUFFICIENT_STAFF', description: 'No evening shift coverage',
          severity: 'HIGH', suggestedResolution: 'Assign additional evening analyst'
        });
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
    endDate: string
  ): Promise<ConflictResolution> {
    const startTime = Date.now();

    // Get all available analysts
    const analysts = await this.prisma.analyst.findMany({
      where: { isActive: true },
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
    const isHoliday = await this.isHoliday(date);
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