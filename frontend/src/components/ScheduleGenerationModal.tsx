import React, { useState, useCallback } from 'react';
import { X, Calendar, CheckCircle } from 'lucide-react';
import moment from 'moment';

interface GeneratedSchedule {
  date: string;
  analystId: string;
  analystName: string;
  shiftType: 'MORNING' | 'EVENING';
  isScreener: boolean;
  type: 'NEW_SCHEDULE';
}

interface ScheduleGenerationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApply: (schedules: GeneratedSchedule[]) => void;
  generatedSchedules: GeneratedSchedule[];
  summary: {
    totalConflicts: number;
    criticalConflicts: number;
    assignmentsNeeded: number;
    estimatedTime: string;
  };
  isLoading: boolean;
}

const ScheduleGenerationModal: React.FC<ScheduleGenerationModalProps> = ({
  isOpen,
  onClose,
  onApply,
  generatedSchedules,
  summary,
  isLoading
}) => {
  const [selectedSchedules, setSelectedSchedules] = useState<Set<string>>(new Set());

  const handleSelectAll = useCallback(() => {
    if (selectedSchedules.size === generatedSchedules.length) {
      setSelectedSchedules(new Set());
    } else {
      setSelectedSchedules(new Set(generatedSchedules.map(s => `${s.date}-${s.analystId}`)));
    }
  }, [selectedSchedules.size, generatedSchedules]);

  const handleSelectSchedule = useCallback((scheduleKey: string) => {
    const newSelected = new Set(selectedSchedules);
    if (newSelected.has(scheduleKey)) {
      newSelected.delete(scheduleKey);
    } else {
      newSelected.add(scheduleKey);
    }
    setSelectedSchedules(newSelected);
  }, [selectedSchedules]);

  const handleApply = useCallback(() => {
    const schedulesToApply = generatedSchedules.filter(s => 
      selectedSchedules.has(`${s.date}-${s.analystId}`)
    );
    onApply(schedulesToApply);
  }, [generatedSchedules, selectedSchedules, onApply]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-background border border-border rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] min-h-[60vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-border">
          <div className="flex items-center space-x-3">
            <Calendar className="h-6 w-6 text-primary" />
            <div>
              <h2 className="text-xl font-semibold">Schedule Preview</h2>
              <p className="text-sm text-muted-foreground">
                Review and select schedules to apply
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-muted rounded-md transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Summary Stats */}
        <div className="p-6 border-b border-border">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-primary">{summary.assignmentsNeeded}</div>
              <div className="text-sm text-muted-foreground">Assignments</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-orange-500">{summary.totalConflicts}</div>
              <div className="text-sm text-muted-foreground">Conflicts</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-red-500">{summary.criticalConflicts}</div>
              <div className="text-sm text-muted-foreground">Critical</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-500">{summary.estimatedTime}</div>
              <div className="text-sm text-muted-foreground">Est. Time</div>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden flex flex-col">
          {isLoading ? (
            <div className="flex items-center justify-center h-64">
              <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
                <p className="text-muted-foreground">Generating schedules...</p>
              </div>
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100">
              {/* Select All */}
              <div className="p-4 border-b border-border">
                <button
                  onClick={handleSelectAll}
                  className="flex items-center space-x-2 px-4 py-2 bg-primary/10 text-primary rounded-md hover:bg-primary/20 transition-colors"
                >
                  <CheckCircle className="h-4 w-4" />
                  <span>
                    {selectedSchedules.size === generatedSchedules.length ? 'Deselect All' : 'Select All'}
                  </span>
                  <span className="text-sm text-muted-foreground">
                    ({selectedSchedules.size}/{generatedSchedules.length})
                  </span>
                </button>
              </div>

              {/* Schedule List */}
              <div className="p-4 pb-6 space-y-2">
                {generatedSchedules.map((schedule, index) => {
                  const scheduleKey = `${schedule.date}-${schedule.analystId}`;
                  const isSelected = selectedSchedules.has(scheduleKey);
                  
                  return (
                    <div
                      key={scheduleKey}
                      className={`p-4 border rounded-lg cursor-pointer transition-all ${
                        isSelected 
                          ? 'border-primary bg-primary/5' 
                          : 'border-border hover:border-primary/50'
                      }`}
                      onClick={() => handleSelectSchedule(scheduleKey)}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-4">
                          <div className={`w-4 h-4 rounded border-2 flex items-center justify-center ${
                            isSelected 
                              ? 'border-primary bg-primary' 
                              : 'border-muted-foreground'
                          }`}>
                            {isSelected && <CheckCircle className="h-3 w-3 text-white" />}
                          </div>
                          
                          <div>
                            <div className="font-medium">{schedule.analystName}</div>
                            <div className="text-sm text-muted-foreground">
                              {moment(schedule.date).format('MMM D, YYYY')} • {schedule.shiftType}
                              {schedule.isScreener && ' • Screener'}
                            </div>
                          </div>
                        </div>
                        
                        <div className="flex items-center space-x-2">
                          <span className={`px-2 py-1 text-xs rounded-full ${
                            schedule.shiftType === 'MORNING' 
                              ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
                              : 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200'
                          }`}>
                            {schedule.shiftType}
                          </span>
                          
                          {schedule.isScreener && (
                            <span className="px-2 py-1 text-xs rounded-full bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                              Screener
                            </span>
                          )}
                        </div>
                      </div>
                      
                      <div className="mt-2 text-sm text-muted-foreground">
                        Type: {schedule.type}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-6 border-t border-border">
          <div className="text-sm text-muted-foreground">
            {selectedSchedules.size > 0 && (
              <span>{selectedSchedules.size} schedule{selectedSchedules.size !== 1 ? 's' : ''} selected</span>
            )}
          </div>
          
          <div className="flex space-x-3">
            <button
              onClick={onClose}
              className="px-4 py-2 border border-border rounded-md hover:bg-muted transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleApply}
              disabled={selectedSchedules.size === 0 || isLoading}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Apply Selected ({selectedSchedules.size})
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ScheduleGenerationModal;
