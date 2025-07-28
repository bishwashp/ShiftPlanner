import { Router, Request, Response } from 'express';
import { prisma } from '../app';
import moment from 'moment-timezone';

const router = Router();

// Get monthly work day tally for all analysts
router.get('/tally', async (req: Request, res: Response) => {
    try {
        const { month, year } = req.query;

        if (!month || !year) {
            return res.status(400).json({ error: 'Month and year are required' });
        }

        const tz = 'America/Chicago';
        const startDate = moment.tz(`${year}-${month}-01`, tz).startOf('month').utc().toDate();
        const endDate = moment.tz(`${year}-${month}-01`, tz).endOf('month').utc().toDate();

        const schedules = await prisma.schedule.findMany({
            where: {
                date: {
                    gte: startDate,
                    lte: endDate,
                },
            },
            include: {
                analyst: true,
            },
        });

        const tally: { [key: string]: { analystId: string; analystName: string; workDays: number } } = {};

        for (const schedule of schedules) {
            const workDay = moment(schedule.date).tz(tz).format('YYYY-MM-DD');
            if (!tally[schedule.analystId]) {
                tally[schedule.analystId] = {
                    analystId: schedule.analystId,
                    analystName: schedule.analyst.name,
                    workDays: 0,
                };
            }
            // This logic assumes one shift per day per analyst. If multiple are possible, this needs adjustment.
            // For now, we will just count unique days.
        }

        const dailyCounts: { [key: string]: Set<string> } = {};

        for (const schedule of schedules) {
            if (!dailyCounts[schedule.analystId]) {
                dailyCounts[schedule.analystId] = new Set();
            }
            const workDay = moment(schedule.date).tz(tz).format('YYYY-MM-DD');
            dailyCounts[schedule.analystId].add(workDay);
        }

        for (const analystId in dailyCounts) {
            tally[analystId].workDays = dailyCounts[analystId].size;
        }

        res.json(Object.values(tally));
    } catch (error) {
        console.error('Error fetching work day tally:', error);
        res.status(500).json({ error: 'Failed to fetch work day tally' });
    }
});

export default router; 