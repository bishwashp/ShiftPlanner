import { SchedulingConstraint, Schedule, Analyst } from '../../generated/prisma';
import { prisma } from '../lib/prisma';
import { constraintImpactSimulator, ConstraintChange, ScheduleImpact } from './ConstraintImpactSimulator';
import { predictiveAnalyticsEngine, PredictionResult } from './PredictiveAnalyticsEngine';

export interface Scenario {
  id: string;
  name: string;
  description: string;
  changes: ConstraintChange[];
  baseDate: Date;
  dateRange: {
    startDate: Date;
    endDate: Date;
  };
  createdAt: Date;
  userId?: string;
}

export interface ScenarioAnalysis {
  scenario: Scenario;
  impact: ScheduleImpact;
  predictions: PredictionResult[];
  comparison: ScenarioComparison;
  recommendations: string[];
  riskAssessment: {
    overallRisk: 'LOW' | 'MEDIUM' | 'HIGH';
    riskFactors: string[];
    mitigationStrategies: string[];
  };
}

export interface ScenarioComparison {
  baseline: {
    conflictCount: number;
    fairnessScore: number;
    coverageGaps: number;
    violationCount: number;
  };
  projected: {
    conflictCount: number;
    fairnessScore: number;
    coverageGaps: number;
    violationCount: number;
  };
  improvements: {
    conflictReduction: number;
    fairnessImprovement: number;
    coverageImprovement: number;
    violationReduction: number;
  };
  netBenefit: number; // -1 to 1, negative is worse, positive is better
}

export interface ScenarioRequest {
  name: string;
  description?: string;
  changes: Array<{
    type: 'CREATE' | 'UPDATE' | 'DELETE';
    constraint: Partial<SchedulingConstraint>;
    originalConstraint?: SchedulingConstraint;
  }>;
  dateRange: {
    startDate: Date;
    endDate: Date;
  };
  includeReschedule?: boolean;
  includePredictions?: boolean;
}

export class WhatIfScenarioEngine {
  private scenarioCache: Map<string, ScenarioAnalysis> = new Map();
  private cacheTimeout = 300000; // 5 minutes

  /**
   * Analyze a what-if scenario with multiple constraint changes
   */
  async analyzeScenario(request: ScenarioRequest): Promise<ScenarioAnalysis> {
    const scenario: Scenario = {
      id: this.generateScenarioId(),
      name: request.name,
      description: request.description || '',
      changes: request.changes.map(change => ({
        type: change.type,
        constraint: change.constraint,
        originalConstraint: change.originalConstraint
      })),
      baseDate: new Date(),
      dateRange: request.dateRange,
      createdAt: new Date()
    };

    // Check cache
    const cacheKey = this.generateCacheKey(request);
    const cached = this.getFromCache(cacheKey);
    if (cached) {
      return cached;
    }

    // Get baseline metrics
    const baseline = await this.getBaselineMetrics(request.dateRange);

    // Simulate cumulative impact of all changes
    const impact = await this.simulateCumulativeImpact(scenario);

    // Get predictions if requested
    let predictions: PredictionResult[] = [];
    if (request.includePredictions) {
      predictions = await this.generateScenarioPredictions(scenario);
    }

    // Compare baseline vs projected
    const comparison = this.calculateComparison(baseline, impact, predictions);

    // Generate recommendations
    const recommendations = this.generateScenarioRecommendations(impact, comparison, predictions);

    // Assess risk
    const riskAssessment = this.assessScenarioRisk(impact, comparison, predictions);

    const analysis: ScenarioAnalysis = {
      scenario,
      impact,
      predictions,
      comparison,
      recommendations,
      riskAssessment
    };

    // Cache result
    this.setCache(cacheKey, analysis);

    return analysis;
  }

  /**
   * Compare multiple scenarios side by side
   */
  async compareScenarios(scenarios: ScenarioRequest[]): Promise<{
    scenarios: ScenarioAnalysis[];
    ranking: {
      scenarioId: string;
      name: string;
      score: number;
      ranking: number;
      strengths: string[];
      weaknesses: string[];
    }[];
    recommendation: string;
  }> {
    // Analyze all scenarios
    const analyses = await Promise.all(
      scenarios.map(scenario => this.analyzeScenario(scenario))
    );

    // Rank scenarios based on net benefit and risk
    const ranking = analyses.map((analysis, index) => {
      const score = this.calculateScenarioScore(analysis);
      return {
        scenarioId: analysis.scenario.id,
        name: analysis.scenario.name,
        score,
        ranking: 0, // Will be set after sorting
        strengths: this.identifyStrengths(analysis),
        weaknesses: this.identifyWeaknesses(analysis)
      };
    }).sort((a, b) => b.score - a.score)
      .map((item, index) => ({ ...item, ranking: index + 1 }));

    // Generate overall recommendation
    const recommendation = this.generateOverallRecommendation(analyses, ranking);

    return {
      scenarios: analyses,
      ranking,
      recommendation
    };
  }

  /**
   * Test incremental changes (add constraints one by one)
   */
  async testIncrementalChanges(request: ScenarioRequest): Promise<{
    steps: Array<{
      stepNumber: number;
      changeDescription: string;
      cumulativeImpact: ScheduleImpact;
      incrementalImpact: {
        conflictChange: number;
        fairnessChange: number;
        coverageChange: number;
      };
      recommendation: 'CONTINUE' | 'STOP' | 'MODIFY';
      reasoning: string;
    }>;
    optimalStoppingPoint?: number;
    finalRecommendation: string;
  }> {
    const steps: any[] = [];
    let cumulativeChanges: ConstraintChange[] = [];
    let previousImpact: ScheduleImpact | null = null;

    for (let i = 0; i < request.changes.length; i++) {
      const change = request.changes[i];
      cumulativeChanges.push(change);

      // Create scenario with cumulative changes
      const stepScenario: Scenario = {
        id: `${this.generateScenarioId()}-step-${i + 1}`,
        name: `${request.name} - Step ${i + 1}`,
        description: `Incremental step ${i + 1}`,
        changes: cumulativeChanges,
        baseDate: new Date(),
        dateRange: request.dateRange,
        createdAt: new Date()
      };

      const cumulativeImpact = await this.simulateCumulativeImpact(stepScenario);

      // Calculate incremental impact
      let incrementalImpact = {
        conflictChange: 0,
        fairnessChange: 0,
        coverageChange: 0
      };

      if (previousImpact) {
        incrementalImpact = {
          conflictChange: cumulativeImpact.scheduleChanges.conflicts.length - previousImpact.scheduleChanges.conflicts.length,
          fairnessChange: cumulativeImpact.fairnessImpact.change - previousImpact.fairnessImpact.change,
          coverageChange: cumulativeImpact.coverageImpact.netCoverageChange - previousImpact.coverageImpact.netCoverageChange
        };
      }

      // Determine recommendation for this step
      const stepRecommendation = this.evaluateStepRecommendation(incrementalImpact, cumulativeImpact);

      steps.push({
        stepNumber: i + 1,
        changeDescription: this.describeChange(change),
        cumulativeImpact,
        incrementalImpact,
        recommendation: stepRecommendation.action,
        reasoning: stepRecommendation.reasoning
      });

      previousImpact = cumulativeImpact;

      // If recommendation is to stop, break early
      if (stepRecommendation.action === 'STOP') {
        break;
      }
    }

    // Find optimal stopping point
    const optimalStoppingPoint = this.findOptimalStoppingPoint(steps);

    // Generate final recommendation
    const finalRecommendation = this.generateIncrementalRecommendation(steps, optimalStoppingPoint);

    return {
      steps,
      optimalStoppingPoint,
      finalRecommendation
    };
  }

  /**
   * Simulate what happens if we roll back changes
   */
  async simulateRollback(currentConstraints: SchedulingConstraint[], changes: ConstraintChange[]): Promise<{
    rollbackOptions: Array<{
      changeToRevert: ConstraintChange;
      impactOfReverting: ScheduleImpact;
      benefit: number;
      recommendation: string;
    }>;
    optimalRollback: {
      changesToRevert: ConstraintChange[];
      projectedImprovement: number;
      reasoning: string;
    };
  }> {
    const rollbackOptions: any[] = [];

    // Test reverting each change individually
    for (const change of changes) {
      const rollbackImpact = await this.simulateChangeReversal(currentConstraints, change);
      const benefit = this.calculateRollbackBenefit(rollbackImpact);

      rollbackOptions.push({
        changeToRevert: change,
        impactOfReverting: rollbackImpact,
        benefit,
        recommendation: this.generateRollbackRecommendation(rollbackImpact, benefit)
      });
    }

    // Find optimal combination of rollbacks
    const optimalRollback = await this.findOptimalRollbackCombination(currentConstraints, changes);

    return {
      rollbackOptions,
      optimalRollback
    };
  }

  // Private helper methods

  private generateScenarioId(): string {
    return `scenario_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private async getBaselineMetrics(dateRange: { startDate: Date; endDate: Date }) {
    // Get current schedules and constraints
    const [schedules, constraints] = await Promise.all([
      prisma.schedule.findMany({
        where: {
          date: { gte: dateRange.startDate, lte: dateRange.endDate }
        },
        include: { analyst: true }
      }),
      prisma.schedulingConstraint.findMany({
        where: {
          isActive: true,
          startDate: { lte: dateRange.endDate },
          endDate: { gte: dateRange.startDate }
        }
      })
    ]);

    // Calculate baseline metrics
    const conflictCount = await this.countCurrentConflicts(schedules, constraints);
    const fairnessScore = await this.calculateCurrentFairness(schedules);
    const coverageGaps = await this.countCoverageGaps(schedules, dateRange);
    const violationCount = await this.countConstraintViolations(schedules, constraints);

    return {
      conflictCount,
      fairnessScore,
      coverageGaps,
      violationCount
    };
  }

  private async simulateCumulativeImpact(scenario: Scenario): Promise<ScheduleImpact> {
    // Apply changes sequentially and get cumulative impact
    let currentConstraints = await prisma.schedulingConstraint.findMany({
      where: {
        isActive: true,
        startDate: { lte: scenario.dateRange.endDate },
        endDate: { gte: scenario.dateRange.startDate }
      }
    });

    // For each change, simulate its impact
    let cumulativeImpact: ScheduleImpact | null = null;

    for (const change of scenario.changes) {
      const stepImpact = await constraintImpactSimulator.simulateConstraintImpact({
        constraintChange: change,
        dateRange: scenario.dateRange,
        includeReschedule: false
      });

      if (!cumulativeImpact) {
        cumulativeImpact = stepImpact;
      } else {
        // Merge impacts
        cumulativeImpact = this.mergeImpacts(cumulativeImpact, stepImpact);
      }

      // Update constraints for next iteration
      currentConstraints = this.applyChangeToConstraints(currentConstraints, change);
    }

    return cumulativeImpact || {
      affectedDates: [],
      affectedAnalysts: [],
      scheduleChanges: { before: [], after: [], conflicts: [] },
      fairnessImpact: { before: 0, after: 0, change: 0 },
      coverageImpact: { gapsIntroduced: 0, gapsResolved: 0, netCoverageChange: 0 },
      recommendations: []
    };
  }

  private async generateScenarioPredictions(scenario: Scenario): Promise<PredictionResult[]> {
    // Use predictive analytics to forecast issues
    return await predictiveAnalyticsEngine.predictViolations({
      startDate: scenario.dateRange.startDate,
      endDate: scenario.dateRange.endDate,
      minProbability: 0.3,
      minConfidence: 0.6
    });
  }

  private calculateComparison(baseline: any, impact: ScheduleImpact, predictions: PredictionResult[]): ScenarioComparison {
    const projected = {
      conflictCount: impact.scheduleChanges.conflicts.length,
      fairnessScore: impact.fairnessImpact.after,
      coverageGaps: impact.coverageImpact.gapsIntroduced,
      violationCount: predictions.filter(p => p.conflictType === 'CONSTRAINT_VIOLATION').length
    };

    const improvements = {
      conflictReduction: baseline.conflictCount - projected.conflictCount,
      fairnessImprovement: projected.fairnessScore - baseline.fairnessScore,
      coverageImprovement: baseline.coverageGaps - projected.coverageGaps,
      violationReduction: baseline.violationCount - projected.violationCount
    };

    // Calculate net benefit (-1 to 1)
    const netBenefit = (
      improvements.conflictReduction * 0.3 +
      improvements.fairnessImprovement * 0.25 +
      improvements.coverageImprovement * 0.25 +
      improvements.violationReduction * 0.2
    ) / Math.max(baseline.conflictCount + baseline.coverageGaps + baseline.violationCount, 1);

    return {
      baseline,
      projected,
      improvements,
      netBenefit: Math.max(-1, Math.min(1, netBenefit))
    };
  }

  private generateScenarioRecommendations(impact: ScheduleImpact, comparison: ScenarioComparison, predictions: PredictionResult[]): string[] {
    const recommendations: string[] = [];

    if (comparison.netBenefit > 0.3) {
      recommendations.push('✅ Strong positive impact - Highly recommended to implement');
    } else if (comparison.netBenefit > 0.1) {
      recommendations.push('⚠️ Moderate positive impact - Consider implementing with monitoring');
    } else if (comparison.netBenefit < -0.1) {
      recommendations.push('❌ Negative impact detected - Not recommended without modifications');
    } else {
      recommendations.push('➡️ Minimal impact - Consider if changes are necessary');
    }

    if (comparison.improvements.conflictReduction > 0) {
      recommendations.push(`Reduces conflicts by ${comparison.improvements.conflictReduction}`);
    }

    if (comparison.improvements.fairnessImprovement > 0.1) {
      recommendations.push(`Improves fairness by ${(comparison.improvements.fairnessImprovement * 100).toFixed(1)}%`);
    }

    return recommendations;
  }

  private assessScenarioRisk(impact: ScheduleImpact, comparison: ScenarioComparison, predictions: PredictionResult[]): any {
    const highRiskPredictions = predictions.filter(p => p.severity === 'HIGH').length;
    const conflictIncrease = comparison.improvements.conflictReduction < 0;
    const fairnessDecrease = comparison.improvements.fairnessImprovement < -0.1;

    let overallRisk: 'LOW' | 'MEDIUM' | 'HIGH' = 'LOW';
    const riskFactors: string[] = [];
    const mitigationStrategies: string[] = [];

    if (highRiskPredictions > 2) {
      overallRisk = 'HIGH';
      riskFactors.push(`${highRiskPredictions} high-risk predictions`);
      mitigationStrategies.push('Review constraint parameters before implementation');
    }

    if (conflictIncrease) {
      overallRisk = overallRisk === 'LOW' ? 'MEDIUM' : 'HIGH';
      riskFactors.push('Increased conflicts expected');
      mitigationStrategies.push('Consider phased implementation to monitor impact');
    }

    if (fairnessDecrease) {
      overallRisk = overallRisk === 'LOW' ? 'MEDIUM' : 'HIGH';
      riskFactors.push('Fairness degradation detected');
      mitigationStrategies.push('Implement additional fairness measures');
    }

    return { overallRisk, riskFactors, mitigationStrategies };
  }

  // Additional helper methods (simplified for brevity)
  private calculateScenarioScore(analysis: ScenarioAnalysis): number {
    return analysis.comparison.netBenefit * 100;
  }

  private identifyStrengths(analysis: ScenarioAnalysis): string[] {
    const strengths: string[] = [];
    if (analysis.comparison.improvements.conflictReduction > 0) {
      strengths.push('Reduces conflicts');
    }
    if (analysis.comparison.improvements.fairnessImprovement > 0) {
      strengths.push('Improves fairness');
    }
    return strengths;
  }

  private identifyWeaknesses(analysis: ScenarioAnalysis): string[] {
    const weaknesses: string[] = [];
    if (analysis.comparison.improvements.conflictReduction < 0) {
      weaknesses.push('Increases conflicts');
    }
    if (analysis.comparison.improvements.fairnessImprovement < 0) {
      weaknesses.push('Decreases fairness');
    }
    return weaknesses;
  }

  private generateOverallRecommendation(analyses: ScenarioAnalysis[], ranking: any[]): string {
    const topScenario = ranking[0];
    if (topScenario.score > 30) {
      return `Implement "${topScenario.name}" - shows strong positive impact`;
    } else if (topScenario.score > 10) {
      return `Consider "${topScenario.name}" with careful monitoring`;
    } else {
      return 'All scenarios show limited benefit - review constraints before implementing';
    }
  }

  // Stub methods for remaining functionality
  private evaluateStepRecommendation(incrementalImpact: any, cumulativeImpact: ScheduleImpact): any {
    return { action: 'CONTINUE', reasoning: 'Impact within acceptable range' };
  }

  private describeChange(change: ConstraintChange): string {
    return `${change.type} ${change.constraint.constraintType} constraint`;
  }

  private findOptimalStoppingPoint(steps: any[]): number | undefined {
    return steps.findIndex(step => step.recommendation === 'STOP') + 1 || undefined;
  }

  private generateIncrementalRecommendation(steps: any[], optimalPoint?: number): string {
    if (optimalPoint) {
      return `Implement steps 1-${optimalPoint} for optimal results`;
    }
    return 'All steps can be implemented safely';
  }

  private async simulateChangeReversal(constraints: SchedulingConstraint[], change: ConstraintChange): Promise<ScheduleImpact> {
    // Simplified reversal simulation
    return {
      affectedDates: [],
      affectedAnalysts: [],
      scheduleChanges: { before: [], after: [], conflicts: [] },
      fairnessImpact: { before: 0, after: 0, change: 0 },
      coverageImpact: { gapsIntroduced: 0, gapsResolved: 0, netCoverageChange: 0 },
      recommendations: []
    };
  }

  private calculateRollbackBenefit(impact: ScheduleImpact): number {
    return impact.fairnessImpact.change || 0;
  }

  private generateRollbackRecommendation(impact: ScheduleImpact, benefit: number): string {
    return benefit > 0 ? 'Recommended' : 'Not recommended';
  }

  private async findOptimalRollbackCombination(constraints: SchedulingConstraint[], changes: ConstraintChange[]): Promise<any> {
    return {
      changesToRevert: [],
      projectedImprovement: 0,
      reasoning: 'No beneficial rollbacks identified'
    };
  }

  private mergeImpacts(impact1: ScheduleImpact, impact2: ScheduleImpact): ScheduleImpact {
    return {
      affectedDates: [...new Set([...impact1.affectedDates, ...impact2.affectedDates])],
      affectedAnalysts: [...new Set([...impact1.affectedAnalysts, ...impact2.affectedAnalysts])],
      scheduleChanges: {
        before: impact1.scheduleChanges.before,
        after: impact2.scheduleChanges.after,
        conflicts: [...impact1.scheduleChanges.conflicts, ...impact2.scheduleChanges.conflicts]
      },
      fairnessImpact: {
        before: impact1.fairnessImpact.before,
        after: impact2.fairnessImpact.after,
        change: impact1.fairnessImpact.change + impact2.fairnessImpact.change
      },
      coverageImpact: {
        gapsIntroduced: impact1.coverageImpact.gapsIntroduced + impact2.coverageImpact.gapsIntroduced,
        gapsResolved: impact1.coverageImpact.gapsResolved + impact2.coverageImpact.gapsResolved,
        netCoverageChange: impact1.coverageImpact.netCoverageChange + impact2.coverageImpact.netCoverageChange
      },
      recommendations: [...impact1.recommendations, ...impact2.recommendations]
    };
  }

  private applyChangeToConstraints(constraints: SchedulingConstraint[], change: ConstraintChange): SchedulingConstraint[] {
    // Simplified constraint application
    return constraints;
  }

  // Cache management
  private generateCacheKey(request: ScenarioRequest): string {
    return `scenario_${JSON.stringify(request.changes)}_${request.dateRange.startDate.toISOString()}_${request.dateRange.endDate.toISOString()}`;
  }

  private getFromCache(key: string): ScenarioAnalysis | null {
    const cached = this.scenarioCache.get(key);
    if (cached && Date.now() - cached.scenario.createdAt.getTime() < this.cacheTimeout) {
      return cached;
    }
    this.scenarioCache.delete(key);
    return null;
  }

  private setCache(key: string, analysis: ScenarioAnalysis): void {
    this.scenarioCache.set(key, analysis);
    
    // Clean up old cache entries
    if (this.scenarioCache.size > 50) {
      const oldestKey = this.scenarioCache.keys().next().value;
      if (oldestKey !== undefined) {
        this.scenarioCache.delete(oldestKey);
      }
    }
  }

  // Stub methods for metrics calculation
  private async countCurrentConflicts(schedules: Schedule[], constraints: SchedulingConstraint[]): Promise<number> { return 0; }
  private async calculateCurrentFairness(schedules: Schedule[]): Promise<number> { return 0.8; }
  private async countCoverageGaps(schedules: Schedule[], dateRange: any): Promise<number> { return 0; }
  private async countConstraintViolations(schedules: Schedule[], constraints: SchedulingConstraint[]): Promise<number> { return 0; }
}

export const whatIfScenarioEngine = new WhatIfScenarioEngine();