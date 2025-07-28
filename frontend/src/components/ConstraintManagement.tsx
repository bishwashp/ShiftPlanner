import React, { useState, useEffect } from 'react';
import { apiService, SchedulingConstraint, Analyst } from '../services/api';
import moment from 'moment-timezone';
import { formatDateTime } from '../utils/formatDateTime';

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
        return <div className="text-center p-8 text-muted-foreground">Loading constraints...</div>;
    }
    
    return (
        <div className="bg-background text-foreground p-6">
            <div className="max-w-6xl mx-auto">
                <div className="flex items-center justify-end mb-8">
                    <button onClick={() => setShowAddForm(true)} className="px-6 py-3 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90">
                        Add New Constraint
                    </button>
                </div>

                {(showAddForm || editingConstraint) && (
                    <div className="bg-card text-card-foreground rounded-2xl p-6 shadow-sm border border-border mb-8">
                        <h2 className="text-xl font-semibold text-foreground mb-4">{editingConstraint ? 'Edit Constraint' : 'Add New Constraint'}</h2>
                        <form onSubmit={editingConstraint ? handleUpdateConstraint : handleAddConstraint}>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-sm font-medium text-muted-foreground mb-2">Analyst (optional)</label>
                                    <select value={formData.analystId || ''} onChange={(e) => setFormData({ ...formData, analystId: e.target.value || undefined })} className="w-full input bg-input border-border text-foreground">
                                        <option value="">Global Constraint</option>
                                        {analysts.map(analyst => (
                                            <option key={analyst.id} value={analyst.id}>{analyst.name}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-muted-foreground mb-2">Constraint Type</label>
                                    <select value={formData.constraintType} onChange={(e) => setFormData({ ...formData, constraintType: e.target.value as any })} className="w-full input bg-input border-border text-foreground">
                                        <option value="BLACKOUT_DATE">Blackout Date</option>
                                        <option value="MAX_SCREENER_DAYS">Max Screener Days</option>
                                        <option value="MIN_SCREENER_DAYS">Min Screener Days</option>
                                        <option value="PREFERRED_SCREENER">Preferred Screener</option>
                                        <option value="UNAVAILABLE_SCREENER">Unavailable Screener</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-muted-foreground mb-2">Start Date</label>
                                    <input type="date" value={formData.startDate} onChange={(e) => setFormData({ ...formData, startDate: e.target.value })} className="w-full input bg-input border-border text-foreground" required />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-muted-foreground mb-2">End Date</label>
                                    <input type="date" value={formData.endDate} onChange={(e) => setFormData({ ...formData, endDate: e.target.value })} className="w-full input bg-input border-border text-foreground" required />
                                </div>
                                <div className="md:col-span-2">
                                    <label className="block text-sm font-medium text-muted-foreground mb-2">Description</label>
                                    <textarea value={formData.description || ''} onChange={(e) => setFormData({ ...formData, description: e.target.value })} className="w-full input bg-input border-border text-foreground" rows={3}></textarea>
                                </div>
                                <div className="flex items-center">
                                    <input type="checkbox" id="isActive" checked={formData.isActive} onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })} className="h-4 w-4 rounded border-border text-primary focus:ring-ring" />
                                    <label htmlFor="isActive" className="ml-2 block text-sm text-muted-foreground">Active</label>
                                </div>
                            </div>
                            <div className="flex items-center space-x-4 mt-6">
                                <button type="submit" disabled={submitting} className="px-6 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50">
                                    {submitting ? 'Saving...' : (editingConstraint ? 'Update' : 'Add')}
                                </button>
                                <button type="button" onClick={editingConstraint ? handleCancelEdit : () => setShowAddForm(false)} className="px-6 py-2 bg-muted text-muted-foreground rounded-lg hover:bg-muted/80">
                                    Cancel
                                </button>
                            </div>
                        </form>
                    </div>
                )}

                <div className="bg-card text-card-foreground rounded-2xl shadow-sm border border-border">
                    <div className="px-6 py-4 border-b border-border">
                        <h2 className="text-lg font-semibold text-foreground">Constraints ({constraints.length})</h2>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-muted/50">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Analyst</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Type</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Dates</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Status</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="bg-card divide-y divide-border">
                                {constraints.map(c => (
                                    <tr key={c.id} className="hover:bg-muted/50">
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-foreground">{c.analystId ? analysts.find(a => a.id === c.analystId)?.name : 'Global'}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">{c.constraintType}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">{formatDateTime(c.startDate, moment.tz.guess(), 'MMM D, YYYY')} - {formatDateTime(c.endDate, moment.tz.guess(), 'MMM D, YYYY')}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                                            <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${c.isActive ? 'bg-green-600/10 text-green-600' : 'bg-destructive/10 text-destructive'}`}>
                                                {c.isActive ? 'Active' : 'Inactive'}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                                            <div className="flex items-center space-x-2">
                                                <button onClick={() => handleEditClick(c)} className="text-primary hover:text-primary/80">Edit</button>
                                                <button onClick={() => handleDeleteConstraint(c.id)} className="text-destructive hover:text-destructive/80">Delete</button>
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