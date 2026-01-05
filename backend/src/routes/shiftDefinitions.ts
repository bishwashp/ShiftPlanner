import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { securityService } from '../services/SecurityService';

const router = Router();

// Auth middleware for protected routes
const authMiddleware = securityService.createAuthMiddleware();

/**
 * SHIFT DEFINITIONS
 * Scoped by x-region-id header usually, but for Admin UI we might pass regionId in body or query
 * For consistency with the Admin UI plan, let's allow fetching by Region ID explicitly
 */

// Get shift definitions - returns all if no region specified, or filtered by region
router.get('/', async (req: Request, res: Response) => {
    try {
        const regionId = req.headers['x-region-id'] as string || req.query.regionId as string;

        // If regionId provided, filter by it. Otherwise return ALL shifts.
        const whereClause = regionId ? { regionId } : {};

        const shifts = await prisma.shiftDefinition.findMany({
            where: whereClause,
            include: {
                region: true, // Include region for grouping in UI
                outgoingHandovers: { include: { targetShift: { include: { region: true } } } },
                incomingHandovers: { include: { sourceShift: { include: { region: true } } } }
            },
            orderBy: [{ region: { name: 'asc' } }, { name: 'asc' }]
        });

        res.json(shifts);
    } catch (error) {
        console.error('Error fetching shift definitions:', error);
        res.status(500).json({ error: 'Failed to fetch shift definitions' });
    }
});

// Create a shift definition
router.post('/', authMiddleware, async (req: Request, res: Response) => {
    try {
        const { regionId, name, startResult, endResult, isOvernight } = req.body;

        if (!regionId || !name || !startResult || !endResult) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        const shift = await prisma.shiftDefinition.create({
            data: {
                regionId,
                name,
                startResult, // "09:00"
                endResult,   // "17:00"
                isOvernight: isOvernight || false
            }
        });

        res.json(shift);
    } catch (error) {
        console.error('Error creating shift definition:', error);
        res.status(500).json({ error: 'Failed to create shift definition' });
    }
});

// Update a shift definition
router.put('/:id', authMiddleware, async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { name, startResult, endResult, isOvernight } = req.body;

        const shift = await prisma.shiftDefinition.update({
            where: { id },
            data: {
                name,
                startResult,
                endResult,
                isOvernight
            }
        });

        res.json(shift);
    } catch (error) {
        console.error('Error updating shift definition:', error);
        res.status(500).json({ error: 'Failed to update shift definition' });
    }
});

// Delete a shift definition
router.delete('/:id', authMiddleware, async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        await prisma.shiftDefinition.delete({ where: { id } });
        res.json({ message: 'Shift definition deleted' });
    } catch (error) {
        console.error('Error deleting shift definition:', error);
        res.status(500).json({ error: 'Failed to delete shift definition' });
    }
});

/**
 * HANDOVERS
 */

// Create a handover
router.post('/handovers', authMiddleware, async (req: Request, res: Response) => {
    try {
        const { sourceShiftId, targetShiftId, handoverTime, description } = req.body;

        if (!sourceShiftId || !targetShiftId || !handoverTime) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        const handover = await prisma.handoverDefinition.create({
            data: {
                sourceShiftId,
                targetShiftId,
                handoverTime,
                description
            },
            include: {
                sourceShift: true,
                targetShift: { include: { region: true } }
            }
        });

        res.json(handover);
    } catch (error) {
        console.error('Error creating handover:', error);
        res.status(500).json({ error: 'Failed to create handover' });
    }
});

// Update a handover
router.put('/handovers/:id', authMiddleware, async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { handoverTime, description } = req.body;

        const handover = await prisma.handoverDefinition.update({
            where: { id },
            data: {
                handoverTime,
                description
            },
            include: {
                sourceShift: true,
                targetShift: { include: { region: true } }
            }
        });

        res.json(handover);
    } catch (error) {
        console.error('Error updating handover:', error);
        res.status(500).json({ error: 'Failed to update handover' });
    }
});

// Delete a handover
router.delete('/handovers/:id', authMiddleware, async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        await prisma.handoverDefinition.delete({ where: { id } });
        res.json({ message: 'Handover deleted' });
    } catch (error) {
        console.error('Error deleting handover:', error);
        res.status(500).json({ error: 'Failed to delete handover' });
    }
});

export default router;
