import React, { useState, useEffect } from 'react';
import { User, ShieldCheck } from '@phosphor-icons/react';
import { apiService } from '../../../services/api';
import moment from 'moment-timezone';

const CurrentScreener: React.FC = () => {
    const [screener, setScreener] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [shiftPhase, setShiftPhase] = useState<string>('');

    useEffect(() => {
        const fetchScreener = async () => {
            try {
                const today = moment().format('YYYY-MM-DD');
                const schedules = await apiService.getSchedules(today, today);

                // Determine current shift phase based on CST time
                const now = moment.tz('America/Chicago');
                const hour = now.hour();
                const minute = now.minute();
                const timeVal = hour + minute / 60;

                let currentPhase = 'OFF_HOURS';
                let shiftType = '';

                // 10:00 AM - 2:30 PM: AMR Morning
                if (timeVal >= 10 && timeVal < 14.5) {
                    currentPhase = 'AMR Morning';
                    shiftType = 'MORNING';
                }
                // 2:30 PM - 6:30 PM: AMR Evening
                else if (timeVal >= 14.5 && timeVal < 18.5) {
                    currentPhase = 'AMR Evening';
                    shiftType = 'EVENING';
                }
                // 6:30 PM - 10:00 AM (Next Day): APAC/EMEA (Simplified logic for now)
                else {
                    currentPhase = 'APAC / EMEA';
                    // For now, we might not have specific APAC schedules in the DB structure 
                    // unless they are marked as 'EVENING' or 'MORNING' in a specific way.
                    // Assuming 'EVENING' might cover late shifts or 'MORNING' early ones.
                    // For this MVP, we'll look for any screener if we can't match phase perfectly.
                }

                setShiftPhase(currentPhase);

                // Find the screener for the current shift type
                const currentScreener = schedules.find((s: any) =>
                    s.isScreener && (shiftType ? s.shiftType === shiftType : true)
                );

                // If no specific shift match, just take the first screener of the day as fallback
                setScreener(currentScreener || schedules.find((s: any) => s.isScreener));

            } catch (error) {
                console.error('Failed to fetch screener', error);
            } finally {
                setLoading(false);
            }
        };

        fetchScreener();
    }, []);

    if (loading) return <div className="animate-pulse h-full bg-gray-100 dark:bg-white/5 rounded-lg" />;

    return (
        <div className="flex items-center gap-4 h-full">
            <div className="relative">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold text-xl shadow-lg shadow-indigo-500/20">
                    {(screener?.analyst?.name || 'U').charAt(0)}
                </div>
                <div className="absolute -bottom-1 -right-1 bg-gray-900 rounded-full p-0.5 border-2 border-gray-900">
                    <div className="w-3 h-3 bg-emerald-500 rounded-full animate-pulse" />
                </div>
            </div>

            <div className="flex flex-col">
                <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-xs font-bold text-emerald-500 uppercase tracking-wider flex items-center gap-1">
                        <ShieldCheck className="w-3 h-3" weight="fill" />
                        On Duty
                    </span>
                    <span className="text-[10px] text-gray-500 dark:text-gray-400 px-1.5 py-0.5 rounded-full bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/10">
                        {shiftPhase}
                    </span>
                </div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-white leading-tight">
                    {screener?.analyst?.name || 'Unassigned'}
                </h3>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                    Screener
                </p>
            </div>
        </div>
    );
};

export default CurrentScreener;
