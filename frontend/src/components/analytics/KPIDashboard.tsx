import React, { useState, useEffect } from 'react';
import { 
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  AreaChart, Area
} from 'recharts';
import { apiService, KPIMetrics, BenchmarkComparison } from '../../services/api';

interface KPISummary {
  currentMetrics: KPIMetrics;
  trends: 'IMPROVING' | 'STABLE' | 'DETERIORATING';
  alerts: string[];
  benchmarks: BenchmarkComparison[];
  performanceHealth: 'EXCELLENT' | 'GOOD' | 'AVERAGE' | 'POOR';
}

interface PerformanceTrends {
  scheduleSuccess: { date: string; value: number }[];
  fairness: { date: string; value: number }[];
  violations: { date: string; value: number }[];
  satisfaction: { date: string; value: number }[];
  resolutionTime: { date: string; value: number }[];
}

const COLORS = ['#10B981', '#3B82F6', '#F59E0B', '#EF4444', '#8B5CF6'];

const KPIDashboard: React.FC = () => {
  const [summary, setSummary] = useState<KPISummary | null>(null);
  const [trends, setTrends] = useState<PerformanceTrends | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'trends' | 'benchmarks' | 'alerts'>('overview');

  useEffect(() => {
    fetchKPIData();
  }, []);

  const fetchKPIData = async () => {
    try {
      setLoading(true);
      setError(null);

      const [summaryData, trendsData] = await Promise.all([
        apiService.getKPISummary(),
        apiService.getKPITrends()
      ]);

      setSummary(summaryData);
      setTrends(trendsData);
    } catch (err) {
      console.error('Error fetching KPI data:', err);
      setError('Failed to load KPI data. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const formatPercentage = (value: number) => `${(value * 100).toFixed(1)}%`;
  const formatScore = (value: number) => (value * 100).toFixed(1);
  const formatTime = (value: number) => `${value.toFixed(1)}h`;

  const getTrendColor = (trend: string) => {
    switch (trend) {
      case 'IMPROVING': return '#10B981';
      case 'DETERIORATING': return '#EF4444';
      default: return '#6B7280';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'EXCELLENT': return '#10B981';
      case 'GOOD': return '#3B82F6';
      case 'AVERAGE': return '#F59E0B';
      case 'BELOW_AVERAGE': return '#F97316';
      case 'POOR': return '#EF4444';
      default: return '#6B7280';
    }
  };

  const getHealthColor = (health: string) => {
    switch (health) {
      case 'EXCELLENT': return '#10B981';
      case 'GOOD': return '#3B82F6';
      case 'AVERAGE': return '#F59E0B';
      case 'POOR': return '#EF4444';
      default: return '#6B7280';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <div className="flex">
          <div className="text-red-400">
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

  if (!summary) {
    return <div>No KPI data available</div>;
  }

  const { currentMetrics, trends: summaryTrends, alerts, benchmarks, performanceHealth } = summary;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">KPI Dashboard</h2>
          <p className="text-gray-600">Real-time performance metrics and analytics</p>
        </div>
        <div className="flex items-center space-x-2">
          <span className="text-sm text-gray-500">Performance Health:</span>
          <span 
            className="px-3 py-1 rounded-full text-sm font-medium"
            style={{ backgroundColor: `${getHealthColor(performanceHealth)}20`, color: getHealthColor(performanceHealth) }}
          >
            {performanceHealth}
          </span>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          {[
            { id: 'overview', label: 'Overview' },
            { id: 'trends', label: 'Trends' },
            { id: 'benchmarks', label: 'Benchmarks' },
            { id: 'alerts', label: 'Alerts' }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === tab.id
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* KPI Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            <div className="bg-white rounded-lg shadow p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Schedule Success</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {formatPercentage(currentMetrics.scheduleSuccessRate)}
                  </p>
                </div>
                <div className="text-green-500">
                  <svg className="h-8 w-8" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Fairness Score</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {formatScore(currentMetrics.averageFairnessScore)}
                  </p>
                </div>
                <div className="text-blue-500">
                  <svg className="h-8 w-8" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Violation Rate</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {formatPercentage(currentMetrics.constraintViolationRate)}
                  </p>
                </div>
                <div className="text-red-500">
                  <svg className="h-8 w-8" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">User Satisfaction</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {currentMetrics.userSatisfactionScore.toFixed(1)}/10
                  </p>
                </div>
                <div className="text-yellow-500">
                  <svg className="h-8 w-8" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM7 9a1 1 0 100-2 1 1 0 000 2zm7-1a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v1a1 1 0 001 1h1a1 1 0 100-2v-1a1 1 0 00-1-1H9z" clipRule="evenodd" />
                  </svg>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Resolution Time</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {formatTime(currentMetrics.conflictResolutionTime)}
                  </p>
                </div>
                <div className="text-purple-500">
                  <svg className="h-8 w-8" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
                  </svg>
                </div>
              </div>
            </div>
          </div>

          {/* Trend Overview */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Overall Trend</h3>
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                                 <div 
                   className="w-4 h-4 rounded-full"
                   style={{ backgroundColor: getTrendColor(summaryTrends) }}
                 ></div>
                                 <span className="text-sm font-medium text-gray-700">
                   {summaryTrends.charAt(0).toUpperCase() + summaryTrends.slice(1).toLowerCase()}
                 </span>
              </div>
              <span className="text-sm text-gray-500">
                Last updated: {new Date(currentMetrics.lastUpdated).toLocaleString()}
              </span>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'trends' && trends && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Schedule Success Trend */}
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Schedule Success Rate</h3>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={trends.scheduleSuccess}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip formatter={(value) => formatPercentage(value as number)} />
                  <Line type="monotone" dataKey="value" stroke="#10B981" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* Fairness Trend */}
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Fairness Score</h3>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={trends.fairness}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip formatter={(value) => formatScore(value as number)} />
                  <Line type="monotone" dataKey="value" stroke="#3B82F6" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* Violation Rate Trend */}
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Constraint Violation Rate</h3>
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={trends.violations}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip formatter={(value) => formatPercentage(value as number)} />
                  <Area type="monotone" dataKey="value" stroke="#EF4444" fill="#EF4444" fillOpacity={0.3} />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            {/* User Satisfaction Trend */}
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">User Satisfaction</h3>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={trends.satisfaction}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  <Line type="monotone" dataKey="value" stroke="#F59E0B" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'benchmarks' && (
        <div className="space-y-6">
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">Industry Benchmark Comparison</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Metric
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Current
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Industry Average
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Improvement
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {benchmarks.map((benchmark, index) => (
                    <tr key={index}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {benchmark.metric}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {benchmark.metric.includes('Rate') || benchmark.metric.includes('Score') 
                          ? formatPercentage(benchmark.currentValue)
                          : benchmark.metric.includes('Time')
                          ? formatTime(benchmark.currentValue)
                          : benchmark.currentValue.toFixed(2)
                        }
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {benchmark.metric.includes('Rate') || benchmark.metric.includes('Score')
                          ? formatPercentage(benchmark.industryAverage)
                          : benchmark.metric.includes('Time')
                          ? formatTime(benchmark.industryAverage)
                          : benchmark.industryAverage.toFixed(2)
                        }
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span 
                          className="px-2 py-1 text-xs font-medium rounded-full"
                          style={{ 
                            backgroundColor: `${getStatusColor(benchmark.status)}20`, 
                            color: getStatusColor(benchmark.status) 
                          }}
                        >
                          {benchmark.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {benchmark.improvement > 0 ? '+' : ''}
                        {benchmark.metric.includes('Rate') || benchmark.metric.includes('Score')
                          ? formatPercentage(Math.abs(benchmark.improvement))
                          : benchmark.metric.includes('Time')
                          ? formatTime(Math.abs(benchmark.improvement))
                          : benchmark.improvement.toFixed(2)
                        }
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'alerts' && (
        <div className="space-y-6">
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Active Alerts</h3>
            {alerts.length === 0 ? (
              <div className="text-center py-8">
                <div className="text-green-500 mb-2">
                  <svg className="h-12 w-12 mx-auto" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                </div>
                <p className="text-gray-500">No active alerts. All KPIs are within target ranges.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {alerts.map((alert, index) => (
                  <div key={index} className="flex items-start space-x-3 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                    <div className="text-yellow-400 mt-0.5">
                      <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <div className="flex-1">
                      <p className="text-sm text-yellow-800">{alert}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default KPIDashboard; 