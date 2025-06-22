import { Router, Request, Response } from 'express';
import { prisma } from '../app';

const router = Router();

// Get all analysts
router.get('/', async (req: Request, res: Response) => {
  try {
    const analysts = await prisma.analyst.findMany({
      include: {
        preferences: true,
        schedules: {
          orderBy: { date: 'desc' },
          take: 10
        }
      },
      orderBy: { name: 'asc' }
    });
    res.json(analysts);
  } catch (error) {
    console.error('Error fetching analysts:', error);
    res.status(500).json({ error: 'Failed to fetch analysts' });
  }
});

// Get analyst by ID
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const analyst = await prisma.analyst.findUnique({
      where: { id },
      include: {
        preferences: true,
        schedules: {
          orderBy: { date: 'desc' },
          take: 50
        }
      }
    });
    
    if (!analyst) {
      return res.status(404).json({ error: 'Analyst not found' });
    }
    
    res.json(analyst);
  } catch (error) {
    console.error('Error fetching analyst:', error);
    res.status(500).json({ error: 'Failed to fetch analyst' });
  }
});

// Create new analyst
router.post('/', async (req: Request, res: Response) => {
  try {
    const { name, email, role } = req.body;
    
    if (!name || !email) {
      return res.status(400).json({ error: 'Name and email are required' });
    }
    
    const analyst = await prisma.analyst.create({
      data: { 
        name, 
        email, 
        role: role || 'REGULAR' 
      },
      include: { preferences: true }
    });
    
    res.status(201).json(analyst);
  } catch (error: any) {
    console.error('Error creating analyst:', error);
    if (error.code === 'P2002') {
      return res.status(400).json({ error: 'Email already exists' });
    }
    res.status(400).json({ error: 'Failed to create analyst' });
  }
});

// Update analyst
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name, email, role, isActive } = req.body;
    
    const analyst = await prisma.analyst.update({
      where: { id },
      data: { 
        name, 
        email, 
        role, 
        isActive 
      },
      include: { preferences: true }
    });
    
    res.json(analyst);
  } catch (error: any) {
    console.error('Error updating analyst:', error);
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Analyst not found' });
    }
    if (error.code === 'P2002') {
      return res.status(400).json({ error: 'Email already exists' });
    }
    res.status(400).json({ error: 'Failed to update analyst' });
  }
});

// Delete analyst
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await prisma.analyst.delete({ where: { id } });
    res.status(204).send();
  } catch (error: any) {
    console.error('Error deleting analyst:', error);
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Analyst not found' });
    }
    res.status(400).json({ error: 'Failed to delete analyst' });
  }
});

// Get analyst preferences
router.get('/:id/preferences', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const preferences = await prisma.analystPreference.findMany({
      where: { analystId: id }
    });
    res.json(preferences);
  } catch (error) {
    console.error('Error fetching preferences:', error);
    res.status(500).json({ error: 'Failed to fetch preferences' });
  }
});

// Update analyst preferences
router.post('/:id/preferences', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { shiftType, dayOfWeek, preference } = req.body;
    
    if (!shiftType || !dayOfWeek || !preference) {
      return res.status(400).json({ error: 'shiftType, dayOfWeek, and preference are required' });
    }
    
    const preferenceRecord = await prisma.analystPreference.upsert({
      where: {
        analystId_shiftType_dayOfWeek: {
          analystId: id,
          shiftType,
          dayOfWeek
        }
      },
      update: { preference },
      create: {
        analystId: id,
        shiftType,
        dayOfWeek,
        preference
      }
    });
    
    res.status(201).json(preferenceRecord);
  } catch (error) {
    console.error('Error updating preference:', error);
    res.status(400).json({ error: 'Failed to update preference' });
  }
});

export default router; 