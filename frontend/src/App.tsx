import React, { useState } from 'react';
import './App.css';
import ScheduleView from './components/ScheduleView';
import AppHeader from './components/layout/AppHeader';
import CollapsibleSidebar from './components/layout/CollapsibleSidebar';
import { View as SidebarView } from './components/layout/CollapsibleSidebar';
import AnalystManagement from './components/AnalystManagement';
import Analytics from './components/Analytics';
import ConflictManagement from './components/ConflictManagement';
import ConstraintManagement from './components/ConstraintManagement';
import AlgorithmManagement from './components/AlgorithmManagement';
import Dashboard from './components/Dashboard';
import { View as BigCalendarView } from 'react-big-calendar';
import moment from 'moment-timezone';

function App() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [activeView, setActiveView] = useState<SidebarView>('schedule');
  const [calendarDate, setCalendarDate] = useState(new Date());
  const [calendarView, setCalendarView] = useState<BigCalendarView>('month');
  const [timezone, setTimezone] = useState<string>(() => {
    return localStorage.getItem('timezone') || moment.tz.guess();
  });

  const handleTimezoneChange = (tz: string) => {
    setTimezone(tz);
    localStorage.setItem('timezone', tz);
  }

  const renderView = () => {
    switch (activeView) {
      case 'analysts':
        return <AnalystManagement />;
      case 'conflicts':
        return <ConflictManagement />;
      case 'analytics':
        return <Analytics />;
      case 'constraints':
        return <ConstraintManagement />;
      case 'algorithms':
        return <AlgorithmManagement />;
      case 'dashboard':
        return <Dashboard onViewChange={() => {}} />;
      case 'schedule':
      default:
        return (
          <ScheduleView 
            onViewChange={() => {}} 
            date={calendarDate}
            setDate={setCalendarDate}
            view={calendarView}
            setView={setCalendarView}
            timezone={timezone}
          />
        );
    }
  };

  return (
    <div className="flex h-screen bg-background text-foreground">
      <CollapsibleSidebar 
        isOpen={sidebarOpen} 
        onViewChange={setActiveView} 
        activeView={activeView}
      />
      <div className="flex-1 flex flex-col">
        <AppHeader 
          sidebarOpen={sidebarOpen} 
          setSidebarOpen={setSidebarOpen} 
          date={calendarDate}
          setDate={setCalendarDate}
          view={calendarView}
          setView={setCalendarView}
          activeView={activeView}
          timezone={timezone}
          onTimezoneChange={handleTimezoneChange}
        />
        <main className="flex-1 overflow-auto">
          {renderView()}
        </main>
      </div>
    </div>
  );
}

export default App;
