import React, { useState, useEffect } from 'react';
import { notificationService, Notification, NotificationType } from '../services/notificationService';
import { XMarkIcon, CheckIcon, ExclamationTriangleIcon, CalendarIcon, Cog6ToothIcon, CheckCircleIcon, ChartBarIcon } from '@heroicons/react/24/outline';

interface NotificationCenterProps {
  isOpen: boolean;
  onClose: () => void;
}

const NotificationCenter: React.FC<NotificationCenterProps> = ({ isOpen, onClose }) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [filter, setFilter] = useState<'all' | 'unread'>('unread');

  useEffect(() => {
    if (isOpen) {
      const unsubscribe = notificationService.subscribe(setNotifications);
      setNotifications(notificationService.getNotifications());

      return unsubscribe;
    }
  }, [isOpen]);

  const getNotificationIcon = (type: NotificationType, priority: string) => {
    const iconProps = {
      className: `h-5 w-5 ${priority === 'critical' ? 'text-red-500' :
        priority === 'high' ? 'text-orange-500' :
          priority === 'medium' ? 'text-yellow-500' :
            'text-blue-500'
        }`
    };

    switch (type) {
      case 'recommendation':
        return <ExclamationTriangleIcon {...iconProps} className="text-blue-500" />;
      case 'history':
        return <CalendarIcon {...iconProps} className="text-gray-500" />;
      case 'system':
        return <Cog6ToothIcon {...iconProps} />;
      case 'success':
        return <CheckCircleIcon {...iconProps} className="text-green-500" />;
      case 'analytics':
        return <ChartBarIcon {...iconProps} className="text-purple-500" />;
      default:
        return <Cog6ToothIcon {...iconProps} />;
    }
  };

  const filteredNotifications = notifications.filter(n =>
    filter === 'all' || !n.isRead
  );

  const formatTimestamp = (date: Date) => {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return date.toLocaleDateString();
  };

  const handleMarkAsRead = (id: string) => {
    notificationService.markAsRead(id);
  };

  const handleMarkAllAsRead = () => {
    notificationService.markAllAsRead();
  };

  const handleRemove = (id: string) => {
    notificationService.removeNotification(id);
  };

  const handleClearAll = () => {
    notificationService.clearAll();
  };

  // Handle click outside to close
  useEffect(() => {
    if (isOpen) {
      const handleClickOutside = (event: MouseEvent) => {
        // If the click is on the backdrop or outside the notification panel
        const target = event.target as HTMLElement;
        if (target.closest('.glass-static') === null && !target.closest('button[title="Notifications"]')) {
          onClose();
        }
      };

      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop - Fixed to cover screen, but might be contained if parent has transform */}
      <div
        className="fixed inset-0 z-40 bg-black/5 dark:bg-black/20 backdrop-blur-[1px]"
        onClick={onClose}
      />

      {/* Notification Panel - Absolute relative to Sidebar Wrapper */}
      <div className="absolute bottom-14 left-4 z-50 w-80 sm:w-96 max-w-[calc(100vw-2rem)] glass-static animate-in slide-in-from-bottom-2 duration-200 shadow-2xl border border-white/20">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-card-foreground">Notifications</h3>
            {notificationService.getUnreadCount() > 0 && (
              <span className="px-2 py-1 text-xs bg-primary text-primary-foreground rounded-full">
                {notificationService.getUnreadCount()}
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-muted rounded-md transition-colors"
          >
            <XMarkIcon className="h-4 w-4" />
          </button>
        </div>

        {/* Filter tabs */}
        <div className="flex border-b border-border">
          <button
            onClick={() => setFilter('unread')}
            className={`flex-1 px-4 py-2 text-sm font-medium transition-colors ${filter === 'unread'
              ? 'bg-primary/10 text-primary border-b-2 border-primary'
              : 'text-gray-700 dark:text-gray-200 hover:text-foreground'
              }`}
          >
            Unread ({notificationService.getUnreadCount()})
          </button>
          <button
            onClick={() => setFilter('all')}
            className={`flex-1 px-4 py-2 text-sm font-medium transition-colors ${filter === 'all'
              ? 'bg-primary/10 text-primary border-b-2 border-primary'
              : 'text-gray-700 dark:text-gray-200 hover:text-foreground'
              }`}
          >
            All ({notifications.length})
          </button>
        </div>

        {/* Action buttons */}
        {filteredNotifications.length > 0 && (
          <div className="flex gap-2 p-2 border-b border-border">
            {filter === 'unread' && notificationService.getUnreadCount() > 0 && (
              <button
                onClick={handleMarkAllAsRead}
                className="flex-1 px-3 py-1 text-xs bg-muted hover:bg-muted/80 rounded-md transition-colors"
              >
                Mark all read
              </button>
            )}
            <button
              onClick={handleClearAll}
              className="flex-1 px-3 py-1 text-xs bg-destructive/10 text-destructive hover:bg-destructive/20 rounded-md transition-colors"
            >
              Clear all
            </button>
          </div>
        )}

        {/* Notifications list */}
        <div className="max-h-[60vh] overflow-y-auto">
          {filteredNotifications.length === 0 ? (
            <div className="p-6 text-center text-gray-700 dark:text-gray-200">
              <div className="mb-2">
                <CheckIcon className="h-8 w-8 mx-auto text-gray-700 dark:text-gray-200/50" />
              </div>
              <p className="text-sm">
                {filter === 'unread' ? 'No unread notifications' : 'No notifications'}
              </p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {filteredNotifications.map((notification) => (
                <div
                  key={notification.id}
                  className={`p-4 hover:bg-muted/50 transition-colors ${!notification.isRead ? 'bg-primary/5' : ''
                    }`}
                >
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 mt-1">
                      {getNotificationIcon(notification.type, notification.priority)}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1">
                          <h4 className={`text-sm font-medium ${!notification.isRead ? 'text-foreground' : 'text-gray-700 dark:text-gray-200'
                            }`}>
                            {notification.title}
                          </h4>
                          <p className="text-xs text-gray-700 dark:text-gray-200 mt-1 line-clamp-2">
                            {notification.message}
                          </p>
                          <p className="text-xs text-gray-700 dark:text-gray-200 mt-2">
                            {formatTimestamp(notification.timestamp)}
                          </p>
                        </div>

                        <div className="flex items-center gap-1">
                          {!notification.isRead && (
                            <button
                              onClick={() => handleMarkAsRead(notification.id)}
                              className="p-1 hover:bg-muted rounded transition-colors"
                              title="Mark as read"
                            >
                              <CheckIcon className="h-3 w-3" />
                            </button>
                          )}
                          <button
                            onClick={() => handleRemove(notification.id)}
                            className="p-1 hover:bg-muted rounded transition-colors"
                            title="Remove"
                          >
                            <XMarkIcon className="h-3 w-3" />
                          </button>
                        </div>
                      </div>

                      {/* Notification metadata */}
                      {notification.metadata?.tags && (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {notification.metadata.tags.map((tag, index) => (
                            <span key={index} className="px-2 py-1 bg-muted text-gray-700 dark:text-gray-200 rounded text-xs">
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default NotificationCenter;