"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const prisma_1 = require("../lib/prisma");
const CalendarExportService_1 = require("../services/CalendarExportService");
const router = (0, express_1.Router)();
const calendarService = new CalendarExportService_1.CalendarExportService(prisma_1.prisma);
// Get iCal feed for an analyst
router.get('/analyst/:id/ical', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { id } = req.params;
        const { startDate, endDate, includeVacations = 'true', includeConstraints = 'false' } = req.query;
        const options = {
            format: 'ICAL',
            dateRange: startDate && endDate ? {
                startDate: new Date(startDate),
                endDate: new Date(endDate)
            } : undefined,
            includeVacations: includeVacations === 'true',
            includeConstraints: includeConstraints === 'true'
        };
        const icalContent = yield calendarService.generateICalFeed(id, options);
        res.setHeader('Content-Type', 'text/calendar');
        res.setHeader('Content-Disposition', `attachment; filename="schedule-${id}.ics"`);
        res.send(icalContent);
    }
    catch (error) {
        console.error('Error generating iCal feed:', error);
        res.status(500).json({ error: 'Failed to generate iCal feed' });
    }
}));
// Get team iCal feed
router.get('/team/ical', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { startDate, endDate } = req.query;
        const options = {
            format: 'ICAL',
            dateRange: startDate && endDate ? {
                startDate: new Date(startDate),
                endDate: new Date(endDate)
            } : undefined
        };
        const icalContent = yield calendarService.generateTeamCalendar(options);
        res.setHeader('Content-Type', 'text/calendar');
        res.setHeader('Content-Disposition', 'attachment; filename="team-schedule.ics"');
        res.send(icalContent);
    }
    catch (error) {
        console.error('Error generating team iCal feed:', error);
        res.status(500).json({ error: 'Failed to generate team iCal feed' });
    }
}));
// Get Google Calendar events for an analyst
router.get('/analyst/:id/google', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { id } = req.params;
        const { startDate, endDate, includeVacations = 'true' } = req.query;
        const options = {
            format: 'GOOGLE_CALENDAR',
            dateRange: startDate && endDate ? {
                startDate: new Date(startDate),
                endDate: new Date(endDate)
            } : undefined,
            includeVacations: includeVacations === 'true'
        };
        const events = yield calendarService.generateGoogleCalendarEvents(id, options);
        res.json(events);
    }
    catch (error) {
        console.error('Error generating Google Calendar events:', error);
        res.status(500).json({ error: 'Failed to generate Google Calendar events' });
    }
}));
// Get Outlook calendar events for an analyst
router.get('/analyst/:id/outlook', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { id } = req.params;
        const { startDate, endDate, includeVacations = 'true' } = req.query;
        const options = {
            format: 'OUTLOOK',
            dateRange: startDate && endDate ? {
                startDate: new Date(startDate),
                endDate: new Date(endDate)
            } : undefined,
            includeVacations: includeVacations === 'true'
        };
        const events = yield calendarService.generateOutlookEvents(id, options);
        res.json(events);
    }
    catch (error) {
        console.error('Error generating Outlook events:', error);
        res.status(500).json({ error: 'Failed to generate Outlook events' });
    }
}));
// Get schedule data in JSON format for external applications
router.get('/analyst/:id/schedule', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { id } = req.params;
        const { startDate, endDate, format = 'json' } = req.query;
        const analyst = yield prisma_1.prisma.analyst.findUnique({
            where: { id },
            include: {
                schedules: {
                    where: startDate && endDate ? {
                        date: {
                            gte: new Date(startDate),
                            lte: new Date(endDate)
                        }
                    } : undefined,
                    orderBy: { date: 'asc' }
                },
                vacations: {
                    where: startDate && endDate ? {
                        startDate: {
                            gte: new Date(startDate),
                            lte: new Date(endDate)
                        }
                    } : undefined,
                    orderBy: { startDate: 'asc' }
                }
            }
        });
        if (!analyst) {
            return res.status(404).json({ error: 'Analyst not found' });
        }
        const scheduleData = {
            analyst: {
                id: analyst.id,
                name: analyst.name,
                email: analyst.email,
                shiftType: analyst.shiftType
            },
            schedules: analyst.schedules.map(schedule => ({
                id: schedule.id,
                date: schedule.date,
                shiftType: schedule.shiftType,
                isScreener: schedule.isScreener,
                startTime: getShiftStartTime(schedule.shiftType, schedule.date),
                endTime: getShiftEndTime(schedule.shiftType, schedule.date)
            })),
            vacations: analyst.vacations.map(vacation => ({
                id: vacation.id,
                startDate: vacation.startDate,
                endDate: vacation.endDate,
                reason: vacation.reason,
                isApproved: vacation.isApproved
            }))
        };
        res.json(scheduleData);
    }
    catch (error) {
        console.error('Error fetching schedule data:', error);
        res.status(500).json({ error: 'Failed to fetch schedule data' });
    }
}));
// Get team schedule data
router.get('/team/schedule', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { startDate, endDate } = req.query;
        const analysts = yield prisma_1.prisma.analyst.findMany({
            where: { isActive: true },
            include: {
                schedules: {
                    where: startDate && endDate ? {
                        date: {
                            gte: new Date(startDate),
                            lte: new Date(endDate)
                        }
                    } : undefined,
                    orderBy: { date: 'asc' }
                }
            }
        });
        const teamSchedule = analysts.map(analyst => ({
            analyst: {
                id: analyst.id,
                name: analyst.name,
                email: analyst.email,
                shiftType: analyst.shiftType
            },
            schedules: analyst.schedules.map(schedule => ({
                id: schedule.id,
                date: schedule.date,
                shiftType: schedule.shiftType,
                isScreener: schedule.isScreener,
                startTime: getShiftStartTime(schedule.shiftType, schedule.date),
                endTime: getShiftEndTime(schedule.shiftType, schedule.date)
            }))
        }));
        res.json(teamSchedule);
    }
    catch (error) {
        console.error('Error fetching team schedule:', error);
        res.status(500).json({ error: 'Failed to fetch team schedule' });
    }
}));
// Helper functions
function getShiftStartTime(shiftType, date) {
    const baseDate = new Date(date);
    switch (shiftType) {
        case 'MORNING':
            baseDate.setHours(6, 0, 0, 0);
            break;
        case 'EVENING':
            baseDate.setHours(14, 0, 0, 0);
            break;
        case 'WEEKEND':
            baseDate.setHours(8, 0, 0, 0);
            break;
        default:
            baseDate.setHours(9, 0, 0, 0);
    }
    return baseDate;
}
function getShiftEndTime(shiftType, date) {
    const baseDate = new Date(date);
    switch (shiftType) {
        case 'MORNING':
            baseDate.setHours(14, 0, 0, 0);
            break;
        case 'EVENING':
            baseDate.setHours(22, 0, 0, 0);
            break;
        case 'WEEKEND':
            baseDate.setHours(16, 0, 0, 0);
            break;
        default:
            baseDate.setHours(17, 0, 0, 0);
    }
    return baseDate;
}
exports.default = router;
