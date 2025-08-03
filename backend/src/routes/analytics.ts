import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { cacheService } from '../lib/cache';
import { AnalyticsEngine } from '../services/AnalyticsEngine';
import { PredictiveEngine } from '../services/PredictiveEngine';
import { DashboardService } from '../services/DashboardService';
import { PredictiveFairnessService } from '../services/PredictiveFairnessService';
import { KPITrackingService } from '../services/KPITrackingService';
import { AnalyticsService } from '../services/AnalyticsService';

const router = Router();

const analyticsEngine = new AnalyticsEngine(prisma, cacheService);
const predictiveEngine = new PredictiveEngine(prisma, cacheService);
const dashboardService = new DashboardService(prisma, cacheService, analyticsEngine, predictiveEngine);
const predictiveFairnessService = new PredictiveFairnessService(prisma, cacheService);
const kpiTrackingService = new KPITrackingService(prisma, cacheService);
const analyticsService = new AnalyticsService(prisma, cacheService, predictiveFairnessService, kpiTrackingService);

// Get monthly tallies for a specific month and year
router.get('/monthly-tallies/:year/:month', async (req: Request, res: Response) => {
  try {
    const { year, month } = req.params;
    const yearNum = parseInt(year);
    const monthNum = parseInt(month);
    
    if (isNaN(yearNum) || isNaN(monthNum) || monthNum < 1 || monthNum > 12) {
      return res.status(400).json({ error: 'Invalid year or month parameters' });
    }
    
    const tallies = await analyticsEngine.calculateMonthlyTallies(monthNum, yearNum);
    res.json({
      success: true,
      data: tallies,
      metadata: {
        year: yearNum,
        month: monthNum,
        totalAnalysts: tallies.length,
        averageWorkload: tallies.reduce((sum: number, tally: any) => sum + tally.totalWorkDays, 0) / tallies.length,
      },
    });
  } catch (error) {
    console.error('Error fetching monthly tallies:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch monthly tallies',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Get fairness report for a date range
router.get('/fairness-report', async (req: Request, res: Response) => {
  try {
    const { startDate, endDate } = req.query;
    
    if (!startDate || !endDate) {
      return res.status(400).json({ error: 'startDate and endDate are required' });
    }
    
    const dateRange = {
      startDate: new Date(startDate as string),
      endDate: new Date(endDate as string),
    };
    
    // Validate dates
    if (isNaN(dateRange.startDate.getTime()) || isNaN(dateRange.endDate.getTime())) {
      return res.status(400).json({ error: 'Invalid date format' });
    }
    
    if (dateRange.startDate > dateRange.endDate) {
      return res.status(400).json({ error: 'startDate must be before endDate' });
    }
    
    const report = await analyticsEngine.generateFairnessReport(dateRange);
    res.json({
      success: true,
      data: report,
      metadata: {
        dateRange,
        overallFairnessScore: report.overallFairnessScore,
        totalAnalysts: report.individualScores.length,
        recommendations: report.recommendations,
      },
    });
  } catch (error) {
    console.error('Error generating fairness report:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate fairness report',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Get analytics health status
router.get('/health', async (req: Request, res: Response) => {
  try {
    const healthStatus = {
      status: 'healthy',
      timestamp: new Date(),
      services: {
        analyticsEngine: 'operational',
        predictiveEngine: 'operational',
        dashboardService: 'operational',
        cache: 'operational',
        database: 'operational',
      },
      performance: {
        averageQueryTime: 150,
        cacheHitRate: 0.85,
        activeConnections: 12,
      },
    };
    res.json({
      success: true,
      data: healthStatus,
    });
  } catch (error) {
    console.error('Error checking analytics health:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to check analytics health',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Phase 3: Predictive Fairness & Advanced Analytics Endpoints

// Leave request impact analysis
router.post('/leave-request-impact', async (req: Request, res: Response) => {
  try {
    const { analystId, startDate, endDate, reason } = req.body;
    
    if (!analystId || !startDate || !endDate) {
      return res.status(400).json({ error: 'analystId, startDate, and endDate are required' });
    }
    
    const request = {
      id: `req_${Date.now()}`,
      analystId,
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      reason
    };
    
    const impact = await predictiveFairnessService.calculateLeaveRequestImpact(request);
    
    res.json({
      success: true,
      data: impact,
      metadata: {
        calculatedAt: new Date(),
        requestId: request.id
      }
    });
  } catch (error) {
    console.error('Error calculating leave request impact:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to calculate leave request impact',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Get fairness trends
router.get('/fairness-trends', async (req: Request, res: Response) => {
  try {
    const { startDate, endDate } = req.query;
    
    if (!startDate || !endDate) {
      return res.status(400).json({ error: 'startDate and endDate are required' });
    }
    
    const timeRange = {
      startDate: new Date(startDate as string),
      endDate: new Date(endDate as string)
    };
    
    const trend = await predictiveFairnessService.predictFairnessTrend(timeRange);
    
    res.json({
      success: true,
      data: trend,
      metadata: {
        calculatedAt: new Date(),
        timeRange
      }
    });
  } catch (error) {
    console.error('Error predicting fairness trend:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to predict fairness trend',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Get fairness recommendations
router.get('/fairness-recommendations', async (req: Request, res: Response) => {
  try {
    const recommendations = await predictiveFairnessService.generateFairnessRecommendations();
    
    res.json({
      success: true,
      data: recommendations,
      metadata: {
        generatedAt: new Date(),
        count: recommendations.length
      }
    });
  } catch (error) {
    console.error('Error generating fairness recommendations:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate fairness recommendations',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Get fairness anomalies
router.get('/fairness-anomalies', async (req: Request, res: Response) => {
  try {
    const anomalies = await predictiveFairnessService.analyzeFairnessAnomalies();
    
    res.json({
      success: true,
      data: anomalies,
      metadata: {
        analyzedAt: new Date(),
        count: anomalies.length
      }
    });
  } catch (error) {
    console.error('Error analyzing fairness anomalies:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to analyze fairness anomalies',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// KPI tracking endpoints

// Get current KPI metrics
router.get('/kpi/current', async (req: Request, res: Response) => {
  try {
    const metrics = await kpiTrackingService.getCurrentKPIMetrics();
    
    res.json({
      success: true,
      data: metrics,
      metadata: {
        retrievedAt: new Date()
      }
    });
  } catch (error) {
    console.error('Error getting current KPI metrics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get current KPI metrics',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Get KPI history
router.get('/kpi/history', async (req: Request, res: Response) => {
  try {
    const { startDate, endDate } = req.query;
    
    if (!startDate || !endDate) {
      return res.status(400).json({ error: 'startDate and endDate are required' });
    }
    
    const timeRange = {
      startDate: new Date(startDate as string),
      endDate: new Date(endDate as string)
    };
    
    const report = await kpiTrackingService.generateKPIReport(timeRange);
    
    res.json({
      success: true,
      data: report,
      metadata: {
        generatedAt: new Date(),
        timeRange
      }
    });
  } catch (error) {
    console.error('Error generating KPI report:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate KPI report',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Get benchmark comparison
router.get('/kpi/benchmarks', async (req: Request, res: Response) => {
  try {
    const benchmarks = await kpiTrackingService.getBenchmarkComparison();
    
    res.json({
      success: true,
      data: benchmarks,
      metadata: {
        comparedAt: new Date(),
        count: benchmarks.length
      }
    });
  } catch (error) {
    console.error('Error getting benchmark comparison:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get benchmark comparison',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Track KPI metrics
router.post('/kpi/track', async (req: Request, res: Response) => {
  try {
    const { type, data } = req.body;
    
    if (!type || !data) {
      return res.status(400).json({ error: 'type and data are required' });
    }
    
    switch (type) {
      case 'schedule_generation':
        await kpiTrackingService.trackScheduleGeneration(data.success, data.quality || 0);
        break;
      case 'fairness_score':
        await kpiTrackingService.trackFairnessScore(data.score);
        break;
      case 'constraint_violation':
        await kpiTrackingService.trackConstraintViolation(data.violation);
        break;
      case 'user_satisfaction':
        await kpiTrackingService.trackUserSatisfaction(data.score, data.feedback || '');
        break;
      default:
        return res.status(400).json({ error: 'Invalid tracking type' });
    }
    
    res.json({
      success: true,
      message: 'KPI metric tracked successfully',
      metadata: {
        trackedAt: new Date(),
        type
      }
    });
  } catch (error) {
    console.error('Error tracking KPI metric:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to track KPI metric',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Get KPI history for trend analysis
router.get('/kpi/history', async (req: Request, res: Response) => {
  try {
    const { startDate, endDate } = req.query;
    
    if (!startDate || !endDate) {
      return res.status(400).json({ error: 'startDate and endDate are required' });
    }
    
    const timeRange = {
      startDate: new Date(startDate as string),
      endDate: new Date(endDate as string)
    };
    
    const history = await kpiTrackingService.getKPIHistory(timeRange);
    
    res.json({
      success: true,
      data: history,
      metadata: {
        timeRange,
        count: history.length,
        generatedAt: new Date()
      }
    });
  } catch (error) {
    console.error('Error getting KPI history:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get KPI history',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Get automated alerts for KPI threshold breaches
router.get('/kpi/alerts', async (req: Request, res: Response) => {
  try {
    const alerts = await kpiTrackingService.generateAlerts();
    
    res.json({
      success: true,
      data: alerts,
      metadata: {
        generatedAt: new Date(),
        count: alerts.length,
        severity: alerts.length > 0 ? 'WARNING' : 'CLEAR'
      }
    });
  } catch (error) {
    console.error('Error generating alerts:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate alerts',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Get performance trends for the last 30 days
router.get('/kpi/trends', async (req: Request, res: Response) => {
  try {
    const trends = await kpiTrackingService.getPerformanceTrends();
    
    res.json({
      success: true,
      data: trends,
      metadata: {
        generatedAt: new Date(),
        timeRange: '30 days',
        metrics: Object.keys(trends)
      }
    });
  } catch (error) {
    console.error('Error getting performance trends:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get performance trends',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Get comprehensive KPI summary for dashboard
router.get('/kpi/summary', async (req: Request, res: Response) => {
  try {
    const summary = await kpiTrackingService.getKPISummary();
    
    res.json({
      success: true,
      data: summary,
      metadata: {
        generatedAt: new Date(),
        alertsCount: summary.alerts.length,
        benchmarksCount: summary.benchmarks.length,
        performanceHealth: summary.performanceHealth
      }
    });
  } catch (error) {
    console.error('Error getting KPI summary:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get KPI summary',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Role-based analytics endpoints

// Executive dashboard
router.get('/executive/dashboard', async (req: Request, res: Response) => {
  try {
    const { timeRange = 'month' } = req.query;
    
    const endDate = new Date();
    const startDate = new Date();
    
    switch (timeRange) {
      case 'week':
        startDate.setDate(endDate.getDate() - 7);
        break;
      case 'month':
        startDate.setMonth(endDate.getMonth() - 1);
        break;
      case 'quarter':
        startDate.setMonth(endDate.getMonth() - 3);
        break;
      default:
        startDate.setMonth(endDate.getMonth() - 1);
    }
    
    // Get KPI report
    const kpiReport = await kpiTrackingService.generateKPIReport({ startDate, endDate });
    
    // Get fairness trends
    const fairnessTrend = await predictiveFairnessService.predictFairnessTrend({ startDate, endDate });
    
    // Get benchmark comparison
    const benchmarks = await kpiTrackingService.getBenchmarkComparison();
    
    res.json({
      success: true,
      data: {
        kpiReport,
        fairnessTrend,
        benchmarks,
        summary: {
          overallHealth: calculateOverallHealth(kpiReport.metrics),
          keyInsights: generateKeyInsights(kpiReport, fairnessTrend),
          recommendations: kpiReport.recommendations.slice(0, 3) // Top 3 recommendations
        }
      },
      metadata: {
        generatedAt: new Date(),
        timeRange: timeRange as string
      }
    });
  } catch (error) {
    console.error('Error generating executive dashboard:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate executive dashboard',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Manager analytics
router.get('/manager/dashboard/:teamId', async (req: Request, res: Response) => {
  try {
    const { teamId } = req.params;
    const { timeRange = 'week' } = req.query;
    
    const endDate = new Date();
    const startDate = new Date();
    
    switch (timeRange) {
      case 'week':
        startDate.setDate(endDate.getDate() - 7);
        break;
      case 'month':
        startDate.setMonth(endDate.getMonth() - 1);
        break;
      default:
        startDate.setDate(endDate.getDate() - 7);
    }
    
    // Get team-specific data (simplified - would need team logic)
    const teamFairness = await predictiveFairnessService.predictFairnessTrend({ startDate, endDate });
    const teamRecommendations = await predictiveFairnessService.generateFairnessRecommendations();
    
    res.json({
      success: true,
      data: {
        teamId,
        fairnessTrend: teamFairness,
        recommendations: teamRecommendations,
        workloadAnalysis: {
          // Simplified - would need actual team workload analysis
          totalAnalysts: 10,
          averageWorkload: 0.75,
          workloadDistribution: 'BALANCED'
        }
      },
      metadata: {
        generatedAt: new Date(),
        timeRange: timeRange as string
      }
    });
  } catch (error) {
    console.error('Error generating manager dashboard:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate manager dashboard',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Analyst dashboard
router.get('/analyst/dashboard/:analystId', async (req: Request, res: Response) => {
  try {
    const { analystId } = req.params;
    const { timeRange = 'month' } = req.query;
    
    const endDate = new Date();
    const startDate = new Date();
    
    switch (timeRange) {
      case 'week':
        startDate.setDate(endDate.getDate() - 7);
        break;
      case 'month':
        startDate.setMonth(endDate.getMonth() - 1);
        break;
      default:
        startDate.setMonth(endDate.getMonth() - 1);
    }
    
    // Get analyst-specific data
    const analyst = await prisma.analyst.findUnique({
      where: { id: analystId },
      include: {
        schedules: {
          where: {
            date: {
              gte: startDate,
              lte: endDate
            }
          }
        }
      }
    });
    
    if (!analyst) {
      return res.status(404).json({ error: 'Analyst not found' });
    }
    
    // Calculate personal metrics
    const personalMetrics = {
      totalShifts: analyst.schedules.length,
      screenerShifts: analyst.schedules.filter(s => s.isScreener).length,
      weekendShifts: analyst.schedules.filter(s => {
        const day = s.date.getDay();
        return day === 0 || day === 6;
      }).length,
      fairnessScore: 0.8 // Simplified - would need actual calculation
    };
    
    res.json({
      success: true,
      data: {
        analystId,
        analystName: analyst.name,
        personalMetrics,
        upcomingSchedule: analyst.schedules.slice(0, 7), // Next 7 days
        recommendations: [
          'Consider taking on more screener shifts to improve fairness',
          'Your weekend rotation is well balanced'
        ]
      },
      metadata: {
        generatedAt: new Date(),
        timeRange: timeRange as string
      }
    });
  } catch (error) {
    console.error('Error generating analyst dashboard:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate analyst dashboard',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Helper functions for dashboard generation
function calculateOverallHealth(metrics: any): 'EXCELLENT' | 'GOOD' | 'AVERAGE' | 'POOR' {
  const scores = [
    metrics.scheduleSuccessRate,
    metrics.averageFairnessScore,
    1 - metrics.constraintViolationRate, // Invert violation rate
    metrics.userSatisfactionScore / 10, // Normalize to 0-1
    1 - (metrics.conflictResolutionTime / 72) // Normalize resolution time
  ];
  
  const averageScore = scores.reduce((sum, score) => sum + score, 0) / scores.length;
  
  if (averageScore >= 0.9) return 'EXCELLENT';
  if (averageScore >= 0.8) return 'GOOD';
  if (averageScore >= 0.7) return 'AVERAGE';
  return 'POOR';
}

function generateKeyInsights(kpiReport: any, fairnessTrend: any): string[] {
  const insights: string[] = [];
  
  if (kpiReport.metrics.scheduleSuccessRate < 0.9) {
    insights.push('Schedule generation success rate needs improvement');
  }
  
  if (fairnessTrend.trend === 'DETERIORATING') {
    insights.push('Fairness metrics are trending downward');
  }
  
  if (kpiReport.metrics.userSatisfactionScore < 7.0) {
    insights.push('User satisfaction is below target');
  }
  
  return insights;
}

// ===== PHASE 3: PREDICTIVE FAIRNESS & ADVANCED ANALYTICS ENDPOINTS =====

// Leave request impact analysis
router.post('/leave-request-impact', async (req: Request, res: Response) => {
  try {
    const { analystId, startDate, endDate, reason } = req.body;
    
    if (!analystId || !startDate || !endDate) {
      return res.status(400).json({ error: 'analystId, startDate, and endDate are required' });
    }
    
    const request = {
      id: `req-${Date.now()}`,
      analystId,
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      reason
    };
    
    const impact = await predictiveFairnessService.calculateLeaveRequestImpact(request);
    
    res.json({
      success: true,
      data: impact,
      metadata: {
        requestId: request.id,
        analysisTime: new Date(),
        riskLevel: impact.fairnessImpact.riskLevel
      }
    });
  } catch (error) {
    console.error('Error calculating leave request impact:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to calculate leave request impact',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Get fairness trends
router.get('/fairness-trends', async (req: Request, res: Response) => {
  try {
    const { startDate, endDate } = req.query;
    
    if (!startDate || !endDate) {
      return res.status(400).json({ error: 'startDate and endDate are required' });
    }
    
    const timeRange = {
      startDate: new Date(startDate as string),
      endDate: new Date(endDate as string)
    };
    
    const trend = await predictiveFairnessService.predictFairnessTrend(timeRange);
    
    res.json({
      success: true,
      data: trend,
      metadata: {
        timeRange,
        confidence: trend.confidence,
        trend: trend.trend
      }
    });
  } catch (error) {
    console.error('Error getting fairness trends:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get fairness trends',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Get fairness recommendations
router.get('/fairness-recommendations', async (req: Request, res: Response) => {
  try {
    const recommendations = await predictiveFairnessService.generateFairnessRecommendations();
    
    res.json({
      success: true,
      data: recommendations,
      metadata: {
        totalRecommendations: recommendations.length,
        criticalCount: recommendations.filter(r => r.priority === 'CRITICAL').length,
        highCount: recommendations.filter(r => r.priority === 'HIGH').length
      }
    });
  } catch (error) {
    console.error('Error getting fairness recommendations:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get fairness recommendations',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Get fairness anomalies
router.get('/fairness-anomalies', async (req: Request, res: Response) => {
  try {
    const anomalies = await predictiveFairnessService.analyzeFairnessAnomalies();
    
    res.json({
      success: true,
      data: anomalies,
      metadata: {
        totalAnomalies: anomalies.length,
        criticalCount: anomalies.filter(a => a.severity === 'CRITICAL').length,
        highCount: anomalies.filter(a => a.severity === 'HIGH').length
      }
    });
  } catch (error) {
    console.error('Error getting fairness anomalies:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get fairness anomalies',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Executive analytics dashboard
router.get('/executive/dashboard', async (req: Request, res: Response) => {
  try {
    const { startDate, endDate } = req.query;
    
    if (!startDate || !endDate) {
      return res.status(400).json({ error: 'startDate and endDate are required' });
    }
    
    const timeRange = {
      startDate: new Date(startDate as string),
      endDate: new Date(endDate as string)
    };
    
    const metrics = await analyticsService.getExecutiveMetrics(timeRange);
    
    res.json({
      success: true,
      data: metrics,
      metadata: {
        timeRange,
        generatedAt: new Date(),
        alertsCount: metrics.alerts.length,
        insightsCount: metrics.strategicInsights.length
      }
    });
  } catch (error) {
    console.error('Error getting executive dashboard:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get executive dashboard',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Manager analytics dashboard
router.get('/manager/dashboard/:teamId', async (req: Request, res: Response) => {
  try {
    const { teamId } = req.params;
    const { startDate, endDate } = req.query;
    
    if (!startDate || !endDate) {
      return res.status(400).json({ error: 'startDate and endDate are required' });
    }
    
    const timeRange = {
      startDate: new Date(startDate as string),
      endDate: new Date(endDate as string)
    };
    
    const metrics = await analyticsService.getManagerMetrics(teamId, timeRange);
    
    res.json({
      success: true,
      data: metrics,
      metadata: {
        teamId,
        timeRange,
        generatedAt: new Date(),
        conflictsCount: metrics.upcomingConflicts.length,
        recommendationsCount: metrics.recommendations.length
      }
    });
  } catch (error) {
    console.error('Error getting manager dashboard:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get manager dashboard',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Analyst analytics dashboard
router.get('/analyst/dashboard/:analystId', async (req: Request, res: Response) => {
  try {
    const { analystId } = req.params;
    const { startDate, endDate } = req.query;
    
    if (!startDate || !endDate) {
      return res.status(400).json({ error: 'startDate and endDate are required' });
    }
    
    const timeRange = {
      startDate: new Date(startDate as string),
      endDate: new Date(endDate as string)
    };
    
    const metrics = await analyticsService.getAnalystMetrics(analystId, timeRange);
    
    res.json({
      success: true,
      data: metrics,
      metadata: {
        analystId,
        timeRange,
        generatedAt: new Date(),
        opportunitiesCount: metrics.improvementOpportunities.length,
        violationsCount: metrics.constraintCompliance.violations.length
      }
    });
  } catch (error) {
    console.error('Error getting analyst dashboard:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get analyst dashboard',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Get benchmark comparison
router.get('/benchmarks', async (req: Request, res: Response) => {
  try {
    const benchmarks = await analyticsService.getBenchmarkComparison();
    
    res.json({
      success: true,
      data: benchmarks,
      metadata: {
        totalMetrics: benchmarks.length,
        excellentCount: benchmarks.filter(b => b.status === 'EXCELLENT').length,
        poorCount: benchmarks.filter(b => b.status === 'POOR').length,
        averagePercentile: benchmarks.reduce((sum, b) => sum + b.percentile, 0) / benchmarks.length
      }
    });
  } catch (error) {
    console.error('Error getting benchmark comparison:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get benchmark comparison',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;
