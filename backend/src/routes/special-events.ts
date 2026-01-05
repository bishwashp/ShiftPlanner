import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { constraintImpactAnalyzer } from '../services/ConstraintImpactAnalyzer';

const router = Router();

/**
 * GET /api/special-events
 * List all special event constraints.
 */
router.get('/', async (req: Request, res: Response) => {
    try {
        const events = await prisma.schedulingConstraint.findMany({
            where: {
                isSpecialEvent: true,
                isActive: true
            },
            orderBy: { startDate: 'asc' }
        });

        res.json(events);
    } catch (error: any) {
        console.error('Error fetching special events:', error);
        res.status(500).json({
            error: 'Failed to fetch special events',
            message: error.message
        });
    }
});

/**
 * GET /api/special-events/templates
 * List saved special event templates (constraints marked as templates).
 */
router.get('/templates', async (req: Request, res: Response) => {
    try {
        const templates = await prisma.constraintTemplate.findMany({
            where: { isActive: true }
        });

        // Also get any saved special event "presets" (named constraints saved as templates)
        const savedPresets = await prisma.schedulingConstraint.findMany({
            where: {
                isSpecialEvent: true,
                isTemplate: true,
                isActive: true
            },
            distinct: ['name'],
            select: {
                name: true,
                constraintType: true,
                templateParams: true,
                skipContinuity: true,
                skipConflictCheck: true,
                grantsCompOff: true
            }
        });

        res.json({
            systemTemplates: templates,
            savedPresets: savedPresets
        });
    } catch (error: any) {
        console.error('Error fetching templates:', error);
        res.status(500).json({
            error: 'Failed to fetch templates',
            message: error.message
        });
    }
});

/**
 * POST /api/special-events
 * Create a new special event constraint.
 */
router.post('/', async (req: Request, res: Response) => {
    try {
        const {
            name,
            startDate,
            endDate,
            constraintType,
            templateId,
            templateParams,
            skipContinuity,
            skipConflictCheck,
            grantCompOff,
            description,
            saveAsTemplate
        } = req.body;

        if (!name || !startDate || !endDate) {
            return res.status(400).json({
                error: 'Missing required fields',
                message: 'name, startDate, and endDate are required'
            });
        }

        // Analyze impact
        const assessment = await constraintImpactAnalyzer.analyzeNewConstraint(
            constraintType || 'SPECIAL_EVENT',
            new Date(startDate),
            new Date(endDate),
            undefined,
            templateId,
            templateParams
        );

        // Create the special event constraint
        const constraint = await prisma.schedulingConstraint.create({
            data: {
                name,
                startDate: new Date(startDate),
                endDate: new Date(endDate),
                constraintType: constraintType || 'SPECIAL_EVENT',
                description,
                isActive: true,
                isSpecialEvent: true,
                isTemplate: saveAsTemplate ?? false,
                skipContinuity: skipContinuity ?? false,
                skipConflictCheck: skipConflictCheck ?? false,
                grantsCompOff: grantCompOff ?? false,
                templateId,
                templateParams: templateParams ? JSON.stringify(templateParams) : null,
                impactAssessed: true,
                impactSnapshot: JSON.stringify({
                    affectedCount: assessment.affectedSchedules.length,
                    severity: assessment.severity,
                    assessedAt: new Date().toISOString()
                }),
                requiresRecalculation: assessment.requiresRecalculation
            }
        });

        // Audit log
        try {
            const { auditService } = await import('../services/AuditService');
            await auditService.logActivity({
                type: 'SPECIAL_EVENT_CREATED',
                category: 'CONSTRAINT',
                title: 'Special Event Created',
                description: `Created special event: ${name} (${startDate} to ${endDate})`,
                performedBy: 'admin',
                resourceId: constraint.id,
                severity: assessment.severity as any
            });
        } catch (err) {
            console.error('Audit logging failed:', err);
        }

        // Auto-recalculate if needed
        if (assessment.requiresRecalculation) {
            try {
                const { recalculationEngine } = await import('../services/RecalculationEngine');
                await recalculationEngine.handleConstraintChange(constraint.id, assessment, {
                    recalculate: true,
                    grantCompOff: grantCompOff ?? false,
                    extendToSubsequentWeeks: false
                });
            } catch (err) {
                console.error('Recalculation failed:', err);
            }
        }

        res.status(201).json({
            success: true,
            constraint,
            assessment
        });
    } catch (error: any) {
        console.error('Error creating special event:', error);
        res.status(500).json({
            error: 'Failed to create special event',
            message: error.message
        });
    }
});

/**
 * DELETE /api/special-events/:id
 * Soft delete a special event.
 */
router.delete('/:id', async (req: Request, res: Response) => {
    try {
        const { id } = req.params;

        await prisma.schedulingConstraint.update({
            where: { id },
            data: { isActive: false }
        });

        res.json({ success: true });
    } catch (error: any) {
        console.error('Error deleting special event:', error);
        res.status(500).json({
            error: 'Failed to delete special event',
            message: error.message
        });
    }
});

export default router;
