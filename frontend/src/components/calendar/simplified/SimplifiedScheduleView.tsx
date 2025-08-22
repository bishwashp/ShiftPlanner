import React, { useState, useMemo, useCallback, useEffect } from 'react';
import moment from 'moment-timezone';
import { apiService, Schedule, Analyst } from '../../../services/api';
import { View as AppView } from '../../layout/CollapsibleSidebar';
import { useTheme } from 'react18-themes';
import { notificationService } from '../../../services/notificationService';

// Simplified calendar imports
import { CalendarGrid } from './CalendarGrid';
import { NameBox } from './NameBox';

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
      {/* Simplified Calendar Header */}
      <div className="mb-4 text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1 bg-muted/50 rounded-lg">
          <span className="text-xs font-medium text-muted-foreground">SIMPLIFIED CALENDAR</span>
          <span className="inline-flex h-2 w-2 bg-green-500 rounded-full animate-pulse" title="Active Development"></span>
        </div>
      </div>

      {/* Month View Only (simplified) */}
      {view === 'month' && (
        <CalendarGrid
          date={date}
          timezone={timezone}
          events={calendarEvents}
          isMobile={isMobile}
        />
      )}

      {/* Week/Day views - placeholder for Phase 2 */}
      {view !== 'month' && (
        <div className="flex items-center justify-center h-full">
          <div className="text-center">
            <div className="text-muted-foreground mb-4">
              <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
              </svg>
            </div>
            <h3 className="text-lg font-medium mb-2">Week/Day Views</h3>
            <p className="text-muted-foreground mb-4">Coming in Phase 2</p>
            <button
              onClick={() => setView('month')}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
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
          <span>🚧 Phase 1.1</span>
        </div>
      </div>
    </div>
  );
};

export default SimplifiedScheduleView;