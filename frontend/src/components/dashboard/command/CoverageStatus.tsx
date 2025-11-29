import React, { useState, useEffect } from 'react';
import { Sun, Moon, CalendarCheck, Warning } from '@phosphor-icons/react';
import { apiService } from '../../../services/api';
import moment from 'moment';

const CoverageStatus: React.FC = () => {
    const [coverage, setCoverage] = useState({ morning: 0, evening: 0 });
    const [weekendShifts, setWeekendShifts] = useState<any[]>([]);
    const [weekendDates, setWeekendDates] = useState<{ sat: string, sun: string } | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const today = moment().format('YYYY-MM-DD');

                // 1. Fetch Today's Coverage
                const todaysSchedules = await apiService.getSchedules(today, today);
                setCoverage({
                    morning: todaysSchedules.filter((s: any) => s.shiftType === 'MORNING').length,
                    evening: todaysSchedules.filter((s: any) => s.shiftType === 'EVENING').length
                });

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
                {/* Today's Staffing */}
                <div className="space-y-2">
                    <p className="text-xs font-semibold text-gray-400 uppercase">Today</p>

                    <div className="flex items-center justify-between p-2 rounded-lg bg-gray-50 dark:bg-white/5 border border-gray-100 dark:border-white/5">
                        <div className="flex items-center gap-3">
                            <div className="p-2 rounded-md bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400">
                                <Sun className="w-4 h-4" weight="fill" />
                            </div>
                            <p className="text-sm font-bold text-gray-900 dark:text-white">Morning</p>
                        </div>
                        <span className={`px-2.5 py-1 rounded-full text-xs font-bold border ${getStatusColor(coverage.morning)}`}>
                            {coverage.morning} Analysts
                        </span>
                    </div>

                    <div className="flex items-center justify-between p-2 rounded-lg bg-gray-50 dark:bg-white/5 border border-gray-100 dark:border-white/5">
                        <div className="flex items-center gap-3">
                            <div className="p-2 rounded-md bg-purple-100 dark:bg-purple-500/20 text-purple-600 dark:text-purple-400">
                                <Moon className="w-4 h-4" weight="fill" />
                            </div>
                            <p className="text-sm font-bold text-gray-900 dark:text-white">Evening</p>
                        </div>
                        <span className={`px-2.5 py-1 rounded-full text-xs font-bold border ${getStatusColor(coverage.evening)}`}>
                            {coverage.evening} Analysts
                        </span>
                    </div>
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
