import React, { useState, useMemo } from 'react';
import moment from 'moment';
import { CaretLeft, CaretRight } from '@phosphor-icons/react';
import { Schedule } from '../../services/api';

interface MiniCalendarProps {
    schedules: Schedule[]; // List of potential schedules to highlight/select
    selectedDate?: string | null; // For single selection mode
    startDate?: string | null;    // For range mode: Start
    endDate?: string | null;      // For range mode: End
    onSelect: (date: string) => void;
    // Optional: Date of the source shift to validate compatibility
    sourceSchedule?: Schedule | null;
}

export const MiniCalendar: React.FC<MiniCalendarProps> = ({
    schedules,
    selectedDate,
    startDate,
    endDate,
    onSelect,
    sourceSchedule
}) => {
    const [viewMonth, setViewMonth] = useState(moment());

    // Create a set of dates that have swappable shifts
    const swappableDates = useMemo(() => {
        const dates = new Set<string>();
        schedules.forEach(s => {
            const date = moment.utc(s.date).format('YYYY-MM-DD');
            const dayOfWeek = moment.utc(s.date).day();

            let isCompatible = true;
            if (sourceSchedule) {
                const sourceIsWeekend = [0, 6].includes(moment(sourceSchedule.date).day());
                const targetIsWeekend = [0, 6].includes(dayOfWeek);
                if (sourceIsWeekend !== targetIsWeekend) isCompatible = false;
                if (sourceSchedule.isScreener !== s.isScreener) isCompatible = false;
            } else {
                if (!s.isScreener && dayOfWeek !== 0 && dayOfWeek !== 6) {
                    isCompatible = false;
                }
            }

            if (isCompatible) {
                dates.add(date);
            }
        });
        return dates;
    }, [schedules, sourceSchedule]);

    const generateCalendarDays = () => {
        const startOfMonth = viewMonth.clone().startOf('month');
        const endOfMonth = viewMonth.clone().endOf('month');
        const startDateCal = startOfMonth.clone().startOf('week');
        const endDateCal = endOfMonth.clone().endOf('week');

        const days: moment.Moment[] = [];
        let current = startDateCal.clone();

        while (current.isSameOrBefore(endDateCal)) {
            days.push(current.clone());
            current.add(1, 'day');
        }

        return days;
    };

    const days = generateCalendarDays();

    // Helper to check if a date is within the selected range
    const isInRange = (dateStr: string) => {
        if (!startDate || !endDate) return false;
        return moment(dateStr).isBetween(startDate, endDate, 'day', '[]');
    };

    const isRangeStart = (dateStr: string) => startDate === dateStr;
    const isRangeEnd = (dateStr: string) => endDate === dateStr;

    return (
        <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-3 border border-gray-200 dark:border-gray-700">
            {/* Header */}
            <div className="flex items-center justify-between mb-3">
                <button
                    type="button"
                    onClick={() => setViewMonth(viewMonth.clone().subtract(1, 'month'))}
                    className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors"
                >
                    <CaretLeft className="w-4 h-4" />
                </button>
                <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                    {viewMonth.format('MMMM YYYY')}
                </span>
                <button
                    type="button"
                    onClick={() => setViewMonth(viewMonth.clone().add(1, 'month'))}
                    className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors"
                >
                    <CaretRight className="w-4 h-4" />
                </button>
            </div>

            {/* Day headers */}
            <div className="grid grid-cols-7 gap-1 mb-1">
                {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, i) => (
                    <div key={i} className="text-center text-xs text-gray-500 dark:text-gray-400 font-medium py-1">
                        {day}
                    </div>
                ))}
            </div>

            {/* Calendar grid */}
            <div className="grid grid-cols-7 gap-1">
                {days.map((day, i) => {
                    const dateStr = day.format('YYYY-MM-DD');
                    const isCurrentMonth = day.month() === viewMonth.month();
                    const isSwappable = swappableDates.has(dateStr);

                    // Selection Logic
                    const isSingleSelected = selectedDate === dateStr;
                    const isStart = isRangeStart(dateStr);
                    const isEnd = isRangeEnd(dateStr);
                    const inRange = isInRange(dateStr);

                    const isSelected = isSingleSelected || isStart || isEnd || inRange;
                    const isToday = day.isSame(moment(), 'day');

                    // Style Logic
                    let bgClass = '';
                    let textClass = 'text-gray-400 dark:text-gray-500 cursor-default';

                    if (isSwappable) {
                        textClass = 'text-emerald-700 dark:text-emerald-300 cursor-pointer font-medium';
                        bgClass = 'bg-emerald-100 dark:bg-emerald-900/30 hover:bg-emerald-200 dark:hover:bg-emerald-800/50';

                        if (isSingleSelected || isStart || isEnd) {
                            bgClass = 'bg-primary text-primary-foreground ring-2 ring-primary ring-offset-2';
                            textClass = 'text-primary-foreground';
                        } else if (inRange) {
                            bgClass = 'bg-primary/20 text-primary dark:text-primary-foreground';
                        }
                    } else if (inRange) {
                        // Even non-swappable days are part of the range visually (breaks)
                        bgClass = 'bg-primary/10 text-gray-500';
                        textClass = 'text-gray-500';
                    }


                    return (
                        <button
                            key={i}
                            type="button"
                            // Allow clicking generic dates? Maybe. For now constrain to swappable if mode is single.
                            // But for range, we might click a break day (non-swappable) as start/end?
                            // Requirement: "Time-Slice Exchange" implies we swap *everything*.
                            // So we should be able to select ANY date as start/end.
                            onClick={() => onSelect(dateStr)}
                            className={`
                                w-8 h-8 text-xs rounded-full flex items-center justify-center transition-all
                                ${!isCurrentMonth ? 'opacity-50' : ''}
                                ${bgClass}
                                ${textClass}
                                ${isToday && !isSelected ? 'ring-1 ring-gray-300 dark:ring-gray-600' : ''}
                            `}
                        >
                            {day.date()}
                        </button>
                    );
                })}
            </div>

            {/* Legend */}
            <div className="flex items-center gap-4 mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
                <div className="flex items-center gap-1.5 text-xs text-gray-500">
                    <div className="w-3 h-3 rounded-full bg-emerald-100 dark:bg-emerald-900/30 border border-emerald-300 dark:border-emerald-700"></div>
                    <span>Compatible Shifts</span>
                </div>
            </div>
        </div>
    );
};
