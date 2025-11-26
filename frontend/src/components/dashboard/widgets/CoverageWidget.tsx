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
            <div className="p-2 flex justify-between items-center border-b border-gray-200/50 dark:border-white/10">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                    <ChartBar className="w-4 h-4 text-emerald-500 dark:text-emerald-400" />
                    Today's Coverage
                </h3>
            </div>

            <div className="flex-1 p-2 overflow-y-auto space-y-2">
                {loading ? (
                    <>
                        <div className="h-8 bg-gray-100 dark:bg-white/5 rounded-lg animate-pulse" />
                        <div className="h-8 bg-gray-100 dark:bg-white/5 rounded-lg animate-pulse" />
                        <div className="h-8 bg-gray-100 dark:bg-white/5 rounded-lg animate-pulse" />
                    </>
                ) : (
                    <>
                        {/* Morning & Evening - Horizontal Boxes that Stack Responsively */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {/* Morning Box */}
                            <div className="flex items-center justify-between p-2 rounded-lg bg-blue-50 dark:bg-blue-500/10 border border-blue-100 dark:border-blue-500/10">
                                <div className="flex items-center gap-2">
                                    <Sun className="w-4 h-4 text-blue-500 dark:text-blue-400" />
                                    <span className="text-sm font-medium text-gray-900 dark:text-white">Morning</span>
                                </div>
                                <span className="flex items-center justify-center min-w-[24px] h-6 px-2 rounded bg-blue-500 text-white text-xs font-bold">
                                    {stats.morning}
                                </span>
                            </div>

                            {/* Evening Box */}
                            <div className="flex items-center justify-between p-2 rounded-lg bg-purple-50 dark:bg-purple-500/10 border border-purple-100 dark:border-purple-500/10">
                                <div className="flex items-center gap-2">
                                    <Moon className="w-4 h-4 text-purple-500 dark:text-purple-400" />
                                    <span className="text-sm font-medium text-gray-900 dark:text-white">Evening</span>
                                </div>
                                <span className="flex items-center justify-center min-w-[24px] h-6 px-2 rounded bg-purple-500 text-white text-xs font-bold">
                                    {stats.evening}
                                </span>
                            </div>
                        </div>

                        {/* Weekend Coverage */}
                        <div className="p-2 rounded-lg bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-100 dark:border-emerald-500/10 space-y-1">
                            {weekendDates && (
                                <>
                                    {/* Saturday */}
                                    {getShiftsForDay(weekendDates.sat).length > 0 ? (
                                        getShiftsForDay(weekendDates.sat).map((s: any) => (
                                            <div key={s.id} className="flex items-center gap-2 text-xs">
                                                <span className="font-bold text-emerald-600 dark:text-emerald-400 w-5 text-right">
                                                    {moment(s.date).format('D')}
                                                </span>
                                                <span className="font-bold text-gray-500 dark:text-gray-400 text-[10px] tracking-wider w-7">SAT</span>
                                                <span className="text-gray-900 dark:text-white truncate flex-1">
                                                    {s.analyst?.name || 'Unknown'}
                                                </span>
                                            </div>
                                        ))
                                    ) : (
                                        <div className="flex items-center gap-2 text-xs">
                                            <span className="font-bold text-red-500 dark:text-red-400 w-5 text-right">
                                                {moment(weekendDates.sat).format('D')}
                                            </span>
                                            <span className="font-bold text-red-500 dark:text-red-400 text-[10px] tracking-wider w-7">SAT</span>
                                            <span className="text-red-500/70 dark:text-red-400/70 italic text-[10px]">
                                                None assigned
                                            </span>
                                        </div>
                                    )}

                                    {/* Sunday */}
                                    {getShiftsForDay(weekendDates.sun).length > 0 ? (
                                        getShiftsForDay(weekendDates.sun).map((s: any) => (
                                            <div key={s.id} className="flex items-center gap-2 text-xs">
                                                <span className="font-bold text-emerald-600 dark:text-emerald-400 w-5 text-right">
                                                    {moment(s.date).format('D')}
                                                </span>
                                                <span className="font-bold text-gray-500 dark:text-gray-400 text-[10px] tracking-wider w-7">SUN</span>
                                                <span className="text-gray-900 dark:text-white truncate flex-1">
                                                    {s.analyst?.name || 'Unknown'}
                                                </span>
                                            </div>
                                        ))
                                    ) : (
                                        <div className="flex items-center gap-2 text-xs">
                                            <span className="font-bold text-red-500 dark:text-red-400 w-5 text-right">
                                                {moment(weekendDates.sun).format('D')}
                                            </span>
                                            <span className="font-bold text-red-500 dark:text-red-400 text-[10px] tracking-wider w-7">SUN</span>
                                            <span className="text-red-500/70 dark:text-red-400/70 italic text-[10px]">
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
