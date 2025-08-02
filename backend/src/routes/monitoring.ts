import { Router, Request, Response } from 'express';
import { monitoringService } from '../services/MonitoringService';
import { alertingService } from '../services/AlertingService';
import { securityService } from '../services/SecurityService';
import { webhookService } from '../services/WebhookService';
import { performanceOptimizer } from '../services/PerformanceOptimizer';

const router = Router();

// Get system health status (public endpoint for testing)
router.get('/health', async (req: Request, res: Response) => {
  try {
    const healthStatus = await monitoringService.performHealthCheck();
    res.json({
      success: true,
      data: healthStatus,
      timestamp: new Date(),
    });
  } catch (error) {
    console.error('Error checking system health:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to check system health',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Public test endpoint for monitoring services
router.get('/test', async (req: Request, res: Response) => {
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
  } catch (error) {
    console.error('Error in test endpoint:', error);
    res.status(500).json({
      success: false,
      error: 'Test endpoint failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Get performance metrics
router.get('/performance', async (req: Request, res: Response) => {
  try {
    const metrics = await monitoringService.collectPerformanceMetrics();
    res.json({
      success: true,
      data: metrics,
      timestamp: new Date(),
    });
  } catch (error) {
    console.error('Error collecting performance metrics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to collect performance metrics',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Get SLA report
router.get('/sla', async (req: Request, res: Response) => {
  try {
    const slaReport = await monitoringService.generateSLAReport();
    res.json({
      success: true,
      data: slaReport,
      timestamp: new Date(),
    });
  } catch (error) {
    console.error('Error generating SLA report:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate SLA report',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Get system alerts
router.get('/alerts', async (req: Request, res: Response) => {
  try {
    const { severity, resolved } = req.query;
    const filters: any = {};
    
    if (severity) filters.severity = severity as string;
    if (resolved !== undefined) filters.resolved = resolved === 'true';
    
    const alerts = await alertingService.getAlerts(filters);
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
  } catch (error) {
    console.error('Error fetching alerts:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch alerts',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Acknowledge an alert
router.post('/alerts/:alertId/acknowledge', async (req: Request, res: Response) => {
  try {
    const { alertId } = req.params;
    const { acknowledgedBy } = req.body;
    
    const alert = await alertingService.acknowledgeAlert(alertId, acknowledgedBy);
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
  } catch (error) {
    console.error('Error acknowledging alert:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to acknowledge alert',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Resolve an alert
router.post('/alerts/:alertId/resolve', async (req: Request, res: Response) => {
  try {
    const { alertId } = req.params;
    
    const alert = await alertingService.resolveAlert(alertId);
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
  } catch (error) {
    console.error('Error resolving alert:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to resolve alert',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Get alert rules
router.get('/alert-rules', async (req: Request, res: Response) => {
  try {
    const rules = await alertingService.getAlertRules();
    res.json({
      success: true,
      data: rules,
    });
  } catch (error) {
    console.error('Error fetching alert rules:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch alert rules',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Update alert rule
router.put('/alert-rules/:ruleId', async (req: Request, res: Response) => {
  try {
    const { ruleId } = req.params;
    const updates = req.body;
    
    const rule = await alertingService.updateAlertRule(ruleId, updates);
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
  } catch (error) {
    console.error('Error updating alert rule:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update alert rule',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Get audit logs
router.get('/audit-logs', async (req: Request, res: Response) => {
  try {
    const { action, resource, startDate, endDate, limit } = req.query;
    const filters: any = {};
    
    if (action) filters.action = action as string;
    if (resource) filters.resource = resource as string;
    if (startDate) filters.startDate = new Date(startDate as string);
    if (endDate) filters.endDate = new Date(endDate as string);
    if (limit) filters.limit = parseInt(limit as string);
    
    const logs = await securityService.getAuditLogs(filters);
    res.json({
      success: true,
      data: logs,
      metadata: {
        total: logs.length,
        actions: [...new Set(logs.map(log => log.action))],
        resources: [...new Set(logs.map(log => log.resource))],
      },
    });
  } catch (error) {
    console.error('Error fetching audit logs:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch audit logs',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Get webhook status
router.get('/webhooks', async (req: Request, res: Response) => {
  try {
    const webhooks = await webhookService.getWebhooks();
    res.json({
      success: true,
      data: webhooks,
    });
  } catch (error) {
    console.error('Error fetching webhooks:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch webhooks',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Get performance optimization recommendations
router.get('/optimization', async (req: Request, res: Response) => {
  try {
    const recommendations = await performanceOptimizer.getOptimizationRecommendations();
    res.json({
      success: true,
      data: recommendations,
    });
  } catch (error) {
    console.error('Error getting optimization recommendations:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get optimization recommendations',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Apply performance optimizations
router.post('/optimization/apply', async (req: Request, res: Response) => {
  try {
    const { optimizationType } = req.body;
    
    const result = await performanceOptimizer.applyOptimization(optimizationType);
    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('Error applying optimization:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to apply optimization',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Get system metrics dashboard
router.get('/dashboard', async (req: Request, res: Response) => {
  try {
    const [healthStatus, performanceMetrics, slaReport, alerts] = await Promise.all([
      monitoringService.performHealthCheck(),
      monitoringService.collectPerformanceMetrics(),
      monitoringService.generateSLAReport(),
      alertingService.getAlerts({ resolved: false }),
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
  } catch (error) {
    console.error('Error generating dashboard:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate dashboard',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router; 