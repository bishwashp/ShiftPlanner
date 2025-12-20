import { PrismaClient } from '../../generated/prisma';
import { webSocketService } from './WebSocketService';

export interface CreateNotificationDTO {
    userId?: string;
    analystId?: string;
    type: string;
    priority?: 'LOW' | 'MEDIUM' | 'HIGH';
    title: string;
    message: string;
    requiresAction?: boolean;
    autoExpire?: number;
    metadata?: any;
}

export class NotificationService {
    private prisma: PrismaClient;

    constructor(prisma: PrismaClient) {
        this.prisma = prisma;
    }

    /**
     * Create a new notification
     */
    async createNotification(data: CreateNotificationDTO): Promise<any> {
        console.log('[NotificationService] Creating notification:', JSON.stringify(data, null, 2));
        const notification = await this.prisma.notification.create({
            data: {
                userId: data.userId,
                analystId: data.analystId,
                type: data.type,
                priority: data.priority || 'MEDIUM',
                title: data.title,
                message: data.message,
                isRead: false,  // ← EXPLICITLY set to false for badge count
                requiresAction: data.requiresAction || false,
                autoExpire: data.autoExpire,
                metadata: data.metadata ? JSON.stringify(data.metadata) : null,
                importanceScore: this.calculateImportanceScore(data.type, data.priority || 'MEDIUM')
            }
        });

        // Emit real-time notification via WebSocket
        const formattedNotification = {
            ...notification,
            metadata: notification.metadata ? JSON.parse(notification.metadata) : null,
            timestamp: notification.createdAt
        };

        if (data.userId) {
            webSocketService.emitToUser(data.userId, 'notification:new', formattedNotification);
        } else if (data.analystId) {
            webSocketService.emitToAnalyst(data.analystId, 'notification:new', formattedNotification);
        } else {
            // Target Managers and Super Admins for system-wide notifications (e.g. absence requests)
            webSocketService.emitToRoles(['MANAGER', 'SUPER_ADMIN'], 'notification:new', formattedNotification);
        }

        console.log('[NotificationService] Notification created and emitted via WebSocket');

        return notification;
    }

    /**
     * Get notifications for a user or analyst
     * @param userId - User ID
     * @param analystId - Analyst ID  
     * @param userRole - User role (ANALYST, MANAGER, SUPER_ADMIN)
     * @param unreadOnly - Filter for unread only
     */
    async getNotifications(userId?: string, analystId?: string, userRole?: string, unreadOnly: boolean = false): Promise<any[]> {
        console.log(`[NotificationService] Fetching notifications for userId=${userId}, analystId=${analystId}, role=${userRole}`);
        const where: any = {};

        const conditions: any[] = [];

        // Personal notifications for this user
        if (userId) {
            conditions.push({ userId });
        }

        // Analyst-specific notifications (work-related)
        if (analystId) {
            conditions.push({ analystId });
        }

        // System-wide notifications ONLY for Managers/Super Admins
        if (userRole && (userRole === 'MANAGER' || userRole === 'SUPER_ADMIN')) {
            conditions.push({
                userId: null,
                analystId: null
            });
        }

        if (conditions.length === 0) return [];

        where.OR = conditions;

        if (unreadOnly) {
            where.isRead = false;
        }

        console.log('[NotificationService] Query conditions:', JSON.stringify(where, null, 2));

        const notifications = await this.prisma.notification.findMany({
            where,
            orderBy: { createdAt: 'desc' },
            take: 100 // Limit to last 100
        });

        console.log(`[NotificationService] Found ${notifications.length} notifications`);

        // Parse metadata
        return notifications.map(n => ({
            ...n,
            metadata: n.metadata ? JSON.parse(n.metadata) : null
        }));
    }

    /**
     * Mark notification as read
     */
    async markAsRead(id: string): Promise<void> {
        await this.prisma.notification.update({
            where: { id },
            data: { isRead: true }
        });
    }

    /**
     * Mark all notifications as read for a user/analyst
     */
    async markAllAsRead(userId?: string, analystId?: string, userRole?: string): Promise<void> {
        const where: any = {};
        if (userId) where.userId = userId;
        if (analystId) where.analystId = analystId;

        if (!userId && !analystId) return;

        await this.prisma.notification.updateMany({
            where: {
                ...where,
                isRead: false
            },
            data: { isRead: true }
        });
    }

    /**
     * Delete a notification
     */
    async deleteNotification(id: string): Promise<void> {
        await this.prisma.notification.delete({
            where: { id }
        });
    }

    /**
     * Delete all notifications for a user/analyst
     */
    async deleteAllNotifications(userId?: string, analystId?: string, userRole?: string): Promise<void> {
        const where: any = {};
        const conditions: any[] = [];

        // Personal notifications
        if (userId) conditions.push({ userId });

        // Analyst notifications
        if (analystId) conditions.push({ analystId });

        // System-wide (Manager/Admin)
        // Note: We only delete system-wide notifications if we logic dictates. 
        // But system-wide notifications (userId=null) are SHARED? 
        // NO! We fixed this. We now create INDIVIDUAL COPIES for managers.
        // So they have `userId` set.
        // So deleting by `userId` is sufficient for modern notifications.
        // But for safety/cleanup of old legacy ones, we might need more logic?
        // Let's stick to strict userId/analystId deletion for now.

        if (conditions.length === 0) return;

        where.OR = conditions;

        await this.prisma.notification.deleteMany({
            where
        });
    }

    /**
     * Calculate importance score
     */
    private calculateImportanceScore(type: string, priority: string): number {
        let score = 5;

        switch (type) {
            case 'ALERT': score = 9; break;
            case 'RECOMMENDATION': score = 7; break;
            case 'SYSTEM': score = 6; break;
            case 'ANALYTICS': score = 4; break;
            case 'HISTORY': score = 2; break;
        }

        if (priority === 'HIGH') score += 2;
        if (priority === 'LOW') score -= 2;

        return Math.max(1, Math.min(10, score));
    }
}
// Singleton instance to be used throughout the app
import { prisma } from '../lib/prisma';
export const notificationService = new NotificationService(prisma);
