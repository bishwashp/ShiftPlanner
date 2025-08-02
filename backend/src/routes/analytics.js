"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cache_1 = require("../lib/cache");
const AnalyticsEngine_1 = require("../services/AnalyticsEngine");
const PredictiveEngine_1 = require("../services/PredictiveEngine");
const DashboardService_1 = require("../services/DashboardService");
const prisma_1 = require("../lib/prisma");
const router = express_1.default.Router();
const prisma = prisma_1.prisma;
const cache = cache_1.cacheService;
const analyticsEngine = new AnalyticsEngine_1.AnalyticsEngine(prisma, cache);
const predictiveEngine = new PredictiveEngine_1.PredictiveEngine(prisma, cache);
const dashboardService = new DashboardService_1.DashboardService(prisma, cache, analyticsEngine, predictiveEngine);
// Get monthly tallies for a specific month and year
router.get('/monthly-tallies/:year/:month', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { year, month } = req.params;
        const yearNum = parseInt(year);
        const monthNum = parseInt(month);
        if (isNaN(yearNum) || isNaN(monthNum) || monthNum < 1 || monthNum > 12) {
            return res.status(400).json({ error: 'Invalid year or month parameters' });
        }
        const tallies = yield analyticsEngine.calculateMonthlyTallies(monthNum, yearNum);
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
    }
    catch (error) {
        console.error('Error fetching monthly tallies:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch monthly tallies',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
}));
// Get fairness report for a date range
router.get('/fairness-report', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { startDate, endDate } = req.query;
        if (!startDate || !endDate) {
            return res.status(400).json({ error: 'startDate and endDate are required' });
        }
        const dateRange = {
            startDate: new Date(startDate),
            endDate: new Date(endDate),
        };
        // Validate dates
        if (isNaN(dateRange.startDate.getTime()) || isNaN(dateRange.endDate.getTime())) {
            return res.status(400).json({ error: 'Invalid date format' });
        }
        if (dateRange.startDate > dateRange.endDate) {
            return res.status(400).json({ error: 'startDate must be before endDate' });
        }
        const report = yield analyticsEngine.generateFairnessReport(dateRange);
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
    }
    catch (error) {
        console.error('Error generating fairness report:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to generate fairness report',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
}));
// Get workload predictions for future months
router.get('/workload-predictions', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { months = '3' } = req.query;
        const monthsNum = parseInt(months);
        if (isNaN(monthsNum) || monthsNum < 1 || monthsNum > 12) {
            return res.status(400).json({ error: 'Invalid months parameter (1-12)' });
        }
        const predictions = yield analyticsEngine.predictWorkloadTrends(monthsNum);
        res.json({
            success: true,
            data: predictions,
            metadata: {
                predictionMonths: monthsNum,
                averagePredictedWorkload: predictions.reduce((sum, pred) => sum + pred.predictedWorkload, 0) / predictions.length,
                averageConfidence: predictions.reduce((sum, pred) => sum + pred.confidence, 0) / predictions.length,
            },
        });
    }
    catch (error) {
        console.error('Error generating workload predictions:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to generate workload predictions',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
}));
// Get optimization opportunities
router.get('/optimization-opportunities', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { dateRange } = req.query;
        let schedules;
        if (dateRange) {
            const [startDate, endDate] = dateRange.split(',');
            schedules = yield prisma.schedule.findMany({
                where: {
                    date: {
                        gte: new Date(startDate),
                        lte: new Date(endDate),
                    },
                },
                include: { analyst: true },
            });
        }
        else {
            // Get recent schedules (last 30 days)
            schedules = yield prisma.schedule.findMany({
                where: {
                    date: {
                        gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
                    },
                },
                include: { analyst: true },
            });
        }
        const opportunities = yield analyticsEngine.identifyOptimizationOpportunities(schedules);
        res.json({
            success: true,
            data: opportunities,
            metadata: {
                totalOpportunities: opportunities.length,
                highPriorityCount: opportunities.filter(opp => opp.severity === 'HIGH' || opp.severity === 'CRITICAL').length,
                averageImpact: opportunities.reduce((sum, opp) => sum + opp.impact, 0) / opportunities.length,
            },
        });
    }
    catch (error) {
        console.error('Error identifying optimization opportunities:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to identify optimization opportunities',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
}));
// Get staffing predictions for a specific date
router.get('/staffing-predictions/:date', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { date } = req.params;
        const targetDate = new Date(date);
        if (isNaN(targetDate.getTime())) {
            return res.status(400).json({ error: 'Invalid date format' });
        }
        const prediction = yield predictiveEngine.predictStaffingNeeds(targetDate);
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
    }
    catch (error) {
        console.error('Error generating staffing prediction:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to generate staffing prediction',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
}));
// Get burnout risk assessments
router.get('/burnout-risk', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { includeLowRisk = 'false' } = req.query;
        const analysts = yield prisma.analyst.findMany({
            where: { isActive: true },
        });
        const assessments = yield predictiveEngine.identifyBurnoutRisk(analysts);
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
    }
    catch (error) {
        console.error('Error generating burnout risk assessments:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to generate burnout risk assessments',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
}));
// Get rotation suggestions
router.get('/rotation-suggestions', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const constraints = yield prisma.schedulingConstraint.findMany();
        const suggestions = yield predictiveEngine.suggestOptimalRotations(constraints);
        res.json({
            success: true,
            data: suggestions,
            metadata: {
                totalSuggestions: suggestions.length,
                highPriorityCount: suggestions.filter(s => s.priority === 'HIGH').length,
                averageExpectedImpact: suggestions.reduce((sum, s) => sum + s.expectedImpact, 0) / suggestions.length,
            },
        });
    }
    catch (error) {
        console.error('Error generating rotation suggestions:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to generate rotation suggestions',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
}));
// Get real-time dashboard data
router.get('/dashboard', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const dashboardData = yield dashboardService.generateRealTimeDashboard();
        res.json({
            success: true,
            data: dashboardData,
            metadata: {
                generatedAt: new Date(),
                cacheStatus: 'fresh', // This would be determined by cache service
            },
        });
    }
    catch (error) {
        console.error('Error generating dashboard data:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to generate dashboard data',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
}));
// Create custom report
router.post('/reports', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
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
        const report = yield dashboardService.createCustomReport(reportConfig);
        res.json({
            success: true,
            data: report,
            metadata: {
                reportId: report.id,
                generatedAt: report.generatedAt,
                type: report.type,
            },
        });
    }
    catch (error) {
        console.error('Error creating custom report:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to create custom report',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
}));
// Export analytics data
router.post('/export', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
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
            dateRange: (filters === null || filters === void 0 ? void 0 : filters.dateRange) ? {
                startDate: new Date(filters.dateRange.startDate),
                endDate: new Date(filters.dateRange.endDate),
            } : undefined,
            analystIds: filters === null || filters === void 0 ? void 0 : filters.analystIds,
            shiftTypes: filters === null || filters === void 0 ? void 0 : filters.shiftTypes,
            includeInactive: (filters === null || filters === void 0 ? void 0 : filters.includeInactive) || false,
            minFairnessScore: filters === null || filters === void 0 ? void 0 : filters.minFairnessScore,
            maxWorkload: filters === null || filters === void 0 ? void 0 : filters.maxWorkload,
        };
        const result = yield dashboardService.exportAnalytics(exportFormat, analyticsFilters);
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
    }
    catch (error) {
        console.error('Error exporting analytics data:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to export analytics data',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
}));
// Get analytics health status
router.get('/health', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
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
    }
    catch (error) {
        console.error('Error checking analytics health:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to check analytics health',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
}));
exports.default = router;
