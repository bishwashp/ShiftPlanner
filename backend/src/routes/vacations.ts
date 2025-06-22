import { Router, Request, Response } from 'express';
import { prisma } from '../app';

const router = Router();

// Get all vacations with optional analyst filter
router.get('/', async (req: Request, res: Response) => {
  try {
    const { analystId } = req.query;
    
    const where: any = {};
    if (analystId) {
      where.analystId = analystId as string;
    }
    
    const vacations = await prisma.vacation.findMany({
      where,
      include: {
        analyst: true
      },
      orderBy: { startDate: 'asc' }
    });
    
    res.json(vacations);
  } catch (error) {
    console.error('Error fetching vacations:', error);
    res.status(500).json({ error: 'Failed to fetch vacations' });
  }
});

// Get vacation by ID
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const vacation = await prisma.vacation.findUnique({
      where: { id },
      include: { analyst: true }
    });
    
    if (!vacation) {
      return res.status(404).json({ error: 'Vacation not found' });
    }
    
    res.json(vacation);
  } catch (error) {
    console.error('Error fetching vacation:', error);
    res.status(500).json({ error: 'Failed to fetch vacation' });
  }
});

// Create new vacation
router.post('/', async (req: Request, res: Response) => {
  try {
    const { analystId, startDate, endDate, reason, isApproved = true } = req.body;
    
    if (!analystId || !startDate || !endDate) {
      return res.status(400).json({ error: 'analystId, startDate, and endDate are required' });
    }
    
    // Verify analyst exists
    const analyst = await prisma.analyst.findUnique({
      where: { id: analystId }
    });
    
    if (!analyst) {
      return res.status(404).json({ error: 'Analyst not found' });
    }
    
    const vacation = await prisma.vacation.create({
      data: {
        analystId,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        reason,
        isApproved
      },
      include: { analyst: true }
    });
    
    res.status(201).json(vacation);
  } catch (error: any) {
    console.error('Error creating vacation:', error);
    res.status(400).json({ error: 'Failed to create vacation' });
  }
});

// Update vacation
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { startDate, endDate, reason, isApproved } = req.body;
    
    const vacation = await prisma.vacation.update({
      where: { id },
      data: {
        startDate: startDate ? new Date(startDate) : undefined,
        endDate: endDate ? new Date(endDate) : undefined,
        reason,
        isApproved
      },
      include: { analyst: true }
    });
    
    res.json(vacation);
  } catch (error: any) {
    console.error('Error updating vacation:', error);
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Vacation not found' });
    }
    res.status(400).json({ error: 'Failed to update vacation' });
  }
});

// Delete vacation
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await prisma.vacation.delete({ where: { id } });
    res.status(204).send();
  } catch (error: any) {
    console.error('Error deleting vacation:', error);
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Vacation not found' });
    }
    res.status(400).json({ error: 'Failed to delete vacation' });
  }
});

export default router;