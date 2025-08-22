import React from 'react';
import moment from 'moment-timezone';
import { NameBox } from './NameBox';

interface CalendarEvent {
  id: string;
  title: string;
  date: string; // YYYY-MM-DD format
  resource: any;
}

interface CalendarGridProps {
  date: Date;
  timezone: string;
  events: CalendarEvent[];
  isMobile: boolean;
}

interface CalendarDay {
  date: moment.Moment;
  events: CalendarEvent[];
  isCurrentMonth: boolean;
  isToday: boolean;
}

export const CalendarGrid: React.FC<CalendarGridProps> = ({
  date,
  timezone,
  events,
  isMobile
}) => {
  // Generate calendar grid data
  const generateCalendarDays = (): CalendarDay[] => {
    const currentMonth = moment(date).tz(timezone);
    const startOfMonth = currentMonth.clone().startOf('month');
    const endOfMonth = currentMonth.clone().endOf('month');
    
    // Start from the first day of the week containing the first day of the month
    const startDate = startOfMonth.clone().startOf('week');
    
    // End on the last day of the week containing the last day of the month
    const endDate = endOfMonth.clone().endOf('week');
    
    const days: CalendarDay[] = [];
    let current = startDate.clone();
    
    while (current.isSameOrBefore(endDate)) {
      const dayEvents = events.filter(event => 
        event.date === current.format('YYYY-MM-DD')
      );
      
      days.push({
        date: current.clone(),
        events: dayEvents,
        isCurrentMonth: current.month() === currentMonth.month(),
        isToday: current.isSame(moment().tz(timezone), 'day')
      });
      
      current.add(1, 'day');
    }
    
    return days;
  };

  const calendarDays = generateCalendarDays();
  
  // Group days into weeks
  const weeks: CalendarDay[][] = [];
  for (let i = 0; i < calendarDays.length; i += 7) {
    weeks.push(calendarDays.slice(i, i + 7));
  }

  return (
    <div className="simplified-calendar-grid">
      {/* Calendar Header */}
      <div className="grid grid-cols-7 gap-1 mb-2">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day, index) => (
          <div
            key={day}
            className={`text-center py-2 text-sm font-medium text-muted-foreground ${
              isMobile ? 'text-xs' : ''
            }`}
          >
            {isMobile ? day.charAt(0) : day}
          </div>
        ))}
      </div>

      {/* Calendar Body */}
      <div className="space-y-1">
        {weeks.map((week, weekIndex) => (
          <div key={weekIndex} className="grid grid-cols-7 gap-1">
            {week.map((day, dayIndex) => (
              <div
                key={dayIndex}
                className={`
                  relative min-h-[80px] border rounded-lg p-2 transition-colors
                  ${day.isCurrentMonth 
                    ? 'bg-background border-border' 
                    : 'bg-muted/30 border-muted text-muted-foreground'
                  }
                  ${day.isToday 
                    ? 'ring-2 ring-primary bg-primary/5' 
                    : ''
                  }
                  ${isMobile ? 'min-h-[60px] p-1' : ''}
                `}
              >
                {/* Day number */}
                <div 
                  className={`
                    text-sm font-medium mb-1
                    ${day.isToday 
                      ? 'text-primary font-bold' 
                      : day.isCurrentMonth 
                        ? 'text-foreground' 
                        : 'text-muted-foreground'
                    }
                    ${isMobile ? 'text-xs' : ''}
                  `}
                >
                  {day.date.date()}
                </div>

                {/* Events for this day */}
                <div className="space-y-1">
                  {day.events.map((event, eventIndex) => (
                    <NameBox
                      key={event.id}
                      name={event.title}
                      shiftType={event.resource.shiftType}
                      isScreener={event.resource.isScreener}
                      size={isMobile ? 'small' : 'medium'}
                    />
                  ))}
                </div>

                {/* Empty state indicator */}
                {day.events.length === 0 && day.isCurrentMonth && (
                  <div className="absolute inset-0 flex items-center justify-center opacity-0 hover:opacity-50 transition-opacity">
                    <div className="text-muted-foreground text-xs">
                      +
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        ))}
      </div>

      {/* Month indicator at bottom */}
      <div className="text-center mt-4 text-sm text-muted-foreground">
        {moment(date).tz(timezone).format('MMMM YYYY')}
      </div>
    </div>
  );
};