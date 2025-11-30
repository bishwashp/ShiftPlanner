import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import moment from 'moment';
import { HolidayService } from '../services/HolidayService';

const router = Router();

// Get schedule snapshot data for dashboard
router.get('/', async (req: Request, res: Response) => {
  try {
    const today = moment().format('YYYY-MM-DD');
    const thirtyDaysFromNow = moment().add(30, 'days').format('YYYY-MM-DD');

    // 1. Get today's screeners
    const todaysSchedules = await prisma.schedule.findMany({
      where: {
        date: {
          gte: moment(today).startOf('day').toDate(),
          lte: moment(today).endOf('day').toDate()
        }
      },
      include: {
        analyst: {
          select: {
            name: true,
            shiftType: true
          }
        }
      },
      orderBy: { shiftType: 'asc' }
    });

    // Group screeners by shift
    const screenersByShift = {
      MORNING: todaysSchedules
        .filter(s => s.shiftType === 'MORNING' && s.isScreener)
        .map(s => s.analyst.name.split(' ')[0]), // First name only
      EVENING: todaysSchedules
        .filter(s => s.shiftType === 'EVENING' && s.isScreener)
        .map(s => s.analyst.name.split(' ')[0]),
      WEEKEND: todaysSchedules
        .filter(s => {
          const d = new Date(s.date);
          return (d.getDay() === 0 || d.getDay() === 6) && s.isScreener;
        })
        .map(s => s.analyst.name.split(' ')[0])
    };

    // 2. Get upcoming holiday (next 30 days)
    const holidayService = new HolidayService(prisma);
    const currentYear = moment().year();
    const holidays = await holidayService.getHolidaysForYear(currentYear);

    const upcomingHoliday = holidays.find(holiday => {
      const holidayDate = moment(holiday.date);
      return holidayDate.isAfter(moment(today)) && holidayDate.isSameOrBefore(moment(thirtyDaysFromNow));
    });

    // 3. Get today's analyst coverage (analysts scheduled today)
    const todaysAnalystCoverage = await prisma.schedule.groupBy({
      by: ['shiftType'],
      where: {
        date: {
          gte: moment(today).startOf('day').toDate(),
          lte: moment(today).endOf('day').toDate()
        }
      },
      _count: {
        analystId: true
      }
    });

    // Format coverage with color coding
    const coverageByShift = {
      MORNING: 0,
      EVENING: 0,
      WEEKEND: 0
    };

    todaysAnalystCoverage.forEach(coverage => {
      coverageByShift[coverage.shiftType as keyof typeof coverageByShift] = coverage._count.analystId;
    });

    // Get coverage status (color coding)
    const getCoverageStatus = (count: number) => {
      if (count <= 2) return 'LOW'; // Red
      if (count <= 3) return 'MEDIUM'; // Yellow
      return 'HIGH'; // Green
    };

    const coverageStatus = {
      MORNING: getCoverageStatus(coverageByShift.MORNING),
      EVENING: getCoverageStatus(coverageByShift.EVENING),
      WEEKEND: getCoverageStatus(coverageByShift.WEEKEND)
    };

    const snapshotData = {
      todaysScreeners: screenersByShift,
      upcomingHoliday: upcomingHoliday ? {
        name: upcomingHoliday.name,
        date: upcomingHoliday.date,
        daysUntil: moment(upcomingHoliday.date).diff(moment(today), 'days')
      } : null,
      todaysCoverage: {
        counts: coverageByShift,
        status: coverageStatus
      }
    };

    res.json(snapshotData);
  } catch (error) {
    console.error('Error fetching schedule snapshot:', error);
    res.status(500).json({ error: 'Failed to fetch schedule snapshot' });
  }
});

export default router;
