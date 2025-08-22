import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { Calendar, momentLocalizer, View as BigCalendarView } from 'react-big-calendar';
import moment from 'moment-timezone';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import { apiService, Schedule, Analyst } from '../services/api';
import { View as AppView } from './layout/CollapsibleSidebar';
import { useTheme } from 'react18-themes';
import { PremiumEventCard } from './ui/PremiumEventCard';
import { notificationService } from '../services/notificationService';
import './ScheduleView.css';

const localizer = momentLocalizer(moment);

interface CalendarEvent {
  title: string;
  start: Date;
  end: Date;
  allDay: boolean;
  resource: any;
}

interface ScheduleViewProps {
  onViewChange: (view: AppView) => void;
  date: Date;
  setDate: (date: Date) => void;
  view: BigCalendarView;
  setView: (view: BigCalendarView) => void;
  timezone: string;
  onError?: (error: string) => void;
  onSuccess?: (message: string) => void;
  isLoading?: (loading: boolean) => void;
}

// Mobile gesture detection hook
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
    
    // Only trigger swipe if horizontal distance is greater than vertical (horizontal swipe)
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

// Premium event component for standard calendar views
const PremiumStandardEvent = ({ event }: { event: CalendarEvent }) => (
  <PremiumEventCard
    title={event.title}
    shiftType={event.resource.shiftType}
    isScreener={event.resource.isScreener}
    analystName={event.title}
    variant="standard"
    className="w-full h-full min-h-[2rem]"
  />
);

// Premium rotated event for week view
const PremiumRotatedEvent = ({ event }: { event: CalendarEvent }) => (
  <PremiumEventCard
    title={event.title}
    shiftType={event.resource.shiftType}
    isScreener={event.resource.isScreener}
    analystName={event.title}
    variant="rotated"
    className="w-full h-full min-h-[4rem]"
  />
);

const ScheduleView: React.FC<ScheduleViewProps> = ({
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

  // Gesture handlers for mobile navigation
  const handleSwipeLeft = useCallback(() => {
    if (isMobile && view === 'month') {
      const nextMonth = moment(date).add(1, 'month').toDate();
      setDate(nextMonth);
      
      // Add haptic feedback if available
      if ('vibrate' in navigator) {
        navigator.vibrate(50);
      }
    }
  }, [date, setDate, view, isMobile]);

  const handleSwipeRight = useCallback(() => {
    if (isMobile && view === 'month') {
      const prevMonth = moment(date).subtract(1, 'month').toDate();
      setDate(prevMonth);
      
      // Add haptic feedback if available
      if ('vibrate' in navigator) {
        navigator.vibrate(50);
      }
    }
  }, [date, setDate, view, isMobile]);

  // Swipe gesture handlers
  const swipeHandlers = useSwipeGesture(handleSwipeLeft, handleSwipeRight);

  const { startDate, endDate } = useMemo(() => {
    // Use local timezone for date range calculation (user's perspective)
    // But ensure we get the correct month boundaries in their timezone
    const localDate = moment(date).tz(timezone);
    const start = localDate.clone().startOf('month').format('YYYY-MM-DD');
    const end = localDate.clone().endOf('month').format('YYYY-MM-DD');
    
    return { startDate: start, endDate: end };
  }, [date, timezone]);

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
      
      // No toast spam - successful data loads are not actionable
    } catch (err) {
      console.error('Error fetching data:', err);
      const errorMessage = 'Failed to load schedule data. Please try again.';
      setError(errorMessage);
      if (onError) onError(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate, onError, onSuccess]);

  useEffect(() => {
    fetchSchedulesAndAnalysts();
  }, [fetchSchedulesAndAnalysts]);

  const getAnalystName = useCallback((analystId: string) => {
    const analyst = analysts.find(a => a.id === analystId);
    return analyst ? analyst.name : 'Unknown Analyst';
  }, [analysts]);

  const calendarEvents = useMemo(() => {
    const allEvents: CalendarEvent[] = [];

    schedules.forEach(schedule => {
      if (!schedule.date) {
        console.warn('⚠️ Schedule without date:', schedule);
        return;
      }

      // Schedule dates are stored as UTC, but represent "midnight local time on this date"
      // We need to extract the date part and create local midnight
      const scheduleDateUtc = moment.utc(schedule.date);
      const dateString = scheduleDateUtc.format('YYYY-MM-DD'); // Get just the date part
      
      // Create local midnight for this date
      const startLocal = moment.tz(dateString, 'YYYY-MM-DD', timezone);
      const endLocal = startLocal.clone().add(9, 'hours');

      const title = getAnalystName(schedule.analystId);
      
      const baseEvent = {
        title: title,
        allDay: false,
        resource: schedule,
      };

      // Use local timezone dates for calendar display
      allEvents.push({
        ...baseEvent,
        start: startLocal.toDate(),
        end: endLocal.toDate(),
      });
    });

    return allEvents;
  }, [schedules, getAnalystName, timezone]);
  
  const eventPropGetter = useCallback((event: CalendarEvent) => {
    const baseClass = `event-custom ${event.resource.shiftType.toLowerCase()}`;
    const newProps: React.HTMLAttributes<HTMLDivElement> = {
      className: baseClass,
      style: {
        cursor: 'pointer',
        transition: 'all 0.2s ease',
      }
    };
    
    if (event.resource.isScreener) {
      newProps.className += ' event-screener';
    }
    
    return newProps;
  }, []);

  // Enhanced event handlers with mobile feedback
  const handleEventSelect = useCallback((event: CalendarEvent) => {
    // Add haptic feedback for mobile
    if (isMobile && 'vibrate' in navigator) {
      navigator.vibrate(30);
    }
    
    // Could open a modal or sidebar with event details
    console.log('Event selected:', event.title);
  }, [isMobile]);

  // Note: handleEventDrop and handleEventResize are currently disabled for premium UI
  // These will be re-implemented in Week 2 with enhanced UX

  const handleSelectSlot = useCallback((slotInfo: any) => {
    // Add haptic feedback for mobile
    if (isMobile && 'vibrate' in navigator) {
      navigator.vibrate(40);
    }
    
    // Could open a modal to create a new schedule
    console.log('Selected slot:', slotInfo);
    
    // Add actionable notification for schedule creation opportunity
    notificationService.addNotification({
      type: 'schedule',
      priority: 'medium',
      title: 'Schedule Slot Available',
      message: `Selected ${new Date(slotInfo.start).toLocaleDateString()} - Create new schedule?`,
      isActionable: true,
      action: {
        label: 'Create Schedule',
        callback: () => {
          // Future: Open schedule creation modal
          console.log('Create schedule for slot:', slotInfo);
        }
      }
    });
  }, [isMobile]);

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
      <Calendar
        localizer={localizer}
        events={calendarEvents}
        startAccessor="start"
        endAccessor="end"
        allDayAccessor="allDay"
        views={['month', 'week', 'day']}
        view={view}
        date={date}
        onView={setView}
        onNavigate={setDate}
        eventPropGetter={eventPropGetter}
        onSelectEvent={handleEventSelect}
        onSelectSlot={handleSelectSlot}
        selectable={true}
        formats={{
          eventTimeRangeFormat: () => '',
        }}
        components={{
          toolbar: () => null,
          month: { event: PremiumStandardEvent },
          day: { event: PremiumStandardEvent },
          week: { event: PremiumRotatedEvent },
        }}
        className="rbc-calendar"
        dayLayoutAlgorithm="no-overlap"
        popup={!isMobile} // Disable popup on mobile for better touch experience
        tooltipAccessor={(event) => `${event.title} - ${event.resource.shiftType}${event.resource.isScreener ? ' (Screener)' : ''}`}
      />
      
      {/* Enhanced quick actions floating button with mobile optimization */}
      <div className={`fixed z-40 ${isMobile ? 'bottom-4 right-4' : 'bottom-6 right-6'}`}>
        <button
          onClick={() => {
            // Add haptic feedback for mobile
            if (isMobile && 'vibrate' in navigator) {
              navigator.vibrate(50);
            }
            
            // Add actionable notification for quick actions
            notificationService.addNotification({
              type: 'system',
              priority: 'low',
              title: 'Quick Actions',
              message: 'Enhanced quick actions panel coming in next update!',
              isActionable: false,
            });
          }}
          className={`${isMobile ? 'w-12 h-12' : 'w-14 h-14'} bg-primary text-primary-foreground rounded-full shadow-lg hover:bg-primary/90 transition-all duration-200 flex items-center justify-center active:scale-95 touch-manipulation`}
          title="Quick Actions"
          style={{ minHeight: '44px', minWidth: '44px' }}
        >
          <svg className={`${isMobile ? 'w-5 h-5' : 'w-6 h-6'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
          </svg>
        </button>
      </div>
      
      {/* Mobile swipe indicator */}
      {isMobile && view === 'month' && (
        <div className="absolute bottom-16 left-1/2 transform -translate-x-1/2 text-xs text-muted-foreground bg-muted/80 px-3 py-1 rounded-full backdrop-blur-sm">
          ← Swipe to navigate →
        </div>
      )}
    </div>
  );
};

export default ScheduleView;