import { prisma } from '../../lib/prisma';

export interface CompOffBank {
  analystId: string;
  totalEarned: number;
  totalUsed: number;
  availableBalance: number;
  lastUpdated: Date;
}

export interface CompOffTransaction {
  id: string;
  analystId: string;
  type: 'EARNED' | 'USED' | 'AUTO_ASSIGNED';
  earnedDate?: Date;
  compOffDate?: Date;
  reason: 'WEEKEND_WORK' | 'HOLIDAY_WORK' | 'OVERTIME' | 'MANUAL_REQUEST';
  days: number;
  isAutoAssigned: boolean;
  isBanked: boolean;
  description: string;
  createdAt: Date;
}

export interface CompOffBalance {
  analystId: string;
  availableBalance: number;
  totalEarned: number;
  totalUsed: number;
  recentTransactions: CompOffTransaction[];
}

export class CompOffBankService {
  /**
   * Idempotency guard: check if an overtime earn exists for analyst in a given week
   */
  private async hasOvertimeEarnedInWeek(analystId: string, weekStart: Date): Promise<number> {
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    const count = await prisma.compOffTransaction.count({
      where: {
        analystId,
        type: 'EARNED',
        reason: 'OVERTIME',
        earnedDate: { gte: weekStart, lte: weekEnd }
      }
    });
    return count;
  }
  
  /**
   * Get comp-off bank balance for an analyst
   */
  async getCompOffBalance(analystId: string): Promise<CompOffBalance> {
    const transactions = await prisma.compOffTransaction.findMany({
      where: { analystId },
      orderBy: { createdAt: 'desc' },
      take: 10
    });

    const totalEarned = transactions
      .filter(t => t.type === 'EARNED')
      .reduce((sum, t) => sum + t.days, 0);

    const totalUsed = transactions
      .filter(t => t.type === 'USED')
      .reduce((sum, t) => sum + t.days, 0);

    const availableBalance = totalEarned - totalUsed;

    return {
      analystId,
      availableBalance,
      totalEarned,
      totalUsed,
      recentTransactions: transactions.map(this.mapTransaction)
    };
  }

  /**
   * Get comp-off balances for multiple analysts
   */
  async getCompOffBalances(analystIds: string[]): Promise<CompOffBalance[]> {
    const balances = await Promise.all(
      analystIds.map(id => this.getCompOffBalance(id))
    );
    return balances;
  }

  /**
   * Earn comp-off days (for weekend work, holiday work, overtime)
   */
  async earnCompOff(
    analystId: string,
    earnedDate: Date,
    reason: 'WEEKEND_WORK' | 'HOLIDAY_WORK' | 'OVERTIME',
    days: number = 1,
    description?: string
  ): Promise<CompOffTransaction> {
    // Idempotency for OVERTIME per calendar week
    if (reason === 'OVERTIME') {
      const weekStart = new Date(earnedDate);
      weekStart.setHours(0,0,0,0);
      weekStart.setDate(weekStart.getDate() - weekStart.getDay());
      const existing = await this.hasOvertimeEarnedInWeek(analystId, weekStart);
      if (existing >= days) {
        // Return a no-op style transaction mapping to avoid duplicate credits
        return {
          id: 'noop',
          analystId,
          type: 'EARNED',
          earnedDate,
          compOffDate: undefined,
          reason,
          days: 0,
          isAutoAssigned: false,
          isBanked: true,
          description: 'Overtime already credited for this week',
          createdAt: new Date()
        };
      }
    }
    const transaction = await prisma.compOffTransaction.create({
      data: {
        analystId,
        type: 'EARNED',
        earnedDate,
        reason,
        days,
        isAutoAssigned: false,
        isBanked: true,
        description: description || `Earned ${days} comp-off day(s) for ${reason.toLowerCase().replace('_', ' ')} on ${earnedDate.toDateString()}`
      }
    });

    return this.mapTransaction(transaction);
  }

  /**
   * Use comp-off days
   */
  async useCompOff(
    analystId: string,
    compOffDate: Date,
    days: number = 1,
    reason: string = 'Manual request'
  ): Promise<CompOffTransaction> {
    // Check if analyst has enough comp-off balance
    const balance = await this.getCompOffBalance(analystId);
    if (balance.availableBalance < days) {
      throw new Error(`Insufficient comp-off balance. Available: ${balance.availableBalance}, Requested: ${days}`);
    }

    const transaction = await prisma.compOffTransaction.create({
      data: {
        analystId,
        type: 'USED',
        compOffDate,
        reason: 'MANUAL_REQUEST',
        days,
        isAutoAssigned: false,
        isBanked: false,
        description: `Used ${days} comp-off day(s) on ${compOffDate.toDateString()}: ${reason}`
      }
    });

    return this.mapTransaction(transaction);
  }

  /**
   * Auto-assign comp-off (same week compensation)
   */
  async autoAssignCompOff(
    analystId: string,
    earnedDate: Date,
    compOffDate: Date,
    reason: 'WEEKEND_WORK' | 'HOLIDAY_WORK',
    description?: string
  ): Promise<CompOffTransaction> {
    const transaction = await prisma.compOffTransaction.create({
      data: {
        analystId,
        type: 'AUTO_ASSIGNED',
        earnedDate,
        compOffDate,
        reason,
        days: 1,
        isAutoAssigned: true,
        isBanked: false,
        description: description || `Auto-assigned comp-off for ${reason.toLowerCase().replace('_', ' ')} work on ${earnedDate.toDateString()}, comp-off on ${compOffDate.toDateString()}`
      }
    });

    return this.mapTransaction(transaction);
  }

  /**
   * Bank comp-off when auto-assignment conflicts with existing schedule
   */
  async bankCompOff(
    analystId: string,
    earnedDate: Date,
    reason: 'WEEKEND_WORK' | 'HOLIDAY_WORK' | 'OVERTIME',
    days: number = 1,
    description?: string
  ): Promise<CompOffTransaction> {
    const transaction = await prisma.compOffTransaction.create({
      data: {
        analystId,
        type: 'EARNED',
        earnedDate,
        reason,
        days,
        isAutoAssigned: false,
        isBanked: true,
        description: description || `Banked ${days} comp-off day(s) for ${reason.toLowerCase().replace('_', ' ')} work on ${earnedDate.toDateString()}`
      }
    });

    return this.mapTransaction(transaction);
  }

  /**
   * Check if analyst has comp-off on a specific date
   */
  async hasCompOffOnDate(analystId: string, date: Date): Promise<boolean> {
    const dateStr = date.toISOString().split('T')[0];
    
    const transaction = await prisma.compOffTransaction.findFirst({
      where: {
        analystId,
        compOffDate: {
          gte: new Date(dateStr + 'T00:00:00.000Z'),
          lt: new Date(dateStr + 'T23:59:59.999Z')
        },
        type: {
          in: ['AUTO_ASSIGNED', 'USED']
        }
      }
    });

    return !!transaction;
  }

  /**
   * Get all comp-off transactions for an analyst within a date range
   */
  async getCompOffTransactions(
    analystId: string,
    startDate: Date,
    endDate: Date
  ): Promise<CompOffTransaction[]> {
    const transactions = await prisma.compOffTransaction.findMany({
      where: {
        analystId,
        OR: [
          {
            earnedDate: {
              gte: startDate,
              lte: endDate
            }
          },
          {
            compOffDate: {
              gte: startDate,
              lte: endDate
            }
          }
        ]
      },
      orderBy: { createdAt: 'asc' }
    });

    return transactions.map(this.mapTransaction);
  }

  /**
   * Get comp-off usage summary for analytics
   */
  async getCompOffUsageSummary(
    startDate: Date,
    endDate: Date
  ): Promise<{
    totalEarned: number;
    totalUsed: number;
    totalBanked: number;
    totalAutoAssigned: number;
    byReason: Record<string, number>;
    byAnalyst: Record<string, { earned: number; used: number; balance: number }>;
  }> {
    const transactions = await prisma.compOffTransaction.findMany({
      where: {
        OR: [
          {
            earnedDate: {
              gte: startDate,
              lte: endDate
            }
          },
          {
            compOffDate: {
              gte: startDate,
              lte: endDate
            }
          }
        ]
      }
    });

    const summary = {
      totalEarned: 0,
      totalUsed: 0,
      totalBanked: 0,
      totalAutoAssigned: 0,
      byReason: {} as Record<string, number>,
      byAnalyst: {} as Record<string, { earned: number; used: number; balance: number }>
    };

    transactions.forEach(transaction => {
      const analystId = transaction.analystId;
      
      // Initialize analyst summary if not exists
      if (!summary.byAnalyst[analystId]) {
        summary.byAnalyst[analystId] = { earned: 0, used: 0, balance: 0 };
      }

      if (transaction.type === 'EARNED') {
        summary.totalEarned += transaction.days;
        summary.byAnalyst[analystId].earned += transaction.days;
        
        if (transaction.isBanked) {
          summary.totalBanked += transaction.days;
        }
      } else if (transaction.type === 'USED') {
        summary.totalUsed += transaction.days;
        summary.byAnalyst[analystId].used += transaction.days;
      } else if (transaction.type === 'AUTO_ASSIGNED') {
        summary.totalAutoAssigned += transaction.days;
        summary.byAnalyst[analystId].earned += transaction.days;
        summary.byAnalyst[analystId].used += transaction.days;
      }

      // Count by reason
      const reason = transaction.reason;
      summary.byReason[reason] = (summary.byReason[reason] || 0) + transaction.days;
    });

    // Calculate balances
    Object.keys(summary.byAnalyst).forEach(analystId => {
      const analyst = summary.byAnalyst[analystId];
      analyst.balance = analyst.earned - analyst.used;
    });

    return summary;
  }

  /**
   * Map database transaction to interface
   */
  private mapTransaction(transaction: any): CompOffTransaction {
    return {
      id: transaction.id,
      analystId: transaction.analystId,
      type: transaction.type,
      earnedDate: transaction.earnedDate,
      compOffDate: transaction.compOffDate,
      reason: transaction.reason,
      days: transaction.days,
      isAutoAssigned: transaction.isAutoAssigned,
      isBanked: transaction.isBanked,
      description: transaction.description,
      createdAt: transaction.createdAt
    };
  }
}

export const compOffBankService = new CompOffBankService();
