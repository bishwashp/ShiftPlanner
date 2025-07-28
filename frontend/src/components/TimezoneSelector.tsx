import React from 'react';
import { timezones } from '../utils/timezones';

interface TimezoneSelectorProps {
  timezone: string;
  onTimezoneChange: (tz: string) => void;
}

const TimezoneSelector: React.FC<TimezoneSelectorProps> = ({ timezone, onTimezoneChange }) => {
  return (
    <select 
      value={timezone} 
      onChange={(e) => onTimezoneChange(e.target.value)}
      className="px-3 py-2 text-sm border border-border rounded-md bg-card text-card-foreground focus:ring-2 focus:ring-primary"
    >
      {Object.entries(timezones).map(([region, zones]) => (
        <optgroup label={region} key={region}>
          {zones.map(tz => (
            <option key={tz} value={tz}>{tz.replace(/_/g, ' ')}</option>
          ))}
        </optgroup>
      ))}
    </select>
  );
};

export default TimezoneSelector; 