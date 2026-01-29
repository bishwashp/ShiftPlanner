import { PrismaClient } from '../../generated/prisma';
import { prisma } from '../lib/prisma';
import moment from 'moment-timezone';

export interface SimulationViolation {
    analystId: string;
    message: string;
    type: 'STREAK_VIOLATION' | 'OTHER';
}

export class SwapValidator {
    private prisma: PrismaClient;

    constructor(prismaClient?: PrismaClient) {
        this.prisma = prismaClient || prisma;
    }

    /**
     * Simulate a manager swap and check for "Block Integrity" violations.
     * Returns a list of violations (if any).
     */
    async validateManagerSwap(
        sourceAnalystId: string,
        sourceDate: Date,
        targetAnalystId: string,
        targetDate: Date
    ): Promise<SimulationViolation[]> {
        const violations: SimulationViolation[] = [];

        // Define simulation range (min/max + buffer)
        const d1 = moment(sourceDate);
        const d2 = moment(targetDate);
        const minDate = d1.isBefore(d2) ? d1 : d2;
        const maxDate = d1.isAfter(d2) ? d1 : d2;

        // Buffer 7 days context
        const searchStart = minDate.clone().subtract(7, 'days').toDate();
        const searchEnd = maxDate.clone().add(7, 'days').toDate();

        // 1. Check Source Analyst (Simulate: Remove SourceDate, Add TargetDate)
        const v1 = await this.simulateAndCheck(
            sourceAnalystId,
            searchStart,
            searchEnd,
            [targetDate], // Add (Receiving)
            [sourceDate]  // Remove (Giving)
        );
        violations.push(...v1);

        // 2. Check Target Analyst (Simulate: Remove TargetDate, Add SourceDate)
        const v2 = await this.simulateAndCheck(
            targetAnalystId,
            searchStart,
            searchEnd,
            [sourceDate], // Add (Receiving)
            [targetDate]  // Remove (Giving)
        );
        violations.push(...v2);

        return violations;
    }

    /**
     * Simulate a Time-Slice Range Swap (Bulk Swap) and check for violations.
     * The Logic:
     * 1. Define Context (Start-7 to End+7).
     * 2. Identify "What Moves":
     *    - Source gives all shifts in [Start, End].
     *    - Target gives all shifts in [Start, End].
     * 3. Simulate A: Remove [Start, End], Add Target's shifts.
     * 4. Simulate B: Remove [Start, End], Add Source's shifts.
     */
    async validateManagerRangeSwap(
        sourceAnalystId: string,
        targetAnalystId: string,
        startDate: Date,
        endDate: Date
    ): Promise<SimulationViolation[]> {
        const violations: SimulationViolation[] = [];

        // Context Range
        const startMoment = moment.utc(startDate).startOf('day');
        const endMoment = moment.utc(endDate).endOf('day');

        const searchStart = startMoment.clone().subtract(7, 'days').toDate();
        const searchEnd = endMoment.clone().add(7, 'days').toDate();

        // 1. Fetch What Exists in the Range (To determine what is being "Added")
        const sourceShifts = await this.prisma.schedule.findMany({
            where: {
                analystId: sourceAnalystId,
                date: { gte: startDate, lte: endDate }
            }
        });

        const targetShifts = await this.prisma.schedule.findMany({
            where: {
                analystId: targetAnalystId,
                date: { gte: startDate, lte: endDate }
            }
        });

        const sourceDates = sourceShifts.map(s => s.date); // What Source Gives (Target Adds)
        const targetDates = targetShifts.map(s => s.date); // What Target Gives (Source Adds)

        // 2. Identify "Removal Range"
        // For range simulation, we simply tell the simulator to remove ALL dates in the range [startDate, endDate]
        // But our simulator takes an array of specific dates to remove.
        // We can generate all dates in the range, OR update simulator to handle a "Blanket Range Removal".
        // For simplicity reusing existing logic: We only need to "Remove" dates that actually HAVE shifts.
        // If I have no shift on Feb 5, "removing Feb 5" is a no-op. 
        // So we can just pass the list of 'sourceDates' as 'removeDates' for Source.
        // WAIT. If I have a shift on Feb 5, and I swap with someone who has a break on Feb 5...
        // Reference Scenario: Bish (Source) has NO shift on Feb 6. Sarahi (Target) HAS shift on Feb 6.
        // Bish receives Feb 6 (Add). Sarahi loses Feb 6 (Remove).
        // My simulator logic:
        // Source Sim: Remove(SourceDates), Add(TargetDates).
        // Target Sim: Remove(TargetDates), Add(SourceDates).

        // 3. Simulate Source (Receiving Target's Shifts)
        const v1 = await this.simulateAndCheck(
            sourceAnalystId,
            searchStart,
            searchEnd,
            targetDates, // Add (What Target had)
            sourceDates  // Remove (What Source had)
        );
        violations.push(...v1);

        // 4. Simulate Target (Receiving Source's Shifts)
        const v2 = await this.simulateAndCheck(
            targetAnalystId,
            searchStart,
            searchEnd,
            sourceDates, // Add (What Source had)
            targetDates  // Remove (What Target had)
        );
        violations.push(...v2);

        return violations;
    }

    private async simulateAndCheck(
        analystId: string,
        start: Date,
        end: Date,
        addDates: Date[],
        removeDates: Date[]
    ): Promise<SimulationViolation[]> {
        // Fetch existing schedules in the buffer range
        const schedules = await this.prisma.schedule.findMany({
            where: {
                analystId,
                date: { gte: start, lte: end }
            },
            select: { date: true, analyst: { select: { name: true } } }
        });

        const analystName = schedules[0]?.analyst?.name || 'Analyst';

        const currentDates = schedules.map(s => moment.utc(s.date).format('YYYY-MM-DD'));
        const adds = addDates.map(d => moment.utc(d).format('YYYY-MM-DD'));
        const removes = removeDates.map(d => moment.utc(d).format('YYYY-MM-DD'));

        // Construct Virtual Timeline
        // Filter out removed dates
        let virtualTimeline = currentDates.filter(d => !removes.includes(d));
        // Add new dates
        virtualTimeline.push(...adds);
        // Deduplicate and Sort
        virtualTimeline = [...new Set(virtualTimeline)].sort();

        // Calculate Streaks
        if (virtualTimeline.length === 0) return [];

        const streaks: number[] = [];
        let currentStreak = 1;

        for (let i = 1; i < virtualTimeline.length; i++) {
            const prev = moment(virtualTimeline[i - 1]);
            const curr = moment(virtualTimeline[i]);

            if (curr.diff(prev, 'days') === 1) {
                currentStreak++;
            } else {
                streaks.push(currentStreak);
                currentStreak = 1;
            }
        }
        streaks.push(currentStreak);

        // Apply "Block Integrity" Validation
        const violations: SimulationViolation[] = [];
        let streakStartIndex = 0;

        for (const span of streaks) {
            // Get dates for this streak
            const streakStart = virtualTimeline[streakStartIndex];
            const streakEnd = virtualTimeline[streakStartIndex + span - 1];

            // Logic: Violation if (Length > 5) AND (Length % 5 !== 0)
            if (span > 5 && span % 5 !== 0) {
                const formattedStart = moment(streakStart).format('MMM D');
                const formattedEnd = moment(streakEnd).format('MMM D');
                violations.push({
                    analystId,
                    message: `${analystName} will work ${span} consecutive days (${formattedStart} - ${formattedEnd}).`,
                    type: 'STREAK_VIOLATION'
                });
            }

            // Move index forward
            streakStartIndex += span;
        }

        return violations;
    }
}

export const swapValidator = new SwapValidator();
