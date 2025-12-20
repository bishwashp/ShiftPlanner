import React, { createContext, useContext, useState, useEffect, useCallback, useRef, ReactNode } from 'react';
import { notificationService, Notification } from '../services/notificationService';
import { apiService } from '../services/api';
import { useAuth } from './AuthContext';
import { useWebSocket } from '../hooks/useWebSocket';

interface NotificationContextType {
    notifications: Notification[];
    unreadCount: number;
    refresh: () => void;
    addRecommendation: (title: string, message: string, metadata?: any) => string;
    addHistory: (title: string, message: string, metadata?: any) => string;
    addSystemStatus: (title: string, message: string, priority?: 'low' | 'medium' | 'high') => string;
    addSuccess: (title: string, message: string, metadata?: any) => string;
    addDemoNotifications: () => void;
    markAsRead: (id: string) => Promise<void>;
    markAllAsRead: () => Promise<void>;
    removeNotification: (id: string) => Promise<void>;
    clearAll: () => Promise<void>;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const NotificationProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const { user } = useAuth();
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const isFetchingRef = useRef(false);
    const { on, off, isConnected } = useWebSocket();

    const fetchNotifications = useCallback(async () => {
        if (!user || isFetchingRef.current) return;

        isFetchingRef.current = true;
        try {
            // Fetch notifications for the current user (and analyst if linked)
            const data = await apiService.getNotifications(
                user.id,
                user.analystId || undefined,
                user.role
            );

            const formattedNotifications = data.map((n: any) => ({
                ...n,
                timestamp: new Date(n.createdAt),
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
        fetchNotifications();
    }, [user, fetchNotifications]);

    // Subscribe to real-time notifications via WebSocket
    useEffect(() => {
        if (!user || !isConnected) return;

        const handleNewNotification = (notification: any) => {
            console.log('[NotificationProvider] Received real-time notification:', notification);

            const formattedNotification: Notification = {
                ...notification,
                timestamp: new Date(notification.timestamp || notification.createdAt),
                metadata: typeof notification.metadata === 'string'
                    ? JSON.parse(notification.metadata)
                    : notification.metadata
            };

            setNotifications(prev => [formattedNotification, ...prev]);

            if (!formattedNotification.isRead) {
                setUnreadCount(prev => prev + 1);
            }
        };

        on('notification:new', handleNewNotification);
        return () => {
            off('notification:new', handleNewNotification);
        };
    }, [user, isConnected, on, off]);

    // Debounced refresh
    const debouncedRefreshTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const debouncedRefresh = useCallback(() => {
        if (debouncedRefreshTimeoutRef.current) {
            clearTimeout(debouncedRefreshTimeoutRef.current);
        }
        debouncedRefreshTimeoutRef.current = setTimeout(() => {
            fetchNotifications();
        }, 300);
    }, [fetchNotifications]);

    const contextValue: NotificationContextType = {
        notifications,
        unreadCount,
        refresh: fetchNotifications,
        addRecommendation: (title, message, metadata) => notificationService.addRecommendationNotification(title, message, metadata),
        addHistory: (title, message, metadata) => notificationService.addHistoryNotification(title, message, metadata),
        addSystemStatus: (title, message, priority) => notificationService.addSystemNotification(title, message, priority || 'medium'),
        addSuccess: (title, message, metadata) => notificationService.addSuccessNotification(title, message, metadata),
        addDemoNotifications: () => {
            // Implementation from original hook
            notificationService.addRecommendationNotification(
                'Schedule Optimization Suggestion', 'Consider adding 2 more analysts...', { category: 'scheduling', tags: ['optimization'] }
            );
            // ... (simplified demo logic)
        },
        markAsRead: async (id: string) => {
            try {
                await apiService.markNotificationRead(id);
                // Optimistic update
                setNotifications(prev => prev.map(n => n.id === id ? { ...n, isRead: true } : n));
                setUnreadCount(prev => Math.max(0, prev - 1));
            } catch (error) {
                console.error('Failed to mark notification as read:', error);
                debouncedRefresh(); // Revert on failure
            }
        },
        markAllAsRead: async () => {
            if (user) {
                try {
                    await apiService.markAllNotificationsRead(user.id, user.analystId || undefined, user.role);
                    // Optimistic update
                    setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
                    setUnreadCount(0);
                } catch (error) {
                    console.error('Failed to mark all as read:', error);
                    debouncedRefresh();
                }
            }
        },
        removeNotification: async (id: string) => {
            try {
                await apiService.deleteNotification(id);
                setNotifications(prev => prev.filter(n => n.id !== id));
            } catch (error) {
                console.error('Failed to remove notification:', error);
                debouncedRefresh();
            }
        },
        clearAll: async () => {
            if (user) {
                try {
                    await apiService.deleteAllNotifications(user.id, user.analystId || undefined, user.role);
                    setNotifications([]);
                    setUnreadCount(0);
                } catch (error) {
                    console.error('Failed to clear all:', error);
                    debouncedRefresh();
                }
            }
        }
    };

    return (
        <NotificationContext.Provider value={contextValue}>
            {children}
        </NotificationContext.Provider>
    );
};

export const useNotifications = () => {
    const context = useContext(NotificationContext);
    if (context === undefined) {
        throw new Error('useNotifications must be used within a NotificationProvider');
    }
    return context;
};
