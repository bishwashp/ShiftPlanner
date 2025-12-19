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
  importanceScore: number; // 1-10 scale (10 = most important)
  requiresAction: boolean; // Whether this notification requires user action
  autoExpire?: number; // Auto-expire after this many milliseconds
  metadata?: {
    relatedView?: string;
    analystId?: string;
    scheduleId?: string;
    conflictId?: string;
    category?: string;
    tags?: string[];
    link?: string;
  };
}

class NotificationService {
  private notifications: Notification[] = [];
  private listeners: ((notifications: Notification[]) => void)[] = [];
  private maxNotifications = 100; // Keep last 100 notifications

  constructor() {
    this.loadFromStorage();
    this.startAutoExpiration();
  }

  // Add a new notification (for recommendations, history, system status)
  addNotification(notification: Omit<Notification, 'id' | 'timestamp' | 'isRead'>): string {
    const id = `notification-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const newNotification: Notification = {
      ...notification,
      id,
      timestamp: new Date(),
      isRead: false,
      importanceScore: notification.importanceScore || this.calculateImportanceScore(notification),
      requiresAction: notification.requiresAction || false,
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
          importanceScore: n.importanceScore || 5, // Default importance score
          requiresAction: n.requiresAction || false,
        }));
      }
    } catch (error) {
      console.warn('Failed to load notifications from storage:', error);
      this.notifications = [];
    }
  }

  // Calculate importance score based on notification type and content
  private calculateImportanceScore(notification: Omit<Notification, 'id' | 'timestamp' | 'isRead'>): number {
    let score = 5; // Base score

    // Adjust based on type
    switch (notification.type) {
      case 'system':
        score = notification.priority === 'high' ? 8 : 6;
        break;
      case 'recommendation':
        score = 7;
        break;
      case 'success':
        score = 3;
        break;
      case 'history':
        score = 2;
        break;
      case 'analytics':
        score = 4;
        break;
    }

    // Adjust based on priority
    switch (notification.priority) {
      case 'high':
        score += 2;
        break;
      case 'medium':
        score += 1;
        break;
      case 'low':
        score -= 1;
        break;
    }

    // Adjust based on content keywords
    const content = (notification.title + ' ' + notification.message).toLowerCase();
    if (content.includes('error') || content.includes('critical') || content.includes('failed')) {
      score += 2;
    }
    if (content.includes('success') || content.includes('completed')) {
      score -= 1;
    }

    return Math.max(1, Math.min(10, score));
  }

  // Start auto-expiration for notifications
  private startAutoExpiration(): void {
    setInterval(() => {
      const now = Date.now();
      const initialCount = this.notifications.length;

      this.notifications = this.notifications.filter(notification => {
        // Don't expire high-importance notifications
        if (notification.importanceScore >= 8) {
          return true;
        }

        // Don't expire unread notifications that require action
        if (!notification.isRead && notification.requiresAction) {
          return true;
        }

        // Check auto-expiration
        if (notification.autoExpire) {
          const age = now - notification.timestamp.getTime();
          return age < notification.autoExpire;
        }

        // Auto-expire low-importance notifications after 24 hours
        if (notification.importanceScore <= 3) {
          const age = now - notification.timestamp.getTime();
          return age < 24 * 60 * 60 * 1000; // 24 hours
        }

        // Auto-expire medium-importance notifications after 7 days
        if (notification.importanceScore <= 6) {
          const age = now - notification.timestamp.getTime();
          return age < 7 * 24 * 60 * 60 * 1000; // 7 days
        }

        return true;
      });

      if (this.notifications.length !== initialCount) {
        this.saveToStorage();
        this.notifyListeners();
      }
    }, 60000); // Check every minute
  }

  // Smart notification methods for recommendations, history, and system status
  addRecommendationNotification(title: string, message: string, metadata?: any): string {
    return this.addNotification({
      type: 'recommendation',
      priority: 'medium',
      title,
      message,
      metadata,
      importanceScore: 7, // Recommendations are important
      requiresAction: false, // Recommendations don't require immediate action
    });
  }

  addHistoryNotification(title: string, message: string, metadata?: any): string {
    return this.addNotification({
      type: 'history',
      priority: 'low',
      title,
      message,
      metadata,
      importanceScore: 2, // History notifications are low importance
      requiresAction: false, // History doesn't require action
    });
  }

  addSystemNotification(title: string, message: string, priority: NotificationPriority = 'medium'): string {
    return this.addNotification({
      type: 'system',
      priority,
      title,
      message,
      importanceScore: priority === 'high' ? 8 : 6, // System notifications vary by priority
      requiresAction: priority === 'high', // High priority system notifications may require action
    });
  }

  addSuccessNotification(title: string, message: string, metadata?: any): string {
    return this.addNotification({
      type: 'success',
      priority: 'low',
      title,
      message,
      metadata,
      importanceScore: 3, // Success notifications are low importance
      requiresAction: false, // Success doesn't require action
    });
  }
}

// Export singleton instance
export const notificationService = new NotificationService();