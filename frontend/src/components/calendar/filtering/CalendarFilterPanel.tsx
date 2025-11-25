// Calendar Filter Panel Component
// Phase 6B: Calendar Layering System Implementation

import React, { useState, useRef, useEffect } from 'react';
import { XMarkIcon, FunnelIcon, MagnifyingGlassIcon, UsersIcon, RectangleStackIcon, ClockIcon, TagIcon, ChevronDownIcon, ChevronUpIcon } from '@heroicons/react/24/outline';
import Checkbox from '../../ui/Checkbox';
import { FilterTab } from '../../../types/CalendarFilters';
import { UseCalendarFilters } from '../../../types/CalendarFilters';
import './CalendarFilterPanel.css';

interface CalendarFilterPanelProps {
  filterHook: UseCalendarFilters;
  onClose: () => void;
  className?: string;
}

// Individual filter tab components
const LayersTab: React.FC<{ filterHook: UseCalendarFilters }> = ({ filterHook }) => {
  const { filters, toggleLayer, filterCounts } = filterHook;

  const layerOptions = [
    { key: 'shifts' as const, label: 'Shifts', icon: '🕐', count: filterCounts.shifts },
    { key: 'events' as const, label: 'Events', icon: '📅', count: filterCounts.events },
    { key: 'vacations' as const, label: 'Vacations', icon: '🏖️', count: filterCounts.vacations },
    { key: 'overrides' as const, label: 'Overrides', icon: '⚡', count: filterCounts.overrides },
  ];

  return (
    <div className="space-y-3">
      <div className="text-sm text-gray-600 dark:text-gray-400 mb-4">
        Control which calendar layers are visible
      </div>
      {layerOptions.map((layer) => (
        <div
          key={layer.key}
          className="flex items-center justify-between p-3 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer transition-colors"
        >
          <div className="flex items-center space-x-3">
            <Checkbox
              checked={filters.layers[layer.key]}
              onChange={() => toggleLayer(layer.key)}
            />
            <span className="text-lg" role="img" aria-label={layer.label}>
              {layer.icon}
            </span>
            <span className="text-sm font-medium text-gray-900 dark:text-white">
              {layer.label}
            </span>
          </div>
          <span className="text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 px-2 py-1 rounded-full">
            {layer.count}
          </span>
        </div>
      ))}
    </div>
  );
};

const EmployeesTab: React.FC<{
  filterHook: UseCalendarFilters;
  analysts: Array<{ id: string; name: string }>;
}> = ({ filterHook, analysts }) => {
  const {
    filters,
    filteredAnalysts,
    toggleEmployee,
    toggleSelectAllEmployees,
    updateEmployeeSearch,
    clearEmployeeSearch,
    filterCounts
  } = filterHook;

  const [showAll, setShowAll] = useState(false);
  const displayAnalysts = showAll ? filteredAnalysts : filteredAnalysts.slice(0, 10);

  return (
    <div className="space-y-4">
      {/* Search */}
      <div className="relative">
        <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
        <input
          type="text"
          placeholder="Search employees..."
          value={filters.employees.searchQuery}
          onChange={(e) => updateEmployeeSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
        {filters.employees.searchQuery && (
          <button
            onClick={clearEmployeeSearch}
            className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
            aria-label="Clear search"
          >
            <XMarkIcon className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Select All */}
      <div className="flex items-center justify-between p-3 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer transition-colors">
        <div className="flex items-center space-x-3">
          <Checkbox
            checked={filters.employees.selectAll}
            onChange={toggleSelectAllEmployees}
          />
          <span className="text-sm font-medium text-gray-900 dark:text-white">
            Select All
          </span>
        </div>
        <span className="text-xs bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-300 px-2 py-1 rounded-full">
          {analysts.length}
        </span>
      </div>

      {/* Employee List */}
      <div className="space-y-2 max-h-64 overflow-y-auto">
        {displayAnalysts.map((analyst) => (
          <div
            key={analyst.id}
            className="flex items-center justify-between p-2 rounded hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer transition-colors"
          >
            <div className="flex items-center space-x-3">
              <Checkbox
                checked={filters.employees.selectAll || filters.employees.selected.includes(analyst.id)}
                onChange={() => toggleEmployee(analyst.id)}
                disabled={filters.employees.selectAll}
              />
              <span className="text-sm text-gray-900 dark:text-white truncate">
                {analyst.name}
              </span>
            </div>
            <span className="text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 px-1.5 py-0.5 rounded">
              {filterCounts.employees[analyst.id] || 0}
            </span>
          </div>
        ))}
      </div>

      {/* Show More/Less */}
      {filteredAnalysts.length > 10 && (
        <button
          onClick={() => setShowAll(!showAll)}
          className="w-full flex items-center justify-center space-x-2 py-2 text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 transition-colors"
        >
          {showAll ? (
            <>
              <ChevronUpIcon className="h-4 w-4" />
              <span>Show Less</span>
            </>
          ) : (
            <>
              <ChevronDownIcon className="h-4 w-4" />
              <span>Show More ({filteredAnalysts.length - 10})</span>
            </>
          )}
        </button>
      )}
    </div>
  );
};

const ShiftsTab: React.FC<{ filterHook: UseCalendarFilters }> = ({ filterHook }) => {
  const { filters, toggleShiftType } = filterHook;

  const shiftOptions = [
    { key: 'morning' as const, label: 'Morning Shifts', icon: '🌅', description: '9 AM - 6 PM' },
    { key: 'evening' as const, label: 'Evening Shifts', icon: '🌆', description: '6 PM - 3 AM' },
    { key: 'screener' as const, label: 'Screener Assignments', icon: '🔍', description: 'Special screening roles' },
    { key: 'weekend' as const, label: 'Weekend Coverage', icon: '📅', description: 'Saturday & Sunday' },
  ];

  return (
    <div className="space-y-3">
      <div className="text-sm text-gray-600 dark:text-gray-400 mb-4">
        Filter by shift time and type
      </div>
      {shiftOptions.map((shift) => (
        <div
          key={shift.key}
          className="flex items-center justify-between p-3 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer transition-colors"
        >
          <div className="flex items-center space-x-3">
            <Checkbox
              checked={filters.shiftTypes[shift.key]}
              onChange={() => toggleShiftType(shift.key)}
            />
            <span className="text-lg" role="img" aria-label={shift.label}>
              {shift.icon}
            </span>
            <div>
              <div className="text-sm font-medium text-gray-900 dark:text-white">
                {shift.label}
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400">
                {shift.description}
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

const TypesTab: React.FC<{ filterHook: UseCalendarFilters }> = ({ filterHook }) => {
  const { filters, toggleScheduleType } = filterHook;

  const typeOptions = [
    { key: 'regular' as const, label: 'Regular Schedules', icon: '📋', description: 'Standard rotation assignments' },
    { key: 'screener' as const, label: 'Screener Schedules', icon: '🔍', description: 'Specialized screening assignments' },
    { key: 'vacation' as const, label: 'Vacation Periods', icon: '🏖️', description: 'Time off and leave' },
    { key: 'override' as const, label: 'Manual Overrides', icon: '⚡', description: 'Custom schedule changes' },
    { key: 'conflicts' as const, label: 'Conflicts', icon: '⚠️', description: 'Scheduling conflicts and issues' },
  ];

  return (
    <div className="space-y-3">
      <div className="text-sm text-gray-600 dark:text-gray-400 mb-4">
        Filter by schedule and assignment type
      </div>
      {typeOptions.map((type) => (
        <div
          key={type.key}
          className="flex items-center justify-between p-3 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer transition-colors"
        >
          <div className="flex items-center space-x-3">
            <Checkbox
              checked={filters.scheduleTypes[type.key]}
              onChange={() => toggleScheduleType(type.key)}
            />
            <span className="text-lg" role="img" aria-label={type.label}>
              {type.icon}
            </span>
            <div>
              <div className="text-sm font-medium text-gray-900 dark:text-white">
                {type.label}
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400">
                {type.description}
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

const CalendarFilterPanel: React.FC<CalendarFilterPanelProps> = ({
  filterHook,
  onClose,
  className = '',
}) => {
  const {
    activeFilterCount,
    filterSummary,
    applyPreset,
    resetFilters,
    clearAllFilters,
    presets
  } = filterHook;

  const [activeTab, setActiveTab] = useState<FilterTab>('layers');
  const panelRef = useRef<HTMLDivElement>(null);

  // Close on escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  const tabs = [
    { id: 'layers' as FilterTab, label: 'Layers', icon: RectangleStackIcon },
    { id: 'employees' as FilterTab, label: 'People', icon: UsersIcon },
    { id: 'shifts' as FilterTab, label: 'Shifts', icon: ClockIcon },
    { id: 'types' as FilterTab, label: 'Types', icon: TagIcon },
  ];

  // Mock analysts data - in real implementation this would come from props
  const mockAnalysts = [
    { id: '1', name: 'John Smith' },
    { id: '2', name: 'Sarah Johnson' },
    { id: '3', name: 'Mike Chen' },
    { id: '4', name: 'Emily Davis' },
    { id: '5', name: 'David Wilson' },
  ];

  return (
    <div
      ref={panelRef}
      className={`fixed right-0 top-0 h-full w-80 bg-white dark:bg-gray-900 shadow-2xl border-l border-gray-200 dark:border-gray-700 z-50 transform transition-transform duration-300 ease-in-out ${className}`}
      role="dialog"
      aria-labelledby="filter-panel-title"
      aria-describedby="filter-panel-description"
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center space-x-3">
          <FunnelIcon className="h-5 w-5 text-gray-600 dark:text-gray-400" />
          <h2 id="filter-panel-title" className="text-lg font-semibold text-gray-900 dark:text-white">
            Calendar Filters
          </h2>
          {activeFilterCount > 0 && (
            <span className="bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-300 text-xs font-medium px-2 py-1 rounded-full">
              {activeFilterCount}
            </span>
          )}
        </div>
        <button
          onClick={onClose}
          className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          aria-label="Close filter panel"
        >
          <XMarkIcon className="h-5 w-5" />
        </button>
      </div>

      {/* Filter Summary */}
      <div
        id="filter-panel-description"
        className="p-4 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700"
        aria-live="polite"
      >
        <p className="text-sm text-gray-600 dark:text-gray-400">
          {filterSummary}
        </p>
      </div>

      {/* Quick Actions */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-700">
        <div className="grid grid-cols-2 gap-2">
          {presets.slice(0, 4).map((preset) => (
            <button
              key={preset.id}
              onClick={() => applyPreset(preset)}
              className="flex items-center space-x-2 p-2 text-sm bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-md transition-colors"
              title={preset.description}
            >
              <span className="text-base" role="img" aria-label={preset.name}>
                {preset.icon}
              </span>
              <span className="text-gray-900 dark:text-white truncate">
                {preset.name}
              </span>
            </button>
          ))}
        </div>
        <div className="flex space-x-2 mt-3">
          <button
            onClick={clearAllFilters}
            className="flex-1 px-3 py-2 text-sm text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-md transition-colors"
          >
            Show All
          </button>
          <button
            onClick={resetFilters}
            className="flex-1 px-3 py-2 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-md transition-colors"
          >
            Reset
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 dark:border-gray-700">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 flex flex-col items-center py-3 px-1 text-xs font-medium border-b-2 transition-colors ${activeTab === tab.id
                ? 'border-blue-500 text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20'
                : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800'
                }`}
              aria-selected={activeTab === tab.id}
              role="tab"
            >
              <Icon className="h-4 w-4 mb-1" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-y-auto p-4">
        <div role="tabpanel" aria-labelledby={`tab-${activeTab}`}>
          {activeTab === 'layers' && <LayersTab filterHook={filterHook} />}
          {activeTab === 'employees' && <EmployeesTab filterHook={filterHook} analysts={mockAnalysts} />}
          {activeTab === 'shifts' && <ShiftsTab filterHook={filterHook} />}
          {activeTab === 'types' && <TypesTab filterHook={filterHook} />}
        </div>
      </div>

      {/* Footer with additional actions */}
      <div className="p-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
        <div className="text-xs text-gray-500 dark:text-gray-400 text-center">
          Filters are automatically saved
        </div>
      </div>
    </div>
  );
};

export default CalendarFilterPanel;