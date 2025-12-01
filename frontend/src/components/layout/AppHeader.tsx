import React, { useState } from 'react';
import {
  Sidebar,
  CaretLeft,
  CaretRight,
  ArrowsClockwise,
  CaretDown,
  Export
} from '@phosphor-icons/react';
import Button from '../ui/Button';
import moment from 'moment-timezone';

import { format, addMonths, subMonths, addDays, subDays, addWeeks, subWeeks } from 'date-fns';
import { View as SidebarView } from './CollapsibleSidebar';
import ViewSettingsMenu from './ViewSettingsMenu';
import ExportModal from '../modals/ExportModal';
import { usePeriod } from '../../context/PeriodContext';

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
  const { period, setPeriod, dateOffset, setDateOffset } = usePeriod();

  const handlePrev = () => {
    const momentDate = moment(date).tz(timezone);
    if (view === 'month') setDate(momentDate.subtract(1, 'month').toDate());
    else if (view === 'week') setDate(momentDate.subtract(1, 'week').toDate());
    else setDate(momentDate.subtract(1, 'day').toDate());
  };

  const handleNext = () => {
    const momentDate = moment(date).tz(timezone);
    if (view === 'month') setDate(momentDate.add(1, 'month').toDate());
    else if (view === 'week') setDate(momentDate.add(1, 'week').toDate());
    else setDate(momentDate.add(1, 'day').toDate());
  };

  const handleToday = () => {
    setDate(moment().tz(timezone).toDate());
  };

  const handleViewChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setView(e.target.value as 'month' | 'week' | 'day');
  }

  const getTitle = () => {
    // Use moment-timezone for consistent date handling
    const momentDate = moment(date).tz(timezone);

    switch (activeView) {
      case 'schedule':
        if (view === 'week') {
          const startOfWeek = momentDate.clone().startOf('week').format('MMM D');
          const endOfWeek = momentDate.clone().endOf('week').format('MMM D, YYYY');
          const weekNumber = momentDate.format('w');
          return `W${weekNumber} | ${startOfWeek} - ${endOfWeek}`;
        }
        if (view === 'day') return momentDate.format('MMMM D, YYYY');
        return momentDate.format('MMMM YYYY');
      case 'dashboard':
        return 'Dashboard';
      case 'analysts':
        return 'Analyst Management';
      case 'availability':
        return activeAvailabilityTab === 'holidays' ? 'Holidays' : 'Absences';
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
        mx-3 mt-3 rounded-[32px]
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
            <Sidebar className="h-5 w-5" weight="bold" />
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
              <ArrowsClockwise
                className={`h-4.5 w-4.5 ${isRefreshing ? 'animate-spin' : ''}`}
                weight="bold"
              />
            </button>
          )}

          {/* Portal Target for Page Actions */}
          <div id="app-header-actions" className="flex items-center space-x-2 ml-6" />


        </div>

        {/* Right Section */}
        <div className="flex items-center space-x-1 sm:space-x-2 flex-shrink-0">
          {activeView === 'schedule' && (
            <>
              {/* Navigation Controls */}
              <div className="flex items-center space-x-1">
                <Button
                  onClick={handlePrev}
                  variant="secondary"
                  size="icon"
                  className="h-9 w-9"
                  leftIcon={CaretLeft}
                  aria-label="Previous"
                />
                <Button
                  onClick={handleNext}
                  variant="secondary"
                  size="icon"
                  className="h-9 w-9"
                  leftIcon={CaretRight}
                  aria-label="Next"
                />
              </div>

              {/* Today Button - Hide on very small screens */}
              <div className="hidden xs:block">
                <Button
                  onClick={handleToday}
                  variant="secondary"
                  size="sm"
                  className="h-9"
                >
                  Today
                </Button>
              </div>

              {/* View Selector */}
              <div className="relative">
                <select
                  value={view}
                  onChange={handleViewChange}
                  className="appearance-none h-9 pl-4 pr-9 py-1 text-sm font-medium rounded-full border border-gray-300 dark:border-gray-600 bg-white/50 dark:bg-gray-800/50 backdrop-blur-md text-gray-700 dark:text-gray-200 shadow-sm hover:shadow-md transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-gray-400 cursor-pointer"
                >

                  <option value="week" className="bg-white dark:bg-gray-900">Week</option>
                  <option value="month" className="bg-white dark:bg-gray-900">Month</option>
                </select>
                <CaretDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 dark:text-gray-400 pointer-events-none" weight="bold" />
              </div>

              {/* Export Button */}
              <Button
                onClick={() => setIsExportModalOpen(true)}
                variant="primary"
                leftIcon={Export}
                size="sm"
                className="h-9"
              >
                <span className="hidden sm:inline">Export</span>
              </Button>
            </>
          )}

          {/* Global Period Toggle & Navigation - Only for Analytics */}
          {activeView === 'analytics' && (
            <div className="flex items-center space-x-2">
              {/* Navigation Controls */}
              <div className="hidden md:flex items-center bg-gray-100 dark:bg-gray-800/50 rounded-lg p-1 border border-gray-200 dark:border-gray-700">
                <button
                  onClick={() => setDateOffset(prev => prev - 1)}
                  className="p-1.5 rounded-md hover:bg-white dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400 transition-all shadow-sm hover:shadow"
                  aria-label="Previous Period"
                >
                  <CaretLeft className="h-4 w-4" weight="bold" />
                </button>

                <span className="px-3 text-xs font-bold text-gray-700 dark:text-gray-300 min-w-[100px] text-center select-none">
                  {(() => {
                    const baseDate = moment().add(dateOffset, period === 'WEEKLY' ? 'weeks' : period === 'MONTHLY' ? 'months' : period === 'QUARTERLY' ? 'quarters' : 'years');
                    if (period === 'WEEKLY') {
                      const startOfWeek = baseDate.clone().startOf('week').format('MMM D');
                      const endOfWeek = baseDate.clone().endOf('week').format('MMM D');
                      return `${startOfWeek} - ${endOfWeek}`;
                    } else if (period === 'MONTHLY') {
                      return baseDate.format('MMMM YYYY');
                    } else if (period === 'QUARTERLY') {
                      return `Q${baseDate.quarter()} ${baseDate.format('YYYY')}`;
                    } else if (period === 'YEARLY') {
                      return baseDate.format('YYYY');
                    }
                    return '';
                  })()}
                </span>

                <button
                  onClick={() => setDateOffset(prev => prev + 1)}
                  className="p-1.5 rounded-md hover:bg-white dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400 transition-all shadow-sm hover:shadow"
                  aria-label="Next Period"
                >
                  <CaretRight className="h-4 w-4" weight="bold" />
                </button>
              </div>

              {/* Period Toggle */}
              <div className="hidden md:flex items-center bg-gray-100 dark:bg-gray-800/50 rounded-lg p-1 mr-2 border border-gray-200 dark:border-gray-700">
                {(['WEEKLY', 'MONTHLY', 'QUARTERLY', 'YEARLY'] as const).map((p) => (
                  <button
                    key={p}
                    onClick={() => setPeriod(p)}
                    className={`
                      px-3 py-1 text-xs font-semibold rounded-md transition-all duration-200
                      ${period === p
                        ? 'bg-white dark:bg-gray-700 shadow-sm text-blue-600 dark:text-blue-400'
                        : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
                      }
                    `}
                  >
                    {p.charAt(0) + p.slice(1).toLowerCase()}
                  </button>
                ))}
              </div>
            </div>
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