import React, { useState, useEffect } from 'react';
import { Sun, Moon, Umbrella } from '@phosphor-icons/react';
import { apiService } from '../../../services/api';
import moment from 'moment';
import GlassCard from '../../common/GlassCard';
import { useShiftDefinitions } from '../../../contexts/ShiftDefinitionContext';
import { getShiftTypeColor } from '../../../utils/colors';

const WeekendShiftWidget: React.FC = () => {
    const { isLateShift } = useShiftDefinitions();
    const [weekendShifts, setWeekendShifts] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [weekendDates, setWeekendDates] = useState<{ sat: string, sun: string } | null>(null);

    useEffect(() => {
        const fetchWeekendShifts = async () => {
            try {
                // Find next Saturday
                const today = moment();
                const nextSaturday = today.day() === 6 ? today : today.clone().day(6);
                const nextSunday = nextSaturday.clone().add(1, 'day');

                setWeekendDates({
                    sat: nextSaturday.format('MMM D'),
                    sun: nextSunday.format('MMM D')
                });

                const schedules = await apiService.getSchedules(
                    nextSaturday.format('YYYY-MM-DD'),
                    nextSunday.format('YYYY-MM-DD')
                );

                setWeekendShifts(schedules);
            } catch (error) {
                console.error('Failed to fetch weekend shifts', error);
            } finally {
                setLoading(false);
            }
        };

        fetchWeekendShifts();
    }, []);

    const getShiftsForDay = (dayName: string) => {
        if (!weekendDates) return [];
        const targetDate = dayName === 'Saturday'
            ? moment(weekendDates.sat, 'MMM D')
            : moment(weekendDates.sun, 'MMM D');

        return weekendShifts.filter(s => moment(s.date).isSame(targetDate, 'day'));
    };

    const renderShiftRow = (day: string, date: string) => {
        const shifts = getShiftsForDay(day);

        return (
            <div className="mb-4 last:mb-0">
                <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold uppercase text-gray-500 dark:text-gray-400 tracking-wider">
                        {day} <span className="font-normal opacity-75 ml-1">{date}</span>
                    </span>
                </div>

                {shifts.length > 0 ? (
                    <div className="space-y-2">
                        {shifts.map((shift: any) => (
                            <div key={shift.id} className="flex items-center justify-between p-2 rounded-lg bg-white/5 border border-white/5 text-sm">
                                <div className="flex items-center gap-2">
                                    <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: getShiftTypeColor(shift.shiftType) }} />
                                    <span className="font-medium text-gray-900 dark:text-white">{shift.analyst?.name || 'Unknown Analyst'}</span>
                                </div>
                                {isLateShift(shift.shiftType) ? (
                                    <Moon className="w-4 h-4 text-indigo-400" />
                                ) : (
                                    <Sun className="w-4 h-4 text-orange-400" />
                                )}
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="p-2 text-xs text-gray-500 italic text-center border border-dashed border-white/10 rounded-lg">
                        No shifts assigned
                    </div>
                )}
            </div>
        );
    };

    return (
        <GlassCard className="h-full flex flex-col">
            <div className="p-4 border-b border-white/10 flex justify-between items-center">
                <h3 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                    <Umbrella className="w-5 h-5 text-blue-500" />
                    Weekend Coverage
                </h3>
            </div>

            <div className="flex-1 p-4 overflow-y-auto min-h-[120px]">
                {loading ? (
                    <div className="space-y-4">
                        <div className="h-16 bg-white/5 rounded-lg animate-pulse" />
                        <div className="h-16 bg-white/5 rounded-lg animate-pulse" />
                    </div>
                ) : weekendDates ? (
                    <div>
                        {renderShiftRow('Saturday', weekendDates.sat)}
                        {renderShiftRow('Sunday', weekendDates.sun)}
                    </div>
                ) : null}
            </div>
        </GlassCard>
    );
};

export default WeekendShiftWidget;
