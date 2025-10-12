/**
 * AnalystPoolManager - Manages staggered two-analyst rotation state
 * 
 * Core Responsibility:
 * - Track TWO analysts in rotation simultaneously (staggered phases)
 * - Manage analyst pools for fair rotation (available → in-rotation → completed)
 * - Handle cycle resets when all analysts complete rotation
 * 
 * Rotation Pattern:
 * - Week 1 Analyst: Sun-Thu (Friday comp-off)
 * - Week 2 Analyst: Tue-Sat (Monday comp-off)
 * - When Week 1 finishes Thursday → transitions to Week 2, NEW analyst enters Week 1
 * - When Week 2 finishes Saturday → transitions to Week 3 (Mon-Fri regular)
 * - When Week 3 finishes Friday → moves to completedPool
 */

import { prisma } from '../../lib/prisma';
import { fairnessCalculator } from './FairnessCalculator';

export interface RotationAnalyst {
  id: string;
  weekInCycle: 1 | 2 | 3;
  cycleStartDate: Date;
}

export interface RotationState {
  id: string;
  algorithmType: string;
  shiftType: 'MORNING' | 'EVENING';
  
  // TWO analysts in staggered rotation
  currentSunThuAnalyst: RotationAnalyst | null;  // Week 1
  currentTueSatAnalyst: RotationAnalyst | null;  // Week 2
  
  // Pool management
  availablePool: string[];
  completedPool: string[];
  cycleGeneration: number;
  
  lastUpdated: Date;
}

export class AnalystPoolManager {
  private algorithmType: string;
  
  constructor(algorithmType: string) {
    this.algorithmType = algorithmType;
  }
  
  /**
   * Initialize or load rotation state for a shift type
   */
  async loadRotationState(
    shiftType: 'MORNING' | 'EVENING',
    allAnalysts: any[]
  ): Promise<RotationState> {
    // Try to find existing state
    const existing = await prisma.rotationState.findUnique({
      where: {
        algorithmType_shiftType: {
          algorithmType: this.algorithmType,
          shiftType
        }
      }
    });
    
    if (existing) {
      return this.mapFromDatabase(existing);
    }
    
    // Initialize new state
    const shiftAnalysts = allAnalysts.filter(a => a.shiftType === shiftType && a.isActive);
    const availablePool = shiftAnalysts.map(a => a.id);
    
    const newState = await prisma.rotationState.create({
      data: {
        algorithmType: this.algorithmType,
        shiftType,
        currentSunThuAnalyst: null,
        sunThuStartDate: null,
        currentTueSatAnalyst: null,
        tueSatStartDate: null,
        availablePool: JSON.stringify(availablePool),
        completedPool: JSON.stringify([]),
        cycleGeneration: 0,
        lastUpdated: new Date()
      }
    });
    
    return this.mapFromDatabase(newState);
  }
  
  /**
   * Select next analyst from available pool
   */
  async selectNextAnalyst(
    state: RotationState,
    allAnalysts: any[],
    historicalSchedules: any[] = []
  ): Promise<string | null> {
    // If available pool is empty, reset cycle
    if (state.availablePool.length === 0) {
      state.availablePool = [...state.completedPool];
      state.completedPool = [];
      state.cycleGeneration++;
      console.log(`🔄 Rotation cycle ${state.cycleGeneration} started for ${state.shiftType}`);
    }
    
    if (state.availablePool.length === 0) {
      console.error(`No analysts available for ${state.shiftType} rotation`);
      return null;
    }
    
    // Get analysts who are still in available pool
    const availableAnalysts = allAnalysts.filter(a => 
      state.availablePool.includes(a.id) && a.isActive
    );
    
    if (availableAnalysts.length === 0) {
      console.error(`No active analysts in available pool for ${state.shiftType}`);
      return null;
    }
    
    // Use fairness calculator to select best candidate
    const fairnessScores = fairnessCalculator.calculateRotationFairnessScores(
      availableAnalysts,
      historicalSchedules,
      new Date()
    );
    
    const selectedAnalyst = fairnessCalculator.selectNextAnalystForRotation(
      availableAnalysts,
      fairnessScores
    );
    
    if (!selectedAnalyst) {
      console.error(`Failed to select analyst from pool for ${state.shiftType}`);
      return null;
    }
    
    // Remove from available pool
    state.availablePool = state.availablePool.filter(id => id !== selectedAnalyst.id);
    
    console.log(`✅ Selected ${selectedAnalyst.name} for ${state.shiftType} rotation (Week 1: Sun-Thu)`);
    
    return selectedAnalyst.id;
  }
  
  /**
   * Check if analyst should work on a specific date based on their rotation
   */
  isAnalystWorking(
    analyst: RotationAnalyst | null,
    date: Date
  ): boolean {
    if (!analyst) return false;
    
    const dayOfWeek = date.getDay(); // 0=Sun, 1=Mon, ..., 6=Sat
    
    switch (analyst.weekInCycle) {
      case 1: // Sun-Thu pattern
        return [0, 1, 2, 3, 4].includes(dayOfWeek);
      
      case 2: // Tue-Sat pattern
        return [2, 3, 4, 5, 6].includes(dayOfWeek);
      
      case 3: // Mon-Fri pattern (regular)
        return [1, 2, 3, 4, 5].includes(dayOfWeek);
      
      default:
        return false;
    }
  }
  
  /**
   * Check if analyst should get auto comp-off on a specific date
   */
  shouldGetCompOff(
    analyst: RotationAnalyst | null,
    date: Date
  ): boolean {
    if (!analyst) return false;
    
    const dayOfWeek = date.getDay();
    
    // Week 1 (Sun-Thu): Friday comp-off
    if (analyst.weekInCycle === 1 && dayOfWeek === 5) {
      return true;
    }
    
    // Week 2 (Tue-Sat): Monday comp-off
    if (analyst.weekInCycle === 2 && dayOfWeek === 1) {
      return true;
    }
    
    return false;
  }
  
  /**
   * Advance rotation state for new calendar week
   */
  async advanceRotation(
    state: RotationState,
    currentWeekStart: Date,
    allAnalysts: any[],
    historicalSchedules: any[] = []
  ): Promise<void> {
    let stateChanged = false;
    
    // Check if Week 1 analyst (Sun-Thu) needs to transition to Week 2
    if (state.currentSunThuAnalyst) {
      const weeksSinceStart = Math.floor(
        (currentWeekStart.getTime() - state.currentSunThuAnalyst.cycleStartDate.getTime()) / 
        (7 * 24 * 60 * 60 * 1000)
      );
      
      // After 1 week in Sun-Thu, move to Tue-Sat
      if (weeksSinceStart >= 1) {
        console.log(`🔄 Analyst ${state.currentSunThuAnalyst.id} transitioning Week 1 → Week 2`);
        state.currentTueSatAnalyst = {
          id: state.currentSunThuAnalyst.id,
          weekInCycle: 2,
          cycleStartDate: state.currentSunThuAnalyst.cycleStartDate
        };
        state.currentSunThuAnalyst = null;
        stateChanged = true;
      }
    }
    
    // Check if Week 2 analyst (Tue-Sat) needs to transition to Week 3
    if (state.currentTueSatAnalyst) {
      const weeksSinceStart = Math.floor(
        (currentWeekStart.getTime() - state.currentTueSatAnalyst.cycleStartDate.getTime()) / 
        (7 * 24 * 60 * 60 * 1000)
      );
      
      // After 2 weeks total (Week 1 + Week 2), move to Week 3 (regular Mon-Fri)
      if (weeksSinceStart >= 2) {
        console.log(`🔄 Analyst ${state.currentTueSatAnalyst.id} transitioning Week 2 → Week 3 (completing rotation)`);
        state.completedPool.push(state.currentTueSatAnalyst.id);
        state.currentTueSatAnalyst = null;
        stateChanged = true;
      }
    }
    
    // If Week 1 slot is empty, assign new analyst
    if (!state.currentSunThuAnalyst) {
      const nextAnalystId = await this.selectNextAnalyst(state, allAnalysts, historicalSchedules);
      if (nextAnalystId) {
        state.currentSunThuAnalyst = {
          id: nextAnalystId,
          weekInCycle: 1,
          cycleStartDate: new Date(currentWeekStart)
        };
        stateChanged = true;
        console.log(`✨ New analyst ${nextAnalystId} entering Week 1 (Sun-Thu) rotation`);
      }
    }
    
    // Save state if changed
    if (stateChanged) {
      await this.saveRotationState(state);
    }
  }
  
  /**
   * Get the work pattern for an analyst on a specific date
   */
  getWorkPattern(analystId: string, date: Date, state: RotationState): string | null {
    // Check if analyst is in Week 1 (Sun-Thu)
    if (state.currentSunThuAnalyst?.id === analystId) {
      return 'SUN_THU';
    }
    
    // Check if analyst is in Week 2 (Tue-Sat)
    if (state.currentTueSatAnalyst?.id === analystId) {
      return 'TUE_SAT';
    }
    
    // Check if analyst recently completed (Week 3) - they're on Mon-Fri
    if (state.completedPool.includes(analystId)) {
      const dayOfWeek = date.getDay();
      if ([1, 2, 3, 4, 5].includes(dayOfWeek)) {
        return 'MON_FRI';
      }
    }
    
    // Regular analysts work Mon-Fri
    const dayOfWeek = date.getDay();
    if ([1, 2, 3, 4, 5].includes(dayOfWeek)) {
      return 'MON_FRI';
    }
    
    return null;
  }
  
  /**
   * Save rotation state to database
   */
  async saveRotationState(state: RotationState): Promise<void> {
    await prisma.rotationState.upsert({
      where: {
        algorithmType_shiftType: {
          algorithmType: state.algorithmType,
          shiftType: state.shiftType
        }
      },
      update: {
        currentSunThuAnalyst: state.currentSunThuAnalyst?.id || null,
        sunThuStartDate: state.currentSunThuAnalyst?.cycleStartDate || null,
        currentTueSatAnalyst: state.currentTueSatAnalyst?.id || null,
        tueSatStartDate: state.currentTueSatAnalyst?.cycleStartDate || null,
        availablePool: JSON.stringify(state.availablePool),
        completedPool: JSON.stringify(state.completedPool),
        cycleGeneration: state.cycleGeneration,
        lastUpdated: new Date()
      },
      create: {
        algorithmType: state.algorithmType,
        shiftType: state.shiftType,
        currentSunThuAnalyst: state.currentSunThuAnalyst?.id || null,
        sunThuStartDate: state.currentSunThuAnalyst?.cycleStartDate || null,
        currentTueSatAnalyst: state.currentTueSatAnalyst?.id || null,
        tueSatStartDate: state.currentTueSatAnalyst?.cycleStartDate || null,
        availablePool: JSON.stringify(state.availablePool),
        completedPool: JSON.stringify(state.completedPool),
        cycleGeneration: state.cycleGeneration,
        lastUpdated: new Date()
      }
    });
  }
  
  /**
   * Map database model to internal state
   */
  private mapFromDatabase(dbState: any): RotationState {
    let currentSunThuAnalyst: RotationAnalyst | null = null;
    if (dbState.currentSunThuAnalyst && dbState.sunThuStartDate) {
      currentSunThuAnalyst = {
        id: dbState.currentSunThuAnalyst,
        weekInCycle: 1,
        cycleStartDate: new Date(dbState.sunThuStartDate)
      };
    }
    
    let currentTueSatAnalyst: RotationAnalyst | null = null;
    if (dbState.currentTueSatAnalyst && dbState.tueSatStartDate) {
      currentTueSatAnalyst = {
        id: dbState.currentTueSatAnalyst,
        weekInCycle: 2,
        cycleStartDate: new Date(dbState.tueSatStartDate)
      };
    }
    
    return {
      id: dbState.id,
      algorithmType: dbState.algorithmType,
      shiftType: dbState.shiftType as 'MORNING' | 'EVENING',
      currentSunThuAnalyst,
      currentTueSatAnalyst,
      availablePool: JSON.parse(dbState.availablePool || '[]'),
      completedPool: JSON.parse(dbState.completedPool || '[]'),
      cycleGeneration: dbState.cycleGeneration || 0,
      lastUpdated: new Date(dbState.lastUpdated)
    };
  }
}

