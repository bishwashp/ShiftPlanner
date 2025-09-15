export type NotificationType = 'recommendation' | 'history' | 'system' | 'success' | 'analytics';
export type NotificationPriority = 'low' | 'medium' | 'high';

export interface Notification {
  id: string;
  type: NotificationType;
  priority: NotificationPriority;
  title: string;
  message: string;
  timestamp: Date;
  isRead: boolean;
  metadata?: {
    relatedView?: string;
    analystId?: string;
    scheduleId?: string;
    conflictId?: string;
    category?: string;
    tags?: string[];
  };
}

class NotificationService {
  private notifications: Notification[] = [];
  private listeners: ((notifications: Notification[]) => void)[] = [];
  private maxNotifications = 100; // Keep last 100 notifications

  constructor() {
    this.loadFromStorage();
  }

  // Add a new notification (for recommendations, history, system status)
  addNotification(notification: Omit<Notification, 'id' | 'timestamp' | 'isRead'>): string {
    const id = `notification-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const newNotification: Notification = {
      ...notification,
      id,
      timestamp: new Date(),
      isRead: false,
    };

    // Store all notifications (recommendations, history, system status)
    this.notifications.unshift(newNotification);
    
    // Limit the number of notifications
    if (this.notifications.length > this.maxNotifications) {
      this.notifications = this.notifications.slice(0, this.maxNotifications);
    }

    this.saveToStorage();
    this.notifyListeners();
    
    return id;
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

  // Smart notification methods for recommendations, history, and system status
  addRecommendationNotification(title: string, message: string, metadata?: any): string {
    return this.addNotification({
      type: 'recommendation',
      priority: 'medium',
      title,
      message,
      metadata,
    });
  }

  addHistoryNotification(title: string, message: string, metadata?: any): string {
    return this.addNotification({
      type: 'history',
      priority: 'low',
      title,
      message,
      metadata,
    });
  }

  addSystemNotification(title: string, message: string, priority: NotificationPriority = 'medium'): string {
    return this.addNotification({
      type: 'system',
      priority,
      title,
      message,
    });
  }

  addSuccessNotification(title: string, message: string, metadata?: any): string {
    return this.addNotification({
      type: 'success',
      priority: 'low',
      title,
      message,
      metadata,
    });
  }
}

// Export singleton instance
export const notificationService = new NotificationService();