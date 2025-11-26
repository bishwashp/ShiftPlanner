import React, { useState, useEffect } from 'react';
import { User, WarningCircle, Plus } from '@phosphor-icons/react';
import { apiService } from '../../../services/api';
import moment from 'moment';

import GlassCard from '../../common/GlassCard';

const TodaysScreenersWidget: React.FC = () => {
    const [screeners, setScreeners] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchScreeners = async () => {
            try {
                const today = moment().format('YYYY-MM-DD');
                const schedules = await apiService.getSchedules(today, today);
                const todaysScreeners = schedules.filter((s: any) => s.isScreener);
                setScreeners(todaysScreeners);
            } catch (error) {
                console.error('Failed to fetch screeners', error);
            } finally {
                setLoading(false);
            }
        };

        fetchScreeners();
    }, []);

    return (
        <GlassCard className="h-full flex flex-col">
            <div className="p-2 flex justify-between items-center border-b border-gray-200/50 dark:border-white/10">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                    <User className="w-4 h-4 text-indigo-500 dark:text-indigo-400" />
                    Today's Screeners
                </h3>
            </div>

            <div className="flex-1 p-2 overflow-y-auto">
                {loading ? (
                    <div className="space-y-2">
                        {[1, 2].map(i => (
                            <div key={i} className="h-8 bg-gray-100 dark:bg-white/5 rounded-lg animate-pulse" />
                        ))}
                    </div>
                ) : screeners.length > 0 ? (
                    <div className="space-y-2">
                        {screeners.map((screener, index) => (
                            <div
                                key={screener.id || index}
                                className={`flex items-center p-2 rounded-lg border transition-colors ${screener.shiftType === 'MORNING'
                                    ? 'bg-blue-50 dark:bg-blue-500/10 border-blue-100 dark:border-blue-500/10'
                                    : 'bg-purple-50 dark:bg-purple-500/10 border-purple-100 dark:border-purple-500/10'
                                    }`}
                            >
                                <div className={`w-7 h-7 rounded-lg flex items-center justify-center font-bold text-xs mr-2 ${screener.shiftType === 'MORNING'
                                    ? 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300'
                                    : 'bg-purple-100 text-purple-700 dark:bg-purple-500/20 dark:text-purple-300'
                                    }`}>
                                    {(screener.analyst?.name || 'U').charAt(0)}
                                </div>
                                <div>
                                    <p className="text-xs font-medium text-gray-900 dark:text-white">{screener.analyst?.name || 'Unknown'}</p>
                                    <p className="text-[10px] text-gray-500 dark:text-gray-400">{screener.shiftType === 'MORNING' ? 'Morning' : 'Evening'}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="h-full flex flex-col items-center justify-center text-center p-2">
                        <div className="w-10 h-10 rounded-full bg-indigo-50 dark:bg-indigo-500/10 flex items-center justify-center mb-2">
                            <WarningCircle className="w-5 h-5 text-indigo-500 dark:text-indigo-400" />
                        </div>
                        <p className="text-xs font-medium text-gray-900 dark:text-white mb-1">No Screeners</p>
                        <button className="text-[10px] flex items-center gap-1 text-indigo-500 dark:text-indigo-400 hover:opacity-80 transition-opacity">
                            <Plus className="w-3 h-3" /> Assign
                        </button>
                    </div>
                )}
            </div>
        </GlassCard>
    );
};

export default TodaysScreenersWidget;
