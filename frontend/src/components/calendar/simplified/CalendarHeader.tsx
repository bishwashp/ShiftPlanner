import React from 'react';
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
  // Navigation handlers
  const handlePrevious = () => {
    const newDate = moment(date).subtract(1, view).toDate();
    setDate(newDate);
    
    // Haptic feedback
    if ('vibrate' in navigator) {
      navigator.vibrate(30);
    }
  };

  const handleNext = () => {
    const newDate = moment(date).add(1, view).toDate();
    setDate(newDate);
    
    // Haptic feedback
    if ('vibrate' in navigator) {
      navigator.vibrate(30);
    }
  };

  const handleToday = () => {
    setDate(new Date());
    
    // Haptic feedback
    if ('vibrate' in navigator) {
      navigator.vibrate(50);
    }
  };

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

  return (
    <div className="flex items-center justify-between mb-6 px-2">
      {/* Navigation Controls */}
      <div className="flex items-center space-x-2">
        {/* Previous Button */}
        <button
          onClick={handlePrevious}
          className={`${
            isMobile ? 'p-2' : 'p-2.5'
          } rounded-lg hover:bg-muted transition-colors touch-manipulation flex items-center justify-center min-w-[44px] min-h-[44px]`}
          title={`Previous ${view}`}
          aria-label={`Go to previous ${view}`}
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>

        {/* Today Button */}
        <button
          onClick={handleToday}
          disabled={isToday}
          className={`${
            isMobile ? 'px-3 py-2 text-sm' : 'px-4 py-2'
          } rounded-lg transition-all touch-manipulation min-h-[44px] ${
            isToday
              ? 'bg-muted/50 text-muted-foreground cursor-not-allowed'
              : 'bg-primary/10 hover:bg-primary/20 text-primary hover:text-primary/80'
          }`}
          title="Go to today"
        >
          {isMobile ? 'Today' : 'Today'}
        </button>

        {/* Next Button */}
        <button
          onClick={handleNext}
          className={`${
            isMobile ? 'p-2' : 'p-2.5'
          } rounded-lg hover:bg-muted transition-colors touch-manipulation flex items-center justify-center min-w-[44px] min-h-[44px]`}
          title={`Next ${view}`}
          aria-label={`Go to next ${view}`}
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      {/* Current Period Display */}
      <div className="flex-1 text-center">
        <h2 className={`${
          isMobile ? 'text-lg' : 'text-xl'
        } font-semibold text-foreground`}>
          {getCurrentPeriod()}
        </h2>
        <div className="text-xs text-muted-foreground mt-1">
          {moment().tz(timezone).format('z')} Time Zone
        </div>
      </div>

      {/* View Selector */}
      <div className="flex items-center">
        <div className={`flex rounded-lg border border-border bg-muted/30 ${isMobile ? 'text-sm' : ''}`}>
          {(['month', 'week', 'day'] as const).map((viewOption) => (
            <button
              key={viewOption}
              onClick={() => setView(viewOption)}
              className={`${
                isMobile ? 'px-2 py-1.5' : 'px-3 py-2'
              } first:rounded-l-lg last:rounded-r-lg transition-all touch-manipulation min-h-[44px] min-w-[44px] ${
                view === viewOption
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'hover:bg-muted/60 text-muted-foreground'
              }`}
              title={`${viewOption.charAt(0).toUpperCase() + viewOption.slice(1)} view`}
            >
              {isMobile ? viewOption.charAt(0).toUpperCase() : viewOption.charAt(0).toUpperCase() + viewOption.slice(1)}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default CalendarHeader;