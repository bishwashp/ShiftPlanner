import React from 'react';
import { motion } from 'framer-motion';

interface HeatmapProps {
    data: Array<{
        date: string;
        hasShift?: boolean;
        isScreener?: boolean;
        isWeekend?: boolean;
        isWeekly?: boolean;
        isMonthly?: boolean;
        totalDays?: number;
        weekendDays?: number;
        screenerDays?: number;
        hasWeekend?: boolean;
        hasScreener?: boolean;
        weekStart?: string;
        monthStart?: string;
    }>;
}

export const AnalystHeatmap: React.FC<HeatmapProps> = ({ data }) => {
    const isWeeklyView = data[0]?.isWeekly || false;
    const isMonthlyView = data[0]?.isMonthly || false;

    const getColorForDay = (day: { hasShift: boolean; isScreener: boolean; isWeekend: boolean }) => {
        if (!day.hasShift) return 'bg-gray-100 dark:bg-gray-800/50';

        const baseColor = day.isWeekend
            ? 'bg-red-500/80 dark:bg-red-500/70'
            : 'bg-green-500/80 dark:bg-green-500/70';

        const screenerClass = day.isScreener
            ? 'ring-2 ring-yellow-400 dark:ring-yellow-500 z-10 scale-110'
            : '';

        return `${baseColor} ${screenerClass}`;
    };

    const getColorForAggregated = (totalDays: number, isMonthly: boolean = false) => {
        if (totalDays === 0) return 'bg-gray-100 dark:bg-gray-800/50';

        if (isMonthly) {
            // Monthly scale (up to ~22 normal working days in a month)
            if (totalDays <= 10) return 'bg-green-200 dark:bg-green-900/40'; // Part-time/light
            if (totalDays <= 22) return 'bg-green-500 dark:bg-green-700/60'; // Normal full-time
            return 'bg-red-500 dark:bg-red-600/80'; // 23+ days = overworked!
        } else {
            // Weekly scale (up to 7 days in a week)
            if (totalDays <= 3) return 'bg-green-200 dark:bg-green-900/40';
            if (totalDays <= 5) return 'bg-green-500 dark:bg-green-700/60';
            return 'bg-red-500 dark:bg-red-600/80'; // 6-7 days = overworked!
        }
    };

    if (isMonthlyView || isWeeklyView) {
        const label = isMonthlyView ? 'month' : 'week';
        const sizeClass = isMonthlyView ? 'w-10 h-10' : 'w-8 h-8';

        return (
            <div className="p-4 bg-white/50 dark:bg-gray-900/50 rounded-xl border border-gray-200 dark:border-gray-800">
                <div className="flex gap-1.5 flex-wrap max-w-md">
                    {data.map((period, index) => (
                        <motion.div
                            key={period.weekStart || period.monthStart || index}
                            initial={{ opacity: 0, scale: 0 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ delay: index * 0.02 }}
                            className={`relative ${sizeClass} rounded-md transition-all hover:scale-125 cursor-help group ${getColorForAggregated(period.totalDays || 0, isMonthlyView)}`}
                        >
                            {/* CSS Badges for weekend/screener - improved visibility */}
                            <div className="absolute -top-1 -right-1 flex gap-0.5">
                                {period.hasWeekend && (
                                    <span
                                        className="w-2 h-2 rounded-full bg-red-600 border border-white dark:border-gray-900 shadow-sm"
                                        title="Has weekend work"
                                    />
                                )}
                                {period.hasScreener && (
                                    <span
                                        className="w-2 h-2 rounded-full bg-amber-500 border-2 border-gray-800 dark:border-white shadow-sm"
                                        title="Has screener duty"
                                    />
                                )}
                            </div>

                            {/* Day count in center */}
                            <div className="absolute inset-0 flex items-center justify-center text-xs font-bold text-white drop-shadow">
                                {period.totalDays}
                            </div>

                            {/* Tooltip */}
                            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-20 shadow-lg">
                                <div className="font-semibold mb-1">{period.date}</div>
                                <div className="space-y-0.5 text-left">
                                    <div>{period.totalDays} days worked</div>
                                    {(period.weekendDays || 0) > 0 && <div className="text-red-300">├─ {period.weekendDays} weekend</div>}
                                    {(period.screenerDays || 0) > 0 && <div className="text-yellow-300">└─ {period.screenerDays} screener</div>}
                                </div>
                            </div>
                        </motion.div>
                    ))}
                </div>
                <div className="mt-3 flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400 flex-wrap">
                    {isMonthlyView ? (
                        <>
                            <div className="flex items-center gap-1.5">
                                <div className="w-2.5 h-2.5 rounded-sm bg-gray-100 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700" />
                                0 days
                            </div>
                            <div className="flex items-center gap-1.5">
                                <div className="w-2.5 h-2.5 rounded-sm bg-green-200 dark:bg-green-900/40" />
                                1-10 days
                            </div>
                            <div className="flex items-center gap-1.5">
                                <div className="w-2.5 h-2.5 rounded-sm bg-green-500 dark:bg-green-700/60" />
                                11-22 days
                            </div>
                            <div className="flex items-center gap-1.5">
                                <div className="w-2.5 h-2.5 rounded-sm bg-red-500 dark:bg-red-600/80" />
                                23+ days
                            </div>
                        </>
                    ) : (
                        <>
                            <div className="flex items-center gap-1.5">
                                <div className="w-2.5 h-2.5 rounded-sm bg-gray-100 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700" />
                                0-1 days
                            </div>
                            <div className="flex items-center gap-1.5">
                                <div className="w-2.5 h-2.5 rounded-sm bg-green-200 dark:bg-green-900/40" />
                                2-3 days
                            </div>
                            <div className="flex items-center gap-1.5">
                                <div className="w-2.5 h-2.5 rounded-sm bg-green-500 dark:bg-green-700/60" />
                                4-5 days
                            </div>
                            <div className="flex items-center gap-1.5">
                                <div className="w-2.5 h-2.5 rounded-sm bg-red-500 dark:bg-red-600/80" />
                                6+ days
                            </div>
                        </>
                    )}
                    <div className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-red-600 border border-gray-400" />
                        Weekend
                    </div>
                    <div className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-amber-500 border-2 border-gray-800 dark:border-gray-400" />
                        Screener
                    </div>
                </div>
            </div>
        );
    }

    // Daily view (existing logic)
    return (
        <div className="p-4 bg-white/50 dark:bg-gray-900/50 rounded-xl border border-gray-200 dark:border-gray-800">
            <div className="flex gap-1 flex-wrap max-w-md">
                {data.map((day, index) => (
                    <motion.div
                        key={day.date}
                        initial={{ opacity: 0, scale: 0 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: index * 0.005 }}
                        className={`w-3 h-3 rounded-sm transition-all hover:scale-150 cursor-help relative group ${getColorForDay(day as any)}`}
                    >
                        {/* Tooltip */}
                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-gray-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-20 shadow-lg">
                            {day.date}: {day.hasShift ? (day.isWeekend ? 'Weekend Shift' : 'Regular Shift') + (day.isScreener ? ' (Screener)' : '') : 'Off'}
                        </div>
                    </motion.div>
                ))}
            </div>
            <div className="mt-3 flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400 flex-wrap">
                <div className="flex items-center gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-sm bg-gray-100 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700" />
                    Off
                </div>
                <div className="flex items-center gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-sm bg-green-500/80 dark:bg-green-500/70" />
                    Regular
                </div>
                <div className="flex items-center gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-sm bg-red-500/80 dark:bg-red-500/70" />
                    Weekend
                </div>
                <div className="flex items-center gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-sm bg-green-500/80 ring-2 ring-yellow-400" />
                    Screener
                </div>
            </div>
        </div>
    );
};
