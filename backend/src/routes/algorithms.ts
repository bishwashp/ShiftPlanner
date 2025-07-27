import { Router, Request, Response } from 'express';
import { prisma } from '../app';
import { AlgorithmRegistry } from '../services/scheduling/AlgorithmRegistry';

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
    
    await prisma.$transaction(async (tx) => {
      await tx.algorithmConfig.updateMany({
        where: { isActive: true },
        data: { isActive: false }
      });
      
      const algorithm = await tx.algorithmConfig.update({
        where: { id },
        data: { isActive: true }
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
  try {
    const { startDate, endDate, algorithmType = 'weekend-rotation' } = req.body;
    
    if (!startDate || !endDate) {
      return res.status(400).json({ error: 'Start date and end date are required' });
    }
    
    const algorithm = AlgorithmRegistry.getAlgorithm(algorithmType);
    if (!algorithm) {
        return res.status(400).json({ error: `Algorithm '${algorithmType}' not found.` });
    }

    const start = new Date(startDate);
    const end = new Date(endDate);
    
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
    
    const result = await algorithm.generateSchedules({ startDate: start, endDate: end, analysts, existingSchedules, globalConstraints });

    const preview = {
        startDate,
        endDate,
        algorithmType,
        proposedSchedules: result.proposedSchedules,
        conflicts: result.conflicts,
        overwrites: result.overwrites,
        summary: {
            totalDays: Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1,
            totalSchedules: result.proposedSchedules.length,
            newSchedules: result.proposedSchedules.filter(s => s.type === 'NEW_SCHEDULE').length,
            overwrittenSchedules: result.overwrites.length,
            conflicts: result.conflicts.length
        }
    };

    res.json(preview);
  } catch (error) {
    console.error('Error generating schedule preview:', error);
    res.status(500).json({ error: 'Failed to generate schedule preview' });
  }
});

// Apply automated schedule
router.post('/apply-schedule', async (req: Request, res: Response) => {
  try {
    const { startDate, endDate, algorithmType = 'weekend-rotation', overwriteExisting = false } = req.body;
    
    if (!startDate || !endDate) {
      return res.status(400).json({ error: 'Start date and end date are required' });
    }

    const algorithm = AlgorithmRegistry.getAlgorithm(algorithmType);
    if (!algorithm) {
        return res.status(400).json({ error: `Algorithm '${algorithmType}' not found.` });
    }
    
    const start = new Date(startDate);
    const end = new Date(endDate);

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

      const { proposedSchedules, conflicts } = await algorithm.generateSchedules({ startDate: start, endDate: end, analysts, existingSchedules, globalConstraints });

      const result = {
        message: '',
        createdSchedules: [] as any[],
        updatedSchedules: [] as any[],
        deletedSchedules: [] as any[],
        conflicts: conflicts
    };

    for (const schedule of proposedSchedules) {
        try {
            const existing = existingSchedules.find(s => s.analystId === schedule.analystId && new Date(s.date).toISOString().split('T')[0] === schedule.date);
            
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
                const created = await prisma.schedule.create({
                    data: {
                        analystId: schedule.analystId,
                        date: new Date(schedule.date),
                        shiftType: schedule.shiftType,
                        isScreener: schedule.isScreener
                    },
                    include: { analyst: true }
                });
                result.createdSchedules.push(created);
            }
        } catch (error: any) {
            result.conflicts.push({
                date: schedule.date,
                type: 'SCHEDULE_APPLICATION_ERROR',
                description: error.message
            });
        }
    }

    result.message = `Successfully processed ${result.createdSchedules.length} new schedules and ${result.updatedSchedules.length} updated schedules`;
    
    res.json(result);
  } catch (error) {
    console.error('Error applying schedule:', error);
    res.status(500).json({ error: 'Failed to apply schedule' });
  }
});

export default router;