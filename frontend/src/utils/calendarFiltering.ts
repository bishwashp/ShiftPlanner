// Calendar Filtering Utilities
// Phase 6B: Calendar Layering System Implementation

import { CalendarFilters, FilterCounts, FilterValidation } from '../types/CalendarFilters';

// Schedule interface from existing codebase (based on SimplifiedScheduleView usage)
interface Schedule {
  id: string;
  date: string;
  analystId: string;
  shiftType: 'Morning' | 'Evening';
  isScreener: boolean;
  isWeekend?: boolean;
  type?: 'shift' | 'event' | 'vacation' | 'override';
  [key: string]: any;
}

interface CalendarEvent {
  id: string;
  title: string;
  date: string; // YYYY-MM-DD format
  resource: Schedule;
}

/**
 * Core filtering function that applies all filter criteria to schedules
 */
export const filterSchedules = (
  schedules: Schedule[],
  filters: CalendarFilters
): Schedule[] => {
  return schedules.filter(schedule => {
    // Layer filtering
    if (!shouldShowForLayer(schedule, filters.layers)) {
      return false;
    }

    // Employee filtering
    if (!shouldShowForEmployee(schedule, filters.employees)) {
      return false;
    }

    // Shift type filtering
    if (!shouldShowForShiftType(schedule, filters.shiftTypes)) {
      return false;
    }

    // Schedule type filtering
    if (!shouldShowForScheduleType(schedule, filters.scheduleTypes)) {
      return false;
    }

    // Date range filtering
    if (!shouldShowForDateRange(schedule, filters.dateRange)) {
      return false;
    }

    return true;
  });
};

/**
 * Filter calendar events (used by SimplifiedScheduleView)
 */
export const filterCalendarEvents = (
  events: CalendarEvent[],
  filters: CalendarFilters
): CalendarEvent[] => {
  return events.filter(event => {
    // Apply same filtering logic to the event's resource (schedule)
    return filterSchedules([event.resource], filters).length > 0;
  });
};

/**
 * Layer filtering logic
 */
const shouldShowForLayer = (
  schedule: Schedule,
  layers: CalendarFilters['layers']
): boolean => {
  // Determine schedule type based on properties
  const scheduleType = getScheduleType(schedule);

  switch (scheduleType) {
    case 'shift':
      return layers.shifts;
    case 'event':
      return layers.events;
    case 'vacation':
      return layers.vacations;
    case 'override':
      return layers.overrides;
    default:
      return layers.shifts; // Default to shifts for unknown types
  }
};

/**
 * Employee filtering logic
 */
const shouldShowForEmployee = (
  schedule: Schedule,
  employeeFilters: CalendarFilters['employees']
): boolean => {
  // If no employees selected or selectAll is true, show all
  if (employeeFilters.selectAll || employeeFilters.selected.length === 0) {
    return true;
  }

  // Check if schedule's analyst is in selected list
  return employeeFilters.selected.includes(schedule.analystId);
};

/**
 * Shift type filtering logic
 */
const shouldShowForShiftType = (
  schedule: Schedule,
  shiftTypes: CalendarFilters['shiftTypes']
): boolean => {
  // Map schedule properties to shift type filters
  const type = (schedule.shiftType || '').toUpperCase();
  const isMorning = type === 'MORNING' || type === 'AM' || type.includes('AM');
  const isEvening = type === 'EVENING' || type === 'PM' || type.includes('PM') || type === 'LATE' || type === 'NIGHT';

  if (isMorning && !shiftTypes.morning) return false;
  if (isEvening && !shiftTypes.evening) return false;
  if (schedule.isScreener && !shiftTypes.screener) return false;
  if (schedule.isWeekend && !shiftTypes.weekend) return false;

  return true;
};

/**
 * Schedule type filtering logic
 */
const shouldShowForScheduleType = (
  schedule: Schedule,
  scheduleTypes: CalendarFilters['scheduleTypes']
): boolean => {
  const scheduleType = getScheduleType(schedule);

  switch (scheduleType) {
    case 'shift':
      return schedule.isScreener ? scheduleTypes.screener : scheduleTypes.regular;
    case 'event':
      return true; // Events don't have sub-types yet
    case 'vacation':
      return scheduleTypes.vacation;
    case 'override':
      return scheduleTypes.override;
    default:
      return scheduleTypes.regular;
  }
};

/**
 * Date range filtering logic
 */
const shouldShowForDateRange = (
  schedule: Schedule,
  dateRange?: CalendarFilters['dateRange']
): boolean => {
  if (!dateRange) return true;

  const scheduleDate = new Date(schedule.date);
  return scheduleDate >= dateRange.start && scheduleDate <= dateRange.end;
};

/**
 * Determine schedule type from schedule properties
 */
const getScheduleType = (schedule: Schedule): 'shift' | 'event' | 'vacation' | 'override' => {
  // Use explicit type if available
  if (schedule.type) {
    return schedule.type;
  }

  // Infer type from properties (for backward compatibility)
  // This logic can be enhanced based on actual data structure
  return 'shift'; // Default to shift for existing schedules
};

/**
 * Calculate filter counts for UI indicators
 */
export const calculateFilterCounts = (
  schedules: Schedule[],
  analysts: Array<{ id: string; name: string }>
): FilterCounts => {
  const counts: FilterCounts = {
    shifts: 0,
    events: 0,
    vacations: 0,
    overrides: 0,
    employees: {},
    total: schedules.length,
  };

  // Initialize employee counts
  analysts.forEach(analyst => {
    counts.employees[analyst.id] = 0;
  });

  // Count by type and employee
  schedules.forEach(schedule => {
    const type = getScheduleType(schedule);

    // Map singular types to plural FilterCounts properties
    switch (type) {
      case 'shift':
        counts.shifts++;
        break;
      case 'event':
        counts.events++;
        break;
      case 'vacation':
        counts.vacations++;
        break;
      case 'override':
        counts.overrides++;
        break;
    }

    if (counts.employees[schedule.analystId] !== undefined) {
      counts.employees[schedule.analystId]++;
    }
  });

  return counts;
};

/**
 * Get count of active filters
 */
export const getActiveFilterCount = (filters: CalendarFilters): number => {
  let count = 0;

  // Count disabled layers
  Object.values(filters.layers).forEach(enabled => {
    if (!enabled) count++;
  });

  // Count disabled shift types
  Object.values(filters.shiftTypes).forEach(enabled => {
    if (!enabled) count++;
  });

  // Count disabled schedule types
  Object.values(filters.scheduleTypes).forEach(enabled => {
    if (!enabled) count++;
  });

  // Count employee filters (if not all selected)
  if (!filters.employees.selectAll && filters.employees.selected.length > 0) {
    count++;
  }

  // Count search query
  if (filters.employees.searchQuery.length > 0) {
    count++;
  }

  // Count date range
  if (filters.dateRange) {
    count++;
  }

  return count;
};

/**
 * Validate filter state
 */
export const validateFilters = (filters: CalendarFilters): FilterValidation => {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Check if any layers are enabled
  const layersEnabled = Object.values(filters.layers).some(enabled => enabled);
  if (!layersEnabled) {
    errors.push('At least one calendar layer must be enabled');
  }

  // Check if any shift types are enabled
  const shiftTypesEnabled = Object.values(filters.shiftTypes).some(enabled => enabled);
  if (!shiftTypesEnabled) {
    warnings.push('No shift types selected - calendar may appear empty');
  }

  // Check if any schedule types are enabled
  const scheduleTypesEnabled = Object.values(filters.scheduleTypes).some(enabled => enabled);
  if (!scheduleTypesEnabled) {
    warnings.push('No schedule types selected - calendar may appear empty');
  }

  // Check date range validity
  if (filters.dateRange) {
    if (filters.dateRange.start >= filters.dateRange.end) {
      errors.push('Date range start must be before end date');
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
};

/**
 * Search and filter analysts based on query
 */
export const filterAnalysts = (
  analysts: Array<{ id: string; name: string }>,
  searchQuery: string
): Array<{ id: string; name: string }> => {
  if (!searchQuery.trim()) {
    return analysts;
  }

  const query = searchQuery.toLowerCase();
  return analysts.filter(analyst =>
    analyst.name.toLowerCase().includes(query) ||
    analyst.id.toLowerCase().includes(query)
  );
};

/**
 * Generate filter summary text for accessibility
 */
export const generateFilterSummary = (
  filters: CalendarFilters,
  analysts: Array<{ id: string; name: string }>
): string => {
  const activeFilters: string[] = [];

  // Summarize layers
  const disabledLayers = Object.entries(filters.layers)
    .filter(([_, enabled]) => !enabled)
    .map(([layer, _]) => layer);

  if (disabledLayers.length > 0) {
    activeFilters.push(`Hidden: ${disabledLayers.join(', ')}`);
  }

  // Summarize employees
  if (!filters.employees.selectAll && filters.employees.selected.length > 0) {
    const selectedNames = filters.employees.selected
      .map(id => analysts.find(a => a.id === id)?.name)
      .filter(Boolean);

    activeFilters.push(`Employees: ${selectedNames.slice(0, 3).join(', ')}${selectedNames.length > 3 ? ` and ${selectedNames.length - 3} more` : ''
      }`);
  }

  // Summarize search
  if (filters.employees.searchQuery) {
    activeFilters.push(`Search: "${filters.employees.searchQuery}"`);
  }

  return activeFilters.length > 0
    ? `Active filters: ${activeFilters.join(', ')}`
    : 'No active filters - showing all items';
};

/**
 * URL encoding/decoding for filter persistence
 */
export const encodeFiltersToUrl = (filters: CalendarFilters): string => {
  const params = new URLSearchParams();

  // Encode layers as comma-separated list of enabled layers
  const activeLayers = Object.entries(filters.layers)
    .filter(([_, enabled]) => enabled)
    .map(([layer, _]) => layer);
  if (activeLayers.length > 0 && activeLayers.length < 4) {
    params.set('layers', activeLayers.join(','));
  }

  // Encode selected employees
  if (!filters.employees.selectAll && filters.employees.selected.length > 0) {
    params.set('employees', filters.employees.selected.join(','));
  }

  // Encode disabled shift types
  const disabledShiftTypes = Object.entries(filters.shiftTypes)
    .filter(([_, enabled]) => !enabled)
    .map(([type, _]) => type);
  if (disabledShiftTypes.length > 0) {
    params.set('hideShifts', disabledShiftTypes.join(','));
  }

  // Encode disabled schedule types
  const disabledScheduleTypes = Object.entries(filters.scheduleTypes)
    .filter(([_, enabled]) => !enabled)
    .map(([type, _]) => type);
  if (disabledScheduleTypes.length > 0) {
    params.set('hideTypes', disabledScheduleTypes.join(','));
  }

  // Encode search query
  if (filters.employees.searchQuery) {
    params.set('search', filters.employees.searchQuery);
  }

  // Encode sidebar state
  if (filters.isOpen) {
    params.set('filters', 'open');
  }

  return params.toString();
};

/**
 * Decode filters from URL parameters
 */
export const decodeFiltersFromUrl = (searchParams: string): Partial<CalendarFilters> => {
  const params = new URLSearchParams(searchParams);
  const filters: Partial<CalendarFilters> = {};

  // Decode layers
  const layersParam = params.get('layers');
  if (layersParam) {
    const activeLayers = layersParam.split(',');
    filters.layers = {
      shifts: activeLayers.includes('shifts'),
      events: activeLayers.includes('events'),
      vacations: activeLayers.includes('vacations'),
      overrides: activeLayers.includes('overrides'),
    };
  }

  // Decode employees
  const employeesParam = params.get('employees');
  if (employeesParam) {
    filters.employees = {
      selected: employeesParam.split(','),
      searchQuery: '',
      selectAll: false,
    };
  }

  // Decode hidden shift types
  const hideShiftsParam = params.get('hideShifts');
  if (hideShiftsParam) {
    const hiddenTypes = hideShiftsParam.split(',');
    filters.shiftTypes = {
      morning: !hiddenTypes.includes('morning'),
      evening: !hiddenTypes.includes('evening'),
      screener: !hiddenTypes.includes('screener'),
      weekend: !hiddenTypes.includes('weekend'),
    };
  }

  // Decode hidden schedule types
  const hideTypesParam = params.get('hideTypes');
  if (hideTypesParam) {
    const hiddenTypes = hideTypesParam.split(',');
    filters.scheduleTypes = {
      regular: !hiddenTypes.includes('regular'),
      screener: !hiddenTypes.includes('screener'),
      vacation: !hiddenTypes.includes('vacation'),
      override: !hiddenTypes.includes('override'),
      conflicts: !hiddenTypes.includes('conflicts'),
    };
  }

  // Decode search query
  const searchParam = params.get('search');
  if (searchParam && filters.employees) {
    filters.employees.searchQuery = searchParam;
  } else if (searchParam) {
    filters.employees = {
      selected: [],
      searchQuery: searchParam,
      selectAll: true,
    };
  }

  // Decode sidebar state
  if (params.get('filters') === 'open') {
    filters.isOpen = true;
  }

  return filters;
};