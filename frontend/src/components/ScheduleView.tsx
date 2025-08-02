import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { Calendar, momentLocalizer, View as BigCalendarView } from 'react-big-calendar';
import moment from 'moment-timezone';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import { apiService, Schedule, Analyst } from '../services/api';
import { View as AppView } from './layout/CollapsibleSidebar';
import { useTheme } from 'react18-themes';
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

// Enhanced event component with better visual feedback
const StandardEvent = ({ event }: { event: CalendarEvent }) => (
  <div className="event-content">
    <span className="event-title">{event.title}</span>
    {event.resource.isScreener && (
      <span className="event-badge">S</span>
    )}
  </div>
);

// Enhanced rotated event for week view
const RotatedEvent = ({ event }: { event: CalendarEvent }) => (
  <div className="rotated-event-content">
    <span className="event-title">{event.title}</span>
    {event.resource.isScreener && (
      <span className="event-badge">S</span>
    )}
  </div>
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
  const [isDragging, setIsDragging] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);

  const { startDate, endDate } = useMemo(() => {
    // Use local timezone for date range calculation (user's perspective)
    // But ensure we get the correct month boundaries in their timezone
    const localDate = moment(date).tz(timezone);
    const start = localDate.clone().startOf('month').format('YYYY-MM-DD');
    const end = localDate.clone().endOf('month').format('YYYY-MM-DD');
    
    return { startDate: start, endDate: end };
  }, [date, view, timezone]);

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
      
      if (onSuccess) onSuccess('Schedule data loaded successfully');
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
    
    if (isDragging) {
      if (newProps.style) {
        newProps.style.opacity = '0.7';
      }
    }
    
    return newProps;
  }, [isDragging]);

  // Enhanced event handlers
  const handleEventSelect = useCallback((event: CalendarEvent) => {
    setSelectedEvent(event);
    // Could open a modal or sidebar with event details
    if (onSuccess) onSuccess(`Selected: ${event.title}`);
  }, [onSuccess]);

  const handleEventDrop = useCallback(async (event: CalendarEvent, start: Date, end: Date) => {
    try {
      setIsDragging(true);
      
      // Convert back to UTC for API
      const newStartUtc = moment(start).tz(timezone).utc().format();
      
      // Update the schedule
      await apiService.updateSchedule(event.resource.id, {
        date: newStartUtc,
        analystId: event.resource.analystId,
        shiftType: event.resource.shiftType,
        isScreener: event.resource.isScreener
      });
      
      // Refresh data
      await fetchSchedulesAndAnalysts();
      
      if (onSuccess) onSuccess('Schedule updated successfully');
    } catch (err) {
      console.error('Error updating schedule:', err);
      if (onError) onError('Failed to update schedule');
    } finally {
      setIsDragging(false);
    }
  }, [timezone, onError, onSuccess, fetchSchedulesAndAnalysts]);

  const handleEventResize = useCallback(async (event: CalendarEvent, start: Date, end: Date) => {
    try {
      
      // Convert back to UTC for API
      const newStartUtc = moment(start).tz(timezone).utc().format();
      
      await apiService.updateSchedule(event.resource.id, {
        date: newStartUtc,
        analystId: event.resource.analystId,
        shiftType: event.resource.shiftType,
        isScreener: event.resource.isScreener
      });
      
      await fetchSchedulesAndAnalysts();
      
      if (onSuccess) onSuccess('Schedule updated successfully');
    } catch (err) {
      console.error('Error updating schedule:', err);
      if (onError) onError('Failed to update schedule');
    } finally {
    }
  }, [timezone, onError, onSuccess, fetchSchedulesAndAnalysts]);

  const handleSelectSlot = useCallback((slotInfo: any) => {
    // Could open a modal to create a new schedule
    console.log('Selected slot:', slotInfo);
    if (onSuccess) onSuccess('Slot selected - create new schedule feature coming soon');
  }, [onSuccess]);

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
    <div className={`relative h-full p-4 bg-background text-foreground transition-colors duration-200 ${theme}`}>
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
          month: { event: StandardEvent },
          day: { event: StandardEvent },
          week: { event: RotatedEvent },
        }}
        className="rbc-calendar"
        dayLayoutAlgorithm="no-overlap"
        popup={true}
        tooltipAccessor={(event) => `${event.title} - ${event.resource.shiftType}${event.resource.isScreener ? ' (Screener)' : ''}`}
      />
      
      {/* Quick actions floating button */}
      <div className="fixed bottom-6 right-6 z-40">
        <button
          onClick={() => onSuccess?.('Quick actions coming soon')}
          className="w-14 h-14 bg-primary text-primary-foreground rounded-full shadow-lg hover:bg-primary/90 transition-all duration-200 flex items-center justify-center"
          title="Quick Actions"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
          </svg>
        </button>
      </div>
    </div>
  );
};

export default ScheduleView;