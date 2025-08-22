import { useEffect, useState } from 'react';
import { notificationService, Notification } from '../services/notificationService';

export const useNotifications = () => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    // Initial load
    setNotifications(notificationService.getNotifications());
    setUnreadCount(notificationService.getUnreadCount());

    // Subscribe to changes
    const unsubscribe = notificationService.subscribe((newNotifications) => {
      setNotifications(newNotifications);
      setUnreadCount(notificationService.getUnreadCount());
    });

    return unsubscribe;
  }, []);

  // Helper methods for common notification scenarios
  const addConflictNotification = (title: string, message: string, actionLabel?: string, actionCallback?: () => void) => {
    return notificationService.addConflictNotification(title, message, 
      actionLabel && actionCallback ? { label: actionLabel, callback: actionCallback } : undefined
    );
  };

  const addScheduleIssue = (title: string, message: string) => {
    return notificationService.addScheduleNotification(title, message, 'high');
  };

  const addSystemAlert = (title: string, message: string) => {
    return notificationService.addSystemNotification(title, message, 'medium');
  };

  // Add some demo notifications for testing
  const addDemoNotifications = () => {
    notificationService.addConflictNotification(
      'Schedule Conflict Detected',
      'John Smith has overlapping shifts on August 25th. Review and resolve conflicts.',
      {
        label: 'Review Conflicts',
        callback: () => console.log('Navigating to conflicts view')
      }
    );

    notificationService.addScheduleNotification(
      'Weekend Coverage Gap',
      'No analyst assigned for Saturday morning shift (Aug 24, 9:00 AM)',
      'high'
    );

    notificationService.addSystemNotification(
      'System Update Available',
      'ShiftPlanner v0.7.2 is available with enhanced analytics features.',
      'low'
    );

    notificationService.addNotification({
      type: 'warning',
      priority: 'medium',
      title: 'Vacation Overlap Warning',
      message: 'Multiple analysts have requested vacation for the same week in September.',
      isActionable: true,
      action: {
        label: 'View Vacations',
        callback: () => console.log('Navigating to vacation management')
      }
    });
  };

  return {
    notifications,
    unreadCount,
    addConflictNotification,
    addScheduleIssue,
    addSystemAlert,
    addDemoNotifications,
    markAsRead: notificationService.markAsRead.bind(notificationService),
    markAllAsRead: notificationService.markAllAsRead.bind(notificationService),
    removeNotification: notificationService.removeNotification.bind(notificationService),
    clearAll: notificationService.clearAll.bind(notificationService),
  };
};