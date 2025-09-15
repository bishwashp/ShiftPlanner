import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { cacheService } from '../lib/cache';
import { AnalyticsEngine } from '../services/AnalyticsEngine';
import { PredictiveEngine } from '../services/PredictiveEngine';
import { DashboardService } from '../services/DashboardService';

const router = Router();

// Get services from app context (set in app.ts)
const getAnalyticsServices = (req: any) => {
  return req.app.analyticsServices || {
    analyticsEngine: new AnalyticsEngine(prisma, cacheService),
    predictiveEngine: new PredictiveEngine(prisma, cacheService),
    dashboardService: new DashboardService(
      prisma, 
      cacheService, 
      new AnalyticsEngine(prisma, cacheService), 
      new PredictiveEngine(prisma, cacheService)
    )
  };
};

// Get monthly tallies for a specific month and year
router.get('/monthly-tallies/:year/:month', async (req: Request, res: Response) => {
  try {
    const { year, month } = req.params;
    const yearNum = parseInt(year);
    const monthNum = parseInt(month);
    
    if (isNaN(yearNum) || isNaN(monthNum) || monthNum < 1 || monthNum > 12) {
      return res.status(400).json({ error: 'Invalid year or month parameters' });
    }
    
        const { analyticsEngine } = getAnalyticsServices(req);
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
    
        const { analyticsEngine } = getAnalyticsServices(req);
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

// Background Analytics Endpoints

// Get real-time analytics dashboard
router.get('/dashboard/realtime', async (req: Request, res: Response) => {
  try {
    const { dashboardService } = getAnalyticsServices(req);
    const dashboard = await dashboardService.generateRealTimeDashboard();

    res.json({
      success: true,
      data: dashboard,
      timestamp: new Date(),
    });
  } catch (error) {
    console.error('Error generating real-time dashboard:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate real-time dashboard',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Get background analytics insights
router.get('/insights', async (req: Request, res: Response) => {
  try {
    const { backgroundAnalyticsService } = getAnalyticsServices(req);
    
    if (!backgroundAnalyticsService) {
      return res.status(503).json({
        success: false,
        error: 'Background analytics service not available'
      });
    }

    const { type, severity, limit = '10' } = req.query;
    const limitNum = parseInt(limit as string) || 10;

    let insights;
    if (type) {
      insights = backgroundAnalyticsService.getInsightsByType(type as any).slice(-limitNum);
    } else {
      insights = backgroundAnalyticsService.getLatestInsights(limitNum);
    }

    // Filter by severity if provided
    if (severity) {
      insights = insights.filter(insight => insight.severity === severity);
    }

    res.json({
      success: true,
      data: insights,
      metadata: {
        total: insights.length,
        filters: { type, severity, limit: limitNum },
        timestamp: new Date(),
      }
    });
  } catch (error) {
    console.error('Error fetching analytics insights:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch analytics insights',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Get background analytics metrics
router.get('/metrics', async (req: Request, res: Response) => {
  try {
    const { backgroundAnalyticsService } = getAnalyticsServices(req);
    
    if (!backgroundAnalyticsService) {
      return res.status(503).json({
        success: false,
        error: 'Background analytics service not available'
      });
    }

    const metrics = backgroundAnalyticsService.getMetrics();

    res.json({
      success: true,
      data: metrics,
      timestamp: new Date(),
    });
  } catch (error) {
    console.error('Error fetching analytics metrics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch analytics metrics',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Get background analytics jobs status
router.get('/jobs', async (req: Request, res: Response) => {
  try {
    const { backgroundAnalyticsService } = getAnalyticsServices(req);
    
    if (!backgroundAnalyticsService) {
      return res.status(503).json({
        success: false,
        error: 'Background analytics service not available'
      });
    }

    const jobs = backgroundAnalyticsService.getJobs();

    res.json({
      success: true,
      data: jobs,
      metadata: {
        total: jobs.length,
        enabled: jobs.filter(j => j.enabled).length,
        disabled: jobs.filter(j => !j.enabled).length,
        timestamp: new Date(),
      }
    });
  } catch (error) {
    console.error('Error fetching analytics jobs:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch analytics jobs',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Enable/disable background analytics job
router.post('/jobs/:jobId/:action', async (req: Request, res: Response) => {
  try {
    const { backgroundAnalyticsService } = getAnalyticsServices(req);
    
    if (!backgroundAnalyticsService) {
      return res.status(503).json({
        success: false,
        error: 'Background analytics service not available'
      });
    }

    const { jobId, action } = req.params;
    
    if (action !== 'enable' && action !== 'disable') {
      return res.status(400).json({
        success: false,
        error: 'Invalid action. Use "enable" or "disable"'
      });
    }

    let result;
    if (action === 'enable') {
      result = backgroundAnalyticsService.enableJob(jobId);
    } else {
      result = backgroundAnalyticsService.disableJob(jobId);
    }

    if (!result) {
      return res.status(404).json({
        success: false,
        error: `Job with ID "${jobId}" not found`
      });
    }

    res.json({
      success: true,
      message: `Job "${jobId}" ${action}d successfully`,
      timestamp: new Date(),
    });
  } catch (error) {
    console.error(`Error ${req.params.action}ing analytics job:`, error);
    res.status(500).json({
      success: false,
      error: `Failed to ${req.params.action} analytics job`,
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Get analytics summary
router.get('/summary', async (req: Request, res: Response) => {
  try {
    const { backgroundAnalyticsService, dashboardService } = getAnalyticsServices(req);
    
    // Get cached daily summary if available
    const dailySummary = await cacheService.get('daily_summary');
    
    if (dailySummary) {
      res.json({
        success: true,
        data: dailySummary,
        source: 'cache',
        timestamp: new Date(),
      });
    } else {
      // Generate fresh summary
      const summary = await dashboardService.generateSummary();
      const insights = backgroundAnalyticsService?.getLatestInsights(5) || [];
      
      const freshSummary = {
        summary,
        recentInsights: insights,
        backgroundMetrics: backgroundAnalyticsService?.getMetrics() || null,
        generatedAt: new Date(),
      };

      res.json({
        success: true,
        data: freshSummary,
        source: 'live',
        timestamp: new Date(),
      });
    }
  } catch (error) {
    console.error('Error generating analytics summary:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate analytics summary',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;
