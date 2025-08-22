import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';

const router = Router();

// Get all constraints
router.get('/', async (req: Request, res: Response) => {
    try {
        const { analystId } = req.query;
        const where: any = {};
        if (analystId) {
            where.analystId = analystId as string;
        }

        const constraints = await prisma.schedulingConstraint.findMany({
            where,
            orderBy: { startDate: 'asc' },
        });
        res.json(constraints);
    } catch (error) {
        console.error('Error fetching constraints:', error);
        res.status(500).json({ error: 'Failed to fetch constraints' });
    }
});

// Create new constraint
router.post('/', async (req: Request, res: Response) => {
    try {
        const { analystId, shiftType, startDate, endDate, constraintType, description, isActive } = req.body;

        if (!startDate || !endDate || !constraintType) {
            return res.status(400).json({ error: 'startDate, endDate, and constraintType are required' });
        }

        const constraint = await prisma.schedulingConstraint.create({
            data: {
                analystId,
                shiftType,
                startDate: new Date(startDate),
                endDate: new Date(endDate),
                constraintType,
                description,
                isActive,
            },
        });

        res.status(201).json(constraint);
    } catch (error) {
        console.error('Error creating constraint:', error);
        res.status(400).json({ error: 'Failed to create constraint' });
    }
});

// Update constraint
router.put('/:id', async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { analystId, shiftType, startDate, endDate, constraintType, description, isActive } = req.body;

        const constraint = await prisma.schedulingConstraint.update({
            where: { id },
            data: {
                analystId,
                shiftType,
                startDate: startDate ? new Date(startDate) : undefined,
                endDate: endDate ? new Date(endDate) : undefined,
                constraintType,
                description,
                isActive,
            },
        });

        res.json(constraint);
    } catch (error: any) {
        console.error('Error updating constraint:', error);
        if (error.code === 'P2025') {
            return res.status(404).json({ error: 'Constraint not found' });
        }
        res.status(400).json({ error: 'Failed to update constraint' });
    }
});

// Delete constraint
router.delete('/:id', async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        await prisma.schedulingConstraint.delete({ where: { id } });
        res.status(204).send();
    } catch (error: any) {
        console.error('Error deleting constraint:', error);
        if (error.code === 'P2025') {
            return res.status(404).json({ error: 'Constraint not found' });
        }
        res.status(400).json({ error: 'Failed to delete constraint' });
    }
});

export default router; 