import React, { useState, useEffect } from 'react';
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';

interface BackgroundInsight {
  id: string;
  type: 'TREND' | 'ANOMALY' | 'PREDICTION' | 'RECOMMENDATION';
  title: string;
  description: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  confidence: number;
  generatedAt: string;
  data: any;
  actionable: boolean;
  suggestedActions?: string[];
}

interface AnalyticsMetrics {
  totalJobsRun: number;
  successfulJobs: number;
  failedJobs: number;
  averageExecutionTime: number;
  lastHealthCheck: string;
  systemHealth: 'HEALTHY' | 'DEGRADED' | 'CRITICAL';
}

interface AnalyticsJob {
  id: string;
  name: string;
  enabled: boolean;
  lastRun?: string;
  nextRun: string;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
}

interface AnalyticsSummary {
  summary: {
    totalAnalysts: number;
    activeAnalysts: number;
    totalSchedules: number;
    upcomingSchedules: number;
    conflicts: number;
    averageFairnessScore: number;
  };
  recentInsights: BackgroundInsight[];
  backgroundMetrics: AnalyticsMetrics;
  generatedAt: string;
}

const BackgroundAnalytics: React.FC = () => {
  const [insights, setInsights] = useState<BackgroundInsight[]>([]);
  const [metrics, setMetrics] = useState<AnalyticsMetrics | null>(null);
  const [jobs, setJobs] = useState<AnalyticsJob[]>([]);
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedInsightType, setSelectedInsightType] = useState<string>('all');
  const [selectedSeverity, setSelectedSeverity] = useState<string>('all');
  const [refreshInterval, setRefreshInterval] = useState<NodeJS.Timeout | null>(null);

  const COLORS = {
    LOW: '#10b981',
    MEDIUM: '#f59e0b', 
    HIGH: '#ef4444',
    CRITICAL: '#dc2626'
  };

  const INSIGHT_TYPE_COLORS = {
    TREND: '#3b82f6',
    ANOMALY: '#ef4444',
    PREDICTION: '#8b5cf6',
    RECOMMENDATION: '#10b981'
  };

  const fetchAnalyticsData = async () => {
    try {
      const [insightsRes, metricsRes, jobsRes, summaryRes] = await Promise.all([
        fetch('/api/analytics/insights?limit=50'),
        fetch('/api/analytics/metrics'),
        fetch('/api/analytics/jobs'),
        fetch('/api/analytics/summary')
      ]);

      if (insightsRes.ok) {
        const insightsData = await insightsRes.json();
        setInsights(insightsData.data || []);
      }

      if (metricsRes.ok) {
        const metricsData = await metricsRes.json();
        setMetrics(metricsData.data);
      }

      if (jobsRes.ok) {
        const jobsData = await jobsRes.json();
        setJobs(jobsData.data || []);
      }

      if (summaryRes.ok) {
        const summaryData = await summaryRes.json();
        setSummary(summaryData.data);
      }

      setError(null);
    } catch (err) {
      setError('Failed to fetch analytics data');
      console.error('Analytics fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  const toggleJob = async (jobId: string, action: 'enable' | 'disable') => {
    try {
      const response = await fetch(`/api/analytics/jobs/${jobId}/${action}`, {
        method: 'POST'
      });

      if (response.ok) {
        // Refresh jobs data
        await fetchAnalyticsData();
      } else {
        setError(`Failed to ${action} job`);
      }
    } catch (err) {
      setError(`Failed to ${action} job`);
      console.error('Job toggle error:', err);
    }
  };

  useEffect(() => {
    fetchAnalyticsData();

    // Set up auto-refresh every 30 seconds
    const interval = setInterval(fetchAnalyticsData, 30000);
    setRefreshInterval(interval);

    return () => {
      if (refreshInterval) {
        clearInterval(refreshInterval);
      }
    };
  }, []);

  const filteredInsights = insights.filter(insight => {
    const typeMatch = selectedInsightType === 'all' || insight.type === selectedInsightType;
    const severityMatch = selectedSeverity === 'all' || insight.severity === selectedSeverity;
    return typeMatch && severityMatch;
  });

  const insightsByType = insights.reduce((acc, insight) => {
    acc[insight.type] = (acc[insight.type] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const insightsBySeverity = insights.reduce((acc, insight) => {
    acc[insight.severity] = (acc[insight.severity] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const pieChartData = Object.entries(insightsBySeverity).map(([severity, count]) => ({
    name: severity,
    value: count,
    fill: COLORS[severity as keyof typeof COLORS]
  }));

  const typeChartData = Object.entries(insightsByType).map(([type, count]) => ({
    name: type,
    value: count,
    fill: INSIGHT_TYPE_COLORS[type as keyof typeof INSIGHT_TYPE_COLORS]
  }));

  const getHealthStatusColor = (health: string) => {
    switch (health) {
      case 'HEALTHY': return 'text-green-600 bg-green-100';
      case 'DEGRADED': return 'text-yellow-600 bg-yellow-100';
      case 'CRITICAL': return 'text-red-600 bg-red-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'LOW': return 'text-green-600 bg-green-100';
      case 'MEDIUM': return 'text-yellow-600 bg-yellow-100'; 
      case 'HIGH': return 'text-orange-600 bg-orange-100';
      case 'CRITICAL': return 'text-red-600 bg-red-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'LOW': return 'text-blue-600 bg-blue-100';
      case 'MEDIUM': return 'text-yellow-600 bg-yellow-100';
      case 'HIGH': return 'text-orange-600 bg-orange-100';
      case 'CRITICAL': return 'text-red-600 bg-red-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Background Analytics Dashboard</h1>
          <p className="mt-2 text-sm text-gray-600">
            Real-time insights and metrics from automated analytics processing
          </p>
          {error && (
            <div className="mt-4 p-4 bg-red-100 border border-red-300 rounded-md">
              <p className="text-red-700">{error}</p>
            </div>
          )}
        </div>

        {/* Summary Cards */}
        {summary && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <div className="bg-white overflow-hidden shadow rounded-lg">
              <div className="p-5">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <div className="w-8 h-8 bg-blue-500 rounded-md flex items-center justify-center">
                      <span className="text-white text-sm font-medium">A</span>
                    </div>
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 truncate">Active Analysts</dt>
                      <dd className="text-lg font-medium text-gray-900">{summary.summary.activeAnalysts}</dd>
                    </dl>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white overflow-hidden shadow rounded-lg">
              <div className="p-5">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <div className="w-8 h-8 bg-green-500 rounded-md flex items-center justify-center">
                      <span className="text-white text-sm font-medium">F</span>
                    </div>
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 truncate">Fairness Score</dt>
                      <dd className="text-lg font-medium text-gray-900">
                        {(summary.summary.averageFairnessScore * 100).toFixed(1)}%
                      </dd>
                    </dl>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white overflow-hidden shadow rounded-lg">
              <div className="p-5">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <div className="w-8 h-8 bg-purple-500 rounded-md flex items-center justify-center">
                      <span className="text-white text-sm font-medium">I</span>
                    </div>
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 truncate">Insights</dt>
                      <dd className="text-lg font-medium text-gray-900">{insights.length}</dd>
                    </dl>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white overflow-hidden shadow rounded-lg">
              <div className="p-5">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <div className={`w-8 h-8 rounded-md flex items-center justify-center ${
                      metrics?.systemHealth === 'HEALTHY' ? 'bg-green-500' : 
                      metrics?.systemHealth === 'DEGRADED' ? 'bg-yellow-500' : 'bg-red-500'
                    }`}>
                      <span className="text-white text-sm font-medium">H</span>
                    </div>
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 truncate">System Health</dt>
                      <dd className="text-lg font-medium text-gray-900">{metrics?.systemHealth || 'Unknown'}</dd>
                    </dl>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          {/* Insights Distribution Charts */}
          <div className="bg-white shadow rounded-lg p-6">
            <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">Insights by Type</h3>
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie
                  data={typeChartData}
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  dataKey="value"
                  label={({name, value}) => `${name}: ${value}`}
                >
                  {typeChartData.map((entry, index) => (
                    <Cell key={`type-cell-${index}`} fill={entry.fill} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="bg-white shadow rounded-lg p-6">
            <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">Insights by Severity</h3>
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie
                  data={pieChartData}
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  dataKey="value"
                  label={({name, value}) => `${name}: ${value}`}
                >
                  {pieChartData.map((entry, index) => (
                    <Cell key={`severity-cell-${index}`} fill={entry.fill} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* System Metrics */}
        {metrics && (
          <div className="bg-white shadow rounded-lg mb-8">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg leading-6 font-medium text-gray-900">System Performance</h3>
            </div>
            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <div className="text-center">
                  <dt className="text-sm font-medium text-gray-500">Total Jobs Run</dt>
                  <dd className="mt-1 text-2xl font-semibold text-gray-900">{metrics.totalJobsRun}</dd>
                </div>
                <div className="text-center">
                  <dt className="text-sm font-medium text-gray-500">Success Rate</dt>
                  <dd className="mt-1 text-2xl font-semibold text-green-600">
                    {metrics.totalJobsRun > 0 ? ((metrics.successfulJobs / metrics.totalJobsRun) * 100).toFixed(1) : 0}%
                  </dd>
                </div>
                <div className="text-center">
                  <dt className="text-sm font-medium text-gray-500">Avg Execution Time</dt>
                  <dd className="mt-1 text-2xl font-semibold text-gray-900">{metrics.averageExecutionTime.toFixed(0)}ms</dd>
                </div>
                <div className="text-center">
                  <dt className="text-sm font-medium text-gray-500">System Health</dt>
                  <dd className={`mt-1 text-sm font-medium px-2 py-1 rounded-full ${getHealthStatusColor(metrics.systemHealth)}`}>
                    {metrics.systemHealth}
                  </dd>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Background Jobs */}
        <div className="bg-white shadow rounded-lg mb-8">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg leading-6 font-medium text-gray-900">Background Analytics Jobs</h3>
          </div>
          <div className="p-6">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Job</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Priority</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Next Run</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {jobs.map((job) => (
                    <tr key={job.id}>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">{job.name}</div>
                        <div className="text-sm text-gray-500">{job.id}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getPriorityColor(job.priority)}`}>
                          {job.priority}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                          job.enabled ? 'text-green-800 bg-green-100' : 'text-red-800 bg-red-100'
                        }`}>
                          {job.enabled ? 'Enabled' : 'Disabled'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {new Date(job.nextRun).toLocaleString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <button
                          onClick={() => toggleJob(job.id, job.enabled ? 'disable' : 'enable')}
                          className={`${
                            job.enabled ? 'text-red-600 hover:text-red-900' : 'text-green-600 hover:text-green-900'
                          } mr-4`}
                        >
                          {job.enabled ? 'Disable' : 'Enable'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Insights List */}
        <div className="bg-white shadow rounded-lg">
          <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
            <h3 className="text-lg leading-6 font-medium text-gray-900">Recent Analytics Insights</h3>
            <div className="flex space-x-4">
              <select
                value={selectedInsightType}
                onChange={(e) => setSelectedInsightType(e.target.value)}
                className="border border-gray-300 rounded-md px-3 py-1 text-sm"
              >
                <option value="all">All Types</option>
                <option value="TREND">Trends</option>
                <option value="ANOMALY">Anomalies</option>
                <option value="PREDICTION">Predictions</option>
                <option value="RECOMMENDATION">Recommendations</option>
              </select>
              <select
                value={selectedSeverity}
                onChange={(e) => setSelectedSeverity(e.target.value)}
                className="border border-gray-300 rounded-md px-3 py-1 text-sm"
              >
                <option value="all">All Severities</option>
                <option value="LOW">Low</option>
                <option value="MEDIUM">Medium</option>
                <option value="HIGH">High</option>
                <option value="CRITICAL">Critical</option>
              </select>
            </div>
          </div>
          <div className="p-6">
            <div className="space-y-4">
              {filteredInsights.length > 0 ? filteredInsights.map((insight) => (
                <div key={insight.id} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex items-center space-x-3">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getSeverityColor(insight.severity)}`}>
                        {insight.severity}
                      </span>
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full text-white`}
                            style={{ backgroundColor: INSIGHT_TYPE_COLORS[insight.type] }}>
                        {insight.type}
                      </span>
                      <span className="text-xs text-gray-500">
                        {new Date(insight.generatedAt).toLocaleString()}
                      </span>
                    </div>
                    <div className="text-xs text-gray-500">
                      Confidence: {(insight.confidence * 100).toFixed(0)}%
                    </div>
                  </div>
                  <h4 className="text-lg font-medium text-gray-900 mb-2">{insight.title}</h4>
                  <p className="text-sm text-gray-600 mb-3">{insight.description}</p>
                  {insight.actionable && insight.suggestedActions && insight.suggestedActions.length > 0 && (
                    <div>
                      <h5 className="text-sm font-medium text-gray-900 mb-1">Suggested Actions:</h5>
                      <ul className="text-sm text-gray-600 space-y-1">
                        {insight.suggestedActions.map((action, index) => (
                          <li key={index} className="flex items-start">
                            <span className="text-blue-500 mr-2">•</span>
                            {action}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )) : (
                <div className="text-center py-8 text-gray-500">
                  No insights found matching the selected filters.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BackgroundAnalytics;