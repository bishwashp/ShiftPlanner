import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { cacheService } from '../lib/cache';
import moment from 'moment-timezone';
import HolidayService from '../services/HolidayService';

const router = Router();
const holidayService = new HolidayService(prisma);

// Get all holidays with optional filters
router.get('/', async (req: Request, res: Response) => {
  try {
    const { year, timezone, isActive } = req.query;

    // Get regionId from header (set by frontend interceptor)
    const regionId = req.headers['x-region-id'] as string | undefined;

    // Create cache key based on filters including regionId
    const filters = `year:${year || 'all'}_active:${isActive || 'all'}_region:${regionId || 'all'}`;

    // Try to get from cache first
    const cachedHolidays = await cacheService.get(`holidays:${filters}`);
    if (cachedHolidays) {
      return res.json(cachedHolidays);
    }

    // Build query conditions
    const where: any = {};

    // Filter by regionId if provided
    if (regionId) {
      where.regionId = regionId;
    }

    if (year) {
      const yearNum = parseInt(year as string);
      const startOfYear = moment.tz(`${yearNum}-01-01`, timezone as string || 'America/New_York').toDate();
      const endOfYear = moment.tz(`${yearNum}-12-31`, timezone as string || 'America/New_York').endOf('day').toDate();

      where.OR = [
        { year: yearNum },
        {
          isRecurring: true,
          date: {
            gte: startOfYear,
            lte: endOfYear
          }
        }
      ];
    }

    if (isActive !== undefined) {
      where.isActive = isActive === 'true';
    }

    const holidays = await prisma.holiday.findMany({
      where,
      orderBy: { date: 'asc' }
    });

    // Cache the result
    await cacheService.set(`holidays:${filters}`, holidays, 300); // Cache for 5 minutes

    res.json(holidays);
  } catch (error) {
    console.error('Error fetching holidays:', error);
    res.status(500).json({ error: 'Failed to fetch holidays' });
  }
});

// Get holiday by ID
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // Try to get from cache first
    const cachedHoliday = await cacheService.get(`holiday:${id}`);
    if (cachedHoliday) {
      return res.json(cachedHoliday);
    }

    const holiday = await prisma.holiday.findUnique({
      where: { id }
    });

    if (!holiday) {
      return res.status(404).json({ error: 'Holiday not found' });
    }

    // Cache the result
    await cacheService.set(`holiday:${id}`, holiday, 300);

    res.json(holiday);
  } catch (error) {
    console.error('Error fetching holiday:', error);
    res.status(500).json({ error: 'Failed to fetch holiday' });
  }
});

// Create new holiday
router.post('/', async (req: Request, res: Response) => {
  try {
    const { name, date, timezone, isRecurring, year, description, isActive, regionId } = req.body;

    // Validate required fields
    if (!name || !date) {
      return res.status(400).json({ error: 'Name and date are required' });
    }

    // Determine regionId to use
    let targetRegionId = regionId;
    if (!targetRegionId) {
      const defaultRegion = await prisma.region.findUnique({ where: { name: 'AMR' } });
      if (defaultRegion) {
        targetRegionId = defaultRegion.id;
      } else {
        return res.status(400).json({ error: 'Region ID is required and default region not found' });
      }
    }

    const holidayData = {
      name,
      date,
      timezone: timezone || 'America/New_York',
      isRecurring: isRecurring || false,
      year: year ? parseInt(year) : undefined,
      description,
      isActive: isActive !== undefined ? isActive : true,
      regionId: targetRegionId
    };

    const holiday = await holidayService.createHoliday(holidayData);

    // Invalidate relevant caches
    await cacheService.invalidatePattern('holidays:*');
    await cacheService.invalidatePattern('holiday:*');

    res.status(201).json(holiday);
  } catch (error: any) {
    console.error('Error creating holiday:', error);
    res.status(500).json({ error: 'Failed to create holiday' });
  }
});

// Update holiday
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name, date, timezone, isRecurring, year, description, isActive } = req.body;

    const updateData: any = {};

    if (name) updateData.name = name;
    if (date) {
      const timezoneToUse = timezone || 'America/New_York';
      const momentDate = moment.tz(date, timezoneToUse);

      if (!momentDate.isValid()) {
        return res.status(400).json({ error: 'Invalid date format' });
      }

      updateData.date = momentDate.utc().toDate();
      updateData.timezone = timezoneToUse;
    }
    if (isRecurring !== undefined) updateData.isRecurring = isRecurring;
    if (year !== undefined) updateData.year = year ? parseInt(year) : null;
    if (description !== undefined) updateData.description = description;
    if (isActive !== undefined) updateData.isActive = isActive;

    const holiday = await prisma.holiday.update({
      where: { id },
      data: updateData
    });

    // Invalidate relevant caches
    await cacheService.invalidatePattern('holidays:*');
    await cacheService.invalidatePattern(`holiday:${id}`);

    res.json(holiday);
  } catch (error: any) {
    console.error('Error updating holiday:', error);
    if (error.code === 'P2025') {
      res.status(404).json({ error: 'Holiday not found' });
    } else {
      res.status(500).json({ error: 'Failed to update holiday' });
    }
  }
});

// Delete holiday
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    await prisma.holiday.delete({
      where: { id }
    });

    // Invalidate all holiday-related caches
    await cacheService.invalidatePattern('holidays:*');
    await cacheService.invalidatePattern(`holiday:${id}`);

    res.status(204).send();
  } catch (error: any) {
    console.error('Error deleting holiday:', error);
    if (error.code === 'P2025') {
      res.status(404).json({ error: 'Holiday not found' });
    } else {
      res.status(500).json({ error: 'Failed to delete holiday' });
    }
  }
});

// Get holidays for a specific year and timezone (for scheduling)
router.get('/year/:year', async (req: Request, res: Response) => {
  try {
    const { year } = req.params;
    const { timezone = 'America/New_York' } = req.query;

    // Get regionId from header (set by frontend interceptor)
    const regionId = req.headers['x-region-id'] as string | undefined;

    const yearNum = parseInt(year);
    if (isNaN(yearNum)) {
      return res.status(400).json({ error: 'Invalid year' });
    }

    // Create cache key including regionId
    const cacheKey = `holidays:year:${yearNum}:${timezone}:region:${regionId || 'all'}`;

    // Try to get from cache first
    const cachedHolidays = await cacheService.get(cacheKey);
    if (cachedHolidays) {
      return res.json(cachedHolidays);
    }

    const startOfYear = moment.tz(`${yearNum}-01-01`, timezone as string).toDate();
    const endOfYear = moment.tz(`${yearNum}-12-31`, timezone as string).endOf('day').toDate();

    // Build where clause
    const where: any = {
      isActive: true,
      OR: [
        { year: yearNum },
        {
          isRecurring: true,
          date: {
            gte: startOfYear,
            lte: endOfYear
          }
        }
      ]
    };

    // Filter by regionId if provided
    if (regionId) {
      where.regionId = regionId;
    }

    const holidays = await prisma.holiday.findMany({
      where,
      orderBy: { date: 'asc' }
    });

    // Convert dates back to the requested timezone for response
    const formattedHolidays = holidays.map(holiday => ({
      ...holiday,
      date: moment(holiday.date).tz(timezone as string).format('YYYY-MM-DD')
    }));

    // Cache the result
    await cacheService.set(cacheKey, formattedHolidays, 600); // Cache for 10 minutes

    res.json(formattedHolidays);
  } catch (error) {
    console.error('Error fetching holidays for year:', error);
    res.status(500).json({ error: 'Failed to fetch holidays for year' });
  }
});

// Initialize default holidays for a year
router.post('/initialize-defaults', async (req: Request, res: Response) => {
  try {
    const { year, timezone = 'America/New_York', regionId } = req.body;

    if (!year) {
      return res.status(400).json({ error: 'Year is required' });
    }

    const yearNum = parseInt(year);
    if (isNaN(yearNum)) {
      return res.status(400).json({ error: 'Invalid year format' });
    }

    // Resolve regionId to use
    let targetRegionId = regionId;
    if (!targetRegionId) {
      const defaultRegion = await prisma.region.findUnique({ where: { name: 'AMR' } });
      if (defaultRegion) {
        targetRegionId = defaultRegion.id;
      } else {
        return res.status(400).json({ error: 'Region ID is required and default region not found' });
      }
    }

    // Check if holidays already exist for this year AND this region
    const existingHolidays = await prisma.holiday.count({
      where: {
        regionId: targetRegionId,
        OR: [
          { year: yearNum },
          {
            isRecurring: true,
            date: {
              gte: moment.tz(`${yearNum}-01-01`, timezone).toDate(),
              lte: moment.tz(`${yearNum}-12-31`, timezone).endOf('day').toDate()
            }
          }
        ]
      }
    });

    if (existingHolidays > 0) {
      return res.status(400).json({
        error: `Holidays already exist for year ${yearNum} in this region`,
        existingCount: existingHolidays
      });
    }

    // Initialize default holidays
    const createdHolidays = await holidayService.initializeDefaultHolidays(yearNum, timezone, regionId);

    // Invalidate relevant caches
    await cacheService.invalidatePattern('holidays:*');

    res.status(201).json({
      message: `Successfully initialized ${createdHolidays.length} default holidays for ${yearNum}`,
      holidays: createdHolidays,
      count: createdHolidays.length
    });
  } catch (error) {
    console.error('Error initializing default holidays:', error);
    res.status(500).json({ error: 'Failed to initialize default holidays' });
  }
});

export default router;
