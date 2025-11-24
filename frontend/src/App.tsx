import React, { useState, useEffect, useCallback } from 'react';
import './App.css';
import ScheduleCalendar from './components/ScheduleCalendar';
import AppHeader from './components/layout/AppHeader';
import CollapsibleSidebar from './components/layout/CollapsibleSidebar';
import { View as SidebarView } from './components/layout/CollapsibleSidebar';
import AnalystManagement from './components/AnalystManagement';
import Availability from './components/Availability';
import Analytics from './components/Analytics';
import ConflictManagement from './components/ConflictManagement';
import ConstraintManagement from './components/ConstraintManagement';
import AlgorithmManagement from './components/AlgorithmManagement';
import Dashboard from './components/Dashboard';
import CalendarExport from './components/CalendarExport';
// import ActivitiesView from './components/ActivitiesView'; // Now integrated into Dashboard
import ActionPromptProvider from './contexts/ActionPromptContext';
import moment from 'moment-timezone';
import { useTheme } from 'react18-themes';
import { notificationService } from './services/notificationService';

// Toast notification component for better UX
const Toast = ({ message, type, onClose }: { message: string; type: 'success' | 'error' | 'info'; onClose: () => void }) => (
  <div className={`fixed top-4 right-4 z-50 p-4 rounded-lg shadow-lg transition-all duration-300 ${type === 'success' ? 'bg-green-500 text-white' :
    type === 'error' ? 'bg-red-500 text-white' :
      'bg-blue-500 text-white'
    }`}>
    <div className="flex items-center justify-between">
      <span>{message}</span>
      <button onClick={onClose} className="ml-4 text-white hover:text-gray-200">
        ×
      </button>
    </div>
  </div>
);

function App() {
  const { theme } = useTheme();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [activeView, setActiveView] = useState<SidebarView>('schedule');
  const [activeAvailabilityTab, setActiveAvailabilityTab] = useState<'holidays' | 'absences'>('holidays');
  const [activeConflictTab, setActiveConflictTab] = useState<'critical' | 'recommended'>('critical');
  const [calendarDate, setCalendarDate] = useState(() => {
    // Start with current month
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [calendarView, setCalendarView] = useState<'month' | 'week' | 'day'>('month');
  const [timezone, setTimezone] = useState<string>(() => {
    return localStorage.getItem('timezone') || moment.tz.guess();
  });
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Auto-save user preferences
  useEffect(() => {
    localStorage.setItem('sidebarOpen', sidebarOpen.toString());
    localStorage.setItem('activeView', activeView);
    localStorage.setItem('calendarView', calendarView);
    localStorage.setItem('calendarDate', calendarDate.toISOString());
  }, [sidebarOpen, activeView, calendarView, calendarDate]);

  // Load user preferences on mount
  useEffect(() => {
    const savedSidebarOpen = localStorage.getItem('sidebarOpen');
    const savedActiveView = localStorage.getItem('activeView') as SidebarView;
    const savedCalendarView = localStorage.getItem('calendarView') as 'month' | 'week' | 'day';
    const savedCalendarDate = localStorage.getItem('calendarDate');

    if (savedSidebarOpen !== null) {
      setSidebarOpen(savedSidebarOpen === 'true');
    }
    if (savedActiveView && ['schedule', 'dashboard', 'analysts', 'availability', 'conflicts', 'analytics', 'constraints', 'algorithms', 'export'].includes(savedActiveView)) {
      setActiveView(savedActiveView);
    }
    if (savedCalendarView && (['month', 'week', 'day'] as const).includes(savedCalendarView)) {
      setCalendarView(savedCalendarView);
    }
    if (savedCalendarDate) {
      const parsedDate = new Date(savedCalendarDate);
      if (!isNaN(parsedDate.getTime())) {
        setCalendarDate(parsedDate);
      }
    }
  }, []);

  const handleTimezoneChange = (tz: string) => {
    setTimezone(tz);
    localStorage.setItem('timezone', tz);
    // No toast spam - timezone changes are not actionable notifications
  };

  const showToast = (message: string, type: 'success' | 'error' | 'info') => {
    // Only show toasts for critical errors now
    if (type === 'error') {
      setToast({ message, type });
      setTimeout(() => setToast(null), 5000);
    }
  };

  const handleViewChange = (view: SidebarView) => {
    setActiveView(view);
    // Removed toast spam - view changes are not actionable notifications
  };

  const handleError = useCallback((error: string) => {
    // Show critical errors as toast only (no actionable notifications)
    showToast(error, 'error');
    // Add to notification history for tracking
    notificationService.addSystemNotification(
      'System Error Occurred',
      error,
      'high'
    );
  }, []);

  const handleSuccess = useCallback((message: string) => {
    // Add success notifications to history for tracking
    if (message.includes('conflict') || message.includes('schedule') || message.includes('error')) {
      notificationService.addSuccessNotification(
        'Action Completed',
        message,
        { category: 'user-action', tags: ['success'] }
      );
    }
    // No toast spam for regular success messages
  }, []);

  const handleLoading = useCallback((loading: boolean) => {
    setIsLoading(loading);
  }, []);

  const handleRefresh = useCallback(() => {
    if (activeView === 'dashboard') {
      setIsRefreshing(true);
      // The Dashboard component will handle the actual data refresh
      // Reset the refreshing state after a short delay
      setTimeout(() => {
        setIsRefreshing(false);
      }, 1000);
    }
  }, [activeView]);


  const renderView = () => {
    const commonProps = {
      onError: handleError,
      onSuccess: handleSuccess,
      isLoading: handleLoading
    };

    switch (activeView) {
      case 'analysts':
        return <AnalystManagement />;
      case 'availability':
        return <Availability timezone={timezone} activeTab={activeAvailabilityTab} onTabChange={setActiveAvailabilityTab} />;
      case 'conflicts':
        return <ConflictManagement activeTab={activeConflictTab} onTabChange={setActiveConflictTab} />;
      case 'analytics':
        return <Analytics />;
      case 'constraints':
        return <ConstraintManagement />;
      case 'algorithms':
        return <AlgorithmManagement />;
      case 'export':
        return <CalendarExport {...commonProps} />;
      case 'dashboard':
        return <Dashboard onViewChange={setActiveView} onError={handleError} onSuccess={handleSuccess} isLoading={handleLoading} onRefresh={handleRefresh} isRefreshing={isRefreshing} />;
      case 'schedule':
      default:
        return (
          <ScheduleCalendar
            onViewChange={() => { }}
            date={calendarDate}
            setDate={setCalendarDate}
            view={calendarView}
            setView={setCalendarView}
            timezone={timezone}
            {...commonProps}
          />
        );
    }
  };

  return (
    <ActionPromptProvider>
      <div className={`flex h-screen bg-background text-foreground transition-colors duration-200 ${theme}`}>
        <CollapsibleSidebar
          isOpen={sidebarOpen}
          onViewChange={handleViewChange}
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
            activeAvailabilityTab={activeAvailabilityTab}
            onAvailabilityTabChange={setActiveAvailabilityTab}
            activeConflictTab={activeConflictTab}
            onConflictTabChange={setActiveConflictTab}
            onRefresh={handleRefresh}
            isRefreshing={isRefreshing}
          />
          <main className="flex-1 overflow-auto relative">
            {isLoading && (
              <div className="absolute inset-0 bg-background/50 flex items-center justify-center z-10">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            )}
            {renderView()}
          </main>
        </div>
        {toast && (
          <Toast
            message={toast.message}
            type={toast.type}
            onClose={() => setToast(null)}
          />
        )}
      </div>
    </ActionPromptProvider>
  );
}

export default App;
