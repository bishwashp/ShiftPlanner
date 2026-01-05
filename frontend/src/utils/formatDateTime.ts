import moment from 'moment-timezone';

export const formatDateTime = (date: string | Date, timezone?: string, format = 'MMM D, YYYY, h:mm A z') => {
  if (timezone) {
    return moment(date).tz(timezone).format(format);
  }
  return moment(date).format(format);
}; 