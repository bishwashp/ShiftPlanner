/**
 * iCal Subscription Routes
 * 
 * Provides ICS calendar feeds for schedule synchronization with external calendar apps.
 * 4 distinct calendars: Day Shift, Evening Shift, Day Screener, Evening Screener
 */

import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { DateUtils, isWeekend } from '../utils/dateUtils';
import moment from 'moment-timezone';

const router = Router();

// Timezone used for calendar display - matches X-WR-TIMEZONE
const CALENDAR_TIMEZONE = 'America/Chicago';

/**
 * Get today's calendar date start in UTC (00:00:00Z).
 * 
 * We use the local timezone (CST) to determine WHICH day is "today",
 * then return the start of that day in UTC midnight.
 * This handles dates stored at either midnight or noon UTC.
 */
function getTodayStartInUTC(): Date {
    // Get today's date string in local timezone (e.g., "2026-01-04")
    const todayDateStr = moment.tz(CALENDAR_TIMEZONE).format('YYYY-MM-DD');
    // Return UTC midnight for that date
    return moment.utc(todayDateStr).startOf('day').toDate();
}

/**
 * Parse a date string and return UTC midnight for that date.
 */
function getDateStartInUTC(dateStr: string): Date {
    return moment.utc(dateStr).startOf('day').toDate();
}

/**
 * Parse a date string and return UTC end of day (23:59:59.999Z) for that date.
 */
function getDateEndInUTC(dateStr: string): Date {
    return moment.utc(dateStr).endOf('day').toDate();
}

/**
 * Format date to iCal date format (YYYYMMDD) for all-day events.
 * IMPORTANT: Uses UTC to avoid timezone rollover issues.
 */
function formatICalDate(date: Date): string {
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    const day = String(date.getUTCDate()).padStart(2, '0');
    return `${year}${month}${day}`;
}

/**
 * Get next day for all-day event DTEND (in UTC)
 */
function getNextDay(date: Date): Date {
    const next = new Date(date.getTime());
    next.setUTCDate(next.getUTCDate() + 1);
    return next;
}

/**
 * Escape special characters in iCal text fields
 */
function escapeICalText(text: string): string {
    return text
        .replace(/\\/g, '\\\\')
        .replace(/;/g, '\\;')
        .replace(/,/g, '\\,')
        .replace(/\n/g, '\\n');
}

/**
 * Generate a stable UID for an event (with suffix for screener duplicates)
 */
function generateUID(scheduleId: string, suffix: string = '', domain: string = 'shiftplanner.local'): string {
    return `shift-${scheduleId}${suffix}@${domain}`;
}

/**
 * Generate iCal VEVENT - just the analyst name as summary
 */
function generateVEvent(
    scheduleId: string,
    date: Date,
    analystName: string,
    uidSuffix: string = ''
): string {
    const now = new Date();
    const dtstamp = `${formatICalDate(now)}T${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}${String(now.getSeconds()).padStart(2, '0')}`;

    const dtstart = formatICalDate(date);
    const dtend = formatICalDate(getNextDay(date));

    return `BEGIN:VEVENT
UID:${generateUID(scheduleId, uidSuffix)}
DTSTAMP:${dtstamp}
DTSTART;VALUE=DATE:${dtstart}
DTEND;VALUE=DATE:${dtend}
SUMMARY:${escapeICalText(analystName)}
STATUS:CONFIRMED
TRANSP:OPAQUE
END:VEVENT`;
}

/**
 * Generate complete iCal calendar
 */
function generateICalendar(
    calendarName: string,
    events: string[],
    refreshInterval: number = 60 // minutes
): string {
    const header = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//ShiftPlanner//Schedule Export//EN
CALSCALE:GREGORIAN
METHOD:PUBLISH
X-WR-CALNAME:${escapeICalText(calendarName)}
X-WR-TIMEZONE:America/Chicago
REFRESH-INTERVAL;VALUE=DURATION:PT${refreshInterval}M
X-PUBLISHED-TTL:PT${refreshInterval}M`;

    const footer = `END:VCALENDAR`;

    return [header, ...events, footer].join('\n');
}

// ============================================================================
// ROUTES - 4 Distinct Calendars
// ============================================================================

/**
 * GET /subscribe/day-shift.ics
 * 
 * All analysts working day shift (MORNING) - includes screeners
 */
router.get('/subscribe/day-shift.ics', async (req: Request, res: Response) => {
    try {
        const { from, to } = req.query;

        const startDate = from ? getDateStartInUTC(from as string) : getTodayStartInUTC();
        const endDate = to ? getDateEndInUTC(to as string) : new Date(Date.now() + 90 * 24 * 60 * 60 * 1000);

        const schedules = await prisma.schedule.findMany({
            where: {
                date: { gte: startDate, lte: endDate },
                shiftType: 'MORNING',
            },
            include: { analyst: true },
            orderBy: { date: 'asc' },
        });

        const events = schedules.map(s => generateVEvent(s.id, s.date, s.analyst.name));
        const calendar = generateICalendar('Day Shift', events);

        res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
        res.setHeader('Content-Disposition', 'inline; filename="day-shift.ics"');
        res.send(calendar);
    } catch (error) {
        console.error('Error generating Day Shift feed:', error);
        res.status(500).json({ error: 'Failed to generate calendar feed' });
    }
});

/**
 * GET /subscribe/evening-shift.ics
 * 
 * All analysts working evening shift (EVENING) - includes screeners
 */
router.get('/subscribe/evening-shift.ics', async (req: Request, res: Response) => {
    try {
        const { from, to } = req.query;

        const startDate = from ? getDateStartInUTC(from as string) : getTodayStartInUTC();
        const endDate = to ? getDateEndInUTC(to as string) : new Date(Date.now() + 90 * 24 * 60 * 60 * 1000);

        const schedules = await prisma.schedule.findMany({
            where: {
                date: { gte: startDate, lte: endDate },
                shiftType: 'EVENING',
            },
            include: { analyst: true },
            orderBy: { date: 'asc' },
        });

        const events = schedules.map(s => generateVEvent(s.id, s.date, s.analyst.name));
        const calendar = generateICalendar('Evening Shift', events);

        res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
        res.setHeader('Content-Disposition', 'inline; filename="evening-shift.ics"');
        res.send(calendar);
    } catch (error) {
        console.error('Error generating Evening Shift feed:', error);
        res.status(500).json({ error: 'Failed to generate calendar feed' });
    }
});

/**
 * GET /subscribe/day-screener.ics
 * 
 * Screeners for day shift only
 */
router.get('/subscribe/day-screener.ics', async (req: Request, res: Response) => {
    try {
        const { from, to } = req.query;

        const startDate = from ? getDateStartInUTC(from as string) : getTodayStartInUTC();
        const endDate = to ? getDateEndInUTC(to as string) : new Date(Date.now() + 90 * 24 * 60 * 60 * 1000);

        const schedules = await prisma.schedule.findMany({
            where: {
                date: { gte: startDate, lte: endDate },
                shiftType: 'MORNING',
                isScreener: true,
            },
            include: { analyst: true },
            orderBy: { date: 'asc' },
        });

        // Use '-screener' suffix for unique UID (same schedule appears in shift + screener calendars)
        // Filter out weekends - no screener schedules on weekends
        const weekdaySchedules = schedules.filter(s => !isWeekend(s.date));
        const events = weekdaySchedules.map(s => generateVEvent(s.id, s.date, s.analyst.name, '-screener'));
        const calendar = generateICalendar('Day Screener', events);

        res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
        res.setHeader('Content-Disposition', 'inline; filename="day-screener.ics"');
        res.send(calendar);
    } catch (error) {
        console.error('Error generating Day Screener feed:', error);
        res.status(500).json({ error: 'Failed to generate calendar feed' });
    }
});

/**
 * GET /subscribe/evening-screener.ics
 * 
 * Screeners for evening shift only
 */
router.get('/subscribe/evening-screener.ics', async (req: Request, res: Response) => {
    try {
        const { from, to } = req.query;

        const startDate = from ? getDateStartInUTC(from as string) : getTodayStartInUTC();
        const endDate = to ? getDateEndInUTC(to as string) : new Date(Date.now() + 90 * 24 * 60 * 60 * 1000);

        const schedules = await prisma.schedule.findMany({
            where: {
                date: { gte: startDate, lte: endDate },
                shiftType: 'EVENING',
                isScreener: true,
            },
            include: { analyst: true },
            orderBy: { date: 'asc' },
        });

        // Use '-screener' suffix for unique UID
        // Filter out weekends - no screener schedules on weekends
        const weekdaySchedules = schedules.filter(s => !isWeekend(s.date));
        const events = weekdaySchedules.map(s => generateVEvent(s.id, s.date, s.analyst.name, '-screener'));
        const calendar = generateICalendar('Evening Screener', events);

        res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
        res.setHeader('Content-Disposition', 'inline; filename="evening-screener.ics"');
        res.send(calendar);
    } catch (error) {
        console.error('Error generating Evening Screener feed:', error);
        res.status(500).json({ error: 'Failed to generate calendar feed' });
    }
});

/**
 * GET /info
 * 
 * Returns available subscription URLs
 */
router.get('/info', async (req: Request, res: Response) => {
    const baseUrl = `${req.protocol}://${req.get('host')}/api/ical`;

    res.json({
        info: 'iCal Calendar Subscriptions',
        description: 'Subscribe to these URLs in Apple Calendar (File > New Calendar Subscription)',
        subscriptionUrls: {
            dayShift: `${baseUrl}/subscribe/day-shift.ics`,
            eveningShift: `${baseUrl}/subscribe/evening-shift.ics`,
            dayScreener: `${baseUrl}/subscribe/day-screener.ics`,
            eveningScreener: `${baseUrl}/subscribe/evening-screener.ics`,
        },
        queryParameters: {
            from: 'Start date (ISO format, default: today)',
            to: 'End date (ISO format, default: 90 days from now)',
        },
    });
});

export default router;
