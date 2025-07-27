import { Router, Request, Response } from 'express';
import { prisma } from '../app';
import moment from 'moment';

const router = Router();

// Get monthly work day tally for all analysts
router.get('/tally', async (req: Request, res: Response) => {
    try {
        const { month, year } = req.query;

        if (!month || !year) {
            return res.status(400).json({ error: 'Month and year are required' });
        }

        const startDate = moment(`${year}-${month}-01`).startOf('month').toDate();
        const endDate = moment(startDate).endOf('month').toDate();

        const schedules = await prisma.schedule.groupBy({
            by: ['analystId'],
            where: {
                date: {
                    gte: startDate,
                    lte: endDate,
                },
            },
            _count: {
                _all: true,
            },
        });

        const analysts = await prisma.analyst.findMany({
            where: {
                id: {
                    in: schedules.map(s => s.analystId),
                },
            },
        });

        const tally = analysts.map(analyst => {
            const scheduleCount = schedules.find(s => s.analystId === analyst.id);
            return {
                analystId: analyst.id,
                analystName: analyst.name,
                workDays: scheduleCount ? scheduleCount._count._all : 0,
            };
        });

        res.json(tally);
    } catch (error) {
        console.error('Error fetching work day tally:', error);
        res.status(500).json({ error: 'Failed to fetch work day tally' });
    }
});

export default router; 