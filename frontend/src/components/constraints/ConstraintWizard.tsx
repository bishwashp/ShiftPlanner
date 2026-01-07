import React, { useState, useEffect } from 'react';
import { CaretRight, Warning, Check, X, Plus } from '@phosphor-icons/react';
import SpringDropdown from '../ui/SpringDropdown';
import { SchedulingConstraint, Analyst, apiService } from '../../services/api';
import { constraintService, ImpactPreview } from '../../services/constraintService';
import Button from '../ui/Button';
import Checkbox from '../ui/Checkbox';
import ImpactPreviewComponent from './ImpactPreview';

interface ConstraintWizardProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
}

const steps = ['Type', 'Details', 'Impact', 'Confirm'];

const ConstraintWizard: React.FC<ConstraintWizardProps> = ({ isOpen, onClose, onSuccess }) => {
    const [currentStep, setCurrentStep] = useState(0);
    const [templates, setTemplates] = useState<any[]>([]);
    const [analysts, setAnalysts] = useState<Analyst[]>([]);
    const [impactAssessment, setImpactAssessment] = useState<ImpactPreview | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    interface ConstraintFormData extends Partial<SchedulingConstraint> {
        templateId?: string;
        templateParams?: any;
    }

    const [selectedTemplate, setSelectedTemplate] = useState<any>(null);

    const [formData, setFormData] = useState<ConstraintFormData>({
        constraintType: 'BLACKOUT_DATE' as any,
        isActive: true,
        startDate: new Date().toISOString().split('T')[0],
        endDate: new Date().toISOString().split('T')[0],
        templateParams: {}
    });

    useEffect(() => {
        if (isOpen) {
            fetchTemplates();
            fetchAnalysts();
            setCurrentStep(0);
            setImpactAssessment(null);
            setError(null);
        }
    }, [isOpen]);

    const fetchTemplates = async () => {
        try {
            const t = await constraintService.getTemplates();
            setTemplates(t);
        } catch (err) {
            console.error('Failed to fetch templates', err);
        }
    };

    const fetchAnalysts = async () => {
        try {
            const result = await apiService.getAnalysts();
            setAnalysts(result);
        } catch (err) {
            console.error('Failed to fetch analysts', err);
        }
    };

    const getSubmissionData = () => {
        const data = { ...formData };
        if ((data.constraintType as any) === 'TEMPLATE' && selectedTemplate) {
            data.constraintType = selectedTemplate.name;
        }
        return data;
    };

    const handleNext = async () => {
        setError(null);
        if (currentStep === 1) {
            // Assess Impact
            setLoading(true);
            try {
                const assessment = await constraintService.previewImpact(getSubmissionData());
                setImpactAssessment(assessment);
                setCurrentStep(2);
            } catch (err: any) {
                setError('Failed to assess impact.');
            } finally {
                setLoading(false);
            }
        } else if (currentStep === 2) {
            setCurrentStep(3);
        } else {
            setCurrentStep(prev => prev + 1);
        }
    };

    const handleConfirm = async () => {
        setLoading(true);
        try {
            await constraintService.createWithPreview(getSubmissionData());
            onSuccess();
            onClose();
        } catch (err: any) {
            setError(err.response?.data?.message || 'Failed to create constraint.');
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl shadow-2xl max-w-2xl w-full flex flex-col max-h-[90vh]">
                {/* Header */}
                <div className="p-6 border-b border-gray-200 dark:border-gray-800 flex justify-between items-center">
                    <h2 className="text-xl font-semibold text-foreground">New Constraint</h2>
                    <button onClick={onClose}><X className="w-5 h-5 text-gray-500" /></button>
                </div>

                {/* Progress */}
                <div className="px-6 py-4 bg-gray-50 dark:bg-gray-800/50">
                    <div className="flex items-center space-x-2">
                        {steps.map((step, idx) => (
                            <div key={step} className={`flex items-center ${idx < steps.length - 1 ? 'flex-1' : ''}`}>
                                <div className={`flex items-center space-x-2 ${idx <= currentStep ? 'text-blue-600 dark:text-blue-400' : 'text-gray-400'}`}>
                                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs border ${idx <= currentStep ? 'border-blue-600 bg-blue-50 dark:bg-blue-900/20' : 'border-gray-300'}`}>
                                        {idx + 1}
                                    </div>
                                    <span className="text-sm font-medium">{step}</span>
                                </div>
                                {idx < steps.length - 1 && <div className={`h-px w-full mx-2 ${idx < currentStep ? 'bg-blue-600' : 'bg-gray-200'}`} />}
                            </div>
                        ))}
                    </div>
                </div>

                {/* Content */}
                <div className="p-6 flex-1 overflow-y-auto">
                    {error && (
                        <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-lg text-sm flex items-center">
                            <Warning className="w-4 h-4 mr-2" />
                            {error}
                        </div>
                    )}

                    {currentStep === 0 && (
                        <div className="space-y-4">
                            <label className="block text-sm font-medium mb-2">Constraint Type</label>
                            <SpringDropdown
                                value={formData.constraintType as string}
                                onChange={(val) => setFormData({ ...formData, constraintType: val as any })}
                                options={[
                                    { value: "BLACKOUT_DATE", label: "Blackout Date" },
                                    { value: "PREFERRED_SCREENER", label: "Preferred Screener" },
                                    { value: "UNAVAILABLE_SCREENER", label: "Unavailable for Screener" },
                                    { value: "TEMPLATE", label: `Add a Template Constraint ${templates.length > 0 ? `(${templates.length} Available)` : ''}` }
                                ]}
                            />
                        </div>
                    )}

                    {currentStep === 1 && (
                        <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium mb-1">Start Date</label>
                                    <input
                                        type="date"
                                        className="w-full input bg-input border-border"
                                        value={formData.startDate}
                                        onChange={e => setFormData({ ...formData, startDate: e.target.value })}
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium mb-1">End Date</label>
                                    <input
                                        type="date"
                                        className="w-full input bg-input border-border"
                                        value={formData.endDate}
                                        onChange={e => setFormData({ ...formData, endDate: e.target.value })}
                                        required
                                    />
                                </div>
                            </div>

                            {(formData.constraintType === 'PREFERRED_SCREENER' || formData.constraintType === 'UNAVAILABLE_SCREENER') && (
                                <div>
                                    <label className="block text-sm font-medium mb-1">Analyst</label>
                                    {/* Placeholder for analyst select - in real app would use a combo box */}
                                    {/* Placeholder for analyst select - in real app would use a combo box */}
                                    <SpringDropdown
                                        value={formData.analystId || ''}
                                        onChange={(val) => setFormData({ ...formData, analystId: val })}
                                        options={analysts.map(a => ({ value: a.id, label: a.name }))}
                                        placeholder="-- Select Analyst --"
                                    />
                                </div>
                            )}

                            {(formData.constraintType as any) === 'TEMPLATE' && (
                                <div className="space-y-4 border-t border-gray-200 dark:border-gray-700 pt-4 mt-4">
                                    <div>
                                        <label className="block text-sm font-medium mb-1">Select Template</label>
                                        <SpringDropdown
                                            value={formData.templateId || ''}
                                            onChange={(val) => {
                                                const tmpl = templates.find(t => t.id === val);
                                                setSelectedTemplate(tmpl);
                                                setFormData({
                                                    ...formData,
                                                    templateId: val,
                                                    description: tmpl?.description || '',
                                                    templateParams: {} // Reset params on template change
                                                });
                                            }}
                                            options={templates.map(t => ({ value: t.id, label: t.name.replace(/_/g, ' ') }))}
                                            placeholder="-- Select a Rule Template --"
                                        />
                                    </div>

                                    {selectedTemplate && selectedTemplate.parsedParameters && (
                                        <div className="bg-gray-50 dark:bg-gray-800/30 p-4 rounded-lg space-y-3">
                                            <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Configuration Parameters</h4>
                                            {selectedTemplate.parsedParameters.map((param: any) => (
                                                <div key={param.name}>
                                                    <label className="block text-xs font-medium mb-1 uppercase text-gray-500">
                                                        {param.name} {param.required && <span className="text-red-500">*</span>}
                                                    </label>
                                                    {param.type === 'number' ? (
                                                        <input
                                                            type="number"
                                                            className="w-full input bg-input border-border"
                                                            value={formData.templateParams?.[param.name] || ''}
                                                            onChange={e => setFormData({
                                                                ...formData,
                                                                templateParams: {
                                                                    ...formData.templateParams,
                                                                    [param.name]: parseFloat(e.target.value)
                                                                }
                                                            })}
                                                        />
                                                    ) : param.type === 'analystId' ? (
                                                        <SpringDropdown
                                                            value={formData.templateParams?.[param.name] || ''}
                                                            onChange={(val) => setFormData({
                                                                ...formData,
                                                                templateParams: {
                                                                    ...formData.templateParams,
                                                                    [param.name]: val
                                                                }
                                                            })}
                                                            options={analysts.map(a => ({ value: a.id, label: a.name }))}
                                                            placeholder="-- Select Analyst --"
                                                        />
                                                    ) : (
                                                        <input
                                                            type="text"
                                                            className="w-full input bg-input border-border"
                                                            value={formData.templateParams?.[param.name] || ''}
                                                            onChange={e => setFormData({
                                                                ...formData,
                                                                templateParams: {
                                                                    ...formData.templateParams,
                                                                    [param.name]: e.target.value
                                                                }
                                                            })}
                                                        />
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}

                            <div>
                                <label className="block text-sm font-medium mb-1">Description</label>
                                <textarea
                                    className="w-full input bg-input border-border"
                                    rows={3}
                                    value={formData.description || ''}
                                    onChange={e => setFormData({ ...formData, description: e.target.value })}
                                    placeholder="Explain why this constraint is being added..."
                                />
                            </div>
                        </div>
                    )}

                    {currentStep === 2 && impactAssessment && (
                        <ImpactPreviewComponent preview={impactAssessment} />
                    )}

                    {currentStep === 3 && (
                        <div className="text-center py-8">
                            <div className="w-16 h-16 bg-blue-50 dark:bg-blue-900/20 rounded-full flex items-center justify-center mx-auto mb-4">
                                <Check className="w-8 h-8 text-blue-600" />
                            </div>
                            <h3 className="text-lg font-medium mb-2">Ready to Create</h3>
                            <p className="text-gray-500">
                                This constraint will be applied immediately.
                                {impactAssessment && impactAssessment.affectedSchedules.length > 0 && ` Recalculation will affect ${impactAssessment.affectedSchedules.length} schedules.`}
                            </p>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-6 border-t border-gray-200 dark:border-gray-800 flex justify-end space-x-3">
                    {currentStep > 0 && (
                        <Button variant="secondary" onClick={() => setCurrentStep(prev => prev - 1)}>
                            Back
                        </Button>
                    )}
                    {currentStep < 3 ? (
                        <Button variant="primary" onClick={handleNext} disabled={loading}>
                            {loading ? 'Processing...' : 'Next'} <CaretRight className="ml-2 w-4 h-4" />
                        </Button>
                    ) : (
                        <Button variant="primary" onClick={handleConfirm} disabled={loading}>
                            {loading ? 'Creating...' : 'Confirm & Create'}
                        </Button>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ConstraintWizard;
