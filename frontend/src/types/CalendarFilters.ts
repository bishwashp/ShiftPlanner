// Calendar Filtering System Types
// Phase 6B: Calendar Layering Implementation

export type CalendarLayerType = 'shifts' | 'events' | 'vacations' | 'overrides';
export type ShiftType = 'morning' | 'evening' | 'screener' | 'weekend';
export type ScheduleType = 'regular' | 'screener' | 'vacation' | 'override' | 'conflicts';
export type FilterTab = 'layers' | 'employees' | 'shifts' | 'types';

// Core filter state interface
export interface CalendarFilters {
  // Calendar Layer Control
  layers: {
    shifts: boolean;           // Show shift assignments
    events: boolean;           // Show events/meetings  
    vacations: boolean;        // Show vacation periods
    overrides: boolean;        // Show manual overrides
  };
  
  // Employee Filtering
  employees: {
    selected: string[];        // Array of selected analyst IDs
    searchQuery: string;       // Search term for employee names
    selectAll: boolean;        // Quick select/deselect all
  };
  
  // Shift Type Filtering  
  shiftTypes: {
    morning: boolean;          // Morning shifts (9 AM - 6 PM)
    evening: boolean;          // Evening shifts (6 PM - 3 AM)  
    screener: boolean;         // Screener assignments
    weekend: boolean;          // Weekend coverage
  };
  
  // Schedule Type Filtering
  scheduleTypes: {
    regular: boolean;          // Regular rotation schedules
    screener: boolean;         // Screener-specific assignments
    vacation: boolean;         // Vacation/time-off periods
    override: boolean;         // Manual schedule overrides
    conflicts: boolean;        // Show conflicting assignments
  };
  
  // Advanced Filters
  dateRange?: {
    start: Date;
    end: Date;
  };
  
  // UI State
  isOpen: boolean;             // Sidebar panel visibility
  activeTab: FilterTab;        // Current active filter tab
}

// Default filter state
export const DEFAULT_FILTERS: CalendarFilters = {
  layers: {
    shifts: true,
    events: true,
    vacations: true,
    overrides: true,
  },
  employees: {
    selected: [],
    searchQuery: '',
    selectAll: true,
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
  isOpen: false,
  activeTab: 'layers',
};

// Filter preset definitions
export interface FilterPreset {
  id: string;
  name: string;
  description: string;
  icon: string;
  filters: Partial<CalendarFilters>;
}

export const FILTER_PRESETS: FilterPreset[] = [
  {
    id: 'all',
    name: 'All Items',
    description: 'Show everything',
    icon: '👁️',
    filters: {
      layers: { shifts: true, events: true, vacations: true, overrides: true },
      shiftTypes: { morning: true, evening: true, screener: true, weekend: true },
      scheduleTypes: { regular: true, screener: true, vacation: true, override: true, conflicts: true },
    },
  },
  {
    id: 'shifts-only',
    name: 'Shifts Only',
    description: 'Focus on shift assignments',
    icon: '🕐',
    filters: {
      layers: { shifts: true, events: false, vacations: false, overrides: false },
      scheduleTypes: { regular: true, screener: false, vacation: false, override: false, conflicts: false },
    },
  },
  {
    id: 'screener-focus',
    name: 'Screener Focus',
    description: 'Screener assignments and related items',
    icon: '🔍',
    filters: {
      layers: { shifts: true, events: false, vacations: false, overrides: true },
      shiftTypes: { morning: true, evening: true, screener: true, weekend: false },
      scheduleTypes: { screener: true, regular: false, vacation: false, override: true, conflicts: true },
    },
  },
  {
    id: 'weekend-coverage',
    name: 'Weekend Coverage',
    description: 'Weekend shifts and coverage',
    icon: '📅',
    filters: {
      layers: { shifts: true, events: false, vacations: true, overrides: true },
      shiftTypes: { morning: true, evening: true, screener: false, weekend: true },
    },
  },
];

// Hook interface for calendar filters
export interface UseCalendarFilters {
  // State
  filters: CalendarFilters;
  filteredSchedules: any[];
  filteredEvents: any[];
  filteredAnalysts: Array<{ id: string; name: string }>;
  filterCounts: FilterCounts;
  filteredCounts: FilterCounts;
  validation: FilterValidation;
  activeFilterCount: number;
  filterSummary: string;

  // Operations
  toggleSidebar: () => void;
  toggleLayer: (layer: keyof CalendarFilters['layers']) => void;
  toggleShiftType: (shiftType: keyof CalendarFilters['shiftTypes']) => void;
  toggleScheduleType: (scheduleType: keyof CalendarFilters['scheduleTypes']) => void;
  toggleEmployee: (employeeId: string) => void;
  toggleSelectAllEmployees: () => void;
  updateEmployeeSearch: (query: string) => void;
  clearEmployeeSearch: () => void;
  setDateRange: (start: Date, end: Date) => void;
  clearDateRange: () => void;
  applyPreset: (preset: FilterPreset) => void;
  resetFilters: () => void;
  clearAllFilters: () => void;
  validateAndFixFilters: () => FilterValidation;

  // Utilities
  setFilters: React.Dispatch<React.SetStateAction<CalendarFilters>>;
  presets: FilterPreset[];
}

// Filter validation interface
export interface FilterValidation {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

// Filter count interface for UI indicators
export interface FilterCounts {
  shifts: number;
  events: number;
  vacations: number;
  overrides: number;
  employees: Record<string, number>;
  total: number;
}