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
     * @param regionId - Optional region filter
     */
    async getAllBalances(regionId?: string): Promise<
        {
            analystId: string;
            analystName: string;
            regionId: string;
            regionName: string;
            earned: number;
            used: number;
            available: number;
            lastTransaction: Date | null;
        }[]
    > {
        const balances = await this.prisma.compOffBalance.findMany({
            where: regionId ? {
                analyst: { regionId }
            } : undefined,
            include: {
                analyst: {
                    select: {
                        name: true,
                        regionId: true,
                        region: { select: { name: true } }
                    },
                },
                transactions: {
                    orderBy: { createdAt: 'desc' },
                    take: 1,
                    select: { createdAt: true }
                }
            },
        });

        return balances.map(b => ({
            analystId: b.analystId,
            analystName: b.analyst?.name || 'Unknown',
            regionId: b.analyst?.regionId || '',
            regionName: b.analyst?.region?.name || 'Unknown',
            earned: b.earnedUnits,
            used: b.usedUnits,
            available: b.earnedUnits - b.usedUnits,
            lastTransaction: b.transactions[0]?.createdAt || null,
        }));
    }

    /**
     * Get transaction history with date range filtering (for admin dashboard).
     * @param options - Filter options
     */
    async getTransactionHistory(options: {
        regionId?: string;
        analystId?: string;
        startDate?: Date;
        endDate?: Date;
        limit?: number;
        offset?: number;
    } = {}): Promise<{
        transactions: {
            id: string;
            analystId: string;
            analystName: string;
            amount: number;
            reason: string;
            constraintId: string | null;
            absenceId: string | null;
            createdAt: Date;
            runningBalance: number;
        }[];
        total: number;
    }> {
        const { regionId, analystId, startDate, endDate, limit = 50, offset = 0 } = options;

        // Build where clause
        const where: any = {};

        if (analystId) {
            where.balance = { analystId };
        } else if (regionId) {
            where.balance = { analyst: { regionId } };
        }

        if (startDate || endDate) {
            where.createdAt = {};
            if (startDate) where.createdAt.gte = startDate;
            if (endDate) where.createdAt.lte = endDate;
        }

        // Get total count
        const total = await this.prisma.compOffTransaction.count({ where });

        // Get transactions with analyst info
        const transactions = await this.prisma.compOffTransaction.findMany({
            where,
            include: {
                balance: {
                    include: {
                        analyst: { select: { name: true } }
                    }
                }
            },
            orderBy: { createdAt: 'desc' },
            take: limit,
            skip: offset,
        });

        // Calculate running balances (simplified - just show current balance after each transaction)
        // For accurate running balance, we'd need to calculate from the beginning
        const result = transactions.map(t => ({
            id: t.id,
            analystId: t.balance.analystId,
            analystName: t.balance.analyst?.name || 'Unknown',
            amount: t.amount,
            reason: t.reason,
            constraintId: t.constraintId,
            absenceId: t.absenceId,
            createdAt: t.createdAt,
            runningBalance: t.balance.earnedUnits - t.balance.usedUnits, // Current balance
        }));

        return { transactions: result, total };
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
    /**
     * Delete a transaction and revert its effect on the balance.
     */
    async deleteTransaction(transactionId: string, performerId: string): Promise<void> {
        const transaction = await this.prisma.compOffTransaction.findUnique({
            where: { id: transactionId },
            include: { balance: true }
        });

        if (!transaction) {
            throw new Error('Transaction not found');
        }

        // Revert balance effect
        const updates: any = {};

        if (transaction.amount > 0) {
            // It was a credit, so decrease earned
            updates.earnedUnits = transaction.balance.earnedUnits - transaction.amount;
        } else {
            // It was a debit (negative), so decrease used
            // usedUnits was increased by abs(amount), so we decrease it by abs(amount)
            updates.usedUnits = transaction.balance.usedUnits - Math.abs(transaction.amount);
        }

        // Atomic transaction: update balance, delete transaction, log activity
        await this.prisma.$transaction([
            this.prisma.compOffBalance.update({
                where: { id: transaction.balanceId },
                data: updates
            }),
            this.prisma.compOffTransaction.delete({
                where: { id: transactionId }
            }),
            this.prisma.activity.create({
                data: {
                    type: 'COMPOFF_ADJUSTMENT',
                    category: 'ADMIN',
                    title: 'CompOff Transaction Deleted',
                    description: `Deleted transaction of ${transaction.amount} units. Reason: ${transaction.reason}`,
                    performedBy: performerId,
                    metadata: JSON.stringify({
                        originalTransaction: {
                            amount: transaction.amount,
                            reason: transaction.reason,
                            constraintId: transaction.constraintId,
                            absenceId: transaction.absenceId
                        }
                    })
                }
            })
        ]);

        console.log(`🗑️ Deleted comp-off transaction ${transactionId} for analyst ${transaction.balance.analystId}`);
    }

    /**
     * Update a transaction and adjust balance accordingly.
     */
    async updateTransaction(
        transactionId: string,
        performerId: string,
        updates: { amount?: number; reason?: string }
    ): Promise<CompOffTransaction> {
        const transaction = await this.prisma.compOffTransaction.findUnique({
            where: { id: transactionId },
            include: { balance: true }
        });

        if (!transaction) {
            throw new Error('Transaction not found');
        }

        const newAmount = updates.amount !== undefined ? updates.amount : transaction.amount;
        const newReason = updates.reason || transaction.reason;

        // Calculate balance adjustments if amount changed
        const balanceUpdates: any = {};

        if (updates.amount !== undefined && updates.amount !== transaction.amount) {
            // Revert old effect
            let currentEarned = transaction.balance.earnedUnits;
            let currentUsed = transaction.balance.usedUnits;

            if (transaction.amount > 0) {
                currentEarned -= transaction.amount;
            } else {
                currentUsed -= Math.abs(transaction.amount);
            }

            // Apply new effect
            if (newAmount > 0) {
                currentEarned += newAmount;
            } else {
                currentUsed += Math.abs(newAmount);
            }

            balanceUpdates.earnedUnits = currentEarned;
            balanceUpdates.usedUnits = currentUsed;
        }

        // Atomic update
        const [updatedTx] = await this.prisma.$transaction([
            this.prisma.compOffTransaction.update({
                where: { id: transactionId },
                data: {
                    amount: newAmount,
                    reason: newReason
                }
            }),
            // Only update balance if needed
            ...(Object.keys(balanceUpdates).length > 0 ? [
                this.prisma.compOffBalance.update({
                    where: { id: transaction.balanceId },
                    data: balanceUpdates
                })
            ] : []),
            this.prisma.activity.create({
                data: {
                    type: 'COMPOFF_ADJUSTMENT',
                    category: 'ADMIN',
                    title: 'CompOff Transaction Updated',
                    description: `Updated transaction. Amount: ${transaction.amount} -> ${newAmount}, Reason: ${transaction.reason} -> ${newReason}`,
                    performedBy: performerId,
                    metadata: JSON.stringify({
                        before: { amount: transaction.amount, reason: transaction.reason },
                        after: { amount: newAmount, reason: newReason }
                    })
                }
            })
        ]);

        console.log(`✏️ Updated comp-off transaction ${transactionId}`);
        return updatedTx;
    }

    /**
     * Delete an analyst's entire comp-off balance and history.
     */
    async deleteBalance(analystId: string, performerId: string): Promise<void> {
        const balance = await this.prisma.compOffBalance.findUnique({
            where: { analystId }
        });

        if (!balance) {
            throw new Error('Balance not found');
        }

        // Log functionality before delete (since cascade will remove it)
        await this.prisma.activity.create({
            data: {
                type: 'COMPOFF_RESET',
                category: 'ADMIN',
                title: 'CompOff Balance Deleted',
                description: `Deleted entire comp-off history for analyst ${analystId}. Final Balance: Earned ${balance.earnedUnits}, Used ${balance.usedUnits}`,
                performedBy: performerId,
                metadata: JSON.stringify({
                    deletedBalance: {
                        earned: balance.earnedUnits,
                        used: balance.usedUnits
                    }
                })
            }
        });

        // Delete balance (Cascades to transactions)
        await this.prisma.compOffBalance.delete({
            where: { id: balance.id }
        });

        console.log(`💥 Deleted comp-off balance for analyst ${analystId}`);
    }

    /**
     * This method manually sets the balance by creating an adjustment transaction.
     * This preserves ledger integrity instead of just overwriting values.
     */
    async updateBalance(
        analystId: string,
        performerId: string,
        updates: { earnedUnits?: number; usedUnits?: number; reason?: string }
    ): Promise<CompOffBalance> {
        const balance = await this.getOrCreateBalance(analystId);

        const currentEarned = balance.earnedUnits;
        const currentUsed = balance.usedUnits;

        const targetEarned = updates.earnedUnits !== undefined ? updates.earnedUnits : currentEarned;
        const targetUsed = updates.usedUnits !== undefined ? updates.usedUnits : currentUsed;

        const earnedDiff = targetEarned - currentEarned;
        const usedDiff = targetUsed - currentUsed;

        if (earnedDiff === 0 && usedDiff === 0) {
            return balance;
        }

        const reason = updates.reason || 'MANUAL_BALANCE_ADJUSTMENT';

        // Net Change = (TargetEarned - TargetUsed) - (CurrentEarned - CurrentUsed)
        const netChange = (targetEarned - targetUsed) - (currentEarned - currentUsed);

        return await this.prisma.$transaction(async (tx) => {
            // 1. Create Reconciliation Transaction
            await tx.compOffTransaction.create({
                data: {
                    balanceId: balance.id,
                    amount: netChange,
                    reason: reason,
                    constraintId: 'ADMIN_OVERRIDE'
                }
            });

            // 2. Update Balance to exact targets
            const updated = await tx.compOffBalance.update({
                where: { id: balance.id },
                data: {
                    earnedUnits: targetEarned,
                    usedUnits: targetUsed
                }
            });

            // 3. Log Activity
            await tx.activity.create({
                data: {
                    type: 'COMPOFF_ADJUSTMENT',
                    category: 'ADMIN',
                    title: 'CompOff Balance Overridden',
                    description: `Manually set balance. Earned: ${currentEarned} -> ${targetEarned}, Used: ${currentUsed} -> ${targetUsed}`,
                    performedBy: performerId,
                    metadata: JSON.stringify({
                        before: { earned: currentEarned, used: currentUsed },
                        after: { earned: targetEarned, used: targetUsed }
                    })
                }
            });

            return updated;
        });
    }
}
// Export singleton instance
export const compOffService = new CompOffService();
