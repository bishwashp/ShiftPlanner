import moment from 'moment-timezone';
import { prisma } from '../lib/prisma';
import { scoringEngine } from './scheduling/algorithms/ScoringEngine';
import { fairnessDebtService } from './FairnessDebtService';
import { DateUtils } from '../utils/dateUtils';

export class ReplacementService {
    /**
     * Find the best replacement analyst for a specific shift
     */
    async findReplacement(
        date: Date,
        shiftType: 'MORNING' | 'EVENING' | 'WEEKEND',
        originalAnalystId: string,
        excludedAnalystIds: string[] = []
    ): Promise<{ analystId: string; analystName: string; confidence: number; concerns: string[] } | null> {
        const dateStr = DateUtils.formatDate(date);

        // 1. Fetch all active analysts
        const allAnalysts = await prisma.analyst.findMany({
            where: { isActive: true }
        });

        // 2. Filter candidates
        const candidates = allAnalysts.filter(a =>
            a.id !== originalAnalystId &&
            !excludedAnalystIds.includes(a.id)
        );

        // 3. Check availability (not absent AND not already scheduled)
        // We need to check absences and schedules for candidates
        const availableCandidates = [];
        for (const candidate of candidates) {
            // Check if absent
            const isAbsent = await prisma.absence.findFirst({
                where: {
                    analystId: candidate.id,
                    startDate: { lte: DateUtils.getEndOfDay(date) },
                    endDate: { gte: DateUtils.getStartOfDay(date) },
                    isApproved: true
                }
            });

            // Check if already scheduled for this date
            const hasSchedule = await prisma.schedule.findFirst({
                where: {
                    analystId: candidate.id,
                    date: {
                        gte: DateUtils.getStartOfDay(date),
                        lte: DateUtils.getEndOfDay(date)
                    }
                }
            });

            if (!isAbsent && !hasSchedule) {
                availableCandidates.push(candidate);
            }
        }

        if (availableCandidates.length === 0) return null;

        // 4. Fetch History for Scoring
        // We need recent history for fatigue/consecutive checks
        const historyStartDate = moment(date).subtract(14, 'days').toDate(); // Keep moment for simple subtraction for now, or add to DateUtils
        const history = await prisma.schedule.findMany({
            where: {
                date: { gte: historyStartDate, lt: date }
            }
        });

        // 5. Fetch Debt Map
        const debtMap = new Map<string, number>();
        for (const candidate of availableCandidates) {
            const debt = await fairnessDebtService.getNetDebt(candidate.id);
            debtMap.set(candidate.id, debt);
        }

        // 6. Fetch Coverage Counts (Fatigue)
        // Count how many replacements each candidate has done in last 30 days
        const coverageStartDate = moment(date).subtract(30, 'days').toDate();
        const coverageCounts = new Map<string, number>();

        const recentReplacements = await prisma.replacementAssignment.findMany({
            where: {
                date: { gte: coverageStartDate },
                status: 'ACTIVE'
            }
        });

        for (const rep of recentReplacements) {
            const count = coverageCounts.get(rep.replacementAnalystId) || 0;
            coverageCounts.set(rep.replacementAnalystId, count + 1);
        }

        // 7. Calculate Scores
        const scoredCandidates = scoringEngine.calculateScores(
            availableCandidates,
            dateStr,
            shiftType,
            history,
            debtMap,
            coverageCounts
        );

        // 8. Sort by Score
        scoredCandidates.sort((a, b) => b.score - a.score);

        const bestCandidate = scoredCandidates[0];

        if (!bestCandidate) return null;

        // 9. Determine Confidence & Concerns
        // Confidence based on score (0-100 normalized? ScoringEngine returns raw score)
        // Let's assume max possible score is around 100-150.
        // >80 is High, >50 is Medium, <50 is Low.
        let confidence = 0;
        if (bestCandidate.score > 80) confidence = 0.9;
        else if (bestCandidate.score > 50) confidence = 0.7;
        else confidence = 0.4;

        return {
            analystId: bestCandidate.analystId,
            analystName: bestCandidate.analystName,
            confidence,
            concerns: bestCandidate.reasoning
        };
    }

    /**
     * Distribute multi-day absence replacement across multiple analysts
     */
    async distributeMultiDayReplacement(
        absenceId: string,
        startDate: Date,
        endDate: Date,
        originalAnalystId: string
    ): Promise<void> {
        const start = moment.utc(startDate).startOf('day');
        const end = moment.utc(endDate).startOf('day');

        // Iterate each day
        let current = start.clone();
        while (current.isSameOrBefore(end)) {
            const date = current.toDate();
            const dateStr = DateUtils.formatDate(date);

            console.log(`[ReplacementService] Processing date: ${dateStr} for analyst: ${originalAnalystId}`);

            // Find original schedule
            const originalSchedule = await prisma.schedule.findFirst({
                where: {
                    analystId: originalAnalystId,
                    date: {
                        gte: DateUtils.getStartOfDay(date),
                        lte: DateUtils.getEndOfDay(date)
                    }
                }
            });

            if (!originalSchedule) {
                console.log(`[ReplacementService] No schedule found for ${originalAnalystId} on ${dateStr}`);
                current.add(1, 'day');
                continue;
            }

            console.log(`[ReplacementService] Found schedule: ${originalSchedule.id} (${originalSchedule.shiftType}, screener: ${originalSchedule.isScreener})`);

            const isWeekend = originalSchedule.shiftType === 'WEEKEND';
            const isScreener = originalSchedule.isScreener;

            // SCREENER on Weekday: Transfer screener role to someone already working that shift
            if (isScreener && !isWeekend) {
                console.log(`[ReplacementService] Screener replacement needed for ${originalSchedule.shiftType} shift`);

                // Find analysts ALREADY SCHEDULED for this shift type on this date
                const candidateSchedules = await prisma.schedule.findMany({
                    where: {
                        date: {
                            gte: DateUtils.getStartOfDay(date),
                            lte: DateUtils.getEndOfDay(date)
                        },
                        shiftType: originalSchedule.shiftType,
                        analystId: { not: originalAnalystId },
                        isScreener: false // Find non-screeners to promote
                    },
                    include: { analyst: true }
                });

                if (candidateSchedules.length > 0) {
                    // Pick best candidate (for now, just first available)
                    // TODO: Use scoring engine for fairness
                    const newScreenerSchedule = candidateSchedules[0];

                    // Update their schedule to be screener
                    await prisma.schedule.update({
                        where: { id: newScreenerSchedule.id },
                        data: { isScreener: true }
                    });

                    console.log(`[ReplacementService] Transferred screener role to ${newScreenerSchedule.analyst.name}`);

                    // Create replacement assignment record
                    await prisma.replacementAssignment.create({
                        data: {
                            originalAnalystId,
                            replacementAnalystId: newScreenerSchedule.analystId,
                            date: date,
                            shiftType: originalSchedule.shiftType,
                            status: 'ACTIVE'
                        }
                    });

                    // Credit for taking screener
                    await fairnessDebtService.createCredit(
                        newScreenerSchedule.analystId,
                        1.0,
                        `Covered screener duty for ${originalAnalystId} on ${dateStr}`
                    );

                    // Delete original schedule
                    await prisma.schedule.delete({ where: { id: originalSchedule.id } });
                    console.log(`[ReplacementService] Deleted ${originalAnalystId}'s schedule`);
                } else {
                    console.log(`[ReplacementService] No available analysts to transfer screener role`);
                }
            }
            // WEEKEND: Find actual replacement (someone to come in)
            else if (isWeekend) {
                console.log(`[ReplacementService] Weekend replacement needed`);

                const replacement = await this.findReplacement(
                    date,
                    originalSchedule.shiftType as any,
                    originalAnalystId
                );

                if (replacement) {
                    // Create replacement assignment
                    await prisma.replacementAssignment.create({
                        data: {
                            originalAnalystId,
                            replacementAnalystId: replacement.analystId,
                            date: date,
                            shiftType: originalSchedule.shiftType,
                            status: 'ACTIVE'
                        }
                    });

                    // Update schedule
                    await prisma.schedule.update({
                        where: { id: originalSchedule.id },
                        data: {
                            analystId: replacement.analystId,
                            isScreener: false
                        }
                    });

                    console.log(`[ReplacementService] Replaced ${originalAnalystId} with ${replacement.analystId} on ${dateStr}`);

                    // Create credit
                    await fairnessDebtService.createCredit(
                        replacement.analystId,
                        1.0,
                        `Covered weekend for ${originalAnalystId} on ${dateStr}`
                    );
                } else {
                    console.log(`[ReplacementService] No weekend replacement found for ${originalAnalystId} on ${dateStr}`);
                }
            }
            // REGULAR SHIFT (not screener, not weekend): Just delete
            else {
                console.log(`[ReplacementService] Regular shift - just removing ${originalAnalystId} from schedule`);
                await prisma.schedule.delete({ where: { id: originalSchedule.id } });
            }

            current.add(1, 'day');
        }
    }
}

export const replacementService = new ReplacementService();
