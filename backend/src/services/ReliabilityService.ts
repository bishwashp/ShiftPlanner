import { AlgorithmConfiguration } from './scheduling/algorithms/types';
import { algorithmAuditService } from './AlgorithmAuditService';
import { tracingService } from './TracingService';

export interface ConfidenceFactors {
  constraintSatisfaction: number;    // 0-1: How well constraints are satisfied
  fairnessScore: number;            // 0-1: Fairness distribution quality
  optimizationConvergence: number;  // 0-1: How well optimization converged
  algorithmStability: number;       // 0-1: Historical algorithm performance
  dataQuality: number;              // 0-1: Input data completeness/quality
  conflictResolution: number;       // 0-1: Ability to resolve conflicts
  fallbackDepth: number;            // 0-1: How many fallbacks were needed (inverted)
}

export interface ConfidenceScore {
  overall: number;                  // 0-100: Overall confidence percentage
  factors: ConfidenceFactors;       // Individual factor breakdown
  qualityGate: 'PASS' | 'WARN' | 'FAIL';  // Quality gate result
  recommendation: 'ACCEPT' | 'REVIEW' | 'REJECT' | 'RETRY';
  reasoning: string[];              // Human-readable confidence reasoning
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
}

export interface ReliabilityMetrics {
  successRate: number;              // % of successful schedule generations
  averageConfidence: number;        // Average confidence score over time
  qualityGatePassRate: number;      // % of schedules passing quality gates
  fallbackUsageRate: number;        // % of times fallbacks were needed
  meanTimeToGenerate: number;       // Average generation time in ms
  errorRate: number;                // % of failed generations
}

export interface FallbackStrategy {
  name: string;
  optimizationStrategy: 'GENETIC' | 'SIMULATED_ANNEALING' | 'HILL_CLIMBING' | 'GREEDY';
  maxIterations: number;
  convergenceThreshold: number;
  timeoutMs: number;
  confidenceThreshold: number;      // Minimum confidence to accept this strategy
}

export class ReliabilityService {
  
  // Fallback hierarchy - ordered from most sophisticated to most basic
  private readonly FALLBACK_STRATEGIES: FallbackStrategy[] = [
    {
      name: 'Primary Genetic Algorithm',
      optimizationStrategy: 'GENETIC',
      maxIterations: 200,
      convergenceThreshold: 0.001,
      timeoutMs: 30000,
      confidenceThreshold: 0.85
    },
    {
      name: 'Simulated Annealing Fallback',
      optimizationStrategy: 'SIMULATED_ANNEALING',
      maxIterations: 150,
      convergenceThreshold: 0.005,
      timeoutMs: 20000,
      confidenceThreshold: 0.75
    },
    {
      name: 'Hill Climbing Fallback',
      optimizationStrategy: 'HILL_CLIMBING',
      maxIterations: 100,
      convergenceThreshold: 0.01,
      timeoutMs: 15000,
      confidenceThreshold: 0.65
    },
    {
      name: 'Greedy Baseline',
      optimizationStrategy: 'GREEDY',
      maxIterations: 50,
      convergenceThreshold: 0.05,
      timeoutMs: 10000,
      confidenceThreshold: 0.50
    }
  ];

  // Quality gate thresholds
  private readonly QUALITY_THRESHOLDS = {
    PASS: 0.85,     // High confidence - auto-accept
    WARN: 0.70,     // Medium confidence - suggest review
    FAIL: 0.50      // Low confidence - reject/retry
  };

  /**
   * Calculate comprehensive confidence score for a schedule generation result
   */
  calculateConfidenceScore(
    algorithmResult: any,
    context: {
      algorithmConfig: AlgorithmConfiguration;
      executionTime: number;
      fallbacksUsed: number;
      optimizationIterations: number;
      inputDataQuality: number;
    }
  ): ConfidenceScore {
    
    tracingService.startTiming('confidence_calculation');
    
    // Calculate individual confidence factors
    const factors: ConfidenceFactors = {
      constraintSatisfaction: this.calculateConstraintConfidence(algorithmResult),
      fairnessScore: this.calculateFairnessConfidence(algorithmResult),
      optimizationConvergence: this.calculateOptimizationConfidence(context),
      algorithmStability: this.calculateStabilityConfidence(context.algorithmConfig),
      dataQuality: context.inputDataQuality,
      conflictResolution: this.calculateConflictResolutionConfidence(algorithmResult),
      fallbackDepth: this.calculateFallbackConfidence(context.fallbacksUsed)
    };

    // Calculate weighted overall confidence
    const weights = {
      constraintSatisfaction: 0.25,  // Most important - must satisfy constraints
      fairnessScore: 0.20,           // Critical for user acceptance
      optimizationConvergence: 0.15, // Algorithm effectiveness
      algorithmStability: 0.15,      // Historical reliability
      dataQuality: 0.10,             // Input reliability
      conflictResolution: 0.10,      // Problem-solving ability
      fallbackDepth: 0.05            // Fallback usage penalty
    };

    const weightedScore = Object.entries(factors).reduce((sum, [key, value]) => {
      return sum + (value * weights[key as keyof typeof weights]);
    }, 0);

    const overallConfidence = Math.round(weightedScore * 100);

    // Determine quality gate result
    let qualityGate: 'PASS' | 'WARN' | 'FAIL';
    let recommendation: 'ACCEPT' | 'REVIEW' | 'REJECT' | 'RETRY';
    let riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

    if (overallConfidence >= this.QUALITY_THRESHOLDS.PASS * 100) {
      qualityGate = 'PASS';
      recommendation = 'ACCEPT';
      riskLevel = 'LOW';
    } else if (overallConfidence >= this.QUALITY_THRESHOLDS.WARN * 100) {
      qualityGate = 'WARN';
      recommendation = 'REVIEW';
      riskLevel = 'MEDIUM';
    } else if (overallConfidence >= this.QUALITY_THRESHOLDS.FAIL * 100) {
      qualityGate = 'FAIL';
      recommendation = context.fallbacksUsed < this.FALLBACK_STRATEGIES.length ? 'RETRY' : 'REJECT';
      riskLevel = 'HIGH';
    } else {
      qualityGate = 'FAIL';
      recommendation = 'REJECT';
      riskLevel = 'CRITICAL';
    }

    // Generate human-readable reasoning
    const reasoning = this.generateConfidenceReasoning(factors, overallConfidence, context);

    const confidenceScore: ConfidenceScore = {
      overall: overallConfidence,
      factors,
      qualityGate,
      recommendation,
      reasoning,
      riskLevel
    };

    tracingService.endTiming('confidence_calculation', 'confidence_scoring');
    
    tracingService.logSummary('confidence_calculated', {
      success: true,
      summary: `Confidence: ${overallConfidence}% | Quality: ${qualityGate} | Risk: ${riskLevel}`,
      metrics: {
        overallConfidence
      }
    });

    return confidenceScore;
  }

  /**
   * Get the next fallback strategy based on current failures
   */
  getNextFallbackStrategy(fallbacksUsed: number): FallbackStrategy | null {
    if (fallbacksUsed >= this.FALLBACK_STRATEGIES.length) {
      return null; // No more fallbacks available
    }
    return this.FALLBACK_STRATEGIES[fallbacksUsed];
  }

  /**
   * Create modified algorithm configuration for fallback strategy
   */
  createFallbackConfiguration(
    originalConfig: AlgorithmConfiguration,
    strategy: FallbackStrategy
  ): AlgorithmConfiguration {
    return {
      ...originalConfig,
      optimizationStrategy: strategy.optimizationStrategy,
      maxIterations: strategy.maxIterations,
      convergenceThreshold: strategy.convergenceThreshold,
      // Slightly increase fairness weight for fallbacks to ensure acceptable results
      fairnessWeight: Math.min(1.0, originalConfig.fairnessWeight + 0.1),
      // Reduce randomization for more predictable fallback results
      randomizationFactor: Math.max(0.1, originalConfig.randomizationFactor - 0.2)
    };
  }

  /**
   * Calculate reliability metrics over time for monitoring
   */
  async calculateReliabilityMetrics(
    algorithmName: string,
    days: number = 30
  ): Promise<ReliabilityMetrics> {
    
    // Get recent audit data for analysis
    const analytics = await algorithmAuditService.getAuditAnalytics(algorithmName, days);
    const trends = await algorithmAuditService.getPerformanceTrends(algorithmName, days);

    if (trends.length === 0) {
      return {
        successRate: 0,
        averageConfidence: 0,
        qualityGatePassRate: 0,
        fallbackUsageRate: 0,
        meanTimeToGenerate: 0,
        errorRate: 0
      };
    }

    // Calculate metrics from historical data
    const successRate = analytics.summary.successRate;
    const averageConfidence = analytics.averageMetrics.overallScore * 100; // Convert to percentage
    const meanTimeToGenerate = analytics.averageMetrics.executionTime;
    const errorRate = 100 - successRate;

    // Estimate quality gate pass rate and fallback usage
    // In production, these would be tracked explicitly
    const qualityGatePassRate = Math.max(0, averageConfidence - 15); // Rough estimate
    const fallbackUsageRate = Math.max(0, 30 - averageConfidence); // Higher when confidence is lower

    return {
      successRate,
      averageConfidence,
      qualityGatePassRate,
      fallbackUsageRate,
      meanTimeToGenerate,
      errorRate
    };
  }

  /**
   * Validate if system meets reliability targets for hands-off operation
   */
  async validateHandsOffReadiness(algorithmName: string): Promise<{
    ready: boolean;
    metrics: ReliabilityMetrics;
    issues: string[];
    recommendations: string[];
  }> {
    
    const metrics = await this.calculateReliabilityMetrics(algorithmName, 30);
    const issues: string[] = [];
    const recommendations: string[] = [];

    // Check against hands-off operation targets
    const targets = {
      minSuccessRate: 95,
      minAverageConfidence: 80,
      minQualityGatePassRate: 85,
      maxFallbackUsageRate: 20,
      maxMeanTimeToGenerate: 5000, // 5 seconds
      maxErrorRate: 5
    };

    if (metrics.successRate < targets.minSuccessRate) {
      issues.push(`Success rate ${metrics.successRate.toFixed(1)}% below target ${targets.minSuccessRate}%`);
      recommendations.push('Improve algorithm stability and error handling');
    }

    if (metrics.averageConfidence < targets.minAverageConfidence) {
      issues.push(`Average confidence ${metrics.averageConfidence.toFixed(1)}% below target ${targets.minAverageConfidence}%`);
      recommendations.push('Tune algorithm parameters for higher confidence scores');
    }

    if (metrics.qualityGatePassRate < targets.minQualityGatePassRate) {
      issues.push(`Quality gate pass rate ${metrics.qualityGatePassRate.toFixed(1)}% below target ${targets.minQualityGatePassRate}%`);
      recommendations.push('Adjust quality gate thresholds or improve algorithm performance');
    }

    if (metrics.fallbackUsageRate > targets.maxFallbackUsageRate) {
      issues.push(`Fallback usage rate ${metrics.fallbackUsageRate.toFixed(1)}% above target ${targets.maxFallbackUsageRate}%`);
      recommendations.push('Optimize primary algorithm to reduce fallback dependency');
    }

    if (metrics.meanTimeToGenerate > targets.maxMeanTimeToGenerate) {
      issues.push(`Mean generation time ${metrics.meanTimeToGenerate.toFixed(0)}ms above target ${targets.maxMeanTimeToGenerate}ms`);
      recommendations.push('Optimize algorithm performance and reduce iteration counts');
    }

    const ready = issues.length === 0;

    tracingService.logSummary('hands_off_readiness_check', {
      success: true,
      summary: `Hands-off readiness: ${ready ? 'READY' : 'NOT READY'} (${issues.length} issues)`,
      metrics: {
        issueCount: issues.length,
        recommendationCount: recommendations.length,
        successRate: metrics.successRate,
        averageConfidence: metrics.averageConfidence,
        errorRate: metrics.errorRate
      }
    });

    return {
      ready,
      metrics,
      issues,
      recommendations
    };
  }

  // Private helper methods for confidence calculation

  private calculateConstraintConfidence(result: any): number {
    if (!result.constraintValidation) return 0.5;
    
    const score = result.constraintValidation.score || 0;
    const violations = result.constraintValidation.violations?.length || 0;
    
    // High score and low violations = high confidence
    return Math.min(1.0, score * (1 - violations * 0.1));
  }

  private calculateFairnessConfidence(result: any): number {
    if (!result.fairnessMetrics) return 0.5;
    
    const fairnessScore = result.fairnessMetrics.overallFairnessScore || 0;
    
    // Direct mapping of fairness score to confidence
    return Math.min(1.0, fairnessScore);
  }

  private calculateOptimizationConfidence(context: any): number {
    const { executionTime, optimizationIterations } = context;
    
    // Quick convergence = high confidence
    // Very long execution or too few iterations = lower confidence
    let confidence = 0.8;
    
    if (executionTime > 10000) confidence -= 0.2; // Penalty for long execution
    if (optimizationIterations < 10) confidence -= 0.2; // Penalty for too few iterations
    if (optimizationIterations > 500) confidence -= 0.1; // Penalty for too many iterations
    
    return Math.max(0.0, Math.min(1.0, confidence));
  }

  private calculateStabilityConfidence(config: AlgorithmConfiguration): number {
    // Stable configurations get higher confidence
    // This could be enhanced with historical performance data
    let confidence = 0.7;
    
    // Conservative configurations are more stable
    if (config.fairnessWeight > 0.3) confidence += 0.1;
    if (config.constraintWeight > 0.2) confidence += 0.1;
    if (config.randomizationFactor < 0.5) confidence += 0.1;
    
    return Math.min(1.0, confidence);
  }

  private calculateConflictResolutionConfidence(result: any): number {
    const conflicts = result.conflicts?.length || 0;
    const schedules = result.proposedSchedules?.length || 1;
    
    // Low conflict rate = high confidence
    const conflictRate = conflicts / schedules;
    return Math.max(0.0, 1.0 - conflictRate * 2); // Penalty for conflicts
  }

  private calculateFallbackConfidence(fallbacksUsed: number): number {
    // Using fallbacks reduces confidence
    if (fallbacksUsed === 0) return 1.0;
    if (fallbacksUsed === 1) return 0.8;
    if (fallbacksUsed === 2) return 0.6;
    if (fallbacksUsed === 3) return 0.4;
    return 0.2; // Multiple fallbacks = very low confidence
  }

  private generateConfidenceReasoning(
    factors: ConfidenceFactors,
    overallConfidence: number,
    context: any
  ): string[] {
    const reasoning: string[] = [];
    
    // Highlight strongest factors
    const topFactors = this.getTopConfidenceFactors(factors);
    reasoning.push(`Strongest factors: ${topFactors.join(', ')}`);
    
    // Note any concerning factors
    if (factors.constraintSatisfaction < 0.7) {
      reasoning.push('⚠️ Constraint satisfaction below optimal level');
    }
    if (factors.fairnessScore < 0.7) {
      reasoning.push('⚠️ Fairness distribution needs improvement');
    }
    if (factors.fallbackDepth < 0.8) {
      reasoning.push('⚠️ Required fallback strategies to generate schedule');
    }
    
    // Overall assessment
    if (overallConfidence >= 85) {
      reasoning.push('✅ High confidence - schedule ready for production use');
    } else if (overallConfidence >= 70) {
      reasoning.push('⚠️ Medium confidence - consider review before deployment');
    } else {
      reasoning.push('❌ Low confidence - requires manual review or regeneration');
    }
    
    return reasoning;
  }

  private getTopConfidenceFactors(factors: ConfidenceFactors): string[] {
    const factorEntries = Object.entries(factors)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 3)
      .map(([key, value]) => `${this.formatFactorName(key)} (${(value * 100).toFixed(0)}%)`);
    
    return factorEntries;
  }

  private formatFactorName(key: string): string {
    const names: Record<string, string> = {
      constraintSatisfaction: 'Constraints',
      fairnessScore: 'Fairness',
      optimizationConvergence: 'Optimization',
      algorithmStability: 'Stability',
      dataQuality: 'Data Quality',
      conflictResolution: 'Conflict Resolution',
      fallbackDepth: 'Primary Algorithm'
    };
    return names[key] || key;
  }
}

// Export singleton instance
export const reliabilityService = new ReliabilityService();