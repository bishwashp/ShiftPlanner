import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { cacheService } from '../lib/cache';
import { AnalyticsEngine } from '../services/AnalyticsEngine';
import { PredictiveEngine } from '../services/PredictiveEngine';
import { DashboardService } from '../services/DashboardService';

const router = Router();

const analyticsEngine = new AnalyticsEngine(prisma, cacheService);
const predictiveEngine = new PredictiveEngine(prisma, cacheService);
const dashboardService = new DashboardService(prisma, cacheService, analyticsEngine, predictiveEngine);

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
        averageWorkload: tallies.reduce((sum, tally) => sum + tally.totalWorkDays, 0) / tallies.length,
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

// Get workload predictions for future months
router.get('/workload-predictions', async (req: Request, res: Response) => {
  try {
    const { months = '3' } = req.query;
    const monthsNum = parseInt(months as string);
    
    if (isNaN(monthsNum) || monthsNum < 1 || monthsNum > 12) {
      return res.status(400).json({ error: 'Invalid months parameter (1-12)' });
    }
    
    const predictions = await predictiveEngine.predictWorkload(monthsNum);
    res.json({
      success: true,
      data: predictions,
      metadata: {
        predictionMonths: monthsNum,
        totalPredictions: predictions.length,
        averagePredictedWorkload: predictions.reduce((sum, pred) => sum + pred.predictedWorkDays, 0) / predictions.length,
      },
    });
  } catch (error) {
    console.error('Error generating workload predictions:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate workload predictions',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Get dashboard overview
router.get('/dashboard', async (req: Request, res: Response) => {
  try {
    const { startDate, endDate } = req.query;
    
    if (!startDate || !endDate) {
      return res.status(400).json({ error: 'startDate and endDate are required' });
    }
    
    const dateRange = {
      startDate: new Date(startDate as string),
      endDate: new Date(endDate as string),
    };
    
    const dashboard = await dashboardService.getDashboardOverview(dateRange);
    res.json({
      success: true,
      data: dashboard,
      metadata: {
        dateRange,
        generatedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('Error fetching dashboard data:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch dashboard data',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Get analyst performance metrics
router.get('/analyst-performance/:analystId', async (req: Request, res: Response) => {
  try {
    const { analystId } = req.params;
    const { startDate, endDate } = req.query;
    
    if (!startDate || !endDate) {
      return res.status(400).json({ error: 'startDate and endDate are required' });
    }
    
    const dateRange = {
      startDate: new Date(startDate as string),
      endDate: new Date(endDate as string),
    };
    
    const performance = await analyticsEngine.getAnalystPerformance(analystId, dateRange);
    res.json({
      success: true,
      data: performance,
      metadata: {
        analystId,
        dateRange,
        generatedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('Error fetching analyst performance:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch analyst performance',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Get team performance comparison
router.get('/team-performance', async (req: Request, res: Response) => {
  try {
    const { startDate, endDate } = req.query;
    
    if (!startDate || !endDate) {
      return res.status(400).json({ error: 'startDate and endDate are required' });
    }
    
    const dateRange = {
      startDate: new Date(startDate as string),
      endDate: new Date(endDate as string),
    };
    
    const teamPerformance = await analyticsEngine.getTeamPerformanceComparison(dateRange);
    res.json({
      success: true,
      data: teamPerformance,
      metadata: {
        dateRange,
        totalTeams: teamPerformance.length,
        generatedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('Error fetching team performance:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch team performance',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;
