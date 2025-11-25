import React, { useState, useMemo, useCallback, useEffect, memo } from 'react';
import moment from 'moment-timezone';
import { apiService, Schedule, Analyst } from '../services/api';
import { View as AppView } from './layout/CollapsibleSidebar';
import { useTheme } from 'react18-themes';
import { useActionPrompts } from '../contexts/ActionPromptContext';
import { FunnelIcon, ExclamationCircleIcon, CalendarDaysIcon } from '@heroicons/react/24/outline';

// Simplified calendar imports
import { CalendarGrid } from './calendar/simplified/CalendarGrid';
import WeekScheduleView from './calendar/simplified/WeekScheduleView';
import CalendarFilterPanel from './calendar/filtering/CalendarFilterPanel';
import { useCalendarFilters } from '../hooks/useCalendarFilters';
import CreateScheduleModal from './calendar/modals/CreateScheduleModal';
import EditScheduleModal from './calendar/modals/EditScheduleModal';

// Performance monitoring utilities
interface PerformanceMetrics {
  renderTime: number;
  navigationTime: number;
  memoryUsage: number;
  eventCount: number;
}

const trackCalendarPerformance = (calendarType: 'legacy' | 'simplified') => {
  const startTime = performance.now();

  return {
    measureRender: (): PerformanceMetrics => {
      const renderTime = performance.now() - startTime;
      const memory = (performance as any).memory?.usedJSHeapSize || 0;

      // Log performance metrics for monitoring
      console.log(`📊 Calendar Performance (${calendarType}):`, {
        renderTime: `${renderTime.toFixed(2)}ms`,
        memoryMB: `${(memory / 1024 / 1024).toFixed(2)}MB`,
        target: 'render <100ms, memory <5MB'
      });

      return {
        renderTime,
        navigationTime: 0,
        memoryUsage: memory,
        eventCount: 0
      };
    },
    measureNavigation: (): number => {
      const navTime = performance.now() - startTime;
      console.log(`⚡ Navigation Performance: ${navTime.toFixed(2)}ms (target: <50ms)`);
      return navTime;
    }
  };
};

// Types matching the original ScheduleView interface
interface SimplifiedScheduleViewProps {
  onViewChange: (view: AppView) => void;
  date: Date;
  setDate: (date: Date) => void;
  view: 'month' | 'week' | 'day'; // Simplified to just month initially
  setView: (view: 'month' | 'week' | 'day') => void;
  timezone: string;
  onError?: (error: string) => void;
  onSuccess?: (message: string) => void;
  isLoading?: (loading: boolean) => void;
  schedules: Schedule[];
  analysts: Analyst[];
  loading: boolean;
  error: string | null;
  filterHook: any; // Using any to avoid circular dependency issues for now, or import type
  onRefreshData: () => void;
}

interface CalendarEvent {
  id: string;
  title: string;
  date: string; // YYYY-MM-DD format
  resource: Schedule;
}

// Mobile gesture detection hook (same as original)
const useSwipeGesture = (onSwipeLeft?: () => void, onSwipeRight?: () => void) => {
  const [touchStart, setTouchStart] = React.useState<{ x: number; y: number } | null>(null);
  const [touchEnd, setTouchEnd] = React.useState<{ x: number; y: number } | null>(null);

  const minSwipeDistance = 50;

  const onTouchStart = (e: React.TouchEvent) => {
    setTouchEnd(null);
    setTouchStart({
      x: e.targetTouches[0].clientX,
      y: e.targetTouches[0].clientY
    });
  };

  const onTouchMove = (e: React.TouchEvent) => {
    setTouchEnd({
      x: e.targetTouches[0].clientX,
      y: e.targetTouches[0].clientY
    });
  };

  const onTouchEnd = () => {
    if (!touchStart || !touchEnd) return;

    const distanceX = touchStart.x - touchEnd.x;
    const distanceY = Math.abs(touchStart.y - touchEnd.y);

    if (Math.abs(distanceX) > minSwipeDistance && Math.abs(distanceX) > distanceY) {
      if (distanceX > 0 && onSwipeLeft) {
        onSwipeLeft();
      } else if (distanceX < 0 && onSwipeRight) {
        onSwipeRight();
      }
    }
  };

  return {
    onTouchStart,
    onTouchMove,
    onTouchEnd
  };
};

const ScheduleCalendar: React.FC<SimplifiedScheduleViewProps> = memo(({
  onViewChange,
  date,
  setDate,
  view,
  setView,
  timezone,
  onError,
  onSuccess,
  isLoading,
  schedules,
  analysts,
  loading,
  error,
  filterHook,
  onRefreshData
}) => {
  const { theme } = useTheme();
  const { showImportantPrompt } = useActionPrompts();
  const [isMobile, setIsMobile] = useState(false);


  // Week view state
  const [showWeekView, setShowWeekView] = useState(false);
  const [clickedDay, setClickedDay] = useState<Date | undefined>(undefined);

  // Sync internal week view state with main view prop
  useEffect(() => {
    if (view === 'week' && !showWeekView) {
      // If main view is week but we're not showing week view, enter week view
      setShowWeekView(true);
    } else if (view === 'month' && showWeekView) {
      // If main view is month but we're showing week view, exit week view
      setShowWeekView(false);
      setClickedDay(undefined);
    }
  }, [view, showWeekView]);

  // Initialize filtering system - now passed as prop
  const { filters, filteredSchedules, toggleSidebar } = filterHook;

  // Performance tracking
  const performanceTracker = useMemo(() => trackCalendarPerformance('simplified'), []);

  // Mobile detection
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 768);
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Date range calculation - extend to cover cross-month weeks
  const { startDate, endDate } = useMemo(() => {
    const localDate = moment(date).tz(timezone);
    // Extend range to cover weeks that span multiple months
    const start = localDate.clone().startOf('month').subtract(7, 'days').format('YYYY-MM-DD');
    const end = localDate.clone().endOf('month').add(7, 'days').format('YYYY-MM-DD');

    return { startDate: start, endDate: end };
  }, [date, timezone]);

  // Gesture handlers for mobile navigation
  // Enhanced navigation with performance tracking
  const handleSwipeLeft = useCallback(() => {
    if (isMobile && view === 'month') {
      const nextMonth = moment(date).add(1, 'month').toDate();
      setDate(nextMonth);

      if ('vibrate' in navigator) {
        navigator.vibrate(50);
      }

      // Track navigation performance
      const navTime = performanceTracker.measureNavigation();
      console.log(`⚡ Navigation Performance (Next): ${navTime.toFixed(2)}ms`);
    }
  }, [date, setDate, view, isMobile, performanceTracker]);

  const handleSwipeRight = useCallback(() => {
    if (isMobile && view === 'month') {
      const prevMonth = moment(date).subtract(1, 'month').toDate();
      setDate(prevMonth);

      if ('vibrate' in navigator) {
        navigator.vibrate(50);
      }

      // Track navigation performance
      const navTime = performanceTracker.measureNavigation();
      console.log(`⚡ Navigation Performance (Prev): ${navTime.toFixed(2)}ms`);
    }
  }, [date, setDate, view, isMobile, performanceTracker]);

  const swipeHandlers = useSwipeGesture(handleSwipeLeft, handleSwipeRight);

  // Modal state
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [selectedSchedule, setSelectedSchedule] = useState<Schedule | null>(null);

  // Enhanced event handlers matching original ScheduleView functionality
  const handleDateSelect = useCallback((date: Date) => {
    // Add haptic feedback for mobile
    if (isMobile && 'vibrate' in navigator) {
      navigator.vibrate(40);
    }

    console.log('Date selected:', date);
    setSelectedDate(date);
    setCreateModalOpen(true);
  }, [isMobile]);

  const handleEditSchedule = useCallback((event: CalendarEvent) => {
    console.log('Edit schedule:', event);
    setSelectedSchedule(event.resource);
    setEditModalOpen(true);
  }, []);

  const handleScheduleClick = useCallback((schedule: Schedule) => {
    console.log('Schedule clicked:', schedule);
    setSelectedSchedule(schedule);
    setEditModalOpen(true);
  }, []);




  // Data fetching is now handled by parent App component

  // Week view handlers
  const handleShowMoreClick = useCallback((clickedDate: Date) => {
    setClickedDay(clickedDate);
    setShowWeekView(true);
    setView('week'); // Update main view state for AppHeader
  }, [setView]);

  const handleReturnToMonth = useCallback(() => {
    setShowWeekView(false);
    setClickedDay(undefined);
    setView('month'); // Update main view state for AppHeader
  }, [setView]);

  const handleWeekViewDateChange = useCallback((newDate: Date) => {
    setDate(newDate);
    // Clear clicked day when navigating to new week
    setClickedDay(undefined);
  }, [setDate]);

  const handleScheduleUpdate = useCallback((updatedSchedules: Schedule[]) => {
    // Optimistic update or just refetch
    onRefreshData();
  }, [onRefreshData]);

  // Optimized analyst lookup with Map for O(1) performance
  const analystMap = useMemo(() => {
    const map = new Map();
    analysts.forEach(analyst => {
      map.set(analyst.id, analyst.name);
    });
    return map;
  }, [analysts]);

  // Enhanced getAnalystName with Map lookup
  const getAnalystName = useCallback((analystId: string) => {
    return analystMap.get(analystId) || 'Unknown Analyst';
  }, [analystMap]);

  // Optimized event transformation with memoization using filtered schedules
  const calendarEvents = useMemo(() => {
    const transformStart = performance.now();
    const events: CalendarEvent[] = [];

    // Use filtered schedules instead of all schedules
    const validSchedules = filteredSchedules.filter((schedule: Schedule) => schedule.date);

    validSchedules.forEach((schedule: Schedule) => {
      const scheduleDateUtc = moment.utc(schedule.date);
      const dateString = scheduleDateUtc.format('YYYY-MM-DD');

      events.push({
        id: schedule.id,
        title: getAnalystName(schedule.analystId),
        date: dateString,
        resource: schedule
      });
    });

    const transformTime = performance.now() - transformStart;
    console.log(`🔄 Event Transform Performance: ${transformTime.toFixed(2)}ms (${events.length} events)`);

    return events;
  }, [filteredSchedules, getAnalystName]);


  // Loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-gray-700 dark:text-gray-200">Loading schedule...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="text-red-500 mb-4">
            <ExclamationCircleIcon className="w-12 h-12 mx-auto" />
          </div>
          <p className="text-destructive mb-4">{error}</p>
          <button
            onClick={onRefreshData}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  // Show week view if enabled
  if (showWeekView) {
    return (
      <>
        <WeekScheduleView
          date={date}
          timezone={timezone}
          onDateChange={handleWeekViewDateChange}
          onReturnToMonth={handleReturnToMonth}
          clickedDay={clickedDay}
          events={calendarEvents}
          analysts={analysts}
          onScheduleUpdate={handleScheduleUpdate}
          onScheduleClick={handleScheduleClick}
        />
        <CreateScheduleModal
          isOpen={createModalOpen}
          onClose={() => setCreateModalOpen(false)}
          onSuccess={() => {
            onRefreshData();
            onSuccess?.('Schedule updated successfully');
          }}
          initialDate={selectedDate}
          analysts={analysts}
        />
        <EditScheduleModal
          isOpen={editModalOpen}
          onClose={() => setEditModalOpen(false)}
          onSuccess={() => {
            onRefreshData();
            onSuccess?.('Schedule updated successfully');
          }}
          schedule={selectedSchedule}
          analysts={analysts}
        />
      </>
    );
  }

  return (
    <div
      className={`relative h-full text-foreground transition-colors duration-200 ${theme} z-10`}
      {...(isMobile ? swipeHandlers : {})}
      role="application"
      aria-label="ShiftPlanner Simplified Schedule Calendar"
    >
      {/* Filter toggle removed - moved to View Settings */}

      {/* Calendar Container - Adjust margin when filter panel is open */}
      <div className={`h-full p-4 transition-all duration-300 ${filters.isOpen ? 'mr-80' : ''}`}>
        {/* Screen reader announcements */}
        <div
          id="calendar-announcements"
          className="sr-only"
          aria-live="polite"
          aria-atomic="true"
        >
          {`Viewing ${view} calendar for ${moment(date).format('MMMM yyyy')}. ${calendarEvents.length} scheduled shifts found.${filterHook.activeFilterCount > 0 ? ` ${filterHook.activeFilterCount} filters active.` : ''}`}
        </div>

        {/* Calendar Content based on view */}
        <main role="main" aria-label="Calendar content">
          {view === 'month' && (
            <CalendarGrid
              date={date}
              timezone={timezone}
              events={calendarEvents}
              isMobile={isMobile}
              onDateSelect={handleDateSelect}
              onShowMoreClick={handleShowMoreClick}
              onEventSelect={handleEditSchedule}
            />
          )}
        </main>

        {/* Week/Day views - Phase 2.2 implementation */}
        {view !== 'month' && (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <div className="text-gray-700 dark:text-gray-200 mb-4">
                <CalendarDaysIcon className="w-16 h-16 mx-auto" />
              </div>
              <h3 className="text-lg font-medium mb-2">{view.charAt(0).toUpperCase() + view.slice(1)} View</h3>
              <p className="text-gray-700 dark:text-gray-200 mb-4">Coming in Phase 2.2 - Enhanced Views</p>
              <button
                onClick={() => setView('month')}
                className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors touch-manipulation min-h-[44px]"
              >
                Return to Month View
              </button>
            </div>
          </div>
        )}

        {/* Mobile swipe indicator */}
        {isMobile && view === 'month' && (
          <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 text-xs text-gray-700 dark:text-gray-200 bg-muted/80 px-3 py-1 rounded-full backdrop-blur-sm">
            ← Swipe to navigate →
          </div>
        )}

      </div>

      {/* Filter Panel */}
      {filters.isOpen && (
        <CalendarFilterPanel
          filterHook={filterHook}
          onClose={() => toggleSidebar()}
          className="animate-slide-in-right"
        />
      )}

      {/* CRUD Modals */}
      <CreateScheduleModal
        isOpen={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        onSuccess={() => {
          onRefreshData();
          onSuccess?.('Schedule updated successfully');
        }}
        initialDate={selectedDate}
        analysts={analysts}
      />
      <EditScheduleModal
        isOpen={editModalOpen}
        onClose={() => setEditModalOpen(false)}
        onSuccess={() => {
          onRefreshData();
          onSuccess?.('Schedule updated successfully');
        }}
        schedule={selectedSchedule}
        analysts={analysts}
      />

    </div>
  );
});

// Add display name for debugging
ScheduleCalendar.displayName = 'ScheduleCalendar';

export default ScheduleCalendar;