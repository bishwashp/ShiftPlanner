import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom';
import { apiClient as api } from '../../services/api';
import Button from '../../components/ui/Button';
import { Plus, Trash, Clock, ArrowRight, Globe, PencilSimple, FloppyDisk, X } from '@phosphor-icons/react';
import SpringDropdown from '../../components/ui/SpringDropdown';

interface Region {
    id: string;
    name: string;
    timezone: string;
    isActive: boolean;
}

const RegionManagement: React.FC = () => {
    const [regions, setRegions] = useState<Region[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [showModal, setShowModal] = useState(false);

    // Form State
    const [formData, setFormData] = useState({ name: '', timezone: '' });
    const [submitting, setSubmitting] = useState(false);

    // Inline Edit State
    const [editingRegionId, setEditingRegionId] = useState<string | null>(null);
    const [editForm, setEditForm] = useState({ name: '', timezone: '' });

    const fetchRegions = async () => {
        try {
            const response = await api.get<Region[]>('/regions');
            setRegions(response.data);
        } catch (err) {
            setError('Failed to fetch regions');
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchRegions();
    }, []);

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitting(true);
        try {
            await api.post('/regions', formData);
            setShowModal(false);
            setFormData({ name: '', timezone: '' });
            fetchRegions(); // Refresh list
        } catch (err) {
            alert('Failed to create region');
            console.error(err);
        } finally {
            setSubmitting(false);
        }
    };

    const handleDelete = async (region: Region) => {
        if (!window.confirm(`Are you sure you want to deactivate ${region.name}? This cannot be undone from the UI.`)) return;
        try {
            await api.delete(`/regions/${region.id}`);
            fetchRegions();
        } catch (err) {
            alert('Failed to deactivate region');
        }
    };

    // --- Inline Edit Handlers ---
    const startEdit = (region: Region) => {
        setEditingRegionId(region.id);
        setEditForm({ name: region.name, timezone: region.timezone });
    };

    const cancelEdit = () => {
        setEditingRegionId(null);
        setEditForm({ name: '', timezone: '' });
    };

    const saveEdit = async (id: string, currentIsActive: boolean) => {
        try {
            await api.put(`/regions/${id}`, {
                ...editForm,
                isActive: currentIsActive
            });
            setEditingRegionId(null);
            fetchRegions();
        } catch (err) {
            alert('Failed to update region');
            console.error(err);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="flex flex-col h-full relative z-10 text-gray-500">Loading regions...</div>
            </div>
        );
    }

    return (
        <div className="space-y-6">


            {error && (
                <div className="mb-6 p-4 bg-destructive/10 border border-destructive/20 text-destructive rounded-lg">
                    {error}
                </div>
            )}

            <div className="relative overflow-hidden rounded-xl border bg-white/40 dark:bg-gray-800/50 border-gray-300/50 dark:border-white/10 backdrop-blur-xl shadow-xl shadow-black/5 dark:shadow-black/20">
                <div className="flex justify-between items-center p-6 border-b border-border">
                    <h2 className="text-lg font-semibold text-foreground">Global Regions</h2>
                    <Button
                        onClick={() => setShowModal(true)}
                        leftIcon={Plus}
                        variant="primary"
                        size="sm"
                    >
                        Add Region
                    </Button>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-white/10 dark:bg-black/10">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-200 uppercase tracking-wider w-auto">Name</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-200 uppercase tracking-wider w-auto">Timezone</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-200 uppercase tracking-wider w-auto">Status</th>
                                <th className="px-6 py-3 text-right text-xs font-medium text-gray-700 dark:text-gray-200 uppercase tracking-wider w-32">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                            {regions.map((region) => {
                                const isEditing = editingRegionId === region.id;
                                return (
                                    <tr key={region.id} className={isEditing ? "bg-blue-50/50 dark:bg-blue-900/10" : "hover:bg-muted/50"}>
                                        {isEditing ? (
                                            <>
                                                <td className="px-6 py-3">
                                                    <input
                                                        className="w-full px-2 py-1 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white border border-gray-300 dark:border-gray-600 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 uppercase"
                                                        value={editForm.name}
                                                        onChange={e => setEditForm({ ...editForm, name: e.target.value.toUpperCase() })}
                                                        autoFocus
                                                    />
                                                </td>
                                                <td className="px-6 py-3">
                                                    <SpringDropdown
                                                        value={editForm.timezone}
                                                        onChange={val => setEditForm({ ...editForm, timezone: val })}
                                                        options={[
                                                            { value: "America/New_York", label: "America/New_York (AMR)" },
                                                            { value: "Asia/Singapore", label: "Asia/Singapore (SGP)" },
                                                            { value: "Europe/London", label: "Europe/London (LDN)" },
                                                            { value: "Asia/Tokyo", label: "Asia/Tokyo (TYO)" },
                                                            { value: "Australia/Sydney", label: "Australia/Sydney (SYD)" },
                                                            { value: "Asia/Kolkata", label: "Asia/Kolkata (IST)" }
                                                        ]}
                                                        className="min-w-[200px]"
                                                    />
                                                </td>
                                                <td className="px-6 py-3">
                                                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${region.isActive
                                                        ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
                                                        : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'
                                                        }`}>
                                                        {region.isActive ? 'Active' : 'Inactive'}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-3 text-right whitespace-nowrap">
                                                    <div className="flex items-center justify-end gap-1">
                                                        <Button
                                                            onClick={() => saveEdit(region.id, region.isActive)}
                                                            variant="ghost"
                                                            size="sm"
                                                            className="text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/20 w-8 h-8 p-0"
                                                        >
                                                            <FloppyDisk className="w-4 h-4" />
                                                        </Button>
                                                        <Button
                                                            onClick={cancelEdit}
                                                            variant="ghost"
                                                            size="sm"
                                                            className="text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 w-8 h-8 p-0"
                                                        >
                                                            <X className="w-4 h-4" />
                                                        </Button>
                                                    </div>
                                                </td>
                                            </>
                                        ) : (
                                            <>
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <div className="flex items-center gap-2">
                                                        <Globe className="w-4 h-4 text-blue-500" />
                                                        <div className="text-sm font-medium text-foreground">{region.name}</div>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700 dark:text-gray-200">{region.timezone}</td>
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${region.isActive
                                                        ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
                                                        : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'
                                                        }`}>
                                                        {region.isActive ? 'Active' : 'Inactive'}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                                    <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                        <Button
                                                            onClick={() => startEdit(region)}
                                                            variant="ghost"
                                                            size="sm"
                                                            className="text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20"
                                                            title="Edit"
                                                        >
                                                            <PencilSimple className="w-4 h-4" />
                                                        </Button>
                                                        {region.isActive && (
                                                            <Button
                                                                onClick={() => handleDelete(region)}
                                                                variant="ghost"
                                                                size="sm"
                                                                className="text-red-600 dark:text-red-400 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20"
                                                                title="Deactivate"
                                                            >
                                                                <Trash className="w-4 h-4" />
                                                            </Button>
                                                        )}
                                                    </div>
                                                    <style>{`
                                                        tr:hover .opacity-0 { opacity: 1 !important; }
                                                    `}</style>
                                                </td>
                                            </>
                                        )}
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                    {regions.length === 0 && (
                        <div className="px-6 py-12 text-center text-gray-700 dark:text-gray-200">
                            <Globe className="h-12 w-12 mx-auto mb-4 opacity-50" />
                            <p>No regions found</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Modal */}
            {showModal && ReactDOM.createPortal(
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-white/90 dark:bg-gray-900/90 backdrop-blur-xl border border-gray-200 dark:border-gray-700 rounded-xl shadow-2xl max-w-md w-full">
                        <div className="p-6">
                            <h2 className="text-xl font-semibold text-foreground mb-6">Add New Region</h2>
                            <form onSubmit={handleCreate}>
                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">Region Code (e.g., TYO)</label>
                                        <input
                                            type="text"
                                            required
                                            className="w-full px-4 py-2 border border-border rounded-lg bg-input focus:ring-2 focus:ring-ring focus:border-transparent uppercase"
                                            value={formData.name}
                                            onChange={e => setFormData({ ...formData, name: e.target.value.toUpperCase() })}
                                            placeholder="e.g. TYO"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">Timezone</label>
                                        <SpringDropdown
                                            required
                                            value={formData.timezone}
                                            onChange={val => setFormData({ ...formData, timezone: val })}
                                            placeholder="Select Timezone..."
                                            options={[
                                                { value: "America/New_York", label: "America/New_York (AMR)" },
                                                { value: "Asia/Singapore", label: "Asia/Singapore (SGP)" },
                                                { value: "Europe/London", label: "Europe/London (LDN)" },
                                                { value: "Asia/Tokyo", label: "Asia/Tokyo (TYO)" },
                                                { value: "Australia/Sydney", label: "Australia/Sydney (SYD)" },
                                                { value: "Asia/Kolkata", label: "Asia/Kolkata (IST)" }
                                            ]}
                                        />
                                    </div>
                                </div>
                                <div className="flex items-center justify-end space-x-4 mt-8 pt-6 border-t border-border">
                                    <Button
                                        type="button"
                                        onClick={() => setShowModal(false)}
                                        variant="secondary"
                                    >
                                        Cancel
                                    </Button>
                                    <Button
                                        type="submit"
                                        disabled={submitting}
                                        variant="primary"
                                    >
                                        {submitting ? 'Creating...' : 'Create Region'}
                                    </Button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
};

export default RegionManagement;
