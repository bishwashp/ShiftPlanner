import { PrismaClient } from '@prisma/client';
import { Schedule, Analyst } from '../../generated/prisma';

export interface CalendarEvent {
  id: string;
  title: string;
  description: string;
  startDate: Date;
  endDate: Date;
  location?: string;
  attendees?: string[];
  organizer?: string;
  allDay: boolean;
  recurrence?: string;
  color?: string;
}

export interface ICalEvent {
  uid: string;
  summary: string;
  description: string;
  dtstart: Date;
  dtend: Date;
  location?: string;
  organizer?: string;
  status: 'CONFIRMED' | 'TENTATIVE' | 'CANCELLED';
  categories?: string[];
}

export interface CalendarExportOptions {
  format?: 'ICAL' | 'GOOGLE_CALENDAR' | 'OUTLOOK';
  dateRange?: {
    startDate: Date;
    endDate: Date;
  };
  analystIds?: string[];
  includeVacations?: boolean;
  includeConstraints?: boolean;
  timezone?: string;
}

export class CalendarExportService {
  private prisma: PrismaClient;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  /**
   * Generate iCal feed for an analyst
   */
  async generateICalFeed(analystId: string, options: CalendarExportOptions = {}): Promise<string> {
    const analyst = await this.prisma.analyst.findUnique({
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

    const events: ICalEvent[] = [];

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
  }

  /**
   * Generate Google Calendar events
   */
  async generateGoogleCalendarEvents(analystId: string, options: CalendarExportOptions = {}): Promise<CalendarEvent[]> {
    const analyst = await this.prisma.analyst.findUnique({
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

    const events: CalendarEvent[] = [];

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
  }

  /**
   * Generate Outlook calendar events
   */
  async generateOutlookEvents(analystId: string, options: CalendarExportOptions = {}): Promise<CalendarEvent[]> {
    // Outlook uses similar format to Google Calendar
    return this.generateGoogleCalendarEvents(analystId, options);
  }

  /**
   * Generate team calendar feed (all analysts)
   */
  async generateTeamCalendar(options: CalendarExportOptions = {}): Promise<string> {
    const analysts = await this.prisma.analyst.findMany({
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

    const events: ICalEvent[] = [];

    for (const analyst of analysts) {
      for (const schedule of analyst.schedules) {
        const event = this.createScheduleEvent(schedule, analyst);
        events.push(event);
      }
    }

    return this.generateICalContent(events, 'Team Schedule');
  }

  /**
   * Create iCal event from schedule
   */
  private createScheduleEvent(schedule: any, analyst: any): ICalEvent {
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
  private createVacationEvent(vacation: any, analyst: any): ICalEvent {
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
  private createGoogleCalendarEvent(schedule: any, analyst: any): CalendarEvent {
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
  private createGoogleVacationEvent(vacation: any, analyst: any): CalendarEvent {
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
  private generateICalContent(events: ICalEvent[], calendarName: string): string {
    let ical = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//ShiftPlanner//Calendar Export//EN',
      `X-WR-CALNAME:${calendarName}`,
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH'
    ];

    for (const event of events) {
      ical.push(
        'BEGIN:VEVENT',
        `UID:${event.uid}`,
        `SUMMARY:${event.summary}`,
        `DESCRIPTION:${event.description.replace(/\n/g, '\\n')}`,
        `DTSTART:${this.formatICalDate(event.dtstart)}`,
        `DTEND:${this.formatICalDate(event.dtend)}`,
        `STATUS:${event.status}`,
        event.location ? `LOCATION:${event.location}` : '',
        event.organizer ? `ORGANIZER;CN=${event.organizer}:mailto:${event.organizer}` : '',
        'END:VEVENT'
      );
    }

    ical.push('END:VCALENDAR');
    return ical.filter(line => line !== '').join('\r\n');
  }

  /**
   * Get shift start time
   */
  private getShiftStartTime(shiftType: string, date: Date): Date {
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
  private getShiftEndTime(shiftType: string, date: Date): Date {
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
  private getShiftColor(shiftType: string): string {
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
  private formatICalDate(date: Date): string {
    return date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
  }
} 