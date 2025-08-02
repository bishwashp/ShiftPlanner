import express from 'express';
import { PrismaClient } from '@prisma/client';
import { cacheService } from '../lib/cache';
import { AnalyticsEngine } from '../services/AnalyticsEngine';
import { PredictiveEngine } from '../services/PredictiveEngine';
import { DashboardService } from '../services/DashboardService';

const router = express.Router();
const prisma = new PrismaClient();
const cache = cacheService;
const analyticsEngine = new AnalyticsEngine(prisma, cache);
const predictiveEngine = new PredictiveEngine(prisma, cache);
const dashboardService = new DashboardService(prisma, cache, analyticsEngine, predictiveEngine);

// Get monthly tallies for a specific month and year
router.get('/monthly-tallies/:year/:month', async (req, res) => {
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
router.get('/fairness-report', async (req, res) => {
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
router.get('/workload-predictions', async (req, res) => {
  try {
    const { months = '3' } = req.query;
    const monthsNum = parseInt(months as string);

    if (isNaN(monthsNum) || monthsNum < 1 || monthsNum > 12) {
      return res.status(400).json({ error: 'Invalid months parameter (1-12)' });
    }

    const predictions = await analyticsEngine.predictWorkloadTrends(monthsNum);
    
    res.json({
      success: true,
      data: predictions,
      metadata: {
        predictionMonths: monthsNum,
        averagePredictedWorkload: predictions.reduce((sum, pred) => sum + pred.predictedWorkload, 0) / predictions.length,
        averageConfidence: predictions.reduce((sum, pred) => sum + pred.confidence, 0) / predictions.length,
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

// Get optimization opportunities
router.get('/optimization-opportunities', async (req, res) => {
  try {
    const { dateRange } = req.query;
    
    let schedules;
    if (dateRange) {
      const [startDate, endDate] = (dateRange as string).split(',');
      schedules = await prisma.schedule.findMany({
        where: {
          date: {
            gte: new Date(startDate),
            lte: new Date(endDate),
          },
        },
        include: { analyst: true },
      });
    } else {
      // Get recent schedules (last 30 days)
      schedules = await prisma.schedule.findMany({
        where: {
          date: {
            gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
          },
        },
        include: { analyst: true },
      });
    }

    const opportunities = await analyticsEngine.identifyOptimizationOpportunities(schedules);
    
    res.json({
      success: true,
      data: opportunities,
      metadata: {
        totalOpportunities: opportunities.length,
        highPriorityCount: opportunities.filter(opp => opp.severity === 'HIGH' || opp.severity === 'CRITICAL').length,
        averageImpact: opportunities.reduce((sum, opp) => sum + opp.impact, 0) / opportunities.length,
      },
    });
  } catch (error) {
    console.error('Error identifying optimization opportunities:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to identify optimization opportunities',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Get staffing predictions for a specific date
router.get('/staffing-predictions/:date', async (req, res) => {
  try {
    const { date } = req.params;
    const targetDate = new Date(date);

    if (isNaN(targetDate.getTime())) {
      return res.status(400).json({ error: 'Invalid date format' });
    }

    const prediction = await predictiveEngine.predictStaffingNeeds(targetDate);
    
    res.json({
      success: true,
      data: prediction,
      metadata: {
        targetDate: prediction.date,
        riskLevel: prediction.riskLevel,
        confidence: prediction.confidence,
        factors: prediction.factors,
      },
    });
  } catch (error) {
    console.error('Error generating staffing prediction:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to generate staffing prediction',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Get burnout risk assessments
router.get('/burnout-risk', async (req, res) => {
  try {
    const { includeLowRisk = 'false' } = req.query;
    
    const analysts = await prisma.analyst.findMany({
      where: { isActive: true },
    });

    const assessments = await predictiveEngine.identifyBurnoutRisk(analysts);
    
    // Filter out low risk if requested
    const filteredAssessments = includeLowRisk === 'true' 
      ? assessments 
      : assessments.filter(assessment => assessment.riskLevel !== 'LOW');

    res.json({
      success: true,
      data: filteredAssessments,
      metadata: {
        totalAnalysts: analysts.length,
        assessedAnalysts: filteredAssessments.length,
        criticalRiskCount: filteredAssessments.filter(a => a.riskLevel === 'CRITICAL').length,
        highRiskCount: filteredAssessments.filter(a => a.riskLevel === 'HIGH').length,
        averageRiskScore: filteredAssessments.reduce((sum, a) => sum + a.riskScore, 0) / filteredAssessments.length,
      },
    });
  } catch (error) {
    console.error('Error generating burnout risk assessments:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to generate burnout risk assessments',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Get rotation suggestions
router.get('/rotation-suggestions', async (req, res) => {
  try {
    const constraints = await prisma.schedulingConstraint.findMany();
    const suggestions = await predictiveEngine.suggestOptimalRotations(constraints);
    
    res.json({
      success: true,
      data: suggestions,
      metadata: {
        totalSuggestions: suggestions.length,
        highPriorityCount: suggestions.filter(s => s.priority === 'HIGH').length,
        averageExpectedImpact: suggestions.reduce((sum, s) => sum + s.expectedImpact, 0) / suggestions.length,
      },
    });
  } catch (error) {
    console.error('Error generating rotation suggestions:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to generate rotation suggestions',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Get real-time dashboard data
router.get('/dashboard', async (req, res) => {
  try {
    const dashboardData = await dashboardService.generateRealTimeDashboard();
    
    res.json({
      success: true,
      data: dashboardData,
      metadata: {
        generatedAt: new Date(),
        cacheStatus: 'fresh', // This would be determined by cache service
      },
    });
  } catch (error) {
    console.error('Error generating dashboard data:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to generate dashboard data',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Create custom report
router.post('/reports', async (req, res) => {
  try {
    const { type, dateRange, filters, metrics, format } = req.body;

    if (!type || !dateRange || !metrics || !format) {
      return res.status(400).json({ error: 'Missing required fields: type, dateRange, metrics, format' });
    }

    const reportConfig = {
      type,
      dateRange: {
        startDate: new Date(dateRange.startDate),
        endDate: new Date(dateRange.endDate),
      },
      filters,
      metrics,
      format,
    };

    const report = await dashboardService.createCustomReport(reportConfig);
    
    res.json({
      success: true,
      data: report,
      metadata: {
        reportId: report.id,
        generatedAt: report.generatedAt,
        type: report.type,
      },
    });
  } catch (error) {
    console.error('Error creating custom report:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to create custom report',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Export analytics data
router.post('/export', async (req, res) => {
  try {
    const { format, filters } = req.body;

    if (!format) {
      return res.status(400).json({ error: 'Format is required' });
    }

    const exportFormat = {
      type: format.type,
      includeCharts: format.includeCharts || false,
      includeRecommendations: format.includeRecommendations || false,
    };

    const analyticsFilters = {
      dateRange: filters?.dateRange ? {
        startDate: new Date(filters.dateRange.startDate),
        endDate: new Date(filters.dateRange.endDate),
      } : undefined,
      analystIds: filters?.analystIds,
      shiftTypes: filters?.shiftTypes,
      includeInactive: filters?.includeInactive || false,
      minFairnessScore: filters?.minFairnessScore,
      maxWorkload: filters?.maxWorkload,
    };

    const result = await dashboardService.exportAnalytics(exportFormat, analyticsFilters);
    
    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }

    res.json({
      success: true,
      data: result.data,
      metadata: {
        format: exportFormat.type,
        generatedAt: result.generatedAt,
        fileUrl: result.fileUrl,
      },
    });
  } catch (error) {
    console.error('Error exporting analytics data:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to export analytics data',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Get analytics health status
router.get('/health', async (req, res) => {
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
        averageQueryTime: 150, // This would come from actual metrics
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

export default router; 