import React, { useState, useEffect } from 'react';
import { 
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  AreaChart, Area, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar
} from 'recharts';
import { apiService, ExecutiveDashboard, BenchmarkComparison } from '../../services/api';

const ExecutiveDashboardComponent: React.FC = () => {
  const [metrics, setMetrics] = useState<ExecutiveDashboard | null>(null);
  const [benchmarks, setBenchmarks] = useState<BenchmarkComparison[]>([]);
  const [timeRange, setTimeRange] = useState<'week' | 'month' | 'quarter'>('month');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchExecutiveData();
  }, [timeRange]);

  const fetchExecutiveData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [metricsResponse, benchmarksResponse] = await Promise.all([
        apiService.getExecutiveDashboard(timeRange),
        apiService.getBenchmarkComparison()
      ]);
      setMetrics(metricsResponse);
      setBenchmarks(benchmarksResponse);
    } catch (err) {
      console.error('Error fetching executive data:', err);
      setError('Failed to load executive dashboard data');
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

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'EXCELLENT': return 'text-green-600 bg-green-100';
      case 'GOOD': return 'text-blue-600 bg-blue-100';
      case 'AVERAGE': return 'text-yellow-600 bg-yellow-100';
      case 'BELOW_AVERAGE': return 'text-orange-600 bg-orange-100';
      case 'POOR': return 'text-red-600 bg-red-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
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

  // Prepare chart data
  const kpiData = [
    { name: 'Fairness Score', value: metrics.kpiReport.metrics.averageFairnessScore, target: 0.8 },
    { name: 'Utilization Rate', value: metrics.kpiReport.metrics.scheduleSuccessRate, target: 0.85 },
    { name: 'Success Rate', value: 1 - metrics.kpiReport.metrics.constraintViolationRate, target: 0.95 }
  ];

  // Prepare trend data (single trend value)
  const trendData = [
    { name: 'Fairness Trend', value: metrics.fairnessTrend.trend === 'IMPROVING' ? 1 : metrics.fairnessTrend.trend === 'DETERIORATING' ? -1 : 0 }
  ];

  const benchmarkData = benchmarks.map(b => ({
    name: b.metric,
    current: b.currentValue,
    industry: b.industryAverage,
    status: b.status
  }));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Executive Dashboard</h1>
          <p className="text-gray-600">Strategic insights and performance overview</p>
        </div>
        <div className="flex space-x-2">
          {['week', 'month', 'quarter'].map((range) => (
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

      {/* Key Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Overall Fairness</p>
              <p className="text-2xl font-bold text-gray-900">
                {formatPercentage(metrics.kpiReport.metrics.averageFairnessScore)}
              </p>
            </div>
            <div className={`text-lg ${getTrendColor(metrics.fairnessTrend.trend)}`}>
              {getTrendIcon(metrics.fairnessTrend.trend)}
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Utilization Rate</p>
              <p className="text-2xl font-bold text-gray-900">
                {formatPercentage(metrics.kpiReport.metrics.scheduleSuccessRate)}
              </p>
            </div>
            <div className={`text-lg ${getTrendColor(metrics.fairnessTrend.trend)}`}>
              {getTrendIcon(metrics.fairnessTrend.trend)}
            </div>
          </div>
        </div>

        {/* Remove or comment out systemPerformance and costOptimization cards/fields */}
        {/*
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">System Uptime</p>
              <p className="text-2xl font-bold text-gray-900">
                {metrics.summary.systemPerformance.uptime.toFixed(1)}%
              </p>
            </div>
            <div className="text-green-600">
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Cost Savings</p>
              <p className="text-2xl font-bold text-gray-900">
                {formatCurrency(metrics.summary.costOptimization.costSavings)}
              </p>
            </div>
            <div className="text-green-600">
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
              </svg>
            </div>
          </div>
        </div>
        */}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* KPI Performance Chart */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">KPI Performance</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={kpiData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip formatter={(value) => formatPercentage(value as number)} />
              <Legend />
              <Bar dataKey="value" fill="#3B82F6" name="Current" />
              <Bar dataKey="target" fill="#10B981" name="Target" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Trend Analysis */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Trend Analysis</h3>
          <ResponsiveContainer width="100%" height={300}>
            <RadarChart data={trendData}>
              <PolarGrid />
              <PolarAngleAxis dataKey="name" />
              <PolarRadiusAxis />
              <Radar name="Trend" dataKey="value" stroke="#3B82F6" fill="#3B82F6" fillOpacity={0.3} />
            </RadarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Benchmark Comparison */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Industry Benchmark Comparison</h3>
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
                  Industry Avg
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Percentile
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
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
                      : benchmark.currentValue.toFixed(2)
                    }
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {benchmark.metric.includes('Rate') || benchmark.metric.includes('Score')
                      ? formatPercentage(benchmark.industryAverage)
                      : benchmark.industryAverage.toFixed(2)
                    }
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {benchmark.percentile.toFixed(0)}%
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(benchmark.status)}`}>
                      {benchmark.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Strategic Insights and Alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Strategic Insights */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Strategic Insights</h3>
          {metrics.summary.keyInsights.length > 0 ? (
            <ul className="space-y-3">
              {metrics.summary.keyInsights.map((insight, index) => (
                <li key={index} className="flex items-start">
                  <div className="flex-shrink-0">
                    <svg className="h-5 w-5 text-blue-600" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <p className="ml-3 text-sm text-gray-700">{insight}</p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-gray-500">No strategic insights available</p>
          )}
        </div>

        {/* Alerts */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">System Alerts</h3>
          {metrics.kpiReport.alerts.length > 0 ? (
            <ul className="space-y-3">
              {metrics.kpiReport.alerts.map((alert, index) => (
                <li key={index} className="flex items-start">
                  <div className="flex-shrink-0">
                    <svg className="h-5 w-5 text-red-600" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <p className="ml-3 text-sm text-red-700">{alert}</p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-gray-500">No system alerts</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default ExecutiveDashboardComponent; 