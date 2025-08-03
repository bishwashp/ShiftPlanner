import React, { useState, useEffect } from 'react';
import { 
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  AreaChart, Area
} from 'recharts';
import { apiService } from '../../services/api';

interface AnalystMetrics {
  analystId: string;
  analystName: string;
  personalMetrics: {
    totalShifts: number;
    screenerShifts: number;
    weekendShifts: number;
    fairnessScore: number;
  };
  upcomingSchedule: Array<{
    id: string;
    analystId: string;
    date: string;
    shiftType: 'MORNING' | 'EVENING';
    isScreener: boolean;
    createdAt: string;
    updatedAt: string;
  }>;
  recommendations: string[];
}

const AnalystDashboard: React.FC = () => {
  const [metrics, setMetrics] = useState<AnalystMetrics | null>(null);
  const [timeRange, setTimeRange] = useState<'week' | 'month'>('month');
  const [selectedAnalyst, setSelectedAnalyst] = useState<string>('analyst-1'); // Default analyst
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchAnalystData();
  }, [timeRange, selectedAnalyst]);

  const fetchAnalystData = async () => {
    try {
      setLoading(true);
      setError(null);

      const endDate = new Date();
      const startDate = new Date();
      
      switch (timeRange) {
        case 'week':
          startDate.setDate(endDate.getDate() - 7);
          break;
        case 'month':
          startDate.setMonth(endDate.getMonth() - 1);
          break;
      }

      const response = await apiService.getAnalystDashboard(selectedAnalyst, 'month');

      setMetrics(response);
    } catch (err) {
      console.error('Error fetching analyst data:', err);
      setError('Failed to load analyst dashboard data');
    } finally {
      setLoading(false);
    }
  };

  const getTrendColor = (trend: string) => {
    switch (trend) {
      case 'IMPROVING': return 'text-green-600';
      case 'DETERIORATING': return 'text-red-600';
      default: return 'text-yellow-600';
    }
  };

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'IMPROVING': return '↗️';
      case 'DETERIORATING': return '↘️';
      default: return '→';
    }
  };

  const getShiftTypeColor = (shiftType: string) => {
    switch (shiftType) {
      case 'REGULAR': return 'text-blue-600 bg-blue-100';
      case 'WEEKEND': return 'text-orange-600 bg-orange-100';
      case 'HOLIDAY': return 'text-purple-600 bg-purple-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const formatPercentage = (value: number | undefined) => {
    if (value === undefined) return '0.0%';
    return `${(value * 100).toFixed(1)}%`;
  };

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric'
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <div className="flex">
          <div className="text-red-600">
            <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
          </div>
          <div className="ml-3">
            <h3 className="text-sm font-medium text-red-800">Error</h3>
            <p className="text-sm text-red-700 mt-1">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  if (!metrics) {
    return <div>No data available</div>;
  }

  // Prepare chart data - using upcoming schedule for now
  const historicalData = metrics.upcomingSchedule.slice(0, 10).map(schedule => ({
    date: formatDate(new Date(schedule.date)),
    fairness: metrics.personalMetrics.fairnessScore,
    workload: metrics.personalMetrics.totalShifts,
    satisfaction: 8.5 // Default value
  }));

  const upcomingScheduleData = metrics.upcomingSchedule.map(schedule => ({
    date: formatDate(new Date(schedule.date)),
    shiftType: schedule.shiftType,
    isScreener: schedule.isScreener,
    fairnessImpact: 0.85 // Default value
  }));

  const complianceData = [
            { name: 'Compliant', value: 0.95 },
        { name: 'Violations', value: 0.05 }
  ];

  const COLORS = ['#10B981', '#EF4444'];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Analyst Dashboard</h1>
          <p className="text-gray-600">Personal performance and fairness insights</p>
        </div>
        <div className="flex space-x-4">
          {/* Analyst Selector */}
          <select
            value={selectedAnalyst}
            onChange={(e) => setSelectedAnalyst(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="analyst-1">John Doe</option>
            <option value="analyst-2">Jane Smith</option>
            <option value="analyst-3">Mike Johnson</option>
          </select>
          
          {/* Time Range Selector */}
          <div className="flex space-x-2">
            {['week', 'month'].map((range) => (
              <button
                key={range}
                onClick={() => setTimeRange(range as any)}
                className={`px-3 py-1 rounded-md text-sm font-medium ${
                  timeRange === range
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {range.charAt(0).toUpperCase() + range.slice(1)}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Key Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Personal Fairness</p>
              <p className="text-2xl font-bold text-gray-900">
                {formatPercentage(metrics.personalMetrics.fairnessScore)}
              </p>
            </div>
            <div className="text-blue-600">
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Workload Trend</p>
              <p className="text-lg font-semibold text-gray-900">
                {getTrendIcon('STABLE')} STABLE
              </p>
            </div>
                          <div className={`text-lg ${getTrendColor('STABLE')}`}>
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Constraint Compliance</p>
              <p className="text-2xl font-bold text-gray-900">
                {formatPercentage(0.95)}
              </p>
            </div>
            <div className="text-green-600">
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Upcoming Shifts</p>
              <p className="text-2xl font-bold text-gray-900">
                {metrics.upcomingSchedule.length}
              </p>
            </div>
            <div className="text-orange-600">
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
          </div>
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Historical Performance Chart */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Historical Performance</h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={historicalData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip formatter={(value) => formatPercentage(value as number)} />
              <Legend />
              <Line type="monotone" dataKey="fairness" stroke="#3B82F6" name="Fairness" />
              <Line type="monotone" dataKey="satisfaction" stroke="#10B981" name="Satisfaction" />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Constraint Compliance */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Constraint Compliance</h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={complianceData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, value }) => `${name}: ${formatPercentage(value)}`}
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
              >
                {complianceData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(value) => formatPercentage(value as number)} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Upcoming Schedule */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Upcoming Schedule</h3>
        {metrics.upcomingSchedule.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Shift Type
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Role
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Fairness Impact
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {metrics.upcomingSchedule.map((schedule, index) => (
                  <tr key={index}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {formatDate(new Date(schedule.date))}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getShiftTypeColor(schedule.shiftType)}`}>
                        {schedule.shiftType}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {schedule.isScreener ? 'Screener' : 'Regular'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {0.85 > 0 ? '+' : ''}{formatPercentage(0.85)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-gray-500">No upcoming schedule available</p>
        )}
      </div>

      {/* Constraint Violations and Improvement Opportunities */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Constraint Violations */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Constraint Violations</h3>
          {metrics.recommendations.length > 0 ? (
            <div className="space-y-4">
              {metrics.recommendations.map((recommendation, index) => (
                <div key={index} className="border border-red-200 rounded-lg p-4 bg-red-50">
                  <div className="flex items-start">
                    <div className="flex-shrink-0">
                      <svg className="h-5 w-5 text-red-600" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <div className="ml-3">
                      <p className="text-sm font-medium text-red-800">Recommendation</p>
                      <p className="text-sm text-red-700 mt-1">{recommendation}</p>
                      <p className="text-xs text-red-600 mt-1">Active</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-500">No recent violations</p>
          )}
        </div>

        {/* Improvement Opportunities */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Improvement Opportunities</h3>
          {metrics.recommendations.length > 0 ? (
            <ul className="space-y-3">
              {metrics.recommendations.map((opportunity, index) => (
                <li key={index} className="flex items-start">
                  <div className="flex-shrink-0">
                    <svg className="h-5 w-5 text-blue-600" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <p className="ml-3 text-sm text-gray-700">{opportunity}</p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-gray-500">No improvement opportunities identified</p>
          )}
        </div>
      </div>

      {/* Performance Summary */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Performance Summary</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="text-center">
            <p className="text-2xl font-bold text-gray-900">
              {formatPercentage(metrics.personalMetrics.fairnessScore)}
            </p>
            <p className="text-sm text-gray-600">Latest Fairness Score</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-gray-900">
              {metrics.personalMetrics.totalShifts}
            </p>
            <p className="text-sm text-gray-600">Current Workload (days)</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-gray-900">
              8.5/10
            </p>
            <p className="text-sm text-gray-600">Satisfaction Rating</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AnalystDashboard; 