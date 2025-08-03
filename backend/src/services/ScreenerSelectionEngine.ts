import { Analyst, Schedule } from '../../generated/prisma';
import { AlgorithmConfiguration, SchedulingContext } from './scheduling/algorithms/types';
import { constraintHierarchy } from './ConstraintHierarchy';
import { randomizationService } from './RandomizationService';
import { algorithmAuditService } from './AlgorithmAuditService';

export interface ScreenerSelectionContext {
  date: Date;
  shiftType: 'MORNING' | 'EVENING';
  eligibleAnalysts: Analyst[];
  existingSchedules: Schedule[];
  isMajorEvent?: boolean;
  eventRequirements?: {
    requireFullTime?: boolean;
    requireExperience?: string;
    additionalScreeners?: number;
  };
}

export interface ScreenerAssignmentResult {
  selectedAnalyst: Analyst;
  reason: string;
  alternativeCandidates: Analyst[];
  selectionScore: number;
  auditSessionId?: string; // For audit tracking
}

export class ScreenerSelectionEngine {
  
  /**
   * Main method to select screener based on strategy
   */
  async selectScreener(
    context: ScreenerSelectionContext,
    strategy: string,
    config: AlgorithmConfiguration,
    auditSessionId?: string
  ): Promise<ScreenerAssignmentResult> {
    
    // Apply event-based constraints first
    const constrainedAnalysts = await this.applyEventConstraints(context);
    
    if (constrainedAnalysts.length === 0) {
      throw new Error(`No analysts meet event requirements for ${context.date.toISOString().split('T')[0]}`);
    }

    let result: ScreenerAssignmentResult;
    
    switch (strategy) {
      case 'ROUND_ROBIN':
        result = await this.roundRobinSelection(constrainedAnalysts, context, config);
        break;
      
      case 'EXPERIENCE_BASED':
        result = await this.experienceBasedSelection(constrainedAnalysts, context, config);
        break;
      
      case 'WORKLOAD_BALANCE':
        result = await this.workloadBalanceSelection(constrainedAnalysts, context, config);
        break;
      
      case 'SKILL_BASED':
        result = await this.skillBasedSelection(constrainedAnalysts, context, config);
        break;
      
      default:
        throw new Error(`Unknown screener assignment strategy: ${strategy}`);
    }

    // Record decision for audit
    if (auditSessionId) {
      await this.recordAuditDecision(auditSessionId, strategy, context, result, constrainedAnalysts);
      result.auditSessionId = auditSessionId;
    }

    return result;
  }

  /**
   * Apply event-based constraints to filter eligible analysts
   */
  private async applyEventConstraints(context: ScreenerSelectionContext): Promise<Analyst[]> {
    const constraints = await constraintHierarchy.resolveConstraints({
      date: context.date,
      shiftType: context.shiftType,
      isScreenerAssignment: true
    });

    let eligibleAnalysts = [...context.eligibleAnalysts];

    // Apply event constraints
    for (const constraint of constraints) {
      if (constraint.source === 'EVENT' && constraint.constraint.minimumCoverage) {
        eligibleAnalysts = this.filterByEventRequirements(
          eligibleAnalysts, 
          constraint.constraint.minimumCoverage
        );
      }
    }

    return eligibleAnalysts;
  }

  /**
   * Filter analysts by event requirements
   */
  private filterByEventRequirements(analysts: Analyst[], requirements: any): Analyst[] {
    if (requirements.noAdditionalConstraints || requirements.informational) {
      return analysts;
    }

    let filtered = analysts;

    // Handle OR conditions (analyst must meet at least one)
    if (requirements.or) {
      filtered = analysts.filter(analyst => {
        return requirements.or.some((req: any) => {
          return this.analystMeetsRequirement(analyst, req);
        });
      });
    }
    // Handle AND conditions (analyst must meet all)
    else if (requirements.and) {
      filtered = analysts.filter(analyst => {
        return requirements.and.every((req: any) => {
          return this.analystMeetsRequirement(analyst, req);
        });
      });
    }
    // Handle single requirement
    else {
      filtered = analysts.filter(analyst => {
        return this.analystMeetsRequirement(analyst, requirements);
      });
    }

    return filtered;
  }

  /**
   * Check if analyst meets a specific requirement
   */
  private analystMeetsRequirement(analyst: Analyst, requirement: any): boolean {
    if (requirement.employeeType && analyst.employeeType !== requirement.employeeType) {
      return false;
    }

    if (requirement.experienceLevel) {
      const levels = ['JUNIOR', 'MID_LEVEL', 'SENIOR', 'EXPERT'];
      const analystLevel = levels.indexOf(analyst.experienceLevel);
      const requiredLevel = levels.indexOf(requirement.experienceLevel);
      
      if (analystLevel < requiredLevel) {
        return false;
      }
    }

    return true;
  }

  /**
   * Round-robin selection strategy
   */
  private async roundRobinSelection(
    analysts: Analyst[],
    context: ScreenerSelectionContext,
    config: AlgorithmConfiguration
  ): Promise<ScreenerAssignmentResult> {
    
    // Get screener assignment history for round-robin tracking
    const screenerHistory = await this.getScreenerHistory(analysts, context.date);
    
    // Use randomization service for tie-breaking in round-robin selection
    const scoreFn = (analyst: Analyst) => {
      const lastAssignment = screenerHistory[analyst.id]?.lastAssignment || new Date(0);
      return Date.now() - lastAssignment.getTime(); // Higher score for older assignments
    };

    const selectedAnalyst = randomizationService.applyTieBreaking(
      analysts,
      scoreFn,
      config,
      { description: 'round-robin screener selection' }
    );

    const oldestAssignment = screenerHistory[selectedAnalyst.id]?.lastAssignment || new Date(0);

    return {
      selectedAnalyst,
      reason: `Round-robin: Last screener assignment on ${oldestAssignment.toISOString().split('T')[0]} ` +
              `(randomization: ${config.randomizationFactor})`,
      alternativeCandidates: analysts.filter(a => a.id !== selectedAnalyst.id),
      selectionScore: this.calculateRoundRobinScore(selectedAnalyst, screenerHistory)
    };
  }

  /**
   * Experience-based selection strategy
   */
  private async experienceBasedSelection(
    analysts: Analyst[],
    context: ScreenerSelectionContext,
    config: AlgorithmConfiguration
  ): Promise<ScreenerAssignmentResult> {
    
    // For major events: prioritize SENIOR/EXPERT + FULL_TIME
    if (context.isMajorEvent) {
      const qualifiedAnalysts = analysts.filter(a => 
        ['SENIOR', 'EXPERT'].includes(a.experienceLevel) && 
        a.employeeType === 'FULL_TIME'
      );
      
      if (qualifiedAnalysts.length > 0) {
        const selected = this.selectByExperienceRank(qualifiedAnalysts)[0];
        return {
          selectedAnalyst: selected,
          reason: `Major event: Selected ${selected.experienceLevel} ${selected.employeeType} analyst`,
          alternativeCandidates: qualifiedAnalysts.filter(a => a.id !== selected.id),
          selectionScore: this.calculateExperienceScore(selected)
        };
      }
      
      // Fallback: Senior consultants
      const seniorConsultants = analysts.filter(a => 
        ['SENIOR', 'EXPERT'].includes(a.experienceLevel) && 
        a.employeeType === 'CONSULTANT'
      );
      
      if (seniorConsultants.length > 0) {
        const selected = this.selectByExperienceRank(seniorConsultants)[0];
        return {
          selectedAnalyst: selected,
          reason: `Major event fallback: Selected ${selected.experienceLevel} ${selected.employeeType}`,
          alternativeCandidates: seniorConsultants.filter(a => a.id !== selected.id),
          selectionScore: this.calculateExperienceScore(selected) * 0.8 // Slight penalty for fallback
        };
      }
    }
    
    // Normal selection: prioritize by experience level
    const rankedAnalysts = this.selectByExperienceRank(analysts);
    const selected = rankedAnalysts[0];
    
    return {
      selectedAnalyst: selected,
      reason: `Experience-based: Selected ${selected.experienceLevel} level analyst`,
      alternativeCandidates: rankedAnalysts.slice(1),
      selectionScore: this.calculateExperienceScore(selected)
    };
  }

  /**
   * Workload balance selection strategy (current default logic)
   */
  private async workloadBalanceSelection(
    analysts: Analyst[],
    context: ScreenerSelectionContext,
    config: AlgorithmConfiguration
  ): Promise<ScreenerAssignmentResult> {
    
    const workloadStats = await this.calculateWorkloadStats(analysts, context.date);
    
    // Use randomization service for tie-breaking in workload balance
    const scoreFn = (analyst: Analyst) => {
      const workload = workloadStats[analyst.id]?.screenerCount || 0;
      return 1000 - workload; // Higher score for lower workload (inverted for tie-breaking)
    };

    const selectedAnalyst = randomizationService.applyTieBreaking(
      analysts,
      scoreFn,
      config,
      { description: 'workload balance screener selection' }
    );

    const lowestWorkload = workloadStats[selectedAnalyst.id]?.screenerCount || 0;

    return {
      selectedAnalyst,
      reason: `Workload balance: ${lowestWorkload} screener assignments vs avg ${this.calculateAverageWorkload(workloadStats)} ` +
              `(randomization: ${config.randomizationFactor})`,
      alternativeCandidates: analysts.filter(a => a.id !== selectedAnalyst.id),
      selectionScore: this.calculateWorkloadScore(selectedAnalyst, workloadStats)
    };
  }

  /**
   * Skill-based selection strategy
   */
  private async skillBasedSelection(
    analysts: Analyst[],
    context: ScreenerSelectionContext,
    config: AlgorithmConfiguration
  ): Promise<ScreenerAssignmentResult> {
    
    // Define required skills for screener role (can be configured in the future)
    const requiredSkills = ['screening', 'analysis', 'communication'];
    const preferredSkills = ['leadership', 'mentoring', 'system_knowledge'];
    
    // Use randomization service for skill-based selection with tie-breaking
    const scoreFn = (analyst: Analyst) => {
      const baseScore = this.calculateSkillScore(analyst, requiredSkills, preferredSkills);
      return randomizationService.applyScorePerturbation(baseScore, config, 0.1); // 10% perturbation
    };

    const selectedAnalyst = randomizationService.applyTieBreaking(
      analysts,
      scoreFn,
      config,
      { description: 'skill-based screener selection' }
    );

    const matchedSkills = this.getMatchedSkills(selectedAnalyst, [...requiredSkills, ...preferredSkills]);
    const finalScore = scoreFn(selectedAnalyst);
    
    return {
      selectedAnalyst,
      reason: `Skill-based: Matched ${matchedSkills.length} relevant skills (${matchedSkills.join(', ')}) ` +
              `(randomization: ${config.randomizationFactor})`,
      alternativeCandidates: analysts.filter(a => a.id !== selectedAnalyst.id),
      selectionScore: finalScore
    };
  }

  /**
   * Helper methods for scoring and ranking
   */
  private selectByExperienceRank(analysts: Analyst[]): Analyst[] {
    const experienceOrder = { 'EXPERT': 4, 'SENIOR': 3, 'MID_LEVEL': 2, 'JUNIOR': 1 };
    return analysts.sort((a, b) => 
      experienceOrder[b.experienceLevel] - experienceOrder[a.experienceLevel]
    );
  }

  private calculateExperienceScore(analyst: Analyst): number {
    const experienceScores = { 'EXPERT': 1.0, 'SENIOR': 0.8, 'MID_LEVEL': 0.6, 'JUNIOR': 0.4 };
    const employeeTypeBonus = { 'FULL_TIME': 0.2, 'ROTATION': 0.0, 'CONSULTANT': 0.1 };
    
    return experienceScores[analyst.experienceLevel] + employeeTypeBonus[analyst.employeeType];
  }

  private calculateSkillScore(analyst: Analyst, required: string[], preferred: string[]): number {
    const analystSkills = analyst.skills || [];
    
    const requiredMatches = required.filter(skill => 
      analystSkills.some(s => s.toLowerCase().includes(skill.toLowerCase()))
    ).length;
    
    const preferredMatches = preferred.filter(skill => 
      analystSkills.some(s => s.toLowerCase().includes(skill.toLowerCase()))
    ).length;
    
    // Required skills are weighted more heavily
    return (requiredMatches * 2 + preferredMatches) / (required.length * 2 + preferred.length);
  }

  private getMatchedSkills(analyst: Analyst, allSkills: string[]): string[] {
    const analystSkills = analyst.skills || [];
    return allSkills.filter(skill => 
      analystSkills.some(s => s.toLowerCase().includes(skill.toLowerCase()))
    );
  }

  private calculateRoundRobinScore(analyst: Analyst, history: any): number {
    const daysSinceLastAssignment = history[analyst.id]?.daysSinceLastAssignment || 365;
    return Math.min(daysSinceLastAssignment / 30, 1.0); // Normalize to 0-1 over 30 days
  }

  private calculateWorkloadScore(analyst: Analyst, workloadStats: any): number {
    const analystWorkload = workloadStats[analyst.id]?.screenerCount || 0;
    const avgWorkload = this.calculateAverageWorkload(workloadStats);
    const maxWorkload = Math.max(...Object.values(workloadStats).map((s: any) => s.screenerCount));
    
    // Invert score: lower workload = higher score
    return 1.0 - (analystWorkload / (maxWorkload || 1));
  }

  private calculateAverageWorkload(workloadStats: any): number {
    const workloads = Object.values(workloadStats).map((s: any) => s.screenerCount);
    return workloads.reduce((sum: number, w: any) => sum + w, 0) / workloads.length;
  }

  /**
   * Data retrieval helpers
   */
  private async getScreenerHistory(analysts: Analyst[], currentDate: Date): Promise<any> {
    // Implementation would get actual screener assignment history
    // For now, return mock data structure
    const history: any = {};
    for (const analyst of analysts) {
      history[analyst.id] = {
        lastAssignment: new Date(currentDate.getTime() - Math.random() * 30 * 24 * 60 * 60 * 1000),
        daysSinceLastAssignment: Math.floor(Math.random() * 30)
      };
    }
    return history;
  }

  private async calculateWorkloadStats(analysts: Analyst[], currentDate: Date): Promise<any> {
    // Implementation would calculate actual workload statistics
    // For now, return mock data structure
    const stats: any = {};
    for (const analyst of analysts) {
      stats[analyst.id] = {
        screenerCount: Math.floor(Math.random() * 10),
        totalShifts: Math.floor(Math.random() * 20) + 10
      };
    }
    return stats;
  }

  /**
   * Record audit decision for algorithm performance tracking
   */
  private async recordAuditDecision(
    auditSessionId: string,
    strategy: string,
    context: ScreenerSelectionContext,
    result: ScreenerAssignmentResult,
    constrainedAnalysts: Analyst[]
  ): Promise<void> {
    try {
      await algorithmAuditService.recordDecision(auditSessionId, {
        type: 'SCREENER_SELECTION',
        strategy,
        analystId: result.selectedAnalyst.id,
        date: context.date,
        shiftType: context.shiftType,
        alternatives: constrainedAnalysts.length,
        selectionScore: result.selectionScore,
        selectionReason: result.reason,
        constraints: {
          originalEligible: context.eligibleAnalysts.length,
          afterConstraints: constrainedAnalysts.length,
          isMajorEvent: context.isMajorEvent || false
        }
      });
    } catch (error) {
      console.error('Failed to record audit decision:', error);
      // Don't throw - audit failure shouldn't break scheduling
    }
  }
}

// Export singleton instance
export const screenerSelectionEngine = new ScreenerSelectionEngine();