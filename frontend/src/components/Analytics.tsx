import React, { useState, useEffect } from 'react';
import { 
  LineChart, Line, AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar
} from 'recharts';
import { apiService, KPIMetrics, FairnessTrend, FairnessRecommendation, BenchmarkComparison } from '../services/api';
import KPIDashboard from './analytics/KPIDashboard';

interface MonthlyTally {
  analystId: string;
  analystName: string;
  workDays: number;
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8'];

const Analytics: React.FC = () => {
  const [tallyData, setTallyData] = useState<MonthlyTally[]>([]);
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [loading, setLoading] = useState(true);
  
  // Phase 3 Analytics State
  const [kpiMetrics, setKpiMetrics] = useState<KPIMetrics | null>(null);
  const [fairnessTrend, setFairnessTrend] = useState<FairnessTrend | null>(null);
  const [recommendations, setRecommendations] = useState<FairnessRecommendation[]>([]);
  const [benchmarks, setBenchmarks] = useState<BenchmarkComparison[]>([]);
  const [activeTab, setActiveTab] = useState<'overview' | 'fairness' | 'kpi' | 'benchmarks' | 'kpi-dashboard'>('overview');

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        
        // Fetch all analytics data in parallel
        const [
          tallyResponse,
          kpiResponse,
          fairnessResponse,
          recommendationsResponse,
          benchmarksResponse
        ] = await Promise.all([
          apiService.getWorkDayTally(selectedMonth, selectedYear),
          apiService.getCurrentKPIMetrics(),
          apiService.getFairnessTrends(
            new Date(selectedYear, selectedMonth - 1, 1).toISOString(),
            new Date(selectedYear, selectedMonth, 0).toISOString()
          ),
          apiService.getFairnessRecommendations(),
          apiService.getBenchmarkComparison()
        ]);

        setTallyData(tallyResponse);
        setKpiMetrics(kpiResponse);
        setFairnessTrend(fairnessResponse);
        setRecommendations(recommendationsResponse);
        setBenchmarks(benchmarksResponse);
      } catch (error) {
        console.error('Failed to fetch analytics data', error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [selectedMonth, selectedYear]);

  const formatPercentage = (value: number) => `${(value * 100).toFixed(1)}%`;
  const formatScore = (value: number) => (value * 100).toFixed(1);

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

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'CRITICAL': return '#EF4444';
      case 'HIGH': return '#F97316';
      case 'MEDIUM': return '#F59E0B';
      case 'LOW': return '#10B981';
      default: return '#6B7280';
    }
  };

  if (loading) {
    return (
      <div className="space-y-6 bg-background text-foreground p-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Loading analytics data...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 bg-background text-foreground p-6">
      {/* Header with Date Selector */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">Analytics Dashboard</h1>
        <div className="flex space-x-3">
          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(Number(e.target.value))}
            className="px-3 py-2 border border-border rounded-lg bg-input focus:outline-none focus:ring-2 focus:ring-ring"
          >
            {Array.from({ length: 12 }, (_, i) => (
              <option key={i + 1} value={i + 1}>
                {new Date(2024, i).toLocaleDateString('en-US', { month: 'long' })}
              </option>
            ))}
          </select>
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(Number(e.target.value))}
            className="px-3 py-2 border border-border rounded-lg bg-input focus:outline-none focus:ring-2 focus:ring-ring"
          >
            {Array.from({ length: 5 }, (_, i) => (
              <option key={2024 - i} value={2024 - i}>
                {2024 - i}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex space-x-1 border-b border-border">
        {[
          { id: 'overview', label: 'Overview' },
          { id: 'fairness', label: 'Fairness Analysis' },
          { id: 'kpi', label: 'KPI Metrics' },
          { id: 'benchmarks', label: 'Benchmarks' },
          { id: 'kpi-dashboard', label: 'KPI Dashboard' }
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`px-4 py-2 rounded-t-lg font-medium transition-colors ${
              activeTab === tab.id
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground hover:bg-muted/80'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Overview Tab */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* KPI Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {kpiMetrics && (
              <>
                <div className="bg-card text-card-foreground rounded-xl shadow-sm border border-border p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Schedule Success</p>
                      <p className="text-2xl font-bold">{formatPercentage(kpiMetrics.scheduleSuccessRate)}</p>
                    </div>
                    <div className={`w-3 h-3 rounded-full ${getTrendColor(kpiMetrics.trend)}`}></div>
                  </div>
                </div>
                <div className="bg-card text-card-foreground rounded-xl shadow-sm border border-border p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Fairness Score</p>
                      <p className="text-2xl font-bold">{formatScore(kpiMetrics.averageFairnessScore)}</p>
                    </div>
                    <div className={`w-3 h-3 rounded-full ${getTrendColor(kpiMetrics.trend)}`}></div>
                  </div>
                </div>
                <div className="bg-card text-card-foreground rounded-xl shadow-sm border border-border p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Violation Rate</p>
                      <p className="text-2xl font-bold">{formatPercentage(kpiMetrics.constraintViolationRate)}</p>
                    </div>
                    <div className={`w-3 h-3 rounded-full ${getTrendColor(kpiMetrics.trend)}`}></div>
                  </div>
                </div>
                <div className="bg-card text-card-foreground rounded-xl shadow-sm border border-border p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">User Satisfaction</p>
                      <p className="text-2xl font-bold">{kpiMetrics.userSatisfactionScore.toFixed(1)}/10</p>
                    </div>
                    <div className={`w-3 h-3 rounded-full ${getTrendColor(kpiMetrics.trend)}`}></div>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Charts Row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Workload Distribution */}
            <div className="bg-card text-card-foreground rounded-xl shadow-sm border border-border p-6">
              <h3 className="text-lg font-semibold mb-4">Workload Distribution</h3>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={tallyData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="analystName" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="workDays" fill="#3B82F6" />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Fairness Trend */}
            <div className="bg-card text-card-foreground rounded-xl shadow-sm border border-border p-6">
              <h3 className="text-lg font-semibold mb-4">Fairness Trend</h3>
              {fairnessTrend && (
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={[
                    { name: 'Current', score: fairnessTrend.currentScore },
                    { name: 'Predicted', score: fairnessTrend.predictedScore }
                  ]}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip formatter={(value) => formatScore(value as number)} />
                    <Line type="monotone" dataKey="score" stroke="#10B981" strokeWidth={2} />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* Top Recommendations */}
          <div className="bg-card text-card-foreground rounded-xl shadow-sm border border-border p-6">
            <h3 className="text-lg font-semibold mb-4">Top Recommendations</h3>
            <div className="space-y-3">
              {recommendations.slice(0, 3).map((rec) => (
                <div key={rec.id} className="flex items-start space-x-3 p-3 bg-muted rounded-lg">
                  <div 
                    className="w-3 h-3 rounded-full mt-2 flex-shrink-0"
                    style={{ backgroundColor: getPriorityColor(rec.priority) }}
                  ></div>
                  <div className="flex-1">
                    <p className="font-medium">{rec.description}</p>
                    <p className="text-sm text-muted-foreground">
                      Expected improvement: {formatPercentage(rec.expectedImprovement)} | 
                      Confidence: {formatPercentage(rec.confidence)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Fairness Analysis Tab */}
      {activeTab === 'fairness' && (
        <div className="space-y-6">
          {fairnessTrend && (
            <>
              {/* Fairness Trend Chart */}
              <div className="bg-card text-card-foreground rounded-xl shadow-sm border border-border p-6">
                <h3 className="text-lg font-semibold mb-4">Fairness Trend Analysis</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                  <div className="text-center">
                    <p className="text-sm text-muted-foreground">Current Score</p>
                    <p className="text-2xl font-bold">{formatScore(fairnessTrend.currentScore)}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-sm text-muted-foreground">Predicted Score</p>
                    <p className="text-2xl font-bold">{formatScore(fairnessTrend.predictedScore)}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-sm text-muted-foreground">Confidence</p>
                    <p className="text-2xl font-bold">{formatPercentage(fairnessTrend.confidence)}</p>
                  </div>
                </div>
                <ResponsiveContainer width="100%" height={300}>
                  <AreaChart data={[
                    { name: 'Current', score: fairnessTrend.currentScore },
                    { name: 'Predicted', score: fairnessTrend.predictedScore }
                  ]}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip formatter={(value) => formatScore(value as number)} />
                    <Area type="monotone" dataKey="score" stroke="#10B981" fill="#10B981" fillOpacity={0.3} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>

              {/* Risk Factors and Mitigation */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-card text-card-foreground rounded-xl shadow-sm border border-border p-6">
                  <h3 className="text-lg font-semibold mb-4">Risk Factors</h3>
                  <div className="space-y-2">
                    {fairnessTrend.riskFactors.map((factor, index) => (
                      <div key={index} className="flex items-center space-x-2">
                        <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                        <span className="text-sm">{factor}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="bg-card text-card-foreground rounded-xl shadow-sm border border-border p-6">
                  <h3 className="text-lg font-semibold mb-4">Mitigation Strategies</h3>
                  <div className="space-y-2">
                    {fairnessTrend.mitigationStrategies.map((strategy, index) => (
                      <div key={index} className="flex items-center space-x-2">
                        <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                        <span className="text-sm">{strategy}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </>
          )}

          {/* All Recommendations */}
          <div className="bg-card text-card-foreground rounded-xl shadow-sm border border-border p-6">
            <h3 className="text-lg font-semibold mb-4">Fairness Recommendations</h3>
            <div className="space-y-4">
              {recommendations.map((rec) => (
                <div key={rec.id} className="border border-border rounded-lg p-4">
                  <div className="flex items-start justify-between mb-2">
                    <h4 className="font-medium">{rec.description}</h4>
                    <span 
                      className="px-2 py-1 text-xs rounded-full text-white"
                      style={{ backgroundColor: getPriorityColor(rec.priority) }}
                    >
                      {rec.priority}
                    </span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-muted-foreground">
                    <div>Type: {rec.type.replace('_', ' ')}</div>
                    <div>Expected Improvement: {formatPercentage(rec.expectedImprovement)}</div>
                    <div>Confidence: {formatPercentage(rec.confidence)}</div>
                  </div>
                  <div className="mt-3">
                    <p className="text-sm font-medium mb-1">Suggested Actions:</p>
                    <ul className="text-sm text-muted-foreground space-y-1">
                      {rec.suggestedActions.map((action, index) => (
                        <li key={index} className="flex items-center space-x-2">
                          <span>•</span>
                          <span>{action}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* KPI Metrics Tab */}
      {activeTab === 'kpi' && (
        <div className="space-y-6">
          {kpiMetrics && (
            <>
              {/* KPI Overview */}
              <div className="bg-card text-card-foreground rounded-xl shadow-sm border border-border p-6">
                <h3 className="text-lg font-semibold mb-4">KPI Overview</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                  <div className="text-center">
                    <p className="text-sm text-muted-foreground">Schedule Success</p>
                    <p className="text-2xl font-bold">{formatPercentage(kpiMetrics.scheduleSuccessRate)}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-sm text-muted-foreground">Fairness Score</p>
                    <p className="text-2xl font-bold">{formatScore(kpiMetrics.averageFairnessScore)}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-sm text-muted-foreground">Violation Rate</p>
                    <p className="text-2xl font-bold">{formatPercentage(kpiMetrics.constraintViolationRate)}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-sm text-muted-foreground">User Satisfaction</p>
                    <p className="text-2xl font-bold">{kpiMetrics.userSatisfactionScore.toFixed(1)}/10</p>
                  </div>
                  <div className="text-center">
                    <p className="text-sm text-muted-foreground">Resolution Time</p>
                    <p className="text-2xl font-bold">{kpiMetrics.conflictResolutionTime.toFixed(1)}h</p>
                  </div>
                </div>
              </div>

              {/* KPI Radar Chart */}
              <div className="bg-card text-card-foreground rounded-xl shadow-sm border border-border p-6">
                <h3 className="text-lg font-semibold mb-4">KPI Performance Radar</h3>
                <ResponsiveContainer width="100%" height={400}>
                  <RadarChart data={[
                    {
                      metric: 'Schedule Success',
                      value: kpiMetrics.scheduleSuccessRate,
                      fullMark: 1,
                    },
                    {
                      metric: 'Fairness Score',
                      value: kpiMetrics.averageFairnessScore,
                      fullMark: 1,
                    },
                    {
                      metric: 'User Satisfaction',
                      value: kpiMetrics.userSatisfactionScore / 10,
                      fullMark: 1,
                    },
                    {
                      metric: 'Resolution Time',
                      value: 1 - (kpiMetrics.conflictResolutionTime / 72), // Normalize to 0-1
                      fullMark: 1,
                    },
                    {
                      metric: 'Violation Rate',
                      value: 1 - kpiMetrics.constraintViolationRate, // Invert for better = higher
                      fullMark: 1,
                    },
                  ]}>
                    <PolarGrid />
                    <PolarAngleAxis dataKey="metric" />
                    <PolarRadiusAxis angle={90} domain={[0, 1]} />
                    <Radar name="KPI Performance" dataKey="value" stroke="#3B82F6" fill="#3B82F6" fillOpacity={0.3} />
                    <Tooltip formatter={(value) => formatPercentage(value as number)} />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
            </>
          )}
        </div>
      )}

      {/* Benchmarks Tab */}
      {activeTab === 'benchmarks' && (
        <div className="space-y-6">
          <div className="bg-card text-card-foreground rounded-xl shadow-sm border border-border p-6">
            <h3 className="text-lg font-semibold mb-4">Industry Benchmark Comparison</h3>
            <div className="space-y-4">
              {benchmarks.map((benchmark, index) => (
                <div key={index} className="border border-border rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="font-medium">{benchmark.metric}</h4>
                    <span 
                      className="px-2 py-1 text-xs rounded-full text-white"
                      style={{ backgroundColor: getStatusColor(benchmark.status) }}
                    >
                      {benchmark.status}
                    </span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-sm">
                    <div>
                      <p className="text-muted-foreground">Current Value</p>
                      <p className="font-medium">{benchmark.currentValue.toFixed(2)}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Industry Average</p>
                      <p className="font-medium">{benchmark.industryAverage.toFixed(2)}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Percentile</p>
                      <p className="font-medium">{benchmark.percentile}%</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Improvement Needed</p>
                      <p className="font-medium">{benchmark.improvement > 0 ? '+' : ''}{benchmark.improvement.toFixed(2)}</p>
                    </div>
                  </div>
                  <div className="mt-3">
                    <div className="flex justify-between text-xs text-muted-foreground mb-1">
                      <span>0%</span>
                      <span>100%</span>
                    </div>
                    <div className="w-full bg-muted rounded-full h-2">
                      <div 
                        className="h-2 rounded-full transition-all duration-300"
                        style={{ 
                          width: `${benchmark.percentile}%`,
                          backgroundColor: getStatusColor(benchmark.status)
                        }}
                      ></div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* KPI Dashboard Tab */}
      {activeTab === 'kpi-dashboard' && (
        <div className="space-y-6">
          <KPIDashboard />
        </div>
      )}
    </div>
  );
};

export default Analytics; 