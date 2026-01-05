import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { securityService } from '../services/SecurityService';

const router = Router();

// Apply auth middleware to protect these admin routes
// Note: We might want to restrict this to SUPER_ADMIN role specifically later
// For now, we reuse the standard auth middleware which ensures the user is logged in
// Apply auth middleware only to mutation routes
const authMiddleware = securityService.createAuthMiddleware();

// Get all regions (Admin View - includes inactive?)
router.get('/', async (req: Request, res: Response) => {
    try {
        const regions = await prisma.region.findMany({
            orderBy: { name: 'asc' },
        });
        res.json(regions);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch regions' });
    }
});

// Create a new region
router.post('/', authMiddleware, async (req: Request, res: Response) => {
    try {
        const { name, timezone } = req.body;

        if (!name || !timezone) {
            return res.status(400).json({ error: 'Name and Timezone are required' });
        }

        const region = await prisma.region.create({
            data: {
                name,
                timezone,
                isActive: true
            },
        });

        res.json(region);
    } catch (error) {
        res.status(500).json({ error: 'Failed to create region' });
    }
});

// Update a region
router.put('/:id', authMiddleware, async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { name, timezone, isActive } = req.body;

        const region = await prisma.region.update({
            where: { id },
            data: {
                name,
                timezone,
                isActive
            },
        });

        res.json(region);
    } catch (error) {
        res.status(500).json({ error: 'Failed to update region' });
    }
});

// Delete (Soft Delete) a region
router.delete('/:id', authMiddleware, async (req: Request, res: Response) => {
    try {
        const { id } = req.params;

        // Check if region has active analysts or schedules?
        // For safety, let's just mark as inactive rather than deleting data
        const region = await prisma.region.update({
            where: { id },
            data: { isActive: false },
        });

        res.json({ message: 'Region deactivated successfully', region });
    } catch (error) {
        res.status(500).json({ error: 'Failed to deactivate region' });
    }
});

export default router;
