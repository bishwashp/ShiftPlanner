import moment from 'moment';
import { Schedule } from '../services/api';

export interface CalendarEvent {
    id: string;
    title: string;
    date: string; // YYYY-MM-DD
    resource: Schedule;
}

export interface ShiftGroup {
    analystId: string;
    analystName: string;
    startDate: string; // YYYY-MM-DD
    endDate: string;   // YYYY-MM-DD
    dayCount: number;
    isScreener: boolean;
    isWeekend: boolean;
    shiftType: string;
    shifts: Schedule[];
    startsBeforeWeek?: boolean;
    extendsAfterWeek?: boolean;
}

/**
 * Groups consecutive shifts for the same analyst into pills.
 * Uses strict YYYY-MM-DD date comparison to avoid timezone issues.
 * 
 * @param events - Array of CalendarEvents with pre-calculated YYYY-MM-DD dates
 * @param weekStartStr - Week start date string (YYYY-MM-DD)
 * @param weekEndStr - Week end date string (YYYY-MM-DD)
 */
export function groupConsecutiveShifts(
    events: CalendarEvent[],
    weekStartStr?: string,
    weekEndStr?: string
): ShiftGroup[] {
    if (!events || events.length === 0) return [];

    // Sort by analyst, then by date string
    const sorted = [...events].sort((a, b) => {
        if (a.resource.analystId !== b.resource.analystId) {
            return a.resource.analystId.localeCompare(b.resource.analystId);
        }
        return a.date.localeCompare(b.date);
    });

    const groups: ShiftGroup[] = [];
    let currentGroup: ShiftGroup | null = null;

    for (const event of sorted) {
        const eventDate = event.date; // YYYY-MM-DD
        const shift = event.resource;

        // Calculate weekend status based on the YYYY-MM-DD date
        // We use moment(YYYY-MM-DD) which parses as local, but since we only care about day of week
        // and we are consistent, it works. Better yet, use explicit day check.
        const dayOfWeek = moment(eventDate).day();
        const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

        // Determine if we should start a new group
        let shouldStartNewGroup = true;

        if (currentGroup) {
            // Check if same analyst
            const sameAnalyst = currentGroup.analystId === shift.analystId;

            // Check if consecutive date
            // Add 1 day to currentGroup.endDate and see if it matches eventDate
            const nextDay = moment(currentGroup.endDate).add(1, 'day').format('YYYY-MM-DD');
            const isConsecutive = nextDay === eventDate;

            // Check if same properties
            const sameWeekend = currentGroup.isWeekend === isWeekend;
            const sameScreener = currentGroup.isScreener === shift.isScreener;
            const sameType = currentGroup.shiftType === shift.shiftType;

            if (sameAnalyst && isConsecutive && sameWeekend && sameScreener && sameType) {
                shouldStartNewGroup = false;
            }
        }

        if (shouldStartNewGroup) {
            // Finalize previous group
            if (currentGroup) {
                groups.push(currentGroup);
            }

            // Start new group
            currentGroup = {
                analystId: shift.analystId,
                analystName: event.title,
                startDate: eventDate,
                endDate: eventDate,
                dayCount: 1,
                isScreener: shift.isScreener,
                isWeekend: isWeekend,
                shiftType: shift.shiftType,
                shifts: [shift]
            };
        } else if (currentGroup) {
            // Extend current group
            currentGroup.endDate = eventDate;
            currentGroup.dayCount++;
            currentGroup.shifts.push(shift);
        }
    }

    // Add last group
    if (currentGroup) {
        groups.push(currentGroup);
    }

    // Detect week overflow using string comparison
    if (weekStartStr && weekEndStr) {
        groups.forEach(group => {
            group.startsBeforeWeek = group.startDate < weekStartStr;
            group.extendsAfterWeek = group.endDate > weekEndStr;
        });
    }

    return groups;
}
