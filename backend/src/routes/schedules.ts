import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import moment from 'moment';
import { IntelligentScheduler } from '../services/IntelligentScheduler';
import { DateUtils } from '../utils/dateUtils';

const router = Router();

// Get all schedules with optional filters
router.get('/', async (req: Request, res: Response) => {
  try {
    const { startDate, endDate, analystId } = req.query;

    const where: any = {};

    if (startDate && endDate) {
      where.date = {
        gte: DateUtils.getStartOfDay(startDate as string),
        lte: DateUtils.getEndOfDay(endDate as string)
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
    const storageDate = DateUtils.asStorageDate(date);
    const existingSchedule = await prisma.schedule.findUnique({
      where: { analystId_date: { analystId, date: storageDate } }
    });

    if (existingSchedule) {
      return res.status(400).json({ error: 'Analyst already has a schedule for this date' });
    }

    // If this is a screener assignment, check if there's already a screener for this shift/date
    if (isScreener) {
      const existingScreener = await prisma.schedule.findFirst({
        where: {
          date: storageDate,
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

    // --- VALIDATION START ---
    // 1. Fetch active constraints
    const constraints = await prisma.schedulingConstraint.findMany({
      where: { isActive: true }
    });

    // 2. Fetch context schedules
    const checkDate = new Date(date);
    const startDate = new Date(checkDate);
    startDate.setDate(startDate.getDate() - 30);
    const endDate = new Date(checkDate);
    endDate.setDate(endDate.getDate() + 30);

    const contextSchedulesRaw = await prisma.schedule.findMany({
      where: {
        date: {
          gte: startDate,
          lte: endDate
        }
      },
      include: { analyst: true }
    });

    // 3. Prepare proposed schedule
    const proposedSchedule = {
      id: 'proposed',
      analystId,
      analystName: analyst.name,
      date: new Date(date).toISOString(),
      shiftType: shiftType as 'MORNING' | 'EVENING' | 'WEEKEND',
      analystShiftType: analyst.shiftType as 'MORNING' | 'EVENING' | 'WEEKEND',
      isScreener: isScreener || false,
      type: 'NEW_SCHEDULE' as const
    };

    const contextSchedules = contextSchedulesRaw.map(s => ({
      id: s.id,
      analystId: s.analystId,
      analystName: s.analyst.name,
      date: s.date.toISOString(),
      shiftType: s.shiftType as 'MORNING' | 'EVENING' | 'WEEKEND',
      analystShiftType: s.analyst.shiftType as 'MORNING' | 'EVENING' | 'WEEKEND',
      isScreener: s.isScreener,
      type: 'NEW_SCHEDULE' as const
    }));

    // 4. Run validation
    const { constraintEngine } = await import('../services/scheduling/algorithms/ConstraintEngine');
    const violations = constraintEngine.checkScheduleConstraints(
      proposedSchedule,
      contextSchedules,
      constraints
    );

    const hardViolations = violations.filter(v => v.type === 'HARD');
    if (hardViolations.length > 0) {
      return res.status(400).json({
        error: `Validation failed: ${hardViolations.map(v => v.description).join(', ')}`,
        violations: hardViolations
      });
    }
    // --- VALIDATION END ---

    const schedule = await prisma.schedule.create({
      data: {
        analystId,
        date: storageDate,
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
    // Check if we need to validate screener uniqueness:
    // 1. If we are setting isScreener=true
    // 2. AND (it wasn't a screener before OR we are changing date/shift)
    {
      const targetDate = date ? new Date(date) : currentSchedule.date;
      const targetShift = shiftType || currentSchedule.shiftType;

      // Check if date changed (compare timestamps to avoid object reference issues)
      const dateChanged = date && new Date(date).getTime() !== currentSchedule.date.getTime();
      const shiftChanged = shiftType && shiftType !== currentSchedule.shiftType;
      const becomingScreener = isScreener === true;
      const wasScreener = currentSchedule.isScreener;

      if (becomingScreener && (!wasScreener || dateChanged || shiftChanged)) {
        console.log(`Checking screener conflict for ${targetDate.toISOString()} ${targetShift}`);

        const existingScreener = await prisma.schedule.findFirst({
          where: {
            date: targetDate,
            shiftType: targetShift,
            isScreener: true,
            id: { not: id } // Exclude current schedule
          },
          include: { analyst: true }
        });

        if (existingScreener) {
          console.log('Found conflicting screener:', {
            id: existingScreener.id,
            analyst: existingScreener.analyst.name,
            date: existingScreener.date,
            shift: existingScreener.shiftType
          });
          return res.status(400).json({
            error: `There is already a screener assigned for this shift and date: ${existingScreener.analyst.name}`
          });
        }
      }
    }

    // --- VALIDATION START ---
    // 1. Fetch active constraints
    const constraints = await prisma.schedulingConstraint.findMany({
      where: { isActive: true }
    });

    // 2. Fetch context schedules
    const targetDate = date ? new Date(date) : currentSchedule.date;
    const startDate = new Date(targetDate);
    startDate.setDate(startDate.getDate() - 30);
    const endDate = new Date(targetDate);
    endDate.setDate(endDate.getDate() + 30);

    const contextSchedulesRaw = await prisma.schedule.findMany({
      where: {
        date: {
          gte: startDate,
          lte: endDate
        }
      },
      include: { analyst: true }
    });

    // 3. Prepare proposed schedule
    // We need the analyst for the proposed schedule (either new or existing)
    let targetAnalyst = currentSchedule.analyst;
    if (analystId && analystId !== currentSchedule.analystId) {
      const newAnalyst = await prisma.analyst.findUnique({ where: { id: analystId } });
      if (newAnalyst) targetAnalyst = newAnalyst;
    }

    const proposedSchedule = {
      id: id,
      analystId: analystId || currentSchedule.analystId,
      analystName: targetAnalyst.name,
      date: targetDate.toISOString(),
      shiftType: (shiftType || currentSchedule.shiftType) as 'MORNING' | 'EVENING' | 'WEEKEND',
      analystShiftType: targetAnalyst.shiftType as 'MORNING' | 'EVENING' | 'WEEKEND',
      isScreener: isScreener !== undefined ? isScreener : currentSchedule.isScreener,
      type: 'NEW_SCHEDULE' as const
    };

    const contextSchedules = contextSchedulesRaw
      .filter(s => s.id !== id) // Exclude the schedule being updated
      .map(s => ({
        id: s.id,
        analystId: s.analystId,
        analystName: s.analyst.name,
        date: s.date.toISOString(),
        shiftType: s.shiftType as 'MORNING' | 'EVENING' | 'WEEKEND',
        analystShiftType: s.analyst.shiftType as 'MORNING' | 'EVENING' | 'WEEKEND',
        isScreener: s.isScreener,
        type: 'NEW_SCHEDULE' as const
      }));

    // 4. Run validation
    const { constraintEngine } = await import('../services/scheduling/algorithms/ConstraintEngine');
    const violations = constraintEngine.checkScheduleConstraints(
      proposedSchedule,
      contextSchedules,
      constraints
    );

    const hardViolations = violations.filter(v => v.type === 'HARD');
    if (hardViolations.length > 0) {
      return res.status(400).json({
        error: `Validation failed: ${hardViolations.map(v => v.description).join(', ')}`,
        violations: hardViolations
      });
    }
    // --- VALIDATION END ---

    const schedule = await prisma.schedule.update({
      where: { id },
      data: {
        analystId,
        date: date ? DateUtils.asStorageDate(date) : undefined,
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
            date: DateUtils.asStorageDate(date),
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

    // Use the centralized conflict detection service
    const { conflictDetectionService } = await import('../services/conflict');
    const conflicts = await conflictDetectionService.detectConflicts(start, end);

    res.json(conflicts);
  } catch (error) {
    console.error('Error checking schedule health:', error);
    res.status(500).json({ error: 'Failed to check schedule health' });
  }
});

// Auto-fix conflicts endpoint
router.post('/auto-fix-conflicts', async (req: Request, res: Response) => {
  try {
    const { startDate, endDate } = req.body;

    if (!startDate || !endDate) {
      return res.status(400).json({ error: 'startDate and endDate are required' });
    }

    // Generate all dates in range
    const allDates = new Set<string>();
    const currentDate = new Date(startDate);
    while (currentDate <= new Date(endDate)) {
      allDates.add(currentDate.toISOString().split('T')[0]);
      currentDate.setDate(currentDate.getDate() + 1);
    }

    // Get existing schedules for the date range
    const schedules = await prisma.schedule.findMany({
      where: {
        date: {
          gte: new Date(startDate),
          lte: new Date(endDate),
        },
      },
    });

    // Group by date to identify missing shifts
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

    // Identify conflicts (only for dates where schedules exist)
    const conflictList: Array<{ date: string; missingShifts: string[]; severity: string }> = [];
    const scheduledDateStrings = Array.from(scheduledDates.keys());

    scheduledDateStrings.forEach(dateStr => {
      const shifts = scheduledDates.get(dateStr);
      let missingShifts: string[] = [];
      if (!shifts || !shifts.morning) {
        missingShifts.push('Morning');
      }
      if (!shifts || !shifts.evening) {
        missingShifts.push('Evening');
      }

      if (missingShifts.length > 0) {
        conflictList.push({
          date: dateStr,
          missingShifts,
          severity: 'critical'
        });
      }
    });

    // Use IntelligentScheduler to resolve conflicts
    console.log(`🔍 Auto-fix: Found ${conflictList.length} conflicts to resolve`);
    console.log('📋 Conflicts:', conflictList);

    const scheduler = new IntelligentScheduler(prisma);
    const resolution = await scheduler.resolveConflicts(conflictList, startDate, endDate);

    console.log(`✅ Auto-fix: Generated ${resolution.suggestedAssignments?.length || 0} proposals`);
    console.log('📊 Resolution summary:', resolution.summary);

    res.json(resolution);
  } catch (error) {
    console.error('Error auto-fixing conflicts:', error);
    res.status(500).json({ error: 'Failed to auto-fix conflicts' });
  }
});

// Apply auto-fix assignments endpoint
router.post('/apply-auto-fix', async (req: Request, res: Response) => {
  try {
    const { assignments } = req.body;

    if (!Array.isArray(assignments)) {
      return res.status(400).json({ error: 'assignments array is required' });
    }

    const createdSchedules = [];
    const errors = [];

    for (const assignment of assignments) {
      try {
        const { date, shiftType, analystId, isScreener = false } = assignment;

        // Check if analyst already has a schedule for this date
        const existingSchedule = await prisma.schedule.findUnique({
          where: { analystId_date: { analystId, date: new Date(date) } }
        });

        if (existingSchedule) {
          errors.push({ assignment, error: 'Analyst already has a schedule for this date' });
          continue;
        }

        // If this is a screener assignment, check for conflicts
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
              assignment,
              error: `There is already a screener assigned for ${shiftType} shift on ${new Date(date).toDateString()}`
            });
            continue;
          }
        }

        const schedule = await prisma.schedule.create({
          data: {
            analystId,
            date: DateUtils.asStorageDate(date),
            shiftType,
            isScreener
          },
          include: { analyst: true }
        });

        createdSchedules.push(schedule);
      } catch (error: any) {
        errors.push({ assignment, error: error.message });
      }
    }

    res.json({
      message: `Applied ${createdSchedules.length} assignments${errors.length > 0 ? `, ${errors.length} failed` : ''}`,
      createdSchedules,
      errors: errors.length > 0 ? errors : undefined
    });
  } catch (error) {
    console.error('Error applying auto-fix assignments:', error);
    res.status(500).json({ error: 'Failed to apply auto-fix assignments' });
  }
});

// Unified schedule generation endpoint
router.post('/generate-unified', async (req: Request, res: Response) => {
  try {
    const { startDate, endDate, algorithm = 'INTELLIGENT' } = req.body;

    if (!startDate || !endDate) {
      return res.status(400).json({ error: 'startDate and endDate are required' });
    }

    const start = new Date(startDate);
    const end = new Date(endDate);

    if (start >= end) {
      return res.status(400).json({ error: 'startDate must be before endDate' });
    }

    // 1. Fetch Context Data
    const analysts = await prisma.analyst.findMany({ where: { isActive: true } });
    const existingSchedules = await prisma.schedule.findMany({
      where: {
        date: {
          gte: start,
          lte: end
        }
      },
      include: { analyst: true }
    });
    const constraints = await prisma.schedulingConstraint.findMany({ where: { isActive: true } });

    // 2. Select Strategy
    let strategy;
    if (algorithm === 'WEEKEND_ROTATION') {
      const { WeekendRotationAlgorithm } = await import('../services/scheduling/algorithms/WeekendRotationAlgorithm');
      strategy = new WeekendRotationAlgorithm();
    } else {
      // Default to Intelligent Scheduler
      const { IntelligentScheduler } = await import('../services/IntelligentScheduler');
      strategy = new IntelligentScheduler(prisma);
    }

    // 3. Initialize Unified Engine
    const { UnifiedSchedulingEngine } = await import('../services/scheduling/UnifiedSchedulingEngine');
    const engine = new UnifiedSchedulingEngine(strategy);

    // 4. Generate Schedule
    const context = {
      startDate: start,
      endDate: end,
      analysts,
      existingSchedules,
      globalConstraints: constraints
    };

    const result = await engine.generateSchedule(context);

    res.json({
      message: `Schedule generated using ${engine.getStrategyName()}`,
      algorithm: engine.getStrategyName(),
      result
    });

  } catch (error) {
    console.error('Error generating unified schedule:', error);
    res.status(500).json({ error: 'Failed to generate unified schedule' });
  }
});
router.post('/generate', async (req: Request, res: Response) => {
  try {
    const { startDate, endDate, algorithm = 'INTELLIGENT' } = req.body;

    if (!startDate || !endDate) {
      return res.status(400).json({ error: 'startDate and endDate are required' });
    }

    const start = new Date(startDate);
    const end = new Date(endDate);

    if (start >= end) {
      return res.status(400).json({ error: 'startDate must be before endDate' });
    }

    // Get all active analysts
    const analysts = await prisma.analyst.findMany({
      where: { isActive: true },
      include: {
        schedules: {
          where: {
            date: {
              gte: start,
              lte: end
            }
          }
        }
      }
    });

    if (analysts.length === 0) {
      return res.status(400).json({ error: 'No active analysts found. Please add analysts first.' });
    }

    // Check if we have analysts for both shifts
    const morningAnalysts = analysts.filter(a => a.shiftType === 'MORNING');
    const eveningAnalysts = analysts.filter(a => a.shiftType === 'EVENING');

    if (morningAnalysts.length === 0) {
      return res.status(400).json({ error: 'No morning shift analysts found. Please add morning shift analysts first.' });
    }

    if (eveningAnalysts.length === 0) {
      return res.status(400).json({ error: 'No evening shift analysts found. Please add evening shift analysts first.' });
    }

    // Get existing schedules and global constraints
    const existingSchedules = await prisma.schedule.findMany({
      where: {
        date: {
          gte: start,
          lte: end
        }
      },
      include: { analyst: true }
    });

    const globalConstraints = await prisma.schedulingConstraint.findMany({
      where: {
        OR: [
          { constraintType: 'BLACKOUT_DATE' },
          { constraintType: 'HOLIDAY' }
        ]
      }
    });

    // Use new comprehensive IntelligentScheduler
    const scheduler = new IntelligentScheduler(prisma);

    const context = {
      startDate: start,
      endDate: end,
      analysts,
      existingSchedules,
      globalConstraints
    };

    console.log(`🚀 Generating schedule with IntelligentScheduler for ${start.toISOString().split('T')[0]} to ${end.toISOString().split('T')[0]}`);

    const result = await scheduler.generate(context);

    res.json({
      message: `Schedule generated successfully using Intelligent Scheduler`,
      algorithm: 'Intelligent Scheduler',
      result
    });
  } catch (error) {
    console.error('Error generating schedule:', error);
    res.status(500).json({ error: 'Failed to generate schedule', details: error instanceof Error ? error.message : 'Unknown error' });
  }
});

// Test endpoint for debugging IntelligentScheduler
router.get('/test-scheduler', async (req: Request, res: Response) => {
  try {
    const { date, shiftType } = req.query;

    if (!date || !shiftType) {
      return res.status(400).json({ error: 'date and shiftType are required' });
    }

    // Get all analysts
    const analysts = await prisma.analyst.findMany({
      where: { isActive: true },
      include: {
        schedules: {
          where: {
            date: new Date(date as string)
          }
        }
      }
    });

    // Test availability logic
    const availableAnalysts = analysts.filter((analyst: any) => {
      // Check if analyst is assigned to this shift type
      if (analyst.shiftType !== shiftType) {
        return false;
      }

      // Check if analyst is already scheduled for this date
      const hasSchedule = analyst.schedules.some((schedule: any) =>
        schedule.date.toISOString().split('T')[0] === date
      );

      return !hasSchedule;
    });

    res.json({
      date,
      shiftType,
      totalAnalysts: analysts.length,
      availableAnalysts: availableAnalysts.length,
      availableAnalystNames: availableAnalysts.map((a: any) => a.name),
      analystDetails: analysts.map((a: any) => ({
        name: a.name,
        shiftType: a.shiftType,
        schedules: a.schedules.length,
        scheduleDates: a.schedules.map((s: any) => s.date.toISOString().split('T')[0])
      }))
    });
  } catch (error) {
    console.error('Error in test endpoint:', error);
    res.status(500).json({ error: 'Failed to test scheduler' });
  }
});

// Validate a schedule change
router.post('/validate', async (req: Request, res: Response) => {
  try {
    const { analystId, date, shiftType, isScreener, scheduleId } = req.body;

    if (!analystId || !date || !shiftType) {
      return res.status(400).json({ error: 'analystId, date, and shiftType are required' });
    }

    // 1. Fetch active constraints
    const constraints = await prisma.schedulingConstraint.findMany({
      where: { isActive: true }
    });

    // 2. Fetch all schedules for the relevant period (e.g., +/- 30 days to cover most constraints)
    // We need context to validate things like "max screener days per month"
    const checkDate = new Date(date);
    const startDate = new Date(checkDate);
    startDate.setDate(startDate.getDate() - 30);
    const endDate = new Date(checkDate);
    endDate.setDate(endDate.getDate() + 30);

    const existingSchedules = await prisma.schedule.findMany({
      where: {
        date: {
          gte: startDate,
          lte: endDate
        }
      },
      include: { analyst: true }
    });

    // 3. Prepare the proposed schedule
    // We need to fetch the analyst name for the proposed schedule
    const analyst = await prisma.analyst.findUnique({
      where: { id: analystId }
    });

    if (!analyst) {
      return res.status(404).json({ error: 'Analyst not found' });
    }

    const proposedSchedule = {
      id: scheduleId || 'proposed',
      analystId,
      analystName: analyst.name,
      date: new Date(date).toISOString(),
      shiftType: shiftType as 'MORNING' | 'EVENING' | 'WEEKEND',
      analystShiftType: analyst.shiftType as 'MORNING' | 'EVENING' | 'WEEKEND',
      isScreener: isScreener || false,
      type: 'NEW_SCHEDULE' as const
    };

    // 4. Filter out the schedule being edited (if applicable) from existing schedules
    // and add the proposed schedule to the list for context-aware validation
    const contextSchedules = existingSchedules
      .filter(s => s.id !== scheduleId)
      .map(s => ({
        id: s.id,
        analystId: s.analystId,
        analystName: s.analyst.name,
        date: s.date.toISOString(),
        shiftType: s.shiftType as 'MORNING' | 'EVENING' | 'WEEKEND',
        analystShiftType: s.analyst.shiftType as 'MORNING' | 'EVENING' | 'WEEKEND',
        isScreener: s.isScreener,
        type: 'NEW_SCHEDULE' as const
      }));

    // Add proposed schedule to context for aggregate checks
    contextSchedules.push(proposedSchedule);

    // 5. Run validation
    // We import constraintEngine dynamically to avoid circular dependencies if any
    const { constraintEngine } = await import('../services/scheduling/algorithms/ConstraintEngine');

    // Check specifically for this schedule
    const violations = constraintEngine.checkScheduleConstraints(
      proposedSchedule,
      contextSchedules,
      constraints
    );

    // Also run full validation to catch aggregate issues (like max screener days)
    // We filter violations to only return those relevant to the proposed schedule
    const fullValidation = constraintEngine.validateConstraints(contextSchedules, constraints);

    // Merge violations, avoiding duplicates
    const allViolations = [...violations];

    for (const v of fullValidation.violations) {
      // Check if this violation is already in the list
      const isDuplicate = allViolations.some(existing =>
        existing.description === v.description && existing.type === v.type
      );

      // Only include if it affects the proposed schedule
      const affectsProposed = v.affectedSchedules.some(s =>
        s.includes(analyst.name) && s.includes(new Date(date).toDateString())
      );

      if (!isDuplicate && affectsProposed) {
        allViolations.push(v);
      }
    }

    res.json({
      isValid: allViolations.filter(v => v.type === 'HARD').length === 0,
      violations: allViolations
    });

  } catch (error) {
    console.error('Error validating schedule:', error);
    res.status(500).json({ error: 'Failed to validate schedule' });
  }
});

export default router; 