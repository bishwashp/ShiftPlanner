import moment from 'moment-timezone';

export const dateUtils = {
    /**
     * Formats a date for API submission (YYYY-MM-DD).
     * Ensures the date is treated as a calendar date.
     */
    toApiDate: (date: string | Date): string => {
        return moment.utc(date).format('YYYY-MM-DD');
    },

    /**
     * Formats a date for display (e.g., "MMM DD, YYYY").
     * Uses UTC mode to ensure "Dec 2" stays "Dec 2".
     */
    formatDisplayDate: (date: string | Date, format: string = 'MMM DD, YYYY'): string => {
        return moment.utc(date).format(format);
    },

    /**
     * Formats a date for HTML input (YYYY-MM-DD).
     */
    toInputDate: (date: string | Date): string => {
        return moment.utc(date).format('YYYY-MM-DD');
    },

    /**
     * Calculates duration in days between two dates.
     */
    getDurationInDays: (startDate: string | Date, endDate: string | Date): number => {
        const start = moment.utc(startDate).startOf('day');
        const end = moment.utc(endDate).startOf('day');
        return end.diff(start, 'days') + 1;
    }
};
