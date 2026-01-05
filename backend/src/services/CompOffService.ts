import { PrismaClient, CompOffBalance, CompOffTransaction } from '../../generated/prisma';
import { prisma } from '../lib/prisma';

export interface CompOffBalanceWithTransactions extends CompOffBalance {
    transactions: CompOffTransaction[];
}

export class CompOffService {
    private prisma: PrismaClient;

    constructor(prismaClient?: PrismaClient) {
        this.prisma = prismaClient || prisma;
    }

    /**
     * Get or create a CompOff balance for an analyst.
     */
    async getOrCreateBalance(analystId: string): Promise<CompOffBalance> {
        let balance = await this.prisma.compOffBalance.findUnique({
            where: { analystId },
        });

        if (!balance) {
            balance = await this.prisma.compOffBalance.create({
                data: {
                    analystId,
                    earnedUnits: 0,
                    usedUnits: 0,
                },
            });
        }

        return balance;
    }

    /**
     * Get an analyst's current comp-off balance.
     */
    async getBalance(analystId: string): Promise<{
        earned: number;
        used: number;
        available: number;
    }> {
        const balance = await this.getOrCreateBalance(analystId);

        return {
            earned: balance.earnedUnits,
            used: balance.usedUnits,
            available: balance.earnedUnits - balance.usedUnits,
        };
    }

    /**
     * Credit comp-off units from a constraint (e.g., special event coverage).
     */
    async creditFromConstraint(
        analystId: string,
        constraintId: string,
        units: number,
        reason: string
    ): Promise<CompOffTransaction> {
        const balance = await this.getOrCreateBalance(analystId);

        // Create transaction
        const transaction = await this.prisma.compOffTransaction.create({
            data: {
                balanceId: balance.id,
                amount: units,
                reason,
                constraintId,
            },
        });

        // Update balance
        await this.prisma.compOffBalance.update({
            where: { id: balance.id },
            data: {
                earnedUnits: balance.earnedUnits + units,
            },
        });

        console.log(`💰 Credited ${units} comp-off units to analyst ${analystId} from constraint ${constraintId}`);
        return transaction;
    }

    /**
     * Debit comp-off units for an absence redemption.
     */
    async debitForAbsence(
        analystId: string,
        absenceId: string,
        units: number
    ): Promise<CompOffTransaction> {
        const balance = await this.getOrCreateBalance(analystId);
        const available = balance.earnedUnits - balance.usedUnits;

        if (units > available) {
            throw new Error(
                `Insufficient comp-off balance. Available: ${available}, Requested: ${units}`
            );
        }

        // Create transaction (negative amount for debits)
        const transaction = await this.prisma.compOffTransaction.create({
            data: {
                balanceId: balance.id,
                amount: -units,
                reason: 'ABSENCE_REDEMPTION',
                absenceId,
            },
        });

        // Update balance
        await this.prisma.compOffBalance.update({
            where: { id: balance.id },
            data: {
                usedUnits: balance.usedUnits + units,
            },
        });

        console.log(`💸 Debited ${units} comp-off units from analyst ${analystId} for absence ${absenceId}`);
        return transaction;
    }

    /**
     * Get transaction history for an analyst.
     */
    async getTransactions(
        analystId: string,
        limit?: number
    ): Promise<CompOffTransaction[]> {
        const balance = await this.prisma.compOffBalance.findUnique({
            where: { analystId },
            include: {
                transactions: {
                    orderBy: { createdAt: 'desc' },
                    take: limit,
                },
            },
        });

        return balance?.transactions || [];
    }

    /**
     * Get full balance details with transactions.
     */
    async getBalanceWithTransactions(
        analystId: string
    ): Promise<CompOffBalanceWithTransactions | null> {
        const balance = await this.prisma.compOffBalance.findUnique({
            where: { analystId },
            include: {
                transactions: {
                    orderBy: { createdAt: 'desc' },
                },
            },
        });

        return balance;
    }

    /**
     * Check if an analyst has sufficient balance for a redemption.
     */
    async hasAvailableBalance(analystId: string, units: number): Promise<boolean> {
        const balance = await this.getBalance(analystId);
        return balance.available >= units;
    }

    /**
     * Get all analysts with comp-off balances for reporting.
     */
    async getAllBalances(): Promise<
        {
            analystId: string;
            analystName: string;
            earned: number;
            used: number;
            available: number;
        }[]
    > {
        const balances = await this.prisma.compOffBalance.findMany({
            include: {
                analyst: {
                    select: { name: true },
                },
            },
        });

        return balances.map(b => ({
            analystId: b.analystId,
            analystName: b.analyst?.name || 'Unknown',
            earned: b.earnedUnits,
            used: b.usedUnits,
            available: b.earnedUnits - b.usedUnits,
        }));
    }

    /**
     * Calculate total comp-off liability (outstanding balances).
     */
    async getTotalLiability(): Promise<{
        totalEarned: number;
        totalUsed: number;
        totalOutstanding: number;
    }> {
        const balances = await this.prisma.compOffBalance.findMany();

        const totalEarned = balances.reduce((sum, b) => sum + b.earnedUnits, 0);
        const totalUsed = balances.reduce((sum, b) => sum + b.usedUnits, 0);

        return {
            totalEarned,
            totalUsed,
            totalOutstanding: totalEarned - totalUsed,
        };
    }
}

// Export singleton instance
export const compOffService = new CompOffService();
