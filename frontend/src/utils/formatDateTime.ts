import moment from 'moment-timezone';

export const formatDateTime = (date: string | Date, timezone: string, format = 'MMM D, YYYY, h:mm A z') => {
  return moment(date).tz(timezone).format(format);
}; 