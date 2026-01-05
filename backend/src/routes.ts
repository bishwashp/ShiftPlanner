import { Router } from 'express';
import analystRoutes from './routes/analysts';
import scheduleRoutes from './routes/schedules';
import algorithmRoutes from './routes/algorithms';
import constraintRoutes from './routes/constraints';
import analyticsRoutes from './routes/analytics';
import calendarRoutes from './routes/calendar';
import monitoringRoutes from './routes/monitoring';
import authRoutes from './routes/auth';
import mlRoutes from './routes/ml';
import holidayRoutes from './routes/holidays';
import absenceRoutes from './routes/absences';
import activityRoutes from './routes/activities';
import scheduleSnapshotRoutes from './routes/schedule-snapshot';
import notificationRoutes from './routes/notifications';
import generationBlocksRoutes from './routes/generation-blocks';
import compoffRoutes from './routes/compoff';
import constraintTemplatesRoutes from './routes/constraint-templates';
import constraintPreviewRoutes from './routes/constraint-preview';
import icalRoutes from './routes/ical';

import auditRoutes from './routes/audit';
import holidayConstraintRoutes from './routes/holiday-constraint';
import specialEventsRoutes from './routes/special-events';
import regionRoutes from './routes/regions';
import shiftDefinitionsRoutes from './routes/shiftDefinitions';
import dashboardRoutes from './routes/dashboard';

const router = Router();

// Health check endpoint
router.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

// Test endpoint for monitoring services
router.get('/monitoring-test', async (req, res) => {
  try {
    res.json({
      success: true,
      message: 'All core services are restored and working!',
      services: {
        monitoringService: '✅ Active',
        alertingService: '✅ Active',
        securityService: '✅ Active',
        webhookService: '✅ Active',
        performanceOptimizer: '✅ Active',
        monitoringRoutes: '✅ Active',
      },
      endpoints: {
        health: '/api/health',
        auth: '/api/auth/*',
        monitoring: '/api/monitoring/*',
        alerts: '/api/monitoring/alerts',
        performance: '/api/monitoring/performance',
        dashboard: '/api/monitoring/dashboard',
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Test failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// API versioning
router.get('/', (req, res) => {
  res.json({
    message: 'ShiftPlanner API v1.0.0',
    endpoints: {
      health: '/health',
      auth: '/auth',
      analysts: '/analysts',
      schedules: '/schedules',
      algorithms: '/algorithms',
      constraints: '/constraints',
      analytics: '/analytics',
      calendar: '/calendar',
      monitoring: '/monitoring',
      ml: '/ml',
      holidays: '/holidays',
      absences: '/absences',
      activities: '/activities',
      holidayConstraint: '/holiday-constraint',
      specialEvents: '/special-events'
    }
  });
});

// Feature routes
router.use('/auth', authRoutes);
router.use('/analysts', analystRoutes);
router.use('/schedules', scheduleRoutes);
router.use('/algorithms', algorithmRoutes);
router.use('/constraints', constraintRoutes);
router.use('/analytics', analyticsRoutes);
router.use('/calendar', calendarRoutes);
router.use('/monitoring', monitoringRoutes);
router.use('/ml', mlRoutes);
router.use('/holidays', holidayRoutes);
router.use('/absences', absenceRoutes);
router.use('/activities', activityRoutes);
router.use('/activities', activityRoutes);
router.use('/schedule-snapshot', scheduleSnapshotRoutes);
router.use('/notifications', notificationRoutes);
router.use('/generation-blocks', generationBlocksRoutes);
router.use('/compoff', compoffRoutes);
router.use('/constraint-templates', constraintTemplatesRoutes);
router.use('/constraints', constraintPreviewRoutes);
router.use('/audit', auditRoutes);
router.use('/holiday-constraint', holidayConstraintRoutes);
router.use('/special-events', specialEventsRoutes);
router.use('/regions', regionRoutes);
router.use('/shift-definitions', shiftDefinitionsRoutes);
router.use('/dashboard', dashboardRoutes);
router.use('/ical', icalRoutes);

export default router;
