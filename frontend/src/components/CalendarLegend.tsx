import React, { useState } from 'react';
import { Question } from '@phosphor-icons/react';

const LegendItem: React.FC<{ color: string, label: string }> = ({ color, label }) => (
  <div className="flex items-center space-x-2">
    <div className={`w-3 h-3 rounded-full ${color}`}></div>
    <span className="text-sm text-gray-700 dark:text-gray-200">{label}</span>
  </div>
);

const CalendarLegend: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        onBlur={() => setIsOpen(false)}
        className="p-2 rounded-md hover:bg-muted"
      >
        <Question className="h-5 w-5" />
      </button>
      {isOpen && (
        <div
          className="absolute top-full right-0 mt-2 w-48 glass-static text-card-foreground p-4 z-10"
          onMouseDown={(e) => e.preventDefault()} // Prevents onBlur from closing the popover when clicking inside
        >
          <h3 className="font-bold mb-3 text-foreground">Legend</h3>
          <div className="space-y-2">
            <LegendItem color="bg-blue-500" label="Morning Shift" />
            <LegendItem color="bg-purple-500" label="Evening Shift" />
            <LegendItem color="bg-green-500" label="Weekend Shift" />
            <LegendItem color="bg-amber-500" label="Screener Shift" />
          </div>
        </div>
      )}
    </div>
  );
};

export default CalendarLegend; 