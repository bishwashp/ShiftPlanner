import React from 'react';
import { timezones } from '../utils/timezones';
import SpringDropdown from './ui/SpringDropdown';

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

  const groupedOptions = Object.entries(timezones).map(([region, zones]) => ({
    label: region,
    options: zones.map(tz => ({
      value: tz,
      label: getFullLabel(tz)
    }))
  }));

  return (
    <SpringDropdown
      value={timezone}
      onChange={onTimezoneChange}
      groupedOptions={groupedOptions}
    />
  );
};

export default TimezoneSelector;