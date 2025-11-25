import React, { useState, useEffect } from 'react';
import { Analyst, Schedule, apiService } from '../../../services/api';
import moment from 'moment';
import GlassCard from '../../common/GlassCard';

interface EditScheduleModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    schedule: Schedule | null;
    analysts: Analyst[];
}

const EditScheduleModal: React.FC<EditScheduleModalProps> = ({
    isOpen,
    onClose,
    onSuccess,
    schedule,
    analysts
}) => {
    const [date, setDate] = useState('');
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
        if (isOpen && schedule) {
            setDate(moment(schedule.date).format('YYYY-MM-DD'));
            setAnalystId(schedule.analystId);
            setShiftType(schedule.shiftType);
            setIsScreener(schedule.isScreener);
            setError(null);
            setShowDeleteConfirm(false);
            setValidationViolations([]);
        }
    }, [isOpen, schedule]);

    // Validation effect
    useEffect(() => {
        const validate = async () => {
            if (!analystId || !date || !shiftType || !schedule) {
                setValidationViolations([]);
                return;
            }

            setIsValidating(true);
            try {
                const result = await apiService.validateSchedule({
                    analystId,
                    date,
                    shiftType,
                    isScreener,
                    scheduleId: schedule.id
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
    }, [analystId, date, shiftType, isScreener, schedule]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!schedule || !analystId) return;

        // Block if there are hard violations
        const hasHardViolations = validationViolations.some(v => v.type === 'HARD');
        if (hasHardViolations) {
            setError('Please resolve critical conflicts before saving changes');
            return;
        }

        setLoading(true);
        setError(null);

        try {
            await apiService.updateSchedule(schedule.id, {
                analystId,
                date,
                shiftType,
                isScreener
            });
            onSuccess();
            onClose();
        } catch (err: any) {
            console.error('Error updating schedule:', err);
            setError(err.response?.data?.message || 'Failed to update schedule');
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async () => {
        if (!schedule) return;

        setDeleteLoading(true);
        setError(null);

        try {
            await apiService.deleteSchedule(schedule.id);
            onSuccess();
            onClose();
        } catch (err: any) {
            console.error('Error deleting schedule:', err);
            setError(err.response?.data?.message || 'Failed to delete schedule');
        } finally {
            setDeleteLoading(false);
        }
    };

    if (!isOpen || !schedule) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-md">
            <GlassCard className="w-full max-w-md p-6 max-h-[90vh] overflow-y-auto" enableRefraction>
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Edit Schedule</h2>
                    <button onClick={onClose} className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors">
                        ✕
                    </button>
                </div>

                {error && (
                    <div className="bg-destructive/10 text-destructive p-3 rounded-md mb-4 text-sm">
                        {error}
                    </div>
                )}

                {/* Validation Violations Display */}
                {!showDeleteConfirm && validationViolations.length > 0 && (
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

                {showDeleteConfirm ? (
                    <div className="space-y-4">
                        <p className="text-sm text-gray-700 dark:text-gray-200">
                            Are you sure you want to delete this schedule? This action cannot be undone.
                        </p>
                        <div className="flex justify-end space-x-3">
                            <button
                                onClick={() => setShowDeleteConfirm(false)}
                                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 hover:text-foreground transition-colors"
                                disabled={deleteLoading}
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleDelete}
                                className="px-4 py-2 text-sm font-medium bg-destructive text-destructive-foreground rounded-md hover:bg-destructive/90 transition-colors"
                                disabled={deleteLoading}
                            >
                                {deleteLoading ? 'Deleting...' : 'Confirm Delete'}
                            </button>
                        </div>
                    </div>
                ) : (
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
                            <button
                                type="button"
                                onClick={() => setShowDeleteConfirm(true)}
                                className="px-4 py-2 text-sm font-medium text-destructive hover:bg-destructive/10 rounded-md transition-colors"
                                disabled={loading}
                            >
                                Delete
                            </button>
                            <div className="flex space-x-3">
                                <button
                                    type="button"
                                    onClick={onClose}
                                    className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 hover:text-foreground transition-colors"
                                    disabled={loading}
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="px-4 py-2 text-sm font-medium bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors disabled:opacity-50"
                                    disabled={loading || validationViolations.some(v => v.type === 'HARD')}
                                >
                                    {loading ? 'Saving...' : 'Save Changes'}
                                </button>
                            </div>
                        </div>
                    </form>
                )}
            </GlassCard>
        </div>
    );
};

export default EditScheduleModal;
