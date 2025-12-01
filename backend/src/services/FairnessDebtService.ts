import { PrismaClient } from '../../generated/prisma';
import moment from 'moment-timezone';

export class FairnessDebtService {
    private prisma: PrismaClient;

    constructor(prisma: PrismaClient) {
        this.prisma = prisma;
    }

    /**
     * Create a new fairness debt record
     * Only creates debt for VACATION type absences (or planned absences)
     */
    async createDebt(
        analystId: string,
        amount: number,
        reason: string,
        absenceId?: string,
        absenceType?: string
    ): Promise<any> {
        // Policy: Only VACATION incurs debt. Sick leave, emergency, etc. do not.
        // If absenceType is provided, check it.
        if (absenceType && absenceType !== 'VACATION') {
            console.log(`Skipping debt creation for absence type: ${absenceType}`);
            return null;
        }

        return await this.prisma.fairnessDebt.create({
            data: {
                analystId,
                absenceId,
                debtAmount: amount,
                reason,
            },
        });
    }

    /**
     * Create a credit (negative debt) for covering an absence
     * Always applies, regardless of absence type
     */
    async createCredit(analystId: string, amount: number, reason: string): Promise<any> {
        // Credit is just negative debt in this model, or we could track it separately.
        // For now, let's track it as a negative debt amount to "repay" existing debt or build surplus.
        // However, the schema says "debtAmount". Let's assume positive = debt (owe work), negative = credit (did extra).

        // Check if analyst has existing debt to resolve first?
        // Or just log the credit record.
        // Let's log the credit record.
        return await this.prisma.fairnessDebt.create({
            data: {
                analystId,
                debtAmount: -amount, // Negative amount = Credit
                reason,
                resolvedAt: new Date(), // Credits are "resolved" immediately as they are earned
            },
        });
    }

    /**
     * Get current net debt for an analyst
     * Positive = Owe work
     * Negative = Has surplus credit
     */
    async getNetDebt(analystId: string): Promise<number> {
        const debts = await this.prisma.fairnessDebt.findMany({
            where: {
                analystId,
                resolvedAt: null, // Only count unresolved debts? 
                // Actually, if we use the ledger approach (sum of all), we should sum everything.
                // But the schema has `resolvedAt`. 
                // Strategy: 
                // - Debts are created with resolvedAt = null.
                // - Credits are created with resolvedAt = now.
                // - When a debt is "repaid" by assignment, we mark it resolved.
                // - BUT, if we want a simple "score", we might just sum all active debts.

                // Let's stick to the plan: "Prioritize analysts who 'owe' team".
                // So we care about UNRESOLVED positive debt.
            },
        });

        const totalDebt = debts.reduce((sum: number, record: any) => sum + record.debtAmount, 0);
        return totalDebt;
    }

    /**
     * Mark a specific debt record as resolved
     */
    async resolveDebt(debtId: string): Promise<void> {
        await this.prisma.fairnessDebt.update({
            where: { id: debtId },
            data: { resolvedAt: new Date() },
        });
    }

    /**
     * Calculate weighted debt amount based on shift type
     */
    calculateAbsenceDebt(shiftType: 'MORNING' | 'EVENING' | 'WEEKEND', isScreener: boolean): number {
        let weight = 1.0; // Base weight for regular shift

        if (shiftType === 'WEEKEND') {
            weight += 0.5; // Weekend penalty
        }

        if (isScreener) {
            weight += 0.5; // Screener penalty
        }

        return weight;
    }

    /**
     * Get all active (unresolved) debts for an analyst
     */
    async getActiveDebts(analystId: string): Promise<any[]> {
        return await this.prisma.fairnessDebt.findMany({
            where: {
                analystId,
                resolvedAt: null,
                debtAmount: { gt: 0 } // Only positive debts
            },
            orderBy: { createdAt: 'asc' }
        });
    }
}

import { prisma } from '../lib/prisma';
export const fairnessDebtService = new FairnessDebtService(prisma);
