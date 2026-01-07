import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { apiService, Analyst } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import { dateUtils } from '../../utils/dateUtils';
import Checkbox from '../ui/Checkbox';
import Button from '../ui/Button';
import { X, CalendarBlank, Warning } from '@phosphor-icons/react';
import SpringDropdown from '../ui/SpringDropdown';

interface CreateAbsenceModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    analysts: Analyst[];
}

const CreateAbsenceModal: React.FC<CreateAbsenceModalProps> = ({
    isOpen,
    onClose,
    onSuccess,
    analysts
}) => {
    const { isManager, user } = useAuth();
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [formData, setFormData] = useState({
        analystId: '',
        startDate: '',
        endDate: '',
        type: 'VACATION',
        reason: '',
        isApproved: false,
        isPlanned: true
    });

    const absenceTypes = [
        { value: 'VACATION', label: 'Vacation' },
        { value: 'SICK_LEAVE', label: 'Sick Leave' },
        { value: 'PERSONAL', label: 'Personal' },
        { value: 'EMERGENCY', label: 'Emergency' },
        { value: 'TRAINING', label: 'Training' },
        { value: 'CONFERENCE', label: 'Conference' }
    ];

    // Reset form when modal opens
    useEffect(() => {
        if (isOpen) {
            setFormData({
                analystId: isManager ? '' : (user?.analystId || ''),
                startDate: '',
                endDate: '',
                type: 'VACATION',
                reason: '',
                isApproved: isManager ? false : false, // Analysts always create pending requests
                isPlanned: true
            });
            setError(null);
        }
    }, [isOpen, isManager, user]);

    const [duplicateConflictId, setDuplicateConflictId] = useState<string | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        // Validate analyst selection
        if (!formData.analystId) {
            setError('Please select an analyst');
            return;
        }

        // Validate dates
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const startDate = new Date(formData.startDate);

        if (startDate < today) {
            setError('Cannot create absence requests for past dates');
            return;
        }

        if (new Date(formData.endDate) < startDate) {
            setError('End date must be after start date');
            return;
        }

        setLoading(true);
        setError(null);
        setDuplicateConflictId(null);

        try {
            const submissionData = {
                ...formData,
                startDate: dateUtils.toApiDate(formData.startDate),
                endDate: dateUtils.toApiDate(formData.endDate),
                isApproved: isManager ? formData.isApproved : false // Force false for analysts
            };

            const response = await apiService.createAbsence(submissionData);

            // Check for conflicts
            if (response.conflicts && response.conflicts.length > 0) {
                const conflictMessages = response.conflicts.map((conflict: any) =>
                    `${conflict.type}: ${conflict.description}`
                ).join('\n');

                const proceed = window.confirm(
                    `Scheduling conflicts detected:\n\n${conflictMessages}\n\nDo you want to proceed anyway?`
                );

                if (!proceed) {
                    setLoading(false);
                    return;
                }
            }

            onSuccess();
            onClose();
        } catch (err: any) {
            console.error('Error creating absence:', err);
            const errorData = err.response?.data;

            if (errorData?.isDuplicate && errorData?.conflictId) {
                setDuplicateConflictId(errorData.conflictId);
            } else {
                setError(errorData?.error || 'Failed to create absence request. Please try again.');
            }
        } finally {
            setLoading(false);
        }
    };

    const handleReviewDuplicate = () => {
        if (duplicateConflictId) {
            onClose(); // Close modal first
            navigate(`/absences?highlight=${duplicateConflictId}`);
        }
    };

    if (!isOpen) return null;

    return ReactDOM.createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
            <div className="w-full max-w-md p-6 max-h-[90vh] overflow-y-auto bg-white/90 dark:bg-gray-900/90 backdrop-blur-xl border border-gray-200 dark:border-gray-700 rounded-xl shadow-2xl">
                <div className="flex justify-between items-center mb-6">
                    <div className="flex items-center space-x-3">
                        <CalendarBlank className="h-6 w-6 text-primary" />
                        <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                            {isManager ? 'Create Absence' : 'Request Time Off'}
                        </h2>
                    </div>
                    <button onClick={onClose} className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors">
                        <X className="h-5 w-5" />
                    </button>
                </div>

                {error && (
                    <div className="mb-4 p-4 bg-destructive/10 border border-destructive/20 rounded-md">
                        <div className="flex items-center space-x-2">
                            <Warning className="h-5 w-5 text-destructive" />
                            <span className="text-destructive text-sm">{error}</span>
                        </div>
                    </div>
                )}

                {duplicateConflictId && (
                    <div className="mb-6 p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg animate-in fade-in zoom-in duration-300">
                        <div className="flex items-start space-x-3">
                            <Warning className="h-6 w-6 text-yellow-600 dark:text-yellow-500 mt-0.5" />
                            <div className="flex-1">
                                <h3 className="text-base font-semibold text-yellow-900 dark:text-yellow-100 mb-1">
                                    Duplicate entry found
                                </h3>
                                <p className="text-sm text-yellow-800 dark:text-yellow-200 mb-4">
                                    A request of the same type already exists for these dates. Please review the existing entry.
                                </p>
                                <div className="flex space-x-3">
                                    <Button
                                        onClick={handleReviewDuplicate}
                                        variant="primary"
                                        size="sm"
                                        className="bg-yellow-600 hover:bg-yellow-700 text-white border-none"
                                    >
                                        Review
                                    </Button>
                                    <Button
                                        onClick={() => setDuplicateConflictId(null)}
                                        variant="secondary"
                                        size="sm"
                                    >
                                        Cancel
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-4">
                    {/* Analyst Selection - Only visible for managers */}
                    {isManager && (
                        <div>
                            <label className="block text-sm font-medium text-foreground mb-1">
                                Analyst *
                            </label>
                            <SpringDropdown
                                required
                                value={formData.analystId}
                                onChange={(val) => setFormData({ ...formData, analystId: val })}
                                options={analysts.map(analyst => ({
                                    value: analyst.id,
                                    label: `${analyst.name} (${analyst.shiftType})`
                                }))}
                                placeholder="Select Analyst"
                            />
                        </div>
                    )}

                    <div>
                        <label className="block text-sm font-medium text-foreground mb-1">
                            Type *
                        </label>
                        <SpringDropdown
                            required
                            value={formData.type}
                            onChange={(val) => setFormData({ ...formData, type: val })}
                            options={absenceTypes}
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-foreground mb-1">
                                Start Date *
                            </label>
                            <input
                                type="date"
                                value={formData.startDate}
                                onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                                className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground focus:ring-2 focus:ring-primary"
                                required
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-foreground mb-1">
                                End Date *
                            </label>
                            <input
                                type="date"
                                value={formData.endDate}
                                onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                                className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground focus:ring-2 focus:ring-primary"
                                required
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-foreground mb-1">
                            Reason
                        </label>
                        <textarea
                            value={formData.reason}
                            onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                            className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground focus:ring-2 focus:ring-primary"
                            rows={3}
                            placeholder="Optional reason for absence..."
                        />
                    </div>

                    <div className="flex items-center space-x-4">
                        <div className="flex items-center space-x-2">
                            <Checkbox
                                checked={formData.isPlanned}
                                onChange={(checked) => setFormData({ ...formData, isPlanned: checked })}
                            />
                            <span className="text-sm text-foreground">Planned absence</span>
                        </div>

                        {/* Approved checkbox - Only visible for managers */}
                        {isManager && (
                            <div className="flex items-center space-x-2">
                                <Checkbox
                                    checked={formData.isApproved}
                                    onChange={(checked) => setFormData({ ...formData, isApproved: checked })}
                                />
                                <span className="text-sm text-foreground">Pre-approve</span>
                            </div>
                        )}
                    </div>

                    {/* Info message for analysts */}
                    {!isManager && (
                        <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-md">
                            <p className="text-sm text-blue-800 dark:text-blue-200">
                                Your request will be sent to your manager for approval.
                            </p>
                        </div>
                    )}

                    <div className="flex justify-end space-x-3 pt-4">
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
                            disabled={loading}
                        >
                            {loading ? 'Submitting...' : (isManager ? 'Create Absence' : 'Submit Request')}
                        </Button>
                    </div>
                </form>
            </div>
        </div>,
        document.body
    );
};

export default CreateAbsenceModal;
