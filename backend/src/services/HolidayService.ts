import { PrismaClient } from '@prisma/client';
import moment from 'moment-timezone';

export interface HolidayData {
  name: string;
  date: string; // ISO date string
  timezone: string;
  isRecurring?: boolean;
  year?: number;
  description?: string;
  isActive?: boolean;
}

export interface HolidayConflict {
  type: 'OVERLAPPING_SCHEDULE' | 'INSUFFICIENT_STAFF';
  date: string;
  description: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  affectedAnalysts?: string[];
  suggestedResolution?: string;
}

export class HolidayService {
  private prisma: PrismaClient;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  /**
   * Get holidays for a specific year and timezone
   */
  async getHolidaysForYear(year: number, timezone: string = 'America/New_York'): Promise<any[]> {
    const startOfYear = moment.tz(`${year}-01-01`, timezone).toDate();
    const endOfYear = moment.tz(`${year}-12-31`, timezone).endOf('day').toDate();

    const holidays = await this.prisma.holiday.findMany({
      where: {
        isActive: true,
        OR: [
          { year: year },
          {
            isRecurring: true,
            date: {
              gte: startOfYear,
              lte: endOfYear
            }
          }
        ]
      },
      orderBy: { date: 'asc' }
    });

    // Convert dates back to the requested timezone for response
    return holidays.map((holiday: any) => ({
      ...holiday,
      date: moment(holiday.date).tz(timezone).format('YYYY-MM-DD'),
      localDate: moment(holiday.date).tz(timezone).toDate()
    }));
  }

  /**
   * Check if a specific date is a holiday
   */
  async isHoliday(date: string, timezone: string = 'America/New_York'): Promise<boolean> {
    const momentDate = moment.tz(date, timezone);
    const year = momentDate.year();

    const holidays = await this.getHolidaysForYear(year, timezone);

    return holidays.some(holiday =>
      moment(holiday.date).isSame(momentDate, 'day')
    );
  }

  /**
   * Get holiday information for a specific date
   */
  async getHolidayForDate(date: string, timezone: string = 'America/New_York'): Promise<any | null> {
    const momentDate = moment.tz(date, timezone);
    const year = momentDate.year();

    const holidays = await this.getHolidaysForYear(year, timezone);

    return holidays.find(holiday =>
      moment(holiday.date).isSame(momentDate, 'day')
    ) || null;
  }

  /**
   * Create a new holiday
   */
  async createHoliday(holidayData: HolidayData): Promise<any> {
    const { name, date, timezone, isRecurring, year, description, isActive } = holidayData;

    // Convert date to UTC for storage
    const momentDate = moment.tz(date, timezone);

    if (!momentDate.isValid()) {
      throw new Error('Invalid date format');
    }

    const holiday = await this.prisma.holiday.create({
      data: {
        name,
        date: momentDate.utc().toDate(),
        timezone,
        isRecurring: isRecurring || false,
        year: year || null,
        description,
        isActive: isActive !== undefined ? isActive : true
      }
    });

    return holiday;
  }

  /**
   * Update an existing holiday
   */
  async updateHoliday(id: string, holidayData: Partial<HolidayData>): Promise<any> {
    const updateData: any = {};

    if (holidayData.name) updateData.name = holidayData.name;
    if (holidayData.date && holidayData.timezone) {
      const momentDate = moment.tz(holidayData.date, holidayData.timezone);

      if (!momentDate.isValid()) {
        throw new Error('Invalid date format');
      }

      updateData.date = momentDate.utc().toDate();
      updateData.timezone = holidayData.timezone;
    }
    if (holidayData.isRecurring !== undefined) updateData.isRecurring = holidayData.isRecurring;
    if (holidayData.year !== undefined) updateData.year = holidayData.year;
    if (holidayData.description !== undefined) updateData.description = holidayData.description;
    if (holidayData.isActive !== undefined) updateData.isActive = holidayData.isActive;

    const holiday = await this.prisma.holiday.update({
      where: { id },
      data: updateData
    });

    return holiday;
  }

  /**
   * Delete a holiday
   */
  async deleteHoliday(id: string): Promise<void> {
    await this.prisma.holiday.delete({
      where: { id }
    });
  }

  /**
   * Initialize default holidays for a year
   */
  async initializeDefaultHolidays(year: number, timezone: string = 'America/New_York'): Promise<any[]> {
    const defaultHolidays = [
      {
        name: "New Year's Day",
        date: `${year}-01-01`,
        isRecurring: true,
        description: "New Year's Day"
      },
      {
        name: "Martin Luther King Jr. Day",
        date: this.getMLKDay(year),
        isRecurring: true,
        description: "Martin Luther King Jr. Day"
      },
      {
        name: "Presidents' Day",
        date: this.getPresidentsDay(year),
        isRecurring: true,
        description: "Presidents' Day"
      },
      {
        name: "Memorial Day",
        date: this.getMemorialDay(year),
        isRecurring: true,
        description: "Memorial Day"
      },
      {
        name: "Independence Day",
        date: `${year}-07-04`,
        isRecurring: true,
        description: "Independence Day"
      },
      {
        name: "Labor Day",
        date: this.getLaborDay(year),
        isRecurring: true,
        description: "Labor Day"
      },
      {
        name: "Columbus Day",
        date: this.getColumbusDay(year),
        isRecurring: true,
        description: "Columbus Day"
      },
      {
        name: "Veterans Day",
        date: `${year}-11-11`,
        isRecurring: true,
        description: "Veterans Day"
      },
      {
        name: "Thanksgiving Day",
        date: this.getThanksgivingDay(year),
        isRecurring: true,
        description: "Thanksgiving Day"
      },
      {
        name: "Christmas Day",
        date: `${year}-12-25`,
        isRecurring: true,
        description: "Christmas Day"
      }
    ];

    const createdHolidays = [];

    for (const holidayData of defaultHolidays) {
      // Check if holiday already exists
      const existingHoliday = await this.prisma.holiday.findFirst({
        where: {
          name: holidayData.name,
          year: year
        }
      });

      if (!existingHoliday) {
        const holiday = await this.createHoliday({
          ...holidayData,
          timezone,
          year
        });
        createdHolidays.push(holiday);
      }
    }

    return createdHolidays;
  }

  /**
   * Check for scheduling conflicts when a holiday is added
   */
  async checkHolidayConflicts(date: string, timezone: string = 'America/New_York'): Promise<HolidayConflict[]> {
    const conflicts: HolidayConflict[] = [];
    const momentDate = moment.tz(date, timezone);

    // Check for existing schedules on this date
    const existingSchedules = await this.prisma.schedule.findMany({
      where: {
        date: {
          gte: momentDate.startOf('day').toDate(),
          lte: momentDate.endOf('day').toDate()
        }
      },
      include: {
        analyst: {
          select: {
            id: true,
            name: true
          }
        }
      }
    });

    if (existingSchedules.length > 0) {
      conflicts.push({
        type: 'OVERLAPPING_SCHEDULE',
        date: momentDate.format('YYYY-MM-DD'),
        description: `Holiday conflicts with ${existingSchedules.length} existing schedule(s)`,
        severity: 'HIGH',
        affectedAnalysts: existingSchedules.map((s: any) => s.analyst.name),
        suggestedResolution: 'Consider rescheduling affected analysts or marking holiday as inactive'
      });
    }

    // Check if there are enough analysts available for other shifts
    const totalAnalysts = await this.prisma.analyst.count({
      where: { isActive: true }
    });

    const unavailableAnalysts = await this.prisma.absence.count({
      where: {
        startDate: { lte: momentDate.endOf('day').toDate() },
        endDate: { gte: momentDate.startOf('day').toDate() },
        isApproved: true
      }
    });

    const availableAnalysts = totalAnalysts - unavailableAnalysts;

    if (availableAnalysts < 2) { // Minimum staff requirement
      conflicts.push({
        type: 'INSUFFICIENT_STAFF',
        date: momentDate.format('YYYY-MM-DD'),
        description: `Only ${availableAnalysts} analysts available on holiday`,
        severity: 'CRITICAL',
        suggestedResolution: 'Consider hiring temporary staff or adjusting holiday policy'
      });
    }

    return conflicts;
  }

  /**
   * Auto-refresh holidays for next year when current date changes
   */
  async autoRefreshHolidays(currentTimezone: string = 'America/New_York'): Promise<void> {
    const currentYear = moment.tz(currentTimezone).year();
    const nextYear = currentYear + 1;

    // Check if next year's holidays are already initialized
    const nextYearHolidays = await this.prisma.holiday.count({
      where: { year: nextYear }
    });

    if (nextYearHolidays === 0) {
      await this.initializeDefaultHolidays(nextYear, currentTimezone);
    }
  }

  // Helper methods for calculating floating holidays
  private getMLKDay(year: number): string {
    // Third Monday in January
    const firstMonday = moment(`${year}-01-01`).day(1);
    if (firstMonday.date() > 7) {
      firstMonday.add(1, 'week');
    }
    return firstMonday.add(2, 'weeks').format('YYYY-MM-DD');
  }

  private getPresidentsDay(year: number): string {
    // Third Monday in February
    const firstMonday = moment(`${year}-02-01`).day(1);
    if (firstMonday.date() > 7) {
      firstMonday.add(1, 'week');
    }
    return firstMonday.add(2, 'weeks').format('YYYY-MM-DD');
  }

  private getMemorialDay(year: number): string {
    // Last Monday in May
    const lastDayOfMay = moment(`${year}-05-31`);
    return lastDayOfMay.day(1).format('YYYY-MM-DD');
  }

  private getLaborDay(year: number): string {
    // First Monday in September
    const firstMonday = moment(`${year}-09-01`).day(1);
    if (firstMonday.date() > 7) {
      firstMonday.add(1, 'week');
    }
    return firstMonday.format('YYYY-MM-DD');
  }

  private getColumbusDay(year: number): string {
    // Second Monday in October
    const firstMonday = moment(`${year}-10-01`).day(1);
    if (firstMonday.date() > 7) {
      firstMonday.add(1, 'week');
    }
    return firstMonday.add(1, 'week').format('YYYY-MM-DD');
  }

  private getThanksgivingDay(year: number): string {
    // Fourth Thursday in November
    const firstThursday = moment(`${year}-11-01`).day(4);
    if (firstThursday.date() > 7) {
      firstThursday.add(1, 'week');
    }
    return firstThursday.add(3, 'weeks').format('YYYY-MM-DD');
  }
}

export default HolidayService;
