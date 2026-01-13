import React, { useState, useEffect } from 'react';
import { Sun, Moon, CalendarCheck, Warning, Clock } from '@phosphor-icons/react';
import { apiService } from '../../../services/api';
import moment from 'moment';

// Icon mapping for shift types - fallback to Clock for unknown
const getShiftIcon = (shiftType: string) => {
    const upper = shiftType.toUpperCase();
    if (upper === 'AM' || upper === 'MORNING') return Sun;
    if (upper === 'PM' || upper === 'EVENING') return Moon;
    return Clock; // Default for LDN, WEEKEND, or custom shifts
};

const getShiftColor = (shiftType: string) => {
    const upper = shiftType.toUpperCase();
    if (upper === 'AM' || upper === 'MORNING') return 'bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400';
    if (upper === 'PM' || upper === 'EVENING') return 'bg-purple-100 dark:bg-purple-500/20 text-purple-600 dark:text-purple-400';
    return 'bg-gray-100 dark:bg-gray-500/20 text-gray-600 dark:text-gray-400'; // Default
};

interface ShiftCoverage {
    shiftType: string;
    count: number;
}

const CoverageStatus: React.FC = () => {
    const [coverage, setCoverage] = useState<ShiftCoverage[]>([]);
    const [weekendShifts, setWeekendShifts] = useState<any[]>([]);
    const [weekendDates, setWeekendDates] = useState<{ sat: string, sun: string } | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const today = moment().format('YYYY-MM-DD');

                // 1. Fetch Today's Coverage - group by actual shiftType
                const todaysSchedules = await apiService.getSchedules(today, today);

                // Dynamically group by shiftType
                const shiftCounts = new Map<string, number>();
                todaysSchedules.forEach((s: any) => {
                    const shiftType = s.shiftType || 'UNKNOWN';
                    shiftCounts.set(shiftType, (shiftCounts.get(shiftType) || 0) + 1);
                });

                // Convert to array for rendering
                const coverageArray: ShiftCoverage[] = Array.from(shiftCounts.entries()).map(
                    ([shiftType, count]) => ({ shiftType, count })
                );
                // Sort by shift type name for consistent display
                coverageArray.sort((a, b) => a.shiftType.localeCompare(b.shiftType));
                setCoverage(coverageArray);

                // 2. Fetch Weekend Coverage
                const nextSaturday = moment().day() === 6 ? moment() : moment().day(6);
                const nextSunday = nextSaturday.clone().add(1, 'day');

                setWeekendDates({
                    sat: nextSaturday.format('YYYY-MM-DD'),
                    sun: nextSunday.format('YYYY-MM-DD')
                });

                const weekendScheds = await apiService.getSchedules(
                    nextSaturday.format('YYYY-MM-DD'),
                    nextSunday.format('YYYY-MM-DD')
                );
                setWeekendShifts(weekendScheds);

            } catch (error) {
                console.error('Failed to fetch coverage data', error);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, []);

    const getShiftsForDay = (dateStr: string) => {
        if (!weekendDates) return [];
        return weekendShifts.filter(s => s.date.startsWith(dateStr));
    };

    const getStatusColor = (count: number) => {
        if (count === 0) return 'text-red-500 bg-red-50 dark:bg-red-500/10 border-red-200 dark:border-red-500/20';
        if (count < 2) return 'text-yellow-600 bg-yellow-50 dark:bg-yellow-500/10 border-yellow-200 dark:border-yellow-500/20';
        return 'text-emerald-600 bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/20';
    };

    if (loading) return <div className="animate-pulse h-40 bg-gray-100 dark:bg-white/5 rounded-lg" />;

    return (
        <div className="h-full flex flex-col">
            <div className="flex items-center gap-2 mb-3 text-gray-500 dark:text-gray-400">
                <CalendarCheck className="w-4 h-4" />
                <span className="text-xs font-medium uppercase tracking-wider">Staffing Status</span>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 flex-1">
                {/* Today's Staffing - Dynamic Shifts */}
                <div className="space-y-2">
                    <p className="text-xs font-semibold text-gray-400 uppercase">Today</p>

                    {coverage.length === 0 ? (
                        <div className="flex items-center gap-2 p-2 rounded-lg bg-gray-50 dark:bg-white/5 border border-gray-100 dark:border-white/5">
                            <Warning className="w-4 h-4 text-yellow-500" />
                            <p className="text-sm text-gray-500">No schedules for today</p>
                        </div>
                    ) : (
                        coverage.map(({ shiftType, count }) => {
                            const Icon = getShiftIcon(shiftType);
                            return (
                                <div key={shiftType} className="flex items-center justify-between p-2 rounded-lg bg-gray-50 dark:bg-white/5 border border-gray-100 dark:border-white/5">
                                    <div className="flex items-center gap-3">
                                        <div className={`p-2 rounded-md ${getShiftColor(shiftType)}`}>
                                            <Icon className="w-4 h-4" weight="fill" />
                                        </div>
                                        <p className="text-sm font-bold text-gray-900 dark:text-white">{shiftType}</p>
                                    </div>
                                    <span className={`px-2.5 py-1 rounded-full text-xs font-bold border ${getStatusColor(count)}`}>
                                        {count} Analyst{count !== 1 ? 's' : ''}
                                    </span>
                                </div>
                            );
                        })
                    )}
                </div>

                {/* Weekend Lookahead */}
                <div className="space-y-2">
                    <p className="text-xs font-semibold text-gray-400 uppercase">Weekend Lookahead</p>

                    {weekendDates && (
                        <>
                            {/* Saturday */}
                            <div className="flex items-center justify-between p-2 rounded-lg bg-gray-50 dark:bg-white/5 border border-gray-100 dark:border-white/5">
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 flex items-center justify-center rounded-md bg-gray-200 dark:bg-white/10 text-gray-600 dark:text-gray-300 text-xs font-bold">
                                        SAT
                                    </div>
                                    <span className="text-xs text-gray-500">{moment(weekendDates.sat).format('MMM D')}</span>
                                </div>
                                {getShiftsForDay(weekendDates.sat).length > 0 ? (
                                    <div className="flex gap-1 flex-wrap justify-end">
                                        {getShiftsForDay(weekendDates.sat).map((s: any, i: number) => (
                                            <div key={i} className="px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-500/20 border border-emerald-200 dark:border-emerald-500/20 text-xs font-medium text-emerald-700 dark:text-emerald-300">
                                                {s.analyst?.name || 'Unassigned'}
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="flex items-center gap-1 text-red-500 bg-red-50 dark:bg-red-500/10 px-2 py-1 rounded border border-red-200 dark:border-red-500/20">
                                        <Warning className="w-3 h-3" weight="fill" />
                                        <span className="text-[10px] font-bold uppercase">Action Required</span>
                                    </div>
                                )}
                            </div>

                            {/* Sunday */}
                            <div className="flex items-center justify-between p-2 rounded-lg bg-gray-50 dark:bg-white/5 border border-gray-100 dark:border-white/5">
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 flex items-center justify-center rounded-md bg-gray-200 dark:bg-white/10 text-gray-600 dark:text-gray-300 text-xs font-bold">
                                        SUN
                                    </div>
                                    <span className="text-xs text-gray-500">{moment(weekendDates.sun).format('MMM D')}</span>
                                </div>
                                {getShiftsForDay(weekendDates.sun).length > 0 ? (
                                    <div className="flex gap-1 flex-wrap justify-end">
                                        {getShiftsForDay(weekendDates.sun).map((s: any, i: number) => (
                                            <div key={i} className="px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-500/20 border border-emerald-200 dark:border-emerald-500/20 text-xs font-medium text-emerald-700 dark:text-emerald-300">
                                                {s.analyst?.name || 'Unassigned'}
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="flex items-center gap-1 text-red-500 bg-red-50 dark:bg-red-500/10 px-2 py-1 rounded border border-red-200 dark:border-red-500/20">
                                        <Warning className="w-3 h-3" weight="fill" />
                                        <span className="text-[10px] font-bold uppercase">Action Required</span>
                                    </div>
                                )}
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

export default CoverageStatus;

