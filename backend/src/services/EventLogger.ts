import { PrismaClient } from '../../generated/prisma';

export interface LogEventParams {
    eventType: string;
    entityType: string;
    entityId?: string;
    action: string;
    actorType?: string;
    actorId?: string;
    before?: any;
    after?: any;
    metadata?: any;
}

export class EventLogger {
    constructor(private prisma: PrismaClient) { }

    async log({
        eventType,
        entityType,
        entityId,
        action,
        actorType = 'SYSTEM',
        actorId,
        before,
        after,
        metadata
    }: LogEventParams): Promise<void> {
        try {
            const changes = before && after ? this.computeChanges(before, after) : null;

            await this.prisma.systemEvent.create({
                data: {
                    eventType,
                    entityType,
                    entityId,
                    action,
                    actorType,
                    actorId,
                    before: before ? JSON.stringify(before) : null,
                    after: after ? JSON.stringify(after) : null,
                    changes: changes ? JSON.stringify(changes) : null,
                    metadata: metadata ? JSON.stringify(metadata) : null,
                }
            });
        } catch (error) {
            console.error('Failed to log system event:', error);
            // Don't throw, we don't want logging to break the main flow
        }
    }

    private computeChanges(before: any, after: any): any {
        const changes: Record<string, { from: any; to: any }> = {};

        // Handle simple objects
        if (typeof before !== 'object' || typeof after !== 'object' || !before || !after) {
            return { from: before, to: after };
        }

        const allKeys = new Set([...Object.keys(before), ...Object.keys(after)]);

        for (const key of allKeys) {
            const val1 = before[key];
            const val2 = after[key];

            if (JSON.stringify(val1) !== JSON.stringify(val2)) {
                changes[key] = {
                    from: val1,
                    to: val2
                };
            }
        }

        return changes;
    }

    async getEventHistory(entityType: string, entityId: string) {
        return this.prisma.systemEvent.findMany({
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
}
