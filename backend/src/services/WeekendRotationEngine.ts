import { Analyst, SchedulingConstraint } from '../../generated/prisma';
import { AlgorithmConfiguration } from './scheduling/algorithms/types';
import { constraintHierarchy } from './ConstraintHierarchy';
import { randomizationService } from './RandomizationService';

export interface WeekendPattern {
  name: string;
  days: number[]; // 0=Sunday, 1=Monday, etc.
  nextPattern: string;
  weekendDays: number[]; // Days that include weekends
}

export interface PatternAssignment {
  [patternName: string]: {
    pattern: WeekendPattern;
    analysts: Analyst[];
  };
}

export interface WeekendRotationContext {
  analysts: Analyst[];
  startDate: Date;
  endDate: Date;
  existingSchedules?: any[];
  constraints?: SchedulingConstraint[];
}

export interface FairnessAnalysis {
  analystId: string;
  weekendWorkload: number;
  totalWorkload: number;
  weekendRatio: number;
  fairnessScore: number;
}

export class WeekendRotationEngine {

  private readonly WORK_PATTERNS: WeekendPattern[] = [
    { 
      name: 'SUN_THU', 
      days: [0, 1, 2, 3, 4], 
      nextPattern: 'TUE_SAT',
      weekendDays: [0] // Sunday
    },
    { 
      name: 'MON_FRI', 
      days: [1, 2, 3, 4, 5], 
      nextPattern: 'SUN_THU',
      weekendDays: [5] // Friday (leads to weekend)
    },
    { 
      name: 'TUE_SAT', 
      days: [2, 3, 4, 5, 6], 
      nextPattern: 'MON_FRI',
      weekendDays: [6] // Saturday
    }
  ];

  /**
   * Apply weekend rotation based on strategy
   */
  async applyWeekendRotation(
    analysts: Analyst[], 
    strategy: string, 
    context: WeekendRotationContext,
    config: AlgorithmConfiguration
  ): Promise<PatternAssignment> {
    
    switch (strategy) {
      case 'SEQUENTIAL':
        return this.sequentialRotation(analysts);
      
      case 'FAIRNESS_OPTIMIZED':
        return this.fairnessOptimizedRotation(analysts, context, config);
      
      case 'CONSTRAINT_AWARE':
        return await this.constraintAwareRotation(analysts, context, config);
      
      default:
        console.warn(`Unknown weekend rotation strategy: ${strategy}, falling back to SEQUENTIAL`);
        return this.sequentialRotation(analysts);
    }
  }

  /**
   * SEQUENTIAL strategy (current hardcoded logic)
   */
  private sequentialRotation(analysts: Analyst[]): PatternAssignment {
    const assignments: PatternAssignment = {};
    
    // Initialize pattern assignments
    this.WORK_PATTERNS.forEach(pattern => {
      assignments[pattern.name] = { pattern, analysts: [] };
    });

    // Simple round-robin assignment (current logic)
    analysts.forEach((analyst, index) => {
      const patternName = this.WORK_PATTERNS[index % this.WORK_PATTERNS.length].name;
      assignments[patternName].analysts.push(analyst);
    });

    return assignments;
  }

  /**
   * FAIRNESS_OPTIMIZED strategy - minimize weekend workload variance
   */
  private fairnessOptimizedRotation(
    analysts: Analyst[], 
    context: WeekendRotationContext,
    config: AlgorithmConfiguration
  ): PatternAssignment {
    
    // Calculate historical weekend workload for each analyst
    const fairnessAnalysis = this.calculateWeekendFairness(analysts, context);
    
    // Use randomization service for fair workload sorting with tie-breaking
    const scoreFn = (analyst: Analyst) => {
      const workload = fairnessAnalysis.find(f => f.analystId === analyst.id)?.weekendWorkload || 0;
      return 1000 - workload; // Invert for tie-breaking (higher score = lower workload)
    };

    const sortedAnalysts = randomizationService.shuffleArray(
      [...analysts].sort((a, b) => scoreFn(b) - scoreFn(a)), // Base sort by workload
      config
    );

    // Assign patterns to minimize weekend workload variance
    const assignments: PatternAssignment = {};
    this.WORK_PATTERNS.forEach(pattern => {
      assignments[pattern.name] = { pattern, analysts: [] };
    });

    // Smart assignment: those with lowest weekend workload get more weekend-heavy patterns
    const weekendHeavyPatterns = ['SUN_THU', 'TUE_SAT']; // Patterns with weekend days
    const regularPattern = 'MON_FRI'; // Pattern with no weekends

    let weekendPatternIndex = 0;
    let regularAnalystCount = 0;

    sortedAnalysts.forEach((analyst, index) => {
      const fairnessData = fairnessAnalysis.find(f => f.analystId === analyst.id);
      
      // Assign analysts with lower weekend workload to weekend patterns
      if (fairnessData && fairnessData.weekendWorkload < this.getAverageWeekendWorkload(fairnessAnalysis)) {
        const pattern = weekendHeavyPatterns[weekendPatternIndex % weekendHeavyPatterns.length];
        assignments[pattern].analysts.push(analyst);
        weekendPatternIndex++;
      } else {
        // Higher weekend workload analysts get regular pattern
        assignments[regularPattern].analysts.push(analyst);
        regularAnalystCount++;
      }
    });

    // Balance assignments if needed
    return this.balancePatternAssignments(assignments);
  }

  /**
   * CONSTRAINT_AWARE strategy - respect analyst constraints
   */
  private async constraintAwareRotation(
    analysts: Analyst[], 
    context: WeekendRotationContext,
    config: AlgorithmConfiguration
  ): Promise<PatternAssignment> {
    
    const assignments: PatternAssignment = {};
    this.WORK_PATTERNS.forEach(pattern => {
      assignments[pattern.name] = { pattern, analysts: [] };
    });

    // Collect constraint preferences for each analyst
    const analystPreferences = await this.analyzeAnalystConstraints(analysts, context);

    // Sort analysts by constraint flexibility (most constrained first)
    const sortedAnalysts = analysts.sort((a, b) => {
      const aConstraints = analystPreferences[a.id]?.constraintCount || 0;
      const bConstraints = analystPreferences[b.id]?.constraintCount || 0;
      return bConstraints - aConstraints; // Most constrained first
    });

    // Assign most constrained analysts first to patterns that work for them
    for (const analyst of sortedAnalysts) {
      const preferences = analystPreferences[analyst.id];
      const bestPattern = this.findBestPatternForAnalyst(analyst, preferences, assignments);
      
      if (bestPattern) {
        assignments[bestPattern].analysts.push(analyst);
      } else {
        // Fallback: assign to least populated pattern
        const leastPopulated = this.findLeastPopulatedPattern(assignments);
        assignments[leastPopulated].analysts.push(analyst);
      }
    }

    return assignments;
  }

  /**
   * Rotate pattern assignments for next week
   */
  async rotatePatterns(
    currentAssignments: PatternAssignment,
    strategy: string,
    context?: WeekendRotationContext,
    config?: AlgorithmConfiguration
  ): Promise<PatternAssignment> {
    
    const newAssignments: PatternAssignment = {};
    this.WORK_PATTERNS.forEach(pattern => {
      newAssignments[pattern.name] = { pattern, analysts: [] };
    });

    if (strategy === 'FAIRNESS_OPTIMIZED' && context && config) {
      // For fairness optimization, recalculate optimal assignments each week
      return this.fairnessOptimizedRotation(
        Object.values(currentAssignments).flatMap(a => a.analysts),
        context,
        config
      );
    } else if (strategy === 'CONSTRAINT_AWARE' && context && config) {
      // For constraint-aware, consider evolving constraints
      return await this.constraintAwareRotation(
        Object.values(currentAssignments).flatMap(a => a.analysts),
        context,
        config
      );
    } else {
      // SEQUENTIAL: Use standard nextPattern rotation
      for (const patternName in currentAssignments) {
        const assignment = currentAssignments[patternName];
        const nextPatternName = assignment.pattern.nextPattern;
        newAssignments[nextPatternName].analysts.push(...assignment.analysts);
      }
    }

    return newAssignments;
  }

  /**
   * Calculate weekend fairness metrics for analysts
   */
  private calculateWeekendFairness(
    analysts: Analyst[], 
    context: WeekendRotationContext
  ): FairnessAnalysis[] {
    
    return analysts.map(analyst => {
      // In a real implementation, this would query historical data
      // For now, return mock analysis
      const weekendWorkload = Math.floor(Math.random() * 10); // Mock weekend shifts
      const totalWorkload = Math.floor(Math.random() * 20) + 15; // Mock total shifts
      const weekendRatio = weekendWorkload / totalWorkload;
      
      return {
        analystId: analyst.id,
        weekendWorkload,
        totalWorkload,
        weekendRatio,
        fairnessScore: 1.0 - Math.abs(weekendRatio - 0.2) // Target 20% weekend work
      };
    });
  }

  /**
   * Analyze analyst constraints for pattern assignment
   */
  private async analyzeAnalystConstraints(
    analysts: Analyst[], 
    context: WeekendRotationContext
  ): Promise<{ [analystId: string]: { constraintCount: number; preferredPatterns: string[]; avoidedPatterns: string[] } }> {
    
    const preferences: any = {};
    
    for (const analyst of analysts) {
      const constraints = await constraintHierarchy.resolveConstraints({
        date: context.startDate,
        analystId: analyst.id
      });

      // Analyze constraints to determine pattern preferences
      const constraintCount = constraints.length;
      const preferredPatterns: string[] = [];
      const avoidedPatterns: string[] = [];

      // Basic constraint analysis (can be expanded)
      for (const constraint of constraints) {
        if (constraint.constraint.type === 'BLACKOUT_DATE') {
          // If analyst has weekend blackouts, avoid weekend patterns
          avoidedPatterns.push('SUN_THU', 'TUE_SAT');
        }
      }

      preferences[analyst.id] = {
        constraintCount,
        preferredPatterns,
        avoidedPatterns
      };
    }

    return preferences;
  }

  /**
   * Find best pattern for analyst based on constraints
   */
  private findBestPatternForAnalyst(
    analyst: Analyst,
    preferences: any,
    currentAssignments: PatternAssignment
  ): string | null {
    
    // Avoid patterns that conflict with constraints
    const availablePatterns = this.WORK_PATTERNS
      .filter(pattern => !preferences.avoidedPatterns.includes(pattern.name))
      .map(pattern => pattern.name);

    if (availablePatterns.length === 0) {
      return null; // No suitable patterns
    }

    // Prefer patterns analyst explicitly prefers
    const preferredAvailable = availablePatterns.filter(pattern => 
      preferences.preferredPatterns.includes(pattern)
    );

    if (preferredAvailable.length > 0) {
      // Return least populated preferred pattern
      return preferredAvailable.sort((a, b) => 
        currentAssignments[a].analysts.length - currentAssignments[b].analysts.length
      )[0];
    }

    // Return least populated available pattern
    return availablePatterns.sort((a, b) => 
      currentAssignments[a].analysts.length - currentAssignments[b].analysts.length
    )[0];
  }

  /**
   * Helper methods
   */
  private getAverageWeekendWorkload(analysis: FairnessAnalysis[]): number {
    const total = analysis.reduce((sum, a) => sum + a.weekendWorkload, 0);
    return total / analysis.length;
  }

  private findLeastPopulatedPattern(assignments: PatternAssignment): string {
    return Object.keys(assignments).sort((a, b) => 
      assignments[a].analysts.length - assignments[b].analysts.length
    )[0];
  }

  private balancePatternAssignments(assignments: PatternAssignment): PatternAssignment {
    // Basic balancing to ensure no pattern is severely under/over-populated
    const totalAnalysts = Object.values(assignments).reduce((sum, a) => sum + a.analysts.length, 0);
    const targetPerPattern = Math.ceil(totalAnalysts / this.WORK_PATTERNS.length);

    // Redistribute if any pattern is too far from target
    const overPopulated = Object.entries(assignments).filter(([_, a]) => a.analysts.length > targetPerPattern + 1);
    const underPopulated = Object.entries(assignments).filter(([_, a]) => a.analysts.length < targetPerPattern - 1);

    // Simple redistribution (can be made more sophisticated)
    while (overPopulated.length > 0 && underPopulated.length > 0) {
      const [overPattern, overAssignment] = overPopulated[0];
      const [underPattern, underAssignment] = underPopulated[0];

      if (overAssignment.analysts.length > 0) {
        const analystToMove = overAssignment.analysts.pop()!;
        underAssignment.analysts.push(analystToMove);
      }

      // Update lists
      if (overAssignment.analysts.length <= targetPerPattern + 1) {
        overPopulated.shift();
      }
      if (underAssignment.analysts.length >= targetPerPattern - 1) {
        underPopulated.shift();
      }
    }

    return assignments;
  }
}

// Export singleton instance
export const weekendRotationEngine = new WeekendRotationEngine();