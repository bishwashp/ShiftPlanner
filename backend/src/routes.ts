import { Router } from 'express';
import analystRoutes from './routes/analysts';
import scheduleRoutes from './routes/schedules';
import algorithmRoutes from './routes/algorithms';

const router = Router();

// API versioning
router.get('/', (req, res) => {
  res.json({
    message: 'ShiftPlanner API v1.0.0',
    endpoints: {
      analysts: '/analysts',
      schedules: '/schedules',
      algorithms: '/algorithms'
    }
  });
});

// Feature routes
router.use('/analysts', analystRoutes);
router.use('/schedules', scheduleRoutes);
router.use('/algorithms', algorithmRoutes);

export default router;
