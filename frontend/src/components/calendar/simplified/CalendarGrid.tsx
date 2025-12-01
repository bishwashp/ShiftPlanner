import React, { useRef, useEffect, useCallback } from 'react';
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
  onEventSelect?: (event: CalendarEvent) => void; // Optional - not used in current implementation
  onDateSelect?: (date: Date) => void;
  onShowMoreClick?: (date: Date) => void; // New prop for "+X more" clicks
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
  isMobile,
  onEventSelect,
  onDateSelect,
  onShowMoreClick
}) => {
  const gridRef = useRef<HTMLDivElement>(null);
  const [focusedDate, setFocusedDate] = React.useState<string | null>(null);
  // Smart stacking configuration based on mockup specs
  const STACKING_CONFIG = {
    desktop: {
      maxVisible: 12, // Show max 12 name boxes (circles)
      nameBoxHeight: 32, // Matches NameBox medium size (h-8)
      cellPadding: 8,
      minCellHeight: 100
    },
    mobile: {
      maxVisible: 6, // Show max 6 name boxes on mobile
      nameBoxHeight: 24, // Matches NameBox small size (h-6)
      cellPadding: 4,
      minCellHeight: 60
    }
  };

  const config = isMobile ? STACKING_CONFIG.mobile : STACKING_CONFIG.desktop;

  // Enhanced keyboard navigation for calendar grid
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (!gridRef.current?.contains(document.activeElement)) return;

    const currentDate = focusedDate ? moment(focusedDate) : moment(date).startOf('month');
    let newDate: moment.Moment;

    switch (e.key) {
      case 'ArrowLeft':
        e.preventDefault();
        newDate = currentDate.clone().subtract(1, 'day');
        setFocusedDate(newDate.format('YYYY-MM-DD'));
        break;
      case 'ArrowRight':
        e.preventDefault();
        newDate = currentDate.clone().add(1, 'day');
        setFocusedDate(newDate.format('YYYY-MM-DD'));
        break;
      case 'ArrowUp':
        e.preventDefault();
        newDate = currentDate.clone().subtract(1, 'week');
        setFocusedDate(newDate.format('YYYY-MM-DD'));
        break;
      case 'ArrowDown':
        e.preventDefault();
        newDate = currentDate.clone().add(1, 'week');
        setFocusedDate(newDate.format('YYYY-MM-DD'));
        break;
      case 'Enter':
      case ' ':
        e.preventDefault();
        if (onDateSelect) {
          onDateSelect(currentDate.toDate());
        }
        break;
      case 'Home':
        e.preventDefault();
        newDate = currentDate.clone().startOf('week');
        setFocusedDate(newDate.format('YYYY-MM-DD'));
        break;
      case 'End':
        e.preventDefault();
        newDate = currentDate.clone().endOf('week');
        setFocusedDate(newDate.format('YYYY-MM-DD'));
        break;
      case 'PageUp':
        e.preventDefault();
        newDate = currentDate.clone().subtract(1, 'month');
        setFocusedDate(newDate.format('YYYY-MM-DD'));
        break;
      case 'PageDown':
        e.preventDefault();
        newDate = currentDate.clone().add(1, 'month');
        setFocusedDate(newDate.format('YYYY-MM-DD'));
        break;
    }
  }, [focusedDate, date, onDateSelect]);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  // Smart name box stacking logic
  const renderNameBoxes = (dayEvents: CalendarEvent[], dayDate: moment.Moment) => {
    if (dayEvents.length === 0) return null;

    const visibleEvents = dayEvents.slice(0, config.maxVisible);
    const overflowCount = Math.max(0, dayEvents.length - config.maxVisible);

    // Dynamic sizing based on number of events - kept for compatibility but less critical with circles
    const getNameBoxSize = (eventCount: number): 'small' | 'medium' | 'large' => {
      if (isMobile) return 'small';
      if (eventCount > 8) return 'small'; // Switch to small if very crowded
      return 'medium';
    };

    const boxSize = getNameBoxSize(dayEvents.length);

    return (
      <div className="flex flex-row flex-wrap gap-1 h-full content-start">
        {visibleEvents.map((event, index) => (
          <NameBox
            key={event.id}
            name={event.title}
            shiftType={event.resource.shiftType}
            isScreener={event.resource.isScreener}
            date={event.date}
            size={boxSize}
            onClick={() => {
              console.log('Name box clicked:', event.title, dayDate.format('YYYY-MM-DD'));
              if (onEventSelect) {
                onEventSelect(event);
              }
            }}
          />
        ))}

        {/* Overflow indicator - Circular style */}
        {overflowCount > 0 && (
          <button
            className={`
              flex items-center justify-center rounded-full
              text-gray-700 dark:text-gray-200 bg-muted/50 border-dashed border
              cursor-pointer hover:bg-muted/70 focus:bg-muted/70 focus:outline-none focus:ring-2 focus:ring-primary transition-colors
              ${boxSize === 'small' ? 'w-6 h-6 text-[10pt]' : 'w-8 h-8 text-xs'}
            `}
            title={`${overflowCount} more shifts on ${dayDate.format('MMMM D')}`}
            aria-label={`View ${overflowCount} additional shifts for ${dayDate.format('MMMM D')}`}
            onClick={(e) => {
              e.stopPropagation(); // Prevent cell click
              console.log('Overflow clicked:', dayDate.format('YYYY-MM-DD'), overflowCount);
              // Switch to week view with this day highlighted
              onShowMoreClick?.(dayDate.toDate());
            }}
          >
            +{overflowCount}
          </button>
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

  // Accessibility helpers
  const getDateAccessibilityInfo = (day: CalendarDay) => {
    const isSelected = focusedDate === day.date.format('YYYY-MM-DD');
    const eventCount = day.events.length;
    const dateString = day.date.format('MMMM D, YYYY');

    let description = `${dateString}`;
    if (day.isToday) description += ', today';
    if (!day.isCurrentMonth) description += ', outside current month';
    if (eventCount > 0) {
      description += `, ${eventCount} shift${eventCount > 1 ? 's' : ''} scheduled`;
    }

    return { isSelected, description, dateString };
  };

  return (
    <div
      className="simplified-calendar-grid"
      ref={gridRef}
      role="application"
      aria-label="Calendar grid with shift schedule"
    >
      {/* Calendar Header */}
      <div className="grid grid-cols-7 gap-1 mb-2" role="row">
        {['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'].map((day, index) => (
          <div
            key={day}
            className={`text-center py-2 text-sm font-medium text-gray-700 dark:text-gray-200 ${isMobile ? 'text-xs' : ''
              }`}
            role="columnheader"
            aria-label={`${day}day column`}
          >
            {isMobile ? day.charAt(0) : day}
          </div>
        ))}
      </div>

      {/* Calendar Body with Smart Stacking */}
      <div className="space-y-1" role="grid" aria-readonly="true">
        {weeks.map((week, weekIndex) => (
          <div key={weekIndex} className="grid grid-cols-7 gap-1" role="row">
            {week.map((day, dayIndex) => {
              const { isSelected, description, dateString } = getDateAccessibilityInfo(day);
              // Dynamic cell height - simplified for horizontal layout
              // We rely on min-height and let flex-wrap expand the cell if needed
              const cellHeight = config.minCellHeight;

              return (
                <div
                  key={dayIndex}
                  className={`
                    relative border rounded-lg cursor-pointer
                    backdrop-blur-sm
                    ${day.isCurrentMonth
                      ? 'bg-white/60 dark:bg-gray-800/40 border-gray-300/50 dark:border-gray-600/40 hover:bg-white/80 dark:hover:bg-gray-900/80 focus-within:bg-white/80 dark:focus-within:bg-gray-800/60'
                      : 'bg-gray-100/40 dark:bg-gray-900/20 border-gray-200/40 dark:border-gray-700/30 text-gray-500 dark:text-gray-400'
                    }
                    ${day.isToday
                      ? '' // Removed cell styling for today
                      : ''
                    }
                    ${isSelected
                      ? 'ring-2 ring-offset-2 ring-primary/60'
                      : ''
                    }
                    ${day.events.length > 0 && day.isCurrentMonth
                      ? 'hover:shadow-lg hover:shadow-white/5'
                      : ''
                    }
                  `}
                  style={{
                    minHeight: `${cellHeight}px`,
                    padding: `${config.cellPadding}px`
                  }}
                  role="gridcell"
                  tabIndex={day.isCurrentMonth ? 0 : -1}
                  aria-label={description}
                  aria-selected={isSelected}
                  aria-describedby={day.events.length > 0 ? `events-${day.date.format('YYYY-MM-DD')}` : undefined}
                  onClick={() => {
                    setFocusedDate(day.date.format('YYYY-MM-DD'));
                  }}
                  onDoubleClick={() => {
                    if (onDateSelect && day.isCurrentMonth) {
                      onDateSelect(day.date.toDate());
                    }
                  }}
                  onFocus={() => setFocusedDate(day.date.format('YYYY-MM-DD'))}
                >
                  {/* Hidden description for screen readers */}
                  {day.events.length > 0 && (
                    <div id={`events-${day.date.format('YYYY-MM-DD')}`} className="sr-only">
                      {day.events.map(event => `${event.title} shift`).join(', ')}
                    </div>
                  )}
                  {/* Day number with enhanced styling */}
                  <div
                    className={`
                      font-medium mb-2 flex items-center justify-between
                      ${isMobile ? 'text-xs mb-1' : 'text-sm'}
                    `}
                  >
                    {/* Date Number */}
                    <div className={`
                      text-sm font-semibold mb-1 flex items-center justify-center w-7 h-7 rounded-full transition-colors
                      ${day.isToday
                        ? 'bg-[#F00046] text-white shadow-sm'
                        : day.isCurrentMonth ? 'text-gray-900 dark:text-white' : 'text-gray-500 dark:text-gray-400'}`}>
                      <span>{day.date.date()}</span>
                    </div>

                  </div>

                  {/* Smart name box stacking */}
                  <div className="flex-1 flex flex-col">
                    {renderNameBoxes(day.events, day.date)}
                  </div>

                  {/* Enhanced empty state */}
                  {day.events.length === 0 && day.isCurrentMonth && (
                    <div className="absolute inset-0 flex items-center justify-center opacity-0 hover:opacity-30 focus-within:opacity-30 transition-opacity">
                      <button
                        className="text-gray-700 dark:text-gray-200 text-xs bg-muted/50 rounded-full w-6 h-6 flex items-center justify-center hover:bg-muted/70 focus:bg-muted/70 focus:outline-none focus:ring-2 focus:ring-primary"
                        title={`Add shift for ${day.date.format('MMMM D')}`}
                        aria-label={`Add shift for ${dateString}`}
                        onDoubleClick={(e) => {
                          e.stopPropagation();
                          console.log('Add shift double-clicked:', day.date.format('YYYY-MM-DD'));
                          if (onDateSelect) {
                            onDateSelect(day.date.toDate());
                          }
                        }}
                      >
                        +
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>



      {/* Screen reader instructions */}
      <div className="sr-only" role="region" aria-label="Calendar navigation instructions">
        Use arrow keys to navigate between dates. Press Enter or Space to select a date.
        Use Page Up/Down to navigate between months. Use Home/End to go to start/end of week.
      </div>
    </div>
  );
};