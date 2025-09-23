import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { cacheService } from '../lib/cache';

const router = Router();

// Get all analysts with caching
router.get('/', async (req: Request, res: Response) => {
  try {
    const { active, shiftType } = req.query;
    
    // Create cache key based on filters
    const filters = `active:${active || 'all'}_shift:${shiftType || 'all'}`;
    
    // Try to get from cache first
    const cachedAnalysts = await cacheService.getAnalysts(filters);
    if (cachedAnalysts) {
      return res.json(cachedAnalysts);
    }

    // Build query conditions
    const where: any = {};
    if (active !== undefined) {
      where.isActive = active === 'true';
    }
    if (shiftType) {
      where.shiftType = shiftType;
    }

    // Optimized query with selective includes
    const analysts = await prisma.analyst.findMany({
      where,
      include: {
        preferences: {
          select: {
            shiftType: true,
            dayOfWeek: true,
            preference: true
          }
        },
        schedules: {
          where: {
            date: {
              gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Last 30 days
              lte: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // Next 30 days
            }
          },
          orderBy: { date: 'desc' },
          take: 10,
          select: {
            id: true,
            date: true,
            shiftType: true,
            isScreener: true
          }
        }
      },
      orderBy: { name: 'asc' }
    });

    // Convert SQLite strings back to objects/arrays for JSON response
    const formattedAnalysts = analysts.map(analyst => ({
      ...analyst,
      customAttributes: analyst.customAttributes ? JSON.parse(analyst.customAttributes) : null,
      skills: analyst.skills ? analyst.skills.split(',') : []
    }));

    // Cache the result
    await cacheService.setAnalysts(filters, formattedAnalysts);
    
    res.json(formattedAnalysts);
  } catch (error) {
    console.error('Error fetching analysts:', error);
    res.status(500).json({ error: 'Failed to fetch analysts' });
  }
});

// Get analyst by ID with caching
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    // Try to get from cache first
    const cachedAnalyst = await cacheService.getAnalyst(id);
    if (cachedAnalyst) {
      return res.json(cachedAnalyst);
    }

    const analyst = await prisma.analyst.findUnique({
      where: { id },
      include: {
        preferences: {
          select: {
            id: true,
            shiftType: true,
            dayOfWeek: true,
            preference: true
          }
        },
        schedules: {
          where: {
            date: {
              gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Last 30 days
              lte: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // Next 30 days
            }
          },
          orderBy: { date: 'desc' },
          take: 50,
          select: {
            id: true,
            date: true,
            shiftType: true,
            isScreener: true
          }
        },
        vacations: {
          where: {
            endDate: {
              gte: new Date()
            }
          },
          orderBy: { startDate: 'asc' },
          select: {
            id: true,
            startDate: true,
            endDate: true,
            reason: true,
            isApproved: true
          }
        }
      }
    });
    
    if (!analyst) {
      return res.status(404).json({ error: 'Analyst not found' });
    }

    // Convert SQLite strings back to objects/arrays for JSON response
    const formattedAnalyst = {
      ...analyst,
      customAttributes: analyst.customAttributes ? JSON.parse(analyst.customAttributes) : null,
      skills: analyst.skills ? analyst.skills.split(',') : []
    };

    // Cache the result
    await cacheService.setAnalyst(id, formattedAnalyst);
    
    res.json(formattedAnalyst);
  } catch (error) {
    console.error('Error fetching analyst:', error);
    res.status(500).json({ error: 'Failed to fetch analyst' });
  }
});

// Create new analyst with cache invalidation
router.post('/', async (req: Request, res: Response) => {
  try {
    const { name, email, shiftType, employeeType, customAttributes, skills } = req.body;

    // Validate required fields
    if (!name || !email || !shiftType || !employeeType) {
      return res.status(400).json({ error: 'Name, email, shiftType, and employeeType are required' });
    }

    const analyst = await prisma.analyst.create({
      data: {
        name,
        email,
        shiftType,
        employeeType,
        customAttributes: customAttributes ? JSON.stringify(customAttributes) : null,
        skills: skills ? skills.join(',') : null
      },
      include: {
        preferences: true
      }
    });

    // Convert SQLite strings back to objects/arrays for JSON response
    const formattedAnalyst = {
      ...analyst,
      customAttributes: analyst.customAttributes ? JSON.parse(analyst.customAttributes) : null,
      skills: analyst.skills ? analyst.skills.split(',') : []
    };

    // Invalidate relevant caches
    await cacheService.invalidateAnalystCache();
    await cacheService.invalidatePattern('analysts:*');

    res.status(201).json(formattedAnalyst);
  } catch (error: any) {
    console.error('Error creating analyst:', error);
    if (error.code === 'P2002') {
      res.status(400).json({ error: 'Analyst with this email already exists' });
    } else {
      res.status(500).json({ error: 'Failed to create analyst' });
    }
  }
});

// Update analyst with cache invalidation
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name, email, shiftType, employeeType, isActive, customAttributes, skills } = req.body;

    const analyst = await prisma.analyst.update({
      where: { id },
      data: {
        ...(name && { name }),
        ...(email && { email }),
        ...(shiftType && { shiftType }),
        ...(employeeType && { employeeType }),
        ...(typeof isActive === 'boolean' && { isActive }),
        ...(customAttributes && { customAttributes: JSON.stringify(customAttributes) }),
        ...(skills && { skills: skills.join(',') })
      },
      include: {
        preferences: true
      }
    });

    // Convert SQLite strings back to objects/arrays for JSON response
    const formattedAnalyst = {
      ...analyst,
      customAttributes: analyst.customAttributes ? JSON.parse(analyst.customAttributes) : null,
      skills: analyst.skills ? analyst.skills.split(',') : []
    };

    // Invalidate specific analyst cache and general caches
    await cacheService.invalidateAnalystCache(id);
    await cacheService.invalidatePattern('analysts:*');

    res.json(formattedAnalyst);
  } catch (error: any) {
    console.error('Error updating analyst:', error);
    if (error.code === 'P2025') {
      res.status(404).json({ error: 'Analyst not found' });
    } else if (error.code === 'P2002') {
      res.status(400).json({ error: 'Analyst with this email already exists' });
    } else {
      res.status(500).json({ error: 'Failed to update analyst' });
    }
  }
});

// Delete analyst with cache invalidation
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    await prisma.analyst.delete({
      where: { id }
    });

    // Invalidate all analyst-related caches
    await cacheService.invalidateAnalystCache(id);
    await cacheService.invalidatePattern('analysts:*');
    await cacheService.invalidatePattern('schedules:*'); // Schedules will be affected

    res.status(204).send();
  } catch (error: any) {
    console.error('Error deleting analyst:', error);
    if (error.code === 'P2025') {
      res.status(404).json({ error: 'Analyst not found' });
    } else {
      res.status(500).json({ error: 'Failed to delete analyst' });
    }
  }
});

export default router; 