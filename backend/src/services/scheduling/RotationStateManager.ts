import { prisma } from '../../lib/prisma';
import { fairnessCalculator } from './FairnessCalculator';

export interface RotationState {
  id: string;
  algorithmType: string;
  shiftType: 'MORNING' | 'EVENING';
  currentSunThuAnalyst: string | null;
  currentTueSatAnalyst: string | null;
  completedAnalysts: string[];
  inProgressAnalysts: string[];
  rotationHistory: RotationHistory[];
  lastUpdated: Date;
  createdAt: Date;
}

export interface RotationHistory {
  analystId: string;
  startDate: Date;
  endDate: Date;
  pattern: 'SUN_THU' | 'TUE_SAT';
  cycleWeek: number; // 1, 2, or 3
  compOffEarned: number;
  isComplete: boolean;
  notes?: string;
}

export interface RotationAssignment {
  sunThuAnalyst: string;
  tueSatAnalyst: string;
  regularAnalysts: string[];
  weekNumber: number;
  startDate: Date;
  endDate: Date;
}

export interface RotationContinuity {
  algorithmType: string;
  shiftType: 'MORNING' | 'EVENING';
  lastGenerationDate: Date;
  currentState: RotationState;
  nextAssignments: RotationAssignment[];
  fairnessMetrics: {
    totalRotations: number;
    averageRotationGap: number;
    mostRecentRotation: Date | null;
    fairnessScore: number;
  };
}

export class RotationStateManager {
  
  /**
   * Get current rotation state for a shift type
   */
  async getCurrentRotationState(
    algorithmType: string,
    shiftType: 'MORNING' | 'EVENING'
  ): Promise<RotationState | null> {
    const state = await prisma.rotationState.findFirst({
      where: {
        algorithmType,
        shiftType
      },
      orderBy: { lastUpdated: 'desc' }
    });
    
    if (!state) {
      return null;
    }
    
    return this.mapRotationState(state);
  }

  /**
   * Initialize rotation state for a shift type
   */
  async initializeRotationState(
    algorithmType: string,
    shiftType: 'MORNING' | 'EVENING',
    analysts: any[],
    startDate: Date
  ): Promise<RotationState> {
    // Filter analysts by shift type
    const shiftAnalysts = analysts.filter(a => a.shiftType === shiftType && a.isActive);
    
    if (shiftAnalysts.length === 0) {
      throw new Error(`No active analysts found for shift type ${shiftType}`);
    }
    
    // Select first analysts based on fairness
    const fairnessScores = fairnessCalculator.calculateRotationFairnessScores(
      shiftAnalysts,
      [],
      startDate
    );
    
    const sunThuAnalyst = fairnessCalculator.selectNextAnalystForRotation(
      shiftAnalysts,
      fairnessScores
    );
    
    const tueSatAnalyst = fairnessCalculator.selectNextAnalystForRotation(
      shiftAnalysts.filter(a => a.id !== sunThuAnalyst?.id),
      fairnessScores
    );
    
    if (!sunThuAnalyst || !tueSatAnalyst) {
      throw new Error('Unable to select initial rotation analysts');
    }
    
    const state = await prisma.rotationState.create({
      data: {
        algorithmType,
        shiftType,
        currentSunThuAnalyst: sunThuAnalyst.id,
        currentTueSatAnalyst: tueSatAnalyst.id,
        completedAnalysts: JSON.stringify([]),
        inProgressAnalysts: JSON.stringify([sunThuAnalyst.id, tueSatAnalyst.id]),
        rotationHistory: JSON.stringify([]),
        lastUpdated: new Date()
      }
    });
    
    return this.mapRotationState(state);
  }

  /**
   * Update rotation state for next week
   */
  async updateRotationState(
    algorithmType: string,
    shiftType: 'MORNING' | 'EVENING',
    assignments: RotationAssignment,
    analysts: any[]
  ): Promise<RotationState> {
    const currentState = await this.getCurrentRotationState(algorithmType, shiftType);
    
    if (!currentState) {
      throw new Error(`No rotation state found for ${algorithmType} - ${shiftType}`);
    }
    
    // Update rotation history
    const newHistory = [...currentState.rotationHistory];
    
    // Add current week to history
    if (currentState.currentSunThuAnalyst) {
      newHistory.push({
        analystId: currentState.currentSunThuAnalyst,
        startDate: assignments.startDate,
        endDate: assignments.endDate,
        pattern: 'SUN_THU',
        cycleWeek: assignments.weekNumber,
        compOffEarned: 1, // Friday comp-off
        isComplete: assignments.weekNumber === 3,
        notes: `Week ${assignments.weekNumber} of rotation cycle`
      });
    }
    
    if (currentState.currentTueSatAnalyst) {
      newHistory.push({
        analystId: currentState.currentTueSatAnalyst,
        startDate: assignments.startDate,
        endDate: assignments.endDate,
        pattern: 'TUE_SAT',
        cycleWeek: assignments.weekNumber,
        compOffEarned: 1, // Monday comp-off
        isComplete: assignments.weekNumber === 3,
        notes: `Week ${assignments.weekNumber} of rotation cycle`
      });
    }
    
    // Determine next analysts
    let nextSunThuAnalyst = currentState.currentSunThuAnalyst;
    let nextTueSatAnalyst = currentState.currentTueSatAnalyst;
    let completedAnalysts = [...currentState.completedAnalysts];
    let inProgressAnalysts = [...currentState.inProgressAnalysts];
    
    // Check if current analysts have completed their cycle
    if (assignments.weekNumber === 3) {
      // Move completed analysts to completed list
      if (currentState.currentSunThuAnalyst && !completedAnalysts.includes(currentState.currentSunThuAnalyst)) {
        completedAnalysts.push(currentState.currentSunThuAnalyst);
      }
      if (currentState.currentTueSatAnalyst && !completedAnalysts.includes(currentState.currentTueSatAnalyst)) {
        completedAnalysts.push(currentState.currentTueSatAnalyst);
      }
      
      // Remove from in-progress
      inProgressAnalysts = inProgressAnalysts.filter(id => 
        id !== currentState.currentSunThuAnalyst && id !== currentState.currentTueSatAnalyst
      );
      
      // Select next analysts
      const shiftAnalysts = analysts.filter(a => a.shiftType === shiftType && a.isActive);
      const availableAnalysts = shiftAnalysts.filter(a => 
        !completedAnalysts.includes(a.id) && !inProgressAnalysts.includes(a.id)
      );
      
      if (availableAnalysts.length === 0) {
        // Reset rotation cycle
        completedAnalysts = [];
        const fairnessScores = fairnessCalculator.calculateRotationFairnessScores(
          shiftAnalysts,
          [],
          assignments.endDate
        );
        
        nextSunThuAnalyst = fairnessCalculator.selectNextAnalystForRotation(
          shiftAnalysts,
          fairnessScores
        )?.id || null;
        
        nextTueSatAnalyst = fairnessCalculator.selectNextAnalystForRotation(
          shiftAnalysts.filter(a => a.id !== nextSunThuAnalyst),
          fairnessScores
        )?.id || null;
        
        inProgressAnalysts = [nextSunThuAnalyst, nextTueSatAnalyst].filter(Boolean) as string[];
      } else {
        // Select next analysts from available pool
        const fairnessScores = fairnessCalculator.calculateRotationFairnessScores(
          availableAnalysts,
          [],
          assignments.endDate
        );
        
        nextSunThuAnalyst = fairnessCalculator.selectNextAnalystForRotation(
          availableAnalysts,
          fairnessScores
        )?.id || null;
        
        nextTueSatAnalyst = fairnessCalculator.selectNextAnalystForRotation(
          availableAnalysts.filter(a => a.id !== nextSunThuAnalyst),
          fairnessScores
        )?.id || null;
        
        inProgressAnalysts = [nextSunThuAnalyst, nextTueSatAnalyst].filter(Boolean) as string[];
      }
    }
    
    // Update rotation state
    const updatedState = await prisma.rotationState.update({
      where: { id: currentState.id },
      data: {
        currentSunThuAnalyst: nextSunThuAnalyst,
        currentTueSatAnalyst: nextTueSatAnalyst,
        completedAnalysts: JSON.stringify(completedAnalysts),
        inProgressAnalysts: JSON.stringify(inProgressAnalysts),
        rotationHistory: JSON.stringify(newHistory),
        lastUpdated: new Date()
      }
    });
    
    return this.mapRotationState(updatedState);
  }

  /**
   * Get rotation assignments for a specific week
   */
  async getRotationAssignments(
    algorithmType: string,
    shiftType: 'MORNING' | 'EVENING',
    weekStart: Date,
    analysts: any[]
  ): Promise<RotationAssignment> {
    let rotationState = await this.getCurrentRotationState(algorithmType, shiftType);
    
    // Initialize if no state exists
    if (!rotationState) {
      rotationState = await this.initializeRotationState(algorithmType, shiftType, analysts, weekStart);
    }
    
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    
    // Calculate week number in rotation cycle
    const weekNumber = this.calculateWeekNumber(rotationState, weekStart);
    
    // Get regular analysts (not in rotation)
    const shiftAnalysts = analysts.filter(a => a.shiftType === shiftType && a.isActive);
    const regularAnalysts = shiftAnalysts.filter(a => 
      a.id !== rotationState.currentSunThuAnalyst && 
      a.id !== rotationState.currentTueSatAnalyst
    ).map(a => a.id);
    
    return {
      sunThuAnalyst: rotationState.currentSunThuAnalyst!,
      tueSatAnalyst: rotationState.currentTueSatAnalyst!,
      regularAnalysts,
      weekNumber,
      startDate: weekStart,
      endDate: weekEnd
    };
  }

  /**
   * Get rotation continuity information
   */
  async getRotationContinuity(
    algorithmType: string,
    shiftType: 'MORNING' | 'EVENING'
  ): Promise<RotationContinuity | null> {
    const rotationState = await this.getCurrentRotationState(algorithmType, shiftType);
    
    if (!rotationState) {
      return null;
    }
    
    // Calculate fairness metrics
    const totalRotations = rotationState.rotationHistory.length;
    const averageRotationGap = this.calculateAverageRotationGap(rotationState.rotationHistory);
    const mostRecentRotation = rotationState.rotationHistory.length > 0 
      ? rotationState.rotationHistory[rotationState.rotationHistory.length - 1].endDate
      : null;
    
    const fairnessScore = this.calculateRotationFairnessScore(rotationState);
    
    return {
      algorithmType,
      shiftType,
      lastGenerationDate: rotationState.lastUpdated,
      currentState: rotationState,
      nextAssignments: [], // Would be populated based on current state
      fairnessMetrics: {
        totalRotations,
        averageRotationGap,
        mostRecentRotation,
        fairnessScore
      }
    };
  }

  /**
   * Calculate week number in rotation cycle
   */
  private calculateWeekNumber(rotationState: RotationState, weekStart: Date): number {
    // Find the most recent rotation start for current analysts
    const sunThuHistory = rotationState.rotationHistory
      .filter(h => h.analystId === rotationState.currentSunThuAnalyst)
      .sort((a, b) => b.startDate.getTime() - a.startDate.getTime());
    
    if (sunThuHistory.length === 0) {
      return 1; // First week of rotation
    }
    
    const lastRotation = sunThuHistory[0];
    const weeksSinceStart = Math.floor(
      (weekStart.getTime() - lastRotation.startDate.getTime()) / (1000 * 60 * 60 * 24 * 7)
    );
    
    return (weeksSinceStart % 3) + 1; // Cycle through 1, 2, 3
  }

  /**
   * Calculate average rotation gap
   */
  private calculateAverageRotationGap(history: RotationHistory[]): number {
    if (history.length < 2) {
      return 0;
    }
    
    const gaps: number[] = [];
    for (let i = 1; i < history.length; i++) {
      const gap = history[i].startDate.getTime() - history[i-1].endDate.getTime();
      gaps.push(gap / (1000 * 60 * 60 * 24)); // Convert to days
    }
    
    return gaps.reduce((sum, gap) => sum + gap, 0) / gaps.length;
  }

  /**
   * Calculate rotation fairness score
   */
  private calculateRotationFairnessScore(rotationState: RotationState): number {
    // Count rotations per analyst
    const rotationCounts: Record<string, number> = {};
    
    rotationState.rotationHistory.forEach(history => {
      rotationCounts[history.analystId] = (rotationCounts[history.analystId] || 0) + 1;
    });
    
    const counts = Object.values(rotationCounts);
    if (counts.length === 0) {
      return 1.0;
    }
    
    const average = counts.reduce((sum, count) => sum + count, 0) / counts.length;
    const variance = counts.reduce((sum, count) => sum + Math.pow(count - average, 2), 0) / counts.length;
    const standardDeviation = Math.sqrt(variance);
    
    // Convert to fairness score (lower standard deviation = higher fairness)
    return Math.max(0, 1 - (standardDeviation / average));
  }

  /**
   * Map database state to interface
   */
  private mapRotationState(state: any): RotationState {
    return {
      id: state.id,
      algorithmType: state.algorithmType,
      shiftType: state.shiftType,
      currentSunThuAnalyst: state.currentSunThuAnalyst,
      currentTueSatAnalyst: state.currentTueSatAnalyst,
      completedAnalysts: JSON.parse(state.completedAnalysts || '[]'),
      inProgressAnalysts: JSON.parse(state.inProgressAnalysts || '[]'),
      rotationHistory: JSON.parse(state.rotationHistory || '[]'),
      lastUpdated: state.lastUpdated,
      createdAt: state.createdAt
    };
  }

  /**
   * Reset rotation state (for testing or manual reset)
   */
  async resetRotationState(
    algorithmType: string,
    shiftType: 'MORNING' | 'EVENING'
  ): Promise<void> {
    await prisma.rotationState.deleteMany({
      where: {
        algorithmType,
        shiftType
      }
    });
  }

  /**
   * Get rotation statistics
   */
  async getRotationStatistics(
    algorithmType: string,
    shiftType: 'MORNING' | 'EVENING',
    startDate: Date,
    endDate: Date
  ): Promise<{
    totalRotations: number;
    completedCycles: number;
    averageCycleLength: number;
    analystParticipation: Record<string, number>;
    fairnessScore: number;
  }> {
    const rotationState = await this.getCurrentRotationState(algorithmType, shiftType);
    
    if (!rotationState) {
      return {
        totalRotations: 0,
        completedCycles: 0,
        averageCycleLength: 0,
        analystParticipation: {},
        fairnessScore: 0
      };
    }
    
    const relevantHistory = rotationState.rotationHistory.filter(h => 
      h.startDate >= startDate && h.endDate <= endDate
    );
    
    const totalRotations = relevantHistory.length;
    const completedCycles = relevantHistory.filter(h => h.isComplete).length;
    
    // Calculate average cycle length
    const cycleLengths: number[] = [];
    const analystCycles: Record<string, number[]> = {};
    
    relevantHistory.forEach(history => {
      if (!analystCycles[history.analystId]) {
        analystCycles[history.analystId] = [];
      }
      analystCycles[history.analystId].push(history.cycleWeek);
    });
    
    Object.values(analystCycles).forEach(cycles => {
      if (cycles.includes(3)) { // Complete cycle
        cycleLengths.push(3);
      }
    });
    
    const averageCycleLength = cycleLengths.length > 0 
      ? cycleLengths.reduce((sum, length) => sum + length, 0) / cycleLengths.length
      : 0;
    
    // Calculate analyst participation
    const analystParticipation: Record<string, number> = {};
    relevantHistory.forEach(history => {
      analystParticipation[history.analystId] = (analystParticipation[history.analystId] || 0) + 1;
    });
    
    const fairnessScore = this.calculateRotationFairnessScore(rotationState);
    
    return {
      totalRotations,
      completedCycles,
      averageCycleLength,
      analystParticipation,
      fairnessScore
    };
  }
}

export const rotationStateManager = new RotationStateManager();
