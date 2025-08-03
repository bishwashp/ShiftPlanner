import React, { useState, useEffect } from 'react';
import moment from 'moment-timezone';
import apiService, { Schedule, SchedulingConstraint } from '../services/api';
import { formatDateTime } from '../utils/formatDateTime';

interface ConstraintImpactDiffProps {
  constraint: Partial<SchedulingConstraint>;
  operation: 'CREATE' | 'UPDATE' | 'DELETE';
  originalConstraint?: SchedulingConstraint;
  isOpen: boolean;
  onClose: () => void;
  onApprove?: () => void;
  onReject?: () => void;
}

interface ImpactData {
  isValid: boolean;
  preview: {
    estimatedImpact: 'LOW' | 'MEDIUM' | 'HIGH';
    affectedDaysCount: number;
    estimatedConflicts: number;
    message: string;
  };
  simulation?: {
    affectedDates: string[];
    affectedAnalysts: string[];
    scheduleChanges: {
      before: Schedule[];
      after: Schedule[];
      conflicts: Array<{
        date: string;
        message: string;
        severity: 'HIGH' | 'MEDIUM' | 'LOW';
        analystId?: string;
      }>;
    };
    fairnessImpact: {
      before: number;
      after: number;
      change: number;
    };
    coverageImpact: {
      gapsIntroduced: number;
      gapsResolved: number;
      netCoverageChange: number;
    };
    recommendations: string[];
  };
}

const ConstraintImpactDiff: React.FC<ConstraintImpactDiffProps> = ({
  constraint,
  operation,
  originalConstraint,
  isOpen,
  onClose,
  onApprove,
  onReject
}) => {
  const [loading, setLoading] = useState(false);
  const [impactData, setImpactData] = useState<ImpactData | null>(null);
  const [showFullSimulation, setShowFullSimulation] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && constraint.startDate && constraint.endDate) {
      fetchImpactData();
    }
  }, [isOpen, constraint, operation]);

  const fetchImpactData = async () => {
    setLoading(true);
    setError(null);
    
    try {
      // Get quick preview first
      const preview = await apiService.getConstraintImpactPreview({
        constraintChange: {
          type: operation,
          constraint,
          originalConstraint
        }
      });

      let simulation = null;
      if (preview.estimatedImpact !== 'LOW' || showFullSimulation) {
        // Get full simulation for medium/high impact changes
        simulation = await apiService.simulateConstraintImpact({
          constraintChange: {
            type: operation,
            constraint,
            originalConstraint
          },
          dateRange: {
            startDate: constraint.startDate!,
            endDate: constraint.endDate!
          },
          includeReschedule: false
        });
      }

      setImpactData({
        isValid: preview.estimatedImpact === 'LOW',
        preview,
        simulation: simulation || undefined
      });
    } catch (error: any) {
      console.error('Error fetching impact data:', error);
      setError('Failed to analyze constraint impact. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const getImpactColor = (severity: 'LOW' | 'MEDIUM' | 'HIGH') => {
    switch (severity) {
      case 'LOW': return 'text-green-600 bg-green-50';
      case 'MEDIUM': return 'text-yellow-600 bg-yellow-50';
      case 'HIGH': return 'text-red-600 bg-red-50';
    }
  };

  const getConflictSeverityColor = (severity: 'LOW' | 'MEDIUM' | 'HIGH') => {
    switch (severity) {
      case 'LOW': return 'border-green-300 bg-green-50';
      case 'MEDIUM': return 'border-yellow-300 bg-yellow-50';
      case 'HIGH': return 'border-red-300 bg-red-50';
    }
  };

  const renderScheduleDiff = () => {
    if (!impactData?.simulation) return null;

    const { scheduleChanges } = impactData.simulation;
    const groupedBefore = groupSchedulesByDate(scheduleChanges.before);
    const groupedAfter = groupSchedulesByDate(scheduleChanges.after);
    const allDates = Array.from(new Set([...Object.keys(groupedBefore), ...Object.keys(groupedAfter)])).sort();

    return (
      <div className="space-y-4">
        <h4 className="font-semibold text-foreground mb-3">Schedule Changes</h4>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Before */}
          <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-4">
            <h5 className="font-medium text-red-800 dark:text-red-200 mb-3 flex items-center">
              <span className="w-3 h-3 bg-red-500 rounded-full mr-2"></span>
              Before Change
            </h5>
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {allDates.map(date => (
                <div key={`before-${date}`} className="text-sm">
                  <div className="font-medium text-muted-foreground">
                    {formatDateTime(date, moment.tz.guess(), 'MMM D, YYYY')}
                  </div>
                  {groupedBefore[date]?.map(schedule => (
                    <div key={schedule.id} className="ml-4 text-xs text-muted-foreground">
                      {schedule.analyst?.name} - {schedule.shiftType}
                      {schedule.isScreener && ' (Screener)'}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>

          {/* After */}
          <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4">
            <h5 className="font-medium text-green-800 dark:text-green-200 mb-3 flex items-center">
              <span className="w-3 h-3 bg-green-500 rounded-full mr-2"></span>
              After Change
            </h5>
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {allDates.map(date => (
                <div key={`after-${date}`} className="text-sm">
                  <div className="font-medium text-muted-foreground">
                    {formatDateTime(date, moment.tz.guess(), 'MMM D, YYYY')}
                  </div>
                  {groupedAfter[date]?.map(schedule => (
                    <div key={schedule.id} className="ml-4 text-xs text-muted-foreground">
                      {schedule.analyst?.name} - {schedule.shiftType}
                      {schedule.isScreener && ' (Screener)'}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  };

  const groupSchedulesByDate = (schedules: Schedule[]) => {
    return schedules.reduce((acc, schedule) => {
      const date = schedule.date.split('T')[0];
      if (!acc[date]) acc[date] = [];
      acc[date].push(schedule);
      return acc;
    }, {} as Record<string, Schedule[]>);
  };

  const renderConflicts = () => {
    if (!impactData?.simulation?.scheduleChanges.conflicts.length) return null;

    return (
      <div className="space-y-3">
        <h4 className="font-semibold text-foreground mb-3">Conflicts Detected</h4>
        {impactData.simulation.scheduleChanges.conflicts.map((conflict, index) => (
          <div 
            key={index}
            className={`p-3 rounded border-l-4 ${getConflictSeverityColor(conflict.severity)}`}
          >
            <div className="flex justify-between items-start">
              <div>
                <div className="font-medium text-sm">
                  {formatDateTime(conflict.date, moment.tz.guess(), 'MMM D, YYYY')}
                </div>
                <div className="text-sm text-muted-foreground mt-1">
                  {conflict.message}
                </div>
              </div>
              <span className={`px-2 py-1 rounded text-xs font-medium ${
                conflict.severity === 'HIGH' ? 'bg-red-100 text-red-800' :
                conflict.severity === 'MEDIUM' ? 'bg-yellow-100 text-yellow-800' :
                'bg-blue-100 text-blue-800'
              }`}>
                {conflict.severity}
              </span>
            </div>
          </div>
        ))}
      </div>
    );
  };

  const renderMetrics = () => {
    if (!impactData?.simulation) return null;

    const { fairnessImpact, coverageImpact } = impactData.simulation;

    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Fairness Impact */}
        <div className="bg-card rounded-lg p-4 border">
          <h4 className="font-semibold text-foreground mb-3">Fairness Impact</h4>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Before:</span>
              <span className="font-medium">{(fairnessImpact.before * 100).toFixed(1)}%</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">After:</span>
              <span className="font-medium">{(fairnessImpact.after * 100).toFixed(1)}%</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Change:</span>
              <span className={`font-medium ${fairnessImpact.change >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {fairnessImpact.change >= 0 ? '+' : ''}{(fairnessImpact.change * 100).toFixed(1)}%
              </span>
            </div>
          </div>
        </div>

        {/* Coverage Impact */}
        <div className="bg-card rounded-lg p-4 border">
          <h4 className="font-semibold text-foreground mb-3">Coverage Impact</h4>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Gaps Introduced:</span>
              <span className="font-medium text-red-600">{coverageImpact.gapsIntroduced}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Gaps Resolved:</span>
              <span className="font-medium text-green-600">{coverageImpact.gapsResolved}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Net Change:</span>
              <span className={`font-medium ${coverageImpact.netCoverageChange >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {coverageImpact.netCoverageChange >= 0 ? '+' : ''}{coverageImpact.netCoverageChange}
              </span>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderRecommendations = () => {
    if (!impactData?.simulation?.recommendations.length) return null;

    return (
      <div className="space-y-3">
        <h4 className="font-semibold text-foreground mb-3">Recommendations</h4>
        <div className="space-y-2">
          {impactData.simulation.recommendations.map((recommendation, index) => (
            <div key={index} className="flex items-start space-x-2">
              <span className="text-blue-500 mt-1">•</span>
              <span className="text-sm text-muted-foreground">{recommendation}</span>
            </div>
          ))}
        </div>
      </div>
    );
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-background rounded-lg shadow-xl max-w-6xl w-full max-h-[90vh] overflow-hidden">
        <div className="flex items-center justify-between p-6 border-b">
          <h3 className="text-lg font-semibold text-foreground">
            Constraint Impact Analysis
          </h3>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground"
          >
            ×
          </button>
        </div>

        <div className="p-6 max-h-[calc(90vh-120px)] overflow-y-auto">
          {loading ? (
            <div className="text-center py-8">
              <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4"></div>
              <p className="text-muted-foreground">Analyzing constraint impact...</p>
            </div>
          ) : error ? (
            <div className="text-center py-8">
              <p className="text-red-600 mb-4">{error}</p>
              <button
                onClick={fetchImpactData}
                className="px-4 py-2 bg-primary text-primary-foreground rounded hover:bg-primary/90"
              >
                Retry
              </button>
            </div>
          ) : impactData ? (
            <div className="space-y-6">
              {/* Quick Summary */}
              <div className={`p-4 rounded-lg ${getImpactColor(impactData.preview.estimatedImpact)}`}>
                <h4 className="font-semibold mb-2">Impact Summary</h4>
                <p className="text-sm mb-3">{impactData.preview.message}</p>
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div>
                    <span className="font-medium">Severity:</span> {impactData.preview.estimatedImpact}
                  </div>
                  <div>
                    <span className="font-medium">Affected Days:</span> {impactData.preview.affectedDaysCount}
                  </div>
                  <div>
                    <span className="font-medium">Estimated Conflicts:</span> {impactData.preview.estimatedConflicts}
                  </div>
                </div>
              </div>

              {/* Detailed Analysis */}
              {impactData.simulation && (
                <>
                  {renderScheduleDiff()}
                  {renderConflicts()}
                  {renderMetrics()}
                  {renderRecommendations()}
                </>
              )}

              {/* Load Full Simulation Button */}
              {!impactData.simulation && impactData.preview.estimatedImpact === 'LOW' && (
                <div className="text-center">
                  <button
                    onClick={() => {
                      setShowFullSimulation(true);
                      fetchImpactData();
                    }}
                    className="px-4 py-2 bg-muted text-muted-foreground rounded hover:bg-muted/80"
                  >
                    Show Detailed Analysis
                  </button>
                </div>
              )}
            </div>
          ) : null}
        </div>

        {/* Action Buttons */}
        {impactData && (
          <div className="flex justify-end space-x-3 p-6 border-t bg-muted/50">
            <button
              onClick={onReject}
              className="px-4 py-2 border border-border rounded hover:bg-muted"
            >
              Cancel
            </button>
            <button
              onClick={onApprove}
              className={`px-6 py-2 rounded text-white font-medium ${
                impactData.preview.estimatedImpact === 'HIGH'
                  ? 'bg-red-600 hover:bg-red-700'
                  : impactData.preview.estimatedImpact === 'MEDIUM'
                  ? 'bg-yellow-600 hover:bg-yellow-700'
                  : 'bg-green-600 hover:bg-green-700'
              }`}
            >
              {impactData.preview.estimatedImpact === 'HIGH' ? 'Apply Anyway' : 'Apply Changes'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default ConstraintImpactDiff;