import { X } from '@phosphor-icons/react';
import { motion, AnimatePresence } from 'framer-motion';

interface BurnoutRisk {
    analystId: string;
    analystName: string;
    riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    riskScore: number;
    factors: string[];
    recommendations: string[];
}

interface BurnoutModalProps {
    isOpen: boolean;
    onClose: () => void;
    risks: BurnoutRisk[];
}

export const BurnoutModal: React.FC<BurnoutModalProps> = ({ isOpen, onClose, risks }) => {
    const highRisks = risks.filter(r => r.riskLevel === 'HIGH' || r.riskLevel === 'CRITICAL');

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50"
                        onClick={onClose}
                    />

                    {/* Modal */}
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 20 }}
                        className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none"
                    >
                        <div
                            className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl max-w-2xl w-full max-h-[80vh] overflow-hidden pointer-events-auto"
                            onClick={(e) => e.stopPropagation()}
                        >
                            {/* Header */}
                            <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-800">
                                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                                    Burnout Risk Assessment
                                </h2>
                                <button
                                    onClick={onClose}
                                    className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                                >
                                    <X className="h-5 w-5 text-gray-500" />
                                </button>
                            </div>

                            {/* Content */}
                            <div className="p-6 overflow-y-auto max-h-[calc(80vh-140px)]">
                                {highRisks.length === 0 ? (
                                    <div className="text-center py-12">
                                        <div className="text-6xl mb-4">✓</div>
                                        <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                                            No High Risks Detected
                                        </h3>
                                        <p className="text-gray-600 dark:text-gray-400">
                                            Workload is balanced across the team
                                        </p>
                                    </div>
                                ) : (
                                    <div className="space-y-4">
                                        {highRisks.map((risk) => (
                                            <div
                                                key={risk.analystId}
                                                className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-5 border border-gray-200 dark:border-gray-700"
                                            >
                                                {/* Analyst Header */}
                                                <div className="flex items-center justify-between mb-4">
                                                    <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                                                        {risk.analystName}
                                                    </h3>
                                                    <span
                                                        className={`px-3 py-1 rounded-lg text-sm font-bold ${risk.riskLevel === 'CRITICAL'
                                                                ? 'bg-red-600 text-white'
                                                                : 'bg-orange-500 text-white'
                                                            }`}
                                                    >
                                                        {risk.riskLevel}
                                                    </span>
                                                </div>

                                                {/* Risk Score */}
                                                <div className="mb-4">
                                                    <div className="flex items-center justify-between text-sm mb-1">
                                                        <span className="text-gray-600 dark:text-gray-400">Risk Score</span>
                                                        <span className="font-semibold text-gray-900 dark:text-white">
                                                            {risk.riskScore}/100
                                                        </span>
                                                    </div>
                                                    <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                                                        <div
                                                            className={`h-2 rounded-full ${risk.riskLevel === 'CRITICAL' ? 'bg-red-600' : 'bg-orange-500'
                                                                }`}
                                                            style={{ width: `${risk.riskScore}%` }}
                                                        />
                                                    </div>
                                                </div>

                                                {/* Risk Factors */}
                                                <div className="mb-4">
                                                    <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">
                                                        Risk Factors:
                                                    </h4>
                                                    <ul className="space-y-1">
                                                        {risk.factors.map((factor, idx) => (
                                                            <li
                                                                key={idx}
                                                                className="text-sm text-gray-600 dark:text-gray-400 flex items-start gap-2"
                                                            >
                                                                <span className="text-red-500 mt-1">•</span>
                                                                <span>{factor}</span>
                                                            </li>
                                                        ))}
                                                    </ul>
                                                </div>

                                                {/* Recommendations */}
                                                {risk.recommendations && risk.recommendations.length > 0 && (
                                                    <div>
                                                        <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">
                                                            Recommended Actions:
                                                        </h4>
                                                        <ul className="space-y-1">
                                                            {risk.recommendations.map((rec, idx) => (
                                                                <li
                                                                    key={idx}
                                                                    className="text-sm text-gray-600 dark:text-gray-400 flex items-start gap-2"
                                                                >
                                                                    <span className="text-blue-500 mt-1">→</span>
                                                                    <span>{rec}</span>
                                                                </li>
                                                            ))}
                                                        </ul>
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Footer */}
                            <div className="flex justify-end gap-3 p-6 border-t border-gray-200 dark:border-gray-800">
                                <button
                                    onClick={onClose}
                                    className="px-4 py-2 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors font-medium"
                                >
                                    Close
                                </button>
                            </div>
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
};
