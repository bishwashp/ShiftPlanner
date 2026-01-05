import { PrismaClient, GenerationBlock, SchedulingConstraint, Analyst } from '../../generated/prisma';
import { prisma } from '../lib/prisma';

export interface CreateBlockParams {
    name: string;
    startDate: Date;
    endDate: Date;
    algorithmType: string;
    generatedBy: string;
    constraints: SchedulingConstraint[];
    analysts: Analyst[];
    config?: any;
}

export interface ScheduleDecision {
    date: string;
    analystId: string;
    analystName: string;
    shiftType: string;
    isScreener: boolean;
    reason: string;
    constraintsSatisfied: string[];
    constraintsViolated?: string[];
    alternativesConsidered?: { analystId: string; score: number; reason: string }[];
}

export interface FinalizeBlockParams {
    schedulesGenerated: number;
    fairnessScore?: number;
    executionTimeMs?: number;
    decisions: ScheduleDecision[];
}

export class GenerationBlockService {
    private prisma: PrismaClient;

    constructor(prismaClient?: PrismaClient) {
        this.prisma = prismaClient || prisma;
    }

    /**
     * Create a new generation block before schedule generation starts.
     * Takes snapshots of constraints and analyst pool at generation time.
     */
    async createBlock(params: CreateBlockParams): Promise<GenerationBlock> {
        const { name, startDate, endDate, algorithmType, generatedBy, constraints, analysts, config } = params;

        // Create snapshots of current state
        const constraintSnapshot = JSON.stringify(
            constraints.map(c => ({
                id: c.id,
                analystId: c.analystId,
                constraintType: c.constraintType,
                startDate: c.startDate,
                endDate: c.endDate,
                description: c.description,
                templateId: c.templateId,
                templateParams: c.templateParams,
                requiresRecalculation: c.requiresRecalculation,
                grantsCompOff: c.grantsCompOff,
                compOffUnits: c.compOffUnits,
            }))
        );

        const analystPoolSnapshot = JSON.stringify(
            analysts.map(a => ({
                id: a.id,
                name: a.name,
                shiftType: a.shiftType,
                isActive: a.isActive,
                employeeType: a.employeeType,
            }))
        );

        const configSnapshot = config ? JSON.stringify(config) : null;

        const block = await this.prisma.generationBlock.create({
            data: {
                name,
                startDate,
                endDate,
                algorithmType,
                constraintSnapshot,
                analystPoolSnapshot,
                configSnapshot,
                schedulesGenerated: 0, // Will be updated on finalize
                generatedBy,
                generatedAt: new Date(),
            },
        });

        console.log(`📦 Created generation block: ${block.id} - ${name}`);
        return block;
    }

    /**
     * Finalize a generation block after schedule generation completes.
     * Records the number of schedules generated, fairness score, and decision log.
     */
    async finalizeBlock(blockId: string, params: FinalizeBlockParams): Promise<GenerationBlock> {
        const { schedulesGenerated, fairnessScore, executionTimeMs, decisions } = params;

        const decisionLog = JSON.stringify(decisions);

        const block = await this.prisma.generationBlock.update({
            where: { id: blockId },
            data: {
                schedulesGenerated,
                fairnessScore,
                executionTimeMs,
                decisionLog,
            },
        });

        // Apply T-2 retention policy after finalizing
        await this.applyRetentionPolicy();

        console.log(`✅ Finalized generation block: ${block.id} with ${schedulesGenerated} schedules`);
        return block;
    }

    /**
     * Log a single decision for audit trail.
     * Can be called during schedule generation to incrementally build decision log.
     */
    async logDecision(blockId: string, decision: ScheduleDecision): Promise<void> {
        const block = await this.prisma.generationBlock.findUnique({
            where: { id: blockId },
            select: { decisionLog: true },
        });

        if (!block) {
            throw new Error(`Generation block not found: ${blockId}`);
        }

        const currentLog: ScheduleDecision[] = block.decisionLog
            ? JSON.parse(block.decisionLog)
            : [];

        currentLog.push(decision);

        await this.prisma.generationBlock.update({
            where: { id: blockId },
            data: { decisionLog: JSON.stringify(currentLog) },
        });
    }

    /**
     * Append a decision or event to the decision log of the most recent block.
     * Used for amendments like recalculations or manual overrides.
     */
    async appendAmendment(
        description: string,
        details: any,
        actorId: string
    ): Promise<void> {
        // finding the last block
        const block = await this.prisma.generationBlock.findFirst({
            orderBy: { generatedAt: 'desc' }
        });

        if (!block) {
            console.warn('No generation block found to append amendment');
            return;
        }

        const decision: ScheduleDecision = {
            date: new Date().toISOString(),
            analystId: 'system',
            analystName: 'System',
            shiftType: 'AMENDMENT',
            isScreener: false,
            reason: description,
            constraintsSatisfied: [],
            alternativesConsidered: [],
            // details stored in extra field or just logged in reason/constraintsSatisfied for now
            // To be robust, ScheduleDecision might need an 'metadata' field, but for now we fit it in
        };

        await this.logDecision(block.id, decision);
    }

    /**
     * Get the most recent generation blocks (for continuity reference).
     */
    async getRecentBlocks(count: number = 2): Promise<GenerationBlock[]> {
        return this.prisma.generationBlock.findMany({
            take: count,
            orderBy: { generatedAt: 'desc' },
        });
    }

    /**
     * Get a specific block by ID with parsed snapshots.
     */
    async getBlockById(blockId: string): Promise<{
        block: GenerationBlock;
        constraints: any[];
        analysts: any[];
        decisions: ScheduleDecision[];
        config: any | null;
    } | null> {
        const block = await this.prisma.generationBlock.findUnique({
            where: { id: blockId },
        });

        if (!block) return null;

        return {
            block,
            constraints: JSON.parse(block.constraintSnapshot),
            analysts: JSON.parse(block.analystPoolSnapshot),
            decisions: block.decisionLog ? JSON.parse(block.decisionLog) : [],
            config: block.configSnapshot ? JSON.parse(block.configSnapshot) : null,
        };
    }

    /**
     * Get the last block for continuity when starting a new generation.
     * Useful for understanding where the previous generation ended.
     */
    async getLastBlock(): Promise<GenerationBlock | null> {
        return this.prisma.generationBlock.findFirst({
            orderBy: { generatedAt: 'desc' },
        });
    }

    /**
     * Apply T-2 retention policy: keep only the last 2 generation blocks.
     * Older blocks are deleted to save storage.
     */
    async applyRetentionPolicy(): Promise<{ deletedCount: number }> {
        const T_MINUS_2 = 2;

        // Get all blocks ordered by generation time
        const allBlocks = await this.prisma.generationBlock.findMany({
            orderBy: { generatedAt: 'desc' },
            select: { id: true, generatedAt: true, name: true },
        });

        if (allBlocks.length <= T_MINUS_2) {
            return { deletedCount: 0 };
        }

        // Blocks to delete (everything after the first T-2)
        const blocksToDelete = allBlocks.slice(T_MINUS_2);
        const idsToDelete = blocksToDelete.map(b => b.id);

        // Mark retained blocks
        const blocksToRetain = allBlocks.slice(0, T_MINUS_2);
        for (const block of blocksToRetain) {
            await this.prisma.generationBlock.update({
                where: { id: block.id },
                data: { retainedAt: new Date() },
            });
        }

        // Delete old blocks
        await this.prisma.generationBlock.deleteMany({
            where: { id: { in: idsToDelete } },
        });

        console.log(`🗑️ Applied T-2 retention: deleted ${blocksToDelete.length} old blocks`);
        return { deletedCount: blocksToDelete.length };
    }

    /**
     * Generate a semantic name for a generation block based on date range.
     */
    static generateBlockName(startDate: Date, endDate: Date): string {
        const startMonth = startDate.toLocaleString('en-US', { month: 'short' });
        const endMonth = endDate.toLocaleString('en-US', { month: 'short' });
        const year = startDate.getFullYear();

        const startDay = startDate.getDate();
        const endDay = endDate.getDate();

        if (startMonth === endMonth) {
            return `${startMonth} ${startDay}-${endDay}, ${year}`;
        } else {
            return `${startMonth} ${startDay} - ${endMonth} ${endDay}, ${year}`;
        }
    }

    /**
     * Get generation statistics for reporting.
     */
    async getGenerationStats(): Promise<{
        totalBlocks: number;
        totalSchedulesGenerated: number;
        averageFairnessScore: number | null;
        averageExecutionTime: number | null;
        lastGeneratedAt: Date | null;
    }> {
        const blocks = await this.prisma.generationBlock.findMany({
            select: {
                schedulesGenerated: true,
                fairnessScore: true,
                executionTimeMs: true,
                generatedAt: true,
            },
        });

        if (blocks.length === 0) {
            return {
                totalBlocks: 0,
                totalSchedulesGenerated: 0,
                averageFairnessScore: null,
                averageExecutionTime: null,
                lastGeneratedAt: null,
            };
        }

        const totalSchedules = blocks.reduce((sum, b) => sum + b.schedulesGenerated, 0);
        const fairnessScores = blocks.filter(b => b.fairnessScore !== null).map(b => b.fairnessScore!);
        const executionTimes = blocks.filter(b => b.executionTimeMs !== null).map(b => b.executionTimeMs!);

        return {
            totalBlocks: blocks.length,
            totalSchedulesGenerated: totalSchedules,
            averageFairnessScore:
                fairnessScores.length > 0
                    ? fairnessScores.reduce((a, b) => a + b, 0) / fairnessScores.length
                    : null,
            averageExecutionTime:
                executionTimes.length > 0
                    ? executionTimes.reduce((a, b) => a + b, 0) / executionTimes.length
                    : null,
            lastGeneratedAt: blocks[0]?.generatedAt || null,
        };
    }
}

// Export singleton instance
export const generationBlockService = new GenerationBlockService();
