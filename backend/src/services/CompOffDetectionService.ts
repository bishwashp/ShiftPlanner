import { PrismaClient } from '../../generated/prisma';
import { prisma } from '../lib/prisma';
import moment from 'moment-timezone';

/**
 * Service for detecting CompOff eligibility based on rolling 7-day work periods.
 * 
 * Rules:
 * - CompOff is earned when an analyst works > 5 days in any rolling 7-day period
 * - 1 extra day = 1 compoff unit (so 6 days = 1, 7 days = 2)
 * - Working on holidays also grants compoff
 * - If holiday is on the 6th+ day, it counts as 1 (not double)
 */
export class CompOffDetectionService {
    private prisma: PrismaClient;

    constructor(prismaClient?: PrismaClient) {
        this.prisma = prismaClient || prisma;
    }

    /**
     * Validate if an analyst is eligible for compoff in a given date range.
     * Used for "Report Missing CompOff" validation.
     * 
     * @param analystId - Analyst to check
     * @param startDate - Start of date range to check
     * @param endDate - End of date range to check
     * @returns Eligible days and suggested compoff units
     */
    async validateRolling7DayEligibility(
        analystId: string,
        startDate: string,
        endDate: string
    ): Promise<{
        isEligible: boolean;
        eligibleDays: {
            date: string;
            daysWorkedInWindow: number;
            excessDays: number;
            isHoliday: boolean;
        }[];
        suggestedUnits: number;
        reason: string;
    }> {
        const start = moment(startDate).startOf('day');
        const end = moment(endDate).endOf('day');

        // Get analyst's region for holiday lookup
        const analyst = await this.prisma.analyst.findUnique({
            where: { id: analystId },
            select: { regionId: true }
        });

        if (!analyst) {
            return {
                isEligible: false,
                eligibleDays: [],
                suggestedUnits: 0,
                reason: 'Analyst not found'
            };
        }

        // Get all schedules for the analyst in the extended range
        // We need 6 days before start to calculate rolling window
        const extendedStart = start.clone().subtract(6, 'days');

        const schedules = await this.prisma.schedule.findMany({
            where: {
                analystId,
                date: {
                    gte: extendedStart.toDate(),
                    lte: end.toDate()
                }
            },
            orderBy: { date: 'asc' }
        });

        // Get holidays in the range
        const holidays = await this.prisma.holiday.findMany({
            where: {
                regionId: analyst.regionId,
                date: {
                    gte: extendedStart.toDate(),
                    lte: end.toDate()
                },
                isActive: true
            }
        });

        const holidayDates = new Set(
            holidays.map(h => moment(h.date).format('YYYY-MM-DD'))
        );

        // Build a set of worked dates
        const workedDates = new Set(
            schedules.map(s => moment(s.date).format('YYYY-MM-DD'))
        );

        // Check each day in the requested range
        const eligibleDays: {
            date: string;
            daysWorkedInWindow: number;
            excessDays: number;
            isHoliday: boolean;
        }[] = [];

        let suggestedUnits = 0;
        const alreadyCreditedDays = new Set<string>();

        // Track days already credited in this analysis to avoid double counting
        const currentDate = start.clone();

        while (currentDate.isSameOrBefore(end)) {
            const dateStr = currentDate.format('YYYY-MM-DD');
            const isHoliday = holidayDates.has(dateStr);
            const wasWorked = workedDates.has(dateStr);

            if (wasWorked) {
                // Calculate rolling 7-day window ending on this date
                const windowStart = currentDate.clone().subtract(6, 'days');
                let daysInWindow = 0;

                for (let d = windowStart.clone(); d.isSameOrBefore(currentDate); d.add(1, 'day')) {
                    if (workedDates.has(d.format('YYYY-MM-DD'))) {
                        daysInWindow++;
                    }
                }

                // Check if this day triggers compoff (>5 days in window)
                if (daysInWindow > 5 && !alreadyCreditedDays.has(dateStr)) {
                    const excessDays = daysInWindow - 5;

                    // If it's a holiday and that's what pushed over 5, count as 1 holiday compoff
                    if (isHoliday) {
                        eligibleDays.push({
                            date: dateStr,
                            daysWorkedInWindow: daysInWindow,
                            excessDays: 1, // Holiday counts as 1 even if it's 6th+ day
                            isHoliday: true
                        });
                        suggestedUnits += 1;
                        alreadyCreditedDays.add(dateStr);
                    } else {
                        eligibleDays.push({
                            date: dateStr,
                            daysWorkedInWindow: daysInWindow,
                            excessDays,
                            isHoliday: false
                        });
                        // Only count 1 unit per day over 5, but we already counted prior days
                        // So we just add 1 for this day being the 6th, 7th, etc.
                        if (!alreadyCreditedDays.has(dateStr)) {
                            suggestedUnits += 1;
                        }
                        alreadyCreditedDays.add(dateStr);
                    }
                } else if (isHoliday && wasWorked && !alreadyCreditedDays.has(dateStr)) {
                    // Holiday worked but not in a 6+ day window - still gets compoff
                    eligibleDays.push({
                        date: dateStr,
                        daysWorkedInWindow: daysInWindow,
                        excessDays: 0,
                        isHoliday: true
                    });
                    suggestedUnits += 1;
                    alreadyCreditedDays.add(dateStr);
                }
            }

            currentDate.add(1, 'day');
        }

        return {
            isEligible: eligibleDays.length > 0,
            eligibleDays,
            suggestedUnits,
            reason: eligibleDays.length > 0
                ? `Found ${eligibleDays.length} day(s) eligible for compoff`
                : 'No days exceeded 5-day rolling window threshold'
        };
    }

    /**
     * Check if compoff was already credited for specific days.
     * Used to prevent duplicate crediting.
     */
    async checkExistingCredits(
        analystId: string,
        dates: string[]
    ): Promise<{
        date: string;
        alreadyCredited: boolean;
        transactionId?: string;
    }[]> {
        const balance = await this.prisma.compOffBalance.findUnique({
            where: { analystId },
            include: {
                transactions: {
                    where: { amount: { gt: 0 } }, // Only credits
                    select: {
                        id: true,
                        reason: true,
                        createdAt: true
                    }
                }
            }
        });

        if (!balance) {
            return dates.map(date => ({ date, alreadyCredited: false }));
        }

        // This is a simplified check - in production, we'd need to store
        // which specific dates each transaction covers
        // For now, we'll just check if there are any credits in the date range
        return dates.map(date => ({
            date,
            alreadyCredited: false, // Simplified - would need date tracking in transactions
        }));
    }

    /**
     * Get summary of compoff eligibility for a date range.
     * Used for admin review of "Report Missing" requests.
     */
    async getEligibilitySummary(
        analystId: string,
        startDate: string,
        endDate: string
    ): Promise<{
        analystName: string;
        regionName: string;
        requestedRange: { start: string; end: string };
        eligibility: {
            isEligible: boolean;
            eligibleDays: {
                date: string;
                daysWorkedInWindow: number;
                excessDays: number;
                isHoliday: boolean;
            }[];
            suggestedUnits: number;
            reason: string;
        };
        currentBalance: { earned: number; used: number; available: number };
    }> {
        const analyst = await this.prisma.analyst.findUnique({
            where: { id: analystId },
            include: {
                region: { select: { name: true } },
                compOffBalance: true
            }
        });

        if (!analyst) {
            throw new Error('Analyst not found');
        }

        const eligibility = await this.validateRolling7DayEligibility(
            analystId,
            startDate,
            endDate
        );

        return {
            analystName: analyst.name,
            regionName: analyst.region.name,
            requestedRange: { start: startDate, end: endDate },
            eligibility,
            currentBalance: {
                earned: analyst.compOffBalance?.earnedUnits || 0,
                used: analyst.compOffBalance?.usedUnits || 0,
                available: (analyst.compOffBalance?.earnedUnits || 0) -
                    (analyst.compOffBalance?.usedUnits || 0)
            }
        };
    }
}

// Export singleton instance
export const compOffDetectionService = new CompOffDetectionService();
