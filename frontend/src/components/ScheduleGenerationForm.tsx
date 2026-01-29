import React, { useState } from 'react';
import { CalendarBlank, Clock, Users, Trash, Warning } from '@phosphor-icons/react';
import moment from 'moment';
import Button from './ui/Button';
import { apiService } from '../services/api';

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

  // Clear functionality state
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const [clearResult, setClearResult] = useState<{ message: string } | null>(null);

  const handleClearSchedule = async () => {
    setIsClearing(true);
    try {
      const result = await apiService.deleteSchedulesInRange(startDate, endDate);
      setClearResult({ message: result.message || `Cleared ${result.count} schedules.` });
      // Close modal after short delay or manually? Let's just show success in the modal or close it.
      // For simplicity, let's close and let parent handle notification if we had a callback, 
      // but here we just show local success state or close.
      setTimeout(() => {
        setShowClearConfirm(false);
        setClearResult(null);
      }, 2000);
    } catch (error) {
      console.error("Failed to clear schedules", error);
      // Ideally show error in modal
    } finally {
      setIsClearing(false);
    }
  };

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

        {/* Clear & Generate Buttons */}
        <div className="space-y-3">
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

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-border" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">Or</span>
            </div>
          </div>

          <Button
            type="button"
            onClick={() => setShowClearConfirm(true)}
            disabled={isLoading || isClearing || !startDate || !endDate}
            variant="outline-danger"
            className="w-full border-red-200 text-red-600 hover:bg-red-50 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-900/20"
          >
            <Trash className="h-4 w-4 mr-2" />
            Clear Schedule (Delete)
          </Button>
        </div>
      </form>

      {/* Clear Confirmation Modal */}
      {showClearConfirm && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full p-6 border border-gray-200 dark:border-gray-700">
            {clearResult ? (
              <div className="text-center py-4">
                <div className="w-12 h-12 rounded-full bg-green-100 text-green-600 flex items-center justify-center mx-auto mb-4">
                  <Users className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-semibold text-green-600 mb-2">Success!</h3>
                <p className="text-gray-600 dark:text-gray-300">{clearResult.message}</p>
              </div>
            ) : (
              <>
                <div className="flex items-center space-x-3 text-red-600 mb-4">
                  <Warning className="w-8 h-8" />
                  <h3 className="text-lg font-bold">Clear Schedule?</h3>
                </div>

                <p className="text-gray-600 dark:text-gray-300 mb-4">
                  Are you sure you want to permanently delete <strong>ALL</strong> schedules from <br />
                  <span className="font-mono bg-gray-100 dark:bg-gray-900 px-1 rounded">{startDate}</span> to <span className="font-mono bg-gray-100 dark:bg-gray-900 px-1 rounded">{endDate}</span>?
                </p>

                <div className="bg-red-50 dark:bg-red-900/20 p-3 rounded text-sm text-red-700 dark:text-red-300 mb-6">
                  <strong>Warning:</strong> This action cannot be undone. Any manual edits in this range will be lost.
                </div>

                <div className="flex justify-end space-x-3">
                  <Button
                    variant="secondary"
                    onClick={() => setShowClearConfirm(false)}
                    disabled={isClearing}
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="danger"
                    onClick={handleClearSchedule}
                    isLoading={isClearing}
                  >
                    Yes, Delete All
                  </Button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default ScheduleGenerationForm;
