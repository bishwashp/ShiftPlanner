import React, { useState, useMemo, useCallback, useEffect, memo } from 'react';
import moment from 'moment-timezone';
import { apiService, Schedule, Analyst } from '../../../services/api';
import { View as AppView } from '../../layout/CollapsibleSidebar';
import { useTheme } from 'react18-themes';
import { notificationService } from '../../../services/notificationService';
import { Filter } from 'lucide-react';
import ScheduleGenerationForm from '../../ScheduleGenerationForm';
import ScheduleGenerationModal from '../../ScheduleGenerationModal';

// Simplified calendar imports
import { CalendarGrid } from './CalendarGrid';
import WeekScheduleView from './WeekScheduleView';
import CalendarFilterPanel from '../filtering/CalendarFilterPanel';
import { useCalendarFilters } from '../../../hooks/useCalendarFilters';

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
  onGenerateSchedule?: () => void;
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

const SimplifiedScheduleView: React.FC<SimplifiedScheduleViewProps> = memo(({
  onViewChange,
  date,
  setDate,
  view,
  setView,
  timezone,
  onError,
  onSuccess,
  isLoading,
  onGenerateSchedule
}) => {
  const { theme } = useTheme();
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [analysts, setAnalysts] = useState<Analyst[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  
  // Schedule generation state
  const [showGenerationForm, setShowGenerationForm] = useState(false);
  const [showGenerationModal, setShowGenerationModal] = useState(false);
  const [generatedSchedules, setGeneratedSchedules] = useState<any[]>([]);
  const [generationSummary, setGenerationSummary] = useState<any>(null);
  const [isGenerating, setIsGenerating] = useState(false);

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

  // Initialize filtering system
  const filterHook = useCalendarFilters(schedules, analysts);
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

  // Enhanced event handlers matching original ScheduleView functionality
  // Removed handleEventSelect - schedule selection not needed

  const handleDateSelect = useCallback((date: Date) => {
    // Add haptic feedback for mobile
    if (isMobile && 'vibrate' in navigator) {
      navigator.vibrate(40);
    }
    
    console.log('Date selected:', date);
    
    // Add actionable notification for schedule creation opportunity
    const dateString = moment(date).format('MMMM D, YYYY');
    notificationService.addRecommendationNotification(
      'Schedule Slot Available',
      `Selected ${dateString} - Create new schedule?`,
      { category: 'scheduling', tags: ['creation-opportunity'] }
    );
  }, [isMobile]);

  // Schedule generation handlers - will be triggered by onGenerateSchedule prop
  const triggerGenerateSchedule = useCallback(() => {
    setShowGenerationForm(true);
  }, []);

  // Expose the trigger function to parent via ref or callback
  useEffect(() => {
    if (onGenerateSchedule) {
      // Store the trigger function so parent can call it
      (window as any).triggerScheduleGeneration = triggerGenerateSchedule;
    }
  }, [onGenerateSchedule, triggerGenerateSchedule]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const handleGenerateSchedules = useCallback(async (startDate: string, endDate: string, algorithm: string) => {
    setIsGenerating(true);
    try {
      const result = await apiService.generateSchedulePreview({
        startDate,
        endDate,
        algorithmType: algorithm
      });
      
      setGeneratedSchedules(result.proposedSchedules);
      setGenerationSummary({
        totalConflicts: result.conflicts.length,
        criticalConflicts: result.conflicts.filter(c => c.type === 'CRITICAL').length,
        assignmentsNeeded: result.proposedSchedules.length,
        estimatedTime: 'Generated'
      });
      setShowGenerationForm(false);
      setShowGenerationModal(true);
      
      onSuccess?.(`Generated ${result.proposedSchedules.length} schedule assignments`);
    } catch (err) {
      console.error('Error generating schedules:', err);
      onError?.('Failed to generate schedules. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Enhanced data fetching with performance monitoring
  const fetchSchedulesAndAnalysts = useCallback(async () => {
    const fetchStart = performance.now();
    
    try {
      setLoading(true);
      setError(null);
      
      const [schedulesData, analystsData] = await Promise.all([
        apiService.getSchedules(startDate, endDate),
        apiService.getAnalysts()
      ]);
      
      // Filter active analysts (performance optimization)
      const activeAnalysts = analystsData.filter(a => a.isActive);
      
      setSchedules(schedulesData);
      setAnalysts(activeAnalysts);
      
      // Track performance metrics
      const fetchTime = performance.now() - fetchStart;
      
      console.log('📊 Data Fetch Performance:', {
        fetchTime: `${fetchTime.toFixed(2)}ms`,
        scheduleCount: schedulesData.length,
        analystCount: activeAnalysts.length,
        memoryMB: `${((performance as any).memory?.usedJSHeapSize / 1024 / 1024 || 0).toFixed(2)}MB`
      });
      
    } catch (err) {
      console.error('Error fetching data:', err);
      const errorMessage = 'Failed to load schedule data. Please try again.';
      setError(errorMessage);
      // Call onError directly without including it in dependencies
      onError?.(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate, onError]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const handleApplySchedules = useCallback(async (schedulesToApply: any[]) => {
    try {
      console.log('Applying schedules:', schedulesToApply);
      
      // Transform the schedules to the format expected by the API
      const assignments = schedulesToApply.map(schedule => ({
        date: schedule.date,
        analystId: schedule.analystId,
        shiftType: schedule.shiftType,
        isScreener: schedule.isScreener
      }));
      
      // Call the API to apply the schedules
      const result = await apiService.applyAutoFix({ assignments });
      
      console.log('Schedules applied successfully:', result);
      
      // Refresh the data to show the new schedules
      await fetchSchedulesAndAnalysts();
      
      setShowGenerationModal(false);
      
      // Handle success message with details
      const successCount = result.createdSchedules?.length || 0;
      const errorCount = result.errors?.length || 0;
      
      if (errorCount > 0) {
        onSuccess?.(`Applied ${successCount} schedules successfully, ${errorCount} failed. Check console for details.`);
        console.warn('Some schedules failed to apply:', result.errors);
      } else {
        onSuccess?.(`Successfully applied ${successCount} schedules to the calendar`);
      }
    } catch (err) {
      console.error('Error applying schedules:', err);
      onError?.('Failed to apply schedules. Please try again.');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    fetchSchedulesAndAnalysts();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startDate, endDate]); // Only refetch when date range changes, not when function changes

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
    setSchedules(updatedSchedules);
    // No need to refetch - we already have the updated data
  }, []);

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
    const validSchedules = filteredSchedules.filter(schedule => schedule.date);
    
    validSchedules.forEach(schedule => {
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
          <p className="text-muted-foreground">Loading schedule...</p>
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
            <svg className="w-12 h-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <p className="text-destructive mb-4">{error}</p>
          <button 
            onClick={fetchSchedulesAndAnalysts}
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
      <WeekScheduleView
        date={date}
        timezone={timezone}
        onDateChange={handleWeekViewDateChange}
        onReturnToMonth={handleReturnToMonth}
        clickedDay={clickedDay}
        events={calendarEvents}
        analysts={analysts}
        onScheduleUpdate={handleScheduleUpdate}
      />
    );
  }

  return (
    <div
      className={`relative h-full bg-background text-foreground transition-colors duration-200 ${theme}`}
      {...(isMobile ? swipeHandlers : {})}
      role="application"
      aria-label="ShiftPlanner Simplified Schedule Calendar"
    >
      {/* Filter Toggle Button - Fixed position */}
      <div className="absolute top-4 right-4 z-40">
        <button
          onClick={toggleSidebar}
          className={`px-4 py-2 text-sm font-medium border rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-lg ${
            filters.isOpen
              ? 'bg-blue-600 text-white border-blue-600 hover:bg-blue-700'
              : 'text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700'
          }`}
          aria-label={filters.isOpen ? 'Close filters' : 'Open filters'}
          aria-pressed={filters.isOpen}
        >
          <Filter className="h-4 w-4 mr-2 inline-block" />
          Filters
          {filterHook.activeFilterCount > 0 && (
            <span className="ml-2 bg-white/20 text-xs px-1.5 py-0.5 rounded-full">
              {filterHook.activeFilterCount}
            </span>
          )}
        </button>
      </div>

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
          />
        )}
      </main>

      {/* Week/Day views - Phase 2.2 implementation */}
      {view !== 'month' && (
        <div className="flex items-center justify-center h-full">
          <div className="text-center">
            <div className="text-muted-foreground mb-4">
              <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <h3 className="text-lg font-medium mb-2">{view.charAt(0).toUpperCase() + view.slice(1)} View</h3>
            <p className="text-muted-foreground mb-4">Coming in Phase 2.2 - Enhanced Views</p>
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
        <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 text-xs text-muted-foreground bg-muted/80 px-3 py-1 rounded-full backdrop-blur-sm">
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

      {/* Schedule Generation Form */}
      {showGenerationForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-background border border-border rounded-lg shadow-xl max-w-2xl w-full">
            <div className="p-6">
              <ScheduleGenerationForm
                onGenerate={handleGenerateSchedules}
                isLoading={isGenerating}
              />
            </div>
            <div className="flex justify-end p-6 border-t border-border">
              <button
                onClick={() => setShowGenerationForm(false)}
                className="px-4 py-2 border border-border rounded-md hover:bg-muted transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Schedule Generation Modal */}
      <ScheduleGenerationModal
        isOpen={showGenerationModal}
        onClose={() => setShowGenerationModal(false)}
        onApply={handleApplySchedules}
        generatedSchedules={generatedSchedules}
        summary={generationSummary || {
          totalConflicts: 0,
          criticalConflicts: 0,
          assignmentsNeeded: 0,
          estimatedTime: '0ms'
        }}
        isLoading={isGenerating}
      />

    </div>
  );
});

// Add display name for debugging
SimplifiedScheduleView.displayName = 'SimplifiedScheduleView';

export default SimplifiedScheduleView;