import { useEffect, useState, useCallback, useRef } from 'react';
import { notificationService, Notification } from '../services/notificationService';
import { apiService } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { useWebSocket } from './useWebSocket';

export const useNotifications = () => {
  const { user } = useAuth(); // Assuming useAuth provides current user info
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const isFetchingRef = useRef(false);
  const { on, isConnected } = useWebSocket();

  const fetchNotifications = useCallback(async () => {
    if (!user || isFetchingRef.current) return;

    isFetchingRef.current = true;
    try {
      // Fetch notifications for the current user (and analyst if linked)
      const data = await apiService.getNotifications(user.id, user.analystId || undefined);

      // Transform backend notification to frontend format if needed
      // Backend returns: { id, type, title, message, isRead, priority, metadata, createdAt, ... }
      // Frontend expects: Notification interface

      const formattedNotifications = data.map((n: any) => ({
        ...n,
        timestamp: new Date(n.createdAt),
        // Ensure metadata is parsed if it comes as string (though apiService should handle it if using axios transform)
        metadata: typeof n.metadata === 'string' ? JSON.parse(n.metadata) : n.metadata
      }));

      setNotifications(formattedNotifications);
      setUnreadCount(formattedNotifications.filter((n: any) => !n.isRead).length);
    } catch (error) {
      console.error('Failed to fetch notifications:', error);
    } finally {
      isFetchingRef.current = false;
    }
  }, [user]);

  useEffect(() => {
    if (!user) return;

    // Fetch immediately on mount
    fetchNotifications();
  }, [user, fetchNotifications]);

  // Subscribe to real-time notifications via WebSocket
  useEffect(() => {
    if (!user || !isConnected) return;

    const handleNewNotification = (notification: any) => {
      console.log('[useNotifications] Received real-time notification:', notification);

      // Format the notification to match the expected structure
      const formattedNotification: Notification = {
        ...notification,
        timestamp: new Date(notification.timestamp || notification.createdAt),
        metadata: typeof notification.metadata === 'string'
          ? JSON.parse(notification.metadata)
          : notification.metadata
      };

      // Add notification to the list
      setNotifications(prev => [formattedNotification, ...prev]);

      // Increment unread count if not read
      if (!formattedNotification.isRead) {
        setUnreadCount(prev => prev + 1);
      }
    };

    on('notification:new', handleNewNotification);
  }, [user, isConnected, on]);

  // Subscribe to local changes (optional, if we still want local optimistic updates)
  // For now, we'll rely on WebSocket for real-time updates


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

    // This should be an action prompt, not a notification
    // notificationService.addSystemNotification(
    //   'System Update Available',
    //   'ShiftPlanner v0.7.2 is available with enhanced analytics features.',
    //   'low'
    // );

    notificationService.addSuccessNotification(
      'Conflicts Resolved',
      'All 3 critical conflicts were successfully resolved using auto-fix.',
      { category: 'conflicts', tags: ['resolution', 'auto-fix'] }
    );
  };

  // Debounced refresh to prevent rapid-fire API calls
  const debouncedRefreshTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const debouncedRefresh = useCallback(() => {
    if (debouncedRefreshTimeoutRef.current) {
      clearTimeout(debouncedRefreshTimeoutRef.current);
    }
    debouncedRefreshTimeoutRef.current = setTimeout(() => {
      fetchNotifications();
    }, 300); // Wait 300ms before fetching
  }, [fetchNotifications]);

  return {
    notifications,
    unreadCount,
    refresh: fetchNotifications,
    addRecommendation,
    addHistory,
    addSystemStatus,
    addSuccess,
    addDemoNotifications,
    markAsRead: async (id: string) => {
      try {
        await apiService.markNotificationRead(id);
        debouncedRefresh();
      } catch (error) {
        console.error('Failed to mark notification as read:', error);
      }
    },
    markAllAsRead: async () => {
      if (user) {
        try {
          await apiService.markAllNotificationsRead(user.id, user.analystId || undefined);
          debouncedRefresh();
        } catch (error) {
          console.error('Failed to mark all as read:', error);
        }
      }
    },
    removeNotification: async (id: string) => {
      try {
        await apiService.deleteNotification(id);
        debouncedRefresh();
      } catch (error) {
        console.error('Failed to remove notification:', error);
      }
    },
    clearAll: async () => {
      // Not implemented in backend yet for "delete all", but mark all read is available
      if (user) {
        try {
          await apiService.markAllNotificationsRead(user.id, user.analystId || undefined);
          debouncedRefresh();
        } catch (error) {
          console.error('Failed to clear all:', error);
        }
      }
    },
  };
};