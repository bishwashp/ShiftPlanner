import React from 'react';
import { Warning, CheckCircle, Info } from '@phosphor-icons/react';
import { ImpactPreview } from '../../services/constraintService';

interface ImpactPreviewProps {
    preview: ImpactPreview;
}

const ImpactPreviewComponent: React.FC<ImpactPreviewProps> = ({ preview }) => {
    const getSeverityColor = (severity: string) => {
        switch (severity) {
            case 'CRITICAL': return 'text-red-600 bg-red-50 dark:bg-red-900/20 border-red-200';
            case 'HIGH': return 'text-orange-600 bg-orange-50 dark:bg-orange-900/20 border-orange-200';
            case 'MEDIUM': return 'text-yellow-600 bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200';
            default: return 'text-blue-600 bg-blue-50 dark:bg-blue-900/20 border-blue-200';
        }
    };

    return (
        <div className="space-y-6">
            <div className={`p-4 rounded-lg border ${getSeverityColor(preview.severity)} flex items-start`}>
                <Warning className="w-5 h-5 mt-0.5 mr-3 flex-shrink-0" />
                <div>
                    <h4 className="font-semibold text-sm uppercase tracking-wide mb-1">
                        Impact Level: {preview.severity}
                    </h4>
                    <p className="text-sm opacity-90">
                        {preview.affectedSchedules.length} schedules will require recalculation.
                    </p>
                </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
                    <div className="text-sm text-gray-500 mb-1">Fairness Score (Before)</div>
                    <div className="text-lg font-mono">{preview.fairnessDelta.before.toFixed(3)}</div>
                </div>
                <div className="p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
                    <div className="text-sm text-gray-500 mb-1">Fairness Score (After)</div>
                    <div className={`text-lg font-mono ${preview.fairnessDelta.after < preview.fairnessDelta.before ? 'text-red-500' : 'text-green-500'}`}>
                        {preview.fairnessDelta.after.toFixed(3)}
                    </div>
                </div>
            </div>

            {preview.alternatives.length > 0 && (
                <div>
                    <h4 className="font-medium mb-3 flex items-center">
                        <Info className="w-4 h-4 mr-2 text-blue-500" />
                        Recommendations / Alternatives
                    </h4>
                    <ul className="space-y-2">
                        {preview.alternatives.map((alt, i) => (
                            <li key={i} className="text-sm flex items-start text-gray-600 dark:text-gray-300">
                                <span className="w-1.5 h-1.5 rounded-full bg-blue-400 mt-1.5 mr-2 flex-shrink-0" />
                                <span className="font-medium mr-2">[{alt.type}]</span> {alt.description}
                            </li>
                        ))}
                    </ul>
                </div>
            )}
        </div>
    );
};

export default ImpactPreviewComponent;
