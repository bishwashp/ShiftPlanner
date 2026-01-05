import React, { useState, useEffect } from 'react';
import { Calendar, Check, Warning, Info } from '@phosphor-icons/react';
import { constraintService } from '../../services/constraintService';
import Button from '../ui/Button';

interface HolidayConstraintConfigProps {
    onClose?: () => void;
}

interface HolidayConfig {
    staffingCount: number | null;
    screenerCount: number | null;
    skipScreener: boolean;
    skipConsecutive: boolean;
    isActive: boolean;
    isDefault?: boolean;
}

const HolidayConstraintConfig: React.FC<HolidayConstraintConfigProps> = ({ onClose }) => {
    const [config, setConfig] = useState<HolidayConfig>({
        staffingCount: null,
        screenerCount: null,
        skipScreener: false,
        skipConsecutive: false,
        isActive: true
    });
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);

    useEffect(() => {
        fetchConfig();
    }, []);

    const fetchConfig = async () => {
        try {
            setLoading(true);
            const data = await constraintService.getHolidayConstraintConfig();
            setConfig(data);
        } catch (err) {
            console.error('Failed to fetch holiday constraint config:', err);
            setError('Failed to load configuration');
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        try {
            setSaving(true);
            setError(null);
            setSuccess(false);

            await constraintService.updateHolidayConstraintConfig({
                staffingCount: config.staffingCount,
                screenerCount: config.screenerCount,
                skipScreener: config.skipScreener,
                skipConsecutive: config.skipConsecutive
            });

            setSuccess(true);
            setTimeout(() => setSuccess(false), 3000);
        } catch (err) {
            console.error('Failed to save holiday constraint config:', err);
            setError('Failed to save configuration');
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="p-6 text-center">
                <div className="animate-spin w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full mx-auto"></div>
                <p className="mt-2 text-gray-500">Loading configuration...</p>
            </div>
        );
    }

    return (
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
            {/* Header */}
            <div className="p-6 border-b border-gray-200 dark:border-gray-700 flex items-center space-x-3">
                <div className="w-10 h-10 bg-amber-100 dark:bg-amber-900/30 rounded-lg flex items-center justify-center">
                    <Calendar className="w-5 h-5 text-amber-600" />
                </div>
                <div>
                    <h2 className="text-lg font-semibold text-foreground">Holiday Constraint</h2>
                    <p className="text-sm text-gray-500">Global configuration for all holidays</p>
                </div>
            </div>

            {/* Info Banner */}
            <div className="mx-6 mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg flex items-start space-x-3">
                <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-blue-800 dark:text-blue-200">
                    This configuration applies to <strong>all holidays</strong> defined in the system.
                    For specific date overrides, create a Special Event instead.
                </p>
            </div>

            {/* Form */}
            <div className="p-6 space-y-6">
                {error && (
                    <div className="p-3 bg-red-50 text-red-700 rounded-lg text-sm flex items-center">
                        <Warning className="w-4 h-4 mr-2" />
                        {error}
                    </div>
                )}

                {success && (
                    <div className="p-3 bg-green-50 text-green-700 rounded-lg text-sm flex items-center">
                        <Check className="w-4 h-4 mr-2" />
                        Configuration saved successfully!
                    </div>
                )}

                {/* Staffing Count */}
                <div>
                    <label className="block text-sm font-medium mb-2">Staffing Count</label>
                    <input
                        type="number"
                        min="0"
                        placeholder="Leave empty for default"
                        className="w-full input bg-input border-border"
                        value={config.staffingCount ?? ''}
                        onChange={e => setConfig({
                            ...config,
                            staffingCount: e.target.value ? parseInt(e.target.value) : null
                        })}
                    />
                    <p className="text-xs text-gray-500 mt-1">Number of analysts required on holidays</p>
                </div>

                {/* Screener Count */}
                <div>
                    <label className="block text-sm font-medium mb-2">Screener Count</label>
                    <input
                        type="number"
                        min="0"
                        placeholder="Leave empty for default"
                        className="w-full input bg-input border-border"
                        value={config.screenerCount ?? ''}
                        onChange={e => setConfig({
                            ...config,
                            screenerCount: e.target.value ? parseInt(e.target.value) : null
                        })}
                    />
                    <p className="text-xs text-gray-500 mt-1">Number of screeners required on holidays</p>
                </div>

                {/* Checkboxes */}
                <div className="space-y-3">
                    <label className="flex items-center space-x-3 cursor-pointer">
                        <input
                            type="checkbox"
                            checked={config.skipScreener}
                            onChange={e => setConfig({ ...config, skipScreener: e.target.checked })}
                            className="w-4 h-4 rounded border-gray-300"
                        />
                        <span className="text-sm">Skip screener requirement on holidays</span>
                    </label>

                    <label className="flex items-center space-x-3 cursor-pointer">
                        <input
                            type="checkbox"
                            checked={config.skipConsecutive}
                            onChange={e => setConfig({ ...config, skipConsecutive: e.target.checked })}
                            className="w-4 h-4 rounded border-gray-300"
                        />
                        <span className="text-sm">Skip consecutive day checks on holidays</span>
                    </label>
                </div>
            </div>

            {/* Footer */}
            <div className="p-6 border-t border-gray-200 dark:border-gray-700 flex justify-end space-x-3">
                {onClose && (
                    <Button variant="secondary" onClick={onClose}>
                        Cancel
                    </Button>
                )}
                <Button variant="primary" onClick={handleSave} disabled={saving}>
                    {saving ? 'Saving...' : 'Save Configuration'}
                </Button>
            </div>
        </div>
    );
};

export default HolidayConstraintConfig;
