import { Router } from 'express';
import { prisma } from '../app';

const router = Router();

// Get schedules with optional date filtering
router.get('/', async (req, res) => {
  try {
    const { startDate, endDate, analystId } = req.query;
    
    const where: any = {};
    
    if (startDate || endDate) {
      where.date = {};
      if (startDate) where.date.gte = new Date(startDate as string);
      if (endDate) where.date.lte = new Date(endDate as string);
    }
    
    if (analystId) {
      where.analystId = analystId as string;
    }
    
    const schedules = await prisma.schedule.findMany({
      where,
      include: {
        analyst: true
      },
      orderBy: { date: 'asc' }
    });
    
    res.json(schedules);
  } catch (error) {
    console.error('Error fetching schedules:', error);
    res.status(500).json({ error: 'Failed to fetch schedules' });
  }
});

// Get schedule by ID
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const schedule = await prisma.schedule.findUnique({
      where: { id },
      include: {
        analyst: true
      }
    });
    
    if (!schedule) {
      return res.status(404).json({ error: 'Schedule not found' });
    }
    
    res.json(schedule);
  } catch (error) {
    console.error('Error fetching schedule:', error);
    res.status(500).json({ error: 'Failed to fetch schedule' });
  }
});

// Create new schedule
router.post('/', async (req, res) => {
  try {
    const { analystId, date, shiftType, role } = req.body;
    
    if (!analystId || !date || !shiftType) {
      return res.status(400).json({ error: 'analystId, date, and shiftType are required' });
    }
    
    const schedule = await prisma.schedule.create({
      data: {
        analystId,
        date: new Date(date),
        shiftType,
        role: role || 'REGULAR'
      },
      include: { analyst: true }
    });
    
    res.status(201).json(schedule);
  } catch (error: any) {
    console.error('Error creating schedule:', error);
    if (error.code === 'P2002') {
      return res.status(400).json({ error: 'Analyst already has a schedule for this date' });
    }
    res.status(400).json({ error: 'Failed to create schedule' });
  }
});

// Update schedule
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { analystId, date, shiftType, role } = req.body;
    
    const schedule = await prisma.schedule.update({
      where: { id },
      data: {
        analystId,
        date: date ? new Date(date) : undefined,
        shiftType,
        role
      },
      include: { analyst: true }
    });
    
    res.json(schedule);
  } catch (error: any) {
    console.error('Error updating schedule:', error);
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Schedule not found' });
    }
    res.status(400).json({ error: 'Failed to update schedule' });
  }
});

// Delete schedule
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await prisma.schedule.delete({ where: { id } });
    res.status(204).send();
  } catch (error: any) {
    console.error('Error deleting schedule:', error);
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Schedule not found' });
    }
    res.status(400).json({ error: 'Failed to delete schedule' });
  }
});

// Bulk create schedules
router.post('/bulk', async (req, res) => {
  try {
    const { schedules } = req.body;
    
    if (!Array.isArray(schedules)) {
      return res.status(400).json({ error: 'schedules must be an array' });
    }
    
    const createdSchedules = await prisma.schedule.createMany({
      data: schedules.map((schedule: any) => ({
        analystId: schedule.analystId,
        date: new Date(schedule.date),
        shiftType: schedule.shiftType,
        role: schedule.role || 'REGULAR'
      })),
      skipDuplicates: true
    });
    
    res.status(201).json({ 
      message: `Created ${createdSchedules.count} schedules`,
      count: createdSchedules.count
    });
  } catch (error) {
    console.error('Error creating bulk schedules:', error);
    res.status(400).json({ error: 'Failed to create schedules' });
  }
});

export default router; 