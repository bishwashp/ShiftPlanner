import React, { useState, useEffect } from 'react';
import { notificationService, Notification, NotificationType } from '../services/notificationService';
import { X, Check, AlertTriangle, Calendar, Settings, CheckCircle, AlertCircle, XCircle } from 'lucide-react';

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
      className: `h-5 w-5 ${
        priority === 'critical' ? 'text-red-500' :
        priority === 'high' ? 'text-orange-500' :
        priority === 'medium' ? 'text-yellow-500' :
        'text-blue-500'
      }` 
    };

    switch (type) {
      case 'conflict':
        return <AlertTriangle {...iconProps} />;
      case 'schedule':
        return <Calendar {...iconProps} />;
      case 'system':
        return <Settings {...iconProps} />;
      case 'success':
        return <CheckCircle {...iconProps} className="text-green-500" />;
      case 'warning':
        return <AlertCircle {...iconProps} className="text-yellow-500" />;
      case 'error':
        return <XCircle {...iconProps} className="text-red-500" />;
      default:
        return <Settings {...iconProps} />;
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

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 z-40 bg-black/20" 
        onClick={onClose}
      />
      
      {/* Notification Panel */}
      <div className="fixed bottom-20 left-4 z-50 w-96 max-w-[calc(100vw-2rem)] bg-card border border-border rounded-lg shadow-lg">
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
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Filter tabs */}
        <div className="flex border-b border-border">
          <button
            onClick={() => setFilter('unread')}
            className={`flex-1 px-4 py-2 text-sm font-medium transition-colors ${
              filter === 'unread' 
                ? 'bg-primary/10 text-primary border-b-2 border-primary' 
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Unread ({notificationService.getUnreadCount()})
          </button>
          <button
            onClick={() => setFilter('all')}
            className={`flex-1 px-4 py-2 text-sm font-medium transition-colors ${
              filter === 'all' 
                ? 'bg-primary/10 text-primary border-b-2 border-primary' 
                : 'text-muted-foreground hover:text-foreground'
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
        <div className="max-h-96 overflow-y-auto">
          {filteredNotifications.length === 0 ? (
            <div className="p-6 text-center text-muted-foreground">
              <div className="mb-2">
                <Check className="h-8 w-8 mx-auto text-muted-foreground/50" />
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
                  className={`p-4 hover:bg-muted/50 transition-colors ${
                    !notification.isRead ? 'bg-primary/5' : ''
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 mt-1">
                      {getNotificationIcon(notification.type, notification.priority)}
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1">
                          <h4 className={`text-sm font-medium ${
                            !notification.isRead ? 'text-foreground' : 'text-muted-foreground'
                          }`}>
                            {notification.title}
                          </h4>
                          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                            {notification.message}
                          </p>
                          <p className="text-xs text-muted-foreground mt-2">
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
                              <Check className="h-3 w-3" />
                            </button>
                          )}
                          <button
                            onClick={() => handleRemove(notification.id)}
                            className="p-1 hover:bg-muted rounded transition-colors"
                            title="Remove"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      </div>
                      
                      {/* Action button */}
                      {notification.action && (
                        <button
                          onClick={() => {
                            notification.action?.callback();
                            handleMarkAsRead(notification.id);
                          }}
                          className="mt-2 px-3 py-1 text-xs bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
                        >
                          {notification.action.label}
                        </button>
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