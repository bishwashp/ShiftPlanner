import React, { useState, useEffect } from 'react';
import { Calendar, Lightning, Plus, Trash, PencilSimple, ArrowRight } from '@phosphor-icons/react';
import { constraintService } from '../../services/constraintService';
import { SchedulingConstraint } from '../../services/api';
import HolidayConstraintConfig from './HolidayConstraintConfig';
import SpecialEventForm from './SpecialEventForm';
import Button from '../ui/Button';

type ViewMode = 'portal' | 'holiday' | 'special-event';

const ConstraintPortal: React.FC = () => {
    const [viewMode, setViewMode] = useState<ViewMode>('portal');
    const [specialEvents, setSpecialEvents] = useState<SchedulingConstraint[]>([]);
    const [templates, setTemplates] = useState<{ systemTemplates: any[]; savedPresets: any[] }>({
        systemTemplates: [],
        savedPresets: []
    });
    const [loading, setLoading] = useState(true);
    const [selectedTemplate, setSelectedTemplate] = useState<any>(null);

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            setLoading(true);
            const [events, temps] = await Promise.all([
                constraintService.getSpecialEvents(),
                constraintService.getSpecialEventTemplates()
            ]);
            setSpecialEvents(events);
            setTemplates(temps);
        } catch (err) {
            console.error('Failed to fetch constraint data:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!window.confirm('Are you sure you want to delete this special event?')) return;
        try {
            await constraintService.deleteSpecialEvent(id);
            setSpecialEvents(prev => prev.filter(e => e.id !== id));
        } catch (err) {
            console.error('Failed to delete special event:', err);
        }
    };

    const handleApplyTemplate = (template: any) => {
        setSelectedTemplate(template);
        setViewMode('special-event');
    };

    const handleSuccess = () => {
        setViewMode('portal');
        setSelectedTemplate(null);
        fetchData();
    };

    if (viewMode === 'holiday') {
        return (
            <div className="max-w-2xl mx-auto">
                <button
                    onClick={() => setViewMode('portal')}
                    className="mb-4 text-sm text-gray-500 hover:text-gray-700 flex items-center"
                >
                    ← Back to Constraint Portal
                </button>
                <HolidayConstraintConfig onClose={() => setViewMode('portal')} />
            </div>
        );
    }

    if (viewMode === 'special-event') {
        return (
            <div className="max-w-2xl mx-auto">
                <button
                    onClick={() => { setViewMode('portal'); setSelectedTemplate(null); }}
                    className="mb-4 text-sm text-gray-500 hover:text-gray-700 flex items-center"
                >
                    ← Back to Constraint Portal
                </button>
                <SpecialEventForm
                    template={selectedTemplate}
                    onClose={() => { setViewMode('portal'); setSelectedTemplate(null); }}
                    onSuccess={handleSuccess}
                />
            </div>
        );
    }

    return (
        <div className="space-y-6">

            {/* Two-Path Entry */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Holiday Constraint Card */}
                <button
                    onClick={() => setViewMode('holiday')}
                    className="p-6 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 hover:border-amber-400 dark:hover:border-amber-500 transition-colors text-left group"
                >
                    <div className="flex items-start space-x-4">
                        <div className="w-12 h-12 bg-amber-100 dark:bg-amber-900/30 rounded-lg flex items-center justify-center group-hover:scale-105 transition-transform">
                            <Calendar className="w-6 h-6 text-amber-600" />
                        </div>
                        <div className="flex-1">
                            <h3 className="font-semibold text-foreground">Holiday Constraint</h3>
                            <p className="text-sm text-gray-500 mt-1">
                                Configure global rules for all holidays
                            </p>
                        </div>
                        <ArrowRight className="w-5 h-5 text-gray-400 group-hover:text-amber-500" />
                    </div>
                </button>

                {/* Special Event Card */}
                <button
                    onClick={() => setViewMode('special-event')}
                    className="p-6 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 hover:border-blue-400 dark:hover:border-blue-500 transition-colors text-left group"
                >
                    <div className="flex items-start space-x-4">
                        <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center group-hover:scale-105 transition-transform">
                            <Lightning className="w-6 h-6 text-blue-600" />
                        </div>
                        <div className="flex-1">
                            <h3 className="font-semibold text-foreground">Special Event</h3>
                            <p className="text-sm text-gray-500 mt-1">
                                Create overrides for specific dates
                            </p>
                        </div>
                        <ArrowRight className="w-5 h-5 text-gray-400 group-hover:text-blue-500" />
                    </div>
                </button>
            </div>

            {/* Saved Templates */}
            {(templates.systemTemplates.length > 0 || templates.savedPresets.length > 0) && (
                <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
                    <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
                        <h3 className="font-semibold text-foreground">Saved Templates</h3>
                    </div>
                    <div className="divide-y divide-gray-100 dark:divide-gray-800">
                        {templates.systemTemplates.map((template: any) => (
                            <div key={template.id} className="p-4 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-800/50">
                                <div>
                                    <p className="font-medium text-foreground">{template.displayName || template.name}</p>
                                    <p className="text-sm text-gray-500">{template.description}</p>
                                </div>
                                <Button variant="secondary" size="sm" onClick={() => handleApplyTemplate(template)}>
                                    Apply
                                </Button>
                            </div>
                        ))}
                        {templates.savedPresets.map((preset: any, idx: number) => (
                            <div key={idx} className="p-4 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-800/50">
                                <div>
                                    <p className="font-medium text-foreground">{preset.name}</p>
                                    <p className="text-sm text-gray-500">Custom preset</p>
                                </div>
                                <Button variant="secondary" size="sm" onClick={() => handleApplyTemplate(preset)}>
                                    Apply
                                </Button>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Active Special Events */}
            <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
                <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
                    <h3 className="font-semibold text-foreground">Active Special Events</h3>
                    <span className="text-sm text-gray-500">{specialEvents.length} events</span>
                </div>
                {loading ? (
                    <div className="p-8 text-center">
                        <div className="animate-spin w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full mx-auto"></div>
                    </div>
                ) : specialEvents.length === 0 ? (
                    <div className="p-8 text-center text-gray-500">
                        <Lightning className="w-8 h-8 mx-auto mb-2 opacity-50" />
                        <p>No special events configured</p>
                    </div>
                ) : (
                    <div className="divide-y divide-gray-100 dark:divide-gray-800">
                        {specialEvents.map((event) => (
                            <div key={event.id} className="p-4 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-800/50">
                                <div>
                                    <p className="font-medium text-foreground">{(event as any).name || event.constraintType}</p>
                                    <p className="text-sm text-gray-500">
                                        {new Date(event.startDate).toLocaleDateString()} - {new Date(event.endDate).toLocaleDateString()}
                                    </p>
                                </div>
                                <div className="flex items-center space-x-2">
                                    <button
                                        onClick={() => handleDelete(event.id)}
                                        className="p-2 text-gray-400 hover:text-red-500 transition-colors"
                                    >
                                        <Trash className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default ConstraintPortal;
