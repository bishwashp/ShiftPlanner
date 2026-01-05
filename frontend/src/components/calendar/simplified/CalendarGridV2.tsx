import React, { useRef, useEffect, useCallback, useState } from 'react';
import { usePerformance } from '../../../contexts/PerformanceContext';
import moment from 'moment-timezone';
import { SlimShiftLine } from './SlimShiftLine';

interface CalendarEvent {
    id: string;
    title: string;
    date: string; // YYYY-MM-DD format
    resource: any;
}

interface CalendarGridProps {
    date: Date;
    timezone: string;
    events: CalendarEvent[];
    isMobile: boolean;
    onEventSelect?: (event: CalendarEvent) => void;
    onDateSelect?: (date: Date) => void;
}

interface CalendarDay {
    date: moment.Moment;
    events: CalendarEvent[];
    isCurrentMonth: boolean;
    isToday: boolean;
}

export const CalendarGridV2: React.FC<CalendarGridProps> = ({
    date,
    timezone,
    events,
    isMobile,
    onEventSelect,
    onDateSelect
}) => {
    const { flags } = usePerformance();
    const gridRef = useRef<HTMLDivElement>(null);

    // Track expanded state by GROUP ID
    const [expandedGroupId, setExpandedGroupId] = useState<string | null>(null);

    // Helper to check if two events are consecutive AND same type
    const isConsecutive = (evt1: CalendarEvent, evt2: CalendarEvent) => {
        return evt1.title === evt2.title &&
            (evt1.resource.shiftType || '').toLowerCase() === (evt2.resource.shiftType || '').toLowerCase() &&
            evt1.resource.isScreener === evt2.resource.isScreener;
    };

    // Generate a unique Group ID for a sequence
    const getGroupId = (event: CalendarEvent, weekIndex: number) => {
        return `${event.title}-${event.resource.shiftType}-${event.resource.isScreener}-W${weekIndex}`;
    };

    // Generate calendar days
    const generateCalendarDays = (): CalendarDay[] => {
        const currentMonth = moment(date).tz(timezone);
        const startOfMonth = currentMonth.clone().startOf('month');
        const endOfMonth = currentMonth.clone().endOf('month');
        const startDate = startOfMonth.clone().startOf('week');
        const endDate = endOfMonth.clone().endOf('week');

        const days: CalendarDay[] = [];
        let current = startDate.clone();

        while (current.isSameOrBefore(endDate)) {
            const dayEvents = events.filter(event =>
                event.date === current.format('YYYY-MM-DD')
            );
            days.push({
                date: current.clone(),
                events: dayEvents,
                isCurrentMonth: current.month() === currentMonth.month(),
                isToday: current.isSame(moment().tz(timezone), 'day')
            });
            current.add(1, 'day');
        }
        return days;
    };

    const calendarDays = generateCalendarDays();
    const weeks: CalendarDay[][] = [];
    for (let i = 0; i < calendarDays.length; i += 7) {
        weeks.push(calendarDays.slice(i, i + 7));
    }

    // Render the week with consistent slots
    const renderWeek = (week: CalendarDay[], wIndex: number) => {
        // 1. Identify all unique analysts in this week
        const weekEvents = week.flatMap(d => d.events);
        const uniqueAnalysts = Array.from(new Set(weekEvents.map(e => e.title))).sort();

        // Map analyst -> Slot Index
        const analystSlots = new Map<string, number>();
        uniqueAnalysts.forEach((name, index) => analystSlots.set(name, index));

        return (
            <div className="grid grid-cols-7 border-b border-gray-200 dark:border-gray-800 min-h-[120px]">
                {week.map((day, dIndex) => {
                    const daySlots: (CalendarEvent | null)[] = new Array(uniqueAnalysts.length).fill(null);

                    day.events.forEach(event => {
                        const slotIndex = analystSlots.get(event.title);
                        if (slotIndex !== undefined) {
                            daySlots[slotIndex] = event;
                        }
                    });

                    return (
                        <div
                            key={dIndex}
                            className={`
                relative border-r border-gray-200 dark:border-gray-800
                ${!day.isCurrentMonth ? 'bg-gray-50/50 dark:bg-gray-900/50' : 'bg-white dark:bg-gray-800'}
                flex flex-col group
                hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors
                pt-1 
              `}
                            onClick={(e) => {
                                if (onDateSelect) onDateSelect(day.date.toDate());
                            }}
                        >
                            {/* Date Header */}
                            <div className={`
                text-xs font-medium mb-1 w-6 h-6 flex items-center justify-center rounded-full ml-auto mr-1
                ${day.isToday ? 'bg-primary text-primary-foreground' : 'text-gray-500'}
              `}>
                                {day.date.date()}
                            </div>

                            {/* Slots Container */}
                            <div className="flex-1 flex flex-col w-full">
                                {daySlots.map((event, slotIndex) => {
                                    if (!event) {
                                        return <div key={`spacer-${slotIndex}`} className="h-[10px] w-full" />;
                                    }

                                    const groupId = getGroupId(event, wIndex);
                                    const isExpanded = expandedGroupId === groupId;

                                    const prevDay = week[dIndex - 1];
                                    const nextDay = week[dIndex + 1];

                                    const hasPrev = prevDay?.events.some(e => isConsecutive(e, event));
                                    const hasNext = nextDay?.events.some(e => isConsecutive(e, event));

                                    const isStart = dIndex === 0 || !hasPrev;
                                    const isEnd = dIndex === 6 || !hasNext;

                                    return (
                                        <SlimShiftLine
                                            key={event.id}
                                            id={event.id}
                                            name={event.title}
                                            shiftType={event.resource.shiftType}
                                            isScreener={event.resource.isScreener}
                                            isWeekend={day.date.day() === 0 || day.date.day() === 6}
                                            isStart={isStart}
                                            isEnd={isEnd}
                                            isExpanded={isExpanded}
                                            onClick={() => {
                                                if (isExpanded) {
                                                    onEventSelect?.(event);
                                                } else {
                                                    setExpandedGroupId(groupId);
                                                }
                                            }}
                                        />
                                    );
                                })}
                            </div>
                        </div>
                    );
                })}
            </div>
        );
    };

    return (
        <div
            className="simplified-calendar-grid h-full flex flex-col"
            ref={gridRef}
            onClick={() => setExpandedGroupId(null)} // Dismiss on outside click
        >
            {/* Header */}
            <div className="grid grid-cols-7 gap-px bg-gray-200 dark:bg-gray-700 border-b border-gray-200 dark:bg-gray-700">
                {['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'].map((day) => (
                    <div key={day} className="text-center py-2 text-xs font-semibold text-gray-500 dark:text-gray-400 bg-white dark:bg-gray-800">
                        {day}
                    </div>
                ))}
            </div>

            {/* Grid */}
            <div className="flex-1 grid grid-rows-5 divider-gray-200 dark:divider-gray-700">
                {weeks.map((week, wIndex) => (
                    <React.Fragment key={wIndex}>
                        {renderWeek(week, wIndex)}
                    </React.Fragment>
                ))}
            </div>
        </div>
    );
};
