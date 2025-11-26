import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { apiService, SchedulingConstraint, Analyst } from '../services/api';
import moment from 'moment-timezone';
import { formatDateTime } from '../utils/formatDateTime';
import Checkbox from './ui/Checkbox';
import HeaderActionPortal from './layout/HeaderActionPortal';
import HeaderActionButton from './layout/HeaderActionButton';
import Button from './ui/Button';
import { Plus } from '@phosphor-icons/react';

interface ConstraintFormData {
    analystId?: string;
    shiftType?: 'MORNING' | 'EVENING';
    startDate: string;
    endDate: string;
    constraintType: 'BLACKOUT_DATE' | 'MAX_SCREENER_DAYS' | 'MIN_SCREENER_DAYS' | 'PREFERRED_SCREENER' | 'UNAVAILABLE_SCREENER';
    description?: string;
    isActive: boolean;
}

const ConstraintManagement: React.FC = () => {
    const [constraints, setConstraints] = useState<SchedulingConstraint[]>([]);
    const [analysts, setAnalysts] = useState<Analyst[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [showAddForm, setShowAddForm] = useState(false);
    const [editingConstraint, setEditingConstraint] = useState<SchedulingConstraint | null>(null);
    const [formData, setFormData] = useState<ConstraintFormData>({
        startDate: '',
        endDate: '',
        constraintType: 'BLACKOUT_DATE',
        isActive: true,
    });
    const [submitting, setSubmitting] = useState(false);

    const fetchConstraints = async () => {
        try {
            setLoading(true);
            setError(null);
            const data = await apiService.getConstraints();
            setConstraints(data);
        } catch (err) {
            console.error('Error fetching constraints:', err);
            setError('Failed to load constraints. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const fetchAnalysts = async () => {
        try {
            const data = await apiService.getAnalysts();
            setAnalysts(data);
        } catch (err) {
            console.error('Error fetching analysts:', err);
        }
    };

    useEffect(() => {
        fetchConstraints();
        fetchAnalysts();
    }, []);

    const handleAddConstraint = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            setSubmitting(true);
            await apiService.createConstraint(formData);
            setFormData({ startDate: '', endDate: '', constraintType: 'BLACKOUT_DATE', isActive: true });
            setShowAddForm(false);
            fetchConstraints();
        } catch (err: any) {
            console.error('Error creating constraint:', err);
            setError(err.response?.data?.error || 'Failed to create constraint. Please try again.');
        } finally {
            setSubmitting(false);
        }
    };

    const handleUpdateConstraint = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingConstraint) return;

        try {
            setSubmitting(true);
            await apiService.updateConstraint(editingConstraint.id, formData);
            setFormData({ startDate: '', endDate: '', constraintType: 'BLACKOUT_DATE', isActive: true });
            setEditingConstraint(null);
            fetchConstraints();
        } catch (err: any) {
            console.error('Error updating constraint:', err);
            setError(err.response?.data?.error || 'Failed to update constraint. Please try again.');
        } finally {
            setSubmitting(false);
        }
    };

    const handleDeleteConstraint = async (id: string) => {
        if (!window.confirm('Are you sure you want to delete this constraint?')) return;

        try {
            await apiService.deleteConstraint(id);
            fetchConstraints();
        } catch (err: any) {
            console.error('Error deleting constraint:', err);
            setError(err.response?.data?.error || 'Failed to delete constraint. Please try again.');
        }
    };

    const handleEditClick = (constraint: SchedulingConstraint) => {
        setEditingConstraint(constraint);
        setFormData({
            ...constraint,
            startDate: moment(constraint.startDate).format('YYYY-MM-DD'),
            endDate: moment(constraint.endDate).format('YYYY-MM-DD'),
        });
    };

    const handleCancelEdit = () => {
        setEditingConstraint(null);
        setFormData({ startDate: '', endDate: '', constraintType: 'BLACKOUT_DATE', isActive: true });
    };

    if (loading) {
        return <div className="text-center p-8 text-gray-700 dark:text-gray-200">Loading constraints...</div>;
    }

    return (
        <div className="text-foreground p-6 relative z-10">
            <div className="max-w-6xl mx-auto">
                {error && (
                    <div className="mb-6 p-4 bg-destructive/10 border border-destructive/20 text-destructive rounded-lg">
                        {error}
                    </div>
                )}
                <HeaderActionPortal>
                    <HeaderActionButton
                        icon={Plus}
                        label="Add New"
                        onClick={() => setShowAddForm(true)}
                    />
                </HeaderActionPortal>

                {(showAddForm || editingConstraint) && ReactDOM.createPortal(
                    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                        <div className="bg-white/90 dark:bg-gray-900/90 backdrop-blur-xl border border-gray-200 dark:border-gray-700 rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                            <div className="p-6">
                                <h2 className="text-xl font-semibold text-foreground mb-6">{editingConstraint ? 'Edit Constraint' : 'Add New Constraint'}</h2>
                                <form onSubmit={editingConstraint ? handleUpdateConstraint : handleAddConstraint}>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">Analyst (optional)</label>
                                            <select value={formData.analystId || ''} onChange={(e) => setFormData({ ...formData, analystId: e.target.value || undefined })} className="w-full input bg-input border-border text-foreground">
                                                <option value="">Global Constraint</option>
                                                {analysts.map(analyst => (
                                                    <option key={analyst.id} value={analyst.id}>{analyst.name}</option>
                                                ))}
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">Constraint Type</label>
                                            <select value={formData.constraintType} onChange={(e) => setFormData({ ...formData, constraintType: e.target.value as any })} className="w-full input bg-input border-border text-foreground">
                                                <option value="BLACKOUT_DATE">Blackout Date</option>
                                                <option value="MAX_SCREENER_DAYS">Max Screener Days</option>
                                                <option value="MIN_SCREENER_DAYS">Min Screener Days</option>
                                                <option value="PREFERRED_SCREENER">Preferred Screener</option>
                                                <option value="UNAVAILABLE_SCREENER">Unavailable Screener</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">Start Date</label>
                                            <input type="date" value={formData.startDate} onChange={(e) => setFormData({ ...formData, startDate: e.target.value })} className="w-full input bg-input border-border text-foreground" required />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">End Date</label>
                                            <input type="date" value={formData.endDate} onChange={(e) => setFormData({ ...formData, endDate: e.target.value })} className="w-full input bg-input border-border text-foreground" required />
                                        </div>
                                        <div className="md:col-span-2">
                                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">Description</label>
                                            <textarea value={formData.description || ''} onChange={(e) => setFormData({ ...formData, description: e.target.value })} className="w-full input bg-input border-border text-foreground" rows={3}></textarea>
                                        </div>
                                        <div className="flex items-center">
                                            <Checkbox
                                                checked={formData.isActive}
                                                onChange={(checked) => setFormData({ ...formData, isActive: checked })}
                                            />
                                            <span className="ml-2 block text-sm text-gray-700 dark:text-gray-200">Active</span>
                                        </div>
                                    </div>
                                    <div className="flex items-center justify-end space-x-4 mt-8 pt-6 border-t border-border">
                                        <Button type="button" onClick={editingConstraint ? handleCancelEdit : () => setShowAddForm(false)} variant="secondary">
                                            Cancel
                                        </Button>
                                        <Button type="submit" disabled={submitting} variant="primary">
                                            {editingConstraint ? 'Update Constraint' : 'Add Constraint'}
                                        </Button>
                                    </div>
                                </form>
                            </div>
                        </div>
                    </div>,
                    document.body
                )}

                <div className="bg-white/90 dark:bg-gray-900/90 backdrop-blur-xl border border-gray-200 dark:border-gray-700 rounded-xl shadow-sm overflow-hidden">
                    <div className="px-6 py-4 border-b border-border">
                        <h2 className="text-lg font-semibold text-foreground">Constraints ({constraints.length})</h2>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-white/10 dark:bg-black/10">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-200 uppercase tracking-wider">Analyst</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-200 uppercase tracking-wider">Type</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-200 uppercase tracking-wider">Dates</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-200 uppercase tracking-wider">Status</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-200 uppercase tracking-wider">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border">
                                {constraints.map(c => (
                                    <tr key={c.id} className="hover:bg-muted/50">
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-foreground">{c.analystId ? analysts.find(a => a.id === c.analystId)?.name : 'Global'}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700 dark:text-gray-200">{c.constraintType}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700 dark:text-gray-200">{formatDateTime(c.startDate, moment.tz.guess(), 'MMM D, YYYY')} - {formatDateTime(c.endDate, moment.tz.guess(), 'MMM D, YYYY')}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                                            <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${c.isActive ? 'bg-green-600/10 text-green-600' : 'bg-destructive/10 text-destructive'}`}>
                                                {c.isActive ? 'Active' : 'Inactive'}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                                            <div className="flex items-center space-x-2">
                                                <Button onClick={() => handleEditClick(c)} variant="ghost" size="sm" className="mr-2">Edit</Button>
                                                <Button onClick={() => handleDeleteConstraint(c.id)} variant="danger" size="sm">Delete</Button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ConstraintManagement; 