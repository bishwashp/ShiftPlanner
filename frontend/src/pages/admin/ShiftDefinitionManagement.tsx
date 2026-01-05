import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom';
import moment from 'moment-timezone';
import { apiClient as api } from '../../services/api';
import { useRegion } from '../../contexts/RegionContext';
import Button from '../../components/ui/Button';
import { Plus, Trash, Clock, ArrowRight, Globe, PencilSimple, FloppyDisk, X } from '@phosphor-icons/react';

interface Region {
    id: string;
    name: string;
    timezone: string;
}

interface ShiftDefinition {
    id: string;
    name: string;
    startResult: string;
    endResult: string;
    regionId: string;
    region?: Region;
    outgoingHandovers: HandoverDefinition[];
    isOvernight?: boolean;
}

interface HandoverDefinition {
    id: string;
    sourceShiftId: string;
    targetShiftId: string;
    handoverTime: string;
    targetShift: ShiftDefinition & { region: Region };
    sourceShift: ShiftDefinition & { region: Region };
}

const ShiftDefinitionManagement: React.FC = () => {
    const [shifts, setShifts] = useState<ShiftDefinition[]>([]);
    const [regions, setRegions] = useState<Region[]>([]);
    const [loading, setLoading] = useState(true);
    const [showShiftModal, setShowShiftModal] = useState(false);
    const [showHandoverModal, setShowHandoverModal] = useState(false);

    // Edit State
    const [editingShiftId, setEditingShiftId] = useState<string | null>(null);
    const [editForm, setEditForm] = useState({ name: '', startResult: '', endResult: '' });

    // Form States
    const [shiftForm, setShiftForm] = useState({ name: '', startResult: '', endResult: '', isOvernight: false, regionId: '' });
    const [handoverForm, setHandoverForm] = useState({ sourceShiftId: '', targetRegionId: '', targetShiftId: '', handoverTime: '' });
    const [submitting, setSubmitting] = useState(false);

    // Derived state for handover form (target shifts)
    const [targetRegionShifts, setTargetRegionShifts] = useState<ShiftDefinition[]>([]);

    // --- Timezone Logic ---
    const { selectedRegionId } = useRegion();

    // Determine display timezone: Selected Region's TZ > System TZ (if global)
    // Note: This relies on 'regions' being populated.
    const getDisplayTimezone = () => {
        if (!selectedRegionId) return moment.tz.guess();
        const region = regions.find(r => r.id === selectedRegionId);
        return region?.timezone || 'UTC';
    };
    const displayTimezone = getDisplayTimezone();

    const toLocal = (utcTime: string) => {
        if (!utcTime) return '';
        // Interpret as Today's UTC time to respect current DST offset
        return moment.tz(utcTime, 'HH:mm', 'UTC').tz(displayTimezone).format('HH:mm');
    };

    const toUtc = (localTime: string) => {
        if (!localTime) return '';
        return moment.tz(localTime, 'HH:mm', displayTimezone).utc().format('HH:mm');
    };

    useEffect(() => {
        fetchData();
    }, []);

    // Fetch target shifts when target region changes in modal
    useEffect(() => {
        if (handoverForm.targetRegionId) {
            // Filter from already loaded shifts
            setTargetRegionShifts(shifts.filter(s => s.regionId === handoverForm.targetRegionId));
        }
    }, [handoverForm.targetRegionId, shifts]);

    const fetchData = async () => {
        try {
            setLoading(true);
            // Fetch ALL shifts globally - explicitly set empty x-region-id to bypass interceptor
            const [shiftsRes, regionsRes] = await Promise.all([
                api.get<ShiftDefinition[]>('/shift-definitions', { headers: { 'x-region-id': '' } }),
                api.get<Region[]>('/regions')
            ]);
            setShifts(shiftsRes.data);
            setRegions(regionsRes.data);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const handleCreateShift = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitting(true);
        try {
            await api.post('/shift-definitions', {
                ...shiftForm,
                regionId: shiftForm.regionId
            });
            setShowShiftModal(false);
            setShiftForm({ name: '', startResult: '', endResult: '', isOvernight: false, regionId: '' });
            fetchData();
        } catch (error) {
            alert('Failed to create shift');
        } finally {
            setSubmitting(false);
        }
    };

    const handleCreateHandover = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitting(true);
        try {
            await api.post('/shift-definitions/handovers', {
                sourceShiftId: handoverForm.sourceShiftId,
                targetShiftId: handoverForm.targetShiftId,
                handoverTime: handoverForm.handoverTime
            });
            setShowHandoverModal(false);
            setHandoverForm({ sourceShiftId: '', targetRegionId: '', targetShiftId: '', handoverTime: '' });
            fetchData();
        } catch (error) {
            alert('Failed to create handover');
        } finally {
            setSubmitting(false);
        }
    };

    const handleDeleteShift = async (id: string, name: string) => {
        if (!window.confirm(`Delete shift "${name}"?`)) return;
        await api.delete(`/shift-definitions/${id}`);
        fetchData();
    };

    const handleDeleteHandover = async (id: string) => {
        if (!window.confirm('Are you sure you want to delete this handover?')) return;
        await api.delete(`/shift-definitions/handovers/${id}`);
        fetchData();
    };

    // --- Inline Edit Handlers ---

    const startEdit = (shift: ShiftDefinition) => {
        setEditingShiftId(shift.id);
        setEditForm({
            name: shift.name,
            startResult: shift.startResult,
            endResult: shift.endResult
        });
    };

    const cancelEdit = () => {
        setEditingShiftId(null);
        setEditForm({ name: '', startResult: '', endResult: '' });
    };

    const saveEdit = async (id: string) => {
        try {
            setSubmitting(true);
            // Simple overnight check logic: if end < start, assume overnight
            // Or preserve existing isOvernight? The PUT endpoint updates it.
            // Let's calculate it to be safe, or we could fetch it.
            // For now, let's update name and times.

            // Note: The PUT endpoint expects { name, startResult, endResult, isOvernight }
            // We should determine isOvernight based on the times provided
            const startH = parseInt(editForm.startResult.split(':')[0]);
            const endH = parseInt(editForm.endResult.split(':')[0]);
            const isOvernight = endH < startH;

            await api.put(`/shift-definitions/${id}`, {
                ...editForm,
                isOvernight
            });

            setEditingShiftId(null);
            fetchData(); // Refresh to propagate changes
        } catch (error) {
            console.error(error);
            alert('Failed to update shift');
        } finally {
            setSubmitting(false);
        }
    };

    // --- Inline Handover Edit Handlers ---

    const [editingHandoverId, setEditingHandoverId] = useState<string | null>(null);
    const [editHandoverForm, setEditHandoverForm] = useState({ handoverTime: '', description: '' });

    const startEditHandover = (handover: HandoverDefinition) => {
        setEditingHandoverId(handover.id);
        setEditHandoverForm({
            handoverTime: toLocal(handover.handoverTime),
            description: ''
        });
    };

    const cancelEditHandover = () => {
        setEditingHandoverId(null);
        setEditHandoverForm({ handoverTime: '', description: '' });
    };

    const saveEditHandover = async (id: string) => {
        try {
            setSubmitting(true);
            await api.put(`/shift-definitions/handovers/${id}`, {
                handoverTime: toUtc(editHandoverForm.handoverTime),
                description: editHandoverForm.description
            });
            setEditingHandoverId(null);
            fetchData();
        } catch (error) {
            console.error(error);
            alert('Failed to update handover');
        } finally {
            setSubmitting(false);
        }
    };

    // Group shifts by region
    const shiftsByRegion = regions.map(region => ({
        region,
        shifts: shifts.filter(s => s.regionId === region.id)
    })).filter(group => group.shifts.length > 0);

    // All handovers flattened
    const allHandovers = shifts.flatMap(s => s.outgoingHandovers.map(h => ({
        ...h,
        sourceShift: s as ShiftDefinition & { region: Region }
    })));

    if (loading) return <div className="flex items-center justify-center h-64 text-gray-500">Loading Shifts...</div>;

    return (
        <div className="space-y-8">
            {/* SECTION 1: SHIFTS - Grouped by Region */}
            <div className="relative overflow-hidden rounded-xl border bg-white/40 dark:bg-gray-800/50 border-gray-300/50 dark:border-white/10 backdrop-blur-xl shadow-xl shadow-black/5 dark:shadow-black/20 p-6">
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-lg font-semibold text-foreground">Shift Definitions</h2>
                    <Button
                        onClick={() => setShowShiftModal(true)}
                        leftIcon={Plus}
                        variant="primary"
                        size="sm"
                    >
                        Add Shift
                    </Button>
                </div>

                {shiftsByRegion.length === 0 ? (
                    <div className="px-6 py-8 text-center text-gray-500 text-sm">No shifts configured.</div>
                ) : (
                    <div className="space-y-6">
                        {shiftsByRegion.map(({ region, shifts: regionShifts }) => (
                            <div key={region.id}>
                                <div className="flex items-center gap-2 mb-3">
                                    <Globe className="w-4 h-4 text-blue-500" />
                                    <span className="text-sm font-bold text-foreground">{region.name}</span>
                                    <span className="text-xs text-gray-500">({regionShifts.length} shifts)</span>
                                </div>
                                <div className="overflow-x-auto rounded-lg border border-border">
                                    <table className="w-full">
                                        <thead className="bg-white/10 dark:bg-black/10">
                                            <tr>
                                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-200 uppercase tracking-wider w-1/3">Shift Name</th>
                                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-200 uppercase tracking-wider">Start (Local)</th>
                                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-200 uppercase tracking-wider">End (Local)</th>
                                                <th className="px-6 py-3 text-right text-xs font-medium text-gray-700 dark:text-gray-200 uppercase tracking-wider w-32">Action</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-border">
                                            {regionShifts.map(shift => {
                                                const isEditing = editingShiftId === shift.id;
                                                return (
                                                    <tr key={shift.id} className={isEditing ? "bg-blue-50/50 dark:bg-blue-900/10" : "hover:bg-muted/50"}>
                                                        {isEditing ? (
                                                            <>
                                                                <td className="px-6 py-3">
                                                                    <input
                                                                        className="w-full px-2 py-1 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white border border-gray-300 dark:border-gray-600 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                                        value={editForm.name}
                                                                        onChange={e => setEditForm({ ...editForm, name: e.target.value })}
                                                                        placeholder="Shift Name"
                                                                        autoFocus
                                                                    />
                                                                </td>
                                                                <td className="px-6 py-3">
                                                                    <input
                                                                        type="time"
                                                                        className="px-2 py-1 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white border border-gray-300 dark:border-gray-600 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                                                                        value={editForm.startResult}
                                                                        onChange={e => setEditForm({ ...editForm, startResult: e.target.value })}
                                                                    />
                                                                </td>
                                                                <td className="px-6 py-3">
                                                                    <input
                                                                        type="time"
                                                                        className="px-2 py-1 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white border border-gray-300 dark:border-gray-600 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                                                                        value={editForm.endResult}
                                                                        onChange={e => setEditForm({ ...editForm, endResult: e.target.value })}
                                                                    />
                                                                </td>
                                                                <td className="px-6 py-3 text-right whitespace-nowrap">
                                                                    <div className="flex items-center justify-end gap-1">
                                                                        <Button
                                                                            onClick={() => saveEdit(shift.id)}
                                                                            variant="ghost"
                                                                            size="sm"
                                                                            disabled={submitting}
                                                                            className="text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/20 w-8 h-8 p-0"
                                                                            title="Save"
                                                                        >
                                                                            <FloppyDisk className="w-4 h-4" />
                                                                        </Button>
                                                                        <Button
                                                                            onClick={cancelEdit}
                                                                            variant="ghost"
                                                                            size="sm"
                                                                            className="text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 w-8 h-8 p-0"
                                                                            title="Cancel"
                                                                        >
                                                                            <X className="w-4 h-4" />
                                                                        </Button>
                                                                    </div>
                                                                </td>
                                                            </>
                                                        ) : (
                                                            <>
                                                                <td className="px-6 py-4 whitespace-nowrap font-medium text-foreground">{shift.name}</td>
                                                                <td className="px-6 py-4 whitespace-nowrap text-gray-700 dark:text-gray-300 font-mono text-xs">{shift.startResult}</td>
                                                                <td className="px-6 py-4 whitespace-nowrap text-gray-700 dark:text-gray-300 font-mono text-xs">{shift.endResult}</td>
                                                                <td className="px-6 py-4 whitespace-nowrap text-right">
                                                                    <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                                        <Button
                                                                            onClick={() => startEdit(shift)}
                                                                            variant="ghost"
                                                                            size="sm"
                                                                            className="text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20"
                                                                            title="Edit"
                                                                        >
                                                                            <PencilSimple className="w-4 h-4" />
                                                                        </Button>
                                                                        <Button
                                                                            onClick={() => handleDeleteShift(shift.id, shift.name)}
                                                                            variant="ghost"
                                                                            size="sm"
                                                                            className="text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"
                                                                            title="Delete"
                                                                        >
                                                                            <Trash className="w-4 h-4" />
                                                                        </Button>
                                                                    </div>
                                                                    {/* Always visible on mobile, or just use group-hover on row */}
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
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* SECTION 2: HANDOVERS - Global View */}
            <div className="relative overflow-hidden rounded-xl border bg-white/40 dark:bg-gray-800/50 border-gray-300/50 dark:border-white/10 backdrop-blur-xl shadow-xl shadow-black/5 dark:shadow-black/20 p-6">
                <div className="flex justify-between items-center mb-2">
                    <h2 className="text-lg font-semibold text-foreground">Handovers</h2>
                    <Button
                        onClick={() => setShowHandoverModal(true)}
                        leftIcon={Plus}
                        variant="primary"
                        size="sm"
                    >
                        Add Handover
                    </Button>
                </div>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">All configured handovers across regions.</p>

                <div className="overflow-x-auto rounded-lg border border-border">
                    <table className="w-full">
                        <thead className="bg-white/10 dark:bg-black/10">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-200 uppercase tracking-wider">From</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-200 uppercase tracking-wider">Time ({displayTimezone})</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-200 uppercase tracking-wider">To</th>
                                <th className="px-6 py-3 text-right text-xs font-medium text-gray-700 dark:text-gray-200 uppercase tracking-wider">Action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                            {allHandovers.length === 0 && (
                                <tr><td colSpan={4} className="px-6 py-8 text-center text-gray-500 text-sm">No handovers configured.</td></tr>
                            )}
                            {allHandovers.map(handover => {
                                const isEditing = editingHandoverId === handover.id;
                                return (
                                    <tr key={handover.id} className={isEditing ? "bg-blue-50/50 dark:bg-blue-900/10" : "hover:bg-muted/50"}>
                                        {isEditing ? (
                                            <>
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <span className="bg-blue-100 dark:bg-blue-900/30 px-2 py-0.5 rounded text-xs font-bold text-blue-700 dark:text-blue-300">
                                                        {handover.sourceShift.region?.name || '?'}
                                                    </span>
                                                    <span className="ml-2 font-medium text-foreground">{handover.sourceShift.name}</span>
                                                </td>
                                                <td className="px-6 py-3">
                                                    <input
                                                        type="time"
                                                        className="px-2 py-1 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white border border-gray-300 dark:border-gray-600 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                                                        value={editHandoverForm.handoverTime}
                                                        onChange={e => setEditHandoverForm({ ...editHandoverForm, handoverTime: e.target.value })}
                                                        autoFocus
                                                    />
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <div className="flex items-center gap-2">
                                                        <ArrowRight className="text-gray-400" />
                                                        <span className="bg-green-100 dark:bg-green-900/30 px-2 py-0.5 rounded text-xs font-bold text-green-700 dark:text-green-300">
                                                            {handover.targetShift?.region?.name || '?'}
                                                        </span>
                                                        <span className="font-medium text-foreground">{handover.targetShift?.name}</span>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-3 text-right whitespace-nowrap">
                                                    <div className="flex items-center justify-end gap-1">
                                                        <Button
                                                            onClick={() => saveEditHandover(handover.id)}
                                                            variant="ghost"
                                                            size="sm"
                                                            disabled={submitting}
                                                            className="text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/20 w-8 h-8 p-0"
                                                            title="Save"
                                                        >
                                                            <FloppyDisk className="w-4 h-4" />
                                                        </Button>
                                                        <Button
                                                            onClick={cancelEditHandover}
                                                            variant="ghost"
                                                            size="sm"
                                                            className="text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 w-8 h-8 p-0"
                                                            title="Cancel"
                                                        >
                                                            <X className="w-4 h-4" />
                                                        </Button>
                                                    </div>
                                                </td>
                                            </>
                                        ) : (
                                            <>
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <span className="bg-blue-100 dark:bg-blue-900/30 px-2 py-0.5 rounded text-xs font-bold text-blue-700 dark:text-blue-300">
                                                        {handover.sourceShift.region?.name || '?'}
                                                    </span>
                                                    <span className="ml-2 font-medium text-foreground">{handover.sourceShift.name}</span>
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <div className="flex items-center gap-2 text-purple-600 dark:text-purple-400 font-bold font-mono text-sm">
                                                        <Clock weight="fill" />
                                                        {toLocal(handover.handoverTime)}
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <div className="flex items-center gap-2">
                                                        <ArrowRight className="text-gray-400" />
                                                        <span className="bg-green-100 dark:bg-green-900/30 px-2 py-0.5 rounded text-xs font-bold text-green-700 dark:text-green-300">
                                                            {handover.targetShift?.region?.name || '?'}
                                                        </span>
                                                        <span className="font-medium text-foreground">{handover.targetShift?.name}</span>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-right">
                                                    <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                        <Button
                                                            onClick={() => startEditHandover(handover)}
                                                            variant="ghost"
                                                            size="sm"
                                                            className="text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20"
                                                            title="Edit"
                                                        >
                                                            <PencilSimple className="w-4 h-4" />
                                                        </Button>
                                                        <Button
                                                            onClick={() => handleDeleteHandover(handover.id)}
                                                            variant="ghost"
                                                            size="sm"
                                                            className="text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"
                                                            title="Delete"
                                                        >
                                                            <Trash className="w-4 h-4" />
                                                        </Button>
                                                    </div>
                                                    <style>{`
                                                        tr:hover .opacity-0 { opacity: 1 !important; }
                                                    `}</style>
                                                </td>
                                            </>
                                        )}
                                    </tr>
                                )
                            })}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Shift Modal */}
            {showShiftModal && ReactDOM.createPortal(
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-white/90 dark:bg-gray-900/90 backdrop-blur-xl border border-gray-200 dark:border-gray-700 rounded-xl shadow-2xl max-w-sm w-full">
                        <div className="p-6">
                            <h3 className="text-lg font-bold mb-4 text-foreground">Add Shift</h3>
                            <form onSubmit={handleCreateShift} className="space-y-4">
                                <div>
                                    <label className="block text-xs font-medium text-gray-500 mb-1">Region</label>
                                    <select
                                        className="w-full px-4 py-2 border border-border rounded-lg bg-input focus:ring-2 focus:ring-ring focus:border-transparent"
                                        value={shiftForm.regionId}
                                        onChange={e => setShiftForm({ ...shiftForm, regionId: e.target.value })}
                                        required
                                    >
                                        <option value="">Select Region...</option>
                                        {regions.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-gray-500 mb-1">Name</label>
                                    <input
                                        placeholder="e.g. Morning Shift"
                                        className="w-full px-4 py-2 border border-border rounded-lg bg-input focus:ring-2 focus:ring-ring focus:border-transparent"
                                        value={shiftForm.name}
                                        onChange={e => setShiftForm({ ...shiftForm, name: e.target.value })}
                                        required
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-medium text-gray-500 mb-1">Start Time</label>
                                        <input
                                            type="time"
                                            className="w-full px-4 py-2 border border-border rounded-lg bg-input focus:ring-2 focus:ring-ring focus:border-transparent"
                                            value={shiftForm.startResult}
                                            onChange={e => setShiftForm({ ...shiftForm, startResult: e.target.value })}
                                            required
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-gray-500 mb-1">End Time</label>
                                        <input
                                            type="time"
                                            className="w-full px-4 py-2 border border-border rounded-lg bg-input focus:ring-2 focus:ring-ring focus:border-transparent"
                                            value={shiftForm.endResult}
                                            onChange={e => setShiftForm({ ...shiftForm, endResult: e.target.value })}
                                            required
                                        />
                                    </div>
                                </div>

                                <div className="flex justify-end gap-2 mt-6 pt-4 border-t border-border">
                                    <Button type="button" onClick={() => setShowShiftModal(false)} variant="secondary">Cancel</Button>
                                    <Button type="submit" disabled={submitting} variant="primary">
                                        {submitting ? 'Saving...' : 'Save'}
                                    </Button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>,
                document.body
            )}

            {/* Handover Modal */}
            {showHandoverModal && ReactDOM.createPortal(
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-white/90 dark:bg-gray-900/90 backdrop-blur-xl border border-gray-200 dark:border-gray-700 rounded-xl shadow-2xl max-w-md w-full">
                        <div className="p-6">
                            <h3 className="text-lg font-bold mb-4 text-foreground">Add Handover</h3>
                            <form onSubmit={handleCreateHandover} className="space-y-4">

                                {/* Source Shift */}
                                <div>
                                    <label className="block text-xs font-medium text-gray-500 mb-1">From (Source Shift)</label>
                                    <select
                                        className="w-full px-4 py-2 border border-border rounded-lg bg-input focus:ring-2 focus:ring-ring focus:border-transparent"
                                        value={handoverForm.sourceShiftId}
                                        onChange={e => setHandoverForm({ ...handoverForm, sourceShiftId: e.target.value })}
                                        required
                                    >
                                        <option value="">Select Shift...</option>
                                        {shifts.map(s => (
                                            <option key={s.id} value={s.id}>[{s.region?.name}] {s.name}</option>
                                        ))}
                                    </select>
                                </div>

                                {/* Handover Time */}
                                <div>
                                    <label className="block text-xs font-medium text-gray-500 mb-1">Handover Time (UTC)</label>
                                    <input
                                        type="time"
                                        className="w-full px-4 py-2 border border-border rounded-lg bg-input focus:ring-2 focus:ring-ring focus:border-transparent"
                                        value={handoverForm.handoverTime}
                                        onChange={e => setHandoverForm({ ...handoverForm, handoverTime: e.target.value })}
                                        required
                                    />
                                </div>

                                {/* Target Region */}
                                <div>
                                    <label className="block text-xs font-medium text-gray-500 mb-1">To (Target Region)</label>
                                    <select
                                        className="w-full px-4 py-2 border border-border rounded-lg bg-input focus:ring-2 focus:ring-ring focus:border-transparent"
                                        value={handoverForm.targetRegionId}
                                        onChange={e => setHandoverForm({ ...handoverForm, targetRegionId: e.target.value, targetShiftId: '' })}
                                        required
                                    >
                                        <option value="">Select Region...</option>
                                        {regions.map(r => (
                                            <option key={r.id} value={r.id}>{r.name}</option>
                                        ))}
                                    </select>
                                </div>

                                {/* Target Shift */}
                                <div>
                                    <label className="block text-xs font-medium text-gray-500 mb-1">To (Target Shift)</label>
                                    <select
                                        className="w-full px-4 py-2 border border-border rounded-lg bg-input focus:ring-2 focus:ring-ring focus:border-transparent"
                                        value={handoverForm.targetShiftId}
                                        onChange={e => setHandoverForm({ ...handoverForm, targetShiftId: e.target.value })}
                                        required
                                        disabled={!handoverForm.targetRegionId}
                                    >
                                        <option value="">Select Target Shift...</option>
                                        {targetRegionShifts.map(s => (
                                            <option key={s.id} value={s.id}>{s.name}</option>
                                        ))}
                                    </select>
                                </div>

                                <div className="flex justify-end gap-2 mt-6 pt-4 border-t border-border">
                                    <Button type="button" onClick={() => setShowHandoverModal(false)} variant="secondary">Cancel</Button>
                                    <Button type="submit" disabled={submitting} variant="primary">Create</Button>
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

export default ShiftDefinitionManagement;
