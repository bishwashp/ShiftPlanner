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
exports.CalendarExportService = void 0;
class CalendarExportService {
    constructor(prisma) {
        this.prisma = prisma;
    }
    /**
     * Generate iCal feed for an analyst
     */
    generateICalFeed(analystId_1) {
        return __awaiter(this, arguments, void 0, function* (analystId, options = {}) {
            const analyst = yield this.prisma.analyst.findUnique({
                where: { id: analystId },
                include: {
                    schedules: {
                        where: options.dateRange ? {
                            date: {
                                gte: options.dateRange.startDate,
                                lte: options.dateRange.endDate
                            }
                        } : undefined,
                        orderBy: { date: 'asc' }
                    },
                    vacations: options.includeVacations ? {
                        where: options.dateRange ? {
                            startDate: {
                                gte: options.dateRange.startDate,
                                lte: options.dateRange.endDate
                            }
                        } : undefined,
                        orderBy: { startDate: 'asc' }
                    } : undefined
                }
            });
            if (!analyst) {
                throw new Error('Analyst not found');
            }
            const events = [];
            // Add schedule events
            for (const schedule of analyst.schedules) {
                const event = this.createScheduleEvent(schedule, analyst);
                events.push(event);
            }
            // Add vacation events
            if (options.includeVacations && analyst.vacations) {
                for (const vacation of analyst.vacations) {
                    const event = this.createVacationEvent(vacation, analyst);
                    events.push(event);
                }
            }
            return this.generateICalContent(events, analyst.name);
        });
    }
    /**
     * Generate Google Calendar events
     */
    generateGoogleCalendarEvents(analystId_1) {
        return __awaiter(this, arguments, void 0, function* (analystId, options = {}) {
            const analyst = yield this.prisma.analyst.findUnique({
                where: { id: analystId },
                include: {
                    schedules: {
                        where: options.dateRange ? {
                            date: {
                                gte: options.dateRange.startDate,
                                lte: options.dateRange.endDate
                            }
                        } : undefined,
                        orderBy: { date: 'asc' }
                    },
                    vacations: options.includeVacations ? {
                        where: options.dateRange ? {
                            startDate: {
                                gte: options.dateRange.startDate,
                                lte: options.dateRange.endDate
                            }
                        } : undefined,
                        orderBy: { startDate: 'asc' }
                    } : undefined
                }
            });
            if (!analyst) {
                throw new Error('Analyst not found');
            }
            const events = [];
            // Add schedule events
            for (const schedule of analyst.schedules) {
                const event = this.createGoogleCalendarEvent(schedule, analyst);
                events.push(event);
            }
            // Add vacation events
            if (options.includeVacations && analyst.vacations) {
                for (const vacation of analyst.vacations) {
                    const event = this.createGoogleVacationEvent(vacation, analyst);
                    events.push(event);
                }
            }
            return events;
        });
    }
    /**
     * Generate Outlook calendar events
     */
    generateOutlookEvents(analystId_1) {
        return __awaiter(this, arguments, void 0, function* (analystId, options = {}) {
            // Outlook uses similar format to Google Calendar
            return this.generateGoogleCalendarEvents(analystId, options);
        });
    }
    /**
     * Generate team calendar feed (all analysts)
     */
    generateTeamCalendar() {
        return __awaiter(this, arguments, void 0, function* (options = {}) {
            const analysts = yield this.prisma.analyst.findMany({
                where: { isActive: true },
                include: {
                    schedules: {
                        where: options.dateRange ? {
                            date: {
                                gte: options.dateRange.startDate,
                                lte: options.dateRange.endDate
                            }
                        } : undefined,
                        orderBy: { date: 'asc' }
                    }
                }
            });
            const events = [];
            for (const analyst of analysts) {
                for (const schedule of analyst.schedules) {
                    const event = this.createScheduleEvent(schedule, analyst);
                    events.push(event);
                }
            }
            return this.generateICalContent(events, 'Team Schedule');
        });
    }
    /**
     * Create iCal event from schedule
     */
    createScheduleEvent(schedule, analyst) {
        const startTime = this.getShiftStartTime(schedule.shiftType, schedule.date);
        const endTime = this.getShiftEndTime(schedule.shiftType, schedule.date);
        return {
            uid: `schedule-${schedule.id}@shiftplanner.com`,
            summary: `${analyst.name} - ${schedule.shiftType}${schedule.isScreener ? ' (Screener)' : ''}`,
            description: `Shift: ${schedule.shiftType}\nAnalyst: ${analyst.name}${schedule.isScreener ? '\nScreener Duty' : ''}`,
            dtstart: startTime,
            dtend: endTime,
            location: 'Work Location',
            organizer: analyst.email,
            status: 'CONFIRMED',
            categories: ['work', 'shift', schedule.shiftType.toLowerCase()]
        };
    }
    /**
     * Create iCal event from vacation
     */
    createVacationEvent(vacation, analyst) {
        return {
            uid: `vacation-${vacation.id}@shiftplanner.com`,
            summary: `${analyst.name} - Vacation`,
            description: `Vacation: ${vacation.reason || 'Time off'}\nAnalyst: ${analyst.name}`,
            dtstart: vacation.startDate,
            dtend: vacation.endDate,
            organizer: analyst.email,
            status: 'CONFIRMED',
            categories: ['vacation', 'time-off']
        };
    }
    /**
     * Create Google Calendar event from schedule
     */
    createGoogleCalendarEvent(schedule, analyst) {
        const startTime = this.getShiftStartTime(schedule.shiftType, schedule.date);
        const endTime = this.getShiftEndTime(schedule.shiftType, schedule.date);
        return {
            id: schedule.id,
            title: `${analyst.name} - ${schedule.shiftType}${schedule.isScreener ? ' (Screener)' : ''}`,
            description: `Shift: ${schedule.shiftType}\nAnalyst: ${analyst.name}${schedule.isScreener ? '\nScreener Duty' : ''}`,
            startDate: startTime,
            endDate: endTime,
            location: 'Work Location',
            organizer: analyst.email,
            allDay: false,
            color: this.getShiftColor(schedule.shiftType)
        };
    }
    /**
     * Create Google Calendar event from vacation
     */
    createGoogleVacationEvent(vacation, analyst) {
        return {
            id: vacation.id,
            title: `${analyst.name} - Vacation`,
            description: `Vacation: ${vacation.reason || 'Time off'}\nAnalyst: ${analyst.name}`,
            startDate: vacation.startDate,
            endDate: vacation.endDate,
            organizer: analyst.email,
            allDay: true,
            color: '#FF6B6B'
        };
    }
    /**
     * Generate iCal content
     */
    generateICalContent(events, calendarName) {
        let ical = [
            'BEGIN:VCALENDAR',
            'VERSION:2.0',
            'PRODID:-//ShiftPlanner//Calendar Export//EN',
            `X-WR-CALNAME:${calendarName}`,
            'CALSCALE:GREGORIAN',
            'METHOD:PUBLISH'
        ];
        for (const event of events) {
            ical.push('BEGIN:VEVENT', `UID:${event.uid}`, `SUMMARY:${event.summary}`, `DESCRIPTION:${event.description.replace(/\n/g, '\\n')}`, `DTSTART:${this.formatICalDate(event.dtstart)}`, `DTEND:${this.formatICalDate(event.dtend)}`, `STATUS:${event.status}`, event.location ? `LOCATION:${event.location}` : '', event.organizer ? `ORGANIZER;CN=${event.organizer}:mailto:${event.organizer}` : '', 'END:VEVENT');
        }
        ical.push('END:VCALENDAR');
        return ical.filter(line => line !== '').join('\r\n');
    }
    /**
     * Get shift start time
     */
    getShiftStartTime(shiftType, date) {
        const baseDate = new Date(date);
        switch (shiftType) {
            case 'MORNING':
                baseDate.setHours(6, 0, 0, 0); // 6 AM
                break;
            case 'EVENING':
                baseDate.setHours(14, 0, 0, 0); // 2 PM
                break;
            case 'WEEKEND':
                baseDate.setHours(8, 0, 0, 0); // 8 AM
                break;
            default:
                baseDate.setHours(9, 0, 0, 0); // 9 AM default
        }
        return baseDate;
    }
    /**
     * Get shift end time
     */
    getShiftEndTime(shiftType, date) {
        const baseDate = new Date(date);
        switch (shiftType) {
            case 'MORNING':
                baseDate.setHours(14, 0, 0, 0); // 2 PM
                break;
            case 'EVENING':
                baseDate.setHours(22, 0, 0, 0); // 10 PM
                break;
            case 'WEEKEND':
                baseDate.setHours(16, 0, 0, 0); // 4 PM
                break;
            default:
                baseDate.setHours(17, 0, 0, 0); // 5 PM default
        }
        return baseDate;
    }
    /**
     * Get shift color for Google Calendar
     */
    getShiftColor(shiftType) {
        switch (shiftType) {
            case 'MORNING':
                return '#4285F4'; // Blue
            case 'EVENING':
                return '#EA4335'; // Red
            case 'WEEKEND':
                return '#34A853'; // Green
            default:
                return '#FBBC04'; // Yellow
        }
    }
    /**
     * Format date for iCal
     */
    formatICalDate(date) {
        return date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
    }
}
exports.CalendarExportService = CalendarExportService;
