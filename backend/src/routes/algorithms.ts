import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { AlgorithmRegistry } from '../services/scheduling/AlgorithmRegistry';
import { scheduleGenerationLogger } from '../services/ScheduleGenerationLogger';
import { ActivityService } from '../services/ActivityService';
import { createLocalDate, isValidDateString } from '../utils/dateUtils';

const router = Router();

// Get all algorithms
router.get('/', async (req: Request, res: Response) => {
  try {
    const algorithms = await prisma.algorithmConfig.findMany({
      orderBy: { name: 'asc' }
    });
    res.json(algorithms);
  } catch (error) {
    console.error('Error fetching algorithms:', error);
    res.status(500).json({ error: 'Failed to fetch algorithms' });
  }
});

// Get recent schedule generation logs for dashboard
router.get('/recent-activity', async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 10;
    const logs = await scheduleGenerationLogger.getRecentLogs(limit);
    res.json(logs);
  } catch (error) {
    console.error('Error fetching recent activity logs:', error);
    res.status(500).json({ error: 'Failed to fetch recent activity logs' });
  }
});

// Get generation statistics
router.get('/generation-stats', async (req: Request, res: Response) => {
  try {
    const days = parseInt(req.query.days as string) || 30;
    const stats = await scheduleGenerationLogger.getGenerationStats(days);
    res.json(stats);
  } catch (error) {
    console.error('Error fetching generation statistics:', error);
    res.status(500).json({ error: 'Failed to fetch generation statistics' });
  }
});

// Get fairness metrics for current schedules
router.get('/fairness-metrics', async (req: Request, res: Response) => {
  try {
    const { startDate, endDate } = req.query;

    if (!startDate || !endDate) {
      return res.status(400).json({ error: 'Start date and end date are required' });
    }

    // Validate date strings
    if (!isValidDateString(startDate as string) || !isValidDateString(endDate as string)) {
      return res.status(400).json({ error: 'Invalid date format. Use YYYY-MM-DD format.' });
    }

    const start = createLocalDate(startDate as string);
    const end = createLocalDate(endDate as string);

    // Get all schedules in the date range
    const schedules = await prisma.schedule.findMany({
      where: {
        date: {
          gte: start,
          lte: end
        }
      },
      include: {
        analyst: true
      },
      orderBy: {
        date: 'asc'
      }
    });

    // Get all active analysts
    const analysts = await prisma.analyst.findMany({
      where: { isActive: true }
    });

    if (schedules.length === 0) {
      return res.json({
        overallFairnessScore: 0,
        components: {
          workload: 0,
          weekend: 0,
          screener: 0,
          holiday: 0
        },
        analystMetrics: [],
        message: 'No schedules found in the specified date range'
      });
    }

    // Create FairnessTracker instance and calculate metrics
    const { FairnessTracker } = await import('../services/scheduling/FairnessTracker');
    const fairnessTracker = new FairnessTracker(prisma);

    // Initialize with empty holidays for now (can be enhanced later)
    await fairnessTracker.initialize(start, analysts, []);

    // Analyze the schedules in the date range
    await fairnessTracker.analyzeSchedules(schedules, start, end);

    // Calculate current fairness metrics
    const report = fairnessTracker.getFairnessReport();

    res.json({
      dateRange: { startDate: start, endDate: end },
      schedulesAnalyzed: schedules.length,
      analystsCount: analysts.length,
      ...report
    });
  } catch (error) {
    console.error('Error calculating fairness metrics:', error);
    res.status(500).json({ error: 'Failed to calculate fairness metrics' });
  }
});

// Get algorithm by ID
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const algorithm = await prisma.algorithmConfig.findUnique({
      where: { id }
    });

    if (!algorithm) {
      return res.status(404).json({ error: 'Algorithm not found' });
    }

    res.json(algorithm);
  } catch (error) {
    console.error('Error fetching algorithm:', error);
    res.status(500).json({ error: 'Failed to fetch algorithm' });
  }
});

// Create new algorithm
router.post('/', async (req: Request, res: Response) => {
  try {
    const { name, description, config } = req.body;

    if (!name || !config) {
      return res.status(400).json({ error: 'Name and config are required' });
    }

    const algorithm = await prisma.algorithmConfig.create({
      data: { name, description, config: config as any }
    });

    // Log activity
    const activityData = ActivityService.ActivityTemplates.ALGORITHM_ADDED(
      algorithm.name,
      (req as any).user?.name || 'admin'
    );
    await ActivityService.logActivity({
      ...activityData,
      impact: activityData.impact as 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
    });

    res.status(201).json(algorithm);
  } catch (error: any) {
    console.error('Error creating algorithm:', error);
    if (error.code === 'P2002') {
      return res.status(400).json({ error: 'Algorithm name already exists' });
    }
    res.status(400).json({ error: 'Failed to create algorithm' });
  }
});

// Update algorithm
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name, description, config, isActive } = req.body;

    const algorithm = await prisma.algorithmConfig.update({
      where: { id },
      data: { name, description, config: config as any, isActive }
    });

    res.json(algorithm);
  } catch (error: any) {
    console.error('Error updating algorithm:', error);
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Algorithm not found' });
    }
    res.status(400).json({ error: 'Failed to update algorithm' });
  }
});

// Delete algorithm
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await prisma.algorithmConfig.delete({ where: { id } });
    res.status(204).send();
  } catch (error: any) {
    console.error('Error deleting algorithm:', error);
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Algorithm not found' });
    }
    res.status(400).json({ error: 'Failed to delete algorithm' });
  }
});

// Activate algorithm
router.post('/:id/activate', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    await prisma.$transaction(async (tx: any) => {
      await tx.algorithmConfig.updateMany({
        where: { isActive: true },
        data: { isActive: false }
      });

      const algorithm = await tx.algorithmConfig.update({
        where: { id },
        data: { isActive: true }
      });

      // Log activity
      const activityData = ActivityService.ActivityTemplates.ALGORITHM_ACTIVATED(
        algorithm.name,
        (req as any).user?.name || 'admin'
      );
      await ActivityService.logActivity({
        ...activityData,
        impact: activityData.impact as 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
      });

      res.json(algorithm);
    });
  } catch (error: any) {
    console.error('Error activating algorithm:', error);
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Algorithm not found' });
    }
    res.status(400).json({ error: 'Failed to activate algorithm' });
  }
});

// Get currently active algorithm
router.get('/active/current', async (req: Request, res: Response) => {
  try {
    const algorithm = await prisma.algorithmConfig.findFirst({
      where: { isActive: true }
    });

    if (!algorithm) {
      return res.status(404).json({ error: 'No active algorithm found' });
    }

    res.json(algorithm);
  } catch (error) {
    console.error('Error fetching active algorithm:', error);
    res.status(500).json({ error: 'Failed to fetch active algorithm' });
  }
});

// Generate automated schedule preview
router.post('/generate-preview', async (req: Request, res: Response) => {
  console.log('🚀 generate-preview route called');
  const startTime = Date.now();
  const { startDate, endDate, algorithmType = 'weekend-rotation', generatedBy = 'admin' } = req.body;

  try {
    if (!startDate || !endDate) {
      return res.status(400).json({ error: 'Start date and end date are required' });
    }

    const algorithm = AlgorithmRegistry.getAlgorithm(algorithmType);
    if (!algorithm) {
      return res.status(400).json({ error: `Algorithm '${algorithmType}' not found.` });
    }

    console.log('Retrieved algorithm:', {
      name: algorithm.name,
      description: algorithm.description,
      version: algorithm.version,
      supportedFeatures: algorithm.supportedFeatures
    });

    // Validate date strings
    if (!isValidDateString(startDate) || !isValidDateString(endDate)) {
      return res.status(400).json({ error: 'Invalid date format. Use YYYY-MM-DD format.' });
    }

    const start = createLocalDate(startDate);
    const end = createLocalDate(endDate);

    const analysts = await prisma.analyst.findMany({
      where: { isActive: true },
      include: {
        vacations: { where: { isApproved: true, OR: [{ startDate: { lte: end }, endDate: { gte: start } }] } },
        constraints: { where: { isActive: true, OR: [{ startDate: { lte: end }, endDate: { gte: start } }] } }
      },
      orderBy: { name: 'asc' }
    });

    if (analysts.length === 0) {
      return res.status(400).json({ error: 'No active analysts found' });
    }

    const existingSchedules = await prisma.schedule.findMany({
      where: { date: { gte: start, lte: end } },
      include: { analyst: true }
    });

    const globalConstraints = await prisma.schedulingConstraint.findMany({
      where: { analystId: null, isActive: true, startDate: { lte: end }, endDate: { gte: start } }
    });

    const result = await algorithm.generateSchedules({ startDate: start, endDate: end, analysts, existingSchedules, globalConstraints, regionId: analysts[0]?.regionId || 'default' });

    console.log('Algorithm result structure:', {
      hasFairnessMetrics: !!result.fairnessMetrics,
      hasPerformanceMetrics: !!result.performanceMetrics,
      fairnessScore: result.fairnessMetrics?.overallFairnessScore,
      executionTime: result.performanceMetrics?.algorithmExecutionTime,
      resultKeys: Object.keys(result),
      resultType: typeof result,
      isArray: Array.isArray(result)
    });

    const executionTime = Date.now() - startTime;
    const preview = {
      startDate,
      endDate,
      algorithmType,
      proposedSchedules: result.proposedSchedules,
      conflicts: result.conflicts,
      overwrites: result.overwrites,
      fairnessMetrics: result.fairnessMetrics,
      performanceMetrics: result.performanceMetrics,
      summary: {
        totalDays: Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1,
        totalSchedules: result.proposedSchedules.length,
        newSchedules: result.proposedSchedules.filter(s => s.type === 'NEW_SCHEDULE').length,
        overwrittenSchedules: result.overwrites.length,
        conflicts: result.conflicts.length,
        fairnessScore: result.fairnessMetrics?.overallFairnessScore || 0,
        executionTime: result.performanceMetrics?.algorithmExecutionTime || 0
      }
    };

    // Note: Logging is done in apply-schedule endpoint when schedules are actually saved to database

    console.log('Algorithm result structure:', {
      hasFairnessMetrics: !!result.fairnessMetrics,
      hasPerformanceMetrics: !!result.performanceMetrics,
      fairnessScore: result.fairnessMetrics?.overallFairnessScore,
      executionTime: result.performanceMetrics?.algorithmExecutionTime
    });

    res.json(preview);
  } catch (error) {
    console.error('Error generating schedule preview:', error);

    // Note: Logging is done in apply-schedule endpoint when schedules are actually saved to database

    res.status(500).json({ error: 'Failed to generate schedule preview' });
  }
});

// Apply automated schedule
router.post('/apply-schedule', async (req: Request, res: Response) => {
  const startTime = Date.now();
  const { startDate, endDate, algorithmType = 'weekend-rotation', overwriteExisting = false, generatedBy = 'admin' } = req.body;

  try {

    if (!startDate || !endDate) {
      return res.status(400).json({ error: 'Start date and end date are required' });
    }

    const algorithm = AlgorithmRegistry.getAlgorithm(algorithmType);
    if (!algorithm) {
      return res.status(400).json({ error: `Algorithm '${algorithmType}' not found.` });
    }

    // Validate date strings
    if (!isValidDateString(startDate) || !isValidDateString(endDate)) {
      return res.status(400).json({ error: 'Invalid date format. Use YYYY-MM-DD format.' });
    }

    const start = createLocalDate(startDate);
    const end = createLocalDate(endDate);

    const analysts = await prisma.analyst.findMany({
      where: { isActive: true },
      include: {
        vacations: { where: { isApproved: true, OR: [{ startDate: { lte: end }, endDate: { gte: start } }] } },
        constraints: { where: { isActive: true, OR: [{ startDate: { lte: end }, endDate: { gte: start } }] } }
      },
      orderBy: { name: 'asc' }
    });

    if (analysts.length === 0) {
      return res.status(400).json({ error: 'No active analysts found' });
    }

    const existingSchedules = await prisma.schedule.findMany({
      where: { date: { gte: start, lte: end } },
      include: { analyst: true }
    });

    const globalConstraints = await prisma.schedulingConstraint.findMany({
      where: { analystId: null, isActive: true, startDate: { lte: end }, endDate: { gte: start } }
    });

    const { proposedSchedules, conflicts } = await algorithm.generateSchedules({ startDate: start, endDate: end, analysts, existingSchedules, globalConstraints, regionId: analysts[0]?.regionId || 'default' });

    const result = {
      message: '',
      createdSchedules: [] as any[],
      updatedSchedules: [] as any[],
      deletedSchedules: [] as any[],
      conflicts: conflicts
    };

    for (const schedule of proposedSchedules) {
      try {
        const existing = existingSchedules.find((s: any) => s.analystId === schedule.analystId && new Date(s.date).toISOString().split('T')[0] === schedule.date);

        if (existing) {
          if (overwriteExisting && (existing.shiftType !== schedule.shiftType || existing.isScreener !== schedule.isScreener)) {
            const updated = await prisma.schedule.update({
              where: { id: existing.id },
              data: { shiftType: schedule.shiftType, isScreener: schedule.isScreener },
              include: { analyst: true }
            });
            result.updatedSchedules.push(updated);
          }
        } else {
          const analyst = analysts.find(a => a.id === schedule.analystId);
          const regionId = analyst?.regionId || 'default';
          const created = await prisma.schedule.create({
            data: {
              analystId: schedule.analystId,
              date: new Date(schedule.date),
              shiftType: schedule.shiftType,
              isScreener: schedule.isScreener,
              regionId: regionId
            },
            include: { analyst: true }
          });
          result.createdSchedules.push(created);
        }
      } catch (error: any) {
        result.conflicts.push({
          date: schedule.date,
          type: 'CONSTRAINT_VIOLATION',
          description: error.message,
          severity: 'HIGH'
        });
      }
    }

    result.message = `Successfully processed ${result.createdSchedules.length} new schedules and ${result.updatedSchedules.length} updated schedules`;

    // Log the successful schedule application
    const executionTime = Date.now() - startTime;
    const totalSchedulesApplied = result.createdSchedules.length + result.updatedSchedules.length;

    await scheduleGenerationLogger.logSuccess({
      generatedBy,
      algorithmType,
      startDate: start,
      endDate: end,
      schedulesGenerated: totalSchedulesApplied,
      conflictsDetected: result.conflicts.length,
      executionTime,
      metadata: {
        newSchedules: result.createdSchedules.length,
        updatedSchedules: result.updatedSchedules.length,
        overwriteExisting,
        analystsCount: analysts.length,
        existingSchedulesCount: existingSchedules.length,
        globalConstraintsCount: globalConstraints.length,
      }
    });

    res.json(result);
  } catch (error) {
    console.error('Error applying schedule:', error);

    // Log the failed schedule application
    await scheduleGenerationLogger.logFailure({
      generatedBy,
      algorithmType,
      startDate: createLocalDate(startDate),
      endDate: createLocalDate(endDate),
      executionTime: Date.now() - startTime,
      errorMessage: error instanceof Error ? error.message : 'Unknown error',
      metadata: { error: error instanceof Error ? error.stack : String(error) }
    });

    res.status(500).json({ error: 'Failed to apply schedule' });
  }
});

export default router;