import React from 'react';
import {
    ExclamationTriangleIcon,
    CheckCircleIcon,
    UserGroupIcon,
    ArrowPathIcon
} from '@heroicons/react/24/outline';

interface ReplacementPlanItem {
    date: string;
    shiftType: string;
    originalAnalystId: string;
    replacementAnalystId?: string;
    replacementAnalystName?: string;
    confidence: number;
    concerns: string[];
}

interface AbsenceImpactReportData {
    teamAvailability: number;
    coverageRisk: 'AUTO' | 'MANUAL' | 'IMPOSSIBLE';
    fairnessImpact: number;
    rotationDisruption: boolean;
    concurrentAbsences: number;
    replacementPlan: ReplacementPlanItem[];
    recommendation: 'APPROVE' | 'APPROVE_WITH_CONDITIONS' | 'SUGGEST_RESCHEDULE' | 'DENY';
    concerns: string[];
}

interface AbsenceImpactReportProps {
    report: AbsenceImpactReportData;
    isLoading?: boolean;
}

export const AbsenceImpactReport: React.FC<AbsenceImpactReportProps> = ({ report, isLoading }) => {
    if (isLoading) {
        return <div className="animate-pulse h-64 bg-gray-800/50 rounded-xl" />;
    }

    const getRiskColor = (risk: string) => {
        switch (risk) {
            case 'AUTO': return 'text-green-400';
            case 'MANUAL': return 'text-yellow-400';
            case 'IMPOSSIBLE': return 'text-red-400';
            default: return 'text-gray-400';
        }
    };

    const getRecommendationColor = (rec: string) => {
        switch (rec) {
            case 'APPROVE': return 'bg-green-500/20 text-green-400 border-green-500/30';
            case 'APPROVE_WITH_CONDITIONS': return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
            case 'SUGGEST_RESCHEDULE': return 'bg-orange-500/20 text-orange-400 border-orange-500/30';
            case 'DENY': return 'bg-red-500/20 text-red-400 border-red-500/30';
            default: return 'bg-gray-500/20 text-gray-400';
        }
    };

    return (
        <div className="space-y-6">
            {/* Recommendation Banner */}
            <div className={`p-4 rounded-xl border ${getRecommendationColor(report.recommendation)} flex items-center justify-between`}>
                <div className="flex items-center space-x-3">
                    {report.recommendation === 'APPROVE' ? (
                        <CheckCircleIcon className="w-6 h-6" />
                    ) : (
                        <ExclamationTriangleIcon className="w-6 h-6" />
                    )}
                    <div>
                        <h3 className="font-bold text-lg">
                            {report.recommendation.replace(/_/g, ' ')}
                        </h3>
                        <p className="text-sm opacity-80">
                            {report.concerns.length > 0 ? report.concerns[0] : 'No major concerns identified'}
                        </p>
                    </div>
                </div>
                <div className="text-2xl font-bold">
                    {Math.round(report.teamAvailability)}%
                    <span className="text-xs font-normal block opacity-60">Availability</span>
                </div>
            </div>

            {/* Metrics Grid */}
            <div className="grid grid-cols-2 gap-4">
                <div className="bg-gray-800/40 p-4 rounded-xl border border-white/5">
                    <div className="flex items-center space-x-2 text-gray-400 mb-2">
                        <UserGroupIcon className="w-4 h-4" />
                        <span className="text-xs uppercase tracking-wider">Coverage Risk</span>
                    </div>
                    <div className={`text-xl font-bold ${getRiskColor(report.coverageRisk)}`}>
                        {report.coverageRisk}
                    </div>
                </div>

                <div className="bg-gray-800/40 p-4 rounded-xl border border-white/5">
                    <div className="flex items-center space-x-2 text-gray-400 mb-2">
                        <ArrowPathIcon className="w-4 h-4" />
                        <span className="text-xs uppercase tracking-wider">Rotation Impact</span>
                    </div>
                    <div className={`text-xl font-bold ${report.rotationDisruption ? 'text-yellow-400' : 'text-green-400'}`}>
                        {report.rotationDisruption ? 'Disruptive' : 'Minimal'}
                    </div>
                </div>
            </div>

            {/* Replacement Plan Preview */}
            {report.replacementPlan.length > 0 && (
                <div className="bg-gray-800/40 p-4 rounded-xl border border-white/5">
                    <h4 className="text-sm font-medium text-gray-300 mb-3">Replacement Strategy</h4>
                    <div className="space-y-2">
                        {report.replacementPlan.slice(0, 3).map((plan, idx) => (
                            <div key={idx} className="flex items-center justify-between text-sm p-2 bg-white/5 rounded-lg">
                                <div className="flex flex-col">
                                    <span className="text-gray-300 font-medium">{plan.replacementAnalystName || 'No replacement'}</span>
                                    <span className="text-xs text-gray-500">{plan.date} • {plan.shiftType}</span>
                                </div>
                                <div className="flex items-center space-x-2">
                                    <span className={`px-2 py-0.5 rounded text-xs ${plan.confidence > 0.8 ? 'bg-green-500/20 text-green-400' :
                                        plan.confidence > 0.5 ? 'bg-yellow-500/20 text-yellow-400' :
                                            'bg-red-500/20 text-red-400'
                                        }`}>
                                        {Math.round(plan.confidence * 100)}% Conf.
                                    </span>
                                </div>
                            </div>
                        ))}
                        {report.replacementPlan.length > 3 && (
                            <div className="text-center text-xs text-gray-500 mt-2">
                                + {report.replacementPlan.length - 3} more shifts
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};
