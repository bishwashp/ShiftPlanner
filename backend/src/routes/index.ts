import { Router } from 'express';
import analystsRouter from './analysts';
import schedulesRouter from './schedules';
import holidaysRouter from './holidays';
import absencesRouter from './absences';
import generationBlocksRouter from './generation-blocks';
import compoffRouter from './compoff';
import holidayConstraintRouter from './holiday-constraint';
import specialEventsRouter from './special-events';
import regionsRouter from './regions';
import shiftDefinitionsRouter from './shiftDefinitions';
import dashboardRouter from './dashboard';

const router = Router();

// Register all route modules
router.use('/analysts', analystsRouter);
router.use('/schedules', schedulesRouter);
router.use('/holidays', holidaysRouter);
router.use('/absences', absencesRouter);
router.use('/generation-blocks', generationBlocksRouter);
router.use('/compoff', compoffRouter);
router.use('/holiday-constraint', holidayConstraintRouter);
router.use('/special-events', specialEventsRouter);
router.use('/regions', regionsRouter);
router.use('/shift-definitions', shiftDefinitionsRouter);
router.use('/dashboard', dashboardRouter);

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
      holidays: {
        description: 'Holiday management operations',
        routes: {
          'GET /api/holidays': 'Get all holidays',
          'POST /api/holidays': 'Create new holiday',
          'GET /api/holidays/:id': 'Get holiday by ID',
          'PUT /api/holidays/:id': 'Update holiday',
          'DELETE /api/holidays/:id': 'Delete holiday',
          'GET /api/holidays/year/:year': 'Get holidays for specific year'
        }
      },
      absences: {
        description: 'Absence management operations',
        routes: {
          'GET /api/absences': 'Get all absences',
          'POST /api/absences': 'Create new absence',
          'GET /api/absences/:id': 'Get absence by ID',
          'PUT /api/absences/:id': 'Update absence',
          'DELETE /api/absences/:id': 'Delete absence',
          'GET /api/absences/analyst/:analystId': 'Get absences for specific analyst',
          'PATCH /api/absences/:id/approve': 'Approve/reject absence'
        }
      }
    },
    features: [
      'Employee Management (CRUD)',
      'Schedule Generation (MVP)',
      'Conflict Detection',
      'Auto-fix Scheduling',
      'Holiday Management',
      'Absence Management',
      'SQLite Database',
      'In-memory Cache Fallback'
    ]
  });
});

export default router;