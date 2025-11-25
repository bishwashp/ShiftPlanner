import React, { useState } from 'react';
import { Bars3Icon, ChevronLeftIcon, ChevronRightIcon, ExclamationTriangleIcon, CheckCircleIcon, ArrowPathIcon, ArrowDownTrayIcon } from '@heroicons/react/24/outline';

import { format, addMonths, subMonths, addDays, subDays, addWeeks, subWeeks } from 'date-fns';
import { View as SidebarView } from './CollapsibleSidebar';
import ViewSettingsMenu from './ViewSettingsMenu';
import ExportModal from '../modals/ExportModal';

interface AppHeaderProps {
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
  date: Date;
  setDate: (date: Date) => void;
  view: 'month' | 'week' | 'day';
  setView: (view: 'month' | 'week' | 'day') => void;
  activeView: SidebarView;
  timezone: string;
  onTimezoneChange: (tz: string) => void;
  activeAvailabilityTab?: 'holidays' | 'absences';
  onAvailabilityTabChange?: (tab: 'holidays' | 'absences') => void;
  activeConflictTab?: 'critical' | 'recommended';
  onConflictTabChange?: (tab: 'critical' | 'recommended') => void;
  onRefresh?: () => void;
  isRefreshing?: boolean;
  filterHook?: any;
}

const AppHeader: React.FC<AppHeaderProps> = ({
  sidebarOpen,
  setSidebarOpen,
  date,
  setDate,
  view,
  setView,
  activeView,
  timezone,
  onTimezoneChange,
  activeAvailabilityTab,
  onAvailabilityTabChange,
  activeConflictTab,
  onConflictTabChange,
  onRefresh,
  isRefreshing,
  filterHook
}) => {
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);

  const handlePrev = () => {
    if (view === 'month') setDate(subMonths(date, 1));
    else if (view === 'week') setDate(subWeeks(date, 1));
    else setDate(subDays(date, 1));
  };

  const handleNext = () => {
    if (view === 'month') setDate(addMonths(date, 1));
    else if (view === 'week') setDate(addWeeks(date, 1));
    else setDate(addDays(date, 1));
  };

  const handleToday = () => {
    setDate(new Date());
  };

  const handleViewChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setView(e.target.value as 'month' | 'week' | 'day');
  }

  const getTitle = () => {
    switch (activeView) {
      case 'schedule':
        if (view === 'day') return format(date, 'MMMM d, yyyy');
        return format(date, 'MMMM yyyy');
      case 'dashboard':
        return 'Dashboard';
      case 'analysts':
        return 'Analyst Management';
      case 'availability':
        return 'Availability Management';
      case 'conflicts':
        return 'Conflict Management';
      case 'analytics':
        return 'Analytics';
      case 'constraints':
        return 'Constraint Management';
      case 'algorithms':
        return 'Algorithm Management';
      default:
        return 'ShiftPlanner';
    }
  }

  return (
    <>
      <header className={`
        mx-3 mt-3 rounded-2xl
        bg-white/60 dark:bg-gray-900/50 backdrop-blur-xl
        border border-gray-300/50 dark:border-white/10
        shadow-lg shadow-black/10 dark:shadow-black/30
        flex items-center justify-between
        px-3 py-2 sm:px-4 sm:py-2
        ${sidebarOpen ? 'pl-2 sm:pl-4' : 'pl-4'}
        transition-all duration-300
        z-50
      `}>
        {/* Left Section */}
        <div className="flex items-center space-x-2 flex-shrink-0">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-2 rounded-lg hover:bg-gray-200/50 dark:hover:bg-white/10 min-h-[44px] min-w-[44px] flex items-center justify-center text-gray-900 dark:text-white transition-colors"
            aria-label="Toggle sidebar"
          >
            <Bars3Icon className="h-5 w-5" />
          </button>
          <h1 className="text-lg font-semibold truncate hidden sm:block text-gray-900 dark:text-white">
            {getTitle()}
          </h1>
          <h1 className="text-base font-semibold truncate sm:hidden text-gray-900 dark:text-white">
            {activeView === 'schedule' ? format(date, 'MMM yyyy') : getTitle()}
          </h1>

          {/* Refresh Button - positioned next to title, only for Dashboard */}
          {activeView === 'dashboard' && onRefresh && (
            <button
              onClick={onRefresh}
              disabled={isRefreshing}
              className="p-2 rounded-lg hover:bg-gray-200/50 dark:hover:bg-white/10 min-h-[44px] min-w-[44px] flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed text-gray-900 dark:text-white transition-colors"
              aria-label="Refresh dashboard data"
            >
              <ArrowPathIcon
                className={`h-4.5 w-4.5 ${isRefreshing ? 'animate-spin' : ''}`}
              />
            </button>
          )}

          {/* Tab Navigation - positioned next to title */}
          {(() => {
            // Availability tabs - Moved to Sidebar
            if (activeView === 'availability') {
              return null;
            }

            // Conflict tabs
            if (activeView === 'conflicts' && activeConflictTab && onConflictTabChange) {
              return (
                <div className="flex items-center space-x-1 ml-4">
                  <button
                    onClick={() => onConflictTabChange('critical')}
                    className={`flex items-center space-x-1 px-2 sm:px-3 py-1 rounded-lg text-xs sm:text-sm font-medium transition-colors ${activeConflictTab === 'critical'
                      ? 'bg-primary/30 text-primary-foreground shadow-lg'
                      : 'text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-200/50 dark:hover:bg-white/5'
                      }`}
                  >
                    <ExclamationTriangleIcon className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                    <span className="hidden sm:inline">Critical</span>
                  </button>
                  <button
                    onClick={() => onConflictTabChange('recommended')}
                    className={`flex items-center space-x-1 px-2 sm:px-3 py-1 rounded-lg text-xs sm:text-sm font-medium transition-colors ${activeConflictTab === 'recommended'
                      ? 'bg-primary/30 text-primary-foreground shadow-lg'
                      : 'text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-200/50 dark:hover:bg-white/5'
                      }`}
                  >
                    <CheckCircleIcon className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                    <span className="hidden sm:inline">Recommended</span>
                  </button>
                </div>
              );
            }

            return null;
          })()}
        </div>

        {/* Right Section */}
        <div className="flex items-center space-x-1 sm:space-x-2 flex-shrink-0">
          {activeView === 'schedule' && (
            <>
              {/* Navigation Controls */}
              <div className="flex items-center space-x-1">
                <button
                  onClick={handlePrev}
                  className="p-2 rounded-lg hover:bg-gray-200/50 dark:hover:bg-white/10 min-h-[44px] min-w-[44px] flex items-center justify-center text-gray-900 dark:text-white transition-colors"
                  aria-label="Previous"
                >
                  <ChevronLeftIcon className="h-4.5 w-4.5" />
                </button>
                <button
                  onClick={handleNext}
                  className="p-2 rounded-lg hover:bg-gray-200/50 dark:hover:bg-white/10 min-h-[44px] min-w-[44px] flex items-center justify-center text-gray-900 dark:text-white transition-colors"
                  aria-label="Next"
                >
                  <ChevronRightIcon className="h-4.5 w-4.5" />
                </button>
              </div>

              {/* Today Button - Hide on very small screens */}
              <button
                onClick={handleToday}
                className="px-3 py-2 text-sm font-medium rounded-lg border border-gray-300/50 dark:border-white/20 hover:bg-gray-200/50 dark:hover:bg-white/10 min-h-[44px] hidden xs:block text-gray-900 dark:text-white transition-colors"
              >
                Today
              </button>

              {/* View Selector */}
              <select
                value={view}
                onChange={handleViewChange}
                className="px-2 py-2 text-sm border border-gray-300/50 dark:border-white/20 rounded-lg bg-gray-100/50 dark:bg-white/10 text-gray-900 dark:text-white backdrop-blur-sm focus:ring-2 focus:ring-primary min-h-[44px] w-16 sm:w-auto"
              >
                <option value="day" className="bg-white dark:bg-gray-900">Day</option>
                <option value="week" className="bg-white dark:bg-gray-900">Week</option>
                <option value="month" className="bg-white dark:bg-gray-900">Month</option>
              </select>

              {/* Export Button */}
              <button
                onClick={() => setIsExportModalOpen(true)}
                className="flex items-center space-x-1 px-3 py-2 text-sm font-medium rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors min-h-[44px] shadow-lg"
              >
                <ArrowDownTrayIcon className="h-4 w-4" />
                <span className="hidden sm:inline">Export</span>
              </button>
            </>
          )}

          {/* View Settings Menu */}
          <ViewSettingsMenu
            timezone={timezone}
            onTimezoneChange={onTimezoneChange}
            showLegend={activeView === 'schedule'}
            filterHook={activeView === 'schedule' ? filterHook : undefined}
          />
        </div>
      </header>

      <ExportModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
      />
    </>
  );
};

export default AppHeader;