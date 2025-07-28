import React, { useState, useEffect } from 'react';
import { apiService, Schedule, Analyst } from '../services/api';
import moment from 'moment';

interface ScreenerStats {
  totalScreeners: number;
  morningScreeners: number;
  eveningScreeners: number;
  analystStats: Array<{
    analystId: string;
    analystName: string;
    screenerCount: number;
    lastScreenerDate?: string;
  }>;
}

interface ScreenerManagementProps {
  schedules: Schedule[];
  analysts: Analyst[];
  onScheduleUpdate: () => void;
}

const ScreenerManagement: React.FC<ScreenerManagementProps> = ({
  schedules,
  analysts,
  onScheduleUpdate
}) => {
  const [stats, setStats] = useState<ScreenerStats | null>(null);
  const [selectedDate, setSelectedDate] = useState(moment().format('YYYY-MM-DD'));
  const [selectedShift, setSelectedShift] = useState<'ALL' | 'MORNING' | 'EVENING'>('ALL');
  const [assigningScreener, setAssigningScreener] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [popoverAnalystId, setPopoverAnalystId] = useState<string | null>(null);

  // Calculate screener statistics
  useEffect(() => {
    if (schedules.length === 0 || analysts.length === 0) return;

    const screenerSchedules = schedules.filter(s => s.isScreener);
    const analystStats = analysts.map(analyst => {
      const analystScreenerSchedules = screenerSchedules.filter(s => s.analystId === analyst.id);
      const lastScreenerSchedule = analystScreenerSchedules
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];

      return {
        analystId: analyst.id,
        analystName: analyst.name,
        screenerCount: analystScreenerSchedules.length,
        lastScreenerDate: lastScreenerSchedule?.date
      };
    }).sort((a, b) => b.screenerCount - a.screenerCount);

    setStats({
      totalScreeners: screenerSchedules.length,
      morningScreeners: screenerSchedules.filter(s => s.shiftType === 'MORNING').length,
      eveningScreeners: screenerSchedules.filter(s => s.shiftType === 'EVENING').length,
      analystStats
    });
  }, [schedules, analysts]);

  // Get available analysts for screener assignment
  const getAvailableAnalysts = (date: string, shiftType: 'ALL' | 'MORNING' | 'EVENING') => {
    const dayOfWeek = moment(date).day();
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      return [];
    }
    return schedules.filter(s => 
      moment(s.date).format('YYYY-MM-DD') === moment(date).format('YYYY-MM-DD') &&
      (shiftType === 'ALL' || s.shiftType === shiftType) &&
      !s.isScreener
    ).map(s => analysts.find(a => a.id === s.analystId)).filter(Boolean);
  };

  // Get current screener for date/shift
  const getCurrentScreener = (date: string, shiftType: 'MORNING' | 'EVENING') => {
    return schedules.find(s => 
      s.date === date && 
      s.shiftType === shiftType && 
      s.isScreener
    );
  };

  // Helper to get shift type for an analyst on a given date
  const getAnalystShifts = (analystId: string, date: string) => {
    return schedules.filter(s =>
      moment(s.date).format('YYYY-MM-DD') === moment(date).format('YYYY-MM-DD') &&
      s.analystId === analystId &&
      !s.isScreener
    ).map(s => s.shiftType);
  };

  // Assign screener
  const assignScreener = async (analystId: string, shiftTypeOverride?: 'MORNING' | 'EVENING') => {
    try {
      setAssigningScreener(true);
      setError(null);
      const shiftToAssign = shiftTypeOverride || (selectedShift as 'MORNING' | 'EVENING');
      // First, remove any existing screener for this date/shift
      const currentScreener = getCurrentScreener(selectedDate, shiftToAssign);
      if (currentScreener) {
        await apiService.updateSchedule(currentScreener.id, {
          analystId: currentScreener.analystId,
          date: currentScreener.date.split('T')[0],
          shiftType: currentScreener.shiftType,
          isScreener: false
        });
      }
      // Find the schedule to make it a screener
      const targetSchedule = schedules.find(s => 
        s.analystId === analystId && 
        moment(s.date).format('YYYY-MM-DD') === moment(selectedDate).format('YYYY-MM-DD') &&
        s.shiftType === shiftToAssign
      );
      if (targetSchedule) {
        await apiService.updateSchedule(targetSchedule.id, {
          analystId: targetSchedule.analystId,
          date: targetSchedule.date.split('T')[0],
          shiftType: targetSchedule.shiftType,
          isScreener: true
        });
      }
      onScheduleUpdate();
    } catch (err: any) {
      console.error('Error assigning screener:', err);
      setError(err.response?.data?.error || 'Failed to assign screener');
    } finally {
      setAssigningScreener(false);
    }
  };

  // Remove screener
  const removeScreener = async () => {
    const currentScreener = getCurrentScreener(selectedDate, selectedShift as 'MORNING' | 'EVENING');
    if (!currentScreener) return;

    try {
      setAssigningScreener(true);
      setError(null);

      await apiService.updateSchedule(currentScreener.id, {
        analystId: currentScreener.analystId,
        date: currentScreener.date.split('T')[0],
        shiftType: currentScreener.shiftType,
        isScreener: false
      });

      onScheduleUpdate();
    } catch (err: any) {
      console.error('Error removing screener:', err);
      setError(err.response?.data?.error || 'Failed to remove screener');
    } finally {
      setAssigningScreener(false);
    }
  };

  const availableAnalysts = getAvailableAnalysts(selectedDate, selectedShift);
  const currentScreener = getCurrentScreener(selectedDate, selectedShift as 'MORNING' | 'EVENING');
  const isWeekend = moment(selectedDate).day() === 0 || moment(selectedDate).day() === 6;

  // Close popover on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (!(e.target as HTMLElement).closest('.relative')) {
        setPopoverAnalystId(null);
      }
    };
    if (popoverAnalystId) {
      document.addEventListener('mousedown', handleClick);
    }
    return () => {
      document.removeEventListener('mousedown', handleClick);
    };
  }, [popoverAnalystId]);

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
      <h2 className="text-xl font-semibold text-gray-800 mb-6">Screener Management</h2>
      
      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-red-700 text-sm">{error}</p>
        </div>
      )}

      {/* Statistics */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-blue-50 p-4 rounded-lg">
            <div className="text-2xl font-bold text-blue-600">{stats.totalScreeners}</div>
            <div className="text-sm text-blue-700">Total Screener Assignments</div>
          </div>
          <div className="bg-yellow-50 p-4 rounded-lg">
            <div className="text-2xl font-bold text-yellow-600">{stats.morningScreeners}</div>
            <div className="text-sm text-yellow-700">Morning Screeners</div>
          </div>
          <div className="bg-red-50 p-4 rounded-lg">
            <div className="text-2xl font-bold text-red-600">{stats.eveningScreeners}</div>
            <div className="text-sm text-red-700">Evening Screeners</div>
          </div>
          <div className="bg-green-50 p-4 rounded-lg">
            <div className="text-2xl font-bold text-green-600">{analysts.length}</div>
            <div className="text-sm text-green-700">Active Analysts</div>
          </div>
        </div>
      )}

      {/* Quick Assignment */}
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">Quick Screener Assignment</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Date</label>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Shift</label>
            <select
              value={selectedShift}
              onChange={(e) => setSelectedShift(e.target.value as 'ALL' | 'MORNING' | 'EVENING')}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent appearance-auto"
              style={{ WebkitAppearance: 'menulist', MozAppearance: 'menulist', appearance: 'menulist' }}
            >
              <option value="ALL">All</option>
              <option value="MORNING">Morning (AM)</option>
              <option value="EVENING">Evening (PM)</option>
            </select>
          </div>
        </div>

        {!isWeekend && (
          <div className="bg-gray-50 p-4 rounded-lg">
            {currentScreener ? (
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Current Screener:</p>
                  <p className="font-medium text-gray-900">
                    {analysts.find(a => a.id === currentScreener.analystId)?.name}
                  </p>
                </div>
                <button
                  onClick={removeScreener}
                  disabled={assigningScreener}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {assigningScreener ? 'Removing...' : 'Remove Screener'}
                </button>
              </div>
            ) : (
              <div>
                {availableAnalysts.length > 0 ? (
                  <>
                    <p className="text-sm text-gray-600 mb-3">No screener assigned. Available analysts:</p>
                    <div className="flex flex-wrap gap-2">
                      {availableAnalysts.map((analyst) => {
                        const shifts = getAnalystShifts(analyst!.id, selectedDate);
                        let colorClass = 'bg-blue-600';
                        if (selectedShift === 'ALL') {
                          if (shifts.includes('MORNING') && !shifts.includes('EVENING')) colorClass = 'bg-green-500';
                          if (shifts.includes('EVENING') && !shifts.includes('MORNING')) colorClass = 'bg-blue-600';
                          if (shifts.includes('MORNING') && shifts.includes('EVENING')) colorClass = 'bg-gradient-to-r from-green-500 to-blue-600';
                        } else if (selectedShift === 'MORNING') {
                          colorClass = 'bg-green-500';
                        } else if (selectedShift === 'EVENING') {
                          colorClass = 'bg-blue-600';
                        }
                        return (
                          <div key={analyst?.id} className="relative">
                            <button
                              onClick={() => {
                                if (selectedShift === 'ALL') {
                                  setPopoverAnalystId(analyst!.id);
                                } else {
                                  assignScreener(analyst!.id);
                                }
                              }}
                              disabled={assigningScreener}
                              className={`px-3 py-1 ${colorClass} text-white rounded-lg hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed text-sm`}
                            >
                              {assigningScreener ? 'Assigning...' : analyst?.name}
                            </button>
                            {/* Popover for shift selection when 'All' is selected */}
                            {popoverAnalystId === analyst?.id && selectedShift === 'ALL' && (
                              <div className="absolute z-10 mt-2 left-0 bg-white border border-gray-200 rounded shadow-lg p-2 flex flex-col min-w-[160px]">
                                {shifts.includes('MORNING') && (
                                  <button
                                    className="text-left px-3 py-1 rounded hover:bg-green-100 text-green-700"
                                    onClick={() => {
                                      assignScreener(analyst!.id, 'MORNING');
                                      setPopoverAnalystId(null);
                                    }}
                                  >Assign as Morning Screener</button>
                                )}
                                {shifts.includes('EVENING') && (
                                  <button
                                    className="text-left px-3 py-1 rounded hover:bg-blue-100 text-blue-700"
                                    onClick={() => {
                                      assignScreener(analyst!.id, 'EVENING');
                                      setPopoverAnalystId(null);
                                    }}
                                  >Assign as Evening Screener</button>
                                )}
                                <button
                                  className="text-left px-3 py-1 rounded hover:bg-gray-100 text-gray-500"
                                  onClick={() => setPopoverAnalystId(null)}
                                >Cancel</button>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </>
                ) : (
                  <div className="bg-red-50 p-3 rounded">
                    <p className="text-sm text-red-500">No analysts working on this date/shift</p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
        {isWeekend && (
          <div className="bg-gray-50 p-4 rounded-lg">
            <p className="text-sm text-gray-500">No screener shifts for the weekend, Analysts act as screeners</p>
          </div>
        )}
      </div>

      {/* Analyst Statistics */}
      {stats && (
        <div>
          <h3 className="text-lg font-semibold text-gray-800 mb-4">Analyst Screener Statistics</h3>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-2 px-4 text-sm font-medium text-gray-700">Analyst</th>
                  <th className="text-left py-2 px-4 text-sm font-medium text-gray-700">Screener Count</th>
                  <th className="text-left py-2 px-4 text-sm font-medium text-gray-700">Last Screener Date</th>
                  <th className="text-left py-2 px-4 text-sm font-medium text-gray-700">Status</th>
                </tr>
              </thead>
              <tbody>
                {stats.analystStats.map((stat) => (
                  <tr key={stat.analystId} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-2 px-4 text-sm font-medium text-gray-900">
                      {stat.analystName}
                    </td>
                    <td className="py-2 px-4 text-sm text-gray-600">
                      {stat.screenerCount}
                    </td>
                    <td className="py-2 px-4 text-sm text-gray-600">
                      {stat.lastScreenerDate 
                        ? moment(stat.lastScreenerDate).format('MMM D, YYYY')
                        : 'Never'
                      }
                    </td>
                    <td className="py-2 px-4">
                      <span
                        className={`px-2 py-1 text-xs font-semibold rounded-full ${
                          stat.screenerCount === 0
                            ? 'bg-red-100 text-red-800'
                            : stat.screenerCount <= 2
                            ? 'bg-yellow-100 text-yellow-800'
                            : 'bg-green-100 text-green-800'
                        }`}
                      >
                        {stat.screenerCount === 0 ? 'None' : 
                         stat.screenerCount <= 2 ? 'Low' : 'Good'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default ScreenerManagement; 