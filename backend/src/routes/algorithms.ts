import { Router, Request, Response } from 'express';
import { prisma } from '../app';

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
      data: { name, description, config }
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
      data: { name, description, config, isActive }
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
    
    // Deactivate all other algorithms
    await prisma.algorithmConfig.updateMany({
      where: { isActive: true },
      data: { isActive: false }
    });
    
    // Activate the selected algorithm
    const algorithm = await prisma.algorithmConfig.update({
      where: { id },
      data: { isActive: true }
    });
    
    res.json(algorithm);
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
    const { startDate, endDate, shiftType, algorithmType = 'round-robin' } = req.body;
    
    if (!startDate || !endDate) {
      return res.status(400).json({ error: 'Start date and end date are required' });
    }
    
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    // Get all active analysts for the specified shift type
    const analysts = await prisma.analyst.findMany({
      where: {
        shiftType: shiftType || undefined,
        isActive: true
      },
      include: {
        vacations: {
          where: {
            isApproved: true,
            OR: [
              { startDate: { lte: end }, endDate: { gte: start } }
            ]
          }
        },
        constraints: {
          where: {
            isActive: true,
            OR: [
              { startDate: { lte: end }, endDate: { gte: start } }
            ]
          }
        }
      },
      orderBy: { name: 'asc' }
    });
    
    if (analysts.length === 0) {
      return res.status(400).json({ error: 'No active analysts found for the specified shift type' });
    }
    
    // Get existing schedules in the date range
    const existingSchedules = await prisma.schedule.findMany({
      where: {
        date: { gte: start, lte: end },
        shiftType: shiftType || undefined
      },
      include: { analyst: true }
    });
    
    // Get global constraints
    const globalConstraints = await prisma.schedulingConstraint.findMany({
      where: {
        analystId: null,
        isActive: true,
        startDate: { lte: end },
        endDate: { gte: start }
      }
    });
    
    // Generate the preview schedule
    const preview = await generateSchedulePreview(
      start,
      end,
      analysts,
      existingSchedules,
      globalConstraints,
      algorithmType
    );
    
    res.json(preview);
  } catch (error) {
    console.error('Error generating schedule preview:', error);
    res.status(500).json({ error: 'Failed to generate schedule preview' });
  }
});

// Apply automated schedule
router.post('/apply-schedule', async (req: Request, res: Response) => {
  try {
    const { startDate, endDate, shiftType, algorithmType = 'round-robin', overwriteExisting = false } = req.body;
    
    if (!startDate || !endDate) {
      return res.status(400).json({ error: 'Start date and end date are required' });
    }
    
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    // Get all active analysts for the specified shift type
    const analysts = await prisma.analyst.findMany({
      where: {
        shiftType: shiftType || undefined,
        isActive: true
      },
      include: {
        vacations: {
          where: {
            isApproved: true,
            OR: [
              { startDate: { lte: end }, endDate: { gte: start } }
            ]
          }
        },
        constraints: {
          where: {
            isActive: true,
            OR: [
              { startDate: { lte: end }, endDate: { gte: start } }
            ]
          }
        }
      },
      orderBy: { name: 'asc' }
    });
    
    if (analysts.length === 0) {
      return res.status(400).json({ error: 'No active analysts found for the specified shift type' });
    }
    
    // Get existing schedules in the date range
    const existingSchedules = await prisma.schedule.findMany({
      where: {
        date: { gte: start, lte: end },
        shiftType: shiftType || undefined
      },
      include: { analyst: true }
    });
    
    // Get global constraints
    const globalConstraints = await prisma.schedulingConstraint.findMany({
      where: {
        analystId: null,
        isActive: true,
        startDate: { lte: end },
        endDate: { gte: start }
      }
    });
    
    // Generate and apply the schedule
    const result = await generateAndApplySchedule(
      start,
      end,
      analysts,
      existingSchedules,
      globalConstraints,
      algorithmType,
      overwriteExisting
    );
    
    res.json(result);
  } catch (error) {
    console.error('Error applying schedule:', error);
    res.status(500).json({ error: 'Failed to apply schedule' });
  }
});

// Helper function to generate schedule preview
async function generateSchedulePreview(
  startDate: Date,
  endDate: Date,
  analysts: any[],
  existingSchedules: any[],
  globalConstraints: any[],
  algorithmType: string
) {
  const preview = {
    startDate,
    endDate,
    algorithmType,
    proposedSchedules: [] as any[],
    conflicts: [] as any[],
    overwrites: [] as any[],
    summary: {
      totalDays: 0,
      totalSchedules: 0,
      newSchedules: 0,
      overwrittenSchedules: 0,
      conflicts: 0
    }
  };

  // Generate regular work schedules first
  const regularSchedules = await generateRegularWorkSchedules(
    startDate,
    endDate,
    analysts,
    existingSchedules,
    globalConstraints
  );

  // Add regular schedules to preview
  preview.proposedSchedules.push(...regularSchedules.proposedSchedules);
  preview.conflicts.push(...regularSchedules.conflicts);
  preview.overwrites.push(...regularSchedules.overwrites);

  // Generate screener assignments based on regular schedules
  const screenerSchedules = await generateScreenerSchedules(
    startDate,
    endDate,
    analysts,
    existingSchedules,
    globalConstraints,
    regularSchedules.proposedSchedules
  );

  // Add screener schedules to preview
  preview.proposedSchedules.push(...screenerSchedules.proposedSchedules);
  preview.conflicts.push(...screenerSchedules.conflicts);
  preview.overwrites.push(...screenerSchedules.overwrites);

  // Calculate summary
  preview.summary.totalDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
  preview.summary.totalSchedules = preview.proposedSchedules.length;
  preview.summary.newSchedules = preview.proposedSchedules.filter(s => s.type === 'NEW_SCHEDULE').length;
  preview.summary.overwrittenSchedules = preview.overwrites.length;
  preview.summary.conflicts = preview.conflicts.length;

  return preview;
}

// Generate regular work schedules with weekend rotation
async function generateRegularWorkSchedules(
  startDate: Date,
  endDate: Date,
  analysts: any[],
  existingSchedules: any[],
  globalConstraints: any[]
) {
  const result = {
    proposedSchedules: [] as any[],
    conflicts: [] as any[],
    overwrites: [] as any[]
  };

  // Define work patterns
  const workPatterns = [
    { name: 'SUN_THU', days: [0, 1, 2, 3, 4] }, // Sunday to Thursday
    { name: 'MON_FRI', days: [1, 2, 3, 4, 5] }, // Monday to Friday
    { name: 'TUE_SAT', days: [2, 3, 4, 5, 6] }  // Tuesday to Saturday
  ];

  // Group analysts by shift type
  const morningAnalysts = analysts.filter(a => a.shiftType === 'MORNING');
  const eveningAnalysts = analysts.filter(a => a.shiftType === 'EVENING');

  // Initialize pattern assignments for each shift
  const morningPatterns = assignAnalystsToPatterns(morningAnalysts, workPatterns);
  const eveningPatterns = assignAnalystsToPatterns(eveningAnalysts, workPatterns);

  // Generate schedules week by week
  const currentDate = new Date(startDate);
  let weekNumber = 0;

  while (currentDate <= endDate) {
    const weekStart = getWeekStart(currentDate);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);

    // Skip if week is outside our date range
    if (weekEnd < startDate || weekStart > endDate) {
      currentDate.setDate(currentDate.getDate() + 7);
      weekNumber++;
      continue;
    }

    // Generate schedules for this week
    const weekSchedules = generateWeekSchedules(
      weekStart,
      weekEnd,
      morningPatterns,
      eveningPatterns,
      weekNumber,
      existingSchedules,
      globalConstraints
    );

    result.proposedSchedules.push(...weekSchedules.proposedSchedules);
    result.conflicts.push(...weekSchedules.conflicts);
    result.overwrites.push(...weekSchedules.overwrites);

    // Rotate patterns for next week
    rotatePatterns(morningPatterns);
    rotatePatterns(eveningPatterns);

    currentDate.setDate(currentDate.getDate() + 7);
    weekNumber++;
  }

  return result;
}

// Assign analysts to work patterns
function assignAnalystsToPatterns(analysts: any[], patterns: any[]) {
  const assignments = patterns.map(pattern => ({
    pattern: pattern.name,
    analysts: [] as any[],
    currentIndex: 0
  }));

  // Distribute analysts evenly across patterns
  analysts.forEach((analyst, index) => {
    const patternIndex = index % patterns.length;
    assignments[patternIndex].analysts.push(analyst);
  });

  return assignments;
}

// Rotate patterns for next week
function rotatePatterns(patternAssignments: any[]) {
  // Rotate analysts within each pattern
  patternAssignments.forEach(assignment => {
    if (assignment.analysts.length > 1) {
      // Move first analyst to end
      const firstAnalyst = assignment.analysts.shift();
      assignment.analysts.push(firstAnalyst);
    }
  });
}

// Get the start of the week (Sunday)
function getWeekStart(date: Date): Date {
  const result = new Date(date);
  const day = result.getDay();
  result.setDate(result.getDate() - day);
  return result;
}

// Generate schedules for a specific week
function generateWeekSchedules(
  weekStart: Date,
  weekEnd: Date,
  morningPatterns: any[],
  eveningPatterns: any[],
  weekNumber: number,
  existingSchedules: any[],
  globalConstraints: any[]
) {
  const result = {
    proposedSchedules: [] as any[],
    conflicts: [] as any[],
    overwrites: [] as any[]
  };

  // Generate schedules for each day of the week
  for (let i = 0; i < 7; i++) {
    const currentDate = new Date(weekStart);
    currentDate.setDate(currentDate.getDate() + i);
    const dayOfWeek = currentDate.getDay();

    // Check for blackout dates
    const blackoutConstraint = globalConstraints.find(c => 
      c.constraintType === 'BLACKOUT_DATE' &&
      c.startDate <= currentDate && c.endDate >= currentDate
    );

    if (blackoutConstraint) {
      result.conflicts.push({
        date: currentDate.toISOString().split('T')[0],
        type: 'BLACKOUT_DATE',
        description: blackoutConstraint.description || 'No scheduling allowed on this date'
      });
      continue;
    }

    // Assign morning shift analysts
    const morningAnalysts = getAnalystsForDay(morningPatterns, dayOfWeek);
    morningAnalysts.forEach(analyst => {
      const schedule = createScheduleEntry(
        analyst,
        currentDate,
        'MORNING',
        false,
        existingSchedules
      );
      if (schedule) {
        result.proposedSchedules.push(schedule);
      }
    });

    // Assign evening shift analysts
    const eveningAnalysts = getAnalystsForDay(eveningPatterns, dayOfWeek);
    eveningAnalysts.forEach(analyst => {
      const schedule = createScheduleEntry(
        analyst,
        currentDate,
        'EVENING',
        false,
        existingSchedules
      );
      if (schedule) {
        result.proposedSchedules.push(schedule);
      }
    });
  }

  return result;
}

// Get analysts working on a specific day based on their pattern
function getAnalystsForDay(patternAssignments: any[], dayOfWeek: number) {
  const workingAnalysts: any[] = [];

  patternAssignments.forEach(assignment => {
    const pattern = getPatternByName(assignment.pattern);
    if (pattern.days.includes(dayOfWeek)) {
      workingAnalysts.push(...assignment.analysts);
    }
  });

  return workingAnalysts;
}

// Get pattern by name
function getPatternByName(patternName: string) {
  const patterns = [
    { name: 'SUN_THU', days: [0, 1, 2, 3, 4] },
    { name: 'MON_FRI', days: [1, 2, 3, 4, 5] },
    { name: 'TUE_SAT', days: [2, 3, 4, 5, 6] }
  ];
  return patterns.find(p => p.name === patternName)!;
}

// Create a schedule entry
function createScheduleEntry(
  analyst: any,
  date: Date,
  shiftType: string,
  isScreener: boolean,
  existingSchedules: any[]
) {
  const dateStr = date.toISOString().split('T')[0];
  
  // Check if analyst is on vacation
  const onVacation = analyst.vacations.some((v: any) => 
    v.startDate <= date && v.endDate >= date
  );

  if (onVacation) {
    return null;
  }

  // Check for existing schedule
  const existingSchedule = existingSchedules.find(s => 
    s.analystId === analyst.id && s.date.toISOString().split('T')[0] === dateStr
  );

  if (existingSchedule) {
    // Check if we need to overwrite
    if (existingSchedule.shiftType !== shiftType || existingSchedule.isScreener !== isScreener) {
      return {
        date: dateStr,
        analystId: analyst.id,
        analystName: analyst.name,
        shiftType,
        isScreener,
        type: 'OVERWRITE_SCHEDULE'
      };
    }
    return null; // Schedule already exists and matches
  }

  return {
    date: dateStr,
    analystId: analyst.id,
    analystName: analyst.name,
    shiftType,
    isScreener,
    type: 'NEW_SCHEDULE'
  };
}

// Generate screener schedules based on regular schedules
async function generateScreenerSchedules(
  startDate: Date,
  endDate: Date,
  analysts: any[],
  existingSchedules: any[],
  globalConstraints: any[],
  regularSchedules: any[]
) {
  const result = {
    proposedSchedules: [] as any[],
    conflicts: [] as any[],
    overwrites: [] as any[]
  };

  const currentDate = new Date(startDate);
  let screenerIndex = 0;

  while (currentDate <= endDate) {
    const dateStr = currentDate.toISOString().split('T')[0];
    const dayOfWeek = currentDate.getDay();

    // Skip weekends for screener assignments
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      currentDate.setDate(currentDate.getDate() + 1);
      continue;
    }

    // Check for blackout dates
    const blackoutConstraint = globalConstraints.find(c => 
      c.constraintType === 'BLACKOUT_DATE' &&
      c.startDate <= currentDate && c.endDate >= currentDate
    );

    if (blackoutConstraint) {
      result.conflicts.push({
        date: dateStr,
        type: 'BLACKOUT_DATE',
        description: blackoutConstraint.description || 'No scheduling allowed on this date'
      });
      currentDate.setDate(currentDate.getDate() + 1);
      continue;
    }

    // Get analysts working regular shifts on this day
    const workingAnalysts = regularSchedules
      .filter(s => s.date === dateStr && !s.isScreener)
      .map(s => analysts.find(a => a.id === s.analystId))
      .filter(Boolean);

    // Separate by shift type
    const morningAnalysts = workingAnalysts.filter((a: any) => a.shiftType === 'MORNING');
    const eveningAnalysts = workingAnalysts.filter((a: any) => a.shiftType === 'EVENING');

    // Assign morning screener
    if (morningAnalysts.length > 0) {
      const selectedScreener = morningAnalysts[screenerIndex % morningAnalysts.length];
      const screenerSchedule = createScreenerSchedule(
        selectedScreener,
        currentDate,
        'MORNING',
        existingSchedules
      );
      if (screenerSchedule) {
        result.proposedSchedules.push(screenerSchedule);
      }
    }

    // Assign evening screener
    if (eveningAnalysts.length > 0) {
      const selectedScreener = eveningAnalysts[screenerIndex % eveningAnalysts.length];
      const screenerSchedule = createScreenerSchedule(
        selectedScreener,
        currentDate,
        'EVENING',
        existingSchedules
      );
      if (screenerSchedule) {
        result.proposedSchedules.push(screenerSchedule);
      }
    }

    screenerIndex++;
    currentDate.setDate(currentDate.getDate() + 1);
  }

  return result;
}

// Create a screener schedule entry
function createScreenerSchedule(
  analyst: any,
  date: Date,
  shiftType: string,
  existingSchedules: any[]
) {
  const dateStr = date.toISOString().split('T')[0];

  // Check for existing schedule
  const existingSchedule = existingSchedules.find(s => 
    s.analystId === analyst.id && s.date.toISOString().split('T')[0] === dateStr
  );

  if (existingSchedule) {
    if (existingSchedule.isScreener) {
      return null; // Already a screener
    }
    // Update existing regular schedule to be screener
    return {
      date: dateStr,
      analystId: analyst.id,
      analystName: analyst.name,
      shiftType,
      isScreener: true,
      type: 'OVERWRITE_SCHEDULE'
    };
  }

  return {
    date: dateStr,
    analystId: analyst.id,
    analystName: analyst.name,
    shiftType,
    isScreener: true,
    type: 'NEW_SCHEDULE'
  };
}

// Helper function to generate and apply schedule
async function generateAndApplySchedule(
  startDate: Date,
  endDate: Date,
  analysts: any[],
  existingSchedules: any[],
  globalConstraints: any[],
  algorithmType: string,
  overwriteExisting: boolean
) {
  const result = {
    message: '',
    createdSchedules: [] as any[],
    updatedSchedules: [] as any[],
    deletedSchedules: [] as any[],
    conflicts: [] as any[]
  };

  // Generate regular work schedules first
  const regularSchedules = await generateRegularWorkSchedules(
    startDate,
    endDate,
    analysts,
    existingSchedules,
    globalConstraints
  );

  // Apply regular schedules
  for (const schedule of regularSchedules.proposedSchedules) {
    try {
      const existingSchedule = existingSchedules.find(s => 
        s.analystId === schedule.analystId && s.date.toISOString().split('T')[0] === schedule.date
      );

      if (existingSchedule) {
        if (overwriteExisting || existingSchedule.shiftType !== schedule.shiftType || existingSchedule.isScreener !== schedule.isScreener) {
          const updatedSchedule = await prisma.schedule.update({
            where: { id: existingSchedule.id },
            data: {
              analystId: schedule.analystId,
              date: new Date(schedule.date),
              shiftType: schedule.shiftType,
              isScreener: schedule.isScreener
            },
            include: { analyst: true }
          });
          result.updatedSchedules.push(updatedSchedule);
        }
      } else {
        const newSchedule = await prisma.schedule.create({
          data: {
            analystId: schedule.analystId,
            date: new Date(schedule.date),
            shiftType: schedule.shiftType,
            isScreener: schedule.isScreener
          },
          include: { analyst: true }
        });
        result.createdSchedules.push(newSchedule);
      }
    } catch (error: any) {
      result.conflicts.push({
        date: schedule.date,
        type: 'SCHEDULE_CREATION_ERROR',
        description: error.message
      });
    }
  }

  // Generate and apply screener schedules
  const screenerSchedules = await generateScreenerSchedules(
    startDate,
    endDate,
    analysts,
    existingSchedules,
    globalConstraints,
    regularSchedules.proposedSchedules
  );

  // Apply screener schedules
  for (const schedule of screenerSchedules.proposedSchedules) {
    try {
      const existingSchedule = existingSchedules.find(s => 
        s.analystId === schedule.analystId && s.date.toISOString().split('T')[0] === schedule.date
      );

      if (existingSchedule) {
        if (overwriteExisting || !existingSchedule.isScreener) {
          const updatedSchedule = await prisma.schedule.update({
            where: { id: existingSchedule.id },
            data: {
              isScreener: true
            },
            include: { analyst: true }
          });
          result.updatedSchedules.push(updatedSchedule);
        }
      } else {
        const newSchedule = await prisma.schedule.create({
          data: {
            analystId: schedule.analystId,
            date: new Date(schedule.date),
            shiftType: schedule.shiftType,
            isScreener: true
          },
          include: { analyst: true }
        });
        result.createdSchedules.push(newSchedule);
      }
    } catch (error: any) {
      result.conflicts.push({
        date: schedule.date,
        type: 'SCREENER_CREATION_ERROR',
        description: error.message
      });
    }
  }

  // Add conflicts from generation
  result.conflicts.push(...regularSchedules.conflicts);
  result.conflicts.push(...screenerSchedules.conflicts);

  result.message = `Successfully processed ${result.createdSchedules.length} new schedules and ${result.updatedSchedules.length} updated schedules`;

  return result;
}

export default router; 