import React, { useState, useMemo, useCallback } from 'react';
import moment from 'moment-timezone';
import { apiService, Schedule, Analyst } from '../../../services/api';
import { Clock, Warning } from '@phosphor-icons/react';

interface CalendarEvent {
  id: string;
  title: string;
  date: string; // YYYY-MM-DD format
  resource: Schedule;
}

interface WeekScheduleViewProps {
  date: Date;
  timezone: string;
  onDateChange: (date: Date) => void;
  onReturnToMonth: () => void;
  clickedDay?: Date; // Remember which day was clicked
  events: CalendarEvent[];
  analysts: Analyst[];
  onScheduleUpdate?: (schedules: Schedule[]) => void;
  onScheduleClick?: (schedule: Schedule) => void;
}

interface DaySchedule {
  date: moment.Moment;
  schedules: Schedule[];
  morningSchedules: Schedule[];
  eveningSchedules: Schedule[];
  conflicts: string[];
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
  onScheduleClick
}) => {
  const [draggedSchedule, setDraggedSchedule] = useState<Schedule | null>(null);
  const [dragOverDay, setDragOverDay] = useState<string | null>(null);

  // Calculate Sunday-Saturday week containing the clicked day or current date
  const weekStart = useMemo(() => {
    const targetDate = clickedDay || date;
    const momentDate = moment(targetDate).tz(timezone);
    return momentDate.startOf('week'); // Sunday start
  }, [date, clickedDay, timezone]);

  // Debug logging for schedules data - removed to fix infinite loop

  const weekDays = useMemo(() => {
    const days: DaySchedule[] = [];

    for (let i = 0; i < 7; i++) {
      const dayDate = weekStart.clone().add(i, 'days');
      const dayString = dayDate.format('YYYY-MM-DD');

      // Use same filtering logic as CalendarGrid
      const dayEvents = events.filter(event =>
        event.date === dayString
      );

      // Extract schedules from events
      const daySchedules = dayEvents.map(event => event.resource);

      const morningSchedules = daySchedules.filter(s => s.shiftType === 'MORNING');
      const eveningSchedules = daySchedules.filter(s => s.shiftType === 'EVENING');

      // Context-aware conflict detection following backend logic
      const conflicts: string[] = [];
      const morningScreeners = morningSchedules.filter(s => s.isScreener);
      const eveningScreeners = eveningSchedules.filter(s => s.isScreener);
      const dayOfWeek = dayDate.day(); // 0 = Sunday, 6 = Saturday
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
      const isPastDate = dayDate.isBefore(moment().startOf('day'));

      // Don't show conflicts for past dates
      if (isPastDate) {
        // Past dates don't need conflict checking
      } else {
        // Check for multiple screeners (only on weekdays)
        if (!isWeekend) {
          if (morningScreeners.length > 1) {
            conflicts.push('Multiple morning screeners');
          }
          if (eveningScreeners.length > 1) {
            conflicts.push('Multiple evening screeners');
          }
        }

        // Only show coverage conflicts if there are existing schedules for this date
        // This prevents showing conflicts when no schedules should exist
        // Only show coverage conflicts if there are existing schedules for this date
        // This prevents showing conflicts when no schedules should exist
        if (daySchedules.length > 0) {
          // Skip coverage checks on weekends as per business rules
          if (!isWeekend) {
            if (morningSchedules.length === 0) {
              conflicts.push('No morning coverage');
            }
            if (eveningSchedules.length === 0) {
              conflicts.push('No evening coverage');
            }
          }

          // Check for missing screeners on weekdays (only if there are schedules)
          if (!isWeekend && daySchedules.length > 0) {
            if (morningSchedules.length > 0 && morningScreeners.length === 0) {
              conflicts.push('Morning screener missing');
            }
            if (eveningSchedules.length > 0 && eveningScreeners.length === 0) {
              conflicts.push('Evening screener missing');
            }
          }
        }
      }

      days.push({
        date: dayDate,
        schedules: daySchedules,
        morningSchedules,
        eveningSchedules,
        conflicts
      });
    }
    return days;
  }, [weekStart, events]);

  const getAnalystName = useCallback((analystId: string) => {
    const analyst = analysts.find(a => a.id === analystId);
    return analyst?.name || 'Unknown Analyst';
  }, [analysts]);

  const handleDragStart = useCallback((e: React.DragEvent, schedule: Schedule) => {
    setDraggedSchedule(schedule);
    e.dataTransfer.effectAllowed = 'move';
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, dayKey: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverDay(dayKey);
  }, []);

  const handleDragLeave = useCallback(() => {
    setDragOverDay(null);
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent, targetDay: moment.Moment) => {
    e.preventDefault();

    if (!draggedSchedule) return;

    const newDate = targetDay.toDate();

    try {
      // Validate the move first
      const validationResult = await apiService.validateSchedule({
        analystId: draggedSchedule.analystId,
        date: newDate.toISOString(),
        shiftType: draggedSchedule.shiftType,
        isScreener: draggedSchedule.isScreener,
        scheduleId: draggedSchedule.id
      });

      // Check for hard violations
      const hardViolations = validationResult.violations.filter((v: any) => v.type === 'HARD');
      if (hardViolations.length > 0) {
        const messages = hardViolations.map((v: any) => `• ${v.description}`).join('\n');
        alert(`Cannot move schedule due to critical conflicts:\n\n${messages}`);
        return;
      }

      // Check for soft violations
      const softViolations = validationResult.violations.filter((v: any) => v.type === 'SOFT');
      if (softViolations.length > 0) {
        const messages = softViolations.map((v: any) => `• ${v.description}`).join('\n');
        const confirmed = window.confirm(`Warning: This move causes the following conflicts:\n\n${messages}\n\nDo you want to proceed anyway?`);
        if (!confirmed) return;
      }

      // Update the schedule date
      const updatedSchedule = {
        ...draggedSchedule,
        date: newDate.toISOString()
      };

      // Call API to update schedule
      await apiService.updateSchedule(draggedSchedule.id, {
        date: newDate.toISOString(),
        shiftType: draggedSchedule.shiftType,
        isScreener: draggedSchedule.isScreener
      });

      // Update local state - convert events back to schedules for the callback
      const updatedSchedules = events.map(event =>
        event.resource.id === draggedSchedule.id ? updatedSchedule : event.resource
      );

      onScheduleUpdate?.(updatedSchedules);

    } catch (error) {
      console.error('Failed to update schedule:', error);
      alert('Failed to update schedule. Please try again.');
    } finally {
      setDraggedSchedule(null);
      setDragOverDay(null);
    }
  }, [draggedSchedule, events, onScheduleUpdate]);



  const isClickedDay = useCallback((dayDate: moment.Moment) => {
    return clickedDay && moment(clickedDay).tz(timezone).isSame(dayDate, 'day');
  }, [clickedDay, timezone]);

  return (
    <div className="flex flex-col h-full relative z-10">
      {/* Week Grid - Desktop: 7 columns, Mobile: Vertical stack */}
      <div className="flex-1 overflow-auto">
        <div className="grid grid-cols-1 lg:grid-cols-7 h-full divide-x divide-gray-200 dark:divide-gray-700 border-x border-gray-200 dark:border-gray-700">
          {weekDays.map((day) => {
            const isToday = day.date.isSame(moment(), 'day');
            return (
              <div
                key={day.date.format('YYYY-MM-DD')}
                className={`
                  p-3 min-h-[200px] text-card-foreground
                  ${isClickedDay(day.date) ? 'bg-primary/5' : ''}
                  ${dragOverDay === day.date.format('YYYY-MM-DD') ? 'bg-blue-50 dark:bg-blue-950/20' : ''}
                  ${day.conflicts.length > 0 ? 'bg-red-50 dark:bg-red-950/20' : ''}
                `}
                onDragOver={(e) => handleDragOver(e, day.date.format('YYYY-MM-DD'))}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, day.date)}
              >
                {/* Day Header */}
                <div className="flex flex-col items-center justify-center mb-4 pt-2">
                  <div className="font-medium text-sm text-gray-500 dark:text-gray-400 uppercase mb-1">
                    {day.date.format('ddd')}
                  </div>
                  <div className={`
                    text-lg font-semibold w-8 h-8 flex items-center justify-center rounded-full
                    ${isToday ? 'bg-[#F00046] text-white shadow-sm' : 'text-foreground'}
                  `}>
                    {day.date.format('D')}
                  </div>

                  {day.conflicts.length > 0 && (
                    <Warning className="h-4 w-4 text-red-500 mt-1" />
                  )}
                </div>

                {/* Morning Shift */}
                <div className="mb-3">
                  <div className="flex items-center space-x-1 mb-2">
                    <Clock className="h-3 w-3 text-blue-500" />
                    <span className="text-xs font-medium text-blue-700">Morning</span>
                  </div>
                  <div className="space-y-1">
                    {day.morningSchedules.map((schedule) => (
                      <div
                        key={schedule.id}
                        draggable
                        onDragStart={(e) => handleDragStart(e, schedule)}
                        onClick={() => onScheduleClick?.(schedule)}
                        className={`
                          p-2 rounded text-xs cursor-move transition-colors
                          ${schedule.isScreener
                            ? 'bg-yellow-200 text-yellow-800 border border-yellow-300'
                            : 'bg-blue-100 text-blue-800 border border-blue-200'
                          }
                          ${day.conflicts.length > 0 ? 'ring-1 ring-red-300' : ''}
                          hover:opacity-80
                        `}
                      >
                        <div className="font-medium">
                          {getAnalystName(schedule.analystId)}
                        </div>
                        {schedule.isScreener && (
                          <div className="text-xs opacity-75">Screener</div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Evening Shift */}
                <div>
                  <div className="flex items-center space-x-1 mb-2">
                    <Clock className="h-3 w-3 text-purple-500" />
                    <span className="text-xs font-medium text-purple-700">Evening</span>
                  </div>
                  <div className="space-y-1">
                    {day.eveningSchedules.map((schedule) => (
                      <div
                        key={schedule.id}
                        draggable
                        onDragStart={(e) => handleDragStart(e, schedule)}
                        onClick={() => onScheduleClick?.(schedule)}
                        className={`
                          p-2 rounded text-xs cursor-move transition-colors
                          ${schedule.isScreener
                            ? 'bg-yellow-200 text-yellow-800 border border-yellow-300'
                            : 'bg-purple-100 text-purple-800 border border-purple-200'
                          }
                          ${day.conflicts.length > 0 ? 'ring-1 ring-red-300' : ''}
                          hover:opacity-80
                        `}
                      >
                        <div className="font-medium">
                          {getAnalystName(schedule.analystId)}
                        </div>
                        {schedule.isScreener && (
                          <div className="text-xs opacity-75">Screener</div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Conflicts Display */}
                {day.conflicts.length > 0 && (
                  <div className="mt-3 p-2 bg-red-100 dark:bg-red-950/30 border border-red-300 dark:border-red-700 rounded text-xs">
                    <div className="font-medium text-red-800 dark:text-red-200 mb-1">Conflicts:</div>
                    {day.conflicts.map((conflict, index) => (
                      <div key={index} className="text-red-700 dark:text-red-300">• {conflict}</div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default WeekScheduleView;
