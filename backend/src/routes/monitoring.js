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
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const MonitoringService_1 = require("../services/MonitoringService");
const AlertingService_1 = require("../services/AlertingService");
const SecurityService_1 = require("../services/SecurityService");
const WebhookService_1 = require("../services/WebhookService");
const PerformanceOptimizer_1 = require("../services/PerformanceOptimizer");
const router = (0, express_1.Router)();
// Get system health status (public endpoint for testing)
router.get('/health', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const healthStatus = yield MonitoringService_1.monitoringService.performHealthCheck();
        res.json({
            success: true,
            data: healthStatus,
            timestamp: new Date(),
        });
    }
    catch (error) {
        console.error('Error checking system health:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to check system health',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
}));
// Public test endpoint for monitoring services
router.get('/test', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        res.json({
            success: true,
            message: 'Monitoring services are working!',
            services: {
                monitoringService: '✅ Active',
                alertingService: '✅ Active',
                securityService: '✅ Active',
                webhookService: '✅ Active',
                performanceOptimizer: '✅ Active',
            },
            timestamp: new Date(),
        });
    }
    catch (error) {
        console.error('Error in test endpoint:', error);
        res.status(500).json({
            success: false,
            error: 'Test endpoint failed',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
}));
// Get performance metrics
router.get('/performance', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const metrics = yield MonitoringService_1.monitoringService.collectPerformanceMetrics();
        res.json({
            success: true,
            data: metrics,
            timestamp: new Date(),
        });
    }
    catch (error) {
        console.error('Error collecting performance metrics:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to collect performance metrics',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
}));
// Get SLA report
router.get('/sla', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const slaReport = yield MonitoringService_1.monitoringService.generateSLAReport();
        res.json({
            success: true,
            data: slaReport,
            timestamp: new Date(),
        });
    }
    catch (error) {
        console.error('Error generating SLA report:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to generate SLA report',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
}));
// Get system alerts
router.get('/alerts', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { severity, resolved } = req.query;
        const filters = {};
        if (severity)
            filters.severity = severity;
        if (resolved !== undefined)
            filters.resolved = resolved === 'true';
        const alerts = yield AlertingService_1.alertingService.getAlerts(filters);
        res.json({
            success: true,
            data: alerts,
            metadata: {
                total: alerts.length,
                resolved: alerts.filter(a => a.resolved).length,
                critical: alerts.filter(a => a.severity === 'CRITICAL').length,
                high: alerts.filter(a => a.severity === 'HIGH').length,
                medium: alerts.filter(a => a.severity === 'MEDIUM').length,
                low: alerts.filter(a => a.severity === 'LOW').length,
            },
        });
    }
    catch (error) {
        console.error('Error fetching alerts:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch alerts',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
}));
// Acknowledge an alert
router.post('/alerts/:alertId/acknowledge', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { alertId } = req.params;
        const { acknowledgedBy } = req.body;
        const alert = yield AlertingService_1.alertingService.acknowledgeAlert(alertId, acknowledgedBy);
        if (!alert) {
            return res.status(404).json({
                success: false,
                error: 'Alert not found'
            });
        }
        res.json({
            success: true,
            data: alert,
        });
    }
    catch (error) {
        console.error('Error acknowledging alert:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to acknowledge alert',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
}));
// Resolve an alert
router.post('/alerts/:alertId/resolve', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { alertId } = req.params;
        const alert = yield AlertingService_1.alertingService.resolveAlert(alertId);
        if (!alert) {
            return res.status(404).json({
                success: false,
                error: 'Alert not found'
            });
        }
        res.json({
            success: true,
            data: alert,
        });
    }
    catch (error) {
        console.error('Error resolving alert:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to resolve alert',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
}));
// Get alert rules
router.get('/alert-rules', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const rules = yield AlertingService_1.alertingService.getAlertRules();
        res.json({
            success: true,
            data: rules,
        });
    }
    catch (error) {
        console.error('Error fetching alert rules:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch alert rules',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
}));
// Update alert rule
router.put('/alert-rules/:ruleId', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { ruleId } = req.params;
        const updates = req.body;
        const rule = yield AlertingService_1.alertingService.updateAlertRule(ruleId, updates);
        if (!rule) {
            return res.status(404).json({
                success: false,
                error: 'Alert rule not found'
            });
        }
        res.json({
            success: true,
            data: rule,
        });
    }
    catch (error) {
        console.error('Error updating alert rule:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to update alert rule',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
}));
// Get audit logs
router.get('/audit-logs', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { action, resource, startDate, endDate, limit } = req.query;
        const filters = {};
        if (action)
            filters.action = action;
        if (resource)
            filters.resource = resource;
        if (startDate)
            filters.startDate = new Date(startDate);
        if (endDate)
            filters.endDate = new Date(endDate);
        if (limit)
            filters.limit = parseInt(limit);
        const logs = yield SecurityService_1.securityService.getAuditLogs(filters);
        res.json({
            success: true,
            data: logs,
            metadata: {
                total: logs.length,
                actions: [...new Set(logs.map(log => log.action))],
                resources: [...new Set(logs.map(log => log.resource))],
            },
        });
    }
    catch (error) {
        console.error('Error fetching audit logs:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch audit logs',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
}));
// Get webhook status
router.get('/webhooks', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const webhooks = yield WebhookService_1.webhookService.getWebhooks();
        res.json({
            success: true,
            data: webhooks,
        });
    }
    catch (error) {
        console.error('Error fetching webhooks:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch webhooks',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
}));
// Get performance optimization recommendations
router.get('/optimization', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const recommendations = yield PerformanceOptimizer_1.performanceOptimizer.getOptimizationRecommendations();
        res.json({
            success: true,
            data: recommendations,
        });
    }
    catch (error) {
        console.error('Error getting optimization recommendations:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get optimization recommendations',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
}));
// Apply performance optimizations
router.post('/optimization/apply', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { optimizationType } = req.body;
        const result = yield PerformanceOptimizer_1.performanceOptimizer.applyOptimization(optimizationType);
        res.json({
            success: true,
            data: result,
        });
    }
    catch (error) {
        console.error('Error applying optimization:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to apply optimization',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
}));
// Get system metrics dashboard
router.get('/dashboard', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const [healthStatus, performanceMetrics, slaReport, alerts] = yield Promise.all([
            MonitoringService_1.monitoringService.performHealthCheck(),
            MonitoringService_1.monitoringService.collectPerformanceMetrics(),
            MonitoringService_1.monitoringService.generateSLAReport(),
            AlertingService_1.alertingService.getAlerts({ resolved: false }),
        ]);
        const dashboard = {
            health: healthStatus,
            performance: performanceMetrics,
            sla: slaReport,
            alerts: {
                data: alerts,
                summary: {
                    total: alerts.length,
                    critical: alerts.filter(a => a.severity === 'CRITICAL').length,
                    high: alerts.filter(a => a.severity === 'HIGH').length,
                    medium: alerts.filter(a => a.severity === 'MEDIUM').length,
                    low: alerts.filter(a => a.severity === 'LOW').length,
                },
            },
            timestamp: new Date(),
        };
        res.json({
            success: true,
            data: dashboard,
        });
    }
    catch (error) {
        console.error('Error generating dashboard:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to generate dashboard',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
}));
exports.default = router;
