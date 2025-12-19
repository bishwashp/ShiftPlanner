import { Request, Response } from 'express';
import { notificationService } from '../services/NotificationService';

export const notificationController = {
    /**
     * Get notifications
     */
    getNotifications: async (req: Request, res: Response) => {
        try {
            const { userId, analystId, unreadOnly } = req.query;

            // In a real app, we'd get userId from the auth token
            // For now, we accept it as a query param for flexibility or fallback to what's in the token if available
            // const authUserId = (req as any).user?.id;

            const notifications = await notificationService.getNotifications(
                userId as string,
                analystId as string,
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
            const { userId, analystId } = req.body;
            await notificationService.markAllAsRead(userId, analystId);
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
    }
};
