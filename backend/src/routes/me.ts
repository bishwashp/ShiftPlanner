import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { DateUtils } from '../utils/dateUtils';

const router = Router();

/**
 * Personal data endpoints for authenticated analysts.
 * These endpoints bypass region filtering and return data specific to the authenticated user.
 */

// GET /api/me/analyst - Get authenticated user's linked analyst profile
router.get('/analyst', async (req: Request, res: Response) => {
    try {
        const user = (req as any).user;

        if (!user?.analystId) {
            return res.status(404).json({ error: 'User is not linked to an analyst' });
        }

        const analyst = await prisma.analyst.findUnique({
            where: { id: user.analystId },
            include: {
                region: true,
                shiftDefinition: true
            }
        });

        if (!analyst) {
            return res.status(404).json({ error: 'Analyst not found' });
        }

        res.json({
            ...analyst,
            customAttributes: analyst.customAttributes ? JSON.parse(analyst.customAttributes) : null,
            skills: analyst.skills ? analyst.skills.split(',') : []
        });
    } catch (error) {
        console.error('Error fetching user analyst:', error);
        res.status(500).json({ error: 'Failed to fetch analyst' });
    }
});

// GET /api/me/schedules - Get authenticated analyst's schedules (ignores region context)
router.get('/schedules', async (req: Request, res: Response) => {
    try {
        const user = (req as any).user;
        const { startDate, endDate } = req.query;

        if (!user?.analystId) {
            return res.status(404).json({ error: 'User is not linked to an analyst' });
        }

        const where: any = { analystId: user.analystId };

        if (startDate && endDate) {
            where.date = {
                gte: DateUtils.getStartOfDay(startDate as string),
                lte: DateUtils.getEndOfDay(endDate as string)
            };
        }

        const schedules = await prisma.schedule.findMany({
            where,
            include: {
                analyst: {
                    include: { region: true }
                }
            },
            orderBy: { date: 'asc' }
        });

        res.json(schedules);
    } catch (error) {
        console.error('Error fetching user schedules:', error);
        res.status(500).json({ error: 'Failed to fetch schedules' });
    }
});

// GET /api/me/absences - Get authenticated analyst's absences (ignores region context)
router.get('/absences', async (req: Request, res: Response) => {
    try {
        const user = (req as any).user;

        if (!user?.analystId) {
            return res.status(404).json({ error: 'User is not linked to an analyst' });
        }

        const absences = await prisma.absence.findMany({
            where: { analystId: user.analystId },
            include: { analyst: true },
            orderBy: { startDate: 'desc' }
        });

        res.json(absences);
    } catch (error) {
        console.error('Error fetching user absences:', error);
        res.status(500).json({ error: 'Failed to fetch absences' });
    }
});

export default router;
