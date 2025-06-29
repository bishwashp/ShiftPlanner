import { Router, Request, Response } from 'express';
import { prisma } from '../app';
import { PrismaClient } from '@prisma/client';
import moment from 'moment';

const prismaClient = new PrismaClient();
const router = Router();

// Get all schedules with optional filters
router.get('/', async (req: Request, res: Response) => {
  try {
    const { startDate, endDate, analystId } = req.query;
    
    const where: any = {};
    
    if (startDate && endDate) {
      where.date = {
        gte: new Date(startDate as string),
        lte: new Date(endDate as string)
      };
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
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const schedule = await prisma.schedule.findUnique({
      where: { id },
      include: { analyst: true }
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
router.post('/', async (req: Request, res: Response) => {
  try {
    const { analystId, date, shiftType, isScreener = false } = req.body;
    
    if (!analystId || !date || !shiftType) {
      return res.status(400).json({ error: 'analystId, date, and shiftType are required' });
    }
    
    // Verify analyst exists and check if shiftType matches their assigned shift
    const analyst = await prisma.analyst.findUnique({
      where: { id: analystId }
    });
    
    if (!analyst) {
      return res.status(404).json({ error: 'Analyst not found' });
    }
    
    if (analyst.shiftType !== shiftType) {
      return res.status(400).json({ 
        error: `Analyst is assigned to ${analyst.shiftType} shift but schedule is for ${shiftType} shift` 
      });
    }
    
    // Check if analyst already has a schedule for this date
    const existingSchedule = await prisma.schedule.findUnique({
      where: { analystId_date: { analystId, date: new Date(date) } }
    });
    
    if (existingSchedule) {
      return res.status(400).json({ error: 'Analyst already has a schedule for this date' });
    }
    
    // If this is a screener assignment, check if there's already a screener for this shift/date
    if (isScreener) {
      const existingScreener = await prisma.schedule.findFirst({
        where: {
          date: new Date(date),
          shiftType,
          isScreener: true
        }
      });
      
      if (existingScreener) {
        return res.status(400).json({ 
          error: `There is already a screener assigned for ${shiftType} shift on ${new Date(date).toDateString()}` 
        });
      }
    }
    
    const schedule = await prisma.schedule.create({
      data: {
        analystId,
        date: new Date(date),
        shiftType,
        isScreener
      },
      include: { analyst: true }
    });
    
    res.status(201).json(schedule);
  } catch (error: any) {
    console.error('Error creating schedule:', error);
    if (error.code === 'P2002') {
      return res.status(400).json({ error: 'Schedule already exists for this analyst and date' });
    }
    res.status(400).json({ error: 'Failed to create schedule' });
  }
});

// Update schedule
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { analystId, date, shiftType, isScreener } = req.body;
    
    // Get current schedule to check for conflicts
    const currentSchedule = await prisma.schedule.findUnique({
      where: { id },
      include: { analyst: true }
    });
    
    if (!currentSchedule) {
      return res.status(404).json({ error: 'Schedule not found' });
    }
    
    // If changing analyst, verify the new analyst exists and shiftType matches
    if (analystId && analystId !== currentSchedule.analystId) {
      const analyst = await prisma.analyst.findUnique({
        where: { id: analystId }
      });
      
      if (!analyst) {
        return res.status(404).json({ error: 'Analyst not found' });
      }
      
      if (analyst.shiftType !== shiftType) {
        return res.status(400).json({ 
          error: `Analyst is assigned to ${analyst.shiftType} shift but schedule is for ${shiftType} shift` 
        });
      }
      
      // Check if new analyst already has a schedule for this date
      const existingSchedule = await prisma.schedule.findUnique({
        where: { analystId_date: { analystId, date: new Date(date || currentSchedule.date) } }
      });
      
      if (existingSchedule) {
        return res.status(400).json({ error: 'Analyst already has a schedule for this date' });
      }
    }
    
    // If making this a screener assignment, check for conflicts
    if (isScreener && !currentSchedule.isScreener) {
      const existingScreener = await prisma.schedule.findFirst({
        where: {
          date: new Date(date || currentSchedule.date),
          shiftType: shiftType || currentSchedule.shiftType,
          isScreener: true,
          id: { not: id } // Exclude current schedule
        }
      });
      
      if (existingScreener) {
        return res.status(400).json({ 
          error: `There is already a screener assigned for this shift and date` 
        });
      }
    }
    
    const schedule = await prisma.schedule.update({
      where: { id },
      data: {
        analystId,
        date: date ? new Date(date) : undefined,
        shiftType,
        isScreener
      },
      include: { analyst: true }
    });
    
    res.json(schedule);
  } catch (error: any) {
    console.error('Error updating schedule:', error);
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Schedule not found' });
    }
    if (error.code === 'P2002') {
      return res.status(400).json({ error: 'Schedule already exists for this analyst and date' });
    }
    res.status(400).json({ error: 'Failed to update schedule' });
  }
});

// Delete schedule
router.delete('/:id', async (req: Request, res: Response) => {
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

// Create bulk schedules
router.post('/bulk', async (req: Request, res: Response) => {
  try {
    const { schedules } = req.body;
    
    if (!Array.isArray(schedules) || schedules.length === 0) {
      return res.status(400).json({ error: 'schedules array is required and must not be empty' });
    }
    
    const createdSchedules = [];
    const errors = [];
    
    for (const scheduleData of schedules) {
      try {
        const { analystId, date, shiftType, isScreener = false } = scheduleData;
        
        if (!analystId || !date || !shiftType) {
          errors.push({ schedule: scheduleData, error: 'analystId, date, and shiftType are required' });
          continue;
        }
        
        // Verify analyst exists and check shiftType
        const analyst = await prisma.analyst.findUnique({
          where: { id: analystId }
        });
        
        if (!analyst) {
          errors.push({ schedule: scheduleData, error: 'Analyst not found' });
          continue;
        }
        
        if (analyst.shiftType !== shiftType) {
          errors.push({ 
            schedule: scheduleData, 
            error: `Analyst is assigned to ${analyst.shiftType} shift but schedule is for ${shiftType} shift` 
          });
          continue;
        }
        
        // Check for existing schedule
        const existingSchedule = await prisma.schedule.findUnique({
          where: { analystId_date: { analystId, date: new Date(date) } }
        });
        
        if (existingSchedule) {
          errors.push({ schedule: scheduleData, error: 'Analyst already has a schedule for this date' });
          continue;
        }
        
        // Check for screener conflicts
        if (isScreener) {
          const existingScreener = await prisma.schedule.findFirst({
            where: {
              date: new Date(date),
              shiftType,
              isScreener: true
            }
          });
          
          if (existingScreener) {
            errors.push({ 
              schedule: scheduleData, 
              error: `There is already a screener assigned for ${shiftType} shift on ${new Date(date).toDateString()}` 
            });
            continue;
          }
        }
        
        const schedule = await prisma.schedule.create({
          data: {
            analystId,
            date: new Date(date),
            shiftType,
            isScreener
          },
          include: { analyst: true }
        });
        
        createdSchedules.push(schedule);
      } catch (error: any) {
        errors.push({ schedule: scheduleData, error: error.message });
      }
    }
    
    res.status(201).json({
      message: `Created ${createdSchedules.length} schedules${errors.length > 0 ? `, ${errors.length} failed` : ''}`,
      count: createdSchedules.length,
      schedules: createdSchedules,
      errors: errors.length > 0 ? errors : undefined
    });
  } catch (error) {
    console.error('Error creating bulk schedules:', error);
    res.status(500).json({ error: 'Failed to create bulk schedules' });
  }
});

// Get schedule health and conflicts
router.get('/health/conflicts', async (req: Request, res: Response) => {
  try {
    const { startDate, endDate } = req.query;

    let start, end;

    if (typeof startDate === 'string' && typeof endDate === 'string') {
      start = new Date(startDate);
      end = new Date(endDate);
    } else {
      start = new Date();
      end = new Date();
      end.setDate(end.getDate() + 30);
    }

    const allDates = new Set<string>();
    const currentDate = new Date(start);
    while (currentDate <= end) {
      allDates.add(currentDate.toISOString().split('T')[0]);
      currentDate.setDate(currentDate.getDate() + 1);
    }

    const schedules = await prisma.schedule.findMany({
      where: {
        date: {
          gte: start,
          lte: end,
        },
      },
    });

    const scheduledDates = new Map<string, { morning: boolean, evening: boolean }>();

    for (const schedule of schedules) {
      const dateStr = schedule.date.toISOString().split('T')[0];
      if (!scheduledDates.has(dateStr)) {
        scheduledDates.set(dateStr, { morning: false, evening: false });
      }
      const shifts = scheduledDates.get(dateStr)!;
      if (schedule.shiftType === 'MORNING') {
        shifts.morning = true;
      }
      if (schedule.shiftType === 'EVENING') {
        shifts.evening = true;
      }
    }

    const conflicts: { date: string; message: string; type: string; missingShifts: string[]; severity: string }[] = [];
    allDates.forEach(dateStr => {
      const shifts = scheduledDates.get(dateStr);
      let missingShifts: string[] = [];
      if (!shifts || !shifts.morning) {
        missingShifts.push('Morning');
      }
      if (!shifts || !shifts.evening) {
        missingShifts.push('Evening');
      }

      if (missingShifts.length > 0) {
        conflicts.push({
          date: dateStr,
          message: `Missing ${missingShifts.join(' and ')} shift(s) on ${moment(dateStr).format('MMM D')}`,
          type: 'NO_ANALYST_ASSIGNED',
          missingShifts,
          severity: 'critical'
        });
      }
    });

    res.json(conflicts);
  } catch (error) {
    console.error('Error checking schedule health:', error);
    res.status(500).json({ error: 'Failed to check schedule health' });
  }
});

export default router; 