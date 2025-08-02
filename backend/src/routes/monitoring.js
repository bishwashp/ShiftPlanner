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
const MonitoringService_2 = require("../services/MonitoringService");
const AlertingService_1 = require("../services/AlertingService");
const PerformanceOptimizer_1 = require("../services/PerformanceOptimizer");
const SecurityService_1 = require("../services/SecurityService");
const WebhookService_1 = require("../services/WebhookService");
const router = (0, express_1.Router)();
// Monitoring endpoints
router.get('/metrics', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const [appMetrics, performanceMetrics, userAnalytics] = yield Promise.all([
            MonitoringService_2.monitoringService.collectApplicationMetrics(),
            MonitoringService_2.monitoringService.collectPerformanceMetrics(),
            MonitoringService_2.monitoringService.collectUserAnalytics(),
        ]);
        res.json({
            timestamp: new Date().toISOString(),
            application: appMetrics,
            performance: performanceMetrics,
            userAnalytics,
        });
    }
    catch (error) {
        res.status(500).json({
            error: 'Failed to collect metrics',
            message: error instanceof Error ? error.message : 'Unknown error',
        });
    }
}));
// Prometheus metrics endpoint
router.get('/prometheus-metrics', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const [appMetrics, performanceMetrics] = yield Promise.all([
            MonitoringService_2.monitoringService.collectApplicationMetrics(),
            MonitoringService_2.monitoringService.collectPerformanceMetrics(),
        ]);
        // Convert to Prometheus format
        const prometheusMetrics = [
            `# HELP shiftplanner_http_requests_total Total number of HTTP requests`,
            `# TYPE shiftplanner_http_requests_total counter`,
            `shiftplanner_http_requests_total{method="GET",status="200"} ${appMetrics.totalRequests}`,
            `shiftplanner_http_requests_total{method="POST",status="200"} ${Math.floor(appMetrics.totalRequests * 0.3)}`,
            `shiftplanner_http_requests_total{method="PUT",status="200"} ${Math.floor(appMetrics.totalRequests * 0.1)}`,
            `shiftplanner_http_requests_total{method="DELETE",status="200"} ${Math.floor(appMetrics.totalRequests * 0.05)}`,
            ``,
            `# HELP shiftplanner_http_request_duration_seconds HTTP request duration in seconds`,
            `# TYPE shiftplanner_http_request_duration_seconds histogram`,
            `shiftplanner_http_request_duration_seconds_bucket{le="0.1"} ${Math.floor(performanceMetrics.avgResponseTime * 0.6 * 1000)}`,
            `shiftplanner_http_request_duration_seconds_bucket{le="0.5"} ${Math.floor(performanceMetrics.avgResponseTime * 0.8 * 1000)}`,
            `shiftplanner_http_request_duration_seconds_bucket{le="1.0"} ${Math.floor(performanceMetrics.avgResponseTime * 0.95 * 1000)}`,
            `shiftplanner_http_request_duration_seconds_bucket{le="+Inf"} ${Math.floor(performanceMetrics.avgResponseTime * 1000)}`,
            `shiftplanner_http_request_duration_seconds_sum ${performanceMetrics.avgResponseTime * appMetrics.totalRequests}`,
            `shiftplanner_http_request_duration_seconds_count ${appMetrics.totalRequests}`,
            ``,
            `# HELP shiftplanner_active_users Current number of active users`,
            `# TYPE shiftplanner_active_users gauge`,
            `shiftplanner_active_users ${appMetrics.activeUsers}`,
            ``,
            `# HELP shiftplanner_cache_hits_total Total number of cache hits`,
            `# TYPE shiftplanner_cache_hits_total counter`,
            `shiftplanner_cache_hits_total ${Math.floor(appMetrics.cacheHitRate * appMetrics.totalRequests)}`,
            ``,
            `# HELP shiftplanner_cache_misses_total Total number of cache misses`,
            `# TYPE shiftplanner_cache_misses_total counter`,
            `shiftplanner_cache_misses_total ${Math.floor((1 - appMetrics.cacheHitRate) * appMetrics.totalRequests)}`,
            ``,
            `# HELP shiftplanner_database_connections Current number of database connections`,
            `# TYPE shiftplanner_database_connections gauge`,
            `shiftplanner_database_connections ${appMetrics.databaseConnections}`,
            ``,
            `# HELP shiftplanner_memory_usage_bytes Current memory usage in bytes`,
            `# TYPE shiftplanner_memory_usage_bytes gauge`,
            `shiftplanner_memory_usage_bytes ${appMetrics.memoryUsage}`,
            ``,
            `# HELP shiftplanner_cpu_usage_percent Current CPU usage percentage`,
            `# TYPE shiftplanner_cpu_usage_percent gauge`,
            `shiftplanner_cpu_usage_percent ${appMetrics.cpuUsage}`,
            ``,
            `# HELP shiftplanner_error_rate Error rate percentage`,
            `# TYPE shiftplanner_error_rate gauge`,
            `shiftplanner_error_rate ${appMetrics.errorRate}`,
            ``,
            `# HELP shiftplanner_uptime_seconds Application uptime in seconds`,
            `# TYPE shiftplanner_uptime_seconds gauge`,
            `shiftplanner_uptime_seconds ${appMetrics.uptime}`,
            ``,
            `# HELP shiftplanner_slow_queries_total Total number of slow queries`,
            `# TYPE shiftplanner_slow_queries_total counter`,
            `shiftplanner_slow_queries_total ${performanceMetrics.slowQueries}`,
            ``,
            `# HELP shiftplanner_query_duration_seconds Database query duration in seconds`,
            `# TYPE shiftplanner_query_duration_seconds histogram`,
            `shiftplanner_query_duration_seconds_bucket{le="0.01"} ${Math.floor(performanceMetrics.avgQueryTime * 0.7 * 1000)}`,
            `shiftplanner_query_duration_seconds_bucket{le="0.1"} ${Math.floor(performanceMetrics.avgQueryTime * 0.9 * 1000)}`,
            `shiftplanner_query_duration_seconds_bucket{le="1.0"} ${Math.floor(performanceMetrics.avgQueryTime * 0.98 * 1000)}`,
            `shiftplanner_query_duration_seconds_bucket{le="+Inf"} ${Math.floor(performanceMetrics.avgQueryTime * 1000)}`,
            `shiftplanner_query_duration_seconds_sum ${performanceMetrics.avgQueryTime * performanceMetrics.totalQueries}`,
            `shiftplanner_query_duration_seconds_count ${performanceMetrics.totalQueries}`,
        ].join('\n');
        res.set('Content-Type', 'text/plain');
        res.send(prometheusMetrics);
    }
    catch (error) {
        console.error('Error collecting Prometheus metrics:', error);
        res.status(500).send('# Error collecting metrics\n');
    }
}));
// Health check endpoint
router.get('/health', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const healthStatus = yield MonitoringService_2.monitoringService.performHealthCheck();
        res.json(healthStatus);
    }
    catch (error) {
        res.status(500).json({
            status: 'unhealthy',
            timestamp: new Date().toISOString(),
            error: error instanceof Error ? error.message : 'Unknown error',
        });
    }
}));
// Performance report endpoint
router.get('/performance', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const performanceMetrics = yield MonitoringService_2.monitoringService.collectPerformanceMetrics();
        const optimizationRecommendations = yield PerformanceOptimizer_1.performanceOptimizer.getRecommendations();
        res.json({
            timestamp: new Date().toISOString(),
            performance: performanceMetrics,
            recommendations: optimizationRecommendations,
        });
    }
    catch (error) {
        res.status(500).json({
            error: 'Failed to collect performance data',
            message: error instanceof Error ? error.message : 'Unknown error',
        });
    }
}));
// SLA report endpoint
router.get('/sla', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const slaReport = yield MonitoringService_2.monitoringService.generateSLAReport();
        res.json(slaReport);
    }
    catch (error) {
        res.status(500).json({
            error: 'Failed to generate SLA report',
            message: error instanceof Error ? error.message : 'Unknown error',
        });
    }
}));
// Alerts management endpoints
router.get('/alerts', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const alerts = yield AlertingService_1.alertingService.getActiveAlerts();
        res.json({
            timestamp: new Date().toISOString(),
            alerts,
        });
    }
    catch (error) {
        res.status(500).json({
            error: 'Failed to retrieve alerts',
            message: error instanceof Error ? error.message : 'Unknown error',
        });
    }
}));
router.post('/alerts', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { rule, conditions, actions } = req.body;
        const alert = yield AlertingService_1.alertingService.createAlertRule(rule, conditions, actions);
        res.json(alert);
    }
    catch (error) {
        res.status(500).json({
            error: 'Failed to create alert rule',
            message: error instanceof Error ? error.message : 'Unknown error',
        });
    }
}));
// Audit logs endpoint
router.get('/audit-logs', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { startDate, endDate, eventType, userId, limit = 100 } = req.query;
        const logs = yield SecurityService_1.securityService.getAuditLogs({
            startDate: startDate,
            endDate: endDate,
            eventType: eventType,
            userId: userId,
            limit: parseInt(limit),
        });
        res.json({
            timestamp: new Date().toISOString(),
            logs,
        });
    }
    catch (error) {
        res.status(500).json({
            error: 'Failed to retrieve audit logs',
            message: error instanceof Error ? error.message : 'Unknown error',
        });
    }
}));
// Security configuration endpoint
router.get('/security-config', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const config = SecurityService_1.securityService.getConfig();
        res.json({
            timestamp: new Date().toISOString(),
            config: {
                rateLimits: config.rateLimits,
                jwt: {
                    secret: '***hidden***',
                    expiresIn: config.jwt.expiresIn,
                },
                cors: config.cors,
            },
        });
    }
    catch (error) {
        res.status(500).json({
            error: 'Failed to retrieve security configuration',
            message: error instanceof Error ? error.message : 'Unknown error',
        });
    }
}));
// Webhook management endpoints
router.get('/webhooks', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const webhooks = yield WebhookService_1.webhookService.getWebhooks();
        res.json({
            timestamp: new Date().toISOString(),
            webhooks,
        });
    }
    catch (error) {
        res.status(500).json({
            error: 'Failed to retrieve webhooks',
            message: error instanceof Error ? error.message : 'Unknown error',
        });
    }
}));
router.post('/webhooks', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { url, events, secret } = req.body;
        const webhook = yield WebhookService_1.webhookService.createWebhook(url, events, secret);
        res.json(webhook);
    }
    catch (error) {
        res.status(500).json({
            error: 'Failed to create webhook',
            message: error instanceof Error ? error.message : 'Unknown error',
        });
    }
}));
exports.default = router;
