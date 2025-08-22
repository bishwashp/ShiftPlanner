import React, { useState, useMemo, useCallback, useEffect } from 'react';
import moment from 'moment-timezone';
import { apiService, Schedule, Analyst } from '../../../services/api';
import { View as AppView } from '../../layout/CollapsibleSidebar';
import { useTheme } from 'react18-themes';
import { notificationService } from '../../../services/notificationService';

// Simplified calendar imports
import { CalendarGrid } from './CalendarGrid';
import { CalendarHeader } from './CalendarHeader';

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

const SimplifiedScheduleView: React.FC<SimplifiedScheduleViewProps> = ({
  onViewChange,
  date,
  setDate,
  view,
  setView,
  timezone,
  onError,
  onSuccess,
  isLoading
}) => {
  const { theme } = useTheme();
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [analysts, setAnalysts] = useState<Analyst[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  
  // Mobile detection
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Date range calculation
  const { startDate, endDate } = useMemo(() => {
    const localDate = moment(date).tz(timezone);
    const start = localDate.clone().startOf('month').format('YYYY-MM-DD');
    const end = localDate.clone().endOf('month').format('YYYY-MM-DD');
    
    return { startDate: start, endDate: end };
  }, [date, timezone]);

  // Gesture handlers for mobile navigation
  const handleSwipeLeft = useCallback(() => {
    if (isMobile && view === 'month') {
      const nextMonth = moment(date).add(1, 'month').toDate();
      setDate(nextMonth);
      
      if ('vibrate' in navigator) {
        navigator.vibrate(50);
      }
    }
  }, [date, setDate, view, isMobile]);

  const handleSwipeRight = useCallback(() => {
    if (isMobile && view === 'month') {
      const prevMonth = moment(date).subtract(1, 'month').toDate();
      setDate(prevMonth);
      
      if ('vibrate' in navigator) {
        navigator.vibrate(50);
      }
    }
  }, [date, setDate, view, isMobile]);

  const swipeHandlers = useSwipeGesture(handleSwipeLeft, handleSwipeRight);

  // Enhanced event handlers matching original ScheduleView functionality
  const handleEventSelect = useCallback((event: CalendarEvent) => {
    // Add haptic feedback for mobile
    if (isMobile && 'vibrate' in navigator) {
      navigator.vibrate(30);
    }
    
    console.log('Event selected:', event.title, event.resource);
    
    // Add notification with event details
    notificationService.addNotification({
      type: 'schedule',
      priority: 'low',
      title: 'Schedule Selected',
      message: `${event.title} - ${event.resource.shiftType}${event.resource.isScreener ? ' (Screener)' : ''}`,
      isActionable: true,
      action: {
        label: 'View Details',
        callback: () => {
          console.log('Show event details for:', event);
          // Future: Open event details modal
        }
      }
    });
  }, [isMobile]);

  const handleDateSelect = useCallback((date: Date) => {
    // Add haptic feedback for mobile
    if (isMobile && 'vibrate' in navigator) {
      navigator.vibrate(40);
    }
    
    console.log('Date selected:', date);
    
    // Add actionable notification for schedule creation opportunity
    const dateString = moment(date).format('MMMM D, YYYY');
    notificationService.addNotification({
      type: 'schedule',
      priority: 'medium',
      title: 'Schedule Slot Available',
      message: `Selected ${dateString} - Create new schedule?`,
      isActionable: true,
      action: {
        label: 'Create Schedule',
        callback: () => {
          console.log('Create schedule for date:', date);
          // Future: Open schedule creation modal
        }
      }
    });
  }, [isMobile]);

  // Data fetching (same logic as original)
  const fetchSchedulesAndAnalysts = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      const [schedulesData, analystsData] = await Promise.all([
        apiService.getSchedules(startDate, endDate),
        apiService.getAnalysts()
      ]);
      
      setSchedules(schedulesData);
      setAnalysts(analystsData.filter(a => a.isActive));
      
    } catch (err) {
      console.error('Error fetching data:', err);
      const errorMessage = 'Failed to load schedule data. Please try again.';
      setError(errorMessage);
      if (onError) onError(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate, onError]);

  useEffect(() => {
    fetchSchedulesAndAnalysts();
  }, [fetchSchedulesAndAnalysts]);

  // Get analyst name helper
  const getAnalystName = useCallback((analystId: string) => {
    const analyst = analysts.find(a => a.id === analystId);
    return analyst ? analyst.name : 'Unknown Analyst';
  }, [analysts]);

  // Transform schedules to simplified calendar events
  const calendarEvents = useMemo(() => {
    const events: CalendarEvent[] = [];

    schedules.forEach(schedule => {
      if (!schedule.date) return;

      const scheduleDateUtc = moment.utc(schedule.date);
      const dateString = scheduleDateUtc.format('YYYY-MM-DD');
      
      events.push({
        id: schedule.id,
        title: getAnalystName(schedule.analystId),
        date: dateString,
        resource: schedule
      });
    });

    return events;
  }, [schedules, getAnalystName]);

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

  return (
    <div
      className={`relative h-full p-4 bg-background text-foreground transition-colors duration-200 ${theme}`}
      {...(isMobile ? swipeHandlers : {})}
    >
      {/* Calendar Header with Navigation */}
      <CalendarHeader
        date={date}
        setDate={setDate}
        view={view}
        setView={setView}
        timezone={timezone}
        isMobile={isMobile}
      />

      {/* Calendar Content based on view */}
      {view === 'month' && (
        <CalendarGrid
          date={date}
          timezone={timezone}
          events={calendarEvents}
          isMobile={isMobile}
          onEventSelect={handleEventSelect}
          onDateSelect={handleDateSelect}
        />
      )}

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

      {/* Feature flag indicator */}
      <div className="absolute top-4 right-4">
        <div className="inline-flex items-center gap-2 px-2 py-1 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded text-xs font-medium">
          <span>✅ Phase 2.2</span>
        </div>
      </div>
    </div>
  );
};

export default SimplifiedScheduleView;