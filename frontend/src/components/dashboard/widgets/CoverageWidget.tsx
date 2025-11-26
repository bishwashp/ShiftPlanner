import React, { useState, useEffect } from 'react';
import { ChartBar, Sun, Moon } from '@phosphor-icons/react';
import { apiService } from '../../../services/api';
import moment from 'moment';

import GlassCard from '../../common/GlassCard';

const CoverageWidget: React.FC = () => {
    const [stats, setStats] = useState({ morning: 0, evening: 0 });
    const [weekendShifts, setWeekendShifts] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [weekendDates, setWeekendDates] = useState<{ sat: string, sun: string } | null>(null);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const today = moment().format('YYYY-MM-DD');

                // Fetch Today's Coverage
                const todaysSchedules = await apiService.getSchedules(today, today);
                const morning = todaysSchedules.filter((s: any) => s.shiftType === 'MORNING').length;
                const evening = todaysSchedules.filter((s: any) => s.shiftType === 'EVENING').length;
                setStats({ morning, evening });

                // Fetch Weekend Coverage
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
        // Use string comparison to avoid timezone shifts (e.g. UTC to Local)
        return weekendShifts.filter(s => s.date.startsWith(dateStr));
    };

    return (
        <GlassCard className="h-full flex flex-col">
            <div className="px-3 py-1.5 flex justify-between items-center border-b border-gray-200/50 dark:border-white/10">
                <h3 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                    <ChartBar className="w-4 h-4 text-emerald-500 dark:text-emerald-400" />
                    Today's Coverage
                </h3>
            </div>

            <div className="flex-1 p-2 overflow-y-auto space-y-2 flex flex-col">
                {loading ? (
                    <>
                        <div className="h-10 bg-gray-100 dark:bg-white/5 rounded-xl animate-pulse" />
                        <div className="h-10 bg-gray-100 dark:bg-white/5 rounded-xl animate-pulse" />
                        <div className="h-10 bg-gray-100 dark:bg-white/5 rounded-xl animate-pulse" />
                    </>
                ) : (
                    <>
                        {/* Morning Count */}
                        <div className="flex items-center justify-between p-2 rounded-xl bg-blue-50 dark:bg-blue-500/10 border border-blue-100 dark:border-blue-500/10">
                            <div className="flex items-center gap-3">
                                <Sun className="w-4 h-4 text-blue-500 dark:text-blue-400" />
                                <span className="text-sm font-medium text-gray-900 dark:text-white">Morning</span>
                            </div>
                            <span className="flex items-center justify-center w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-300 text-xs font-bold">
                                {stats.morning}
                            </span>
                        </div>

                        {/* Evening Count */}
                        <div className="flex items-center justify-between p-2 rounded-xl bg-purple-50 dark:bg-purple-500/10 border border-purple-100 dark:border-purple-500/10">
                            <div className="flex items-center gap-3">
                                <Moon className="w-4 h-4 text-purple-500 dark:text-purple-400" />
                                <span className="text-sm font-medium text-gray-900 dark:text-white">Evening</span>
                            </div>
                            <span className="flex items-center justify-center w-6 h-6 rounded-full bg-purple-100 dark:bg-purple-500/20 text-purple-700 dark:text-purple-300 text-xs font-bold">
                                {stats.evening}
                            </span>
                        </div>

                        {/* Weekend Coverage - Explicit List */}
                        <div className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-100 dark:border-emerald-500/10 space-y-2">
                            {weekendDates && (
                                <>
                                    {/* Saturday */}
                                    {getShiftsForDay(weekendDates.sat).length > 0 ? (
                                        getShiftsForDay(weekendDates.sat).map((s: any) => (
                                            <div key={s.id} className="flex items-center gap-3 text-sm">
                                                <span className="font-bold text-emerald-600 dark:text-emerald-400 w-6 text-right">
                                                    {moment(s.date).format('D')}
                                                </span>
                                                <span className="font-bold text-gray-500 dark:text-gray-400 text-xs tracking-wider">SAT</span>
                                                <span className="text-gray-900 dark:text-white truncate flex-1">
                                                    {s.analyst?.name || 'Unknown'}
                                                </span>
                                            </div>
                                        ))
                                    ) : (
                                        <div className="flex items-center gap-3 text-sm">
                                            <span className="font-bold text-red-500 dark:text-red-400 w-6 text-right">
                                                {moment(weekendDates.sat).format('D')}
                                            </span>
                                            <span className="font-bold text-red-500 dark:text-red-400 text-xs tracking-wider">SAT</span>
                                            <span className="text-red-500/70 dark:text-red-400/70 italic text-xs">
                                                None assigned
                                            </span>
                                        </div>
                                    )}

                                    {/* Sunday */}
                                    {getShiftsForDay(weekendDates.sun).length > 0 ? (
                                        getShiftsForDay(weekendDates.sun).map((s: any) => (
                                            <div key={s.id} className="flex items-center gap-3 text-sm">
                                                <span className="font-bold text-emerald-600 dark:text-emerald-400 w-6 text-right">
                                                    {moment(s.date).format('D')}
                                                </span>
                                                <span className="font-bold text-gray-500 dark:text-gray-400 text-xs tracking-wider">SUN</span>
                                                <span className="text-gray-900 dark:text-white truncate flex-1">
                                                    {s.analyst?.name || 'Unknown'}
                                                </span>
                                            </div>
                                        ))
                                    ) : (
                                        <div className="flex items-center gap-3 text-sm">
                                            <span className="font-bold text-red-500 dark:text-red-400 w-6 text-right">
                                                {moment(weekendDates.sun).format('D')}
                                            </span>
                                            <span className="font-bold text-red-500 dark:text-red-400 text-xs tracking-wider">SUN</span>
                                            <span className="text-red-500/70 dark:text-red-400/70 italic text-xs">
                                                None assigned
                                            </span>
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                    </>
                )}
            </div>
        </GlassCard>
    );
};

export default CoverageWidget;
