import { PrismaClient, AlgorithmAudit, DecisionAudit, PerformanceMetrics, AuditRecommendation } from '../../generated/prisma';
import { AlgorithmConfiguration } from './scheduling/algorithms/types';
import { tracingService } from './TracingService';

export interface AuditSession {
  id: string;
  algorithmName: string;
  version: string;
  startTime: number;
  configuration: AlgorithmConfiguration;
  context: {
    startDate: Date;
    endDate: Date;
    analystCount: number;
  };
}

export interface DecisionContext {
  type: 'SCREENER_SELECTION' | 'WEEKEND_ROTATION' | 'OPTIMIZATION_STRATEGY' | 'CONSTRAINT_RESOLUTION' | 'TIE_BREAKING' | 'FAIRNESS_ADJUSTMENT';
  strategy: string;
  analystId?: string;
  date?: Date;
  shiftType?: string;
  alternatives: number;
  selectionScore: number;
  selectionReason: string;
  constraints?: any;
}

export interface PerformanceData {
  schedulesGenerated: number;
  conflictsFound: number;
  overwrites: number;
  fairnessScore: number;
  constraintScore: number;
  efficiencyScore: number;
  overallScore: number;
  success: boolean;
  errorMessage?: string;
}

export interface RecommendationContext {
  type: 'CONFIGURATION_CHANGE' | 'STRATEGY_OPTIMIZATION' | 'PERFORMANCE_IMPROVEMENT' | 'CONSTRAINT_ADJUSTMENT' | 'ALGORITHM_UPGRADE';
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  title: string;
  description: string;
  currentValue?: any;
  recommendedValue?: any;
  expectedImprovement?: number;
  confidence: number;
  analysisData?: any;
}

export class AlgorithmAuditService {
  private prisma: PrismaClient;
  private activeSessions: Map<string, AuditSession> = new Map();

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  /**
   * Start an audit session for algorithm execution
   */
  async startAuditSession(
    algorithmName: string,
    version: string,
    configuration: AlgorithmConfiguration,
    context: { startDate: Date; endDate: Date; analystCount: number }
  ): Promise<string> {
    const sessionId = `audit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const session: AuditSession = {
      id: sessionId,
      algorithmName,
      version,
      startTime: performance.now(),
      configuration,
      context
    };

    this.activeSessions.set(sessionId, session);

    tracingService.logVerbose('audit_session_start', {
      sessionId,
      algorithmName,
      version,
      configuration: configuration,
      context
    });

    return sessionId;
  }

  /**
   * Complete an audit session and store results
   */
  async completeAuditSession(
    sessionId: string,
    performanceData: PerformanceData
  ): Promise<AlgorithmAudit> {
    const session = this.activeSessions.get(sessionId);
    if (!session) {
      throw new Error(`No active audit session found for ID: ${sessionId}`);
    }

    const executionTime = performance.now() - session.startTime;

    // Create algorithm audit record
    const algorithmAudit = await this.prisma.algorithmAudit.create({
      data: {
        algorithmName: session.algorithmName,
        version: session.version,
        startDate: session.context.startDate,
        endDate: session.context.endDate,
        analystCount: session.context.analystCount,
        executionTime,
        configuration: session.configuration as any,
        schedulesGenerated: performanceData.schedulesGenerated,
        conflictsFound: performanceData.conflictsFound,
        overwrites: performanceData.overwrites,
        fairnessScore: performanceData.fairnessScore,
        constraintScore: performanceData.constraintScore,
        efficiencyScore: performanceData.efficiencyScore,
        overallScore: performanceData.overallScore,
        success: performanceData.success,
        errorMessage: performanceData.errorMessage
      }
    });

    // Calculate and store performance metrics
    await this.calculateAndStoreMetrics(algorithmAudit.id, session, performanceData);

    // Generate recommendations based on performance
    await this.generateRecommendations(algorithmAudit.id, session, performanceData);

    // Clean up session
    this.activeSessions.delete(sessionId);

    tracingService.logSummary('audit_session_complete', {
      success: true,
      duration: executionTime,
      summary: `Algorithm audit completed for ${session.algorithmName}`,
      metrics: {
        overallScore: performanceData.overallScore,
        fairnessScore: performanceData.fairnessScore,
        constraintScore: performanceData.constraintScore,
        schedulesGenerated: performanceData.schedulesGenerated,
        conflictsFound: performanceData.conflictsFound
      }
    });

    return algorithmAudit;
  }

  /**
   * Record a decision made during algorithm execution
   */
  async recordDecision(
    sessionId: string,
    decision: DecisionContext
  ): Promise<void> {
    const session = this.activeSessions.get(sessionId);
    if (!session) {
      tracingService.logWarning('audit_decision_no_session', `No active session for decision recording: ${sessionId}`);
      return;
    }

    // Store decision for later persistence (we'll save all decisions when session completes)
    if (!session.context) {
      (session.context as any).decisions = [];
    }
    if (!(session.context as any).decisions) {
      (session.context as any).decisions = [];
    }
    (session.context as any).decisions.push(decision);

    tracingService.logVerbose('audit_decision_recorded', {
      sessionId,
      decisionType: decision.type,
      strategy: decision.strategy,
      selectionScore: decision.selectionScore,
      alternatives: decision.alternatives
    });
  }

  /**
   * Store all recorded decisions to database
   */
  private async storeDecisions(algorithmAuditId: string, session: AuditSession): Promise<void> {
    const decisions = (session.context as any).decisions || [];
    
    if (decisions.length === 0) return;

    const decisionData = decisions.map((decision: DecisionContext) => ({
      algorithmAuditId,
      decisionType: decision.type,
      strategy: decision.strategy,
      analystId: decision.analystId,
      date: decision.date,
      shiftType: decision.shiftType,
      alternatives: decision.alternatives,
      selectionScore: decision.selectionScore,
      selectionReason: decision.selectionReason,
      constraints: decision.constraints ? decision.constraints as any : null
    }));

    await this.prisma.decisionAudit.createMany({
      data: decisionData
    });
  }

  /**
   * Calculate and store detailed performance metrics
   */
  private async calculateAndStoreMetrics(
    algorithmAuditId: string,
    session: AuditSession,
    performanceData: PerformanceData
  ): Promise<void> {
    
    // Store decisions first
    await this.storeDecisions(algorithmAuditId, session);
    
    // Calculate baseline comparisons
    const historicalBaseline = await this.calculateHistoricalBaseline(session.algorithmName);
    
    const metrics: any[] = [
      {
        algorithmAuditId,
        metricType: 'fairness',
        category: 'overall',
        value: performanceData.fairnessScore,
        baseline: historicalBaseline.fairnessScore,
        improvement: historicalBaseline.fairnessScore ? 
          ((performanceData.fairnessScore - historicalBaseline.fairnessScore) / historicalBaseline.fairnessScore) * 100 : null,
        metadata: { source: 'fairness_engine' }
      },
      {
        algorithmAuditId,
        metricType: 'efficiency',
        category: 'overall',
        value: performanceData.efficiencyScore,
        baseline: historicalBaseline.efficiencyScore,
        improvement: historicalBaseline.efficiencyScore ? 
          ((performanceData.efficiencyScore - historicalBaseline.efficiencyScore) / historicalBaseline.efficiencyScore) * 100 : null,
        metadata: { source: 'optimization_engine' }
      },
      {
        algorithmAuditId,
        metricType: 'constraint_satisfaction',
        category: 'overall',
        value: performanceData.constraintScore,
        baseline: historicalBaseline.constraintScore,
        improvement: historicalBaseline.constraintScore ? 
          ((performanceData.constraintScore - historicalBaseline.constraintScore) / historicalBaseline.constraintScore) * 100 : null,
        metadata: { source: 'constraint_engine' }
      },
      {
        algorithmAuditId,
        metricType: 'execution_time',
        category: 'performance',
        value: session.startTime,
        baseline: historicalBaseline.executionTime,
        improvement: historicalBaseline.executionTime ? 
          ((historicalBaseline.executionTime - session.startTime) / historicalBaseline.executionTime) * 100 : null,
        metadata: { 
          analystCount: session.context.analystCount,
          scheduleLength: Math.ceil((session.context.endDate.getTime() - session.context.startDate.getTime()) / (1000 * 60 * 60 * 24))
        }
      },
      {
        algorithmAuditId,
        metricType: 'conflict_rate',
        category: 'quality',
        value: performanceData.schedulesGenerated > 0 ? 
          (performanceData.conflictsFound / performanceData.schedulesGenerated) * 100 : 0,
        baseline: historicalBaseline.conflictRate,
        improvement: historicalBaseline.conflictRate ? 
          ((historicalBaseline.conflictRate - (performanceData.conflictsFound / performanceData.schedulesGenerated * 100)) / historicalBaseline.conflictRate) * 100 : null,
        metadata: { 
          totalSchedules: performanceData.schedulesGenerated,
          totalConflicts: performanceData.conflictsFound
        }
      }
    ];

    await this.prisma.performanceMetrics.createMany({
      data: metrics
    });
  }

  /**
   * Generate recommendations based on algorithm performance
   */
  private async generateRecommendations(
    algorithmAuditId: string,
    session: AuditSession,
    performanceData: PerformanceData
  ): Promise<void> {
    const recommendations: RecommendationContext[] = [];

    // Analyze fairness score
    if (performanceData.fairnessScore < 0.7) {
      recommendations.push({
        type: 'CONFIGURATION_CHANGE',
        priority: 'HIGH',
        title: 'Improve Fairness Score',
        description: `Current fairness score of ${performanceData.fairnessScore.toFixed(3)} is below optimal threshold (0.7). Consider adjusting fairness weight or weekend rotation strategy.`,
        currentValue: {
          fairnessWeight: session.configuration.fairnessWeight,
          weekendRotationStrategy: session.configuration.weekendRotationStrategy
        },
        recommendedValue: {
          fairnessWeight: Math.min(1.0, session.configuration.fairnessWeight + 0.1),
          weekendRotationStrategy: session.configuration.weekendRotationStrategy === 'SEQUENTIAL' ? 'FAIRNESS_OPTIMIZED' : session.configuration.weekendRotationStrategy
        },
        expectedImprovement: 15,
        confidence: 0.8,
        analysisData: {
          currentScore: performanceData.fairnessScore,
          threshold: 0.7,
          deficit: 0.7 - performanceData.fairnessScore
        }
      });
    }

    // Analyze conflict rate
    const conflictRate = performanceData.schedulesGenerated > 0 ? 
      (performanceData.conflictsFound / performanceData.schedulesGenerated) * 100 : 0;
    
    if (conflictRate > 5) { // More than 5% conflicts
      recommendations.push({
        type: 'STRATEGY_OPTIMIZATION',
        priority: 'MEDIUM',
        title: 'Reduce Conflict Rate',
        description: `High conflict rate of ${conflictRate.toFixed(1)}% detected. Consider strengthening constraint checking or adjusting optimization strategy.`,
        currentValue: {
          constraintWeight: session.configuration.constraintWeight,
          optimizationStrategy: session.configuration.optimizationStrategy
        },
        recommendedValue: {
          constraintWeight: Math.min(1.0, session.configuration.constraintWeight + 0.1),
          optimizationStrategy: session.configuration.optimizationStrategy === 'GREEDY' ? 'HILL_CLIMBING' : session.configuration.optimizationStrategy
        },
        expectedImprovement: 25,
        confidence: 0.75,
        analysisData: {
          conflictRate,
          threshold: 5,
          totalConflicts: performanceData.conflictsFound,
          totalSchedules: performanceData.schedulesGenerated
        }
      });
    }

    // Analyze randomization factor effectiveness
    if (session.configuration.randomizationFactor > 0.5 && performanceData.overallScore < 0.8) {
      recommendations.push({
        type: 'CONFIGURATION_CHANGE',
        priority: 'LOW',
        title: 'Optimize Randomization Factor',
        description: `High randomization factor (${session.configuration.randomizationFactor}) may be reducing overall effectiveness. Consider reducing for more consistent results.`,
        currentValue: {
          randomizationFactor: session.configuration.randomizationFactor
        },
        recommendedValue: {
          randomizationFactor: Math.max(0.1, session.configuration.randomizationFactor - 0.2)
        },
        expectedImprovement: 10,
        confidence: 0.6,
        analysisData: {
          currentFactor: session.configuration.randomizationFactor,
          overallScore: performanceData.overallScore,
          threshold: 0.8
        }
      });
    }

    // Store recommendations
    if (recommendations.length > 0) {
      const recommendationData = recommendations.map(rec => ({
        algorithmAuditId,
        type: rec.type,
        priority: rec.priority,
        title: rec.title,
        description: rec.description,
        currentValue: rec.currentValue ? rec.currentValue as any : null,
        recommendedValue: rec.recommendedValue ? rec.recommendedValue as any : null,
        expectedImprovement: rec.expectedImprovement,
        confidence: rec.confidence,
        analysisData: rec.analysisData ? rec.analysisData as any : null
      }));

      await this.prisma.auditRecommendation.createMany({
        data: recommendationData
      });

      tracingService.logSummary('audit_recommendations_generated', {
        success: true,
        summary: `Generated ${recommendations.length} recommendations`,
        metrics: {
          recommendationCount: recommendations.length,
          highPriority: recommendations.filter(r => r.priority === 'HIGH').length,
          mediumPriority: recommendations.filter(r => r.priority === 'MEDIUM').length
        }
      });
    }
  }

  /**
   * Calculate historical baseline for comparison
   */
  private async calculateHistoricalBaseline(algorithmName: string) {
    const recentAudits = await this.prisma.algorithmAudit.findMany({
      where: {
        algorithmName,
        success: true,
        createdAt: {
          gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) // Last 30 days
        }
      },
      orderBy: { createdAt: 'desc' },
      take: 10
    });

    if (recentAudits.length === 0) {
      return {
        fairnessScore: null,
        efficiencyScore: null,
        constraintScore: null,
        executionTime: null,
        conflictRate: null
      };
    }

    const averages = recentAudits.reduce((acc, audit) => {
      acc.fairnessScore += audit.fairnessScore;
      acc.efficiencyScore += audit.efficiencyScore;
      acc.constraintScore += audit.constraintScore;
      acc.executionTime += audit.executionTime;
      acc.conflictRate += audit.schedulesGenerated > 0 ? 
        (audit.conflictsFound / audit.schedulesGenerated) * 100 : 0;
      return acc;
    }, {
      fairnessScore: 0,
      efficiencyScore: 0,
      constraintScore: 0,
      executionTime: 0,
      conflictRate: 0
    });

    const count = recentAudits.length;
    return {
      fairnessScore: averages.fairnessScore / count,
      efficiencyScore: averages.efficiencyScore / count,
      constraintScore: averages.constraintScore / count,
      executionTime: averages.executionTime / count,
      conflictRate: averages.conflictRate / count
    };
  }

  /**
   * Get audit analytics for dashboard
   */
  async getAuditAnalytics(algorithmName?: string, days: number = 30) {
    const whereClause = {
      ...(algorithmName && { algorithmName }),
      createdAt: {
        gte: new Date(Date.now() - days * 24 * 60 * 60 * 1000)
      }
    };

    const [totalAudits, successfulAudits, avgMetrics, recentRecommendations] = await Promise.all([
      this.prisma.algorithmAudit.count({ where: whereClause }),
      this.prisma.algorithmAudit.count({ where: { ...whereClause, success: true } }),
      this.prisma.algorithmAudit.aggregate({
        where: { ...whereClause, success: true },
        _avg: {
          fairnessScore: true,
          constraintScore: true,
          efficiencyScore: true,
          overallScore: true,
          executionTime: true
        }
      }),
      this.prisma.auditRecommendation.findMany({
        where: {
          createdAt: {
            gte: new Date(Date.now() - days * 24 * 60 * 60 * 1000)
          },
          status: 'PENDING'
        },
        orderBy: [
          { priority: 'desc' },
          { confidence: 'desc' }
        ],
        take: 10
      })
    ]);

    return {
      summary: {
        totalAudits,
        successfulAudits,
        successRate: totalAudits > 0 ? (successfulAudits / totalAudits) * 100 : 0,
        pendingRecommendations: recentRecommendations.length
      },
      averageMetrics: {
        fairnessScore: avgMetrics._avg.fairnessScore || 0,
        constraintScore: avgMetrics._avg.constraintScore || 0,
        efficiencyScore: avgMetrics._avg.efficiencyScore || 0,
        overallScore: avgMetrics._avg.overallScore || 0,
        executionTime: avgMetrics._avg.executionTime || 0
      },
      recommendations: recentRecommendations
    };
  }

  /**
   * Get performance trends over time
   */
  async getPerformanceTrends(algorithmName: string, days: number = 30) {
    const audits = await this.prisma.algorithmAudit.findMany({
      where: {
        algorithmName,
        success: true,
        createdAt: {
          gte: new Date(Date.now() - days * 24 * 60 * 60 * 1000)
        }
      },
      orderBy: { createdAt: 'asc' },
      select: {
        createdAt: true,
        fairnessScore: true,
        constraintScore: true,
        efficiencyScore: true,
        overallScore: true,
        executionTime: true,
        conflictsFound: true,
        schedulesGenerated: true
      }
    });

    return audits.map(audit => ({
      date: audit.createdAt,
      fairnessScore: audit.fairnessScore,
      constraintScore: audit.constraintScore,
      efficiencyScore: audit.efficiencyScore,
      overallScore: audit.overallScore,
      executionTime: audit.executionTime,
      conflictRate: audit.schedulesGenerated > 0 ? 
        (audit.conflictsFound / audit.schedulesGenerated) * 100 : 0
    }));
  }
}

// Export singleton instance
export const algorithmAuditService = new AlgorithmAuditService(
  // This will be injected when the service is used
  null as any
);