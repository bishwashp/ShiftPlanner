import React, { useState, useEffect } from 'react';
import apiService, { SchedulingConstraint, Analyst } from '../services/api';
import moment from 'moment-timezone';
import { formatDateTime } from '../utils/formatDateTime';
import useRealTimeConstraintValidation from '../hooks/useRealTimeConstraintValidation';
import ConstraintImpactDiff from './ConstraintImpactDiff';
import WhatIfScenarioModeler from './WhatIfScenarioModeler';

interface ConstraintFormData {
    analystId?: string;
    shiftType?: 'MORNING' | 'EVENING';
    startDate: string;
    endDate: string;
    constraintType: 'BLACKOUT_DATE' | 'MAX_SCREENER_DAYS' | 'MIN_SCREENER_DAYS' | 'PREFERRED_SCREENER' | 'UNAVAILABLE_SCREENER';
    description?: string;
    isActive: boolean;
}

type TabType = 'constraints' | 'warnings' | 'risk-assessment' | 'templates' | 'events' | 'scenarios';

const ConstraintManagement: React.FC = () => {
    const [activeTab, setActiveTab] = useState<TabType>('constraints');
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
    const [showImpactDiff, setShowImpactDiff] = useState(false);
    const [pendingConstraint, setPendingConstraint] = useState<Partial<SchedulingConstraint> | null>(null);

    // Phase 2 Features State
    const [systemWarnings, setSystemWarnings] = useState<any[]>([]);
    const [warningMetrics, setWarningMetrics] = useState<any>(null);
    const [riskAssessment, setRiskAssessment] = useState<any>(null);
    const [templates, setTemplates] = useState<any[]>([]);
    const [popularTemplates, setPopularTemplates] = useState<any[]>([]);
    const [events, setEvents] = useState<any[]>([]);
    const [holidays, setHolidays] = useState<any[]>([]);

    // Real-time validation for the form
    const {
        validationState,
        isValid,
        isValidating,
        hasErrors,
        hasWarnings,
        errors,
        warnings,
        suggestions,
        estimatedImpact,
        getFieldErrors,
        getValidationSummary,
        canApplySafely
    } = useRealTimeConstraintValidation(formData, {
        operation: editingConstraint ? 'UPDATE' : 'CREATE',
        originalConstraint: editingConstraint || undefined,
        debounceMs: 500
    });

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

    // Load Phase 2 data when tabs are switched
    useEffect(() => {
        if (activeTab === 'warnings') {
            loadWarningsData();
        } else if (activeTab === 'risk-assessment') {
            loadRiskAssessmentData();
        } else if (activeTab === 'templates') {
            loadTemplatesData();
        } else if (activeTab === 'events') {
            loadEventsData();
        }
    }, [activeTab]);

    const loadWarningsData = async () => {
        try {
            const [warningsResponse, metricsResponse] = await Promise.all([
                apiService.getWarnings(),
                apiService.getWarningMetrics()
            ]);
            setSystemWarnings(warningsResponse.warnings || []);
            setWarningMetrics(metricsResponse);
        } catch (err) {
            console.error('Error loading warnings data:', err);
        }
    };

    const loadRiskAssessmentData = async () => {
        try {
            const response = await apiService.getUpcomingRisks(30);
            setRiskAssessment(response);
        } catch (err) {
            console.error('Error loading risk assessment:', err);
        }
    };

    const loadTemplatesData = async () => {
        try {
            const [templatesResponse, popularResponse] = await Promise.all([
                apiService.getTemplates(),
                apiService.getPopularTemplates(5)
            ]);
            setTemplates(templatesResponse.templates || []);
            setPopularTemplates(popularResponse.templates || []);
        } catch (err) {
            console.error('Error loading templates:', err);
        }
    };

    const loadEventsData = async () => {
        try {
            const startDate = moment().format('YYYY-MM-DD');
            const endDate = moment().add(3, 'months').format('YYYY-MM-DD');
            
            const [eventsResponse, holidaysResponse] = await Promise.all([
                apiService.getEvents(90),
                apiService.getHolidays(startDate, endDate)
            ]);
            setEvents(eventsResponse.events || []);
            setHolidays(holidaysResponse.holidays || []);
        } catch (err) {
            console.error('Error loading events:', err);
        }
    };

    const handleConstraintSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        
        // Check validation before showing impact diff
        if (hasErrors) {
            setError('Please fix validation errors before proceeding.');
            return;
        }

        // For high-impact changes, show impact diff dialog
        if (estimatedImpact && (estimatedImpact.severity === 'HIGH' || estimatedImpact.severity === 'MEDIUM')) {
            setPendingConstraint(formData);
            setShowImpactDiff(true);
            return;
        }

        // For low-impact changes, apply directly
        await applyConstraint();
    };

    const applyConstraint = async () => {
        try {
            setSubmitting(true);
            
            if (editingConstraint) {
                await apiService.updateConstraint(editingConstraint.id, formData);
                setEditingConstraint(null);
            } else {
                await apiService.createConstraint(formData);
                setShowAddForm(false);
            }
            
            // Reset form
            setFormData({ startDate: '', endDate: '', constraintType: 'BLACKOUT_DATE', isActive: true });
            
            // Refresh constraints list
            await fetchConstraints();
            
        } catch (err: any) {
            console.error('Error saving constraint:', err);
            setError(err.response?.data?.error || 'Failed to save constraint. Please try again.');
        } finally {
            setSubmitting(false);
            setShowImpactDiff(false);
            setPendingConstraint(null);
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

    const tabs = [
        { id: 'constraints', label: 'Constraints', icon: '📋' },
        { id: 'warnings', label: 'Early Warnings', icon: '⚠️', badge: systemWarnings.length || null },
        { id: 'risk-assessment', label: 'Risk Assessment', icon: '📊' },
        { id: 'templates', label: 'Templates', icon: '📚' },
        { id: 'events', label: 'Events', icon: '📅' },
        { id: 'scenarios', label: 'What-If Scenarios', icon: '🎯' },
    ];

    const resolveWarning = async (warningId: string) => {
        try {
            await apiService.resolveWarning(warningId, 'user', 'Resolved via UI');
            await loadWarningsData(); // Reload warnings
        } catch (err) {
            console.error('Error resolving warning:', err);
        }
    };

    const triggerWarningCheck = async () => {
        try {
            await apiService.performWarningCheck();
            await loadWarningsData();
        } catch (err) {
            console.error('Error triggering warning check:', err);
        }
    };

    const applyTemplate = async (templateId: string, variables: any) => {
        try {
            const result = await apiService.applyTemplate(templateId, {
                variables,
                targetDate: variables.targetDate,
                previewMode: false
            });
            
            if (result.success) {
                setError(null);
                await fetchConstraints();
                // Show success notification
                alert(`Template applied successfully! ${result.constraintsCreated} constraint(s) created.`);
            } else {
                setError(`Template application failed: ${result.errors.map((e: any) => e.error).join(', ')}`);
            }
        } catch (err) {
            console.error('Error applying template:', err);
            setError('Failed to apply template');
        }
    };

    if (loading) {
        return <div className="text-center p-8 text-muted-foreground">Loading constraints...</div>;
    }
    
    return (
        <div className="p-6 max-w-6xl mx-auto">
            <div className="mb-6">
                <h1 className="text-2xl font-bold text-foreground mb-2">Dynamic Constraint Intelligence</h1>
                <p className="text-muted-foreground">Intelligent scheduling constraint management with predictive analytics</p>
            </div>

            {/* Tab Navigation */}
            <div className="mb-6">
                <div className="border-b border-border">
                    <nav className="flex space-x-8">
                        {tabs.map((tab) => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id as TabType)}
                                className={`py-4 px-1 border-b-2 font-medium text-sm whitespace-nowrap flex items-center space-x-2 ${
                                    activeTab === tab.id
                                        ? 'border-primary text-primary'
                                        : 'border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground'
                                }`}
                            >
                                <span>{tab.icon}</span>
                                <span>{tab.label}</span>
                                {tab.badge && (
                                    <span className="ml-2 bg-red-100 text-red-800 text-xs font-medium px-2.5 py-0.5 rounded-full">
                                        {tab.badge}
                                    </span>
                                )}
                            </button>
                        ))}
                    </nav>
                </div>
            </div>

            {error && (
                <div className="mb-4 bg-destructive/10 text-destructive px-4 py-2 rounded-lg border border-destructive/20">
                    {error}
                </div>
            )}

            {/* Tab Content */}
            {activeTab === 'constraints' && (
                <div>
                    <div className="flex items-center justify-end mb-8">
                        <button onClick={() => setShowAddForm(true)} className="px-6 py-3 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90">
                            Add New Constraint
                        </button>
                    </div>

                {(showAddForm || editingConstraint) && (
                    <div className="bg-card text-card-foreground rounded-2xl p-6 shadow-sm border border-border mb-8">
                        <h2 className="text-xl font-semibold text-foreground mb-4">{editingConstraint ? 'Edit Constraint' : 'Add New Constraint'}</h2>
                        <form onSubmit={handleConstraintSubmit}>
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

                            {/* Real-time Validation Feedback */}
                            {(isValidating || hasErrors || hasWarnings || estimatedImpact) && (
                                <div className="mt-6 space-y-3">
                                    {/* Validation Status */}
                                    {isValidating && (
                                        <div className="flex items-center text-muted-foreground">
                                            <div className="animate-spin w-4 h-4 border-2 border-primary border-t-transparent rounded-full mr-2"></div>
                                            <span className="text-sm">Validating constraint...</span>
                                        </div>
                                    )}

                                    {/* Errors */}
                                    {errors.map((error, index) => (
                                        <div key={index} className="p-3 bg-red-50 border border-red-200 rounded-lg">
                                            <div className="flex items-start">
                                                <span className="text-red-500 mr-2">⚠️</span>
                                                <div>
                                                    <div className="text-sm font-medium text-red-800">{error.message}</div>
                                                    {error.field && (
                                                        <div className="text-xs text-red-600 mt-1">Field: {error.field}</div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    ))}

                                    {/* Warnings */}
                                    {warnings.map((warning, index) => (
                                        <div key={index} className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                                            <div className="flex items-start">
                                                <span className="text-yellow-500 mr-2">⚠️</span>
                                                <div>
                                                    <div className="text-sm font-medium text-yellow-800">{warning.message}</div>
                                                    <div className="text-xs text-yellow-600 mt-1">Type: {warning.type}</div>
                                                </div>
                                            </div>
                                        </div>
                                    ))}

                                    {/* Impact Estimation */}
                                    {estimatedImpact && !hasErrors && (
                                        <div className={`p-3 border rounded-lg ${
                                            estimatedImpact.severity === 'HIGH' ? 'bg-red-50 border-red-200' :
                                            estimatedImpact.severity === 'MEDIUM' ? 'bg-yellow-50 border-yellow-200' :
                                            'bg-green-50 border-green-200'
                                        }`}>
                                            <div className="flex items-center justify-between">
                                                <div>
                                                    <div className={`text-sm font-medium ${
                                                        estimatedImpact.severity === 'HIGH' ? 'text-red-800' :
                                                        estimatedImpact.severity === 'MEDIUM' ? 'text-yellow-800' :
                                                        'text-green-800'
                                                    }`}>
                                                        {estimatedImpact.severity} Impact Estimated
                                                    </div>
                                                    <div className="text-xs text-muted-foreground mt-1">
                                                        {estimatedImpact.affectedDays} days, {estimatedImpact.affectedSchedules} schedules affected
                                                    </div>
                                                </div>
                                                <span className={`px-2 py-1 rounded text-xs font-medium ${
                                                    estimatedImpact.severity === 'HIGH' ? 'bg-red-100 text-red-800' :
                                                    estimatedImpact.severity === 'MEDIUM' ? 'bg-yellow-100 text-yellow-800' :
                                                    'bg-green-100 text-green-800'
                                                }`}>
                                                    {Math.round(estimatedImpact.conflictProbability * 100)}% conflict risk
                                                </span>
                                            </div>
                                        </div>
                                    )}

                                    {/* Suggestions */}
                                    {suggestions.length > 0 && (
                                        <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                                            <div className="text-sm font-medium text-blue-800 mb-2">Suggestions:</div>
                                            <ul className="text-xs text-blue-700 space-y-1">
                                                {suggestions.map((suggestion, index) => (
                                                    <li key={index} className="flex items-start">
                                                        <span className="mr-2">•</span>
                                                        <span>{suggestion}</span>
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>
                                    )}
                                </div>
                            )}

                            <div className="flex items-center space-x-4 mt-6">
                                <button 
                                    type="submit" 
                                    disabled={submitting || hasErrors || isValidating} 
                                    className={`px-6 py-2 rounded-lg font-medium disabled:opacity-50 ${
                                        hasErrors || isValidating 
                                            ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                                            : estimatedImpact?.severity === 'HIGH'
                                            ? 'bg-red-600 hover:bg-red-700 text-white'
                                            : estimatedImpact?.severity === 'MEDIUM'
                                            ? 'bg-yellow-600 hover:bg-yellow-700 text-white'
                                            : 'bg-primary hover:bg-primary/90 text-primary-foreground'
                                    }`}
                                >
                                    {submitting ? 'Saving...' : 
                                     isValidating ? 'Validating...' :
                                     estimatedImpact?.severity === 'HIGH' ? 'Apply High-Impact Change' :
                                     estimatedImpact?.severity === 'MEDIUM' ? 'Review & Apply' :
                                     (editingConstraint ? 'Update' : 'Add')}
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
            )}

            {/* Early Warnings Tab */}
            {activeTab === 'warnings' && (
                <div className="space-y-6">
                    <div className="flex justify-between items-center">
                        <h2 className="text-xl font-semibold">Early Warning System</h2>
                        <button
                            onClick={triggerWarningCheck}
                            className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90"
                        >
                            Run Check
                        </button>
                    </div>

                    {warningMetrics && (
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                            <div className="bg-card p-4 rounded-lg border">
                                <h3 className="font-medium text-muted-foreground">Active Warnings</h3>
                                <p className="text-2xl font-bold text-foreground">{warningMetrics.activeWarnings}</p>
                            </div>
                            <div className="bg-card p-4 rounded-lg border">
                                <h3 className="font-medium text-muted-foreground">Critical</h3>
                                <p className="text-2xl font-bold text-red-600">{warningMetrics.criticalWarnings}</p>
                            </div>
                            <div className="bg-card p-4 rounded-lg border">
                                <h3 className="font-medium text-muted-foreground">Resolution Rate</h3>
                                <p className="text-2xl font-bold text-green-600">{Math.round(warningMetrics.accuracyRate * 100)}%</p>
                            </div>
                            <div className="bg-card p-4 rounded-lg border">
                                <h3 className="font-medium text-muted-foreground">Avg Resolution Time</h3>
                                <p className="text-2xl font-bold text-blue-600">{Math.round(warningMetrics.averageResolutionTime)}h</p>
                            </div>
                        </div>
                    )}

                    <div className="bg-card rounded-lg border">
                        <div className="p-4 border-b">
                            <h3 className="font-semibold">Active Warnings ({systemWarnings.length})</h3>
                        </div>
                        <div className="divide-y">
                            {systemWarnings.length === 0 ? (
                                <div className="p-8 text-center text-muted-foreground">
                                    No active warnings 🎉
                                </div>
                            ) : (
                                systemWarnings.map((warning) => (
                                    <div key={warning.id} className="p-4">
                                        <div className="flex justify-between items-start">
                                            <div>
                                                <div className="flex items-center space-x-2">
                                                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                                                        warning.severity === 'CRITICAL' ? 'bg-red-100 text-red-800' :
                                                        warning.severity === 'HIGH' ? 'bg-orange-100 text-orange-800' :
                                                        warning.severity === 'MEDIUM' ? 'bg-yellow-100 text-yellow-800' :
                                                        'bg-blue-100 text-blue-800'
                                                    }`}>
                                                        {warning.severity}
                                                    </span>
                                                    <span className="text-sm font-medium">{warning.title}</span>
                                                </div>
                                                <p className="text-sm text-muted-foreground mt-1">{warning.description}</p>
                                                <div className="text-xs text-muted-foreground mt-2">
                                                    Days until impact: {warning.timeframe.daysUntilImpact} | 
                                                    Confidence: {Math.round(warning.timeframe.confidenceLevel * 100)}%
                                                </div>
                                            </div>
                                            <button
                                                onClick={() => resolveWarning(warning.id)}
                                                className="px-3 py-1 text-sm bg-green-100 text-green-800 rounded hover:bg-green-200"
                                            >
                                                Resolve
                                            </button>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Risk Assessment Tab */}
            {activeTab === 'risk-assessment' && (
                <div className="space-y-6">
                    <h2 className="text-xl font-semibold">Risk Assessment</h2>
                    
                    {riskAssessment && (
                        <div>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                                <div className="bg-card p-4 rounded-lg border">
                                    <h3 className="font-medium text-muted-foreground">Average Risk</h3>
                                    <p className="text-2xl font-bold text-foreground">
                                        {Math.round(riskAssessment.averageRisk * 100)}%
                                    </p>
                                </div>
                                <div className="bg-card p-4 rounded-lg border">
                                    <h3 className="font-medium text-muted-foreground">High Risk Days</h3>
                                    <p className="text-2xl font-bold text-orange-600">{riskAssessment.highRiskDays}</p>
                                </div>
                                <div className="bg-card p-4 rounded-lg border">
                                    <h3 className="font-medium text-muted-foreground">Critical Risk Days</h3>
                                    <p className="text-2xl font-bold text-red-600">{riskAssessment.criticalRiskDays}</p>
                                </div>
                            </div>

                            <div className="bg-card rounded-lg border">
                                <div className="p-4 border-b">
                                    <h3 className="font-semibold">Risk Distribution</h3>
                                </div>
                                <div className="p-4 space-y-3">
                                    {Object.entries(riskAssessment.riskDistribution).map(([level, percentage]) => (
                                        <div key={level} className="flex items-center justify-between">
                                            <span className="capitalize text-sm">{level.replace('_', ' ')} Risk</span>
                                            <div className="flex items-center space-x-2">
                                                <div className="w-32 bg-gray-200 rounded-full h-2">
                                                    <div 
                                                        className={`h-2 rounded-full ${
                                                            level === 'critical' ? 'bg-red-500' :
                                                            level === 'high' ? 'bg-orange-500' :
                                                            level === 'medium' ? 'bg-yellow-500' :
                                                            level === 'low' ? 'bg-blue-500' :
                                                            'bg-green-500'
                                                        }`}
                                                        style={{ width: `${(percentage as number) * 100}%` }}
                                                    ></div>
                                                </div>
                                                <span className="text-sm font-medium">{Math.round((percentage as number) * 100)}%</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Templates Tab */}
            {activeTab === 'templates' && (
                <div className="space-y-6">
                    <h2 className="text-xl font-semibold">Constraint Templates</h2>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="bg-card rounded-lg border">
                            <div className="p-4 border-b">
                                <h3 className="font-semibold">Popular Templates</h3>
                            </div>
                            <div className="divide-y">
                                {popularTemplates.map((template) => (
                                    <div key={template.id} className="p-4">
                                        <div className="flex justify-between items-start">
                                            <div>
                                                <h4 className="font-medium">{template.name}</h4>
                                                <p className="text-sm text-muted-foreground">{template.description}</p>
                                                <div className="flex items-center space-x-4 mt-2 text-xs text-muted-foreground">
                                                    <span>⭐ {template.rating}/5</span>
                                                    <span>📈 {template.popularity}% usage</span>
                                                    <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded">
                                                        {template.category}
                                                    </span>
                                                </div>
                                            </div>
                                            <button
                                                onClick={() => {
                                                    const targetDate = prompt('Enter target date (YYYY-MM-DD):');
                                                    if (targetDate) {
                                                        applyTemplate(template.id, { targetDate });
                                                    }
                                                }}
                                                className="px-3 py-1 text-sm bg-primary text-white rounded hover:bg-primary/90"
                                            >
                                                Apply
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="bg-card rounded-lg border">
                            <div className="p-4 border-b">
                                <h3 className="font-semibold">All Templates ({templates.length})</h3>
                            </div>
                            <div className="divide-y max-h-96 overflow-y-auto">
                                {templates.map((template) => (
                                    <div key={template.id} className="p-3">
                                        <div className="flex justify-between items-center">
                                            <div>
                                                <h4 className="text-sm font-medium">{template.name}</h4>
                                                <div className="flex items-center space-x-2 mt-1">
                                                    <span className="text-xs px-2 py-1 bg-gray-100 rounded">
                                                        {template.category}
                                                    </span>
                                                    <span className="text-xs text-muted-foreground">
                                                        ⭐ {template.rating}/5
                                                    </span>
                                                </div>
                                            </div>
                                            <button
                                                onClick={() => {
                                                    const targetDate = prompt('Enter target date (YYYY-MM-DD):');
                                                    if (targetDate) {
                                                        applyTemplate(template.id, { targetDate });
                                                    }
                                                }}
                                                className="px-2 py-1 text-xs bg-primary text-white rounded hover:bg-primary/90"
                                            >
                                                Apply
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Events Tab */}
            {activeTab === 'events' && (
                <div className="space-y-6">
                    <h2 className="text-xl font-semibold">Event Management</h2>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="bg-card rounded-lg border">
                            <div className="p-4 border-b">
                                <h3 className="font-semibold">Upcoming Events ({events.length})</h3>
                            </div>
                            <div className="divide-y max-h-96 overflow-y-auto">
                                {events.map((event) => (
                                    <div key={event.id} className="p-4">
                                        <div className="flex justify-between items-start">
                                            <div>
                                                <h4 className="font-medium">{event.name}</h4>
                                                <p className="text-sm text-muted-foreground">
                                                    {moment(event.date).format('MMM DD, YYYY')}
                                                </p>
                                                <span className={`inline-block px-2 py-1 text-xs font-medium rounded-full mt-1 ${
                                                    event.status === 'PENDING' ? 'bg-yellow-100 text-yellow-800' :
                                                    event.status === 'ACTIVE' ? 'bg-green-100 text-green-800' :
                                                    'bg-gray-100 text-gray-800'
                                                }`}>
                                                    {event.status}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="bg-card rounded-lg border">
                            <div className="p-4 border-b">
                                <h3 className="font-semibold">Holidays ({holidays.length})</h3>
                            </div>
                            <div className="divide-y max-h-96 overflow-y-auto">
                                {holidays.map((holiday, index) => (
                                    <div key={index} className="p-3">
                                        <div className="flex justify-between items-center">
                                            <div>
                                                <h4 className="text-sm font-medium">{holiday.name}</h4>
                                                <p className="text-xs text-muted-foreground">
                                                    {moment(holiday.date).format('MMM DD, YYYY')}
                                                </p>
                                            </div>
                                            <span className="text-xs px-2 py-1 bg-blue-100 text-blue-800 rounded">
                                                {holiday.type}
                                            </span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* What-If Scenarios Tab */}
            {activeTab === 'scenarios' && (
                <WhatIfScenarioModeler />
            )}

            {/* Constraint Impact Diff Dialog */}
            {pendingConstraint && (
                <ConstraintImpactDiff
                    constraint={pendingConstraint}
                    operation={editingConstraint ? 'UPDATE' : 'CREATE'}
                    originalConstraint={editingConstraint || undefined}
                    isOpen={showImpactDiff}
                    onClose={() => {
                        setShowImpactDiff(false);
                        setPendingConstraint(null);
                    }}
                    onApprove={applyConstraint}
                    onReject={() => {
                        setShowImpactDiff(false);
                        setPendingConstraint(null);
                    }}
                />
            )}
        </div>
    );
};

export default ConstraintManagement; 