import React, { useState, useMemo, useCallback } from 'react';
import moment from 'moment-timezone';
import { apiService, Schedule, Analyst } from '../../../services/api';
import { ChevronLeft, ChevronRight, Calendar, Clock, AlertTriangle } from 'lucide-react';

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
  onScheduleUpdate
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
        if (daySchedules.length > 0) {
          if (morningSchedules.length === 0) {
            conflicts.push('No morning coverage');
          }
          if (eveningSchedules.length === 0) {
            conflicts.push('No evening coverage');
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
    } finally {
      setDraggedSchedule(null);
      setDragOverDay(null);
    }
  }, [draggedSchedule, events, onScheduleUpdate]);

  const handlePrevWeek = useCallback(() => {
    const newDate = weekStart.clone().subtract(1, 'week').toDate();
    onDateChange(newDate);
  }, [weekStart, onDateChange]);

  const handleNextWeek = useCallback(() => {
    const newDate = weekStart.clone().add(1, 'week').toDate();
    onDateChange(newDate);
  }, [weekStart, onDateChange]);

  const isClickedDay = useCallback((dayDate: moment.Moment) => {
    return clickedDay && moment(clickedDay).tz(timezone).isSame(dayDate, 'day');
  }, [clickedDay, timezone]);

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Week Header */}
      <div className="flex items-center justify-between p-4 border-b border-border">
        <div className="flex items-center space-x-4">
          <button
            onClick={onReturnToMonth}
            className="flex items-center space-x-2 px-3 py-2 text-sm font-medium rounded-md border border-border hover:bg-muted"
          >
            <Calendar className="h-4 w-4" />
            <span>Month View</span>
          </button>
          
          <div className="flex items-center space-x-2">
            <button
              onClick={handlePrevWeek}
              className="p-2 rounded-md hover:bg-muted"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            
            <h2 className="text-lg font-semibold min-w-[200px] text-center">
              {weekStart.format('MMM D')} - {weekStart.clone().add(6, 'days').format('MMM D, YYYY')}
            </h2>
            
            <button
              onClick={handleNextWeek}
              className="p-2 rounded-md hover:bg-muted"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
        
        <div className="text-sm text-muted-foreground">
          {weekDays.reduce((total, day) => total + day.schedules.length, 0)} total assignments
        </div>
      </div>

      {/* Week Grid - Desktop: 7 columns, Mobile: Vertical stack */}
      <div className="flex-1 overflow-auto">
        <div className="grid grid-cols-1 lg:grid-cols-7 gap-4 p-4">
          {weekDays.map((day) => (
            <div
              key={day.date.format('YYYY-MM-DD')}
              className={`
                border border-border rounded-lg p-3 min-h-[200px] bg-card text-card-foreground
                ${isClickedDay(day.date) ? 'ring-2 ring-primary bg-primary/5' : ''}
                ${dragOverDay === day.date.format('YYYY-MM-DD') ? 'ring-2 ring-blue-500 bg-blue-50 dark:bg-blue-950/20' : ''}
                ${day.conflicts.length > 0 ? 'border-red-300 dark:border-red-700 bg-red-50 dark:bg-red-950/20' : ''}
              `}
              onDragOver={(e) => handleDragOver(e, day.date.format('YYYY-MM-DD'))}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, day.date)}
            >
              {/* Day Header */}
              <div className="flex items-center justify-between mb-3">
                <div>
                  <div className="font-semibold text-sm text-muted-foreground">
                    {day.date.format('ddd')}
                  </div>
                  <div className="text-lg font-bold text-foreground">
                    {day.date.format('D')}
                  </div>
                </div>
                
                {day.conflicts.length > 0 && (
                  <AlertTriangle className="h-4 w-4 text-red-500" />
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
          ))}
        </div>
      </div>
    </div>
  );
};

export default WeekScheduleView;
