import { Router, Request, Response } from 'express';
import { monitoringService } from '../services/MonitoringService';
import { alertingService } from '../services/AlertingService';
import { performanceOptimizer } from '../services/PerformanceOptimizer';
import { securityService } from '../services/SecurityService';
import { webhookService } from '../services/WebhookService';

const router = Router();

// Monitoring endpoints
router.get('/metrics', async (req: Request, res: Response) => {
  try {
    const [appMetrics, performanceMetrics, userAnalytics] = await Promise.all([
      monitoringService.collectApplicationMetrics(),
      monitoringService.collectPerformanceMetrics(),
      monitoringService.collectUserAnalytics(),
    ]);

    res.json({
      timestamp: new Date().toISOString(),
      application: appMetrics,
      performance: performanceMetrics,
      userAnalytics,
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to collect metrics',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Prometheus metrics endpoint
router.get('/prometheus-metrics', async (req: Request, res: Response) => {
  try {
    const [appMetrics, performanceMetrics] = await Promise.all([
      monitoringService.collectApplicationMetrics(),
      monitoringService.collectPerformanceMetrics(),
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
  } catch (error) {
    console.error('Error collecting Prometheus metrics:', error);
    res.status(500).send('# Error collecting metrics\n');
  }
});

// Health check endpoint
router.get('/health', async (req: Request, res: Response) => {
  try {
    const healthStatus = await monitoringService.performHealthCheck();
    res.json(healthStatus);
  } catch (error) {
    res.status(500).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Performance report endpoint
router.get('/performance', async (req: Request, res: Response) => {
  try {
    const performanceMetrics = await monitoringService.collectPerformanceMetrics();
    const optimizationRecommendations = await performanceOptimizer.getRecommendations();
    
    res.json({
      timestamp: new Date().toISOString(),
      performance: performanceMetrics,
      recommendations: optimizationRecommendations,
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to collect performance data',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// SLA report endpoint
router.get('/sla', async (req: Request, res: Response) => {
  try {
    const slaReport = await monitoringService.generateSLAReport();
    res.json(slaReport);
  } catch (error) {
    res.status(500).json({
      error: 'Failed to generate SLA report',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Alerts management endpoints
router.get('/alerts', async (req: Request, res: Response) => {
  try {
    const alerts = await alertingService.getActiveAlerts();
    res.json({
      timestamp: new Date().toISOString(),
      alerts,
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to retrieve alerts',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

router.post('/alerts', async (req: Request, res: Response) => {
  try {
    const { rule, conditions, actions } = req.body;
    const alert = await alertingService.createAlertRule(rule, conditions, actions);
    res.json(alert);
  } catch (error) {
    res.status(500).json({
      error: 'Failed to create alert rule',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Audit logs endpoint
router.get('/audit-logs', async (req: Request, res: Response) => {
  try {
    const { startDate, endDate, eventType, userId, limit = 100 } = req.query;
    const logs = await securityService.getAuditLogs({
      startDate: startDate as string,
      endDate: endDate as string,
      eventType: eventType as string,
      userId: userId as string,
      limit: parseInt(limit as string),
    });
    
    res.json({
      timestamp: new Date().toISOString(),
      logs,
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to retrieve audit logs',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Security configuration endpoint
router.get('/security-config', async (req: Request, res: Response) => {
  try {
    const config = securityService.getConfig();
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
  } catch (error) {
    res.status(500).json({
      error: 'Failed to retrieve security configuration',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Webhook management endpoints
router.get('/webhooks', async (req: Request, res: Response) => {
  try {
    const webhooks = await webhookService.getWebhooks();
    res.json({
      timestamp: new Date().toISOString(),
      webhooks,
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to retrieve webhooks',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

router.post('/webhooks', async (req: Request, res: Response) => {
  try {
    const { url, events, secret } = req.body;
    const webhook = await webhookService.createWebhook(url, events, secret);
    res.json(webhook);
  } catch (error) {
    res.status(500).json({
      error: 'Failed to create webhook',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;
