import { Request, Response } from 'express';
import { notificationService } from '../services/NotificationService';

export const notificationController = {
    /**
     * Get notifications
     */
    getNotifications: async (req: Request, res: Response) => {
        try {
            const { userId, analystId, userRole, unreadOnly } = req.query;

            // In a real app, we'd get userId and role from the auth token
            // For now, we accept it as a query param for flexibility

            const notifications = await notificationService.getNotifications(
                userId as string,
                analystId as string,
                userRole as string,
                unreadOnly === 'true'
            );

            res.json(notifications);
        } catch (error: any) {
            console.error('Error fetching notifications:', error);
            res.status(500).json({ error: 'Failed to fetch notifications' });
        }
    },

    /**
     * Mark as read
     */
    markAsRead: async (req: Request, res: Response) => {
        try {
            const { id } = req.params;
            await notificationService.markAsRead(id);
            res.json({ success: true });
        } catch (error: any) {
            console.error('Error marking notification as read:', error);
            res.status(500).json({ error: 'Failed to update notification' });
        }
    },

    /**
     * Mark all as read
     */
    markAllAsRead: async (req: Request, res: Response) => {
        try {
            const { userId, analystId, userRole } = req.body;
            await notificationService.markAllAsRead(userId, analystId, userRole);
            res.json({ success: true });
        } catch (error: any) {
            console.error('Error marking all notifications as read:', error);
            res.status(500).json({ error: 'Failed to update notifications' });
        }
    },

    /**
     * Delete notification
     */
    deleteNotification: async (req: Request, res: Response) => {
        try {
            const { id } = req.params;
            await notificationService.deleteNotification(id);
            res.json({ success: true });
        } catch (error: any) {
            console.error('Error deleting notification:', error);
            res.status(500).json({ error: 'Failed to delete notification' });
        }
    },

    /**
     * Delete all notifications for user
     */
    deleteAllNotifications: async (req: Request, res: Response) => {
        try {
            const { userId, analystId, userRole } = req.body; // or query? usually DELETE uses query or body. 
            // Better to use query or body. axios.delete works with params or data.
            // Let's use body for consistency with markAllAsRead.
            await notificationService.deleteAllNotifications(userId, analystId, userRole);
            res.json({ success: true });
        } catch (error: any) {
            console.error('Error deleting all notifications:', error);
            res.status(500).json({ error: 'Failed to delete notifications' });
        }
    }
};
