import { Router, Request, Response } from 'express';
import { auditService } from '../services/AuditService';

const router = Router();

/**
 * GET /api/audit/activity
 * Get recent system activity feed
 */
router.get('/activity', async (req: Request, res: Response) => {
    try {
        const limit = parseInt(req.query.limit as string) || 20;
        const activities = await auditService.getRecentActivities(limit);
        res.json(activities);
    } catch (error: any) {
        console.error('Error fetching activity log:', error);
        res.status(500).json({ error: 'Failed to fetch activity log' });
    }
});

/**
 * GET /api/audit/logs/:entityType/:entityId
 * Get detailed audit logs for a specific entity
 */
router.get('/logs/:entityType/:entityId', async (req: Request, res: Response) => {
    try {
        const { entityType, entityId } = req.params;
        const logs = await auditService.getEntityHistory(entityType, entityId);
        res.json(logs);
    } catch (error: any) {
        console.error('Error fetching audit logs:', error);
        res.status(500).json({ error: 'Failed to fetch audit logs' });
    }
});

export default router;
