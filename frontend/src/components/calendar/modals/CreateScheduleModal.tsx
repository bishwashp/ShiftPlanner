import React, { useState, useEffect } from 'react';
import { Analyst, apiService } from '../../../services/api';
import moment from 'moment';
import GlassCard from '../../common/GlassCard';

interface CreateScheduleModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    initialDate: Date;
    analysts: Analyst[];
}

const CreateScheduleModal: React.FC<CreateScheduleModalProps> = ({
    isOpen,
    onClose,
    onSuccess,
    initialDate,
    analysts
}) => {
    const [date, setDate] = useState(moment(initialDate).format('YYYY-MM-DD'));
    const [analystId, setAnalystId] = useState('');
    const [shiftType, setShiftType] = useState<'MORNING' | 'EVENING'>('MORNING');
    const [isScreener, setIsScreener] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [validationViolations, setValidationViolations] = useState<any[]>([]);
    const [isValidating, setIsValidating] = useState(false);

    useEffect(() => {
        if (isOpen) {
            setDate(moment(initialDate).format('YYYY-MM-DD'));
            setAnalystId('');
            setShiftType('MORNING');
            setIsScreener(false);
            setError(null);
            setValidationViolations([]);
        }
    }, [isOpen, initialDate]);

    // Validation effect
    useEffect(() => {
        const validate = async () => {
            if (!analystId || !date || !shiftType) {
                setValidationViolations([]);
                return;
            }

            setIsValidating(true);
            try {
                const result = await apiService.validateSchedule({
                    analystId,
                    date,
                    shiftType,
                    isScreener
                });
                setValidationViolations(result.violations);
            } catch (err) {
                console.error('Validation error:', err);
            } finally {
                setIsValidating(false);
            }
        };

        const debounce = setTimeout(validate, 500);
        return () => clearTimeout(debounce);
    }, [analystId, date, shiftType, isScreener]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!analystId) {
            setError('Please select an analyst');
            return;
        }

        // Block if there are hard violations
        const hasHardViolations = validationViolations.some(v => v.type === 'HARD');
        if (hasHardViolations) {
            setError('Please resolve critical conflicts before creating the schedule');
            return;
        }

        setLoading(true);
        setError(null);

        try {
            await apiService.createSchedule({
                analystId,
                date,
                shiftType,
                isScreener
            });
            onSuccess();
            onClose();
        } catch (err: any) {
            console.error('Error creating schedule:', err);
            setError(err.response?.data?.message || 'Failed to create schedule');
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-md">
            <GlassCard className="w-full max-w-md p-6 max-h-[90vh] overflow-y-auto" enableRefraction>
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Create Schedule</h2>
                    <button onClick={onClose} className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors">
                        ✕
                    </button>
                </div>

                {error && (
                    <div className="bg-destructive/20 border border-destructive/30 text-destructive-foreground p-3 rounded-md mb-4 text-sm whitespace-pre-wrap backdrop-blur-sm">
                        {error}
                    </div>
                )}

                {/* Validation Violations Display */}
                {validationViolations.length > 0 && (
                    <div className="mb-4 space-y-2">
                        {validationViolations.map((violation, index) => (
                            <div
                                key={index}
                                className={`p-3 rounded-md text-sm border backdrop-blur-sm ${violation.type === 'HARD'
                                    ? 'bg-red-500/20 border-red-500/30 text-red-200'
                                    : 'bg-yellow-500/20 border-yellow-500/30 text-yellow-200'
                                    }`}
                            >
                                <div className="font-medium flex items-center gap-2">
                                    {violation.type === 'HARD' ? '⛔ Critical Conflict' : '⚠️ Warning'}
                                </div>
                                <div className="mt-1">{violation.description}</div>
                                {violation.suggestedFix && (
                                    <div className="mt-1 text-xs opacity-90">
                                        💡 {violation.suggestedFix}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium mb-1 text-gray-900 dark:text-white">Date</label>
                        <input
                            type="date"
                            value={date}
                            onChange={(e) => setDate(e.target.value)}
                            className="w-full px-3 py-2 rounded-md border border-gray-300 dark:border-white/20 bg-white dark:bg-white/10 text-gray-900 dark:text-white backdrop-blur-sm focus:ring-2 focus:ring-primary focus:border-primary placeholder:text-gray-500 dark:placeholder:text-white/50"
                            required
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium mb-1 text-gray-900 dark:text-white">Analyst</label>
                        <select
                            value={analystId}
                            onChange={(e) => {
                                const selectedId = e.target.value;
                                setAnalystId(selectedId);
                                const selectedAnalyst = analysts.find(a => a.id === selectedId);
                                if (selectedAnalyst) {
                                    setShiftType(selectedAnalyst.shiftType);
                                }
                            }}
                            className="w-full px-3 py-2 rounded-md border border-gray-300 dark:border-white/20 bg-white dark:bg-white/10 text-gray-900 dark:text-white backdrop-blur-sm focus:ring-2 focus:ring-primary focus:border-primary"
                            required
                        >
                            <option value="" className="bg-white dark:bg-gray-900">Select Analyst</option>
                            {analysts.map((analyst) => (
                                <option key={analyst.id} value={analyst.id} className="bg-white dark:bg-gray-900">
                                    {analyst.name} ({analyst.shiftType})
                                </option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-medium mb-1 text-gray-900 dark:text-white">Shift Type</label>
                        <div className="flex space-x-4">
                            <label className="flex items-center space-x-2 cursor-pointer text-gray-900 dark:text-white">
                                <input
                                    type="radio"
                                    checked={shiftType === 'MORNING'}
                                    onChange={() => setShiftType('MORNING')}
                                    className="text-primary focus:ring-primary"
                                />
                                <span>Morning</span>
                            </label>
                            <label className="flex items-center space-x-2 cursor-pointer text-gray-900 dark:text-white">
                                <input
                                    type="radio"
                                    checked={shiftType === 'EVENING'}
                                    onChange={() => setShiftType('EVENING')}
                                    className="text-primary focus:ring-primary"
                                />
                                <span>Evening</span>
                            </label>
                        </div>
                    </div>

                    <div className="flex items-center space-x-2">
                        <input
                            type="checkbox"
                            id="isScreener"
                            checked={isScreener}
                            onChange={(e) => setIsScreener(e.target.checked)}
                            className="h-4 w-4 rounded border-gray-300 dark:border-white/20 bg-white dark:bg-white/10"
                        />
                        <label htmlFor="isScreener" className="text-sm font-medium cursor-pointer text-gray-900 dark:text-white">
                            Assign as Screener
                        </label>
                    </div>

                    <div className="flex justify-end space-x-3 mt-6">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
                            disabled={loading}
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            className="px-4 py-2 text-sm font-medium bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors disabled:opacity-50 shadow-lg"
                            disabled={loading || validationViolations.some(v => v.type === 'HARD')}
                        >
                            {loading ? 'Creating...' : 'Create Schedule'}
                        </button>
                    </div>
                </form>
            </GlassCard>
        </div>
    );
};

export default CreateScheduleModal;

