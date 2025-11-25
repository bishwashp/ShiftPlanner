import React, { useState, useEffect } from 'react';
import { XMarkIcon } from '@heroicons/react/24/outline';
import { apiService, FairnessReport } from '../services/api';
import Button from './ui/Button';
import moment from 'moment';

interface FairnessReportModalProps {
  startDate: string;
  endDate: string;
  onClose: () => void;
}

const FairnessReportModal: React.FC<FairnessReportModalProps> = ({ startDate, endDate, onClose }) => {
  const [loading, setLoading] = useState(true);
  const [report, setReport] = useState<FairnessReport | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchFairnessReport();
  }, [startDate, endDate]);

  const fetchFairnessReport = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiService.getFairnessMetrics(startDate, endDate);
      setReport(data);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to fetch fairness report');
    } finally {
      setLoading(false);
    }
  };

  const getScoreColor = (score: number): string => {
    if (score >= 0.95) return 'text-green-600 dark:text-green-400';
    if (score >= 0.9) return 'text-yellow-600 dark:text-yellow-400';
    return 'text-red-600 dark:text-red-400';
  };

  const formatScore = (score: number): string => {
    return `${(score * 100).toFixed(1)}%`;
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="glass-static p-8 max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto">
          <div className="animate-pulse">
            <div className="h-8 bg-muted rounded w-1/3 mb-4"></div>
            <div className="space-y-3">
              <div className="h-4 bg-muted rounded w-full"></div>
              <div className="h-4 bg-muted rounded w-3/4"></div>
              <div className="h-4 bg-muted rounded w-1/2"></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="glass-static p-8 max-w-md w-full mx-4">
          <h2 className="text-xl font-semibold text-foreground mb-4">Error</h2>
          <p className="text-gray-700 dark:text-gray-200 mb-4">{error}</p>
          <Button
            onClick={onClose}
            variant="primary"
          >
            Close
          </Button>
        </div>
      </div>
    );
  }

  if (!report) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="glass-static p-8 max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-start mb-6">
          <div>
            <h2 className="text-2xl font-semibold text-foreground">Fairness Report</h2>
            <p className="text-gray-700 dark:text-gray-200 mt-1">
              {moment(startDate).format('MMM D, YYYY')} - {moment(endDate).format('MMM D, YYYY')}
            </p>
          </div>
          <Button
            onClick={onClose}
            variant="ghost"
            size="icon"
            className="text-gray-700 dark:text-gray-200 hover:text-foreground"
          >
            <XMarkIcon className="w-6 h-6" />
          </Button>
        </div>

        {/* Overall Score */}
        <div className="bg-muted/30 rounded-lg p-6 mb-6">
          <h3 className="text-lg font-semibold text-foreground mb-4">Overall Fairness Score</h3>
          <div className="text-4xl font-bold">
            <span className={getScoreColor(report.overallScore)}>
              {formatScore(report.overallScore)}
            </span>
          </div>
          <p className="text-gray-700 dark:text-gray-200 mt-2">
            Based on {report.schedulesAnalyzed} schedules across {report.analystsCount} analysts
          </p>
        </div>

        {/* Component Scores */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          {Object.entries(report.components).map(([key, value]) => (
            <div key={key} className="bg-muted/20 rounded-lg p-4">
              <h4 className="text-sm font-medium text-gray-700 dark:text-gray-200 capitalize mb-2">{key}</h4>
              <div className={`text-2xl font-semibold ${getScoreColor(value)}`}>
                {formatScore(value)}
              </div>
            </div>
          ))}
        </div>

        {/* Recommendations */}
        {report.recommendations.length > 0 && (
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-foreground mb-4">Recommendations</h3>
            <div className="space-y-2">
              {report.recommendations.map((rec, index) => (
                <div key={index} className="flex items-start">
                  <span className="text-primary mr-2">•</span>
                  <p className="text-gray-700 dark:text-gray-200">{rec}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Analyst Metrics */}
        <div>
          <h3 className="text-lg font-semibold text-foreground mb-4">Individual Analyst Metrics</h3>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-2 px-3 text-sm font-medium text-gray-700 dark:text-gray-200">Analyst</th>
                  <th className="text-center py-2 px-3 text-sm font-medium text-gray-700 dark:text-gray-200">Total Days</th>
                  <th className="text-center py-2 px-3 text-sm font-medium text-gray-700 dark:text-gray-200">Weekends</th>
                  <th className="text-center py-2 px-3 text-sm font-medium text-gray-700 dark:text-gray-200">Screener Days</th>
                  <th className="text-center py-2 px-3 text-sm font-medium text-gray-700 dark:text-gray-200">Max Consecutive</th>
                </tr>
              </thead>
              <tbody>
                {report.analystMetrics.map((metric) => (
                  <tr key={metric.analystId} className="border-b border-border/50">
                    <td className="py-2 px-3 text-sm text-foreground">{metric.analystName}</td>
                    <td className="text-center py-2 px-3 text-sm text-gray-700 dark:text-gray-200">{metric.totalDaysWorked}</td>
                    <td className="text-center py-2 px-3 text-sm text-gray-700 dark:text-gray-200">{metric.weekendDaysWorked}</td>
                    <td className="text-center py-2 px-3 text-sm text-gray-700 dark:text-gray-200">{metric.screenerDaysAssigned}</td>
                    <td className="text-center py-2 px-3 text-sm text-gray-700 dark:text-gray-200">
                      {Math.max(...(metric.consecutiveWorkDays || [0]))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end mt-8 space-x-3">
          <Button
            onClick={onClose}
            variant="secondary"
          >
            Close
          </Button>
          <Button
            onClick={() => window.print()}
            variant="primary"
          >
            Print Report
          </Button>
        </div>
      </div>
    </div>
  );
};

export default FairnessReportModal;
