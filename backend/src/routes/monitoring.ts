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

router.get('/health', async (req: Request, res: Response) => {
  try {
    const healthStatus = await monitoringService.performHealthCheck();
    res.json(healthStatus);
  } catch (error) {
    res.status(500).json({
      error: 'Failed to perform health check',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

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

// Alerting endpoints
router.get('/alerts', async (req: Request, res: Response) => {
  try {
    const filters = {
      severity: req.query.severity as any,
      resolved: req.query.resolved === 'true',
    };

    const alerts = await alertingService.getAlerts(filters);
    res.json(alerts);
  } catch (error) {
    res.status(500).json({
      error: 'Failed to get alerts',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

router.post('/alerts/:id/acknowledge', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { acknowledgedBy } = req.body;

    if (!acknowledgedBy) {
      return res.status(400).json({
        error: 'Missing required field',
        message: 'acknowledgedBy is required',
      });
    }

    const alert = await alertingService.acknowledgeAlert(id, acknowledgedBy);
    
    if (!alert) {
      return res.status(404).json({
        error: 'Alert not found',
        message: `Alert with id ${id} not found`,
      });
    }

    res.json(alert);
  } catch (error) {
    res.status(500).json({
      error: 'Failed to acknowledge alert',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

router.post('/alerts/:id/resolve', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const alert = await alertingService.resolveAlert(id);
    
    if (!alert) {
      return res.status(404).json({
        error: 'Alert not found',
        message: `Alert with id ${id} not found`,
      });
    }

    res.json(alert);
  } catch (error) {
    res.status(500).json({
      error: 'Failed to resolve alert',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

router.get('/alert-rules', async (req: Request, res: Response) => {
  try {
    const rules = await alertingService.getAlertRules();
    res.json(rules);
  } catch (error) {
    res.status(500).json({
      error: 'Failed to get alert rules',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

router.put('/alert-rules/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const rule = await alertingService.updateAlertRule(id, updates);
    
    if (!rule) {
      return res.status(404).json({
        error: 'Alert rule not found',
        message: `Alert rule with id ${id} not found`,
      });
    }

    res.json(rule);
  } catch (error) {
    res.status(500).json({
      error: 'Failed to update alert rule',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Performance optimization endpoints
router.get('/performance', async (req: Request, res: Response) => {
  try {
    const report = await performanceOptimizer.getPerformanceReport();
    res.json(report);
  } catch (error) {
    res.status(500).json({
      error: 'Failed to get performance report',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

router.get('/performance/optimizations', async (req: Request, res: Response) => {
  try {
    const optimizations = await performanceOptimizer.getOptimizations();
    res.json(optimizations);
  } catch (error) {
    res.status(500).json({
      error: 'Failed to get optimizations',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

router.get('/performance/recommendations', async (req: Request, res: Response) => {
  try {
    const filters = {
      type: req.query.type as any,
      priority: req.query.priority as any,
      status: req.query.status as any,
    };

    const recommendations = await performanceOptimizer.getRecommendations(filters);
    res.json(recommendations);
  } catch (error) {
    res.status(500).json({
      error: 'Failed to get recommendations',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

router.post('/performance/recommendations/:id/implement', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const recommendation = await performanceOptimizer.implementRecommendation(id);
    
    if (!recommendation) {
      return res.status(404).json({
        error: 'Recommendation not found',
        message: `Recommendation with id ${id} not found or cannot be implemented`,
      });
    }

    res.json(recommendation);
  } catch (error) {
    res.status(500).json({
      error: 'Failed to implement recommendation',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

router.post('/performance/optimize-queries', async (req: Request, res: Response) => {
  try {
    const optimizations = await performanceOptimizer.optimizeQueries();
    res.json(optimizations);
  } catch (error) {
    res.status(500).json({
      error: 'Failed to optimize queries',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

router.post('/performance/connection-pooling', async (req: Request, res: Response) => {
  try {
    await performanceOptimizer.implementConnectionPooling();
    res.json({ message: 'Connection pooling optimization completed' });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to implement connection pooling',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

router.post('/performance/compression', async (req: Request, res: Response) => {
  try {
    await performanceOptimizer.enableQueryCompression();
    res.json({ message: 'Query compression enabled' });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to enable compression',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

router.post('/performance/cdn', async (req: Request, res: Response) => {
  try {
    await performanceOptimizer.setupCDNDistribution();
    res.json({ message: 'CDN distribution configured' });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to setup CDN',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Security endpoints
router.get('/security/audit-logs', async (req: Request, res: Response) => {
  try {
    const filters = {
      userId: req.query.userId as string,
      action: req.query.action as string,
      resource: req.query.resource as string,
      startDate: req.query.startDate ? new Date(req.query.startDate as string) : undefined,
      endDate: req.query.endDate ? new Date(req.query.endDate as string) : undefined,
    };

    const logs = await securityService.getAuditLogs(filters);
    res.json(logs);
  } catch (error) {
    res.status(500).json({
      error: 'Failed to get audit logs',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

router.get('/security/config', async (req: Request, res: Response) => {
  try {
    const config = securityService.getConfig();
    res.json(config);
  } catch (error) {
    res.status(500).json({
      error: 'Failed to get security config',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

router.get('/security/rate-limit/:identifier', async (req: Request, res: Response) => {
  try {
    const { identifier } = req.params;
    const status = await securityService.getRateLimitStatus(identifier);
    
    if (!status) {
      return res.status(404).json({
        error: 'Rate limit not found',
        message: `No rate limit data for identifier ${identifier}`,
      });
    }

    res.json(status);
  } catch (error) {
    res.status(500).json({
      error: 'Failed to get rate limit status',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Webhook endpoints
router.get('/webhooks', async (req: Request, res: Response) => {
  try {
    const webhooks = await webhookService.getWebhooks();
    res.json(webhooks);
  } catch (error) {
    res.status(500).json({
      error: 'Failed to get webhooks',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

router.post('/webhooks', async (req: Request, res: Response) => {
  try {
    const webhookData = req.body;
    const webhook = await webhookService.createWebhook(webhookData);
    res.status(201).json(webhook);
  } catch (error) {
    res.status(500).json({
      error: 'Failed to create webhook',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

router.put('/webhooks/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const webhook = await webhookService.updateWebhook(id, updates);
    
    if (!webhook) {
      return res.status(404).json({
        error: 'Webhook not found',
        message: `Webhook with id ${id} not found`,
      });
    }

    res.json(webhook);
  } catch (error) {
    res.status(500).json({
      error: 'Failed to update webhook',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

router.delete('/webhooks/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const deleted = await webhookService.deleteWebhook(id);
    
    if (!deleted) {
      return res.status(404).json({
        error: 'Webhook not found',
        message: `Webhook with id ${id} not found`,
      });
    }

    res.json({ message: 'Webhook deleted successfully' });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to delete webhook',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

router.get('/webhooks/:id/deliveries', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const filters = {
      webhookId: id,
      event: req.query.event as any,
      status: req.query.status as any,
      startDate: req.query.startDate ? new Date(req.query.startDate as string) : undefined,
      endDate: req.query.endDate ? new Date(req.query.endDate as string) : undefined,
    };

    const deliveries = await webhookService.getDeliveries(filters);
    res.json(deliveries);
  } catch (error) {
    res.status(500).json({
      error: 'Failed to get webhook deliveries',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

router.post('/webhooks/:id/test', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const result = await webhookService.testWebhook(id);
    res.json(result);
  } catch (error) {
    res.status(500).json({
      error: 'Failed to test webhook',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

router.get('/webhooks/stats', async (req: Request, res: Response) => {
  try {
    const stats = await webhookService.getWebhookStats();
    res.json(stats);
  } catch (error) {
    res.status(500).json({
      error: 'Failed to get webhook stats',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Dashboard endpoint that combines all monitoring data
router.get('/dashboard', async (req: Request, res: Response) => {
  try {
    const [
      healthStatus,
      appMetrics,
      performanceMetrics,
      alerts,
      webhookStats,
      performanceReport,
    ] = await Promise.all([
      monitoringService.performHealthCheck(),
      monitoringService.collectApplicationMetrics(),
      monitoringService.collectPerformanceMetrics(),
      alertingService.getAlerts({ resolved: false }),
      webhookService.getWebhookStats(),
      performanceOptimizer.getPerformanceReport(),
    ]);

    res.json({
      timestamp: new Date().toISOString(),
      health: healthStatus,
      metrics: {
        application: appMetrics,
        performance: performanceMetrics,
      },
      alerts: {
        active: alerts.length,
        critical: alerts.filter(a => a.severity === 'CRITICAL').length,
        high: alerts.filter(a => a.severity === 'HIGH').length,
        medium: alerts.filter(a => a.severity === 'MEDIUM').length,
        low: alerts.filter(a => a.severity === 'LOW').length,
      },
      webhooks: webhookStats,
      performance: {
        optimizations: performanceReport.optimizations.length,
        recommendations: performanceReport.recommendations.filter(r => r.status === 'pending').length,
      },
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to get dashboard data',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router; 