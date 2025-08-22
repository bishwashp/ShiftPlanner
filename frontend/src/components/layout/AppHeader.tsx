import React from 'react';
import { Menu, ChevronLeft, ChevronRight } from 'lucide-react';
import { ThemeSwitcher } from '../ThemeSwitcher';
import { format, addMonths, subMonths, addDays, subDays, addWeeks, subWeeks } from 'date-fns';
import { View as BigCalendarView } from 'react-big-calendar';
import { View as SidebarView } from './CollapsibleSidebar';
import TimezoneSelector from '../TimezoneSelector';
import CalendarLegend from '../CalendarLegend';

interface AppHeaderProps {
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
  date: Date;
  setDate: (date: Date) => void;
  view: BigCalendarView;
  setView: (view: BigCalendarView) => void;
  activeView: SidebarView;
  timezone: string;
  onTimezoneChange: (tz: string) => void;
}

const AppHeader: React.FC<AppHeaderProps> = ({ 
  sidebarOpen, 
  setSidebarOpen, 
  date, 
  setDate, 
  view, 
  setView,
  activeView,
  timezone,
  onTimezoneChange
}) => {
  const handlePrev = () => {
    if (view === 'month') setDate(subMonths(date, 1));
    else if (view === 'week') setDate(subWeeks(date, 1));
    else setDate(subDays(date, 1));
  };

  const handleNext = () => {
    if (view === 'month') setDate(addMonths(date, 1));
    else if (view === 'week') setDate(addWeeks(date, 1));
    else setDate(addDays(date, 1));
  };

  const handleToday = () => {
    setDate(new Date());
  };
  
  const handleViewChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setView(e.target.value as BigCalendarView);
  }

  const getTitle = () => {
    switch(activeView) {
      case 'schedule':
        if (view === 'day') return format(date, 'MMMM d, yyyy');
        return format(date, 'MMMM yyyy');
      case 'dashboard':
        return 'Dashboard';
      case 'analysts':
        return 'Analyst Management';
      case 'conflicts':
        return 'Conflict Management';
      case 'analytics':
        return 'Analytics';
      case 'constraints':
        return 'Constraint Management';
      case 'algorithms':
        return 'Algorithm Management';
      default:
        return 'ShiftPlanner';
    }
  }

  return (
    <header className={`
      bg-card text-card-foreground border-b border-border flex items-center justify-between
      px-3 py-2 sm:px-4 sm:py-2
      ${sidebarOpen ? 'pl-2 sm:pl-4' : 'pl-4'}
      transition-all duration-300
    `}>
      {/* Left Section */}
      <div className="flex items-center space-x-2 flex-shrink-0">
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="p-2 rounded-md hover:bg-muted min-h-[44px] min-w-[44px] flex items-center justify-center"
          aria-label="Toggle sidebar"
        >
          <Menu size={20} />
        </button>
        <h1 className="text-lg font-semibold truncate hidden sm:block">
          {getTitle()}
        </h1>
        <h1 className="text-base font-semibold truncate sm:hidden">
          {activeView === 'schedule' ? format(date, 'MMM yyyy') : getTitle()}
        </h1>
      </div>

      {/* Right Section */}
      <div className="flex items-center space-x-1 sm:space-x-2 flex-shrink-0">
        {activeView === 'schedule' && (
          <>
            {/* Navigation Controls */}
            <div className="flex items-center space-x-1">
              <button
                onClick={handlePrev}
                className="p-2 rounded-md hover:bg-muted min-h-[44px] min-w-[44px] flex items-center justify-center"
                aria-label="Previous"
              >
                <ChevronLeft size={18} />
              </button>
              <button
                onClick={handleNext}
                className="p-2 rounded-md hover:bg-muted min-h-[44px] min-w-[44px] flex items-center justify-center"
                aria-label="Next"
              >
                <ChevronRight size={18} />
              </button>
            </div>

            {/* Today Button - Hide on very small screens */}
            <button
              onClick={handleToday}
              className="px-3 py-2 text-sm font-medium rounded-md border border-border hover:bg-muted min-h-[44px] hidden xs:block"
            >
              Today
            </button>

            {/* View Selector */}
            <select
              value={view}
              onChange={handleViewChange}
              className="px-2 py-2 text-sm border border-border rounded-md bg-card text-card-foreground focus:ring-2 focus:ring-primary min-h-[44px] w-16 sm:w-auto"
            >
              <option value="day">D</option>
              <option value="week">W</option>
              <option value="month">M</option>
            </select>
          </>
        )}

        {/* Timezone, Theme, Legend */}
        <div className="flex items-center space-x-1 sm:space-x-2">
          <TimezoneSelector timezone={timezone} onTimezoneChange={onTimezoneChange} />
          <ThemeSwitcher />
          {activeView === 'schedule' && <CalendarLegend />}
        </div>
      </div>
    </header>
  );
};

export default AppHeader; 