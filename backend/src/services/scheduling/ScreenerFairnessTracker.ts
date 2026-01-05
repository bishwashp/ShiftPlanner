import moment from 'moment';

/**
 * ScreenerFairnessTracker
 * 
 * Tracks screener assignments per-analyst (UNIFIED across shifts).
 * Implements exhaustive fairness: everyone screens once before anyone screens twice.
 * 
 * HOLISTIC FIX: Replaces naive round-robin counters in IntelligentScheduler.
 */

interface ScreenerHistory {
    analystId: string;
    count: number;
    lastDate: Date | null;
}

export class ScreenerFairnessTracker {
    private screenerCounts: Map<string, number> = new Map();
    private lastScreenerDates: Map<string, Date> = new Map();

    constructor() {
        this.screenerCounts = new Map();
        this.lastScreenerDates = new Map();
    }

    /**
     * Initialize tracker with historical screener assignments
     */
    initializeFromHistory(schedules: any[]): void {
        for (const schedule of schedules) {
            if (schedule.isScreener) {
                const analystId = schedule.analystId;
                const date = new Date(schedule.date);

                this.screenerCounts.set(
                    analystId,
                    (this.screenerCounts.get(analystId) || 0) + 1
                );

                const lastDate = this.lastScreenerDates.get(analystId);
                if (!lastDate || date > lastDate) {
                    this.lastScreenerDates.set(analystId, date);
                }
            }
        }
    }

    /**
     * Select the next screener from a pool of working analysts
     * Uses LRU (Least Recently Used) with count tie-breaker
     * 
     * @param pool Analysts working on this day (can include transfer analysts)
     * @param date The date for screening assignment
     * @returns The selected analyst, or null if pool is empty
     */
    selectScreener(pool: any[], date: Date): any | null {
        if (pool.length === 0) return null;

        // Build fairness data for the pool
        const candidates = pool.map(analyst => ({
            analyst,
            count: this.screenerCounts.get(analyst.id) || 0,
            lastDate: this.lastScreenerDates.get(analyst.id) || null
        }));

        // Sort by:
        // 1. Lowest count first (exhaustive fairness)
        // 2. Earliest lastDate (or never screened first)
        candidates.sort((a, b) => {
            // Primary: Lower count wins
            if (a.count !== b.count) return a.count - b.count;

            // Secondary: Earlier lastDate wins (null = never screened = highest priority)
            if (!a.lastDate && !b.lastDate) return 0;
            if (!a.lastDate) return -1;
            if (!b.lastDate) return 1;
            return a.lastDate.getTime() - b.lastDate.getTime();
        });

        return candidates[0].analyst;
    }

    /**
     * Record a screener assignment
     */
    recordScreenerAssignment(analystId: string, date: Date): void {
        this.screenerCounts.set(
            analystId,
            (this.screenerCounts.get(analystId) || 0) + 1
        );
        this.lastScreenerDates.set(analystId, date);
    }

    /**
     * Get fairness stats for debugging/logging
     */
    getStats(): ScreenerHistory[] {
        const stats: ScreenerHistory[] = [];
        const allAnalystIds = new Set([
            ...this.screenerCounts.keys(),
            ...this.lastScreenerDates.keys()
        ]);

        for (const analystId of allAnalystIds) {
            stats.push({
                analystId,
                count: this.screenerCounts.get(analystId) || 0,
                lastDate: this.lastScreenerDates.get(analystId) || null
            });
        }

        return stats.sort((a, b) => a.count - b.count);
    }
}

// Singleton instance
export const screenerFairnessTracker = new ScreenerFairnessTracker();
