import React, { useState, useEffect } from 'react';
import { Lightning, Check, Warning, Info } from '@phosphor-icons/react';
import { constraintService, ImpactPreview } from '../../services/constraintService';
import Button from '../ui/Button';

interface SpecialEventFormProps {
    template?: any;
    onClose: () => void;
    onSuccess: () => void;
}

const SpecialEventForm: React.FC<SpecialEventFormProps> = ({ template, onClose, onSuccess }) => {
    const [formData, setFormData] = useState({
        name: template?.name || '',
        startDate: '',
        endDate: '',
        constraintType: template?.constraintType || 'SPECIAL_EVENT',
        skipContinuity: template?.skipContinuity || false,
        skipConflictCheck: template?.skipConflictCheck || false,
        grantCompOff: template?.grantsCompOff || false,
        description: template?.description || '',
        saveAsTemplate: false
    });
    const [step, setStep] = useState<'form' | 'preview' | 'confirm'>('form');
    const [preview, setPreview] = useState<ImpactPreview | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handlePreview = async () => {
        if (!formData.name || !formData.startDate || !formData.endDate) {
            setError('Name, start date, and end date are required');
            return;
        }

        try {
            setLoading(true);
            setError(null);
            // Only preview impact, don't create yet
            const result = await constraintService.previewImpact({
                constraintType: formData.constraintType,
                startDate: formData.startDate,
                endDate: formData.endDate
            });
            setPreview(result);
            setStep('preview');
        } catch (err: any) {
            setError(err.response?.data?.message || 'Failed to preview impact');
        } finally {
            setLoading(false);
        }
    };

    const handleConfirm = async () => {
        try {
            setLoading(true);
            setError(null);
            await constraintService.createSpecialEvent(formData);
            onSuccess();
        } catch (err: any) {
            setError(err.response?.data?.message || 'Failed to create special event');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
            {/* Header */}
            <div className="p-6 border-b border-gray-200 dark:border-gray-700 flex items-center space-x-3">
                <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center">
                    <Lightning className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                    <h2 className="text-lg font-semibold text-foreground">
                        {template ? `Apply: ${template.displayName || template.name}` : 'Create Special Event'}
                    </h2>
                    <p className="text-sm text-gray-500">
                        {step === 'form' ? 'Configure event details' : step === 'preview' ? 'Review impact' : 'Confirm creation'}
                    </p>
                </div>
            </div>

            {/* Form Step */}
            {step === 'form' && (
                <div className="p-6 space-y-6">
                    {error && (
                        <div className="p-3 bg-red-50 text-red-700 rounded-lg text-sm flex items-center">
                            <Warning className="w-4 h-4 mr-2" />
                            {error}
                        </div>
                    )}

                    {/* Name */}
                    <div>
                        <label className="block text-sm font-medium mb-2">Event Name *</label>
                        <input
                            type="text"
                            className="w-full input bg-input border-border"
                            placeholder="e.g., Q1 Product Launch"
                            value={formData.name}
                            onChange={e => setFormData({ ...formData, name: e.target.value })}
                        />
                    </div>

                    {/* Date Range */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium mb-2">Start Date *</label>
                            <input
                                type="date"
                                className="w-full input bg-input border-border"
                                value={formData.startDate}
                                onChange={e => setFormData({ ...formData, startDate: e.target.value })}
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium mb-2">End Date *</label>
                            <input
                                type="date"
                                className="w-full input bg-input border-border"
                                value={formData.endDate}
                                onChange={e => setFormData({ ...formData, endDate: e.target.value })}
                            />
                        </div>
                    </div>

                    {/* Description */}
                    <div>
                        <label className="block text-sm font-medium mb-2">Description</label>
                        <textarea
                            className="w-full input bg-input border-border"
                            rows={2}
                            placeholder="Optional description..."
                            value={formData.description}
                            onChange={e => setFormData({ ...formData, description: e.target.value })}
                        />
                    </div>

                    {/* Options */}
                    <div className="space-y-3 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
                        <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">Rule Overrides</h4>

                        <label className="flex items-center space-x-3 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={formData.skipContinuity}
                                onChange={e => setFormData({ ...formData, skipContinuity: e.target.checked })}
                                className="w-4 h-4 rounded border-gray-300"
                            />
                            <span className="text-sm">Skip continuity checks</span>
                        </label>

                        <label className="flex items-center space-x-3 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={formData.skipConflictCheck}
                                onChange={e => setFormData({ ...formData, skipConflictCheck: e.target.checked })}
                                className="w-4 h-4 rounded border-gray-300"
                            />
                            <span className="text-sm">Skip conflict checks</span>
                        </label>

                        <label className="flex items-center space-x-3 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={formData.grantCompOff}
                                onChange={e => setFormData({ ...formData, grantCompOff: e.target.checked })}
                                className="w-4 h-4 rounded border-gray-300"
                            />
                            <span className="text-sm">Grant comp-off to assigned analysts</span>
                        </label>
                    </div>

                    {/* Save as Template */}
                    <label className="flex items-center space-x-3 cursor-pointer">
                        <input
                            type="checkbox"
                            checked={formData.saveAsTemplate}
                            onChange={e => setFormData({ ...formData, saveAsTemplate: e.target.checked })}
                            className="w-4 h-4 rounded border-gray-300"
                        />
                        <span className="text-sm font-medium">Save as template for future use</span>
                    </label>
                </div>
            )}

            {/* Preview Step */}
            {step === 'preview' && preview && (
                <div className="p-6 space-y-4">
                    <div className={`p-4 rounded-lg ${preview.severity === 'LOW' ? 'bg-green-50 text-green-800' :
                        preview.severity === 'MEDIUM' ? 'bg-yellow-50 text-yellow-800' :
                            preview.severity === 'HIGH' ? 'bg-orange-50 text-orange-800' :
                                'bg-red-50 text-red-800'
                        }`}>
                        <p className="font-medium">Impact: {preview.severity}</p>
                        <p className="text-sm mt-1">{preview.summary}</p>
                    </div>

                    {preview.affectedSchedules.length > 0 && (
                        <div>
                            <h4 className="text-sm font-medium mb-2">Affected Schedules ({preview.affectedSchedules.length})</h4>
                            <div className="max-h-40 overflow-y-auto space-y-1">
                                {preview.affectedSchedules.slice(0, 5).map((s, i) => (
                                    <div key={i} className="text-sm p-2 bg-gray-50 dark:bg-gray-800 rounded">
                                        {s.analystName} - {s.date} ({s.action})
                                    </div>
                                ))}
                                {preview.affectedSchedules.length > 5 && (
                                    <p className="text-sm text-gray-500">...and {preview.affectedSchedules.length - 5} more</p>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Confirm Step */}
            {step === 'confirm' && (
                <div className="p-6 text-center">
                    <div className="w-16 h-16 bg-blue-50 dark:bg-blue-900/20 rounded-full flex items-center justify-center mx-auto mb-4">
                        <Check className="w-8 h-8 text-blue-600" />
                    </div>
                    <h3 className="text-lg font-medium mb-2">Ready to Create</h3>
                    <p className="text-gray-500">
                        This special event will be created and schedules will be auto-recalculated.
                    </p>
                </div>
            )}

            {/* Footer */}
            <div className="p-6 border-t border-gray-200 dark:border-gray-700 flex justify-end space-x-3">
                {step === 'form' && (
                    <>
                        <Button variant="secondary" onClick={onClose}>Cancel</Button>
                        <Button variant="primary" onClick={handlePreview} disabled={loading}>
                            {loading ? 'Processing...' : 'Preview Impact'}
                        </Button>
                    </>
                )}
                {step === 'preview' && (
                    <>
                        <Button variant="secondary" onClick={() => setStep('form')}>Back</Button>
                        <Button variant="primary" onClick={() => setStep('confirm')}>
                            Continue
                        </Button>
                    </>
                )}
                {step === 'confirm' && (
                    <>
                        <Button variant="secondary" onClick={() => setStep('preview')}>Back</Button>
                        <Button variant="primary" onClick={handleConfirm} disabled={loading}>
                            {loading ? 'Creating...' : 'Confirm & Create'}
                        </Button>
                    </>
                )}
            </div>
        </div>
    );
};

export default SpecialEventForm;
