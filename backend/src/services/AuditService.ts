import { prisma } from '../lib/prisma';

export type AuditAction = 'CREATED' | 'UPDATED' | 'DELETED' | 'EXECUTED';
export type ActorType = 'USER' | 'SYSTEM' | 'ALGORITHM';
export type EntityType = 'CONSTRAINT' | 'SCHEDULE' | 'ANALYST' | 'TEMPLATE' | 'OVERRIDE';

interface AuditLogParams {
    entityType: EntityType;
    entityId: string;
    action: AuditAction;
    actorId?: string;
    actorType?: ActorType; // Defaults to USER if actorId present, else SYSTEM
    before?: any;
    after?: any;
    metadata?: any;
}

interface ActivityLogParams {
    type: string;
    category: 'CONSTRAINT' | 'SCHEDULE' | 'ANALYST' | 'SYSTEM';
    title: string;
    description: string;
    performedBy?: string;
    resourceId?: string;
    severity?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
}

export class AuditService {
    /**
     * Logs a detailed system event with before/after snapshots for audit trails.
     */
    async logSystemEvent(params: AuditLogParams) {
        try {
            // Calculate changes if both before and after are provided
            let changes = null;
            if (params.before && params.after) {
                changes = this.calculateDiff(params.before, params.after);
            }

            await prisma.systemEvent.create({
                data: {
                    eventType: `${params.entityType}_${params.action}`,
                    entityType: params.entityType,
                    entityId: params.entityId,
                    action: params.action,
                    actorType: params.actorType || (params.actorId ? 'USER' : 'SYSTEM'),
                    actorId: params.actorId || 'system',
                    before: params.before ? JSON.stringify(params.before) : null,
                    after: params.after ? JSON.stringify(params.after) : null,
                    changes: changes ? JSON.stringify(changes) : null,
                    metadata: params.metadata ? JSON.stringify(params.metadata) : null,
                },
            });
        } catch (error) {
            console.error('Failed to log system event:', error);
            // Fail silently to not block main business logic
        }
    }

    /**
     * Logs a high-level user activity for the dashboard feed.
     */
    async logActivity(params: ActivityLogParams) {
        try {
            await prisma.activity.create({
                data: {
                    type: params.type,
                    category: params.category,
                    title: params.title,
                    description: params.description,
                    performedBy: params.performedBy || 'system',
                    resourceType: params.category, // Map category to resource type
                    resourceId: params.resourceId,
                    impact: params.severity || 'LOW',
                },
            });
        } catch (error) {
            console.error('Failed to log activity:', error);
        }
    }

    /**
     * Helper to simple JSON diff
     */
    private calculateDiff(before: any, after: any): any {
        const diff: Record<string, any> = {};
        if (!before || !after) return null;

        const allKeys = new Set([...Object.keys(before), ...Object.keys(after)]);

        allKeys.forEach(key => {
            // Ignore internal keys
            if (['updatedAt', 'createdAt'].includes(key)) return;

            const val1 = before[key];
            const val2 = after[key];

            if (JSON.stringify(val1) !== JSON.stringify(val2)) {
                diff[key] = {
                    from: val1,
                    to: val2
                };
            }
        });

        return Object.keys(diff).length > 0 ? diff : null;
    }

    /**
     * Retrieves audit history for a specific entity
     */
    async getEntityHistory(entityType: string, entityId: string) {
        return prisma.systemEvent.findMany({
            where: {
                entityType,
                entityId
            },
            orderBy: {
                createdAt: 'desc'
            },
            take: 50
        });
    }

    /**
    * Retrieves recent activities
    */
    async getRecentActivities(limit: number = 20) {
        return prisma.activity.findMany({
            orderBy: {
                createdAt: 'desc'
            },
            take: limit
        });
    }
}

export const auditService = new AuditService();
