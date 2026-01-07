import React, { useState, useEffect } from 'react';
import { useAuth } from '../../../contexts/AuthContext';
import ReactDOM from 'react-dom';
import { Analyst, Schedule, apiService } from '../../../services/api';
import moment from 'moment';
import GlassCard from '../../common/GlassCard';
import Button from '../../ui/Button';
import SpringDropdown from '../../ui/SpringDropdown';

interface EditScheduleModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    schedule: Schedule | null; // Single schedule (legacy/month view)
    schedules?: Schedule[];    // Multiple schedules (week view pills)
    analysts: Analyst[];
}

const EditScheduleModal: React.FC<EditScheduleModalProps> = ({
    isOpen,
    onClose,
    onSuccess,
    schedule,
    schedules,
    analysts
}) => {
    const { isManager } = useAuth();



    // Determine which schedules we are editing
    const targetSchedules = schedules && schedules.length > 0 ? schedules : (schedule ? [schedule] : []);
    const isMulti = targetSchedules.length > 1;

    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [analystId, setAnalystId] = useState('');
    const [shiftType, setShiftType] = useState<'MORNING' | 'EVENING'>('MORNING');
    const [isScreener, setIsScreener] = useState(false);
    const [loading, setLoading] = useState(false);
    const [deleteLoading, setDeleteLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

    const [validationViolations, setValidationViolations] = useState<any[]>([]);
    const [isValidating, setIsValidating] = useState(false);

    useEffect(() => {
        if (isOpen && targetSchedules.length > 0) {
            // Sort by date to find start/end
            const sorted = [...targetSchedules].sort((a, b) =>
                moment(a.date).valueOf() - moment(b.date).valueOf()
            );

            const first = sorted[0];
            const last = sorted[sorted.length - 1];

            setStartDate(moment.utc(first.date).format('YYYY-MM-DD'));
            setEndDate(moment.utc(last.date).format('YYYY-MM-DD'));
            setAnalystId(first.analystId);
            setShiftType(first.shiftType);
            setIsScreener(first.isScreener);

            setError(null);
            setShowDeleteConfirm(false);
            setValidationViolations([]);
        }
    }, [isOpen, schedule, schedules]);

    // Validation effect (only validates the first schedule for now as a proxy)
    useEffect(() => {
        const validate = async () => {
            if (!analystId || !startDate || !shiftType || targetSchedules.length === 0) {
                setValidationViolations([]);
                return;
            }

            setIsValidating(true);
            try {
                // Validate the first schedule as a representative
                // In a real app, we might want to validate all or the new range
                const result = await apiService.validateSchedule({
                    analystId,
                    date: startDate,
                    shiftType,
                    isScreener,
                    scheduleId: targetSchedules[0].id
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
    }, [analystId, startDate, shiftType, isScreener, targetSchedules]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (targetSchedules.length === 0 || !analystId) return;

        // Block if there are hard violations
        const hasHardViolations = validationViolations.some(v => v.type === 'HARD');
        if (hasHardViolations) {
            setError('Please resolve critical conflicts before saving changes');
            return;
        }

        setLoading(true);
        setError(null);

        try {
            // Calculate date shift if start date changed
            const originalStart = moment.utc(targetSchedules[0].date);
            const newStart = moment(startDate);
            const diffDays = newStart.diff(originalStart, 'days');

            await Promise.all(targetSchedules.map(async (s) => {
                // Apply date shift
                const sDate = moment.utc(s.date).add(diffDays, 'days').format('YYYY-MM-DD');

                await apiService.updateSchedule(s.id, {
                    analystId,
                    date: sDate,
                    shiftType,
                    isScreener
                });
            }));

            onSuccess();
            onClose();
        } catch (err: any) {
            console.error('Error updating schedules:', err);
            const errorMessage = err.response?.data?.message || err.response?.data?.error || 'Failed to update schedules';
            setError(errorMessage);
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async () => {
        if (targetSchedules.length === 0) return;

        setDeleteLoading(true);
        setError(null);

        try {
            await Promise.all(targetSchedules.map(s => apiService.deleteSchedule(s.id)));
            onSuccess();
            onClose();
        } catch (err: any) {
            console.error('Error deleting schedules:', err);
            setError(err.response?.data?.message || 'Failed to delete schedules');
        } finally {
            setDeleteLoading(false);
        }
    };

    if (!isOpen || targetSchedules.length === 0 || !isManager) return null;

    return ReactDOM.createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
            <GlassCard className="w-full max-w-lg mx-4 p-6 max-h-[90vh] overflow-y-auto bg-white/90 dark:bg-gray-900/90 shadow-2xl" interactive={false}>
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                        {isMulti ? `Edit ${targetSchedules.length} Shifts` : 'Edit Schedule'}
                    </h2>
                    <button onClick={onClose} className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors">
                        ✕
                    </button>
                </div>

                {error && (
                    <div className="bg-red-100 dark:bg-red-900/50 border border-red-200 dark:border-red-800 text-red-800 dark:text-red-200 p-4 rounded-md mb-4 text-sm font-medium flex items-start gap-2">
                        <span className="text-lg">⚠️</span>
                        <span>{error}</span>
                    </div>
                )}

                {/* Validation Violations Display */}
                {!showDeleteConfirm && validationViolations.length > 0 && (
                    <div className="mb-4 space-y-2">
                        {validationViolations.map((violation, index) => {
                            // Simplify verbose messages
                            let description = violation.description;
                            if (description.includes('assigned to') && description.includes('but scheduled for')) {
                                const assignedShift = description.match(/assigned to (\w+) shift/)?.[1];
                                if (assignedShift) {
                                    description = `Analyst is restricted to ${assignedShift} shifts only.`;
                                }
                            }

                            return (
                                <div
                                    key={index}
                                    className={`p-3 rounded-md text-sm border ${violation.type === 'HARD'
                                        ? 'bg-red-50 border-red-200 text-red-800 dark:bg-red-900/20 dark:border-red-800 dark:text-red-200'
                                        : 'bg-yellow-50 border-yellow-200 text-yellow-800 dark:bg-yellow-900/20 dark:border-yellow-800 dark:text-yellow-200'
                                        }`}
                                >
                                    <div className="font-medium">{description}</div>
                                    {violation.suggestedFix && (
                                        <div className="mt-1 text-xs opacity-90 font-medium">
                                            💡 {violation.suggestedFix}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}

                {showDeleteConfirm ? (
                    <div className="space-y-4">
                        <p className="text-sm text-gray-700 dark:text-gray-200">
                            Are you sure you want to delete {isMulti ? 'these schedules' : 'this schedule'}? This action cannot be undone.
                        </p>
                        <div className="flex justify-end space-x-3">
                            <Button
                                onClick={() => setShowDeleteConfirm(false)}
                                variant="secondary"
                                disabled={deleteLoading}
                            >
                                Cancel
                            </Button>
                            <Button
                                onClick={handleDelete}
                                variant="danger"
                                isLoading={deleteLoading}
                                disabled={deleteLoading}
                            >
                                Confirm Delete
                            </Button>
                        </div>
                    </div>
                ) : (
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium mb-1">Start Date</label>
                                <input
                                    type="date"
                                    value={startDate}
                                    onChange={(e) => setStartDate(e.target.value)}
                                    className="w-full px-3 py-2 rounded-md border border-input bg-background text-foreground focus:ring-2 focus:ring-primary focus:border-primary"
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-1">End Date</label>
                                <input
                                    type="date"
                                    value={endDate}
                                    disabled
                                    className="w-full px-3 py-2 rounded-md border border-input bg-muted text-muted-foreground cursor-not-allowed"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium mb-1">Analyst</label>
                            <SpringDropdown
                                required
                                value={analystId}
                                onChange={(val) => {
                                    setAnalystId(val);
                                    const selectedAnalyst = analysts.find(a => a.id === val);
                                    if (selectedAnalyst) {
                                        setShiftType(selectedAnalyst.shiftType);
                                    }
                                }}
                                options={analysts.map((analyst) => ({
                                    value: analyst.id,
                                    label: `${analyst.name} (${analyst.shiftType})`
                                }))}
                                placeholder="Select Analyst"
                            />
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
                                id="editIsScreener"
                                checked={isScreener}
                                onChange={(e) => setIsScreener(e.target.checked)}
                                className="h-4 w-4 rounded border-border"
                            />
                            <label htmlFor="editIsScreener" className="text-sm font-medium cursor-pointer">
                                Assign as Screener
                            </label>
                        </div>

                        <div className="flex justify-between items-center mt-6 pt-4 border-t border-border">
                            <Button
                                type="button"
                                onClick={() => setShowDeleteConfirm(true)}
                                variant="danger"
                                disabled={loading}
                            >
                                Delete {isMulti ? 'All' : ''}
                            </Button>
                            <div className="flex space-x-3">
                                <Button
                                    type="button"
                                    onClick={onClose}
                                    variant="secondary"
                                    disabled={loading}
                                >
                                    Cancel
                                </Button>
                                <Button
                                    type="submit"
                                    variant="primary"
                                    isLoading={loading}
                                    disabled={loading || validationViolations.some(v => v.type === 'HARD')}
                                >
                                    Save Changes
                                </Button>
                            </div>
                        </div>
                    </form>
                )}
            </GlassCard>
        </div>,
        document.body
    );
};

export default EditScheduleModal;
