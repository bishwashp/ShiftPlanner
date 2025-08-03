import React, { useState, useEffect } from 'react';
import { 
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  AreaChart, Area, ScatterChart, Scatter
} from 'recharts';
import { apiService, ManagerDashboard } from '../../services/api';

const ManagerAnalytics: React.FC = () => {
  const [metrics, setMetrics] = useState<ManagerDashboard | null>(null);
  const [selectedTeam, setSelectedTeam] = useState<string>('team-1');
  const [timeRange, setTimeRange] = useState<'week' | 'month'>('week');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchManagerData();
  }, [selectedTeam, timeRange]);

  const fetchManagerData = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await apiService.getManagerDashboard(selectedTeam, timeRange);

      setMetrics(response);
    } catch (err) {
      console.error('Error fetching manager data:', err);
      setError('Failed to load manager dashboard data');
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

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'HIGH': return 'text-red-600 bg-red-100';
      case 'MEDIUM': return 'text-yellow-600 bg-yellow-100';
      case 'LOW': return 'text-green-600 bg-green-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const formatPercentage = (value: number) => {
    return `${(value * 100).toFixed(1)}%`;
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

  // Prepare chart data - using available fields only
  const fairnessTrendData = [
    { name: 'Current', value: metrics.fairnessTrend.currentScore },
    { name: 'Predicted', value: metrics.fairnessTrend.predictedScore }
  ];

  const workloadData = [
    { name: 'Total Analysts', value: metrics.workloadAnalysis.totalAnalysts },
    { name: 'Average Workload', value: metrics.workloadAnalysis.averageWorkload }
  ];

  // Mock data for unavailable fields
  const individualPerformanceData = [
    { name: 'Analyst 1', fairness: 0.85, workload: 15, satisfaction: 8.5, trend: 'IMPROVING' as const },
    { name: 'Analyst 2', fairness: 0.78, workload: 12, satisfaction: 7.8, trend: 'STABLE' as const },
    { name: 'Analyst 3', fairness: 0.92, workload: 18, satisfaction: 9.2, trend: 'IMPROVING' as const }
  ];

  const upcomingConflicts = [
    { id: '1', type: 'Schedule Conflict', severity: 'MEDIUM', description: 'Overlapping shifts', affectedAnalysts: ['Analyst 1', 'Analyst 2'], resolutionStrategy: 'Reschedule' }
  ];

  const constraintEffectiveness = {
    complianceRate: 0.95,
    violationTrend: 'IMPROVING' as const,
    topViolations: ['Max screener days exceeded', 'Consecutive days limit']
  };

  const workloadDistributionData = [
    { name: 'Standard Deviation', value: 0.15 },
    { name: 'Gini Coefficient', value: 0.25 },
    { name: 'Max/Min Ratio', value: 1.8 }
  ];

  const conflictData = [
    { severity: 'High', count: upcomingConflicts.filter(c => c.severity === 'HIGH').length },
    { severity: 'Medium', count: upcomingConflicts.filter(c => c.severity === 'MEDIUM').length },
    { severity: 'Low', count: upcomingConflicts.filter(c => c.severity === 'LOW').length }
  ];

  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042'];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Manager Analytics</h1>
          <p className="text-gray-600">Team performance and operational insights</p>
        </div>
        <div className="flex space-x-4">
          {/* Team Selector */}
          <select
            value={selectedTeam}
            onChange={(e) => setSelectedTeam(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="team-1">Team Alpha</option>
            <option value="team-2">Team Beta</option>
            <option value="team-3">Team Gamma</option>
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
              <p className="text-sm font-medium text-gray-600">Team Fairness</p>
                              <p className="text-2xl font-bold text-gray-900">
                  {formatPercentage(metrics.fairnessTrend.currentScore)}
                </p>
            </div>
            <div className="text-blue-600">
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Workload Balance</p>
              <p className="text-2xl font-bold text-gray-900">
                {formatPercentage(0.75)} {/* Mock data */}
              </p>
            </div>
            <div className="text-green-600">
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Constraint Compliance</p>
              <p className="text-2xl font-bold text-gray-900">
                {formatPercentage(constraintEffectiveness.complianceRate)}
              </p>
            </div>
            <div className={`text-lg ${getTrendColor(constraintEffectiveness.violationTrend)}`}>
              {getTrendIcon(constraintEffectiveness.violationTrend)}
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Active Conflicts</p>
              <p className="text-2xl font-bold text-gray-900">
                {upcomingConflicts.length}
              </p>
            </div>
            <div className="text-orange-600">
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
          </div>
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Individual Performance Chart */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Individual Performance</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={individualPerformanceData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip formatter={(value) => formatPercentage(value as number)} />
              <Legend />
              <Bar dataKey="fairness" fill="#3B82F6" name="Fairness" />
              <Bar dataKey="satisfaction" fill="#10B981" name="Satisfaction" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Workload Distribution */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Workload Distribution Metrics</h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={workloadDistributionData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, value }) => `${name}: ${(value || 0).toFixed(2)}`}
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
              >
                {workloadDistributionData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Individual Performance Table */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Team Member Performance</h3>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Analyst
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Fairness Score
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Workload
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Satisfaction
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Trend
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {individualPerformanceData.map((analyst, index) => (
                <tr key={index}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {analyst.name}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {formatPercentage(analyst.fairness)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {analyst.workload} days
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {analyst.satisfaction}/10
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex items-center px-2 py-1 text-xs font-medium rounded-full ${getTrendColor(analyst.trend)}`}>
                      {getTrendIcon(analyst.trend)} {analyst.trend}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Conflicts and Recommendations */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Upcoming Conflicts */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Upcoming Conflicts</h3>
          {upcomingConflicts.length > 0 ? (
            <div className="space-y-4">
              {upcomingConflicts.map((conflict, index) => (
                <div key={index} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-2 mb-2">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getSeverityColor(conflict.severity)}`}>
                          {conflict.severity}
                        </span>
                        <span className="text-sm font-medium text-gray-900">{conflict.type}</span>
                      </div>
                      <p className="text-sm text-gray-700 mb-2">{conflict.description}</p>
                      <p className="text-sm text-gray-600">
                        <strong>Resolution:</strong> {conflict.resolutionStrategy}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-500">No upcoming conflicts detected</p>
          )}
        </div>

        {/* Recommendations */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Recommendations</h3>
          {metrics.recommendations.length > 0 ? (
            <ul className="space-y-3">
              {metrics.recommendations.map((recommendation, index) => (
                <li key={index} className="flex items-start">
                  <div className="flex-shrink-0">
                    <svg className="h-5 w-5 text-blue-600" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <p className="ml-3 text-sm text-gray-700">{recommendation.description}</p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-gray-500">No recommendations available</p>
          )}
        </div>
      </div>

      {/* Constraint Effectiveness */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Constraint Effectiveness</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="text-center">
            <p className="text-2xl font-bold text-gray-900">
                              {formatPercentage(constraintEffectiveness.complianceRate)}
            </p>
            <p className="text-sm text-gray-600">Compliance Rate</p>
          </div>
          <div className="text-center">
            <p className="text-lg font-semibold text-gray-900">
              {getTrendIcon(constraintEffectiveness.violationTrend)} {constraintEffectiveness.violationTrend}
            </p>
            <p className="text-sm text-gray-600">Violation Trend</p>
          </div>
          <div className="text-center">
            <p className="text-lg font-semibold text-gray-900">
              {constraintEffectiveness.topViolations.length}
            </p>
            <p className="text-sm text-gray-600">Top Violation Types</p>
          </div>
        </div>
        
        {constraintEffectiveness.topViolations.length > 0 && (
          <div className="mt-4">
            <h4 className="text-sm font-medium text-gray-900 mb-2">Top Violation Types:</h4>
            <ul className="list-disc list-inside text-sm text-gray-700 space-y-1">
              {constraintEffectiveness.topViolations.map((violation, index) => (
                <li key={index}>{violation}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
};

export default ManagerAnalytics; 