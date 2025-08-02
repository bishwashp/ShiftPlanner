import { Router } from 'express';
import analystRoutes from './routes/analysts';
import scheduleRoutes from './routes/schedules';
import algorithmRoutes from './routes/algorithms';
import constraintRoutes from './routes/constraints';
import analyticsRoutes from './routes/analytics';
import calendarRoutes from './routes/calendar';
// import monitoringRoutes from './routes/monitoring';

const router = Router();

// Health check endpoint
router.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

// API versioning
router.get('/', (req, res) => {
  res.json({
    message: 'ShiftPlanner API v1.0.0',
    endpoints: {
      health: '/health',
      analysts: '/analysts',
      schedules: '/schedules',
      algorithms: '/algorithms',
      constraints: '/constraints',
      analytics: '/analytics',
      calendar: '/calendar'
    }
    });
});

// Feature routes
router.use('/analysts', analystRoutes);
router.use('/schedules', scheduleRoutes);
router.use('/algorithms', algorithmRoutes);
router.use('/constraints', constraintRoutes);
router.use('/analytics', analyticsRoutes);
router.use('/calendar', calendarRoutes);
// router.use('/monitoring', monitoringRoutes);

export default router;
