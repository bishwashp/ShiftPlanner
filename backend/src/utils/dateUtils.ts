import moment from 'moment-timezone';

export class DateUtils {
  /**
   * Returns a Date object set to UTC Midnight (00:00:00Z) for the given date.
   * This represents the "Calendar Date" regardless of time.
   */
  static asCalendarDate(date: string | Date): Date {
    return moment.utc(date).startOf('day').toDate();
  }

  /**
   * Returns a Date object set to UTC Noon (12:00:00Z) for the given date.
   * Useful for storage to avoid timezone rollover issues.
   */
  static asStorageDate(date: string | Date): Date {
    return moment.utc(date).startOf('day').add(12, 'hours').toDate();
  }

  /**
   * Returns the start of the day in UTC (00:00:00.000Z).
   */
  static getStartOfDay(date: string | Date): Date {
    return moment.utc(date).startOf('day').toDate();
  }

  /**
   * Returns the end of the day in UTC (23:59:59.999Z).
   */
  static getEndOfDay(date: string | Date): Date {
    return moment.utc(date).endOf('day').toDate();
  }

  /**
   * Formats a date as YYYY-MM-DD.
   */
  static formatDate(date: string | Date): string {
    return moment.utc(date).format('YYYY-MM-DD');
  }

  /**
   * Calculates the number of days between two dates (inclusive).
   */
  static getDurationInDays(startDate: string | Date, endDate: string | Date): number {
    const start = moment.utc(startDate).startOf('day');
    const end = moment.utc(endDate).startOf('day');
    return end.diff(start, 'days') + 1;
  }
}

// Legacy functions for backward compatibility
export const createLocalDate = (dateStr: string): Date => {
  return moment.utc(dateStr).startOf('day').toDate();
};

export const isWeekend = (date: Date): boolean => {
  const day = moment.utc(date).day();
  return day === 0 || day === 6; // 0 is Sunday, 6 is Saturday
};

export const isValidDateString = (dateStr: string): boolean => {
  return moment(dateStr, 'YYYY-MM-DD', true).isValid();
};
