import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { CalendarExportService } from '../services/CalendarExportService';

const router = Router();
const calendarService = new CalendarExportService(prisma);

// Get iCal feed for an analyst
router.get('/analyst/:id/ical', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { 
      startDate, 
      endDate, 
      includeVacations = 'true',
      includeConstraints = 'false'
    } = req.query;

    const options = {
      format: 'ICAL' as const,
      dateRange: startDate && endDate ? {
        startDate: new Date(startDate as string),
        endDate: new Date(endDate as string)
      } : undefined,
      includeVacations: includeVacations === 'true',
      includeConstraints: includeConstraints === 'true'
    };

    const icalContent = await calendarService.generateICalFeed(id, options);
    
    res.setHeader('Content-Type', 'text/calendar');
    res.setHeader('Content-Disposition', `attachment; filename="schedule-${id}.ics"`);
    res.send(icalContent);
  } catch (error) {
    console.error('Error generating iCal feed:', error);
    res.status(500).json({ error: 'Failed to generate iCal feed' });
  }
});

// Get team iCal feed
router.get('/team/ical', async (req: Request, res: Response) => {
  try {
    const { 
      startDate, 
      endDate 
    } = req.query;

    const options = {
      format: 'ICAL' as const,
      dateRange: startDate && endDate ? {
        startDate: new Date(startDate as string),
        endDate: new Date(endDate as string)
      } : undefined
    };

    const icalContent = await calendarService.generateTeamCalendar(options);
    
    res.setHeader('Content-Type', 'text/calendar');
    res.setHeader('Content-Disposition', 'attachment; filename="team-schedule.ics"');
    res.send(icalContent);
  } catch (error) {
    console.error('Error generating team iCal feed:', error);
    res.status(500).json({ error: 'Failed to generate team iCal feed' });
  }
});

// Get Google Calendar events for an analyst
router.get('/analyst/:id/google', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { 
      startDate, 
      endDate, 
      includeVacations = 'true' 
    } = req.query;

    const options = {
      format: 'GOOGLE_CALENDAR' as const,
      dateRange: startDate && endDate ? {
        startDate: new Date(startDate as string),
        endDate: new Date(endDate as string)
      } : undefined,
      includeVacations: includeVacations === 'true'
    };

    const events = await calendarService.generateGoogleCalendarEvents(id, options);
    res.json(events);
  } catch (error) {
    console.error('Error generating Google Calendar events:', error);
    res.status(500).json({ error: 'Failed to generate Google Calendar events' });
  }
});

// Get Outlook calendar events for an analyst
router.get('/analyst/:id/outlook', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { 
      startDate, 
      endDate, 
      includeVacations = 'true' 
    } = req.query;

    const options = {
      format: 'OUTLOOK' as const,
      dateRange: startDate && endDate ? {
        startDate: new Date(startDate as string),
        endDate: new Date(endDate as string)
      } : undefined,
      includeVacations: includeVacations === 'true'
    };

    const events = await calendarService.generateOutlookEvents(id, options);
    res.json(events);
  } catch (error) {
    console.error('Error generating Outlook events:', error);
    res.status(500).json({ error: 'Failed to generate Outlook events' });
  }
});

// Get schedule data in JSON format for external applications
router.get('/analyst/:id/schedule', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { 
      startDate, 
      endDate,
      format = 'json'
    } = req.query;

    const analyst = await prisma.analyst.findUnique({
      where: { id },
      include: {
        schedules: {
          where: startDate && endDate ? {
            date: {
              gte: new Date(startDate as string),
              lte: new Date(endDate as string)
            }
          } : undefined,
          orderBy: { date: 'asc' }
        },
        vacations: {
          where: startDate && endDate ? {
            startDate: {
              gte: new Date(startDate as string),
              lte: new Date(endDate as string)
            }
          } : undefined,
          orderBy: { startDate: 'asc' }
        }
      }
    });

    if (!analyst) {
      return res.status(404).json({ error: 'Analyst not found' });
    }

    const scheduleData = {
      analyst: {
        id: analyst.id,
        name: analyst.name,
        email: analyst.email,
        shiftType: analyst.shiftType
      },
      schedules: analyst.schedules.map(schedule => ({
        id: schedule.id,
        date: schedule.date,
        shiftType: schedule.shiftType,
        isScreener: schedule.isScreener,
        startTime: getShiftStartTime(schedule.shiftType, schedule.date),
        endTime: getShiftEndTime(schedule.shiftType, schedule.date)
      })),
      vacations: analyst.vacations.map(vacation => ({
        id: vacation.id,
        startDate: vacation.startDate,
        endDate: vacation.endDate,
        reason: vacation.reason,
        isApproved: vacation.isApproved
      }))
    };

    res.json(scheduleData);
  } catch (error) {
    console.error('Error fetching schedule data:', error);
    res.status(500).json({ error: 'Failed to fetch schedule data' });
  }
});

// Get team schedule data
router.get('/team/schedule', async (req: Request, res: Response) => {
  try {
    const { 
      startDate, 
      endDate 
    } = req.query;

    const analysts = await prisma.analyst.findMany({
      where: { isActive: true },
      include: {
        schedules: {
          where: startDate && endDate ? {
            date: {
              gte: new Date(startDate as string),
              lte: new Date(endDate as string)
            }
          } : undefined,
          orderBy: { date: 'asc' }
        }
      }
    });

    const teamSchedule = analysts.map(analyst => ({
      analyst: {
        id: analyst.id,
        name: analyst.name,
        email: analyst.email,
        shiftType: analyst.shiftType
      },
      schedules: analyst.schedules.map(schedule => ({
        id: schedule.id,
        date: schedule.date,
        shiftType: schedule.shiftType,
        isScreener: schedule.isScreener,
        startTime: getShiftStartTime(schedule.shiftType, schedule.date),
        endTime: getShiftEndTime(schedule.shiftType, schedule.date)
      }))
    }));

    res.json(teamSchedule);
  } catch (error) {
    console.error('Error fetching team schedule:', error);
    res.status(500).json({ error: 'Failed to fetch team schedule' });
  }
});

// Helper functions
function getShiftStartTime(shiftType: string, date: Date): Date {
  const baseDate = new Date(date);
  switch (shiftType) {
    case 'MORNING':
      baseDate.setHours(6, 0, 0, 0);
      break;
    case 'EVENING':
      baseDate.setHours(14, 0, 0, 0);
      break;
    case 'WEEKEND':
      baseDate.setHours(8, 0, 0, 0);
      break;
    default:
      baseDate.setHours(9, 0, 0, 0);
  }
  return baseDate;
}

function getShiftEndTime(shiftType: string, date: Date): Date {
  const baseDate = new Date(date);
  switch (shiftType) {
    case 'MORNING':
      baseDate.setHours(14, 0, 0, 0);
      break;
    case 'EVENING':
      baseDate.setHours(22, 0, 0, 0);
      break;
    case 'WEEKEND':
      baseDate.setHours(16, 0, 0, 0);
      break;
    default:
      baseDate.setHours(17, 0, 0, 0);
  }
  return baseDate;
}

export default router; 