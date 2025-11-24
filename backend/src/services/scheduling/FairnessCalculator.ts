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

interface FairnessWeightsConfig {
  fairnessWeights: {
    weekendPenalty: number;
    timeBonus: number;
    balanceBonus: number;
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
          maxBalanceBonus: 30
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
   * Calculate fairness scores for analysts to determine who should enter weekend rotation
   * 
   * @param analysts Array of analysts
   * @param historicalSchedules Array of historical schedules
   * @param currentDate Current date for time-based calculations
   * @returns Map of analyst IDs to fairness scores (higher score = more fair to select)
   */
  calculateRotationFairnessScores(
    analysts: any[],
    historicalSchedules: any[],
    currentDate: Date
  ): Map<string, number> {
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
      const scheduleDate = new Date(schedule.date);
      const dayOfWeek = scheduleDate.getDay();
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
        const currentLastDate = lastRotationDate.get(analystId) || new Date(0);
        if (scheduleDate > currentLastDate) {
          lastRotationDate.set(analystId, scheduleDate);
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
      score += weights.weekendPenalty - Math.min(weekendDays * factors.weekendDaysMultiplier, weights.maxWeekendPenalty);

      // Factor 2: Time since last rotation (more time = higher score)
      const lastRotation = lastRotationDate.get(analyst.id) || new Date(0);
      const daysSinceLastRotation = Math.floor((currentDate.getTime() - lastRotation.getTime()) / (1000 * 60 * 60 * 24));
      score += Math.min(daysSinceLastRotation / factors.timeDivisor, weights.maxTimeBonus);

      // Factor 3: Balance between Saturday and Sunday (more balanced = higher score)
      const saturdays = saturdaysWorked.get(analyst.id) || 0;
      const sundays = sundaysWorked.get(analyst.id) || 0;
      const totalWeekendDays = saturdays + sundays;

      if (totalWeekendDays > 0) {
        const balanceRatio = Math.min(saturdays, sundays) / Math.max(saturdays, sundays);
        score += balanceRatio * weights.maxBalanceBonus;
      } else {
        score += weights.maxBalanceBonus; // Max bonus for no history (new analyst)
      }

      // Store final score
      fairnessScores.set(analyst.id, score);
    });

    return fairnessScores;
  }

  /**
   * Select the next analyst to enter rotation based on fairness scores
   * 
   * @param analysts Array of analysts
   * @param fairnessScores Map of analyst IDs to fairness scores
   * @param unavailableAnalystIds Set of analyst IDs who are unavailable
   * @returns The selected analyst or null if none available
   */
  selectNextAnalystForRotation(
    analysts: any[],
    fairnessScores: Map<string, number>,
    unavailableAnalystIds: Set<string> = new Set()
  ): any | null {
    // Filter out unavailable analysts
    const availableAnalysts = analysts.filter(a => !unavailableAnalystIds.has(a.id));

    if (availableAnalysts.length === 0) {
      return null;
    }

    // Sort by fairness score (highest first)
    availableAnalysts.sort((a, b) => {
      const scoreA = fairnessScores.get(a.id) || 0;
      const scoreB = fairnessScores.get(b.id) || 0;
      return scoreB - scoreA;
    });

    // Return the analyst with the highest fairness score
    return availableAnalysts[0];
  }
}

export const fairnessCalculator = new FairnessCalculator();
