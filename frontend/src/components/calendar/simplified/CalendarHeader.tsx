import React, { useRef, useEffect, useCallback } from 'react';
import moment from 'moment-timezone';

interface CalendarHeaderProps {
  date: Date;
  setDate: (date: Date) => void;
  view: 'month' | 'week' | 'day';
  setView: (view: 'month' | 'week' | 'day') => void;
  timezone: string;
  isMobile: boolean;
}

export const CalendarHeader: React.FC<CalendarHeaderProps> = ({
  date,
  setDate,
  view,
  setView,
  timezone,
  isMobile,
}) => {
  const headerRef = useRef<HTMLElement>(null);
  
  // Navigation handlers with useCallback for stability
  const handlePrevious = useCallback(() => {
    const newDate = moment(date).subtract(1, view).toDate();
    setDate(newDate);
    
    // Haptic feedback
    if ('vibrate' in navigator) {
      navigator.vibrate(30);
    }
  }, [date, view, setDate]);

  const handleNext = useCallback(() => {
    const newDate = moment(date).add(1, view).toDate();
    setDate(newDate);
    
    // Haptic feedback
    if ('vibrate' in navigator) {
      navigator.vibrate(30);
    }
  }, [date, view, setDate]);

  const handleToday = useCallback(() => {
    setDate(new Date());
    
    // Haptic feedback
    if ('vibrate' in navigator) {
      navigator.vibrate(50);
    }
  }, [setDate]);
  
  // Enhanced keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only handle keys when calendar header has focus within
      if (!headerRef.current?.contains(document.activeElement)) return;
      
      switch (e.key) {
        case 'ArrowLeft':
          e.preventDefault();
          handlePrevious();
          break;
        case 'ArrowRight':
          e.preventDefault();
          handleNext();
          break;
        case 'Home':
          e.preventDefault();
          handleToday();
          break;
        case '1':
        case 'm':
        case 'M':
          e.preventDefault();
          setView('month');
          break;
        case '2':
        case 'w':
        case 'W':
          e.preventDefault();
          setView('week');
          break;
        case '3':
        case 'd':
        case 'D':
          e.preventDefault();
          setView('day');
          break;
      }
    };
    
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handlePrevious, handleNext, handleToday, setView]);

  // Format current period display
  const getCurrentPeriod = () => {
    const localDate = moment(date).tz(timezone);
    
    switch (view) {
      case 'month':
        return localDate.format('MMMM YYYY');
      case 'week':
        const startOfWeek = localDate.clone().startOf('week');
        const endOfWeek = localDate.clone().endOf('week');
        
        if (startOfWeek.month() === endOfWeek.month()) {
          return `${startOfWeek.format('MMM D')} - ${endOfWeek.format('D, YYYY')}`;
        } else {
          return `${startOfWeek.format('MMM D')} - ${endOfWeek.format('MMM D, YYYY')}`;
        }
      case 'day':
        return localDate.format('dddd, MMMM D, YYYY');
      default:
        return localDate.format('MMMM YYYY');
    }
  };

  // Check if current date is today
  const isToday = moment(date).isSame(moment(), 'day');

  // Accessibility live region announcements
  const getCurrentPeriodDescription = () => {
    const localDate = moment(date).tz(timezone);
    
    switch (view) {
      case 'month':
        return `Viewing ${localDate.format('MMMM YYYY')} calendar in month view`;
      case 'week':
        const startOfWeek = localDate.clone().startOf('week');
        const endOfWeek = localDate.clone().endOf('week');
        return `Viewing week from ${startOfWeek.format('MMMM D')} to ${endOfWeek.format('MMMM D, YYYY')} in week view`;
      case 'day':
        return `Viewing ${localDate.format('dddd, MMMM D, YYYY')} in day view`;
      default:
        return `Viewing calendar for ${localDate.format('MMMM YYYY')}`;
    }
  };

  return (
    <header
      ref={headerRef}
      className="flex items-center justify-between mb-6 px-2"
      role="banner"
      aria-label="Calendar navigation and controls"
    >
      {/* Screen reader announcement */}
      <div
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
      >
        {getCurrentPeriodDescription()}
      </div>
      {/* Navigation Controls */}
      <nav
        className="flex items-center space-x-2"
        role="navigation"
        aria-label="Calendar navigation"
      >
        {/* Previous Button */}
        <button
          onClick={handlePrevious}
          className={`${
            isMobile ? 'p-2' : 'p-2.5'
          } rounded-lg hover:bg-muted focus:bg-muted focus:ring-2 focus:ring-primary focus:outline-none transition-all touch-manipulation flex items-center justify-center min-w-[44px] min-h-[44px]`}
          title={`Go to previous ${view}. Shortcut: Left arrow key`}
          aria-label={`Navigate to previous ${view}`}
          type="button"
        >
          <svg
            className="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>

        {/* Today Button */}
        <button
          onClick={handleToday}
          disabled={isToday}
          className={`${
            isMobile ? 'px-3 py-2 text-sm' : 'px-4 py-2'
          } rounded-lg transition-all touch-manipulation min-h-[44px] focus:outline-none focus:ring-2 focus:ring-primary ${
            isToday
              ? 'bg-muted/50 text-gray-700 dark:text-gray-200 cursor-not-allowed focus:ring-muted'
              : 'bg-primary/10 hover:bg-primary/20 focus:bg-primary/20 text-primary hover:text-primary/80'
          }`}
          title={`Navigate to today's date. Shortcut: Home key`}
          aria-label={`Go to today ${isToday ? '(currently viewing today)' : ''}`}
          aria-pressed={isToday}
          type="button"
        >
          Today
        </button>

        {/* Next Button */}
        <button
          onClick={handleNext}
          className={`${
            isMobile ? 'p-2' : 'p-2.5'
          } rounded-lg hover:bg-muted focus:bg-muted focus:ring-2 focus:ring-primary focus:outline-none transition-all touch-manipulation flex items-center justify-center min-w-[44px] min-h-[44px]`}
          title={`Go to next ${view}. Shortcut: Right arrow key`}
          aria-label={`Navigate to next ${view}`}
          type="button"
        >
          <svg
            className="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </nav>

      {/* Current Period Display */}
      <div className="flex-1 text-center">
        <h1
          className={`${
            isMobile ? 'text-lg' : 'text-xl'
          } font-semibold text-foreground`}
          id="calendar-heading"
          aria-describedby="timezone-info"
        >
          {getCurrentPeriod()}
        </h1>
        <div
          className="text-xs text-gray-700 dark:text-gray-200 mt-1"
          id="timezone-info"
          role="status"
          aria-label={`Current timezone: ${moment().tz(timezone).format('z')}`}
        >
          {moment().tz(timezone).format('z')} Time Zone
        </div>
      </div>

      {/* View Selector */}
      <div className="flex items-center">
        <fieldset>
          <legend className="sr-only">Select calendar view</legend>
          <div
            className={`flex rounded-lg border border-border bg-muted/30 ${isMobile ? 'text-sm' : ''}`}
            role="radiogroup"
            aria-labelledby="view-selector-label"
          >
            <span id="view-selector-label" className="sr-only">Calendar view options</span>
            {(['month', 'week', 'day'] as const).map((viewOption) => (
              <button
                key={viewOption}
                onClick={() => setView(viewOption)}
                className={`${
                  isMobile ? 'px-2 py-1.5' : 'px-3 py-2'
                } first:rounded-l-lg last:rounded-r-lg transition-all touch-manipulation min-h-[44px] min-w-[44px] focus:outline-none focus:ring-2 focus:ring-primary focus:ring-inset ${
                  view === viewOption
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'hover:bg-muted/60 focus:bg-muted/60 text-gray-700 dark:text-gray-200'
                }`}
                title={`Switch to ${viewOption} view. Shortcut: ${viewOption === 'month' ? 'M or 1' : viewOption === 'week' ? 'W or 2' : 'D or 3'}`}
                aria-label={`View calendar in ${viewOption} format`}
                role="radio"
                aria-checked={view === viewOption}
                type="button"
              >
                {isMobile ? viewOption.charAt(0).toUpperCase() : viewOption.charAt(0).toUpperCase() + viewOption.slice(1)}
              </button>
            ))}
          </div>
        </fieldset>
      </div>
    </header>
  );
};

export default CalendarHeader;