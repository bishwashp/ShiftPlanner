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

  // Helper methods for recommendations, history, and system status
  const addRecommendation = (title: string, message: string, metadata?: any) => {
    return notificationService.addRecommendationNotification(title, message, metadata);
  };

  const addHistory = (title: string, message: string, metadata?: any) => {
    return notificationService.addHistoryNotification(title, message, metadata);
  };

  const addSystemStatus = (title: string, message: string, priority: 'low' | 'medium' | 'high' = 'medium') => {
    return notificationService.addSystemNotification(title, message, priority);
  };

  const addSuccess = (title: string, message: string, metadata?: any) => {
    return notificationService.addSuccessNotification(title, message, metadata);
  };

  // Add some demo notifications for testing (recommendations, history, system status)
  const addDemoNotifications = () => {
    notificationService.addRecommendationNotification(
      'Schedule Optimization Suggestion',
      'Consider adding 2 more analysts for weekend coverage to improve fairness score.',
      { category: 'scheduling', tags: ['optimization', 'fairness'] }
    );

    notificationService.addHistoryNotification(
      'Schedule Generated Successfully',
      'Generated schedule for August 2024 with 95% fairness score.',
      { category: 'scheduling', tags: ['generation', 'success'] }
    );

    notificationService.addSystemNotification(
      'System Update Available',
      'ShiftPlanner v0.7.2 is available with enhanced analytics features.',
      'low'
    );

    notificationService.addSuccessNotification(
      'Conflicts Resolved',
      'All 3 critical conflicts were successfully resolved using auto-fix.',
      { category: 'conflicts', tags: ['resolution', 'auto-fix'] }
    );
  };

  return {
    notifications,
    unreadCount,
    addRecommendation,
    addHistory,
    addSystemStatus,
    addSuccess,
    addDemoNotifications,
    markAsRead: notificationService.markAsRead.bind(notificationService),
    markAllAsRead: notificationService.markAllAsRead.bind(notificationService),
    removeNotification: notificationService.removeNotification.bind(notificationService),
    clearAll: notificationService.clearAll.bind(notificationService),
  };
};