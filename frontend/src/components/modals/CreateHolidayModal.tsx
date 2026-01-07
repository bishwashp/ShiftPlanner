import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { apiService } from '../../services/api';
import Checkbox from '../ui/Checkbox';
import Button from '../ui/Button';
import { X, CalendarBlank, Warning } from '@phosphor-icons/react';
import { useRegion } from '../../contexts/RegionContext';

interface Holiday {
    id: string;
    name: string;
    date: string;
    timezone: string;
    isRecurring: boolean;
    year?: number;
    description?: string;
    isActive: boolean;
}

interface CreateHolidayModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    timezone: string;
    editingHoliday?: Holiday | null;
}

const CreateHolidayModal: React.FC<CreateHolidayModalProps> = ({
    isOpen,
    onClose,
    onSuccess,
    timezone,
    editingHoliday
}) => {
    const { selectedRegionId } = useRegion();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [formData, setFormData] = useState({
        name: '',
        date: '',
        isRecurring: false,
        year: new Date().getFullYear(),
        description: '',
        isActive: true
    });

    // Reset form when modal opens or editing holiday changes
    useEffect(() => {
        if (isOpen) {
            if (editingHoliday) {
                setFormData({
                    name: editingHoliday.name,
                    date: editingHoliday.date,
                    isRecurring: editingHoliday.isRecurring,
                    year: editingHoliday.year || new Date().getFullYear(),
                    description: editingHoliday.description || '',
                    isActive: editingHoliday.isActive
                });
            } else {
                setFormData({
                    name: '',
                    date: '',
                    isRecurring: false,
                    year: new Date().getFullYear(),
                    description: '',
                    isActive: true
                });
            }
            setError(null);
        }
    }, [isOpen, editingHoliday]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!formData.name || !formData.date) {
            setError('Name and date are required');
            return;
        }

        setLoading(true);
        setError(null);

        try {
            const holidayData = {
                ...formData,
                timezone,
                year: formData.isRecurring ? undefined : formData.year,
                regionId: selectedRegionId
            };

            if (editingHoliday) {
                await apiService.updateHoliday(editingHoliday.id, holidayData);
            } else {
                await apiService.createHoliday(holidayData);
            }

            onSuccess();
            onClose();
        } catch (err: any) {
            console.error('Error saving holiday:', err);
            setError(err.response?.data?.error || 'Failed to save holiday. Please try again.');
        } finally {
            setLoading(false);
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
                            {editingHoliday ? 'Edit Holiday' : 'Add New Holiday'}
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

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-foreground mb-1">
                            Holiday Name *
                        </label>
                        <input
                            type="text"
                            value={formData.name}
                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                            className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground focus:ring-2 focus:ring-primary"
                            placeholder="e.g., Independence Day"
                            required
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-foreground mb-1">
                            Date *
                        </label>
                        <input
                            type="date"
                            value={formData.date}
                            onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                            className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground focus:ring-2 focus:ring-primary"
                            required
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-foreground mb-1">
                            Description
                        </label>
                        <textarea
                            value={formData.description}
                            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                            className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground focus:ring-2 focus:ring-primary"
                            rows={3}
                            placeholder="Optional description..."
                        />
                    </div>

                    <div className="flex items-center space-x-4">
                        <div className="flex items-center space-x-2">
                            <Checkbox
                                checked={formData.isRecurring}
                                onChange={(checked) => setFormData({ ...formData, isRecurring: checked })}
                            />
                            <span className="text-sm text-foreground">Recurring annually</span>
                        </div>
                        <div className="flex items-center space-x-2">
                            <Checkbox
                                checked={formData.isActive}
                                onChange={(checked) => setFormData({ ...formData, isActive: checked })}
                            />
                            <span className="text-sm text-foreground">Active</span>
                        </div>
                    </div>

                    {!formData.isRecurring && (
                        <div>
                            <label className="block text-sm font-medium text-foreground mb-1">
                                Year
                            </label>
                            <input
                                type="number"
                                value={formData.year}
                                onChange={(e) => setFormData({ ...formData, year: parseInt(e.target.value) })}
                                className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground focus:ring-2 focus:ring-primary"
                            />
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
                            {loading ? 'Saving...' : (editingHoliday ? 'Update Holiday' : 'Add Holiday')}
                        </Button>
                    </div>
                </form>
            </div>
        </div>,
        document.body
    );
};

export default CreateHolidayModal;
