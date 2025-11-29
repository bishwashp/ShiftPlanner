import React, { useState, useEffect } from 'react';
import { CalendarCheck, ClockCounterClockwise } from '@phosphor-icons/react';
import { apiService } from '../../../services/api';
import moment from 'moment';

const ScheduleHighlights: React.FC = () => {
    const [lastUpdated, setLastUpdated] = useState<string>('');
    const [scheduleUntil, setScheduleUntil] = useState<string>('');
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchScheduleInfo = async () => {
            try {
                // Get schedules to find the furthest date and last update time
                const today = moment().format('YYYY-MM-DD');
                // Limit lookahead to 3 months to capture relevant schedules
                const nextThreeMonths = moment().add(3, 'months').format('YYYY-MM-DD');
                const schedules = await apiService.getSchedules(today, nextThreeMonths);

                if (schedules.length > 0) {
                    // 1. Calculate Scheduled Until
                    const sortedByDate = [...schedules].sort((a: any, b: any) =>
                        moment(b.date).valueOf() - moment(a.date).valueOf()
                    );
                    setScheduleUntil(moment(sortedByDate[0].date).format('MMM D, YYYY'));

                    // 2. Calculate Last Updated from the schedules themselves
                    // Find the most recent createdAt or updatedAt
                    const lastUpdate = schedules.reduce((max: moment.Moment, s: any) => {
                        const created = moment(s.createdAt);
                        const updated = moment(s.updatedAt);
                        const currentMax = created.isAfter(updated) ? created : updated;
                        return currentMax.isAfter(max) ? currentMax : max;
                    }, moment(0)); // Start with epoch

                    if (lastUpdate.isValid() && lastUpdate.year() > 1970) {
                        setLastUpdated(lastUpdate.fromNow());
                    } else {
                        // Fallback to activity log if schedule timestamps are missing/invalid
                        const activities = await apiService.getRecentActivities(20);
                        const scheduleActivity = activities.find((a: any) =>
                            a.category === 'SCHEDULE' ||
                            a.type.includes('SCHEDULE') ||
                            a.type.includes('GENERATE')
                        );
                        if (scheduleActivity) {
                            setLastUpdated(moment(scheduleActivity.createdAt).fromNow());
                        } else {
                            setLastUpdated('Recently');
                        }
                    }
                } else {
                    setScheduleUntil('No schedules');
                    setLastUpdated('Never');
                }
            } catch (error) {
                console.error('Failed to fetch schedule info', error);
            } finally {
                setLoading(false);
            }
        };

        fetchScheduleInfo();
    }, []);

    if (loading) return <div className="animate-pulse h-full bg-gray-100 dark:bg-white/5 rounded-lg" />;

    return (
        <div className="h-full flex flex-col justify-center space-y-2">
            <div className="flex items-start gap-2 p-2 rounded-lg bg-gray-50 dark:bg-white/5">
                <div className="p-1.5 rounded-md bg-indigo-100 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 flex-shrink-0">
                    <ClockCounterClockwise className="w-4 h-4" weight="fill" />
                </div>
                <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 uppercase font-semibold mb-0.5">Last Updated</p>
                    <p className="text-sm font-bold text-gray-900 dark:text-white">{lastUpdated || 'Never'}</p>
                </div>
            </div>

            <div className="flex items-start gap-2 p-2 rounded-lg bg-gray-50 dark:bg-white/5">
                <div className="p-1.5 rounded-md bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex-shrink-0">
                    <CalendarCheck className="w-4 h-4" weight="fill" />
                </div>
                <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 uppercase font-semibold mb-0.5">Scheduled Until</p>
                    <p className="text-sm font-bold text-gray-900 dark:text-white">{scheduleUntil || 'No schedules'}</p>
                </div>
            </div>
        </div>
    );
};

export default ScheduleHighlights;
