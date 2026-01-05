import React, { useState, useEffect } from 'react';
import { ShieldCheck, Spinner, Warning } from '@phosphor-icons/react';
import { apiService, GlobalDashboardStatus } from '../../../services/api';
import moment from 'moment-timezone';

/**
 * CurrentScreener - Shows the globally active screener
 * Uses the global dashboard status to determine which shift is currently active,
 * then finds the screener assigned to that shift for today.
 */
const CurrentScreener: React.FC = () => {
    const [screener, setScreener] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [currentShiftLabel, setCurrentShiftLabel] = useState<string>('');
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchGlobalScreener = async () => {
            try {
                setLoading(true);
                setError(null);

                // 1. Get global dashboard status to find next handover
                const globalStatus = await apiService.getGlobalDashboardStatus();

                if (!globalStatus.nextHandover) {
                    setError('No handover data');
                    setCurrentShiftLabel('Unknown');
                    return;
                }

                // The "current" shift is the source of the next handover
                // e.g., if next handover is SGP PM → LDN, then SGP PM is currently on duty
                const sourceRegion = globalStatus.nextHandover.sourceRegion;
                const sourceShift = globalStatus.nextHandover.sourceShift;

                // Format label (avoid "LDN LDN")
                const label = sourceRegion === sourceShift
                    ? sourceRegion
                    : `${sourceRegion} ${sourceShift}`;
                setCurrentShiftLabel(label);

                // 2. Fetch today's schedules GLOBALLY to find the screener for this shift
                const today = moment().format('YYYY-MM-DD');
                const schedules = await apiService.getSchedulesGlobal(today, today);

                // 3. Map shift name to schedule shiftType
                // AM/Morning → MORNING, PM/Evening → EVENING
                let targetShiftType = '';
                const shiftLower = sourceShift.toLowerCase();
                if (shiftLower.includes('am') || shiftLower.includes('morning')) {
                    targetShiftType = 'MORNING';
                } else if (shiftLower.includes('pm') || shiftLower.includes('evening')) {
                    targetShiftType = 'EVENING';
                }
                // For single-shift regions like LDN, we might not have AM/PM distinction
                // In that case, look for any screener in that region's schedules

                // 4. Find screener matching region and shift type (no fallback to avoid wrong region)
                const currentScreener = schedules.find((s: any) => {
                    const matchesRegion = s.analyst?.region?.name === sourceRegion;
                    const matchesShiftType = targetShiftType
                        ? s.shiftType === targetShiftType
                        : true;
                    return s.isScreener && matchesRegion && matchesShiftType;
                });

                // No fallback - if we can't find the exact screener for the global shift, show unassigned
                setScreener(currentScreener || null);

            } catch (err) {
                console.error('Failed to fetch global screener', err);
                setError('Failed to load');
            } finally {
                setLoading(false);
            }
        };

        fetchGlobalScreener();
        // Refresh every 5 minutes
        const interval = setInterval(fetchGlobalScreener, 5 * 60 * 1000);
        return () => clearInterval(interval);
    }, []);

    if (loading) {
        return (
            <div className="flex items-center justify-center h-full">
                <Spinner className="w-6 h-6 animate-spin text-gray-400" />
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex items-center gap-2 h-full text-amber-500">
                <Warning className="w-5 h-5" />
                <span className="text-sm">{error}</span>
            </div>
        );
    }

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
                        {currentShiftLabel}
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
