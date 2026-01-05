import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';

const router = Router();

/**
 * GET /api/holiday-constraint
 * Get the global holiday constraint configuration (singleton).
 */
router.get('/', async (req: Request, res: Response) => {
    try {
        // Get the singleton config, or return defaults if none exists
        let config = await prisma.holidayConstraintConfig.findFirst({
            where: { isActive: true }
        });

        if (!config) {
            // Return default values if no config exists
            return res.json({
                staffingCount: null,
                screenerCount: null,
                skipScreener: false,
                skipConsecutive: false,
                isActive: true,
                isDefault: true // Indicates no custom config has been saved
            });
        }

        res.json(config);
    } catch (error: any) {
        console.error('Error fetching holiday constraint config:', error);
        res.status(500).json({
            error: 'Failed to fetch holiday constraint configuration',
            message: error.message
        });
    }
});

/**
 * PUT /api/holiday-constraint
 * Update the global holiday constraint configuration (upsert - singleton pattern).
 */
router.put('/', async (req: Request, res: Response) => {
    try {
        const { staffingCount, screenerCount, skipScreener, skipConsecutive } = req.body;

        // Find existing config
        const existing = await prisma.holidayConstraintConfig.findFirst({
            where: { isActive: true }
        });

        let config;
        if (existing) {
            // Update existing
            config = await prisma.holidayConstraintConfig.update({
                where: { id: existing.id },
                data: {
                    staffingCount: staffingCount ?? null,
                    screenerCount: screenerCount ?? null,
                    skipScreener: skipScreener ?? false,
                    skipConsecutive: skipConsecutive ?? false,
                    updatedAt: new Date()
                }
            });
        } else {
            // Create new
            config = await prisma.holidayConstraintConfig.create({
                data: {
                    staffingCount: staffingCount ?? null,
                    screenerCount: screenerCount ?? null,
                    skipScreener: skipScreener ?? false,
                    skipConsecutive: skipConsecutive ?? false
                }
            });
        }

        // Audit log
        try {
            const { auditService } = await import('../services/AuditService');
            await auditService.logActivity({
                type: 'HOLIDAY_CONSTRAINT_UPDATED',
                category: 'CONSTRAINT',
                title: 'Holiday Constraint Updated',
                description: `Updated global holiday constraint configuration`,
                performedBy: 'admin', // TODO: Get from auth context
                resourceId: config.id,
                severity: 'LOW'
            });
        } catch (err) {
            console.error('Audit logging failed:', err);
        }

        res.json({
            success: true,
            config
        });
    } catch (error: any) {
        console.error('Error updating holiday constraint config:', error);
        res.status(500).json({
            error: 'Failed to update holiday constraint configuration',
            message: error.message
        });
    }
});

export default router;
