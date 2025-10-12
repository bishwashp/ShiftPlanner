/**
 * CoreWeekendRotationScheduler - The unified core scheduling algorithm
 * 
 * Implements FR-2.3.1: Staggered Two-Analyst Weekend Rotation System
 * 
 * Core Algorithm:
 * 1. Two analysts per shift type are in rotation simultaneously (staggered phases)
 * 2. Week 1 Analyst: Sun-Thu (Friday auto comp-off)
 * 3. Week 2 Analyst: Tue-Sat (Monday auto comp-off)
 * 4. Week 3: Returns to regular Mon-Fri
 * 5. All other analysts work Mon-Fri
 * 
 * Three Phases:
 * - Phase 1: Regular work schedule generation (with rotation + comp-offs)
 * - Phase 2: Screener assignment (from Phase 1 working analysts only)
 * - Phase 3: Validation and metrics reporting
 */

import { Analyst, SchedulingConstraint } from '../../../generated/prisma';
import { 
  SchedulingContext, 
  SchedulingResult, 
  ProposedSchedule,
  SchedulingConflict,
  ScheduleOverwrite,
  FairnessMetrics,
  PerformanceMetrics,
  ConstraintValidationResult
} from './algorithms/types';
import { AnalystPoolManager } from './AnalystPoolManager';
import { ConstraintFilter } from './ConstraintFilter';
import { fairnessCalculator } from './FairnessCalculator';

// Extended schedule for internal use with comp-off tracking
interface InternalSchedule extends ProposedSchedule {
  pattern?: string;  // SUN_THU, TUE_SAT, MON_FRI
  isCompOff?: boolean;
}

export class CoreWeekendRotationScheduler {
  name = 'CoreWeekendRotationScheduler';
  description = 'Unified weekend rotation algorithm with staggered two-analyst system and auto comp-offs';
  version = '1.0.0';
  supportedFeatures = [
    'Staggered Two-Analyst Rotation',
    'Auto Comp-Off Management',
    'Intrinsic Fairness',
    'Screener Assignment',
    'Weekend Coverage Guarantee',
    'Pool-Based Rotation Cycle'
  ];
  
  private poolManager: AnalystPoolManager;
  private constraintFilter: ConstraintFilter;
  
  constructor() {
    this.poolManager = new AnalystPoolManager(this.name);
    this.constraintFilter = new ConstraintFilter();
  }
  
  /**
   * Validate constraints (informational only, constraints are applied in preprocessing)
   */
  validateConstraints(schedules: ProposedSchedule[], constraints: SchedulingConstraint[]): ConstraintValidationResult {
    const conflicts = this.validateSchedules(schedules, { 
      startDate: new Date(), 
      endDate: new Date(), 
      analysts: [], 
      existingSchedules: [], 
      globalConstraints: constraints 
    });
    
    return {
      isValid: conflicts.length === 0,
      violations: [],
      score: conflicts.length === 0 ? 1.0 : 0.5,
      suggestions: []
    };
  }
  
  /**
   * Calculate fairness (informational only, fairness is intrinsic to rotation)
   */
  calculateFairness(schedules: ProposedSchedule[], analysts: Analyst[]): FairnessMetrics {
    return this.calculateFairnessMetrics(schedules, analysts);
  }
  
  /**
   * Optimize schedules (not needed, fairness is intrinsic to rotation algorithm)
   */
  async optimizeSchedules(schedules: ProposedSchedule[], context: SchedulingContext): Promise<ProposedSchedule[]> {
    // No post-processing optimization needed - fairness is intrinsic
    return schedules;
  }
  
  /**
   * Main entry point: Generate complete schedule
   */
  async generateSchedules(context: SchedulingContext): Promise<SchedulingResult> {
    const startTime = Date.now();
    console.log(`\n🚀 ${this.name} v${this.version} starting...`);
    console.log(`📅 Date range: ${context.startDate.toISOString().split('T')[0]} to ${context.endDate.toISOString().split('T')[0]}`);
    console.log(`👥 Analysts: ${context.analysts.length}`);
    
    // Phase 1: Generate regular work schedules with rotation
    console.log(`\n📋 PHASE 1: Regular Work Schedule Generation`);
    const regularSchedules = await this.generateRegularSchedules(context);
    console.log(`   ✓ Generated ${regularSchedules.length} regular work assignments`);
    
    // Phase 2: Assign screeners from working analysts
    console.log(`\n🔍 PHASE 2: Screener Assignment`);
    const schedulesWithScreeners = await this.assignScreeners(
      regularSchedules,
      context
    );
    console.log(`   ✓ Assigned ${schedulesWithScreeners.filter(s => s.isScreener).length} screener roles`);
    
    // Phase 3: Validation and metrics
    console.log(`\n✅ PHASE 3: Validation & Metrics`);
    const conflicts = this.validateSchedules(schedulesWithScreeners, context);
    const overwrites = this.detectOverwrites(schedulesWithScreeners, context.existingSchedules);
    const fairnessMetrics = this.calculateFairnessMetrics(schedulesWithScreeners, context.analysts);
    
    const executionTime = Date.now() - startTime;
    const performanceMetrics: PerformanceMetrics = {
      totalQueries: 0,
      averageQueryTime: 0,
      slowQueries: 0,
      cacheHitRate: 0,
      algorithmExecutionTime: executionTime,
      memoryUsage: process.memoryUsage().heapUsed / 1024 / 1024,
      optimizationIterations: 0
    };
    
    console.log(`   ✓ Validation complete: ${conflicts.length} conflicts, ${overwrites.length} overwrites`);
    console.log(`\n🎉 Completed in ${executionTime}ms`);
    
    return {
      proposedSchedules: schedulesWithScreeners,
      conflicts,
      overwrites,
      fairnessMetrics,
      performanceMetrics
    };
  }
  
  /**
   * PHASE 1: Generate regular work schedules with staggered rotation
   */
  private async generateRegularSchedules(
    context: SchedulingContext
  ): Promise<InternalSchedule[]> {
    const schedules: ProposedSchedule[] = [];
    
    // Separate analysts by shift type
    const morningAnalysts = context.analysts.filter(a => a.shiftType === 'MORNING');
    const eveningAnalysts = context.analysts.filter(a => a.shiftType === 'EVENING');
    
    // Load rotation states
    const morningRotation = await this.poolManager.loadRotationState('MORNING', context.analysts);
    const eveningRotation = await this.poolManager.loadRotationState('EVENING', context.analysts);
    
    console.log(`   📊 Morning rotation: Week1=${morningRotation.currentSunThuAnalyst?.id || 'none'}, Week2=${morningRotation.currentTueSatAnalyst?.id || 'none'}`);
    console.log(`   📊 Evening rotation: Week1=${eveningRotation.currentSunThuAnalyst?.id || 'none'}, Week2=${eveningRotation.currentTueSatAnalyst?.id || 'none'}`);
    
    // Track weeks for rotation advancement
    const processedWeeks = new Set<string>();
    
    // Generate day-by-day
    const currentDate = new Date(context.startDate);
    while (currentDate <= context.endDate) {
      const dateStr = currentDate.toISOString().split('T')[0];
      const dayName = this.constraintFilter.getDayName(currentDate);
      
      // Check week start (Sunday) for rotation advancement
      if (currentDate.getDay() === 0) {
        const weekKey = dateStr;
        if (!processedWeeks.has(weekKey)) {
          await this.poolManager.advanceRotation(morningRotation, currentDate, morningAnalysts, context.existingSchedules);
          await this.poolManager.advanceRotation(eveningRotation, currentDate, eveningAnalysts, context.existingSchedules);
          processedWeeks.add(weekKey);
        }
      }
      
      // Get available analysts for this date
      const filterResult = this.constraintFilter.getAvailableAnalysts(
        currentDate,
        context.analysts,
        context.globalConstraints
      );
      
      // Handle blackout dates
      if (filterResult.isBlackout) {
        console.log(`   ⛔ ${dayName} ${dateStr}: BLACKOUT - ${filterResult.constraintInfo}`);
        currentDate.setDate(currentDate.getDate() + 1);
        continue;
      }
      
      // Handle holidays (informational)
      if (filterResult.isHoliday) {
        console.log(`   🎉 ${dayName} ${dateStr}: HOLIDAY - ${filterResult.constraintInfo}`);
      }
      
      // Process morning analysts
      const morningSchedules = this.processShiftForDate(
        currentDate,
        'MORNING',
        filterResult.availableAnalysts.filter(a => a.shiftType === 'MORNING'),
        morningRotation,
        context.existingSchedules
      );
      schedules.push(...morningSchedules);
      
      // Process evening analysts
      const eveningSchedules = this.processShiftForDate(
        currentDate,
        'EVENING',
        filterResult.availableAnalysts.filter(a => a.shiftType === 'EVENING'),
        eveningRotation,
        context.existingSchedules
      );
      schedules.push(...eveningSchedules);
      
      currentDate.setDate(currentDate.getDate() + 1);
    }
    
    // Save final rotation states
    await this.poolManager.saveRotationState(morningRotation);
    await this.poolManager.saveRotationState(eveningRotation);
    
    return schedules;
  }
  
  /**
   * Process a single shift type for a single date
   */
  private processShiftForDate(
    date: Date,
    shiftType: 'MORNING' | 'EVENING',
    availableAnalysts: any[],
    rotationState: any,
    existingSchedules: any[]
  ): InternalSchedule[] {
    const schedules: ProposedSchedule[] = [];
    const dateStr = date.toISOString().split('T')[0];
    
    // Check Week 1 analyst (Sun-Thu)
    if (rotationState.currentSunThuAnalyst) {
      const analyst = availableAnalysts.find(a => a.id === rotationState.currentSunThuAnalyst.id);
      
      if (analyst) {
        // Check if working today
        if (this.poolManager.isAnalystWorking(rotationState.currentSunThuAnalyst, date)) {
          schedules.push(this.createScheduleEntry(
            analyst,
            date,
            shiftType,
            false,
            'SUN_THU',
            existingSchedules
          ));
        }
        // Check if comp-off today
        else if (this.poolManager.shouldGetCompOff(rotationState.currentSunThuAnalyst, date)) {
          schedules.push(this.createCompOffEntry(analyst, date, shiftType, 'Friday comp-off (Week 1)'));
        }
      }
    }
    
    // Check Week 2 analyst (Tue-Sat)
    if (rotationState.currentTueSatAnalyst) {
      const analyst = availableAnalysts.find(a => a.id === rotationState.currentTueSatAnalyst.id);
      
      if (analyst) {
        // Check if working today
        if (this.poolManager.isAnalystWorking(rotationState.currentTueSatAnalyst, date)) {
          schedules.push(this.createScheduleEntry(
            analyst,
            date,
            shiftType,
            false,
            'TUE_SAT',
            existingSchedules
          ));
        }
        // Check if comp-off today
        else if (this.poolManager.shouldGetCompOff(rotationState.currentTueSatAnalyst, date)) {
          schedules.push(this.createCompOffEntry(analyst, date, shiftType, 'Monday comp-off (Week 2)'));
        }
      }
    }
    
    // All OTHER analysts work regular Mon-Fri
    const regularAnalysts = availableAnalysts.filter(a => 
      a.id !== rotationState.currentSunThuAnalyst?.id &&
      a.id !== rotationState.currentTueSatAnalyst?.id &&
      !rotationState.completedPool.includes(a.id)  // Exclude recently completed (they're in Week 3)
    );
    
    // Check if this is a regular workday (Mon-Fri)
    if (this.constraintFilter.isWeekday(date)) {
      regularAnalysts.forEach(analyst => {
        schedules.push(this.createScheduleEntry(
          analyst,
          date,
          shiftType,
          false,
          'MON_FRI',
          existingSchedules
        ));
      });
    }
    
    // Handle Week 3 analysts (recently completed, back to Mon-Fri)
    const week3Analysts = availableAnalysts.filter(a => 
      rotationState.completedPool.includes(a.id)
    );
    
    if (this.constraintFilter.isWeekday(date)) {
      week3Analysts.forEach(analyst => {
        schedules.push(this.createScheduleEntry(
          analyst,
          date,
          shiftType,
          false,
          'MON_FRI',
          existingSchedules
        ));
      });
    }
    
    return schedules;
  }
  
  /**
   * PHASE 2: Assign screeners from working analysts
   */
  private async assignScreeners(
    regularSchedules: InternalSchedule[],
    context: SchedulingContext
  ): Promise<ProposedSchedule[]> {
    const schedulesWithScreeners = [...regularSchedules];
    const screenerHistory = new Map<string, Date[]>();
    
    // Initialize screener history
    context.analysts.forEach(a => screenerHistory.set(a.id, []));
    
    // Load recent screener assignments from existing schedules
    const lookbackDate = new Date(context.startDate);
    lookbackDate.setDate(lookbackDate.getDate() - 7);
    context.existingSchedules
      .filter(s => s.isScreener && new Date(s.date) >= lookbackDate)
      .forEach(s => {
        const history = screenerHistory.get(s.analystId) || [];
        history.push(new Date(s.date));
        screenerHistory.set(s.analystId, history);
      });
    
    // Process each weekday
    const currentDate = new Date(context.startDate);
    while (currentDate <= context.endDate) {
      // Only assign screeners on weekdays
      if (!this.constraintFilter.isWeekday(currentDate)) {
        currentDate.setDate(currentDate.getDate() + 1);
        continue;
      }
      
      const dateStr = currentDate.toISOString().split('T')[0];
      
      // Get working analysts for this day (from Phase 1 output)
      const workingToday = regularSchedules
        .filter(s => s.date === dateStr && !s.isCompOff)
        .map(s => context.analysts.find(a => a.id === s.analystId))
        .filter(Boolean);
      
      const morningWorking = workingToday.filter(a => a && a.shiftType === 'MORNING');
      const eveningWorking = workingToday.filter(a => a && a.shiftType === 'EVENING');
      
      // Assign morning screener
      if (morningWorking.length > 0) {
        const screener = this.selectScreener(morningWorking, currentDate, screenerHistory);
        if (screener) {
          // Mark existing schedule as screener
          const existingSchedule = schedulesWithScreeners.find(
            s => s.date === dateStr && s.analystId === screener.id && s.shiftType === 'MORNING'
          );
          if (existingSchedule) {
            existingSchedule.isScreener = true;
          }
          
          // Update history
          const history = screenerHistory.get(screener.id) || [];
          history.push(new Date(currentDate));
          screenerHistory.set(screener.id, history);
        }
      }
      
      // Assign evening screener
      if (eveningWorking.length > 0) {
        const screener = this.selectScreener(eveningWorking, currentDate, screenerHistory);
        if (screener) {
          // Mark existing schedule as screener
          const existingSchedule = schedulesWithScreeners.find(
            s => s.date === dateStr && s.analystId === screener.id && s.shiftType === 'EVENING'
          );
          if (existingSchedule) {
            existingSchedule.isScreener = true;
          }
          
          // Update history
          const history = screenerHistory.get(screener.id) || [];
          history.push(new Date(currentDate));
          screenerHistory.set(screener.id, history);
        }
      }
      
      currentDate.setDate(currentDate.getDate() + 1);
    }
    
    return schedulesWithScreeners;
  }
  
  /**
   * Select best screener from working analysts using fairness metrics
   */
  private selectScreener(
    workingAnalysts: any[],
    date: Date,
    screenerHistory: Map<string, Date[]>
  ): any | null {
    if (workingAnalysts.length === 0) return null;
    
    // Score each analyst
    const scores = workingAnalysts.map(analyst => {
      const history = screenerHistory.get(analyst.id) || [];
      let score = 0;
      
      // Penalize recent screener assignments
      const recentDays = history.filter(d => {
        const daysDiff = Math.floor((date.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
        return daysDiff >= 0 && daysDiff <= 7;
      }).length;
      score -= recentDays * 100;
      
      // Heavily penalize if already 2+ screener days this week (max 2 constraint)
      if (recentDays >= 2) {
        score -= 1000;
      }
      
      // Penalize consecutive screener days
      const yesterday = new Date(date);
      yesterday.setDate(yesterday.getDate() - 1);
      const screenedYesterday = history.some(d => 
        d.toISOString().split('T')[0] === yesterday.toISOString().split('T')[0]
      );
      if (screenedYesterday) {
        score -= 500;
      }
      
      // Prefer analysts with fewer total screener assignments
      score -= history.length * 10;
      
      return { analyst, score };
    });
    
    // Sort by score (highest first)
    scores.sort((a, b) => b.score - a.score);
    
    return scores[0].analyst;
  }
  
  /**
   * Create a schedule entry
   */
  private createScheduleEntry(
    analyst: any,
    date: Date,
    shiftType: 'MORNING' | 'EVENING',
    isScreener: boolean,
    pattern: string,
    existingSchedules: any[]
  ): InternalSchedule {
    const dateStr = date.toISOString().split('T')[0];
    
    // Check if overwriting existing schedule
    const existing = existingSchedules.find(
      s => s.analystId === analyst.id && new Date(s.date).toISOString().split('T')[0] === dateStr
    );
    
    return {
      date: dateStr,
      analystId: analyst.id,
      analystName: analyst.name,
      shiftType,
      isScreener,
      type: existing ? 'OVERWRITE_SCHEDULE' : 'NEW_SCHEDULE',
      pattern,
      isCompOff: false
    };
  }
  
  /**
   * Create a comp-off entry
   */
  private createCompOffEntry(
    analyst: any,
    date: Date,
    shiftType: 'MORNING' | 'EVENING',
    reason: string
  ): InternalSchedule {
    return {
      date: date.toISOString().split('T')[0],
      analystId: analyst.id,
      analystName: analyst.name,
      shiftType,
      isScreener: false,
      type: 'NEW_SCHEDULE',
      isCompOff: true,
      assignmentReason: {
        primaryReason: reason,
        secondaryFactors: ['Auto comp-off from rotation'],
        workWeight: 0,
        computationCost: 'LOW',
        confidence: 1.0
      }
    };
  }
  
  /**
   * PHASE 3: Validate schedules
   */
  private validateSchedules(
    schedules: ProposedSchedule[],
    context: SchedulingContext
  ): SchedulingConflict[] {
    const conflicts: any[] = [];
    
    // Group by date for validation
    const schedulesByDate = new Map<string, ProposedSchedule[]>();
    schedules.forEach(s => {
      if (!schedulesByDate.has(s.date)) {
        schedulesByDate.set(s.date, []);
      }
      schedulesByDate.get(s.date)!.push(s);
    });
    
    // Validate each date
    schedulesByDate.forEach((daySchedules, dateStr) => {
      const date = new Date(dateStr);
      const isWeekend = this.constraintFilter.isWeekend(date);
      
      // Count coverage by shift (exclude comp-offs)
      const morningCount = daySchedules.filter(s => 
        s.shiftType === 'MORNING' && !(s.assignmentReason?.primaryReason.includes('comp-off'))
      ).length;
      const eveningCount = daySchedules.filter(s => 
        s.shiftType === 'EVENING' && !(s.assignmentReason?.primaryReason.includes('comp-off'))
      ).length;
      
      // FR-2.4: Exactly one analyst per shift type on weekends
      if (isWeekend) {
        if (morningCount !== 1) {
          conflicts.push({
            date: dateStr,
            type: 'WEEKEND_COVERAGE_VIOLATION',
            severity: 'CRITICAL',
            description: `Weekend ${dateStr}: ${morningCount} morning analysts (expected 1) - FR-2.4 violation`,
            suggestedResolution: 'Ensure exactly one morning analyst works weekends'
          });
        }
        if (eveningCount !== 1) {
          conflicts.push({
            date: dateStr,
            type: 'WEEKEND_COVERAGE_VIOLATION',
            severity: 'CRITICAL',
            description: `Weekend ${dateStr}: ${eveningCount} evening analysts (expected 1) - FR-2.4 violation`,
            suggestedResolution: 'Ensure exactly one evening analyst works weekends'
          });
        }
      }
      
      // Basic coverage check
      if (morningCount === 0) {
        conflicts.push({
          date: dateStr,
          type: 'INSUFFICIENT_COVERAGE',
          severity: 'HIGH',
          description: `No morning coverage on ${dateStr}`
        });
      }
      if (eveningCount === 0) {
        conflicts.push({
          date: dateStr,
          type: 'INSUFFICIENT_COVERAGE',
          severity: 'HIGH',
          description: `No evening coverage on ${dateStr}`
        });
      }
    });
    
    return conflicts;
  }
  
  /**
   * Detect schedule overwrites
   */
  private detectOverwrites(
    proposedSchedules: ProposedSchedule[],
    existingSchedules: any[]
  ): ScheduleOverwrite[] {
    const overwrites: any[] = [];
    
    proposedSchedules
      .filter(p => p.type === 'OVERWRITE_SCHEDULE')
      .forEach(proposed => {
        const existing = existingSchedules.find(
          e => e.analystId === proposed.analystId && 
               new Date(e.date).toISOString().split('T')[0] === proposed.date
        );
        
        if (existing) {
          overwrites.push({
            date: proposed.date,
            analystId: proposed.analystId,
            analystName: proposed.analystName,
            from: {
              shiftType: existing.shiftType,
              isScreener: existing.isScreener
            },
            to: {
              shiftType: proposed.shiftType,
              isScreener: proposed.isScreener
            },
            reason: 'Algorithm optimization'
          });
        }
      });
    
    return overwrites;
  }
  
  /**
   * Calculate fairness metrics (informational only)
   */
  private calculateFairnessMetrics(
    schedules: ProposedSchedule[],
    analysts: Analyst[]
  ): FairnessMetrics {
    // Calculate basic fairness metrics
    const analystWorkDays = new Map<string, number>();
    const analystScreenerDays = new Map<string, number>();
    const analystWeekendDays = new Map<string, number>();
    
    analysts.forEach(a => {
      analystWorkDays.set(a.id, 0);
      analystScreenerDays.set(a.id, 0);
      analystWeekendDays.set(a.id, 0);
    });
    
    schedules.filter(s => !(s as InternalSchedule).isCompOff).forEach(s => {
      analystWorkDays.set(s.analystId, (analystWorkDays.get(s.analystId) || 0) + 1);
      if (s.isScreener) {
        analystScreenerDays.set(s.analystId, (analystScreenerDays.get(s.analystId) || 0) + 1);
      }
      const date = new Date(s.date);
      if (this.constraintFilter.isWeekend(date)) {
        analystWeekendDays.set(s.analystId, (analystWeekendDays.get(s.analystId) || 0) + 1);
      }
    });
    
    const workDayValues = Array.from(analystWorkDays.values());
    const avgWorkDays = workDayValues.reduce((a, b) => a + b, 0) / workDayValues.length;
    const workDayVariance = workDayValues.reduce((sum, val) => sum + Math.pow(val - avgWorkDays, 2), 0) / workDayValues.length;
    const workDayStdDev = Math.sqrt(workDayVariance);
    
    const screenerValues = Array.from(analystScreenerDays.values());
    const screenerAvg = screenerValues.reduce((a, b) => a + b, 0) / screenerValues.length;
    const screenerVariance = screenerValues.reduce((sum, val) => sum + Math.pow(val - screenerAvg, 2), 0) / screenerValues.length;
    const screenerStdDev = Math.sqrt(screenerVariance);
    
    const weekendValues = Array.from(analystWeekendDays.values());
    const weekendAvg = weekendValues.reduce((a, b) => a + b, 0) / weekendValues.length;
    const weekendVariance = weekendValues.reduce((sum, val) => sum + Math.pow(val - weekendAvg, 2), 0) / weekendValues.length;
    const weekendStdDev = Math.sqrt(weekendVariance);
    
    return {
      overallFairnessScore: Math.max(0, 1 - (workDayStdDev / avgWorkDays)),
      workloadDistribution: {
        standardDeviation: workDayStdDev,
        giniCoefficient: 0,  // Calculate if needed
        maxMinRatio: Math.max(...workDayValues) / Math.max(1, Math.min(...workDayValues))
      },
      screenerDistribution: {
        standardDeviation: screenerStdDev,
        maxMinRatio: Math.max(...screenerValues) / Math.max(1, Math.min(...screenerValues)),
        fairnessScore: Math.max(0, 1 - (screenerStdDev / Math.max(1, screenerAvg)))
      },
      weekendDistribution: {
        standardDeviation: weekendStdDev,
        maxMinRatio: Math.max(...weekendValues) / Math.max(1, Math.min(...weekendValues)),
        fairnessScore: Math.max(0, 1 - (weekendStdDev / Math.max(1, weekendAvg)))
      },
      recommendations: []
    };
  }
}

export default new CoreWeekendRotationScheduler();

