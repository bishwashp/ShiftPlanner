import { PrismaClient } from '../../generated/prisma';
import moment from 'moment-timezone';
import Holidays from 'date-holidays';

export interface HolidayData {
  name: string;
  date: string; // ISO date string
  timezone: string;
  isRecurring?: boolean;
  year?: number;
  description?: string;
  isActive?: boolean;
  regionId: string;
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
    const { name, date, timezone, isRecurring, year, description, isActive, regionId } = holidayData;

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
        isActive: isActive !== undefined ? isActive : true,
        region: {
          connect: { id: regionId }
        }
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

    // Note: updating region is generally not supported/needed for existing holidays but could be added

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
   * Initialize default holidays for a year for a specific region
   * @param year Year to initialize
   * @param timezone Timezone
   * @param regionId UUID of the Region
   */
  async initializeDefaultHolidays(year: number, timezone: string = 'America/New_York', regionId?: string): Promise<any[]> {
    // If no regionId provided, we try to find a default or active region. 
    // Ideally regionId is mandatory now. But for backward compatibility we handle it.

    let targetRegion: any = null;

    if (regionId) {
      targetRegion = await this.prisma.region.findUnique({ where: { id: regionId } });
    } else {
      // Fallback: try to find region by name "AMR" as default
      targetRegion = await this.prisma.region.findUnique({ where: { name: 'AMR' } });
    }

    if (!targetRegion) {
      throw new Error('Region not found or invalid regionId');
    }

    const regionName = targetRegion.name; // e.g., AMR, SGP, LDN

    // Map region to country code for date-holidays library
    let countryCode = 'US'; // Default to US

    // Map AMR/LDN/SGP to ISO 3166-1 alpha-2 codes
    const regionMap: Record<string, string> = {
      'AMR': 'US',
      'LDN': 'GB',
      'SGP': 'SG'
    };

    if (regionMap[regionName]) {
      countryCode = regionMap[regionName];
    } else {
      console.warn(`Unknown region name: ${regionName}, defaulting to US holidays.`);
    }

    // Initialize Holidays library
    // For SG (Singapore), region is 'SG'.
    // For LDN (UK), region is 'GB'.
    // For AMR (US), region is 'US'.
    const hd = new Holidays(countryCode);

    // Fetch holidays for the year
    const holidayList = hd.getHolidays(year);

    if (!holidayList) {
      console.log(`No holidays found for country ${countryCode} year ${year}`);
      return [];
    }

    // Filter for public/bank holidays
    // Also ensuring status is 'public' if possible, but bank holidays are also important in UK.
    const publicHolidays = holidayList.filter((h: any) =>
      h.type === 'public' || h.type === 'bank'
    );

    const createdHolidays = [];

    for (const h of publicHolidays) {
      const holidayData: HolidayData = {
        name: h.name,
        date: moment(h.date).format('YYYY-MM-DD'),
        isRecurring: false,
        description: h.name,
        year: year,
        timezone: timezone,
        regionId: targetRegion.id
      };

      // Check if this specific holiday instance already exists for this year within this region
      // We limit scope to regionId to avoid cross-region conflict if names are same
      const existingHoliday = await this.prisma.holiday.findFirst({
        where: {
          name: holidayData.name,
          year: year,
          regionId: targetRegion.id
        }
      });

      if (!existingHoliday) {
        const holiday = await this.createHoliday(holidayData);
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
    // Note: should scope by region ideally, but schedules also have regionId.
    // For now keeping it broad as per existing logic, or assumes context is managed upstream.
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
}

export default HolidayService;
