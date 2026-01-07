import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CalendarBlank,
  Users,
  Clock,
  Warning,
  ChartBar,
  Cpu,
  SquaresFour,
  Bell,
  Faders
} from '@phosphor-icons/react';
import NotificationCenter from '../NotificationCenter';
import AnimatedAppIcon from '../common/AnimatedAppIcon';
import { GeoSelector } from '../common/GeoSelector';
import { useNotifications } from '../../hooks/useNotifications';

export type View = 'schedule' | 'dashboard' | 'analysts' | 'availability' | 'conflicts' | 'analytics' | 'constraints' | 'algorithms' | 'export' | 'regions' | 'shifts' | 'admin';

interface CollapsibleSidebarProps {
  isOpen: boolean;
  onViewChange: (view: View) => void;
  activeView: View;
  activeAvailabilityTab?: 'holidays' | 'absences';
  onAvailabilityTabChange?: (tab: 'holidays' | 'absences') => void;
  activeConflictTab?: 'critical' | 'recommended';
  onConflictTabChange?: (tab: 'critical' | 'recommended') => void;
}

// Map view names to URL paths
const viewToPath: Record<View, string> = {
  dashboard: '/dashboard',
  schedule: '/calendar',
  analysts: '/analysts',
  availability: '/availability',
  conflicts: '/conflicts',
  analytics: '/analytics',
  constraints: '/constraints',
  algorithms: '/algorithms',
  export: '/export',
  regions: '/admin/regions',
  shifts: '/admin/shifts',
  admin: '/admin/portal',
};

const CollapsibleSidebar: React.FC<CollapsibleSidebarProps> = ({ isOpen, onViewChange, activeView, ...props }) => {
  const navigate = useNavigate();
  const [notificationCenterOpen, setNotificationCenterOpen] = useState(false);
  const { unreadCount } = useNotifications();

  const handleNavigation = (view: View) => {
    onViewChange(view);
    navigate(viewToPath[view]);
  };


  // Define navigation structure with groups
  const navGroups = [
    {
      id: 'overview_group',
      label: 'Overview',
      items: [
        { view: 'dashboard', label: 'Dashboard', icon: SquaresFour },
      ]
    },
    {
      id: 'schedule_group',
      label: 'Schedule',
      items: [
        { view: 'schedule', label: 'Calendar', icon: CalendarBlank },
        {
          view: 'conflicts',
          label: 'Conflicts',
          icon: Warning,
          subItems: [
            { id: 'critical', label: 'Critical' },
            { id: 'recommended', label: 'Recommended' }
          ]
        },
        { view: 'analytics', label: 'Analytics', icon: ChartBar },
      ]
    },
    {
      id: 'team_group',
      label: 'Team',
      items: [
        { view: 'analysts', label: 'Analysts', icon: Users },
        {
          view: 'availability',
          label: 'Availability',
          icon: Clock,
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
        { view: 'constraints', label: 'Constraints', icon: Faders },
        { view: 'algorithms', label: 'Algorithms', icon: Cpu },
      ]
    },
  ];

  return (
    <div className={`
      relative
      ${isOpen ? 'w-64' : 'w-16'}
      m-3
      transition-[width] duration-300 ease-out
      z-50
    `}>
      {/* Floating Glass Sidebar */}
      <aside
        className={`
          w-full h-full
          flex flex-col
          surface-shell
          overflow-hidden
          max-h-[calc(100vh-24px)]
        `}
      >
        {/* Header */}
        <div className={`flex items-center mb-4 p-4 ${isOpen ? 'space-x-3' : 'justify-center'}`}>
          <div className="w-8 h-8 flex items-center justify-center flex-shrink-0">
            <AnimatedAppIcon className="w-full h-full" />
          </div>
          <div className={`flex items-center gap-2 transition-opacity duration-200 ${isOpen ? 'opacity-100' : 'opacity-0 w-0 overflow-hidden'}`}>
            <h1 className="text-3xl brand-text whitespace-nowrap">
              Sine
            </h1>
            <GeoSelector className="mt-1" />
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-2 overflow-y-auto">
          <div className="space-y-6">
            {navGroups.map((group, groupIndex) => (
              <div key={group.id}>
                {/* Group Label - Only show when open */}
                <div className={`
                  px-3 mb-2 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider transition-opacity duration-200
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
                          onClick={() => handleNavigation(item.view as View)}
                          className={`
                            w-full flex items-center rounded-lg text-sm font-medium transition-colors duration-150
                            ${isOpen ? 'space-x-3 px-3 py-2' : 'justify-center p-3'}
                            ${isActive
                              ? 'bg-primary/10 text-primary font-medium'
                              : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/5 hover:text-gray-900 dark:hover:text-gray-200'
                            }
                            min-height-44px
                          `}
                          title={!isOpen ? item.label : ''}
                        >
                          <item.icon className="h-5 w-5 flex-shrink-0" weight="duotone" />
                          <span className={`transition-opacity duration-200 ${isOpen ? 'opacity-100' : 'opacity-0 w-0 overflow-hidden'} flex-1 text-left`}>
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
                                    } else if (item.view === 'conflicts' && props.onConflictTabChange) {
                                      props.onConflictTabChange(subItem.id as 'critical' | 'recommended');
                                    }
                                  }}
                                  className={`
                                    w-full flex items-center rounded-md text-sm transition-colors duration-150 px-3 py-1.5
                                    ${(item.view === 'availability' && props.activeAvailabilityTab === subItem.id) ||
                                      (item.view === 'conflicts' && props.activeConflictTab === subItem.id)
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
              relative w-full flex items-center rounded-lg text-sm font-medium transition-colors duration-150
              ${isOpen ? 'space-x-3 px-3 py-2' : 'justify-center p-3'}
              ${notificationCenterOpen
                ? 'bg-primary/10 text-primary'
                : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/5 hover:text-gray-900 dark:hover:text-white'
              }
              min-height-44px
            `}
            title={!isOpen ? "Notifications" : ''}
          >
            <Bell className="h-5 w-5 flex-shrink-0" weight="duotone" />
            <span className={`transition-opacity duration-200 ${isOpen ? 'opacity-100' : 'opacity-0 w-0 overflow-hidden'}`}>
              Notifications
            </span>
            {unreadCount > 0 && (
              <span className={`
                absolute bg-destructive text-destructive-foreground text-xs rounded-full flex items-center justify-center
                transition-[width,height] duration-200
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