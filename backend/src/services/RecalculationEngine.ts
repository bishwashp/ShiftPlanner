import { PrismaClient, Schedule, Analyst, SchedulingConstraint } from '../../generated/prisma';
import { prisma } from '../lib/prisma';
import { compOffService } from './CompOffService';
import { constraintImpactAnalyzer, ImpactAssessment } from './ConstraintImpactAnalyzer';
import { auditService } from './AuditService';
import { generationBlockService } from './GenerationBlockService';

export interface RecalculationResult {
    success: boolean;
    schedulesRemoved: number;
    schedulesCreated: number;
    schedulesModified: number;
    affectedAnalysts: string[];
    fairnessScore: number;
    compOffGranted?: {
        analystId: string;
        units: number;
        reason: string;
    };
    message: string;
}

export interface RecalculationOptions {
    recalculate: boolean;  // If true, recalculate schedules
    grantCompOff: boolean; // If true, grant comp-off instead of recalculating
    extendToSubsequentWeeks: boolean; // Recalculate fairness for subsequent weeks
}

export class RecalculationEngine {
    private prisma: PrismaClient;

    constructor(prismaClient?: PrismaClient) {
        this.prisma = prismaClient || prisma;
    }

    /**
     * Handle constraint change with automatic recalculation or comp-off.
     */
    async handleConstraintChange(
        constraintId: string,
        assessment: ImpactAssessment,
        options: RecalculationOptions
    ): Promise<RecalculationResult> {
        // Mutually exclusive: either recalculate or grant comp-off
        if (options.recalculate && options.grantCompOff) {
            throw new Error('Cannot both recalculate and grant comp-off. Choose one.');
        }

        if (options.recalculate) {
            return this.recalculateSchedules(constraintId, assessment, options.extendToSubsequentWeeks);
        } else if (options.grantCompOff && assessment.compOffGrant) {
            return this.grantCompOffInstead(constraintId, assessment);
        } else {
            // No action needed
            return {
                success: true,
                schedulesRemoved: 0,
                schedulesCreated: 0,
                schedulesModified: 0,
                affectedAnalysts: [],
                fairnessScore: assessment.fairnessDelta.after,
                message: 'No recalculation or comp-off needed.',
            };
        }
    }

    /**
     * Recalculate schedules affected by a constraint.
     */
    private async recalculateSchedules(
        constraintId: string,
        assessment: ImpactAssessment,
        extendToSubsequentWeeks: boolean
    ): Promise<RecalculationResult> {
        const affectedScheduleIds = assessment.affectedSchedules
            .filter(s => s.action === 'REMOVE')
            .map(s => s.scheduleId);

        // Remove affected schedules
        if (affectedScheduleIds.length > 0) {
            await this.prisma.schedule.deleteMany({
                where: { id: { in: affectedScheduleIds } },
            });
        }

        // Get affected date range
        const startDate = assessment.dateRange.start;
        let endDate = assessment.dateRange.end;

        // Extend to subsequent weeks for fairness rebalancing
        if (extendToSubsequentWeeks) {
            const extendedEnd = new Date(endDate);
            extendedEnd.setDate(extendedEnd.getDate() + 14); // Add 2 weeks
            endDate = extendedEnd;
        }

        // Get available analysts
        const availableAnalysts = await this.getAvailableAnalysts(startDate, endDate);

        // Reassign removed schedules if possible
        const reassignments = await this.reassignSchedules(
            assessment.affectedSchedules.filter(s => s.action === 'REMOVE'),
            availableAnalysts,
            startDate,
            endDate
        );

        // Mark constraint as requiring no further recalculation
        await this.prisma.schedulingConstraint.update({
            where: { id: constraintId },
            data: { requiresRecalculation: false },
        });

        const affectedAnalystNames = [...new Set(assessment.affectedSchedules.map(s => s.analystName))];

        // Audit Log
        const schedulesRemovedCount = affectedScheduleIds.length;
        const schedulesCreatedCount = reassignments.created;

        await auditService.logSystemEvent({
            entityType: 'CONSTRAINT',
            entityId: constraintId,
            action: 'EXECUTED', // Executed recalculation
            actorId: 'system',
            metadata: {
                eventType: 'RECALCULATION',
                schedulesRemoved: schedulesRemovedCount,
                schedulesCreated: schedulesCreatedCount,
                fairnessScore: assessment.fairnessDelta.after
            }
        });

        await auditService.logActivity({
            type: 'SCHEDULE_RECALCULATED',
            category: 'SCHEDULE',
            title: 'Schedule Recalculated',
            description: `Recalculation triggered by constraint ${constraintId}. Removed ${schedulesRemovedCount}, Created ${schedulesCreatedCount}.`,
            performedBy: 'system',
            resourceId: constraintId,
            severity: 'MEDIUM'
        });

        // Update Generation Block History if available
        try {
            await generationBlockService.appendAmendment(
                `Recalculation triggered by constraint ${constraintId}`,
                {
                    removed: affectedScheduleIds.length,
                    created: reassignments.created,
                    fairnessDelta: assessment.fairnessDelta.change
                },
                'system'
            );
        } catch (e) {
            console.warn('Failed to append amendment to generation block', e);
        }

        return {
            success: true,
            schedulesRemoved: affectedScheduleIds.length,
            schedulesCreated: reassignments.created,
            schedulesModified: 0,
            affectedAnalysts: affectedAnalystNames,
            fairnessScore: assessment.fairnessDelta.after,
            message: `Recalculated: removed ${affectedScheduleIds.length} schedules, created ${reassignments.created} replacements.`,
        };
    }

    /**
     * Grant comp-off instead of recalculating.
     */
    private async grantCompOffInstead(
        constraintId: string,
        assessment: ImpactAssessment
    ): Promise<RecalculationResult> {
        if (!assessment.compOffGrant) {
            return {
                success: false,
                schedulesRemoved: 0,
                schedulesCreated: 0,
                schedulesModified: 0,
                affectedAnalysts: [],
                fairnessScore: assessment.fairnessDelta.before,
                message: 'No comp-off applicable for this constraint.',
            };
        }

        const { analystId, units, reason } = assessment.compOffGrant;

        // Credit comp-off to analyst
        await compOffService.creditFromConstraint(
            analystId,
            constraintId,
            units,
            reason
        );

        // Mark constraint as granting comp-off
        await this.prisma.schedulingConstraint.update({
            where: { id: constraintId },
            data: {
                grantsCompOff: true,
                compOffUnits: units,
                requiresRecalculation: false,
            },
        });

        const analyst = await this.prisma.analyst.findUnique({
            where: { id: analystId },
        });

        // Audit Log
        await auditService.logSystemEvent({
            entityType: 'CONSTRAINT',
            entityId: constraintId,
            action: 'EXECUTED',
            actorId: 'system',
            metadata: {
                eventType: 'COMP_OFF_GRANT',
                analystId,
                units,
                reason
            }
        });

        await auditService.logActivity({
            type: 'COMP_OFF_GRANTED',
            category: 'ANALYST',
            title: 'Comp-Off Granted',
            description: `Granted ${units} units to ${analyst?.name || analystId} for constraint ${constraintId}.`,
            performedBy: 'system',
            resourceId: analystId,
            severity: 'LOW'
        });

        return {
            success: true,
            schedulesRemoved: 0,
            schedulesCreated: 0,
            schedulesModified: 0,
            affectedAnalysts: [analyst?.name || analystId],
            fairnessScore: assessment.fairnessDelta.before,
            compOffGranted: { analystId, units, reason },
            message: `Granted ${units} comp-off units to ${analyst?.name || analystId} instead of recalculating.`,
        };
    }

    /**
     * Get analysts available for reassignment.
     */
    private async getAvailableAnalysts(startDate: Date, endDate: Date): Promise<Analyst[]> {
        // Get active analysts
        const analysts = await this.prisma.analyst.findMany({
            where: { isActive: true },
        });

        // Filter out analysts with constraints during this period
        const constraints = await this.prisma.schedulingConstraint.findMany({
            where: {
                isActive: true,
                OR: [
                    { constraintType: 'BLACKOUT_DATE' },
                    { constraintType: 'ABSENCE' },
                ],
                startDate: { lte: endDate },
                endDate: { gte: startDate },
            },
        });

        const constrainedAnalystIds = new Set(
            constraints.filter(c => c.analystId).map(c => c.analystId!)
        );

        return analysts.filter(a => !constrainedAnalystIds.has(a.id));
    }

    /**
     * Attempt to reassign removed schedules to available analysts.
     */
    private async reassignSchedules(
        removedSchedules: ImpactAssessment['affectedSchedules'],
        availableAnalysts: Analyst[],
        startDate: Date,
        endDate: Date
    ): Promise<{ created: number; failed: number }> {
        let created = 0;
        let failed = 0;

        // Group removed schedules by date and shift
        const schedulesByDateShift = new Map<string, typeof removedSchedules>();
        for (const schedule of removedSchedules) {
            const key = `${schedule.date}-${schedule.shiftType}`;
            if (!schedulesByDateShift.has(key)) {
                schedulesByDateShift.set(key, []);
            }
            schedulesByDateShift.get(key)!.push(schedule);
        }

        // Get analyst workload for fair reassignment
        const workload = await this.getAnalystWorkload(startDate, endDate);

        // Assign to analysts with lowest workload
        for (const [key, schedules] of schedulesByDateShift) {
            for (const schedule of schedules) {
                // Find analyst with lowest workload for this shift type
                const eligibleAnalysts = availableAnalysts
                    .filter(a => a.shiftType === schedule.shiftType || a.shiftType === 'FLEXIBLE')
                    .sort((a, b) => (workload.get(a.id) || 0) - (workload.get(b.id) || 0));

                if (eligibleAnalysts.length > 0) {
                    const assignee = eligibleAnalysts[0];

                    try {
                        await this.prisma.schedule.create({
                            data: {
                                date: new Date(schedule.date),
                                shiftType: schedule.shiftType,
                                analystId: assignee.id,
                                regionId: assignee.regionId, // Use analyst's region
                                isScreener: false, // Default, can be adjusted
                            },
                        });

                        // Update workload
                        workload.set(assignee.id, (workload.get(assignee.id) || 0) + 1);
                        created++;
                    } catch (error) {
                        console.error(`Failed to reassign schedule: ${error}`);
                        failed++;
                    }
                } else {
                    failed++;
                }

            }
        }

        return { created, failed };
    }

    /**
     * Get current workload for analysts.
     */
    private async getAnalystWorkload(startDate: Date, endDate: Date): Promise<Map<string, number>> {
        const schedules = await this.prisma.schedule.findMany({
            where: {
                date: {
                    gte: startDate,
                    lte: endDate,
                },
            },
        });

        const workload = new Map<string, number>();
        for (const schedule of schedules) {
            workload.set(schedule.analystId, (workload.get(schedule.analystId) || 0) + 1);
        }

        return workload;
    }

    /**
     * Process all pending recalculations.
     */
    async processPendingRecalculations(): Promise<{
        processed: number;
        skipped: number;
        errors: string[];
    }> {
        const pendingConstraints = await this.prisma.schedulingConstraint.findMany({
            where: {
                requiresRecalculation: true,
                isActive: true,
            },
        });

        let processed = 0;
        let skipped = 0;
        const errors: string[] = [];

        for (const constraint of pendingConstraints) {
            try {
                const assessment = await constraintImpactAnalyzer.analyzeConstraintModification(
                    constraint.id
                );

                if (assessment.affectedSchedules.length > 0) {
                    await this.handleConstraintChange(constraint.id, assessment, {
                        recalculate: true,
                        grantCompOff: false,
                        extendToSubsequentWeeks: true,
                    });
                    processed++;
                } else {
                    // No affected schedules, just clear the flag
                    await this.prisma.schedulingConstraint.update({
                        where: { id: constraint.id },
                        data: { requiresRecalculation: false },
                    });
                    skipped++;
                }
            } catch (error: any) {
                errors.push(`Constraint ${constraint.id}: ${error.message}`);
            }
        }

        return { processed, skipped, errors };
    }
}

// Export singleton instance
export const recalculationEngine = new RecalculationEngine();
