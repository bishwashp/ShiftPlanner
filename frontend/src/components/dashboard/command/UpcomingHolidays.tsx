import React, { useState, useEffect } from 'react';
import { CalendarBlank } from '@phosphor-icons/react';
import { apiService } from '../../../services/api';
import moment from 'moment';

const UpcomingHolidays: React.FC = () => {
    const [holidays, setHolidays] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchHolidays = async () => {
            try {
                const allHolidays = await apiService.getHolidays();
                const nextMonth = moment().add(30, 'days');

                const upcoming = allHolidays
                    .filter((h: any) => {
                        const hDate = moment(h.date);
                        return hDate.isSameOrAfter(moment(), 'day') && hDate.isBefore(nextMonth);
                    })
                    .sort((a: any, b: any) => moment(a.date).diff(moment(b.date)))
                    .slice(0, 3);

                setHolidays(upcoming);
            } catch (error) {
                console.error('Failed to fetch holidays', error);
            } finally {
                setLoading(false);
            }
        };

        fetchHolidays();
    }, []);

    if (loading) return <div className="animate-pulse h-32 bg-gray-100 dark:bg-white/5 rounded-lg" />;

    return (
        <div className="h-full flex flex-col">
            <div className="flex items-center gap-2 mb-2 text-gray-500 dark:text-gray-400">
                <CalendarBlank className="w-4 h-4" />
                <span className="text-xs font-medium uppercase tracking-wider">Upcoming Holidays</span>
            </div>

            <div className="flex-1 overflow-hidden">
                {holidays.length > 0 ? (
                    <div className="space-y-1.5">
                        {holidays.map((holiday, index) => (
                            <div key={holiday.id || index} className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-gray-50 dark:hover:bg-white/5 transition-colors">
                                <div className="w-12 h-12 rounded-lg bg-purple-50 dark:bg-purple-500/10 flex flex-col items-center justify-center text-purple-600 dark:text-purple-300 flex-shrink-0">
                                    <span className="text-[10px] uppercase font-bold leading-none">{moment(holiday.date).format('MMM')}</span>
                                    <span className="text-lg font-bold leading-none mt-0.5">{moment(holiday.date).format('D')}</span>
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                                        {holiday.name}
                                    </p>
                                    <p className="text-xs font-bold text-purple-600 dark:text-purple-300 uppercase">
                                        {moment(holiday.date).fromNow()}
                                    </p>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="h-full flex items-center justify-center text-gray-400 text-xs">
                        No upcoming holidays
                    </div>
                )}
            </div>
        </div>
    );
};

export default UpcomingHolidays;
