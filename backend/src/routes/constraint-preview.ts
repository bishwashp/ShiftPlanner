import { Router, Request, Response } from 'express';
import { constraintImpactAnalyzer } from '../services/ConstraintImpactAnalyzer';
import { recalculationEngine } from '../services/RecalculationEngine';

const router = Router();

/**
 * POST /api/constraints/preview
 * Preview the impact of adding a new constraint before committing.
 */
router.post('/preview', async (req: Request, res: Response) => {
    try {
        const {
            constraintType,
            startDate,
            endDate,
            analystId,
            templateId,
            templateParams,
        } = req.body;

        if (!constraintType || !startDate || !endDate) {
            return res.status(400).json({
                error: 'Missing required fields',
                message: 'constraintType, startDate, and endDate are required',
            });
        }

        const assessment = await constraintImpactAnalyzer.analyzeNewConstraint(
            constraintType,
            new Date(startDate),
            new Date(endDate),
            analystId,
            templateId,
            templateParams
        );

        res.json({
            success: true,
            assessment,
            recommendation: assessment.severity === 'CRITICAL'
                ? 'Review carefully before proceeding'
                : assessment.severity === 'HIGH'
                    ? 'Consider the alternatives provided'
                    : 'Safe to proceed',
        });
    } catch (error: any) {
        console.error('Error previewing constraint:', error);
        res.status(500).json({
            error: 'Failed to preview constraint impact',
            message: error.message,
        });
    }
});

/**
 * POST /api/constraints/:id/preview-modification
 * Preview the impact of modifying an existing constraint.
 */
router.post('/:id/preview-modification', async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { startDate, endDate, templateParams } = req.body;

        const assessment = await constraintImpactAnalyzer.analyzeConstraintModification(
            id,
            startDate ? new Date(startDate) : undefined,
            endDate ? new Date(endDate) : undefined,
            templateParams
        );

        res.json({
            success: true,
            assessment,
        });
    } catch (error: any) {
        console.error('Error previewing modification:', error);
        if (error.message.includes('not found')) {
            return res.status(404).json({ error: error.message });
        }
        res.status(500).json({
            error: 'Failed to preview modification',
            message: error.message,
        });
    }
});

/**
 * POST /api/constraints/:id/preview-deletion
 * Preview the impact of deleting a constraint.
 */
router.post('/:id/preview-deletion', async (req: Request, res: Response) => {
    try {
        const { id } = req.params;

        const assessment = await constraintImpactAnalyzer.analyzeConstraintDeletion(id);

        res.json({
            success: true,
            assessment,
        });
    } catch (error: any) {
        console.error('Error previewing deletion:', error);
        if (error.message.includes('not found')) {
            return res.status(404).json({ error: error.message });
        }
        res.status(500).json({
            error: 'Failed to preview deletion',
            message: error.message,
        });
    }
});

/**
 * POST /api/constraints/with-preview
 * Create a constraint with automatic impact assessment.
 * Two-step flow: assess first, then confirm with ?confirm=true
 */
router.post('/with-preview', async (req: Request, res: Response) => {
    try {
        const { confirm } = req.query;
        const {
            constraintType,
            startDate,
            endDate,
            analystId,
            shiftType,
            templateId,
            templateParams,
            description,
        } = req.body;

        if (!constraintType || !startDate || !endDate) {
            return res.status(400).json({
                error: 'Missing required fields',
                message: 'constraintType, startDate, and endDate are required',
            });
        }

        // Step 1: Analyze impact
        const assessment = await constraintImpactAnalyzer.analyzeNewConstraint(
            constraintType,
            new Date(startDate),
            new Date(endDate),
            analystId,
            templateId,
            templateParams
        );

        // If not confirmed, return the assessment for review
        if (confirm !== 'true') {
            return res.json({
                success: true,
                step: 'PREVIEW',
                message: 'Review the impact assessment before confirming',
                assessment,
                confirmUrl: `${req.originalUrl}?confirm=true`,
                nextStep: 'POST the same body to confirmUrl to create the constraint',
            });
        }

        // Step 2: Create the constraint
        const { prisma } = await import('../lib/prisma');

        const constraint = await prisma.schedulingConstraint.create({
            data: {
                constraintType,
                startDate: new Date(startDate),
                endDate: new Date(endDate),
                analystId,
                shiftType,
                description,
                templateId,
                templateParams: templateParams ? JSON.stringify(templateParams) : null,
                impactAssessed: true,
                impactSnapshot: JSON.stringify({
                    affectedCount: assessment.affectedSchedules.length,
                    fairnessBefore: assessment.fairnessDelta.before,
                    fairnessAfter: assessment.fairnessDelta.after,
                    severity: assessment.severity,
                    assessedAt: new Date().toISOString(),
                }),
                requiresRecalculation: assessment.requiresRecalculation,
                grantsCompOff: !!assessment.compOffGrant,
                compOffUnits: assessment.compOffGrant?.units,
            },
        });

        // Audit Log
        try {
            const { auditService } = await import('../services/AuditService');
            await auditService.logSystemEvent({
                entityType: 'CONSTRAINT',
                entityId: constraint.id,
                action: 'CREATED',
                actorId: 'admin', // TODO: Get from auth context
                after: constraint,
                metadata: {
                    assessmentSeverity: assessment.severity,
                    affectedSchedules: assessment.affectedSchedules.length
                }
            });

            await auditService.logActivity({
                type: 'CONSTRAINT_CREATED',
                category: 'CONSTRAINT',
                title: 'New Constraint Created',
                description: `Created ${constraint.constraintType} constraint for ${startDate} to ${endDate}`,
                performedBy: 'admin', // TODO: Get from auth
                resourceId: constraint.id,
                severity: assessment.severity as any
            });
        } catch (err) {
            console.error('Audit logging failed:', err);
        }

        res.status(201).json({
            success: true,
            step: 'CONFIRMED',
            message: 'Constraint created with impact assessment',
            constraint,
            assessment,
        });
    } catch (error: any) {
        console.error('Error creating constraint with preview:', error);
        res.status(500).json({
            error: 'Failed to create constraint',
            message: error.message,
        });
    }
});

/**
 * POST /api/constraints/:id/recalculate
 * Trigger recalculation for a constraint that requires it.
 */
router.post('/:id/recalculate', async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { extendToSubsequentWeeks = true } = req.body;

        // Get impact assessment
        const assessment = await constraintImpactAnalyzer.analyzeConstraintModification(id);

        // Perform recalculation
        const result = await recalculationEngine.handleConstraintChange(id, assessment, {
            recalculate: true,
            grantCompOff: false,
            extendToSubsequentWeeks,
        });

        res.json({
            success: result.success,
            result,
        });
    } catch (error: any) {
        console.error('Error recalculating:', error);
        if (error.message.includes('not found')) {
            return res.status(404).json({ error: error.message });
        }
        res.status(500).json({
            error: 'Failed to recalculate',
            message: error.message,
        });
    }
});

/**
 * POST /api/constraints/:id/grant-compoff
 * Grant comp-off instead of recalculating.
 */
router.post('/:id/grant-compoff', async (req: Request, res: Response) => {
    try {
        const { id } = req.params;

        // Get impact assessment
        const assessment = await constraintImpactAnalyzer.analyzeConstraintModification(id);

        if (!assessment.compOffGrant) {
            return res.status(400).json({
                error: 'No comp-off applicable',
                message: 'This constraint does not qualify for comp-off compensation.',
            });
        }

        // Grant comp-off
        const result = await recalculationEngine.handleConstraintChange(id, assessment, {
            recalculate: false,
            grantCompOff: true,
            extendToSubsequentWeeks: false,
        });

        res.json({
            success: result.success,
            result,
        });
    } catch (error: any) {
        console.error('Error granting comp-off:', error);
        if (error.message.includes('not found')) {
            return res.status(404).json({ error: error.message });
        }
        res.status(500).json({
            error: 'Failed to grant comp-off',
            message: error.message,
        });
    }
});

/**
 * POST /api/constraints/process-pending
 * Process all constraints that require recalculation (admin/cron job).
 */
router.post('/process-pending', async (req: Request, res: Response) => {
    try {
        const result = await recalculationEngine.processPendingRecalculations();

        res.json({
            success: true,
            ...result,
        });
    } catch (error: any) {
        console.error('Error processing pending recalculations:', error);
        res.status(500).json({
            error: 'Failed to process pending recalculations',
            message: error.message,
        });
    }
});

export default router;
