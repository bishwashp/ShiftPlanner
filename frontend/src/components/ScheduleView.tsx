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

// Custom component for standard events (Month, Day)
const StandardEvent = ({ event }: { event: CalendarEvent }) => (
  <span>{event.title}</span>
);

// New, dedicated component for rotating text in the Week view
const RotatedEvent = ({ event }: { event: CalendarEvent }) => (
  <div className="rotated-event-content">
    {event.title}
  </div>
);

interface ScheduleViewProps {
  onViewChange: (view: AppView) => void;
  date: Date;
  setDate: (date: Date) => void;
  view: BigCalendarView;
  setView: (view: BigCalendarView) => void;
  timezone: string;
}

const ScheduleView: React.FC<ScheduleViewProps> = ({
  onViewChange,
  date,
  setDate,
  view,
  setView,
  timezone
 }) => {
  const { theme } = useTheme();
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [analysts, setAnalysts] = useState<Analyst[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { startDate, endDate } = useMemo(() => {
    const start = moment(date).startOf(view as moment.unitOfTime.StartOf).utc().format();
    const end = moment(date).endOf(view as moment.unitOfTime.StartOf).utc().format();
    return { startDate: start, endDate: end };
  }, [date, view]);

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
      setError('Failed to load schedule data. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate]);

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
      if (!schedule.date) return;

      const startUtc = moment.utc(schedule.date);
      const endUtc = startUtc.clone().add(9, 'hours');
      
      const startDisplay = startUtc.tz(timezone);
      const endDisplay = endUtc.tz(timezone);

      // This title will be consistent for both parts of a split event
      const title = getAnalystName(schedule.analystId);
      
      const baseEvent = {
        title: title,
        allDay: false,
        resource: schedule,
      };

      // Check if the event spans across midnight IN THE DISPLAY TIMEZONE
      if (!startDisplay.isSame(endDisplay, 'day')) {
        // Overnight shift: split into two events for react-big-calendar
        const endOfFirstDay = startDisplay.clone().endOf('day');
        const startOfSecondDay = endDisplay.clone().startOf('day');

        // First part of the event
        allEvents.push({
          ...baseEvent,
          start: startDisplay.toDate(),
          end: endOfFirstDay.toDate(),
        });

        // Second part of the event (if it has duration on the next day)
        if (endDisplay.isAfter(startOfSecondDay)) {
             allEvents.push({
                ...baseEvent,
                start: startOfSecondDay.toDate(),
                end: endDisplay.toDate(),
            });
        }
      } else {
        // Same-day shift
        allEvents.push({
          ...baseEvent,
          start: startDisplay.toDate(),
          end: endDisplay.toDate(),
        });
      }
    });

    return allEvents;
  }, [schedules, getAnalystName, timezone]);
  
  const eventPropGetter = useCallback((event: CalendarEvent) => {
    const newProps: React.HTMLAttributes<HTMLDivElement> = {
      className: `event-custom ${event.resource.shiftType.toLowerCase()}`,
    };
    if (event.resource.isScreener) {
      newProps.className += ' event-screener';
    }
    return newProps;
  }, []);

  if (loading) {
    return <div className="flex items-center justify-center h-full"><p>Loading schedule...</p></div>;
  }

  if (error) {
    return <div className="flex items-center justify-center h-full"><p className="text-destructive">{error}</p></div>;
  }

  return (
    <div className={`relative h-full p-4 bg-background text-foreground ${theme}`}>
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
        formats={{
          eventTimeRangeFormat: () => '', // Suppress the time on the event
        }}
        components={{
          toolbar: () => null,
          month: { event: StandardEvent },
          day: { event: StandardEvent },
          week: { event: RotatedEvent },
        }}
        className="rbc-calendar"
        dayLayoutAlgorithm="no-overlap"
      />
    </div>
  );
};

export default ScheduleView;