// useCalendarFilters Hook
// Phase 6B: Calendar Layering System Implementation

import { useState, useCallback, useMemo, useEffect } from 'react';
import {
  CalendarFilters,
  FilterPreset,
  UseCalendarFilters,
  DEFAULT_FILTERS,
  FILTER_PRESETS
} from '../types/CalendarFilters';
import {
  filterSchedules,
  filterCalendarEvents,
  calculateFilterCounts,
  validateFilters,
  getActiveFilterCount,
  generateFilterSummary,
  filterAnalysts,
  encodeFiltersToUrl,
  decodeFiltersFromUrl
} from '../utils/calendarFiltering';

// Local storage key for filter persistence
const FILTERS_STORAGE_KEY = 'shiftplanner_calendar_filters_v1';

// Debounce delay for URL updates
const URL_UPDATE_DELAY = 300;

// Simple URL state management without router dependency
const updateURLWithFilters = (filters: CalendarFilters) => {
  const urlParams = encodeFiltersToUrl(filters);
  const newUrl = urlParams ? `${window.location.pathname}?${urlParams}` : window.location.pathname;
  window.history.replaceState({}, '', newUrl);
};

const getFiltersFromURL = (): Partial<CalendarFilters> => {
  const searchParams = window.location.search.substring(1);
  return decodeFiltersFromUrl(searchParams);
};

/**
 * Custom hook for managing calendar filters state and operations
 */
export const useCalendarFilters = (
  schedules: any[],
  analysts: Array<{ id: string; name: string; }>
): UseCalendarFilters => {
  // Main filter state
  const [filters, setFilters] = useState<CalendarFilters>(() => {
    // Try to restore from URL first, then localStorage, then default
    const urlFilters = getFiltersFromURL();
    if (Object.keys(urlFilters).length > 0) {
      return { ...DEFAULT_FILTERS, ...urlFilters };
    }
    
    try {
      const saved = localStorage.getItem(FILTERS_STORAGE_KEY);
      if (saved) {
        const parsedFilters = JSON.parse(saved);
        return { ...DEFAULT_FILTERS, ...parsedFilters };
      }
    } catch (error) {
      console.warn('Failed to restore filters from localStorage:', error);
    }
    
    return DEFAULT_FILTERS;
  });

  // Debounced URL update state
  const [urlUpdateTimeout, setUrlUpdateTimeout] = useState<NodeJS.Timeout>();

  // Persist filters to localStorage whenever they change
  useEffect(() => {
    try {
      localStorage.setItem(FILTERS_STORAGE_KEY, JSON.stringify(filters));
    } catch (error) {
      console.warn('Failed to save filters to localStorage:', error);
    }
  }, [filters]);

  // Debounced URL update
  useEffect(() => {
    if (urlUpdateTimeout) {
      clearTimeout(urlUpdateTimeout);
    }

    const timeout = setTimeout(() => {
      updateURLWithFilters(filters);
    }, URL_UPDATE_DELAY);

    setUrlUpdateTimeout(timeout);

    return () => clearTimeout(timeout);
  }, [filters, urlUpdateTimeout]);

  // Filtered data calculation with memoization for performance
  const filteredSchedules = useMemo(() => {
    return filterSchedules(schedules, filters);
  }, [schedules, filters]);

  const filteredEvents = useMemo(() => {
    // Convert schedules to calendar events format if needed
    const events = schedules.map(schedule => ({
      id: schedule.id || `${schedule.date}-${schedule.analystId}`,
      title: `${schedule.shiftType}${schedule.isScreener ? ' (Screener)' : ''}`,
      date: schedule.date,
      resource: schedule,
    }));
    
    return filterCalendarEvents(events, filters);
  }, [schedules, filters]);

  // Filter statistics calculation
  const filterCounts = useMemo(() => {
    return calculateFilterCounts(schedules, analysts);
  }, [schedules, analysts]);

  const filteredCounts = useMemo(() => {
    return calculateFilterCounts(filteredSchedules, analysts);
  }, [filteredSchedules, analysts]);

  // Filter validation
  const validation = useMemo(() => {
    return validateFilters(filters);
  }, [filters]);

  // Active filter count for UI indicators
  const activeFilterCount = useMemo(() => {
    return getActiveFilterCount(filters);
  }, [filters]);

  // Filter summary for accessibility
  const filterSummary = useMemo(() => {
    return generateFilterSummary(filters, analysts);
  }, [filters, analysts]);

  // Filtered analysts for employee search
  const filteredAnalysts = useMemo(() => {
    return filterAnalysts(analysts, filters.employees.searchQuery);
  }, [analysts, filters.employees.searchQuery]);

  // FILTER OPERATIONS

  /**
   * Toggle sidebar open/closed
   */
  const toggleSidebar = useCallback(() => {
    setFilters(prev => ({
      ...prev,
      isOpen: !prev.isOpen,
    }));
  }, []);

  /**
   * Toggle calendar layer visibility
   */
  const toggleLayer = useCallback((layer: keyof CalendarFilters['layers']) => {
    setFilters(prev => ({
      ...prev,
      layers: {
        ...prev.layers,
        [layer]: !prev.layers[layer],
      },
    }));
  }, []);

  /**
   * Toggle shift type filter
   */
  const toggleShiftType = useCallback((shiftType: keyof CalendarFilters['shiftTypes']) => {
    setFilters(prev => ({
      ...prev,
      shiftTypes: {
        ...prev.shiftTypes,
        [shiftType]: !prev.shiftTypes[shiftType],
      },
    }));
  }, []);

  /**
   * Toggle schedule type filter
   */
  const toggleScheduleType = useCallback((scheduleType: keyof CalendarFilters['scheduleTypes']) => {
    setFilters(prev => ({
      ...prev,
      scheduleTypes: {
        ...prev.scheduleTypes,
        [scheduleType]: !prev.scheduleTypes[scheduleType],
      },
    }));
  }, []);

  /**
   * Toggle employee selection
   */
  const toggleEmployee = useCallback((employeeId: string) => {
    setFilters(prev => {
      const currentSelected = prev.employees.selected;
      const isSelected = currentSelected.includes(employeeId);
      
      let newSelected: string[];
      if (isSelected) {
        newSelected = currentSelected.filter(id => id !== employeeId);
      } else {
        newSelected = [...currentSelected, employeeId];
      }
      
      return {
        ...prev,
        employees: {
          ...prev.employees,
          selected: newSelected,
          selectAll: newSelected.length === analysts.length,
        },
      };
    });
  }, [analysts.length]);

  /**
   * Toggle select all employees
   */
  const toggleSelectAllEmployees = useCallback(() => {
    setFilters(prev => ({
      ...prev,
      employees: {
        ...prev.employees,
        selected: prev.employees.selectAll ? [] : analysts.map(a => a.id),
        selectAll: !prev.employees.selectAll,
      },
    }));
  }, [analysts]);

  /**
   * Update employee search query
   */
  const updateEmployeeSearch = useCallback((query: string) => {
    setFilters(prev => ({
      ...prev,
      employees: {
        ...prev.employees,
        searchQuery: query,
      },
    }));
  }, []);

  /**
   * Clear employee search
   */
  const clearEmployeeSearch = useCallback(() => {
    setFilters(prev => ({
      ...prev,
      employees: {
        ...prev.employees,
        searchQuery: '',
      },
    }));
  }, []);

  /**
   * Set date range filter
   */
  const setDateRange = useCallback((start: Date, end: Date) => {
    setFilters(prev => ({
      ...prev,
      dateRange: { start, end },
    }));
  }, []);

  /**
   * Clear date range filter
   */
  const clearDateRange = useCallback(() => {
    setFilters(prev => ({
      ...prev,
      dateRange: undefined,
    }));
  }, []);

  /**
   * Apply a filter preset
   */
  const applyPreset = useCallback((preset: FilterPreset) => {
    setFilters(prev => ({
      ...prev,
      ...preset.filters,
    }));
  }, []);

  /**
   * Reset all filters to default state
   */
  const resetFilters = useCallback(() => {
    setFilters(DEFAULT_FILTERS);
  }, []);

  /**
   * Clear all active filters (show everything)
   */
  const clearAllFilters = useCallback(() => {
    setFilters(prev => ({
      ...prev,
      layers: {
        shifts: true,
        events: true,
        vacations: true,
        overrides: true,
      },
      shiftTypes: {
        morning: true,
        evening: true,
        screener: true,
        weekend: true,
      },
      scheduleTypes: {
        regular: true,
        screener: true,
        vacation: true,
        override: true,
        conflicts: true,
      },
      employees: {
        selected: [],
        searchQuery: '',
        selectAll: true,
      },
      dateRange: undefined,
    }));
  }, []);

  /**
   * Validate and fix invalid filter states
   */
  const validateAndFixFilters = useCallback(() => {
    const currentValidation = validateFilters(filters);
    
    if (!currentValidation.isValid) {
      // Auto-fix common issues
      let fixedFilters = { ...filters };
      
      // Ensure at least one layer is enabled
      const layersEnabled = Object.values(fixedFilters.layers).some(enabled => enabled);
      if (!layersEnabled) {
        fixedFilters.layers.shifts = true;
      }
      
      // Fix invalid date ranges
      if (fixedFilters.dateRange && fixedFilters.dateRange.start >= fixedFilters.dateRange.end) {
        fixedFilters.dateRange = undefined;
      }
      
      setFilters(fixedFilters);
      return validateFilters(fixedFilters);
    }
    
    return currentValidation;
  }, [filters]);

  // Return the complete hook interface
  return {
    // State
    filters,
    filteredSchedules,
    filteredEvents,
    filteredAnalysts,
    filterCounts,
    filteredCounts,
    validation,
    activeFilterCount,
    filterSummary,

    // Operations
    toggleSidebar,
    toggleLayer,
    toggleShiftType,
    toggleScheduleType,
    toggleEmployee,
    toggleSelectAllEmployees,
    updateEmployeeSearch,
    clearEmployeeSearch,
    setDateRange,
    clearDateRange,
    applyPreset,
    resetFilters,
    clearAllFilters,
    validateAndFixFilters,

    // Utilities
    setFilters,
    presets: FILTER_PRESETS,
  };
};

export default useCalendarFilters;