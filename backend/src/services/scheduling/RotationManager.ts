import { PatternContinuityService } from './PatternContinuityService';
import { fairnessCalculator } from './FairnessCalculator';
import { isWeekend } from '../../utils/dateUtils';
import { prisma } from '../../lib/prisma';

interface WorkPattern {
  name: string;
  days: number[];
  nextPattern: string;
  breakDays?: number;
}

interface RotationPlan {
  analystId: string | null;
  pattern: string;
  startDate: Date | null;
  endDate: Date | null;
  breakStartDate: Date | null;
  breakEndDate: Date | null;
}

export class RotationManager {
  private patternContinuityService: PatternContinuityService;
  private workPatterns: WorkPattern[];
  private patternsLoaded: boolean = false;

  constructor(patternContinuityService: PatternContinuityService) {
    this.patternContinuityService = patternContinuityService;

    // Initialize with empty patterns - will be loaded from database
    this.workPatterns = [];
  }

  /**
   * Load work patterns from database
   * Patterns are cached in memory after first load
   */
  private async loadWorkPatterns(): Promise<void> {
    if (this.patternsLoaded) {
      return; // Already loaded, use cached patterns
    }

    console.log('📋 Loading work patterns from database...');

    const dbPatterns = await prisma.workPattern.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' }
    });

    if (dbPatterns.length === 0) {
      console.warn('⚠️  No active work patterns found in database, using fallback defaults');
      // Fallback to hardcoded patterns if database is empty
      this.workPatterns = [
        { name: 'SUN_THU', days: [0, 1, 2, 3, 4], nextPattern: 'TUE_SAT', breakDays: 4 },
        { name: 'MON_FRI', days: [1, 2, 3, 4, 5], nextPattern: 'SUN_THU', breakDays: 0 },
        { name: 'TUE_SAT', days: [2, 3, 4, 5, 6], nextPattern: 'MON_FRI', breakDays: 0 }
      ];
    } else {
      // Convert database patterns to internal format
      this.workPatterns = dbPatterns.map(p => ({
        name: p.name,
        days: p.days.split(',').map(Number),
        nextPattern: p.nextPattern,
        breakDays: p.breakDays
      }));

      console.log(`✓ Loaded ${this.workPatterns.length} work patterns from database`);
    }

    this.patternsLoaded = true;
  }

  /**
   * Plan rotation for a specific date range and shift type
   */
  async planRotation(
    algorithmType: string,
    shiftType: string,
    startDate: Date,
    endDate: Date,
    analysts: any[],
    historicalSchedules: any[] = []
  ): Promise<RotationPlan[]> {
    // Load patterns from database
    await this.loadWorkPatterns();

    // Get current rotation state
    let rotationState = await this.patternContinuityService.getRotationState(algorithmType, shiftType);

    // Filter analysts by shift type
    const shiftAnalysts = analysts.filter(a => a.shiftType === shiftType && a.isActive);

    // If no analysts, return empty plan
    if (shiftAnalysts.length === 0) {
      return [];
    }

    // If no rotation state, initialize one
    if (!rotationState) {
      rotationState = await this.initializeRotationState(algorithmType, shiftType, shiftAnalysts, historicalSchedules, startDate);
    }

    // Generate rotation plans
    const rotationPlans: RotationPlan[] = [];

    // Start with current date for planning
    let currentPlanDate = new Date(startDate);

    // Continue planning until we reach the end date
    while (currentPlanDate <= endDate) {
      // Check if we need to start a new rotation
      if (!rotationState.currentAnalystId || !rotationState.currentPattern) {
        // Select next analyst based on fairness
        const fairnessScores = fairnessCalculator.calculateRotationFairnessScores(
          shiftAnalysts,
          historicalSchedules,
          currentPlanDate
        );

        const unavailableAnalysts = new Set(rotationState.completedAnalystIds || []);
        const nextAnalyst = fairnessCalculator.selectNextAnalystForRotation(
          shiftAnalysts,
          fairnessScores,
          unavailableAnalysts
        );

        if (!nextAnalyst) {
          // If no analysts available, reset completed list and try again
          rotationState.completedAnalystIds = [];
          const resetNextAnalyst = fairnessCalculator.selectNextAnalystForRotation(
            shiftAnalysts,
            fairnessScores
          );

          if (!resetNextAnalyst) {
            // If still no analysts, break out of the loop
            break;
          }

          // Start new rotation with this analyst
          rotationState.currentAnalystId = resetNextAnalyst.id;
          rotationState.currentPattern = 'SUN_THU'; // Start with Sunday-Thursday
          rotationState.rotationStartDate = new Date(currentPlanDate);
        } else {
          // Start new rotation with this analyst
          rotationState.currentAnalystId = nextAnalyst.id;
          rotationState.currentPattern = 'SUN_THU'; // Start with Sunday-Thursday
          rotationState.rotationStartDate = new Date(currentPlanDate);
        }
      }

      // Find current pattern
      const currentPattern = this.workPatterns.find(p => p.name === rotationState.currentPattern);
      if (!currentPattern) {
        console.error(`Invalid pattern: ${rotationState.currentPattern}`);
        break;
      }

      // Calculate end date of current pattern (5 days from start)
      const patternEndDate = new Date(currentPlanDate);
      patternEndDate.setDate(patternEndDate.getDate() + 4); // 5 days total (0-4)

      // Add to rotation plans if within our date range
      if (currentPlanDate <= endDate) {
        rotationPlans.push({
          analystId: rotationState.currentAnalystId,
          pattern: rotationState.currentPattern,
          startDate: new Date(currentPlanDate),
          endDate: new Date(Math.min(patternEndDate.getTime(), endDate.getTime())),
          breakStartDate: null,
          breakEndDate: null
        });
      }

      // Move to next pattern
      if (patternEndDate <= endDate) {
        // If current pattern is SUN-THU, add 4-day break
        if (rotationState.currentPattern === 'SUN_THU') {
          const breakStartDate = new Date(patternEndDate);
          breakStartDate.setDate(breakStartDate.getDate() + 1); // Day after pattern ends

          const breakEndDate = new Date(breakStartDate);
          breakEndDate.setDate(breakEndDate.getDate() + 3); // 4-day break

          // Add break to rotation plans if within our date range
          if (breakStartDate <= endDate) {
            rotationPlans.push({
              analystId: rotationState.currentAnalystId,
              pattern: 'BREAK',
              startDate: new Date(breakStartDate),
              endDate: new Date(Math.min(breakEndDate.getTime(), endDate.getTime())),
              breakStartDate: new Date(breakStartDate),
              breakEndDate: new Date(breakEndDate)
            });
          }

          // Move current date to after the break
          currentPlanDate = new Date(breakEndDate);
          currentPlanDate.setDate(currentPlanDate.getDate() + 1);

          // Move to TUE-SAT pattern
          rotationState.currentPattern = currentPattern.nextPattern;
        } else if (rotationState.currentPattern === 'TUE_SAT') {
          // Move to next day after pattern ends
          currentPlanDate = new Date(patternEndDate);
          currentPlanDate.setDate(currentPlanDate.getDate() + 1);

          // Move to MON-FRI pattern
          rotationState.currentPattern = currentPattern.nextPattern;
        } else {
          // After MON-FRI, rotation is complete
          currentPlanDate = new Date(patternEndDate);
          currentPlanDate.setDate(currentPlanDate.getDate() + 1);

          // Add analyst to completed list
          if (rotationState.currentAnalystId && !rotationState.completedAnalystIds.includes(rotationState.currentAnalystId)) {
            rotationState.completedAnalystIds.push(rotationState.currentAnalystId);
          }

          // Reset current analyst and pattern
          rotationState.currentAnalystId = null;
          rotationState.currentPattern = 'SUN_THU'; // Default pattern

          // Update rotation end date
          rotationState.rotationEndDate = new Date(patternEndDate);
        }
      } else {
        // If pattern extends beyond our end date, just move to the end
        currentPlanDate = new Date(endDate);
        currentPlanDate.setDate(currentPlanDate.getDate() + 1);
      }
    }

    // Save updated rotation state
    await this.patternContinuityService.saveRotationState(algorithmType, shiftType, rotationState);

    return rotationPlans;
  }

  /**
   * Initialize rotation state when none exists
   */
  private async initializeRotationState(
    algorithmType: string,
    shiftType: string,
    analysts: any[],
    historicalSchedules: any[],
    startDate: Date
  ) {
    // Calculate fairness scores
    const fairnessScores = fairnessCalculator.calculateRotationFairnessScores(
      analysts,
      historicalSchedules,
      startDate
    );

    // Select first analyst based on fairness
    const firstAnalyst = fairnessCalculator.selectNextAnalystForRotation(
      analysts,
      fairnessScores
    );

    // Create initial rotation state
    return {
      currentAnalystId: firstAnalyst ? firstAnalyst.id : null,
      currentPattern: 'SUN_THU', // Start with Sunday-Thursday
      rotationStartDate: new Date(startDate),
      rotationEndDate: null,
      completedAnalystIds: [],
      nextAnalystId: null
    };
  }

  /**
   * Check if an analyst should work on a specific date based on their rotation pattern
   */
  shouldAnalystWork(
    analystId: string,
    date: Date,
    rotationPlans: RotationPlan[]
  ): boolean {
    // Find if analyst is in rotation for this date
    const rotation = rotationPlans.find(r =>
      r.analystId === analystId &&
      r.startDate && r.endDate &&
      date >= r.startDate && date <= r.endDate
    );

    if (!rotation) {
      // If not in rotation, work regular weekdays
      return !isWeekend(date);
    }

    // If on break, don't work
    if (rotation.pattern === 'BREAK') {
      return false;
    }

    // If in rotation, check if this day is in the pattern
    const pattern = this.workPatterns.find(p => p.name === rotation.pattern);
    if (!pattern) {
      return false;
    }

    // Check if day of week is in pattern
    return pattern.days.includes(date.getDay());
  }

  /**
   * Get the work pattern for a specific date and analyst
   */
  getAnalystPattern(
    analystId: string,
    date: Date,
    rotationPlans: RotationPlan[]
  ): string | null {
    // Find if analyst is in rotation for this date
    const rotation = rotationPlans.find(r =>
      r.analystId === analystId &&
      r.startDate && r.endDate &&
      date >= r.startDate && date <= r.endDate
    );

    if (!rotation) {
      // If not in rotation, return regular pattern
      return isWeekend(date) ? null : 'MON_FRI';
    }

    return rotation.pattern;
  }
}

export const rotationManager = new RotationManager(null as any); // Will be initialized in WeekendRotationAlgorithm
