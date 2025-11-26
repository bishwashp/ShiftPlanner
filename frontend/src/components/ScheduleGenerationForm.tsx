import React, { useState } from 'react';
import { CalendarBlank, Clock, Users } from '@phosphor-icons/react';
import moment from 'moment';
import Button from './ui/Button';

interface ScheduleGenerationFormProps {
  onGenerate: (startDate: string, endDate: string, algorithm: string) => void;
  isLoading: boolean;
}

const ScheduleGenerationForm: React.FC<ScheduleGenerationFormProps> = ({
  onGenerate,
  isLoading
}) => {
  const [startDate, setStartDate] = useState(moment().format('YYYY-MM-DD'));
  const [endDate, setEndDate] = useState(moment().add(7, 'days').format('YYYY-MM-DD'));
  // Single algorithm: IntelligentScheduler
  const algorithm = 'INTELLIGENT';

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onGenerate(startDate, endDate, algorithm);
  };

  // Removed algorithm selection - using single IntelligentScheduler

  return (
    <div className="glass-static p-6">
      <div className="flex items-center space-x-3 mb-6">
        <CalendarBlank className="h-6 w-6 text-primary" />
        <div>
          <h3 className="text-lg font-semibold">Generate Schedule</h3>
          <p className="text-sm text-gray-700 dark:text-gray-200">
            Create schedules for your analysts
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Date Range */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-2">
              Start Date
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground focus:ring-2 focus:ring-primary focus:border-transparent"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">
              End Date
            </label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground focus:ring-2 focus:ring-primary focus:border-transparent"
              required
            />
          </div>
        </div>

        {/* Algorithm selection removed - using single IntelligentScheduler */}

        {/* Preview Info */}
        <div className="bg-muted/50 rounded-lg p-4">
          <div className="flex items-center space-x-2 mb-2">
            <Clock className="h-4 w-4 text-gray-700 dark:text-gray-200" />
            <span className="text-sm font-medium">Preview</span>
          </div>
          <div className="text-sm text-gray-700 dark:text-gray-200">
            <p>• Duration: {moment(endDate).diff(moment(startDate), 'days') + 1} days</p>
            <p>• Using: Intelligent Scheduling (rotation + fairness)</p>
            <p>• This will generate schedules for all active analysts</p>
          </div>
        </div>

        {/* Generate Button */}
        <Button
          type="submit"
          disabled={isLoading || !startDate || !endDate}
          isLoading={isLoading}
          variant="primary"
          className="w-full"
        >
          {!isLoading && <Users className="h-4 w-4 mr-2" />}
          Generate Schedule
        </Button>
      </form>
    </div>
  );
};

export default ScheduleGenerationForm;
