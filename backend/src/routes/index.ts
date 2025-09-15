import { Router } from 'express';
import analystsRouter from './analysts';
import schedulesRouter from './schedules';
import proactiveRouter from './proactive';

const router = Router();

// Register all route modules
router.use('/analysts', analystsRouter);
router.use('/schedules', schedulesRouter);
router.use('/proactive', proactiveRouter);

// API info endpoint
router.get('/', (req, res) => {
  res.json({
    message: 'ShiftPlanner API v1.0.0',
    endpoints: {
      analysts: {
        description: 'Employee management operations',
        routes: {
          'GET /api/analysts': 'Get all analysts',
          'POST /api/analysts': 'Create new analyst',
          'GET /api/analysts/:id': 'Get analyst by ID',
          'PUT /api/analysts/:id': 'Update analyst',
          'DELETE /api/analysts/:id': 'Delete analyst'
        }
      },
      schedules: {
        description: 'Schedule management and generation',
        routes: {
          'GET /api/schedules': 'Get all schedules',
          'POST /api/schedules': 'Create new schedule',
          'POST /api/schedules/generate': 'Generate schedule for date range (MVP)',
          'POST /api/schedules/bulk': 'Create multiple schedules',
          'GET /api/schedules/health/conflicts': 'Check schedule conflicts',
          'POST /api/schedules/auto-fix-conflicts': 'Auto-fix schedule conflicts',
          'POST /api/schedules/apply-auto-fix': 'Apply auto-fix assignments',
          'GET /api/schedules/test-scheduler': 'Test scheduler availability'
        }
      },
      proactive: {
        description: 'Proactive analysis and optimization (optional feature)',
        routes: {
          'GET /api/proactive/status': 'Get proactive analysis status',
          'POST /api/proactive/enable': 'Enable proactive analysis',
          'POST /api/proactive/disable': 'Disable proactive analysis',
          'POST /api/proactive/config': 'Update configuration',
          'POST /api/proactive/test': 'Test availability'
        }
      }
    },
    features: [
      'Employee Management (CRUD)',
      'Schedule Generation (MVP)',
      'Conflict Detection',
      'Auto-fix Scheduling',
      'SQLite Database',
      'In-memory Cache Fallback',
      'Proactive Analysis & Optimization (Optional)'
    ]
  });
});

export default router;