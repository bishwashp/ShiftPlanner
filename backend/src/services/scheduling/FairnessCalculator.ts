/**
 * FairnessCalculator - Utility for calculating fairness scores for analyst rotation selection
 * 
 * This service calculates fairness scores based on:
 * - Total weekend days worked historically
 * - Time since last rotation
 * - Distribution of Saturday vs Sunday assignments
 * - Other fairness metrics
 */

import * as fs from 'fs';
import * as path from 'path';
import moment from 'moment-timezone';
import { DateUtils } from '../../utils/dateUtils';

interface FairnessWeightsConfig {
  fairnessWeights: {
    weekendPenalty: number;
    timeBonus: number;
    balanceBonus: number;
    continuityBonus: number; // NEW: Bonus for working contiguous pattern (e.g. Sat -> Sun)
    maxWeekendPenalty: number;
    maxTimeBonus: number;
    maxBalanceBonus: number;
  };
  scoringFactors: {
    weekendDaysMultiplier: number;
    timeDivisor: number;
    description: string;
  };
}

export class FairnessCalculator {
  private config: FairnessWeightsConfig | null = null;
  private configLoaded: boolean = false;

  /**
   * Load fairness weights from config file
   * Config is cached in memory after first load
   */
  private loadConfig(): void {
    if (this.configLoaded) {
      return; // Already loaded, use cached config
    }

    try {
      const configPath = path.join(__dirname, '../../../config/fairness-weights.json');
      const configData = fs.readFileSync(configPath, 'utf-8');
      this.config = JSON.parse(configData);
      this.configLoaded = true;
      console.log('✓ Loaded fairness weights from config');
    } catch (error) {
      console.warn('⚠️  Failed to load fairness weights config, using defaults:', error);
      // Fallback to hardcoded defaults
      this.config = {
        fairnessWeights: {
          weekendPenalty: 100,
          timeBonus: 50,
          balanceBonus: 30,
          maxWeekendPenalty: 100,
          maxTimeBonus: 50,
          maxBalanceBonus: 30,
          continuityBonus: 5000 // Massive bonus to override recency penalty
        },
        scoringFactors: {
          weekendDaysMultiplier: 2,
          timeDivisor: 7,
          description: 'Default scoring factors'
        }
      };
      this.configLoaded = true;
    }
  }

  /**
   * Calculate fairness scores and track last rotation dates
   */
  calculateRotationFairnessScores(
    analysts: any[],
    historicalSchedules: any[],
    currentDate: Date
  ): { scores: Map<string, number>; lastRotationDates: Map<string, Date> } {
    // Load config before calculating
    this.loadConfig();

    const fairnessScores = new Map<string, number>();
    const weekendDaysWorked = new Map<string, number>();
    const saturdaysWorked = new Map<string, number>();
    const sundaysWorked = new Map<string, number>();
    const lastRotationDate = new Map<string, Date>();

    // Initialize maps
    analysts.forEach(analyst => {
      weekendDaysWorked.set(analyst.id, 0);
      saturdaysWorked.set(analyst.id, 0);
      sundaysWorked.set(analyst.id, 0);
      lastRotationDate.set(analyst.id, new Date(0)); // Default to epoch
    });

    // Calculate historical metrics
    historicalSchedules.forEach(schedule => {
      const scheduleDate = moment.utc(schedule.date);
      const dayOfWeek = scheduleDate.day();
      const analystId = schedule.analystId;

      // Skip if analyst not in our list
      if (!weekendDaysWorked.has(analystId)) return;

      // Track weekend days
      if (dayOfWeek === 0 || dayOfWeek === 6) {
        weekendDaysWorked.set(analystId, (weekendDaysWorked.get(analystId) || 0) + 1);

        // Track specific weekend days
        if (dayOfWeek === 6) { // Saturday
          saturdaysWorked.set(analystId, (saturdaysWorked.get(analystId) || 0) + 1);
        } else { // Sunday
          sundaysWorked.set(analystId, (sundaysWorked.get(analystId) || 0) + 1);
        }

        // Update last rotation date if newer
        const currentLastDate = moment.utc(lastRotationDate.get(analystId) || 0);
        if (scheduleDate.isAfter(currentLastDate)) {
          lastRotationDate.set(analystId, scheduleDate.toDate());
        }
      }
    });

    // Get weights from config
    const weights = this.config!.fairnessWeights;
    const factors = this.config!.scoringFactors;

    // Calculate fairness scores
    analysts.forEach(analyst => {
      let score = 0;

      // Factor 1: Fewer weekend days worked = higher score
      const weekendDays = weekendDaysWorked.get(analyst.id) || 0;
      score += weights.weekendPenalty - (weekendDays * factors.weekendDaysMultiplier);

      // Factor 2: Time since last rotation (more time = higher score)
      const lastRotation = lastRotationDate.get(analyst.id) || new Date(0);
      const daysSinceLastRotation = Math.max(0, moment.utc(currentDate).diff(moment.utc(lastRotation), 'days'));

      // STRICT RECENCY PENALTY: Prevent consecutive weekend assignments
      if (daysSinceLastRotation < 14) {
        score -= 2000;
      }

      score += Math.min(daysSinceLastRotation / factors.timeDivisor, weights.maxTimeBonus);

      // Factor 3: Balance between Saturday and Sunday
      const saturdays = saturdaysWorked.get(analyst.id) || 0;
      const sundays = sundaysWorked.get(analyst.id) || 0;
      const totalWeekendDays = saturdays + sundays;

      if (totalWeekendDays > 0) {
        const balanceRatio = Math.min(saturdays, sundays) / Math.max(saturdays, sundays);
        score += balanceRatio * weights.maxBalanceBonus;
      } else {
        score += weights.maxBalanceBonus; // Max bonus for no history
      }

      // Factor 4: Continuity Bonus
      // If analyst worked YESTERDAY (and it was Saturday), they are likely in a TUE-SAT -> SUN-THU flow.
      const yesterday = moment.utc(currentDate).subtract(1, 'days');
      if (lastRotation.getTime() === yesterday.toDate().getTime()) {
        const yesterdayDay = yesterday.day();
        const todayDay = moment.utc(currentDate).day();

        if (yesterdayDay === 6 && todayDay === 0) {
          console.log(`🔗 CONTINUITY BONUS for ${analyst.name}: Worked Sat, needs Sun.`);
          score += (weights.continuityBonus || 5000);
        }
      }

      fairnessScores.set(analyst.id, score);
    });

    return { scores: fairnessScores, lastRotationDates: lastRotationDate };
  }

  /**
   * Select the next analyst to enter rotation based on Strict LRU (Least Recently Used)
   */
  selectNextAnalystForRotation(
    analysts: any[],
    fairnessData: { scores: Map<string, number>; lastRotationDates: Map<string, Date> },
    unavailableAnalystIds: Set<string> = new Set()
  ): any | null {
    const availableAnalysts = analysts.filter(a => !unavailableAnalystIds.has(a.id));

    if (availableAnalysts.length === 0) {
      return null;
    }

    availableAnalysts.sort((a, b) => {
      const dateA = fairnessData.lastRotationDates.get(a.id) || new Date(0);
      const dateB = fairnessData.lastRotationDates.get(b.id) || new Date(0);

      if (dateA.getTime() !== dateB.getTime()) {
        return dateA.getTime() - dateB.getTime(); // Oldest date first
      }

      const scoreA = fairnessData.scores.get(a.id) || 0;
      const scoreB = fairnessData.scores.get(b.id) || 0;
      return scoreB - scoreA;
    });

    return availableAnalysts[0];
  }

  /**
   * Calculate fairness scores for AM to PM rotation
   */
  calculateAMToPMFairnessScores(
    analysts: any[],
    historicalSchedules: any[],
    currentDate: Date
  ): { scores: Map<string, number>; lastPMRotationDates: Map<string, Date> } {
    const fairnessScores = new Map<string, number>();
    const pmShiftsWorked = new Map<string, number>();
    const lastPMRotationDate = new Map<string, Date>();

    analysts.forEach(analyst => {
      pmShiftsWorked.set(analyst.id, 0);
      lastPMRotationDate.set(analyst.id, new Date(0));
    });

    historicalSchedules.forEach(schedule => {
      const scheduleDate = moment.utc(schedule.date);
      const analystId = schedule.analystId;

      if (!pmShiftsWorked.has(analystId)) return;

      if (schedule.shiftType === 'PM' || schedule.shiftType === 'EVENING') {
        pmShiftsWorked.set(analystId, (pmShiftsWorked.get(analystId) || 0) + 1);

        const currentLastDate = moment.utc(lastPMRotationDate.get(analystId) || 0);
        if (scheduleDate.isAfter(currentLastDate)) {
          lastPMRotationDate.set(analystId, scheduleDate.toDate());
        }
      }
    });

    analysts.forEach(analyst => {
      let score = 0;
      const shifts = pmShiftsWorked.get(analyst.id) || 0;
      score += 100 - (shifts * 10);

      const lastRotation = lastPMRotationDate.get(analyst.id) || new Date(0);
      const daysSince = Math.max(0, moment.utc(currentDate).diff(moment.utc(lastRotation), 'days'));

      if (daysSince < 7) {
        score -= 1000;
      }

      score += Math.min(daysSince, 50);
      fairnessScores.set(analyst.id, score);
    });

    return { scores: fairnessScores, lastPMRotationDates: lastPMRotationDate };
  }

  /**
   * Select multiple analysts for AM to PM rotation
   */
  selectNextAnalystsForAMToPMRotation(
    analysts: any[],
    fairnessData: { scores: Map<string, number>; lastPMRotationDates: Map<string, Date> },
    count: number,
    unavailableAnalystIds: Set<string> = new Set()
  ): any[] {
    const availableAnalysts = analysts.filter(a => !unavailableAnalystIds.has(a.id));

    if (availableAnalysts.length === 0) return [];

    availableAnalysts.sort((a, b) => {
      const scoreA = fairnessData.scores.get(a.id) || 0;
      const scoreB = fairnessData.scores.get(b.id) || 0;

      if (Math.abs(scoreA - scoreB) > 1) { // Significant difference
        return scoreB - scoreA;
      }

      const dateA = fairnessData.lastPMRotationDates.get(a.id) || new Date(0);
      const dateB = fairnessData.lastPMRotationDates.get(b.id) || new Date(0);
      return dateA.getTime() - dateB.getTime();
    });

    return availableAnalysts.slice(0, count);
  }
}

export const fairnessCalculator = new FairnessCalculator();
