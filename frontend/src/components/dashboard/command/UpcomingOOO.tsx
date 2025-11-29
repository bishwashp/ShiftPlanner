import React, { useState, useEffect } from 'react';
import { Airplane, CalendarX } from '@phosphor-icons/react';
import { apiService } from '../../../services/api';
import moment from 'moment';

const UpcomingOOO: React.FC = () => {
    const [absences, setAbsences] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchAbsences = async () => {
            try {
                const today = moment().format('YYYY-MM-DD');
                const nextMonth = moment().add(30, 'days').format('YYYY-MM-DD');

                // Fetch all absences for next 30 days
                const data = await apiService.getAbsences(undefined, undefined, true, undefined, today, nextMonth);

                // Sort by start date and take top 5
                const sorted = data.sort((a: any, b: any) => moment(a.startDate).diff(moment(b.startDate))).slice(0, 5);
                setAbsences(sorted);
            } catch (error) {
                console.error('Failed to fetch absences', error);
            } finally {
                setLoading(false);
            }
        };

        fetchAbsences();
    }, []);

    if (loading) return <div className="animate-pulse h-40 bg-gray-100 dark:bg-white/5 rounded-lg" />;

    return (
        <div className="h-full flex flex-col">
            <div className="flex items-center gap-2 mb-2 text-gray-500 dark:text-gray-400">
                <Airplane className="w-4 h-4" />
                <span className="text-xs font-medium uppercase tracking-wider">Out of Office</span>
            </div>

            <div className="flex-1 overflow-hidden">
                {absences.length > 0 ? (
                    <div className="space-y-1.5">
                        {absences.map((absence, index) => {
                            const isOngoing = moment().isBetween(absence.startDate, absence.endDate, 'day', '[]');
                            const daysAway = moment(absence.startDate).diff(moment(), 'days');

                            return (
                                <div key={absence.id || index} className="flex items-center justify-between p-1.5 rounded-lg hover:bg-gray-50 dark:hover:bg-white/5 transition-colors">
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-full bg-gray-100 dark:bg-white/10 flex items-center justify-center text-xs font-bold text-gray-600 dark:text-gray-300">
                                            {(absence.analyst?.name || 'U').charAt(0)}
                                        </div>
                                        <div>
                                            <p className="text-sm font-medium text-gray-900 dark:text-white">
                                                {absence.analyst?.name}
                                            </p>
                                            <p className="text-[10px] text-gray-500">
                                                {moment(absence.startDate).format('MMM D')} - {moment(absence.endDate).format('MMM D')}
                                            </p>
                                        </div>
                                    </div>

                                    {isOngoing ? (
                                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-orange-100 text-orange-700 dark:bg-orange-500/20 dark:text-orange-300">
                                            ON LEAVE
                                        </span>
                                    ) : (
                                        <span className="text-[10px] text-gray-400">
                                            in {daysAway} days
                                        </span>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                ) : (
                    <div className="h-full flex flex-col items-center justify-center text-gray-400 space-y-2">
                        <CalendarX className="w-8 h-8 opacity-20" />
                        <p className="text-xs">No upcoming leaves</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default UpcomingOOO;
