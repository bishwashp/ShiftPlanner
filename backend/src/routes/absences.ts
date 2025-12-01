import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { cacheService } from '../lib/cache';
import AbsenceService from '../services/AbsenceService';
import { absenceImpactAnalyzer } from '../services/AbsenceImpactAnalyzer';

const router = Router();
const absenceService = new AbsenceService(prisma);

// Get all absences with optional filters
router.get('/', async (req: Request, res: Response) => {
  try {
    const { analystId, type, isApproved, isPlanned, startDate, endDate } = req.query;

    // Create cache key based on filters
    const filters = `analyst:${analystId || 'all'}_type:${type || 'all'}_approved:${isApproved || 'all'}_planned:${isPlanned || 'all'}`;

    // Try to get from cache first
    const cachedAbsences = await cacheService.get(`absences:${filters}`);
    if (cachedAbsences) {
      return res.json(cachedAbsences);
    }

    // Build query conditions
    const where: any = {};

    if (analystId) {
      where.analystId = analystId as string;
    }

    if (type) {
      where.type = type as string;
    }

    if (isApproved !== undefined) {
      where.isApproved = isApproved === 'true';
    }

    if (isPlanned !== undefined) {
      where.isPlanned = isPlanned === 'true';
    }

    if (startDate || endDate) {
      where.OR = [];

      if (startDate) {
        where.OR.push({
          endDate: {
            gte: new Date(startDate as string)
          }
        });
      }

      if (endDate) {
        where.OR.push({
          startDate: {
            lte: new Date(endDate as string)
          }
        });
      }
    }

    const absences = await prisma.absence.findMany({
      where,
      include: {
        analyst: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      },
      orderBy: { startDate: 'asc' }
    });

    // Cache the result
    await cacheService.set(`absences:${filters}`, absences, 300); // Cache for 5 minutes

    res.json(absences);
  } catch (error) {
    console.error('Error fetching absences:', error);
    res.status(500).json({
      error: 'Failed to fetch absences',
      details: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    });
  }
});

// Get absence by ID
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // Try to get from cache first
    const cachedAbsence = await cacheService.get(`absence:${id}`);
    if (cachedAbsence) {
      return res.json(cachedAbsence);
    }

    const absence = await prisma.absence.findUnique({
      where: { id },
      include: {
        analyst: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      }
    });

    if (!absence) {
      return res.status(404).json({ error: 'Absence not found' });
    }

    // Cache the result
    await cacheService.set(`absence:${id}`, absence, 300);

    res.json(absence);
  } catch (error) {
    console.error('Error fetching absence:', error);
    res.status(500).json({ error: 'Failed to fetch absence' });
  }
});

// Create new absence
router.post('/', async (req: Request, res: Response) => {
  try {
    const { analystId, startDate, endDate, type, reason, isApproved, isPlanned } = req.body;

    // Validate required fields
    if (!analystId || !startDate || !endDate || !type) {
      return res.status(400).json({ error: 'analystId, startDate, endDate, and type are required' });
    }

    // Validate date range
    const start = new Date(startDate);
    const end = new Date(endDate);

    if (start > end) {
      return res.status(400).json({ error: 'End date must be on or after start date' });
    }

    // Verify analyst exists
    const analyst = await prisma.analyst.findUnique({
      where: { id: analystId }
    });

    if (!analyst) {
      return res.status(404).json({ error: 'Analyst not found' });
    }

    // Check for overlapping absences
    const overlappingAbsence = await prisma.absence.findFirst({
      where: {
        analystId,
        OR: [
          {
            startDate: { lte: end },
            endDate: { gte: start }
          }
        ]
      }
    });

    if (overlappingAbsence) {
      return res.status(400).json({
        error: 'Analyst already has an absence during this period',
        conflictingAbsence: {
          id: overlappingAbsence.id,
          startDate: overlappingAbsence.startDate,
          endDate: overlappingAbsence.endDate,
          type: overlappingAbsence.type
        }
      });
    }

    // Check for scheduling conflicts
    const conflicts = await absenceService.checkAbsenceConflicts({
      analystId,
      startDate,
      endDate,
      type,
      reason,
      isApproved: isApproved !== undefined ? isApproved : true,
      isPlanned: isPlanned !== undefined ? isPlanned : true
    });

    const absence = await prisma.absence.create({
      data: {
        analystId,
        startDate: start,
        endDate: end,
        type,
        reason,
        isApproved: isApproved !== undefined ? isApproved : true,
        isPlanned: isPlanned !== undefined ? isPlanned : true
      },
      include: {
        analyst: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      }
    });

    // Invalidate relevant caches
    await cacheService.invalidatePattern('absences:*');
    await cacheService.invalidatePattern(`analyst:${analystId}:absences:*`);

    // Return absence with conflicts if any
    res.status(201).json({
      absence,
      conflicts: conflicts.length > 0 ? conflicts : undefined
    });
  } catch (error: any) {
    console.error('Error creating absence:', error);
    res.status(500).json({ error: 'Failed to create absence' });
  }
});

// Update absence
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { startDate, endDate, type, reason, isApproved, isPlanned } = req.body;

    // Get current absence to check for conflicts
    const currentAbsence = await prisma.absence.findUnique({
      where: { id },
      select: { analystId: true }
    });

    if (!currentAbsence) {
      return res.status(404).json({ error: 'Absence not found' });
    }

    const updateData: any = {};

    if (startDate) updateData.startDate = new Date(startDate);
    if (endDate) updateData.endDate = new Date(endDate);
    if (type) updateData.type = type;
    if (reason !== undefined) updateData.reason = reason;
    if (isApproved !== undefined) updateData.isApproved = isApproved;
    if (isPlanned !== undefined) updateData.isPlanned = isPlanned;

    // Validate date range if both dates are provided
    if (startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);

      if (start > end) {
        return res.status(400).json({ error: 'End date must be on or after start date' });
      }
    }

    // Check for scheduling conflicts if dates or type are being updated
    let conflicts: any[] = [];
    if (startDate || endDate || type) {
      const conflictData = {
        analystId: currentAbsence.analystId,
        startDate: startDate || (await prisma.absence.findUnique({ where: { id }, select: { startDate: true } }))?.startDate.toISOString().split('T')[0] || '',
        endDate: endDate || (await prisma.absence.findUnique({ where: { id }, select: { endDate: true } }))?.endDate.toISOString().split('T')[0] || '',
        type: type || (await prisma.absence.findUnique({ where: { id }, select: { type: true } }))?.type || 'VACATION',
        reason: reason,
        isApproved: isApproved !== undefined ? isApproved : true,
        isPlanned: isPlanned !== undefined ? isPlanned : true
      };

      conflicts = await absenceService.checkAbsenceConflicts(conflictData, id);
    }

    const absence = await prisma.absence.update({
      where: { id },
      data: updateData,
      include: {
        analyst: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      }
    });

    // Invalidate relevant caches
    await cacheService.invalidatePattern('absences:*');
    await cacheService.invalidatePattern(`absence:${id}`);
    await cacheService.invalidatePattern(`analyst:${absence.analystId}:absences:*`);

    // Return absence with conflicts if any
    res.json({
      absence,
      conflicts: conflicts.length > 0 ? conflicts : undefined
    });
  } catch (error: any) {
    console.error('Error updating absence:', error);
    if (error.code === 'P2025') {
      res.status(404).json({ error: 'Absence not found' });
    } else {
      res.status(500).json({ error: 'Failed to update absence' });
    }
  }
});

// Delete absence
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // Get the absence first to get analystId for cache invalidation
    const absence = await prisma.absence.findUnique({
      where: { id },
      select: { analystId: true }
    });

    if (!absence) {
      return res.status(404).json({ error: 'Absence not found' });
    }

    await prisma.absence.delete({
      where: { id }
    });

    // Invalidate all absence-related caches
    await cacheService.invalidatePattern('absences:*');
    await cacheService.invalidatePattern(`absence:${id}`);
    await cacheService.invalidatePattern(`analyst:${absence.analystId}:absences:*`);

    res.status(204).send();
  } catch (error: any) {
    console.error('Error deleting absence:', error);
    if (error.code === 'P2025') {
      res.status(404).json({ error: 'Absence not found' });
    } else {
      res.status(500).json({ error: 'Failed to delete absence' });
    }
  }
});

// Get absences for a specific analyst
router.get('/analyst/:analystId', async (req: Request, res: Response) => {
  try {
    const { analystId } = req.params;
    const { startDate, endDate, isApproved } = req.query;

    // Create cache key
    const cacheKey = `analyst:${analystId}:absences:${startDate || 'all'}:${endDate || 'all'}:${isApproved || 'all'}`;

    // Try to get from cache first
    const cachedAbsences = await cacheService.get(cacheKey);
    if (cachedAbsences) {
      return res.json(cachedAbsences);
    }

    // Build query conditions
    const where: any = { analystId };

    if (startDate || endDate) {
      where.OR = [];

      if (startDate) {
        where.OR.push({
          endDate: {
            gte: new Date(startDate as string)
          }
        });
      }

      if (endDate) {
        where.OR.push({
          startDate: {
            lte: new Date(endDate as string)
          }
        });
      }
    }

    if (isApproved !== undefined) {
      where.isApproved = isApproved === 'true';
    }

    const absences = await prisma.absence.findMany({
      where,
      orderBy: { startDate: 'asc' }
    });

    // Cache the result
    await cacheService.set(cacheKey, absences, 300); // Cache for 5 minutes

    res.json(absences);
  } catch (error) {
    console.error('Error fetching analyst absences:', error);
    res.status(500).json({ error: 'Failed to fetch analyst absences' });
  }
});

// Approve/Reject absence
router.patch('/:id/approve', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { isApproved } = req.body;

    if (typeof isApproved !== 'boolean') {
      return res.status(400).json({ error: 'isApproved must be a boolean' });
    }

    // Use absenceService.approveAbsence to trigger replacement logic
    const absence = await absenceService.approveAbsence(id, isApproved);

    // Invalidate relevant caches
    await cacheService.invalidatePattern('absences:*');
    await cacheService.invalidatePattern(`absence:${id}`);
    await cacheService.invalidatePattern(`analyst:${absence.analystId}:absences:*`);

    res.json(absence);
  } catch (error: any) {
    console.error('Error updating absence approval:', error);
    if (error.code === 'P2025') {
      res.status(404).json({ error: 'Absence not found' });
    } else {
      res.status(500).json({ error: 'Failed to update absence approval' });
    }
  }
});

// Analyze absence impact
router.post('/impact', async (req: Request, res: Response) => {
  try {
    const { analystId, startDate, endDate, type } = req.body;

    if (!analystId || !startDate || !endDate || !type) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const report = await absenceImpactAnalyzer.analyzeAbsenceImpact({
      analystId,
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      type
    });

    res.json(report);
  } catch (error) {
    console.error('Error analyzing absence impact:', error);
    res.status(500).json({ error: 'Failed to analyze absence impact' });
  }
});

export default router;
