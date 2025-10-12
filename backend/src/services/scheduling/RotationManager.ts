import { PatternContinuityService } from './PatternContinuityService';
import { fairnessCalculator } from './FairnessCalculator';
import { isWeekend } from '../../utils/dateUtils';

interface WorkPattern {
  name: string;
  days: number[];
  nextPattern: string;
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
  
  constructor(patternContinuityService: PatternContinuityService) {
    this.patternContinuityService = patternContinuityService;
    
    // Define standard work patterns
    this.workPatterns = [
      { name: 'SUN_THU', days: [0, 1, 2, 3, 4], nextPattern: 'TUE_SAT' },
      { name: 'MON_FRI', days: [1, 2, 3, 4, 5], nextPattern: 'SUN_THU' },
      { name: 'TUE_SAT', days: [2, 3, 4, 5, 6], nextPattern: 'MON_FRI' }
    ];
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
   * Check if weekend coverage is needed and if this analyst should provide it
   * This ensures FR-2.4: exactly one analyst per shift type works on each weekend day
   */
  needsWeekendCoverage(
    analystId: string,
    date: Date,
    shiftType: string,
    rotationPlans: RotationPlan[],
    allAnalysts: any[]
  ): boolean {
    // Only consider weekend days
    if (!isWeekend(date)) {
      return false;
    }

    // Check if this analyst is in rotation (they should work if in rotation)
    const rotation = rotationPlans.find(r => 
      r.analystId === analystId && 
      r.startDate && r.endDate &&
      date >= r.startDate && date <= r.endDate
    );

    if (rotation) {
      // If in rotation, follow rotation pattern
      if (rotation.pattern === 'BREAK') {
        return false;
      }
      const pattern = this.workPatterns.find(p => p.name === rotation.pattern);
      return pattern ? pattern.days.includes(date.getDay()) : false;
    }

    // If not in rotation, check if we need weekend coverage
    // Find analysts of the same shift type who are available for weekend work
    const shiftAnalysts = allAnalysts.filter(a => a.shiftType === shiftType && a.isActive);
    
    // Check if any analyst in rotation can cover this weekend
    const rotationAnalystsForWeekend = shiftAnalysts.filter(analyst => {
      const analystRotation = rotationPlans.find(r => 
        r.analystId === analyst.id && 
        r.startDate && r.endDate &&
        date >= r.startDate && date <= r.endDate &&
        r.pattern !== 'BREAK'
      );
      
      if (analystRotation) {
        const pattern = this.workPatterns.find(p => p.name === analystRotation.pattern);
        return pattern ? pattern.days.includes(date.getDay()) : false;
      }
      return false;
    });

    // If someone in rotation can cover, this analyst doesn't need to
    if (rotationAnalystsForWeekend.length > 0) {
      return false;
    }

    // CRITICAL: If no one in rotation can cover, we MUST ensure weekend coverage
    // Use a deterministic approach to guarantee exactly one analyst per shift type
    return this.guaranteeWeekendCoverage(analystId, date, shiftAnalysts);
  }

  /**
   * Guarantee weekend coverage by ensuring exactly one analyst per shift type works weekends
   * This is a critical requirement (FR-2.4) that must never fail
   */
  private guaranteeWeekendCoverage(
    analystId: string,
    date: Date,
    shiftAnalysts: any[]
  ): boolean {
    // Sort analysts consistently for deterministic assignment
    const sortedAnalysts = shiftAnalysts.sort((a, b) => a.id.localeCompare(b.id));
    const analystIndex = sortedAnalysts.findIndex(a => a.id === analystId);
    
    if (analystIndex === -1) {
      return false;
    }

    // Use date-based deterministic assignment to ensure consistent weekend coverage
    // This guarantees that the same analyst is always selected for the same weekend
    const dateStr = date.toISOString().split('T')[0];
    const dateHash = this.hashString(dateStr) % shiftAnalysts.length;
    
    // Assign exactly one analyst per shift type for this weekend
    return analystIndex === dateHash;
  }

  /**
   * Simple hash function for deterministic assignment
   */
  private hashString(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
  }

  /**
   * Determine if this analyst should provide weekend coverage based on fairness
   */
  private shouldProvideWeekendCoverage(
    analystId: string,
    date: Date,
    shiftAnalysts: any[]
  ): boolean {
    // Enhanced fairness: ensure weekend coverage while being fair
    const sortedAnalysts = shiftAnalysts.sort((a, b) => a.id.localeCompare(b.id));
    const analystIndex = sortedAnalysts.findIndex(a => a.id === analystId);
    
    if (analystIndex === -1) {
      return false;
    }

    // Use a more reliable weekend rotation strategy
    // Count weekends since a reference date to ensure consistent rotation
    const referenceDate = new Date('2025-01-01'); // Reference date
    const weeksSinceReference = Math.floor((date.getTime() - referenceDate.getTime()) / (1000 * 60 * 60 * 24 * 7));
    
    // Rotate through analysts based on weeks, ensuring weekend coverage
    const rotationIndex = weeksSinceReference % shiftAnalysts.length;
    
    // For weekends, we need to ensure coverage, so we'll be more permissive
    // If the primary analyst can't work, try the next one
    const primaryMatch = analystIndex === rotationIndex;
    
    // If this is the primary analyst or we need backup coverage, assign them
    if (primaryMatch) {
      return true;
    }
    
    // For weekends, ensure we always have coverage by having a backup strategy
    // If no one else is assigned and this analyst is available, assign them
    return analystIndex === (rotationIndex + 1) % shiftAnalysts.length;
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
