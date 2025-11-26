import React, { useState, useCallback, useMemo } from 'react';
import ReactDOM from 'react-dom';
import { X, CalendarBlank, Warning, Info, ListBullets, ChartBar } from '@phosphor-icons/react';
import moment from 'moment';
import Checkbox from './ui/Checkbox';
import Button from './ui/Button';

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
    fairnessMetrics?: any;
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
  const [viewMode, setViewMode] = useState<'SUMMARY' | 'DETAILS'>('SUMMARY');

  // Initialize selection when schedules load
  React.useEffect(() => {
    if (generatedSchedules.length > 0) {
      setSelectedSchedules(new Set(generatedSchedules.map(s => `${s.date}-${s.analystId}`)));
    }
  }, [generatedSchedules]);

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

  // Calculate analyst stats for summary view
  const analystStats = useMemo(() => {
    const stats = new Map<string, {
      name: string;
      total: number;
      weekend: number;
      screener: number;
      maxStreak: number;
    }>();

    // Helper to check if date is weekend
    const isWeekend = (dateStr: string) => {
      const day = moment(dateStr).day();
      return day === 0 || day === 6; // Sunday or Saturday
    };

    // First pass: counts
    generatedSchedules.forEach(s => {
      const current = stats.get(s.analystId) || {
        name: s.analystName,
        total: 0,
        weekend: 0,
        screener: 0,
        maxStreak: 0
      };

      current.total++;
      if (isWeekend(s.date)) current.weekend++;
      if (s.isScreener) current.screener++;

      stats.set(s.analystId, current);
    });

    // Second pass: streaks (requires sorting)
    stats.forEach((stat, analystId) => {
      const dates = generatedSchedules
        .filter(s => s.analystId === analystId)
        .map(s => s.date)
        .sort();

      let currentStreak = 0;
      let maxStreak = 0;
      let lastDate: moment.Moment | null = null;

      dates.forEach(dateStr => {
        const currentDate = moment(dateStr);
        if (lastDate && currentDate.diff(lastDate, 'days') === 1) {
          currentStreak++;
        } else {
          currentStreak = 1;
        }
        maxStreak = Math.max(maxStreak, currentStreak);
        lastDate = currentDate;
      });

      stat.maxStreak = maxStreak;
    });

    return Array.from(stats.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [generatedSchedules]);

  if (!isOpen) return null;

  return ReactDOM.createPortal(
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white/90 dark:bg-gray-900/90 backdrop-blur-xl border border-gray-200 dark:border-gray-700 rounded-xl shadow-2xl max-w-3xl w-full max-h-[90vh] min-h-[60vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-2.5 border-b border-border">
          <div className="flex items-center space-x-2.5">
            <CalendarBlank className="h-5 w-5 text-primary" />
            <div>
              <h2 className="text-lg font-semibold">Schedule Preview</h2>
              <p className="text-xs text-gray-700 dark:text-gray-200">
                Review generated schedules before applying
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <div className="flex bg-muted rounded-lg p-1">
              <button
                onClick={() => setViewMode('SUMMARY')}
                className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all flex items-center space-x-2 ${viewMode === 'SUMMARY'
                  ? 'bg-background shadow-sm text-foreground'
                  : 'text-gray-700 dark:text-gray-200 hover:text-foreground'
                  }`}
              >
                <ChartBar className="h-4 w-4" />
                <span>Summary</span>
              </button>
              <button
                onClick={() => setViewMode('DETAILS')}
                className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all flex items-center space-x-2 ${viewMode === 'DETAILS'
                  ? 'bg-background shadow-sm text-foreground'
                  : 'text-gray-700 dark:text-gray-200 hover:text-foreground'
                  }`}
              >
                <ListBullets className="h-4 w-4" />
                <span>Details</span>
              </button>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-muted rounded-md transition-colors ml-2"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden flex flex-col bg-muted/5">
          {isLoading ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
                <p className="text-gray-700 dark:text-gray-200">Generating schedules...</p>
              </div>
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto p-2.5">
              {viewMode === 'SUMMARY' ? (
                <div className="space-y-3">
                  {/* Fairness Analysis Card */}
                  {summary.fairnessMetrics && (
                    <div className="bg-white/50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-lg p-3">
                      <div className="flex items-center space-x-2 mb-3">
                        <Info className="h-4 w-4 text-blue-500" />
                        <h3 className="font-semibold text-base">Fairness Analysis</h3>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="space-y-1">
                          <div className="text-sm text-gray-700 dark:text-gray-200">Fairness Score</div>
                          <div className="text-2xl font-bold">
                            {(summary.fairnessMetrics.overallFairnessScore * 100).toFixed(0)}%
                          </div>
                          <div className="text-xs text-gray-700 dark:text-gray-200">Target: &gt;85%</div>
                        </div>
                        <div className="col-span-2 space-y-2">
                          <div className="text-sm font-medium">Insights</div>
                          {summary.fairnessMetrics.recommendations?.length > 0 ? (
                            <ul className="space-y-1">
                              {summary.fairnessMetrics.recommendations.slice(0, 3).map((rec: string, i: number) => (
                                <li key={i} className="text-sm text-gray-700 dark:text-gray-200 flex items-start space-x-2">
                                  <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-blue-400 flex-shrink-0" />
                                  <span>{rec}</span>
                                </li>
                              ))}
                            </ul>
                          ) : (
                            <p className="text-sm text-gray-700 dark:text-gray-200">Distribution looks balanced across all metrics.</p>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Workload Summary Table */}
                  <div className="bg-white/50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-lg">
                    <div className="p-2.5 border-t border-border flex justify-between items-center bg-white/50 dark:bg-gray-900/50">
                      <h3 className="font-semibold text-base">Analyst Workload Summary</h3>
                      <span className="text-xs text-gray-700 dark:text-gray-200">{analystStats.length} Analysts</span>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm text-left">
                        <thead className="bg-muted/50 text-gray-700 dark:text-gray-200 font-medium text-xs">
                          <tr>
                            <th className="px-4 py-2">Analyst</th>
                            <th className="px-4 py-2 text-center">Total Shifts</th>
                            <th className="px-4 py-2 text-center">Weekend Days</th>
                            <th className="px-4 py-2 text-center">Screener Days</th>
                            <th className="px-4 py-2 text-center">Max Streak</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                          {analystStats.map((stat) => (
                            <tr key={stat.name} className="hover:bg-muted/50 transition-colors text-xs">
                              <td className="px-4 py-2.5 font-medium">{stat.name}</td>
                              <td className="px-4 py-2.5 text-center">
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                                  {stat.total}
                                </span>
                              </td>
                              <td className="px-4 py-2.5 text-center">{stat.weekend}</td>
                              <td className="px-4 py-2.5 text-center">{stat.screener}</td>
                              <td className="px-4 py-2.5 text-center">
                                {stat.maxStreak > 5 ? (
                                  <span className="text-red-500 font-bold flex items-center justify-center space-x-1">
                                    <Warning className="h-3 w-3" />
                                    <span>{stat.maxStreak}</span>
                                  </span>
                                ) : (
                                  <span className="text-green-600">{stat.maxStreak}</span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex justify-between items-center mb-2">
                    <button
                      onClick={handleSelectAll}
                      className="text-xs text-primary hover:underline font-medium"
                    >
                      {selectedSchedules.size === generatedSchedules.length ? 'Deselect All' : 'Select All'}
                    </button>
                    <span className="text-xs text-gray-700 dark:text-gray-200">
                      {selectedSchedules.size} selected
                    </span>
                  </div>
                  <div className="space-y-1.5">
                    {generatedSchedules.map((schedule) => {
                      const scheduleKey = `${schedule.date}-${schedule.analystId}`;
                      const isSelected = selectedSchedules.has(scheduleKey);

                      return (
                        <div
                          key={scheduleKey}
                          className={`p-2.5 border rounded-lg transition-all ${isSelected
                            ? 'border-primary bg-primary/5'
                            : 'border-border hover:border-primary/50'
                            } bg-white/50 dark:bg-gray-800/50`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-3">
                              <Checkbox
                                checked={isSelected}
                                onChange={() => handleSelectSchedule(scheduleKey)}
                              />

                              <div>
                                <div className="text-sm font-medium">{schedule.analystName}</div>
                                <div className="text-xs text-gray-700 dark:text-gray-200">
                                  {moment(schedule.date).format('ddd, MMM D')} • {schedule.shiftType}
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center space-x-2">
                              {schedule.isScreener && (
                                <span className="px-2 py-0.5 text-[10px] rounded-full bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 font-medium">
                                  Screener
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-3 border-t border-border bg-background">
          <div className="text-xs text-gray-700 dark:text-gray-200">
            {summary.assignmentsNeeded} assignments generated
          </div>

          <div className="flex space-x-3">
            <Button
              onClick={onClose}
              variant="secondary"
            >
              Cancel
            </Button>
            <Button
              onClick={handleApply}
              disabled={selectedSchedules.size === 0 || isLoading}
              variant="primary"
            >
              Apply Selected ({selectedSchedules.size})
            </Button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default ScheduleGenerationModal;
