/**
 * ConstraintFilter - Preprocesses analysts and dates based on constraints
 * 
 * Core Responsibility:
 * - Filter analysts based on absences, vacations, holidays
 * - NOT for validation - purely preprocessing before scheduling
 * - Returns only AVAILABLE analysts for a given date
 */

import { SchedulingConstraint } from '../../../generated/prisma';

export interface ConstraintFilterResult {
  availableAnalysts: any[];
  isHoliday: boolean;
  isBlackout: boolean;
  constraintInfo: string | null;
}

export class ConstraintFilter {
  /**
   * Get available analysts for a specific date considering all constraints
   */
  getAvailableAnalysts(
    date: Date,
    allAnalysts: any[],
    globalConstraints: SchedulingConstraint[]
  ): ConstraintFilterResult {
    const dateStr = date.toISOString().split('T')[0];
    
    // Check for blackout dates (no scheduling allowed)
    const blackoutConstraint = globalConstraints.find(c => 
      c.constraintType === 'BLACKOUT_DATE' &&
      new Date(c.startDate) <= date && 
      new Date(c.endDate) >= date
    );
    
    if (blackoutConstraint) {
      return {
        availableAnalysts: [],
        isHoliday: false,
        isBlackout: true,
        constraintInfo: blackoutConstraint.description || 'Blackout date - no scheduling allowed'
      };
    }
    
    // Check for holidays (informational, may affect screener assignment)
    const holidayConstraint = globalConstraints.find(c => 
      c.constraintType === 'HOLIDAY' &&
      new Date(c.startDate) <= date && 
      new Date(c.endDate) >= date
    );
    
    const isHoliday = !!holidayConstraint;
    
    // Filter analysts based on absences and vacations
    const availableAnalysts = allAnalysts.filter(analyst => {
      // Only active analysts
      if (!analyst.isActive) {
        return false;
      }
      
      // Check vacations
      if (analyst.vacations && analyst.vacations.length > 0) {
        const onVacation = analyst.vacations.some((v: any) => 
          new Date(v.startDate) <= date && 
          new Date(v.endDate) >= date
        );
        if (onVacation) {
          return false;
        }
      }
      
      // Check absences
      if (analyst.absences && analyst.absences.length > 0) {
        const isAbsent = analyst.absences.some((a: any) => 
          new Date(a.startDate) <= date && 
          new Date(a.endDate) >= date
        );
        if (isAbsent) {
          return false;
        }
      }
      
      return true;
    });
    
    return {
      availableAnalysts,
      isHoliday,
      isBlackout: false,
      constraintInfo: isHoliday ? (holidayConstraint?.description || 'Holiday') : null
    };
  }
  
  /**
   * Filter analysts by shift type
   */
  filterByShiftType(
    analysts: any[],
    shiftType: 'MORNING' | 'EVENING'
  ): any[] {
    return analysts.filter(a => a.shiftType === shiftType);
  }
  
  /**
   * Check if a date is a weekend
   */
  isWeekend(date: Date): boolean {
    const dayOfWeek = date.getDay();
    return dayOfWeek === 0 || dayOfWeek === 6; // Sunday or Saturday
  }
  
  /**
   * Check if a date is a weekday
   */
  isWeekday(date: Date): boolean {
    const dayOfWeek = date.getDay();
    return dayOfWeek >= 1 && dayOfWeek <= 5; // Monday to Friday
  }
  
  /**
   * Get day name for logging
   */
  getDayName(date: Date): string {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    return days[date.getDay()];
  }
}

export const constraintFilter = new ConstraintFilter();

