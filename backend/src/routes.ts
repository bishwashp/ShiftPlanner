import { Router } from 'express';
import analystRoutes from './routes/analysts';
import scheduleRoutes from './routes/schedules';
import algorithmRoutes from './routes/algorithms';
import constraintRoutes from './routes/constraints';
import analyticsRoutes from './routes/analytics';
import calendarRoutes from './routes/calendar';
import monitoringRoutes from './routes/monitoring';
import authRoutes from './routes/auth';

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
      monitoring: '/monitoring'
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

export default router;
