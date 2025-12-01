import React, { useState, useMemo, useCallback } from 'react';
import moment from 'moment-timezone';
import { apiService, Schedule, Analyst } from '../../../services/api';
import { groupConsecutiveShifts, ShiftGroup, CalendarEvent } from '../../../utils/shiftGrouper';
import { ShiftPill } from './ShiftPill';

interface WeekScheduleViewProps {
  date: Date;
  timezone: string;
  onDateChange: (date: Date) => void;
  onReturnToMonth: () => void;
  clickedDay?: Date; // Remember which day was clicked
  events: CalendarEvent[];
  analysts: Analyst[];
  onScheduleUpdate: (schedules: Schedule[]) => void;
  onScheduleClick?: (schedule: Schedule | Schedule[]) => void;
  onDateClick?: (date: Date) => void;
}

export const WeekScheduleView: React.FC<WeekScheduleViewProps> = ({
  date,
  timezone,
  onDateChange,
  onReturnToMonth,
  clickedDay,
  events,
  analysts,
  onScheduleUpdate,
  onScheduleClick,
  onDateClick
}) => {
  const [draggedGroup, setDraggedGroup] = useState<ShiftGroup | null>(null);
  const [dragOverDay, setDragOverDay] = useState<string | null>(null);

  // Calculate Sunday-Saturday week containing the clicked day or current date
  const weekStart = useMemo(() => {
    const targetDate = clickedDay || date;
    const momentDate = moment(targetDate).tz(timezone);
    return momentDate.startOf('week'); // Sunday start
  }, [date, clickedDay, timezone]);

  // Group consecutive shifts into pills
  const pillGroups = useMemo(() => {
    // Week boundaries as YYYY-MM-DD strings in the correct timezone
    const weekStartStr = weekStart.format('YYYY-MM-DD');
    const weekEndStr = weekStart.clone().endOf('week').format('YYYY-MM-DD');

    // Pass events directly - they already have the correct YYYY-MM-DD date
    // derived from the timezone-aware logic in the parent component
    return groupConsecutiveShifts(events, weekStartStr, weekEndStr);
  }, [events, weekStart]);

  // Smart stacking algorithm with requested sorting
  const stackedPills = useMemo(() => {
    interface PillPosition {
      group: ShiftGroup;
      colStart: number;
      colSpan: number;
    }

    const SHIFT_PRIORITY: Record<string, number> = {
      'MORNING': 1,
      'EVENING': 2,
      'NIGHT': 3
    };

    // Sort groups: Shift Type -> Alphabetical
    const sortedGroups = [...pillGroups].sort((a, b) => {
      // 1. Shift Type
      const typeA = SHIFT_PRIORITY[a.shiftType] || 99;
      const typeB = SHIFT_PRIORITY[b.shiftType] || 99;
      if (typeA !== typeB) return typeA - typeB;

      // 2. Alphabetical
      return a.analystName.localeCompare(b.analystName);
    });

    const rows: PillPosition[][] = [];
    // We use moment(YYYY-MM-DD) which creates a local date at 00:00:00
    // This is consistent for all calculations
    const weekStartMoment = moment(weekStart.format('YYYY-MM-DD'));
    const weekEndMoment = moment(weekStart.clone().endOf('week').format('YYYY-MM-DD'));

    for (const group of sortedGroups) {
      const groupStart = moment(group.startDate);
      const groupEnd = moment(group.endDate);

      // Calculate intersection with current week
      const effectiveStart = moment.max(groupStart, weekStartMoment);
      const effectiveEnd = moment.min(groupEnd, weekEndMoment);

      // If no intersection, skip
      if (effectiveStart.isAfter(effectiveEnd)) continue;

      // Calculate grid column positions (1-7, Sunday=1)
      const colStart = effectiveStart.day() + 1;
      const daysSpan = effectiveEnd.diff(effectiveStart, 'days') + 1;
      const colSpan = Math.max(1, Math.min(daysSpan, 7));

      // Find first row without overlap
      let placed = false;
      for (let rowIdx = 0; rowIdx < rows.length; rowIdx++) {
        const row = rows[rowIdx];
        const hasOverlap = row.some(pill => {
          const pillEnd = pill.colStart + pill.colSpan - 1;
          const newPillEnd = colStart + colSpan - 1;
          // Standard interval overlap check
          return colStart <= pillEnd && pill.colStart <= newPillEnd;
        });

        if (!hasOverlap) {
          row.push({ group, colStart, colSpan });
          placed = true;
          break;
        }
      }

      if (!placed) {
        rows.push([{ group, colStart, colSpan }]);
      }
    }

    return rows;
  }, [pillGroups, weekStart]);

  const handleDragStart = useCallback((e: React.DragEvent, group: ShiftGroup) => {
    setDraggedGroup(group);
    e.dataTransfer.effectAllowed = 'move';
    // Set transparent drag image or custom one if needed
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, dayKey: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverDay(dayKey);
  }, []);

  const handleDragLeave = useCallback(() => {
    setDragOverDay(null);
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent, targetDateStr: string) => {
    e.preventDefault();
    setDragOverDay(null);

    if (!draggedGroup || !onScheduleUpdate) return;

    const targetMoment = moment(targetDateStr);
    const startMoment = moment(draggedGroup.startDate);
    const diffDays = targetMoment.diff(startMoment, 'days');

    if (diffDays === 0) return; // No change in date

    // Update all schedules in the group
    const updatedSchedules = draggedGroup.shifts.map(schedule => {
      const newDate = moment(schedule.date).add(diffDays, 'days').format('YYYY-MM-DD');
      return { ...schedule, date: newDate };
    });

    try {
      // Update each schedule via API
      await Promise.all(updatedSchedules.map(async (schedule) => {
        await apiService.updateSchedule(schedule.id, {
          date: schedule.date,
          shiftType: schedule.shiftType,
          isScreener: schedule.isScreener
        });
      }));

      onScheduleUpdate(updatedSchedules);
    } catch (error) {
      console.error('Failed to update schedules:', error);
      alert('Failed to update schedules. Please try again.');
    } finally {
      setDraggedGroup(null);
    }
  }, [draggedGroup, onScheduleUpdate]);

  // Generate week days for the grid
  const weekDays = useMemo(() => {
    const days = [];
    for (let i = 0; i < 7; i++) {
      days.push(weekStart.clone().add(i, 'days'));
    }
    return days;
  }, [weekStart]);

  return (
    <div className="flex flex-col h-full relative z-10 select-none p-4">
      {/* Header Row - Separated for alignment and styling */}
      <div className="grid grid-cols-7 mb-1">
        {weekDays.map((day) => {
          const isToday = day.isSame(moment(), 'day');
          return (
            <div key={day.format('YYYY-MM-DD')} className="text-center py-2">
              <div className="font-medium text-sm text-gray-700 dark:text-gray-400 uppercase mb-1">
                {day.format('ddd')}
              </div>
              <div className={`
                text-lg font-semibold w-8 h-8 flex items-center justify-center rounded-full mx-auto transition-colors
                ${isToday ? 'bg-[#F00046] text-white shadow-sm' : 'text-gray-900 dark:text-white'}
              `}>
                {day.format('D')}
              </div>
            </div>
          );
        })}
      </div>

      {/* Main Content Container with Rounded Corners and Glass Effect */}
      <div className="flex-1 overflow-hidden relative rounded-2xl border border-gray-200/60 dark:border-gray-700/60 shadow-sm bg-white/40 dark:bg-gray-900/20 backdrop-blur-sm">
        <div className="h-full overflow-y-auto relative custom-scrollbar">

          {/* Background Grid (Columns) */}
          <div className="absolute inset-0 grid grid-cols-7 divide-x divide-gray-200/50 dark:divide-gray-700/50 h-full min-h-[500px]">
            {weekDays.map((day) => {
              const dayStr = day.format('YYYY-MM-DD');
              const isToday = day.isSame(moment(), 'day');

              return (
                <div
                  key={dayStr}
                  className={`
                    h-full relative flex flex-col group
                    ${isToday ? 'bg-primary/5' : 'bg-transparent'}
                    ${dragOverDay === dayStr ? 'bg-blue-50/50 dark:bg-blue-900/20' : ''}
                    hover:bg-white/60 dark:hover:bg-gray-800/40 transition-colors
                  `}
                  onClick={() => onDateClick?.(day.toDate())}
                  onDragOver={(e) => handleDragOver(e, dayStr)}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => handleDrop(e, dayStr)}
                >
                  {/* Full height click area */}
                  <div className="flex-1 w-full" />
                </div>
              );
            })}
          </div>

          {/* Content Layer (Pills) */}
          <div className="relative z-10 pointer-events-none pt-1 px-1 min-h-[500px]">
            {stackedPills.length > 0 && (
              <div
                className="grid grid-cols-7 gap-1"
                style={{
                  gridTemplateRows: `repeat(${stackedPills.length}, 28px)`,
                  rowGap: '4px'
                }}
              >
                {stackedPills.map((row, rowIdx) => (
                  <React.Fragment key={rowIdx}>
                    {row.map((pill) => (
                      <div
                        key={`${pill.group.analystId}-${pill.group.startDate}`}
                        className="pointer-events-auto"
                        style={{
                          gridColumnStart: pill.colStart,
                          gridColumnEnd: `span ${pill.colSpan}`,
                          gridRowStart: rowIdx + 1
                        }}
                        draggable
                        onDragStart={(e) => handleDragStart(e, pill.group)}
                      >
                        <ShiftPill
                          group={pill.group}
                          gridColumnStart={pill.colStart}
                          gridColumnSpan={pill.colSpan}
                          zIndex={rowIdx}
                          onClick={() => {
                            if (pill.group.shifts.length > 0) {
                              onScheduleClick?.(pill.group.shifts);
                            }
                          }}
                        />
                      </div>
                    ))}
                  </React.Fragment>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default WeekScheduleView;
