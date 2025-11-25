import React, { useState, useEffect } from 'react';
import {
  CalendarDaysIcon,
  UsersIcon,
  ClockIcon,
  ExclamationTriangleIcon,
  ChartBarIcon,
  ClipboardDocumentListIcon,
  CpuChipIcon,
  Squares2X2Icon,
  BellIcon
} from '@heroicons/react/24/outline';
import NotificationCenter from '../NotificationCenter';
import { notificationService } from '../../services/notificationService';

export type View = 'schedule' | 'dashboard' | 'analysts' | 'availability' | 'conflicts' | 'analytics' | 'constraints' | 'algorithms' | 'export';

interface CollapsibleSidebarProps {
  isOpen: boolean;
  onViewChange: (view: View) => void;
  activeView: View;
  activeAvailabilityTab?: 'holidays' | 'absences';
  onAvailabilityTabChange?: (tab: 'holidays' | 'absences') => void;
}

const CollapsibleSidebar: React.FC<CollapsibleSidebarProps> = ({ isOpen, onViewChange, activeView, ...props }) => {
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


  // Define navigation structure with groups
  const navGroups = [
    {
      id: 'overview_group',
      label: 'Overview',
      items: [
        { view: 'dashboard', label: 'Dashboard', icon: Squares2X2Icon },
      ]
    },
    {
      id: 'schedule_group',
      label: 'Schedule',
      items: [
        { view: 'schedule', label: 'Calendar', icon: CalendarDaysIcon },
        { view: 'conflicts', label: 'Conflicts', icon: ExclamationTriangleIcon },
        { view: 'analytics', label: 'Analytics', icon: ChartBarIcon },
      ]
    },
    {
      id: 'team_group',
      label: 'Team',
      items: [
        { view: 'analysts', label: 'Analysts', icon: UsersIcon },
        {
          view: 'availability',
          label: 'Availability',
          icon: ClockIcon,
          subItems: [
            { id: 'holidays', label: 'Holidays' },
            { id: 'absences', label: 'Absences' }
          ]
        },
      ]
    },
    {
      id: 'config_group',
      label: 'Configuration',
      items: [
        { view: 'constraints', label: 'Constraints', icon: ClipboardDocumentListIcon },
        { view: 'algorithms', label: 'Algorithms', icon: CpuChipIcon },
      ]
    }
  ];

  return (
    <div className={`
      relative
      ${isOpen ? 'w-64' : 'w-16'}
      m-3
      transition-all duration-300 ease-in-out
      z-50
    `}>
      {/* Floating Glass Sidebar */}
      <aside
        className={`
          w-full h-full
          flex flex-col
          rounded-2xl
          bg-white/60 dark:bg-gray-900/50 backdrop-blur-xl
          border border-gray-300/50 dark:border-white/10
          shadow-2xl shadow-black/20
          overflow-hidden
          max-h-[calc(100vh-24px)]
        `}
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
        <nav className="flex-1 px-2 overflow-y-auto">
          <div className="space-y-6">
            {navGroups.map((group, groupIndex) => (
              <div key={group.id}>
                {/* Group Label - Only show when open */}
                <div className={`
                  px-3 mb-2 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider transition-all duration-300
                  ${isOpen ? 'opacity-100' : 'opacity-0 h-0 overflow-hidden'}
                `}>
                  {group.label}
                </div>

                <ul className="space-y-1">
                  {group.items.map(item => {
                    const isActive = activeView === item.view;
                    const hasSubItems = 'subItems' in item;
                    const showSubItems = isOpen && isActive && hasSubItems;

                    return (
                      <li key={item.view}>
                        <button
                          onClick={() => onViewChange(item.view as View)}
                          className={`
                            w-full flex items-center rounded-lg text-sm font-medium transition-all duration-200
                            ${isOpen ? 'space-x-3 px-3 py-2' : 'justify-center p-3'}
                            ${isActive
                              ? 'bg-primary/20 text-primary border-l-2 border-primary shadow-lg shadow-primary/20'
                              : 'text-gray-700 dark:text-gray-300 hover:bg-gray-300/60 dark:hover:bg-white/5 hover:text-gray-900 dark:hover:text-white hover:translate-x-0.5'
                            }
                            min-height-44px
                          `}
                          title={!isOpen ? item.label : ''}
                        >
                          <item.icon className="h-5 w-5 flex-shrink-0" />
                          <span className={`transition-all duration-300 ${isOpen ? 'opacity-100' : 'opacity-0 w-0 overflow-hidden'} flex-1 text-left`}>
                            {item.label}
                          </span>
                        </button>

                        {/* Sub-items */}
                        {showSubItems && item.subItems && (
                          <ul className="mt-1 ml-4 space-y-1 border-l-2 border-primary/20 pl-2 animate-in slide-in-from-top-2 duration-200">
                            {item.subItems.map(subItem => (
                              <li key={subItem.id}>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (item.view === 'availability' && props.onAvailabilityTabChange) {
                                      props.onAvailabilityTabChange(subItem.id as 'holidays' | 'absences');
                                    }
                                  }}
                                  className={`
                                    w-full flex items-center rounded-md text-sm transition-all duration-200 px-3 py-1.5
                                    ${(item.view === 'availability' && props.activeAvailabilityTab === subItem.id)
                                      ? 'text-primary font-medium bg-primary/5'
                                      : 'text-gray-700 dark:text-gray-200 hover:text-foreground hover:bg-muted/50'
                                    }
                                  `}
                                >
                                  {subItem.label}
                                </button>
                              </li>
                            ))}
                          </ul>
                        )}
                      </li>
                    );
                  })}
                </ul>

                {/* Separator between groups (except last) */}
                {groupIndex < navGroups.length - 1 && isOpen && (
                  <div className="my-3 border-t border-gray-200/50 dark:border-white/10 mx-3" />
                )}
              </div>
            ))}
          </div>
        </nav>

        {/* Notification Bell - Bottom */}
        <div className={`border-t border-gray-200/50 dark:border-white/10 p-2 ${isOpen ? 'pt-4' : 'pt-2'}`}>
          <button
            onClick={() => setNotificationCenterOpen(!notificationCenterOpen)}
            className={`
              relative w-full flex items-center rounded-lg text-sm font-medium transition-all duration-200
              ${isOpen ? 'space-x-3 px-3 py-2' : 'justify-center p-3'}
              ${notificationCenterOpen
                ? 'bg-primary/20 text-primary shadow-lg shadow-primary/20'
                : 'text-gray-700 dark:text-gray-300 hover:bg-gray-200/50 dark:hover:bg-white/5 hover:text-gray-900 dark:hover:text-white'
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
    </div>
  );
};

export default CollapsibleSidebar; 