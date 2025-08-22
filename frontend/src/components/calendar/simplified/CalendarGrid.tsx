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
  onEventSelect?: (event: CalendarEvent) => void;
  onDateSelect?: (date: Date) => void;
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
  // Smart stacking configuration based on mockup specs
  const STACKING_CONFIG = {
    desktop: {
      maxVisible: 4, // Show max 4 name boxes, then "+N more"
      nameBoxHeight: 20, // ~20% fill per box
      cellPadding: 8,
      minCellHeight: 100
    },
    mobile: {
      maxVisible: 2, // Show max 2 name boxes on mobile
      nameBoxHeight: 16,
      cellPadding: 4,
      minCellHeight: 60
    }
  };

  const config = isMobile ? STACKING_CONFIG.mobile : STACKING_CONFIG.desktop;

  // Smart name box stacking logic
  const renderNameBoxes = (dayEvents: CalendarEvent[], dayDate: moment.Moment) => {
    if (dayEvents.length === 0) return null;

    const visibleEvents = dayEvents.slice(0, config.maxVisible);
    const overflowCount = Math.max(0, dayEvents.length - config.maxVisible);
    
    // Dynamic sizing based on number of events
    const getNameBoxSize = (eventCount: number): 'small' | 'medium' | 'large' => {
      if (isMobile) return 'small';
      if (eventCount > 3) return 'small';
      if (eventCount > 1) return 'medium';
      return 'medium';
    };

    const boxSize = getNameBoxSize(dayEvents.length);

    return (
      <div className="flex flex-col gap-1 h-full justify-start">
        {visibleEvents.map((event, index) => (
          <NameBox
            key={event.id}
            name={event.title}
            shiftType={event.resource.shiftType}
            isScreener={event.resource.isScreener}
            size={boxSize}
            onClick={() => {
              console.log('Name box clicked:', event.title, dayDate.format('YYYY-MM-DD'));
            }}
          />
        ))}
        
        {/* Overflow indicator */}
        {overflowCount > 0 && (
          <div
            className={`
              text-center text-muted-foreground bg-muted/50 rounded-md border-dashed border
              cursor-pointer hover:bg-muted/70 transition-colors
              ${isMobile ? 'text-xs py-0.5 px-1' : 'text-xs py-1 px-2'}
            `}
            title={`${overflowCount} more shifts on ${dayDate.format('MMMM D')}`}
          >
            +{overflowCount} more
          </div>
        )}
      </div>
    );
  };

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

      {/* Calendar Body with Smart Stacking */}
      <div className="space-y-1">
        {weeks.map((week, weekIndex) => (
          <div key={weekIndex} className="grid grid-cols-7 gap-1">
            {week.map((day, dayIndex) => {
              // Dynamic cell height based on content and config
              const cellHeight = Math.max(
                config.minCellHeight,
                config.cellPadding * 2 +
                (day.events.length > 0 ? Math.min(day.events.length, config.maxVisible) * (config.nameBoxHeight + 4) : 0)
              );

              return (
                <div
                  key={dayIndex}
                  className={`
                    relative border rounded-lg transition-all duration-200
                    ${day.isCurrentMonth
                      ? 'bg-background border-border hover:bg-muted/20'
                      : 'bg-muted/20 border-muted/40 text-muted-foreground'
                    }
                    ${day.isToday
                      ? 'ring-2 ring-primary bg-primary/5 shadow-sm'
                      : ''
                    }
                    ${day.events.length > 0 && day.isCurrentMonth
                      ? 'hover:shadow-md'
                      : ''
                    }
                  `}
                  style={{
                    minHeight: `${cellHeight}px`,
                    padding: `${config.cellPadding}px`
                  }}
                >
                  {/* Day number with enhanced styling */}
                  <div
                    className={`
                      font-medium mb-2 flex items-center justify-between
                      ${day.isToday
                        ? 'text-primary font-bold'
                        : day.isCurrentMonth
                          ? 'text-foreground'
                          : 'text-muted-foreground'
                      }
                      ${isMobile ? 'text-xs mb-1' : 'text-sm'}
                    `}
                  >
                    <span>{day.date.date()}</span>
                    {day.events.length > 0 && (
                      <span
                        className={`
                          rounded-full w-5 h-5 flex items-center justify-center text-[10px] font-bold
                          ${day.events.length > config.maxVisible
                            ? 'bg-amber-500 text-white'
                            : 'bg-primary/20 text-primary'
                          }
                        `}
                        title={`${day.events.length} shift${day.events.length > 1 ? 's' : ''}`}
                      >
                        {day.events.length}
                      </span>
                    )}
                  </div>

                  {/* Smart name box stacking */}
                  <div className="flex-1 flex flex-col">
                    {renderNameBoxes(day.events, day.date)}
                  </div>

                  {/* Enhanced empty state */}
                  {day.events.length === 0 && day.isCurrentMonth && (
                    <div className="absolute inset-0 flex items-center justify-center opacity-0 hover:opacity-30 transition-opacity cursor-pointer">
                      <div
                        className="text-muted-foreground text-xs bg-muted/50 rounded-full w-6 h-6 flex items-center justify-center"
                        title={`Add shift for ${day.date.format('MMMM D')}`}
                      >
                        +
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
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