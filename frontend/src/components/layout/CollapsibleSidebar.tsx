import React, { useState, useEffect } from 'react';
import {
  CalendarDays,
  LayoutDashboard,
  Users,
  AlertTriangle,
  BarChart2,
  ListTodo,
  Cpu,
  Download
} from 'lucide-react';
import BellIcon from '../icons/BellIcon';
import NotificationCenter from '../NotificationCenter';
import { notificationService } from '../../services/notificationService';

export type View = 'schedule' | 'dashboard' | 'analysts' | 'conflicts' | 'analytics' | 'constraints' | 'algorithms' | 'export';

interface CollapsibleSidebarProps {
  isOpen: boolean;
  onViewChange: (view: View) => void;
  activeView: View;
}

const CollapsibleSidebar: React.FC<CollapsibleSidebarProps> = ({ isOpen, onViewChange, activeView }) => {
  const [notificationCenterOpen, setNotificationCenterOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (isOpen) {
      // Update unread count initially
      setUnreadCount(notificationService.getUnreadCount());
      
      // Subscribe to notification changes
      const unsubscribe = notificationService.subscribe(() => {
        setUnreadCount(notificationService.getUnreadCount());
      });

      return unsubscribe;
    }
  }, [isOpen]);


  const navItems = [
    { view: 'schedule', label: 'Schedule', icon: CalendarDays },
    { view: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { view: 'analysts', label: 'Analysts', icon: Users },
    { view: 'conflicts', label: 'Conflicts', icon: AlertTriangle },
    { view: 'analytics', label: 'Analytics', icon: BarChart2 },
    { view: 'constraints', label: 'Constraints', icon: ListTodo },
    { view: 'algorithms', label: 'Algorithms', icon: Cpu },
    { view: 'export', label: 'Export & Integration', icon: Download },
  ];

  return (
    <>
      {/* Sidebar with smooth card-like sliding animation */}
      <aside
        className={`
          ${isOpen ? 'w-64' : 'w-16'}
          bg-card text-card-foreground border-r border-border flex flex-col h-full
          transition-all duration-300 ease-in-out transform
          ${isOpen ? 'translate-x-0' : 'translate-x-0'}
          overflow-hidden shadow-lg
        `}
        style={{
          transform: isOpen ? 'translateX(0)' : 'translateX(0)',
        }}
      >
        {/* Header */}
        <div className={`flex items-center mb-4 p-4 ${isOpen ? 'space-x-2' : 'justify-center'} transition-all duration-300`}>
          <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-primary-foreground font-bold">
            SP
          </div>
          <h1 className={`text-lg font-bold transition-all duration-300 ${isOpen ? 'opacity-100' : 'opacity-0 w-0'}`}>
            ShiftPlanner
          </h1>
        </div>
        
        {/* Navigation */}
        <nav className="flex-1 px-2">
          <ul className="space-y-1">
            {navItems.map(item => (
              <li key={item.view}>
                <button
                  onClick={() => onViewChange(item.view as View)}
                  className={`
                    w-full flex items-center rounded-md text-sm font-medium transition-all duration-200
                    ${isOpen ? 'space-x-3 px-3 py-2' : 'justify-center p-3'}
                    ${activeView === item.view
                      ? 'bg-primary/10 text-primary shadow-sm'
                      : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground hover:shadow-sm'
                    }
                    min-height-44px
                  `}
                  title={!isOpen ? item.label : ''}
                >
                  <item.icon className="h-5 w-5 flex-shrink-0" />
                  <span className={`transition-all duration-300 ${isOpen ? 'opacity-100' : 'opacity-0 w-0 overflow-hidden'}`}>
                    {item.label}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </nav>

        {/* Notification Bell - Bottom */}
        <div className={`border-t border-border p-2 ${isOpen ? 'pt-4' : 'pt-2'}`}>
          <button
            onClick={() => setNotificationCenterOpen(!notificationCenterOpen)}
            className={`
              relative w-full flex items-center rounded-md text-sm font-medium transition-all duration-200
              ${isOpen ? 'space-x-3 px-3 py-2' : 'justify-center p-3'}
              ${notificationCenterOpen
                ? 'bg-primary/10 text-primary shadow-sm'
                : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground hover:shadow-sm'
              }
              min-height-44px
            `}
            title={!isOpen ? "Notifications" : ''}
          >
            <BellIcon className="h-5 w-5 flex-shrink-0" />
            <span className={`transition-all duration-300 ${isOpen ? 'opacity-100' : 'opacity-0 w-0 overflow-hidden'}`}>
              Notifications
            </span>
            {unreadCount > 0 && (
              <span className={`
                absolute bg-destructive text-destructive-foreground text-xs rounded-full flex items-center justify-center
                transition-all duration-300
                ${isOpen ? '-top-1 -right-1 h-5 w-5' : 'top-0 right-0 h-4 w-4'}
              `}>
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>
        </div>
      </aside>

      {/* Notification Center */}
      <NotificationCenter
        isOpen={notificationCenterOpen}
        onClose={() => setNotificationCenterOpen(false)}
      />
    </>
  );
};

export default CollapsibleSidebar; 