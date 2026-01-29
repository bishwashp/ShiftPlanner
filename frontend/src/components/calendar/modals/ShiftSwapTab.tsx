import React, { useState, useEffect } from 'react';
import moment from 'moment-timezone';
import { Analyst, apiService, Schedule } from '../../../services/api';
import Button from '../../ui/Button';
import SpringDropdown from '../../ui/SpringDropdown';
import { MiniCalendar } from '../MiniCalendar';

interface ShiftSwapTabProps {
    sourceAnalystId: string;
    sourceDate: string; // YYYY-MM-DD
    sourceSchedule: Schedule | null;
    analysts: Analyst[];
    onSuccess: () => void;
    onCancel: () => void;
}

const ShiftSwapTab: React.FC<ShiftSwapTabProps> = ({
    sourceAnalystId,
    sourceDate,
    sourceSchedule,
    analysts,
    onSuccess,
    onCancel
}) => {
    // Phase 1: Target Selection
    const [targetAnalystId, setTargetAnalystId] = useState('');
    // Phase 2: Date Selection (via Calendar)
    const [targetStartDate, setTargetStartDate] = useState('');
    const [targetEndDate, setTargetEndDate] = useState<string | null>(null);

    // Phase 3: Confirmation
    const [showConfirm, setShowConfirm] = useState(false);

    // Data State
    const [targetSchedules, setTargetSchedules] = useState<Schedule[]>([]);
    const [sourceSchedules, setSourceSchedules] = useState<Schedule[]>([]); // New: For impact calc

    // UI State
    const [loading, setLoading] = useState(false);
    const [loadingSchedules, setLoadingSchedules] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [violation, setViolation] = useState<any>(null);

    // Fetch Schedules (Source & Target) when analyst is selected
    useEffect(() => {
        if (!targetAnalystId) {
            setTargetSchedules([]);
            return;
        }

        const fetchData = async () => {
            setLoadingSchedules(true);
            try {
                const start = moment(sourceDate).startOf('month').format('YYYY-MM-DD');
                const end = moment(sourceDate).endOf('month').format('YYYY-MM-DD');

                // Get ALL schedules
                const all = await apiService.getSchedules(start, end);

                // Filter for Target
                const targets = all.filter(s => s.analystId === targetAnalystId);
                setTargetSchedules(targets);

                // Filter for Source (Current User/Analyst)
                const sources = all.filter(s => s.analystId === sourceAnalystId);
                setSourceSchedules(sources);

            } catch (e) {
                console.error("Failed to fetch schedules", e);
            } finally {
                setLoadingSchedules(false);
            }
        };
        fetchData();
    }, [targetAnalystId, sourceDate, sourceAnalystId]); // Added sourceAnalystId dependency

    const handleDateSelect = (date: string) => {
        // Validation: Cannot match source date (swapping with self implies logic error usually, but maybe allowed?)
        // if (date === sourceDate) return; 

        if (!targetStartDate || (targetStartDate && targetEndDate)) {
            // Start new selection
            setTargetStartDate(date);
            setTargetEndDate(null);
        } else {
            // Complete selection
            // Ensure Start < End
            if (moment(date).isBefore(targetStartDate)) {
                setTargetStartDate(date);
                setTargetEndDate(null); // Reset if clicking earlier
            } else {
                setTargetEndDate(date);
                setShowConfirm(true); // Auto-trigger confirm on range completion
            }
        }
    };


    const handleExecuteSwap = async (force: boolean) => {
        if (!targetStartDate) return;

        setLoading(true);
        setError(null);
        setViolation(null);

        try {
            const finalEndDate = targetEndDate || targetStartDate;

            await apiService.managerRangeSwap({
                sourceAnalystId,
                targetAnalystId,
                startDate: targetStartDate,
                endDate: finalEndDate,
                force
            });
            onSuccess();
        } catch (err: any) {
            console.error('Swap failed:', err);
            if (err.response?.status === 409 && err.response.data?.details?.type === 'CONSTRAINT_VIOLATION') {
                setViolation(err.response.data.details);
                setShowConfirm(false); // Switch to violation view
            } else {
                setError(err.response?.data?.message || 'Swap failed');
                setShowConfirm(false);
            }
        } finally {
            setLoading(false);
        }
    };

    // Impact Calculation Helper
    const calculateImpact = () => {
        if (!targetStartDate) return null;
        const end = targetEndDate || targetStartDate;

        // Helper to check range
        const inRange = (d: string) => moment(d).isBetween(targetStartDate, end, 'day', '[]');

        const sourceIn = sourceSchedules.filter(s => inRange(s.date));
        const targetIn = targetSchedules.filter(s => inRange(s.date));

        const sourceScreenerCount = sourceIn.filter(s => s.isScreener).length;
        const targetScreenerCount = targetIn.filter(s => s.isScreener).length;

        const netScreener = targetScreenerCount - sourceScreenerCount;
        const netDays = targetIn.length - sourceIn.length;

        return { netScreener, netDays, sourceScreenerCount, targetScreenerCount };
    };




    if (violation) {
        return (
            <div className="space-y-4">
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-4 rounded-md">
                    <h3 className="text-lg font-bold text-red-800 dark:text-red-200 mb-2">Constraint Violation Detected</h3>
                    <ul className="list-disc pl-5 space-y-1 text-sm text-red-700 dark:text-red-300">
                        {violation.violations?.map((v: any, idx: number) => (
                            <li key={idx}>{v.message}</li>
                        ))}
                    </ul>
                    <p className="mt-4 text-xs font-semibold text-red-800 dark:text-red-200">
                        Do you want to FORCE this swap?
                    </p>
                </div>
                <div className="flex justify-end space-x-3">
                    <Button onClick={() => setViolation(null)} variant="secondary">Cancel</Button>
                    <Button onClick={() => handleExecuteSwap(true)} variant="danger" isLoading={loading}>Override</Button>
                </div>
            </div>
        );
    }

    if (showConfirm) {
        const isRange = targetEndDate && targetEndDate !== targetStartDate;
        const impact = calculateImpact();

        return (
            <div className="space-y-4">
                <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-md">
                    <h3 className="text-lg font-bold mb-4">Confirm {isRange ? 'Range Swap' : 'Swap'}</h3>
                    <div className="flex justify-between items-center mb-4">
                        <div className="text-center w-full">
                            <div className="text-sm text-gray-500 mb-2">Swapping Schedule For</div>
                            <div className="flex items-center justify-center space-x-4">
                                <span className="font-bold text-lg">{moment(targetStartDate).format('MMM D')}</span>
                                {isRange && (
                                    <>
                                        <span className="text-gray-400">➔</span>
                                        <span className="font-bold text-lg">{moment(targetEndDate).format('MMM D')}</span>
                                    </>
                                )}
                            </div>
                            <div className="mt-2 text-sm text-gray-500">
                                Between <b>{analysts.find(a => a.id === sourceAnalystId)?.name}</b> and <b>{analysts.find(a => a.id === targetAnalystId)?.name}</b>
                            </div>
                        </div>
                    </div>

                    {impact && (
                        <div className="bg-white dark:bg-gray-800 p-3 rounded border border-gray-200 dark:border-gray-700 text-sm mb-3">
                            <div className="font-semibold mb-2">Impact Analysis (For Source):</div>
                            <div className={`flex justify-between ${impact.netDays > 0 ? 'text-green-600' : 'text-gray-600'}`}>
                                <span>Work Days:</span>
                                <span>{impact.netDays > 0 ? '+' : ''}{impact.netDays} Days</span>
                            </div>
                            <div className={`flex justify-between ${impact.netScreener > 0 ? 'text-amber-600 font-bold' : 'text-gray-600'}`}>
                                <span>Screener Burden:</span>
                                <span>{impact.netScreener > 0 ? '+' : ''}{impact.netScreener} Shifts</span>
                            </div>
                            {impact.netScreener > 0 && (
                                <div className="mt-2 text-xs text-amber-600 bg-amber-50 dark:bg-amber-900/20 p-1 px-2 rounded">
                                    ⚠️ <b>Burden Alert:</b> You are taking on additional screening duties.
                                </div>
                            )}
                        </div>
                    )}

                    <div className="border-t border-blue-200 dark:border-blue-800 pt-3 text-xs text-blue-800 dark:text-blue-200">
                        ℹ️ <b>Note:</b> This will exchange ALL shifts and breaks in this period. Conflicting shifts will be removed.
                    </div>
                </div>
                <div className="flex justify-end space-x-3">
                    <Button onClick={() => setShowConfirm(false)} variant="secondary">Back</Button>
                    <Button onClick={() => handleExecuteSwap(false)} variant="primary" isLoading={loading}>Confirm Exchange</Button>
                </div>
            </div>
        );
    }

    // Loading Guard: Don't show anything until we know WHAT we are swapping (Source Context)
    // This prevents the "Permissive Calendar" bug where proper constraints aren't applied yet.
    if (!sourceSchedule && !error) {
        return (
            <div className="h-48 flex flex-col items-center justify-center space-y-3">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
                <div className="text-xs text-gray-500">Loading shift context...</div>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between mb-2">
                <div className="w-1/2 pr-2">
                    <label className="block text-xs font-medium mb-1">Swap With</label>
                    <SpringDropdown
                        value={targetAnalystId}
                        onChange={setTargetAnalystId}
                        options={analysts
                            .filter(a => a.id !== sourceAnalystId)
                            .map(a => ({ value: a.id, label: a.name }))}
                        placeholder="Select Analyst..."
                    />
                </div>
                <div className="w-1/2 pl-2 text-right">
                    <div className="text-xs text-gray-500">Current Shift</div>
                    <div className="font-semibold text-sm">
                        {moment(sourceDate).format('MMM D')} • {sourceSchedule?.isScreener ? 'Screener' : sourceSchedule?.shiftType}
                    </div>
                </div>
            </div>

            {targetAnalystId ? (
                <div className="animate-in fade-in zoom-in duration-300">
                    <div className="flex justify-between items-center mb-2">
                        <div className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Select Range ({moment(sourceDate).format('MMMM')})
                        </div>
                        {targetStartDate && !targetEndDate && (
                            <div className="text-xs text-primary animate-pulse">Select End Date...</div>
                        )}
                        {targetEndDate && (
                            <div className="text-xs text-green-600 font-bold">
                                {moment(targetStartDate).format('M/D')} - {moment(targetEndDate).format('M/D')}
                            </div>
                        )}
                    </div>

                    {loadingSchedules ? (
                        <div className="h-48 flex items-center justify-center text-gray-400 text-sm">Loading schedule...</div>
                    ) : (
                        <MiniCalendar
                            schedules={targetSchedules}
                            selectedDate={null} // Disable single select highlighting
                            startDate={targetStartDate}
                            endDate={targetEndDate}
                            onSelect={handleDateSelect}
                            sourceSchedule={sourceSchedule}
                        />
                    )}
                    <div className="mt-2 text-[10px] text-gray-400 text-center">
                        * Click to select Start, then click again to select End of range.
                    </div>
                </div>
            ) : (
                <div className="h-48 flex items-center justify-center bg-gray-50 dark:bg-gray-800/30 rounded-md border border-dashed border-gray-200">
                    <span className="text-gray-400 text-sm">Select an analyst to view swappable shifts</span>
                </div>
            )}

            {error && <div className="text-red-500 text-sm mt-2">{error}</div>}
        </div>
    );
};

export default ShiftSwapTab;
