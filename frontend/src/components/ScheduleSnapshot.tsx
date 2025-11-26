import React, { useState, useEffect } from 'react';
import { apiService } from '../services/api';
import { Users, CalendarBlank, ChartBar, Sun, Moon, Lightning } from '@phosphor-icons/react';

interface ScheduleSnapshotData {
  todaysScreeners: {
    MORNING: string[];
    EVENING: string[];
    WEEKEND: string[];
  };
  upcomingHoliday: {
    name: string;
    date: string;
    daysUntil: number;
  } | null;
  todaysCoverage: {
    counts: {
      MORNING: number;
      EVENING: number;
      WEEKEND: number;
    };
    status: {
      MORNING: 'LOW' | 'MEDIUM' | 'HIGH';
      EVENING: 'LOW' | 'MEDIUM' | 'HIGH';
      WEEKEND: 'LOW' | 'MEDIUM' | 'HIGH';
    };
  };
}

const ScheduleSnapshot: React.FC = () => {
  const [data, setData] = useState<ScheduleSnapshotData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchSnapshotData();
  }, []);

  const fetchSnapshotData = async () => {
    try {
      setLoading(true);
      const snapshotData = await apiService.getScheduleSnapshot();
      setData(snapshotData);
      setError(null);
    } catch (err: any) {
      console.error('Error fetching schedule snapshot:', err);
      setError('Failed to load schedule snapshot');
    } finally {
      setLoading(false);
    }
  };

  const getShiftConfig = (shiftType: string) => {
    switch (shiftType) {
      case 'MORNING':
        return {
          icon: Sun,
          color: 'text-blue-500',
          bgColor: 'bg-blue-500/10',
          borderColor: 'border-blue-500/20',
          label: 'Morning'
        };
      case 'EVENING':
        return {
          icon: Moon,
          color: 'text-purple-500',
          bgColor: 'bg-purple-500/10',
          borderColor: 'border-purple-500/20',
          label: 'Evening'
        };
      case 'WEEKEND':
        return {
          icon: Lightning,
          color: 'text-green-500',
          bgColor: 'bg-green-500/10',
          borderColor: 'border-green-500/20',
          label: 'Weekend'
        };
      default:
        return {
          icon: Sun,
          color: 'text-gray-500',
          bgColor: 'bg-gray-500/10',
          borderColor: 'border-gray-500/20',
          label: 'Unknown'
        };
    }
  };

  const getCoverageColor = (status: 'LOW' | 'MEDIUM' | 'HIGH') => {
    switch (status) {
      case 'LOW': return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      case 'MEDIUM': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
      case 'HIGH': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
    }
  };

  const formatScreeners = (screeners: string[]) => {
    if (screeners.length === 0) return 'None';
    return screeners.join(', ');
  };

  const formatHolidayDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric'
    });
  };

  if (loading) {
    return (
      <div className="mb-4">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Loading skeleton */}
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="glass-static p-4 animate-pulse">
              <div className="h-4 bg-muted-foreground/20 rounded w-3/4 mb-3"></div>
              <div className="h-3 bg-muted-foreground/20 rounded w-full mb-1"></div>
              <div className="h-3 bg-muted-foreground/20 rounded w-2/3"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="mb-4">
        <div className="glass-static p-4 text-center">
          <p className="text-gray-700 dark:text-gray-200 mb-3 text-sm">{error || 'No data available'}</p>
          <button
            onClick={fetchSnapshotData}
            className="px-3 py-1.5 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors text-sm"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mb-4">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Today's Screeners Card */}
        <div className="bg-gradient-to-br from-blue-50 to-blue-100/50 dark:from-blue-950/30 dark:to-blue-900/20 rounded-xl p-4 border border-blue-200/50 dark:border-blue-800/30 backdrop-blur-sm">
          <div className="flex items-center mb-3">
            <div className="p-1.5 bg-blue-500/10 rounded-lg mr-2">
              <Users className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            </div>
            <h3 className="font-semibold text-sm text-blue-900 dark:text-blue-100">Today's Screeners</h3>
          </div>

          <div className="space-y-2">
            {Object.entries(data.todaysScreeners).map(([shift, screeners]) => {
              const config = getShiftConfig(shift);
              const IconComponent = config.icon;

              return (
                <div key={shift} className={`flex items-center p-2 rounded-lg ${config.bgColor} border ${config.borderColor}`}>
                  <div className={`p-1 rounded-md ${config.bgColor} mr-2`}>
                    <IconComponent className={`w-3 h-3 ${config.color}`} />
                  </div>
                  <div className="flex-1">
                    <p className="text-xs font-medium text-foreground">{config.label}</p>
                    <p className="text-xs text-gray-700 dark:text-gray-200">{formatScreeners(screeners)}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Upcoming Holiday Card */}
        <div className="bg-gradient-to-br from-purple-50 to-purple-100/50 dark:from-purple-950/30 dark:to-purple-900/20 rounded-xl p-4 border border-purple-200/50 dark:border-purple-800/30 backdrop-blur-sm">
          <div className="flex items-center mb-3">
            <div className="p-1.5 bg-purple-500/10 rounded-lg mr-2">
              <CalendarBlank className="w-4 h-4 text-purple-600 dark:text-purple-400" />
            </div>
            <h3 className="font-semibold text-sm text-purple-900 dark:text-purple-100">Upcoming Holiday</h3>
          </div>

          {data.upcomingHoliday ? (
            <div className="p-3 bg-purple-500/5 rounded-lg border border-purple-200/30 dark:border-purple-800/30">
              <p className="text-sm font-semibold text-purple-900 dark:text-purple-100 mb-1">
                {data.upcomingHoliday.name}
              </p>
              <p className="text-xs text-purple-700 dark:text-purple-300">
                {formatHolidayDate(data.upcomingHoliday.date)}
                {data.upcomingHoliday.daysUntil === 0 && ' (Today)'}
                {data.upcomingHoliday.daysUntil === 1 && ' (Tomorrow)'}
                {data.upcomingHoliday.daysUntil > 1 && ` (${data.upcomingHoliday.daysUntil} days)`}
              </p>
            </div>
          ) : (
            <div className="p-3 bg-purple-500/5 rounded-lg border border-purple-200/30 dark:border-purple-800/30 text-center">
              <p className="text-xs text-purple-700 dark:text-purple-300">No holidays in next 30 days</p>
            </div>
          )}
        </div>

        {/* Today's Coverage Card */}
        <div className="bg-gradient-to-br from-green-50 to-green-100/50 dark:from-green-950/30 dark:to-green-900/20 rounded-xl p-4 border border-green-200/50 dark:border-green-800/30 backdrop-blur-sm">
          <div className="flex items-center mb-3">
            <div className="p-1.5 bg-green-500/10 rounded-lg mr-2">
              <ChartBar className="w-4 h-4 text-green-600 dark:text-green-400" />
            </div>
            <h3 className="font-semibold text-sm text-green-900 dark:text-green-100">Today's Coverage</h3>
          </div>

          <div className="space-y-2">
            {Object.entries(data.todaysCoverage.counts).map(([shift, count]) => {
              const config = getShiftConfig(shift);
              const IconComponent = config.icon;
              const status = data.todaysCoverage.status[shift as keyof typeof data.todaysCoverage.status];

              return (
                <div key={shift} className={`flex items-center justify-between p-2 rounded-lg ${config.bgColor} border ${config.borderColor}`}>
                  <div className="flex items-center">
                    <div className={`p-1 rounded-md ${config.bgColor} mr-2`}>
                      <IconComponent className={`w-3 h-3 ${config.color}`} />
                    </div>
                    <span className="text-xs font-medium text-foreground">{config.label}</span>
                  </div>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${getCoverageColor(status)}`}>
                    {count}
                  </span>
                </div>
              );
            })}
          </div>

        </div>
      </div>
    </div>
  );
};

export default ScheduleSnapshot;
