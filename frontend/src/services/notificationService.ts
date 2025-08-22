export type NotificationType = 'conflict' | 'schedule' | 'system' | 'success' | 'warning' | 'error';
export type NotificationPriority = 'low' | 'medium' | 'high' | 'critical';

export interface Notification {
  id: string;
  type: NotificationType;
  priority: NotificationPriority;
  title: string;
  message: string;
  timestamp: Date;
  isRead: boolean;
  isActionable: boolean;
  action?: {
    label: string;
    callback: () => void;
  };
  metadata?: {
    relatedView?: string;
    analystId?: string;
    scheduleId?: string;
  };
}

class NotificationService {
  private notifications: Notification[] = [];
  private listeners: ((notifications: Notification[]) => void)[] = [];
  private maxNotifications = 100; // Keep last 100 notifications

  constructor() {
    this.loadFromStorage();
  }

  // Add a new notification
  addNotification(notification: Omit<Notification, 'id' | 'timestamp' | 'isRead'>): string {
    const id = `notification-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const newNotification: Notification = {
      ...notification,
      id,
      timestamp: new Date(),
      isRead: false,
    };

    // Only keep actionable notifications or high/critical priority
    if (notification.isActionable || ['high', 'critical'].includes(notification.priority)) {
      this.notifications.unshift(newNotification);
      
      // Limit the number of notifications
      if (this.notifications.length > this.maxNotifications) {
        this.notifications = this.notifications.slice(0, this.maxNotifications);
      }

      this.saveToStorage();
      this.notifyListeners();
      
      return id;
    }
    
    return id; // Still return ID even if not stored
  }

  // Get all notifications
  getNotifications(): Notification[] {
    return [...this.notifications];
  }

  // Get unread notifications
  getUnreadNotifications(): Notification[] {
    return this.notifications.filter(n => !n.isRead);
  }

  // Get unread count
  getUnreadCount(): number {
    return this.notifications.filter(n => !n.isRead).length;
  }

  // Mark notification as read
  markAsRead(id: string): void {
    const notification = this.notifications.find(n => n.id === id);
    if (notification) {
      notification.isRead = true;
      this.saveToStorage();
      this.notifyListeners();
    }
  }

  // Mark all notifications as read
  markAllAsRead(): void {
    this.notifications.forEach(n => n.isRead = true);
    this.saveToStorage();
    this.notifyListeners();
  }

  // Remove notification
  removeNotification(id: string): void {
    this.notifications = this.notifications.filter(n => n.id !== id);
    this.saveToStorage();
    this.notifyListeners();
  }

  // Clear all notifications
  clearAll(): void {
    this.notifications = [];
    this.saveToStorage();
    this.notifyListeners();
  }

  // Subscribe to notification changes
  subscribe(listener: (notifications: Notification[]) => void): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  // Notify all listeners
  private notifyListeners(): void {
    this.listeners.forEach(listener => listener([...this.notifications]));
  }

  // Save to localStorage
  private saveToStorage(): void {
    try {
      localStorage.setItem('shiftplanner-notifications', JSON.stringify(this.notifications));
    } catch (error) {
      console.warn('Failed to save notifications to storage:', error);
    }
  }

  // Load from localStorage
  private loadFromStorage(): void {
    try {
      const stored = localStorage.getItem('shiftplanner-notifications');
      if (stored) {
        const parsed = JSON.parse(stored);
        this.notifications = parsed.map((n: any) => ({
          ...n,
          timestamp: new Date(n.timestamp),
        }));
      }
    } catch (error) {
      console.warn('Failed to load notifications from storage:', error);
      this.notifications = [];
    }
  }

  // Smart notification methods for common scenarios
  addConflictNotification(title: string, message: string, action?: Notification['action']): string {
    return this.addNotification({
      type: 'conflict',
      priority: 'high',
      title,
      message,
      isActionable: true,
      action,
    });
  }

  addScheduleNotification(title: string, message: string, priority: NotificationPriority = 'medium'): string {
    return this.addNotification({
      type: 'schedule',
      priority,
      title,
      message,
      isActionable: priority === 'high' || priority === 'critical',
    });
  }

  addSystemNotification(title: string, message: string, priority: NotificationPriority = 'low'): string {
    return this.addNotification({
      type: 'system',
      priority,
      title,
      message,
      isActionable: false,
    });
  }
}

// Export singleton instance
export const notificationService = new NotificationService();