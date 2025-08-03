import React from 'react';
import { Menu, ChevronLeft, ChevronRight } from 'lucide-react';
import { ThemeSwitcher } from '../ThemeSwitcher';
import { format, addMonths, subMonths, addDays, subDays, addWeeks, subWeeks } from 'date-fns';
import { View as BigCalendarView } from 'react-big-calendar';
import { View as SidebarView } from './CollapsibleSidebar';
import TimezoneSelector from '../TimezoneSelector';


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
    <header className="bg-card text-card-foreground p-2 border-b border-border flex items-center justify-between">
      <div className="flex items-center space-x-2">
        <button 
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="p-2 rounded-md hover:bg-muted"
        >
          <Menu size={20} />
        </button>
        <h1 className="text-lg font-semibold">{getTitle()}</h1>
      </div>
      <div className="flex items-center space-x-2">
        {activeView === 'schedule' && (
          <>
            <button onClick={handlePrev} className="p-2 rounded-md hover:bg-muted">
              <ChevronLeft size={20} />
            </button>
            <button onClick={handleNext} className="p-2 rounded-md hover:bg-muted">
              <ChevronRight size={20} />
            </button>
            <button onClick={handleToday} className="px-4 py-2 text-sm font-medium rounded-md border border-border hover:bg-muted">
              Today
            </button>
            <select value={view} onChange={handleViewChange} className="px-3 py-2 text-sm border border-border rounded-md bg-card text-card-foreground focus:ring-2 focus:ring-primary">
              <option value="day">Day</option>
              <option value="week">Week</option>
              <option value="month">Month</option>
            </select>
          </>
        )}
        <TimezoneSelector timezone={timezone} onTimezoneChange={onTimezoneChange} />
        <ThemeSwitcher />
      </div>
    </header>
  );
};

export default AppHeader; 