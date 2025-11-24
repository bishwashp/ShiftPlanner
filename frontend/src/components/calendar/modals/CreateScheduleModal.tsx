import React, { useState, useEffect } from 'react';
import { Analyst, apiService } from '../../../services/api';
import moment from 'moment';

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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
            <div className="bg-background rounded-lg shadow-xl w-full max-w-md p-6 border border-border max-h-[90vh] overflow-y-auto">
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-xl font-semibold">Create Schedule</h2>
                    <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
                        ✕
                    </button>
                </div>

                {error && (
                    <div className="bg-destructive/10 text-destructive p-3 rounded-md mb-4 text-sm whitespace-pre-wrap">
                        {error}
                    </div>
                )}

                {/* Validation Violations Display */}
                {validationViolations.length > 0 && (
                    <div className="mb-4 space-y-2">
                        {validationViolations.map((violation, index) => (
                            <div
                                key={index}
                                className={`p-3 rounded-md text-sm border ${violation.type === 'HARD'
                                    ? 'bg-red-50 border-red-200 text-red-800 dark:bg-red-900/20 dark:border-red-800 dark:text-red-200'
                                    : 'bg-yellow-50 border-yellow-200 text-yellow-800 dark:bg-yellow-900/20 dark:border-yellow-800 dark:text-yellow-200'
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
                        <label className="block text-sm font-medium mb-1">Date</label>
                        <input
                            type="date"
                            value={date}
                            onChange={(e) => setDate(e.target.value)}
                            className="w-full px-3 py-2 rounded-md border border-input bg-background text-foreground focus:ring-2 focus:ring-primary focus:border-primary"
                            required
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium mb-1">Analyst</label>
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
                            className="w-full px-3 py-2 rounded-md border border-input bg-background text-foreground focus:ring-2 focus:ring-primary focus:border-primary"
                            required
                        >
                            <option value="">Select Analyst</option>
                            {analysts.map((analyst) => (
                                <option key={analyst.id} value={analyst.id}>
                                    {analyst.name} ({analyst.shiftType})
                                </option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-medium mb-1">Shift Type</label>
                        <div className="flex space-x-4">
                            <label className="flex items-center space-x-2 cursor-pointer">
                                <input
                                    type="radio"
                                    checked={shiftType === 'MORNING'}
                                    onChange={() => setShiftType('MORNING')}
                                    className="text-primary focus:ring-primary"
                                />
                                <span>Morning</span>
                            </label>
                            <label className="flex items-center space-x-2 cursor-pointer">
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
                            className="rounded border-input text-primary focus:ring-primary"
                        />
                        <label htmlFor="isScreener" className="text-sm font-medium cursor-pointer">
                            Assign as Screener
                        </label>
                    </div>

                    <div className="flex justify-end space-x-3 mt-6">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
                            disabled={loading}
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            className="px-4 py-2 text-sm font-medium bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors disabled:opacity-50"
                            disabled={loading || validationViolations.some(v => v.type === 'HARD')}
                        >
                            {loading ? 'Creating...' : 'Create Schedule'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default CreateScheduleModal;
