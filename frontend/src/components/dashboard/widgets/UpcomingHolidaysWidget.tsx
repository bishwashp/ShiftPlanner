import React, { useState, useEffect } from 'react';
import { CalendarBlank } from '@phosphor-icons/react';
import { apiService } from '../../../services/api';
import moment from 'moment';

import GlassCard from '../../common/GlassCard';

const UpcomingHolidaysWidget: React.FC = () => {
    const [holidays, setHolidays] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchHolidays = async () => {
            try {
                const allHolidays = await apiService.getHolidays();
                const today = moment();
                const nextMonth = moment().add(30, 'days');

                const upcoming = allHolidays
                    .filter((h: any) => {
                        const hDate = moment(h.date);
                        return hDate.isSameOrAfter(today, 'day') && hDate.isBefore(nextMonth);
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

    return (
        <GlassCard className="h-full flex flex-col">
            <div className="p-1.5 flex justify-between items-center border-b border-gray-200/50 dark:border-white/10">
                <h3 className="text-xs font-semibold text-gray-900 dark:text-white flex items-center gap-1.5">
                    <CalendarBlank className="w-3.5 h-3.5 text-purple-500 dark:text-purple-400" />
                    Upcoming Holiday
                </h3>
            </div>

            <div className="flex-1 p-1.5 overflow-y-auto">
                {loading ? (
                    <div className="space-y-1">
                        <div className="h-8 bg-gray-100 dark:bg-white/5 rounded-lg animate-pulse" />
                    </div>
                ) : holidays.length > 0 ? (
                    <div className="space-y-1">
                        {holidays.map((holiday, index) => (
                            <div
                                key={holiday.id || index}
                                className="flex items-center p-1 rounded-lg bg-purple-50 dark:bg-purple-500/10 border border-purple-100 dark:border-purple-500/10"
                            >
                                <div className="flex-1">
                                    <p className="text-[10px] font-bold text-gray-900 dark:text-white leading-tight mb-0.5">{holiday.name}</p>
                                    <p className="text-[9px] text-purple-600 dark:text-purple-300 leading-tight">
                                        {moment(holiday.date).format('MMM D')} ({moment(holiday.date).fromNow(true)})
                                    </p>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="h-full flex flex-col items-center justify-center text-center p-1.5 text-gray-500 dark:text-gray-400">
                        <CalendarBlank className="w-6 h-6 mb-1.5 opacity-50" />
                        <p className="text-[10px]">No upcoming holidays</p>
                    </div>
                )}
            </div>
        </GlassCard>
    );
};

export default UpcomingHolidaysWidget;
