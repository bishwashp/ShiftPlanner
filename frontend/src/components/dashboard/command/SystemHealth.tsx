import React, { useState, useEffect } from 'react';
import { Warning } from '@phosphor-icons/react';
import { apiService } from '../../../services/api';
import moment from 'moment';

const SystemHealth: React.FC<{
    onResolveCritical?: () => void;
    onReviewRecommended?: () => void;
}> = ({ onResolveCritical, onReviewRecommended }) => {
    const [criticalCount, setCriticalCount] = useState<number>(0);
    const [recommendedCount, setRecommendedCount] = useState<number>(0);
    const [loading, setLoading] = useState(true);
    const [dismissedRecommended, setDismissedRecommended] = useState(false);

    useEffect(() => {
        const fetchConflicts = async () => {
            try {
                const today = moment().format('YYYY-MM-DD');
                const nextMonth = moment().add(30, 'days').format('YYYY-MM-DD');
                const conflicts = await apiService.getAllConflicts(today, nextMonth);
                setCriticalCount(conflicts.critical?.length || 0);

                // Filter out schedule generation related conflicts from recommended count
                const filteredRecommended = (conflicts.recommended || []).filter((c: any) =>
                    c.type !== 'NO_SCHEDULE_EXISTS' && c.type !== 'INCOMPLETE_SCHEDULES'
                );
                setRecommendedCount(filteredRecommended.length);
            } catch (error) {
                console.error('Failed to fetch conflicts', error);
            } finally {
                setLoading(false);
            }
        };

        fetchConflicts();
    }, []);

    if (loading) {
        return (
            <div className="flex items-center gap-3 flex-wrap flex-1 min-w-0 animate-pulse">
                <div className="h-8 bg-gray-200 dark:bg-white/5 rounded-full w-48" />
                <div className="h-8 bg-gray-200 dark:bg-white/5 rounded-full w-32 ml-auto" />
            </div>
        );
    }

    const showRecommended = recommendedCount > 0 && !dismissedRecommended;
    const showCritical = criticalCount > 0;

    // Don't render if no conflicts to show
    if (!showRecommended && !showCritical) return null;

    return (
        <div className="flex items-center gap-3 flex-wrap flex-1 min-w-0">
            {/* Recommended Conflicts */}
            {showRecommended && (
                <div className="flex items-center gap-2 bg-yellow-50 dark:bg-yellow-500/10 border border-yellow-200 dark:border-yellow-500/20 px-3 py-1.5 rounded-full flex-1 min-w-0">
                    <Warning className="w-4 h-4 text-yellow-600 dark:text-yellow-400 flex-shrink-0" weight="fill" />
                    <span className="text-xs font-medium text-yellow-900 dark:text-yellow-100 truncate">
                        There {recommendedCount === 1 ? 'is' : 'are'} {recommendedCount} Recommended Conflict{recommendedCount !== 1 ? 's' : ''}. Review or Dismiss
                    </span>
                    <div className="flex items-center gap-2 ml-auto flex-shrink-0">
                        <button
                            onClick={onReviewRecommended}
                            className="px-2 py-0.5 rounded bg-green-600 hover:bg-green-700 text-white text-xs font-semibold transition-colors"
                        >
                            Review
                        </button>
                        <button
                            onClick={() => setDismissedRecommended(true)}
                            className="px-2 py-0.5 rounded bg-red-600 hover:bg-red-700 text-white text-xs font-semibold transition-colors"
                        >
                            Dismiss
                        </button>
                    </div>
                </div>
            )}

            {/* Critical Conflicts */}
            {showCritical && (
                <div className="flex items-center gap-2 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 px-3 py-1.5 rounded-full flex-1 min-w-0">
                    <Warning className="w-4 h-4 text-red-600 dark:text-red-400 flex-shrink-0" weight="fill" />
                    <span className="text-xs font-medium text-red-900 dark:text-red-100 truncate">
                        {criticalCount} Critical Conflict{criticalCount !== 1 ? 's' : ''} Require{criticalCount === 1 ? 's' : ''} Immediate Attention
                    </span>
                    <button
                        onClick={onResolveCritical}
                        className="px-2 py-0.5 rounded bg-red-600 hover:bg-red-700 text-white text-xs font-semibold transition-colors ml-auto flex-shrink-0"
                    >
                        Resolve
                    </button>
                </div>
            )}
        </div>
    );
};

export default SystemHealth;
