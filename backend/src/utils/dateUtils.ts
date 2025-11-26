/**
 * Date utility functions for proper timezone handling
 * 
 * The main issue: new Date('2025-11-01') creates a UTC date that gets converted to local time,
 * causing day shifts. For example, '2025-11-01' becomes Friday 7 PM CDT instead of Saturday midnight.
 * 
 * Solution: Always append 'T00:00:00' to ensure local timezone interpretation.
 */

/**
 * Creates a Date object from a date string in local timezone
 * @param dateString - Date string in format 'YYYY-MM-DD'
 * @returns Date object representing local midnight of that date
 */
export function createLocalDate(dateString: string): Date {
  if (!dateString || typeof dateString !== 'string') {
    throw new Error('Invalid date string provided');
  }
  
  // Ensure the date string is in the correct format
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
    throw new Error('Date string must be in format YYYY-MM-DD');
  }
  
  // Append 'T00:00:00' to ensure local timezone interpretation
  return new Date(dateString + 'T00:00:00');
}

/**
 * Creates a Date object from a date string in UTC timezone
 * @param dateString - Date string in format 'YYYY-MM-DD'
 * @returns Date object representing UTC midnight of that date
 */
export function createUTCDate(dateString: string): Date {
  if (!dateString || typeof dateString !== 'string') {
    throw new Error('Invalid date string provided');
  }
  
  // Ensure the date string is in the correct format
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
    throw new Error('Date string must be in format YYYY-MM-DD');
  }
  
  // Append 'T00:00:00.000Z' to ensure UTC interpretation
  return new Date(dateString + 'T00:00:00.000Z');
}

/**
 * Converts a Date object to a date string in format 'YYYY-MM-DD'
 * @param date - Date object
 * @returns Date string in format 'YYYY-MM-DD'
 */
export function toDateString(date: Date): string {
  return date.toISOString().split('T')[0];
}

/**
 * Checks if a date is a weekend (Saturday or Sunday)
 * @param date - Date object
 * @returns true if the date is a weekend, false otherwise
 */
export function isWeekend(date: Date): boolean {
  const dayOfWeek = date.getDay();
  return dayOfWeek === 0 || dayOfWeek === 6; // 0 = Sunday, 6 = Saturday
}

/**
 * Checks if a date is a weekday (Monday through Friday)
 * @param date - Date object
 * @returns true if the date is a weekday, false otherwise
 */
export function isWeekday(date: Date): boolean {
  return !isWeekend(date);
}

/**
 * Gets the day name for a given date
 * @param date - Date object
 * @returns Day name (Sunday, Monday, etc.)
 */
export function getDayName(date: Date): string {
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  return dayNames[date.getDay()];
}

/**
 * Validates that a date string is in the correct format
 * @param dateString - Date string to validate
 * @returns true if valid, false otherwise
 */
export function isValidDateString(dateString: string): boolean {
  if (!dateString || typeof dateString !== 'string') {
    return false;
  }
  
  // Check format
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
    return false;
  }
  
  // Check if it's a valid date
  const date = new Date(dateString + 'T00:00:00');
  return date.toISOString().split('T')[0] === dateString;
}
