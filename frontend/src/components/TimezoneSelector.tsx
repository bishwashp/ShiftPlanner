import React from 'react';
import { timezones } from '../utils/timezones';

interface TimezoneSelectorProps {
  timezone: string;
  onTimezoneChange: (tz: string) => void;
}

const TimezoneSelector: React.FC<TimezoneSelectorProps> = ({ timezone, onTimezoneChange }) => {
  // Mobile-friendly timezone labels
  const getShortLabel = (tz: string): string => {
    const shortLabels: { [key: string]: string } = {
      'America/New_York': 'EST',
      'America/Chicago': 'CST',
      'America/Denver': 'MST',
      'America/Los_Angeles': 'PST',
      'America/Anchorage': 'AKST',
      'Pacific/Honolulu': 'HST',
      'Asia/Tokyo': 'JST',
      'Asia/Shanghai': 'CST',
      'Asia/Kolkata': 'IST',
      'Australia/Sydney': 'AEST',
      'Asia/Singapore': 'SGT',
      'Europe/London': 'GMT',
      'Europe/Paris': 'CET',
      'Europe/Moscow': 'MSK',
      'Asia/Dubai': 'GST',
      'Africa/Johannesburg': 'SAST'
    };
    return shortLabels[tz] || tz.split('/')[1]?.replace(/_/g, ' ') || tz;
  };

  const getFullLabel = (tz: string): string => {
    const shortLabel = getShortLabel(tz);
    const fullName = tz.replace(/_/g, ' ');
    return `(${shortLabel}) ${fullName}`;
  };

  return (
    <select
      value={timezone}
      onChange={(e) => onTimezoneChange(e.target.value)}
      className="px-2 py-2 text-sm border border-border rounded-md glass-static text-card-foreground focus:ring-2 focus:ring-primary min-h-[44px] w-16 sm:w-auto"
      title={`Current timezone: ${getFullLabel(timezone)}`}
    >
      {Object.entries(timezones).map(([region, zones]) => (
        <optgroup label={region} key={region}>
          {zones.map(tz => (
            <option key={tz} value={tz}>
              {getFullLabel(tz)}
            </option>
          ))}
        </optgroup>
      ))}
    </select>
  );
};

export default TimezoneSelector; 