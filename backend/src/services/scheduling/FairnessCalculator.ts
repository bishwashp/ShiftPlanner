/**
 * FairnessCalculator - Utility for calculating fairness scores for analyst rotation selection
 * 
 * This service calculates fairness scores based on:
 * - Total weekend days worked historically
 * - Time since last rotation
 * - Distribution of Saturday vs Sunday assignments
 * - Other fairness metrics
 */

export class FairnessCalculator {
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
    
    // Calculate fairness scores
    analysts.forEach(analyst => {
      let score = 0;
      
      // Factor 1: Fewer weekend days worked = higher score
      const weekendDays = weekendDaysWorked.get(analyst.id) || 0;
      score += 100 - Math.min(weekendDays * 2, 100); // Max penalty of 100
      
      // Factor 2: Time since last rotation (more time = higher score)
      const lastRotation = lastRotationDate.get(analyst.id) || new Date(0);
      const daysSinceLastRotation = Math.floor((currentDate.getTime() - lastRotation.getTime()) / (1000 * 60 * 60 * 24));
      score += Math.min(daysSinceLastRotation / 7, 50); // Max bonus of 50 (after ~1 year)
      
      // Factor 3: Balance between Saturday and Sunday (more balanced = higher score)
      const saturdays = saturdaysWorked.get(analyst.id) || 0;
      const sundays = sundaysWorked.get(analyst.id) || 0;
      const totalWeekendDays = saturdays + sundays;
      
      if (totalWeekendDays > 0) {
        const balanceRatio = Math.min(saturdays, sundays) / Math.max(saturdays, sundays);
        score += balanceRatio * 30; // Max bonus of 30 for perfect balance
      } else {
        score += 30; // Max bonus for no history (new analyst)
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
