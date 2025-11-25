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

    const regularSchedules = await this.generateRegularWorkSchedules(
      startDate, endDate, analysts, existingSchedules, globalConstraints
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
   * Generate regular work schedules using rotation manager
   */
  private async generateRegularWorkSchedules(
    startDate: Date,
    endDate: Date,
    analysts: any[],
    existingSchedules: any[],
    globalConstraints: any[]
  ): Promise<{ proposedSchedules: any[]; conflicts: any[]; overwrites: any[] }> {
    const result = { proposedSchedules: [] as any[], conflicts: [] as any[], overwrites: [] as any[] };

    const morningAnalysts = analysts.filter(a => a.shiftType === 'MORNING');
    const eveningAnalysts = analysts.filter(a => a.shiftType === 'EVENING');

    // Plan rotation for the unified pool (AM + PM)
    // We use 'WEEKEND_ROTATION' as the shiftType key to store the single rotation state
    const rotationPlans = await this.rotationManager.planRotation(
      this.name, 'WEEKEND_ROTATION', startDate, endDate, analysts, existingSchedules
    );

    const currentMoment = moment.utc(startDate);
    const endMoment = moment.utc(endDate);

    while (currentMoment.isSameOrBefore(endMoment, 'day')) {
      const dateStr = currentMoment.format('YYYY-MM-DD');
      const currentDate = currentMoment.toDate();

      const blackoutConstraint = globalConstraints.find(c =>
        moment((c as any).startDate).isSameOrBefore(currentMoment, 'day') &&
        moment((c as any).endDate).isSameOrAfter(currentMoment, 'day') &&
        (c as any).constraintType === 'BLACKOUT_DATE'
      );

      if (blackoutConstraint) {
        result.conflicts.push({
          date: dateStr, type: 'BLACKOUT_DATE',
          description: (blackoutConstraint as any).description || 'No scheduling allowed',
          severity: 'CRITICAL'
        });
        currentMoment.add(1, 'day');
        continue;
      }

      for (const analyst of morningAnalysts) {
        const shouldWork = this.rotationManager.shouldAnalystWork(analyst.id, currentDate, rotationPlans);
        const onVacation = analyst.vacations?.some((v: any) =>
          moment(v.startDate).isSameOrBefore(currentMoment, 'day') &&
          moment(v.endDate).isSameOrAfter(currentMoment, 'day')
        ) || false;

        if (shouldWork && !onVacation) {
          result.proposedSchedules.push({
            date: dateStr, analystId: analyst.id, analystName: analyst.name,
            shiftType: 'MORNING', isScreener: false, type: 'NEW_SCHEDULE'
          });
        }
      }

      for (const analyst of eveningAnalysts) {
        const shouldWork = this.rotationManager.shouldAnalystWork(analyst.id, currentDate, rotationPlans);
        const onVacation = analyst.vacations?.some((v: any) =>
          moment(v.startDate).isSameOrBefore(currentMoment, 'day') &&
          moment(v.endDate).isSameOrAfter(currentMoment, 'day')
        ) || false;

        if (shouldWork && !onVacation) {
          result.proposedSchedules.push({
            date: dateStr, analystId: analyst.id, analystName: analyst.name,
            shiftType: 'EVENING', isScreener: false, type: 'NEW_SCHEDULE'
          });
        }
      }

      currentMoment.add(1, 'day');
    }

    return result;
  }

  /**
   * Generate screener assignments
   */
  private async generateScreenerSchedules(
    startDate: Date, endDate: Date, analysts: any[], existingSchedules: any[],
    globalConstraints: any[], baseSchedules: any[]
  ): Promise<{ proposedSchedules: any[]; conflicts: any[]; overwrites: any[] }> {
    const result = { proposedSchedules: [] as any[], conflicts: [] as any[], overwrites: [] as any[] };

    let morningScreenerIndex = 0;
    let eveningScreenerIndex = 0;

    const currentMoment = moment(startDate);
    const endMoment = moment(endDate);

    while (currentMoment.isSameOrBefore(endMoment, 'day')) {
      const dateStr = currentMoment.format('YYYY-MM-DD');
      const daySchedules = baseSchedules.filter(s => s.date === dateStr);
      const morningSchedules = daySchedules.filter(s => s.shiftType === 'MORNING');
      const eveningSchedules = daySchedules.filter(s => s.shiftType === 'EVENING');

      if (morningSchedules.length > 0) {
        // Round Robin selection for guaranteed fairness
        const index = morningScreenerIndex % morningSchedules.length;
        result.proposedSchedules.push({ ...morningSchedules[index], isScreener: true });
        morningScreenerIndex++;
      }

      if (eveningSchedules.length > 0) {
        // Round Robin selection
        const index = eveningScreenerIndex % eveningSchedules.length;
        result.proposedSchedules.push({ ...eveningSchedules[index], isScreener: true });
        eveningScreenerIndex++;
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
        new Date(s.date).toISOString().split('T')[0] === schedule.date
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
              gte: new Date(startDate),
              lte: new Date(endDate)
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

    let selectedAnalyst: any;
    let reason: AssignmentReason;

    switch (strategy.logic) {
      case 'HOLIDAY_COVERAGE':
        selectedAnalyst = this.assignHolidayCoverage(date, shiftType, availableAnalysts);
        reason = {
          primaryReason: 'Holiday coverage - experienced analyst',
          secondaryFactors: ['High work weight day', 'Requires reliable coverage'],
          workWeight: 2.0,
          computationCost: 'LOW'
        };
        break;

      case 'WORKLOAD_BALANCE':
        selectedAnalyst = this.assignWorkloadBalance(date, shiftType, availableAnalysts, startDate, endDate);
        reason = {
          primaryReason: 'Workload balance - equitable distribution',
          secondaryFactors: ['Analyst has lighter week', 'Maintains fair rotation'],
          workWeight: 1.5,
          computationCost: 'MEDIUM'
        };
        break;

      case 'EXPERIENCE_BASED':
        selectedAnalyst = this.assignExperienceBased(date, shiftType, availableAnalysts);
        reason = {
          primaryReason: 'Experience-based assignment',
          secondaryFactors: ['Analyst has relevant experience', 'Complex shift requirements'],
          workWeight: 1.8,
          computationCost: 'LOW'
        };
        break;

      case 'ROUND_ROBIN':
      default:
        selectedAnalyst = this.assignRoundRobin(date, shiftType, availableAnalysts);
        reason = {
          primaryReason: 'Round-robin rotation',
          secondaryFactors: ['Next in sequence', 'Fair distribution'],
          workWeight: 1.0,
          computationCost: 'LOW'
        };
        break;
    }

    const shiftDef = this.shiftDefinitions[shiftType];
    const shiftDate = moment.tz(date, shiftDef.tz).hour(shiftDef.startHour).minute(0).second(0).utc().format();

    return {
      date: shiftDate,
      shiftType,
      analystId: selectedAnalyst.id,
      analystName: selectedAnalyst.name,
      reason,
      strategy: strategy.name
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
      new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
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
      new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
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