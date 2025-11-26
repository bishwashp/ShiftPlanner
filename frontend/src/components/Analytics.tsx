import React, { useState, useEffect } from 'react';
import { apiService } from '../services/api';
import moment from 'moment';
import Button from './ui/Button';
import {
  ArrowsClockwise,
  ChartBar,
  Warning,
  TrendUp,
  TrendDown,
  ArrowRight,
  Lightbulb,
  Robot,
  Users,
  Siren,
  CheckCircle,
  Info
} from '@phosphor-icons/react';

interface MonthlyTally {
  analystId: string;
  analystName: string;
  month: number;
  year: number;
  totalWorkDays: number;
  regularShiftDays: number;
  screenerDays: number;
  weekendDays: number;
  consecutiveWorkDayStreaks: number;
  fairnessScore: number;
}

interface FairnessReport {
  overallFairnessScore: number;
  individualScores: Array<{
    analystName: string;
    fairnessScore: number;
    workload: number;
    screenerDays: number;
    weekendDays: number;
  }>;
  recommendations: string[];
}

interface Alert {
  id: string;
  type: string;
  message: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
}

interface BurnoutRisk {
  analystId: string;
  analystName: string;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  riskScore: number;
  factors: string[];
  recommendations: string[];
}

interface WorkloadPrediction {
  date: Date;
  predictedRequiredStaff: number;
  confidence: number;
  factors: string[];
}

interface DemandForecast {
  period: string;
  predictedDemand: number;
  confidence: number;
  trend: 'INCREASING' | 'STABLE' | 'DECREASING';
  factors: string[];
}

interface ConflictPrediction {
  date: Date;
  probability: number;
  conflictType: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  description: string;
  preventiveActions: string[];
}

const Analytics: React.FC = () => {
  const [tallyData, setTallyData] = useState<MonthlyTally[]>([]);
  const [fairnessData, setFairnessData] = useState<FairnessReport | null>(null);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [trendsData, setTrendsData] = useState<Array<{ month: string, fairness: number, avgWorkload: number }>>([]);
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1); // Current month
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear()); // Current year
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

  // ML Insights state
  const [burnoutRisks, setBurnoutRisks] = useState<BurnoutRisk[]>([]);
  const [workloadPredictions, setWorkloadPredictions] = useState<WorkloadPrediction[]>([]);
  const [demandForecast, setDemandForecast] = useState<DemandForecast | null>(null);
  const [conflictPredictions, setConflictPredictions] = useState<ConflictPrediction[]>([]);
  const [activeMLTab, setActiveMLTab] = useState<'burnout' | 'workload' | 'demand' | 'conflicts'>('burnout');

  useEffect(() => {
    const fetchAnalyticsData = async () => {
      try {
        setLoading(true);

        // Fetch current month data
        const currentData = await apiService.getWorkDayTally(selectedMonth, selectedYear);
        setTallyData(currentData);

        // Fetch fairness report for current month
        const startOfMonth = moment().startOf('month').format('YYYY-MM-DD');
        const endOfMonth = moment().endOf('month').format('YYYY-MM-DD');

        try {
          const fairnessReport = await apiService.getFairnessReport(startOfMonth, endOfMonth);
          setFairnessData(fairnessReport);
        } catch (error) {
          console.warn('Could not fetch fairness report, using fallback calculation');
          // Create a fallback fairness report based on current tally data
          if (currentData.length > 0) {
            const fallbackReport = generateFallbackFairnessReport(currentData);
            setFairnessData(fallbackReport);
          }
        }

        // Generate alerts based on data
        const currentFairnessData = fairnessData || generateFallbackFairnessReport(currentData);
        generateAlerts(currentData, currentFairnessData);

        // Generate trends data (last 6 months)
        await generateTrendsData();

        // Fetch ML insights
        await fetchMLInsights();

        // Update last updated timestamp
        setLastUpdated(new Date());

      } catch (error) {
        console.error('Failed to fetch analytics data', error);
      } finally {
        setLoading(false);
      }
    };

    fetchAnalyticsData();

    // Auto-refresh every 5 minutes
    const interval = setInterval(() => {
      fetchAnalyticsData();
    }, 5 * 60 * 1000);

    return () => clearInterval(interval);
  }, [selectedMonth, selectedYear]); // eslint-disable-line react-hooks/exhaustive-deps

  const generateAlerts = (tallyData: MonthlyTally[], fairnessData: FairnessReport | null) => {
    const newAlerts: Alert[] = [];

    // Check for workload imbalances
    const workloads = tallyData.map(t => t.totalWorkDays);
    const avgWorkload = workloads.reduce((a, b) => a + b, 0) / workloads.length;
    const maxWorkload = Math.max(...workloads);
    const minWorkload = Math.min(...workloads);

    if (maxWorkload - minWorkload > avgWorkload * 0.4) {
      newAlerts.push({
        id: 'workload-imbalance',
        type: 'WORKLOAD_IMBALANCE',
        message: `Workload imbalance detected: ${maxWorkload - minWorkload} day difference between highest and lowest`,
        severity: maxWorkload - minWorkload > avgWorkload * 0.6 ? 'HIGH' : 'MEDIUM'
      });
    }

    // Check for consecutive work streaks
    const longStreaks = tallyData.filter(t => t.consecutiveWorkDayStreaks > 5);
    if (longStreaks.length > 0) {
      newAlerts.push({
        id: 'consecutive-streaks',
        type: 'CONSECUTIVE_STREAKS',
        message: `${longStreaks.length} analyst(s) have consecutive work streaks > 5 days`,
        severity: 'MEDIUM'
      });
    }

    // Check fairness score
    if (fairnessData && fairnessData.overallFairnessScore < 0.7) {
      newAlerts.push({
        id: 'low-fairness',
        type: 'FAIRNESS_VIOLATION',
        message: `Low fairness score: ${(fairnessData.overallFairnessScore * 100).toFixed(1)}%`,
        severity: fairnessData.overallFairnessScore < 0.5 ? 'HIGH' : 'MEDIUM'
      });
    }

    setAlerts(newAlerts);
  };

  const generateFallbackFairnessReport = (tallyData: MonthlyTally[]): FairnessReport => {
    if (tallyData.length === 0) {
      return {
        overallFairnessScore: 0,
        individualScores: [],
        recommendations: ['No data available for fairness analysis']
      };
    }

    // Calculate workload distribution fairness
    const workloads = tallyData.map(t => t.totalWorkDays);
    const avgWorkload = workloads.reduce((a, b) => a + b, 0) / workloads.length;
    const maxWorkload = Math.max(...workloads);
    const minWorkload = Math.min(...workloads);

    // Simple fairness score based on workload variance
    const variance = workloads.reduce((sum, w) => sum + Math.pow(w - avgWorkload, 2), 0) / workloads.length;
    const standardDeviation = Math.sqrt(variance);

    // Convert to 0-1 scale (lower variance = higher fairness)
    const workloadFairness = Math.max(0, 1 - (standardDeviation / avgWorkload));

    // Calculate screener distribution fairness
    const screenerCounts = tallyData.map(t => t.screenerDays);
    const avgScreeners = screenerCounts.reduce((a, b) => a + b, 0) / screenerCounts.length;
    const screenerVariance = screenerCounts.reduce((sum, s) => sum + Math.pow(s - avgScreeners, 2), 0) / screenerCounts.length;
    const screenerFairness = avgScreeners > 0 ? Math.max(0, 1 - (Math.sqrt(screenerVariance) / avgScreeners)) : 1;

    // Overall fairness score (weighted average)
    const overallScore = (workloadFairness * 0.7) + (screenerFairness * 0.3);

    // Generate individual scores
    const individualScores = tallyData.map(analyst => ({
      analystName: analyst.analystName,
      fairnessScore: analyst.fairnessScore,
      workload: analyst.totalWorkDays,
      screenerDays: analyst.screenerDays,
      weekendDays: analyst.weekendDays
    }));

    // Generate recommendations
    const recommendations: string[] = [];
    if (overallScore < 0.8) {
      recommendations.push('Consider redistributing workload to improve fairness');
    }
    if (maxWorkload - minWorkload > avgWorkload * 0.3) {
      recommendations.push('Address workload imbalance between analysts');
    }
    if (screenerFairness < 0.7) {
      recommendations.push('Balance screener duties more evenly');
    }
    if (recommendations.length === 0) {
      recommendations.push('Schedule fairness is good - keep current approach');
    }

    return {
      overallFairnessScore: overallScore,
      individualScores,
      recommendations
    };
  };

  const generateTrendsData = async () => {
    const trends = [];

    // Get data for last 6 months from current month
    for (let i = 5; i >= 0; i--) {
      const targetDate = moment().subtract(i, 'months');
      const month = targetDate.month() + 1;
      const year = targetDate.year();

      try {
        const monthlyData = await apiService.getWorkDayTally(month, year);
        if (monthlyData.length > 0) {
          const avgWorkload = monthlyData.reduce((sum, analyst) => sum + analyst.totalWorkDays, 0) / monthlyData.length;

          // Calculate actual fairness score from the data
          const workloads = monthlyData.map(t => t.totalWorkDays);
          const avgWorkloadForFairness = workloads.reduce((a, b) => a + b, 0) / workloads.length;
          const variance = workloads.reduce((sum, w) => sum + Math.pow(w - avgWorkloadForFairness, 2), 0) / workloads.length;
          const standardDeviation = Math.sqrt(variance);
          const fairness = avgWorkloadForFairness > 0 ? Math.max(0, 1 - (standardDeviation / avgWorkloadForFairness)) : 1;

          trends.push({
            month: targetDate.format('MMM YYYY'),
            fairness: fairness,
            avgWorkload: Math.round(avgWorkload)
          });
        }
      } catch (error) {
        console.warn(`Could not fetch data for ${month}/${year}`);
      }
    }

    setTrendsData(trends);
  };

  const fetchMLInsights = async () => {
    try {
      // Fetch all ML insights in parallel
      const [
        burnoutData,
        demandData,
        conflictData
      ] = await Promise.all([
        apiService.getBurnoutRiskAssessment(),
        apiService.getDemandForecast('WEEK'),
        apiService.getConflictPrediction(
          moment().format('YYYY-MM-DD'),
          moment().add(7, 'days').format('YYYY-MM-DD')
        )
      ]);

      setBurnoutRisks(burnoutData);
      setDemandForecast(demandData);
      setConflictPredictions(conflictData);

      // Generate workload predictions for next 7 days
      const predictions = [];
      for (let i = 1; i <= 7; i++) {
        const futureDate = moment().add(i, 'days').format('YYYY-MM-DD');
        try {
          const prediction = await apiService.getWorkloadPrediction(futureDate);
          predictions.push(prediction);
        } catch (error) {
          console.warn(`Could not fetch workload prediction for ${futureDate}`);
        }
      }
      setWorkloadPredictions(predictions);

    } catch (error) {
      console.error('Failed to fetch ML insights', error);
    }
  };

  const getFairnessColor = (score: number) => {
    if (score >= 0.8) return 'text-green-600';
    if (score >= 0.6) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getAlertColor = (severity: string) => {
    switch (severity) {
      case 'CRITICAL': return 'bg-red-100 border-red-500 text-red-700';
      case 'HIGH': return 'bg-orange-100 border-orange-500 text-orange-700';
      case 'MEDIUM': return 'bg-yellow-100 border-yellow-500 text-yellow-700';
      default: return 'bg-blue-100 border-blue-500 text-blue-700';
    }
  };

  const getRiskColor = (riskLevel: string) => {
    switch (riskLevel) {
      case 'CRITICAL': return 'text-red-600 bg-red-100';
      case 'HIGH': return 'text-orange-600 bg-orange-100';
      case 'MEDIUM': return 'text-yellow-600 bg-yellow-100';
      default: return 'text-green-600 bg-green-100';
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'CRITICAL': return 'border-red-500 bg-red-50';
      case 'HIGH': return 'border-orange-500 bg-orange-50';
      case 'MEDIUM': return 'border-yellow-500 bg-yellow-50';
      default: return 'border-blue-500 bg-blue-50';
    }
  };

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'INCREASING': return <TrendUp className="h-6 w-6" />;
      case 'DECREASING': return <TrendDown className="h-6 w-6" />;
      default: return <ArrowRight className="h-6 w-6" />;
    }
  };

  const maxWorkload = Math.max(...tallyData.map(t => t.totalWorkDays), 1);

  const cardClass = "bg-white/90 dark:bg-gray-900/90 backdrop-blur-xl border border-gray-200 dark:border-gray-700 rounded-xl shadow-sm p-6";

  return (
    <div className="space-y-6 text-foreground p-6 relative z-10">
      {/* Header with date selection */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Analytics Dashboard</h1>
          <div className="text-sm text-gray-700 dark:text-gray-200">
            Last updated: {lastUpdated.toLocaleTimeString()}
          </div>
        </div>
        <div className="flex space-x-3">
          <Button
            onClick={() => window.location.reload()}
            variant="primary"
            size="sm"
            icon={ArrowsClockwise}
          >
            Refresh
          </Button>
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
            {Array.from({ length: 6 }, (_, i) => (
              <option key={2025 - i} value={2025 - i}>
                {2025 - i}
              </option>
            ))}
          </select>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center items-center h-64">
          <div className="text-gray-700 dark:text-gray-200">Loading analytics data...</div>
        </div>
      ) : tallyData.length === 0 ? (
        <div className="text-center py-12">
          <ChartBar className="h-16 w-16 mx-auto mb-4 text-gray-400" />
          <h3 className="text-xl font-semibold text-foreground mb-2">No Schedule Data Found</h3>
          <p className="text-gray-700 dark:text-gray-200 mb-4">
            No schedule data found for {selectedMonth}/{selectedYear}.
            Try selecting a different month or generate some schedules first.
          </p>
          <div className="text-sm text-gray-700 dark:text-gray-200">
            Try selecting a different month or generate schedules for the current period
          </div>
        </div>
      ) : (
        <>
          {/* 1. Fairness Score */}
          <div className={cardClass}>
            <h3 className="text-lg font-semibold text-foreground mb-4">Overall Fairness Score</h3>
            {fairnessData ? (
              <div className="flex items-center space-x-4">
                <div className={`text-4xl font-bold ${getFairnessColor(fairnessData.overallFairnessScore)}`}>
                  {(fairnessData.overallFairnessScore * 100).toFixed(1)}%
                </div>
                <div>
                  <div className="text-sm text-gray-700 dark:text-gray-200">
                    {fairnessData.overallFairnessScore >= 0.8 ? 'Excellent' :
                      fairnessData.overallFairnessScore >= 0.6 ? 'Good' : 'Needs Improvement'}
                  </div>
                  <div className="text-xs text-gray-700 dark:text-gray-200">
                    Based on workload distribution for {moment().format('MMMM YYYY')}
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center text-gray-700 dark:text-gray-200">
                <div className="text-2xl font-bold">N/A</div>
                <div className="text-sm">No data available for fairness calculation</div>
              </div>
            )}
          </div>

          {/* 2. Alerts */}
          {alerts.length > 0 && (
            <div className={cardClass}>
              <h3 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
                <Warning className="h-5 w-5 text-yellow-500" />
                Upcoming Issues
              </h3>
              <div className="space-y-3">
                {alerts.map((alert) => (
                  <div key={alert.id} className={`p-3 rounded-lg border-l-4 ${getAlertColor(alert.severity)}`}>
                    <div className="font-medium">{alert.message}</div>
                    <div className="text-sm opacity-75 capitalize">{alert.type.replace('_', ' ').toLowerCase()}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 3. Workload Balance Dashboard */}
          <div className={cardClass}>
            <h3 className="text-lg font-semibold text-foreground mb-4">Workload Balance</h3>
            <div className="space-y-4">
              {tallyData.map((analyst) => (
                <div key={analyst.analystId} className="flex items-center space-x-4">
                  <div className="w-32 text-sm font-medium text-foreground truncate">
                    {analyst.analystName}
                  </div>
                  <div className="flex-1 bg-muted rounded-full h-6 relative">
                    <div
                      className="bg-primary h-6 rounded-full flex items-center justify-end pr-2"
                      style={{ width: `${(analyst.totalWorkDays / maxWorkload) * 100}%` }}
                    >
                      <span className="text-primary-foreground text-xs font-medium">
                        {analyst.totalWorkDays}
                      </span>
                    </div>
                  </div>
                  <div className="text-sm text-gray-700 dark:text-gray-200">
                    {analyst.totalWorkDays} days
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 4. Analyst Performance Summary */}
          <div className={cardClass}>
            <h3 className="text-lg font-semibold text-foreground mb-4">Analyst Performance Summary</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-2 font-medium text-foreground">Analyst</th>
                    <th className="text-left py-2 font-medium text-foreground">Total Days</th>
                    <th className="text-left py-2 font-medium text-foreground">Weekend Days</th>
                    <th className="text-left py-2 font-medium text-foreground">Screener Days</th>
                    <th className="text-left py-2 font-medium text-foreground">Max Streak</th>
                    <th className="text-left py-2 font-medium text-foreground">Fairness Score</th>
                  </tr>
                </thead>
                <tbody>
                  {tallyData.map((analyst) => (
                    <tr key={analyst.analystId} className="border-b border-border">
                      <td className="py-2 font-medium text-foreground">{analyst.analystName}</td>
                      <td className="py-2 text-gray-700 dark:text-gray-200">{analyst.totalWorkDays}</td>
                      <td className="py-2 text-gray-700 dark:text-gray-200">{analyst.weekendDays}</td>
                      <td className="py-2 text-gray-700 dark:text-gray-200">{analyst.screenerDays}</td>
                      <td className="py-2 text-gray-700 dark:text-gray-200">{analyst.consecutiveWorkDayStreaks}</td>
                      <td className={`py-2 font-medium ${getFairnessColor(analyst.fairnessScore)}`}>
                        {(analyst.fairnessScore * 100).toFixed(0)}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* 5. Monthly Trends */}
          {trendsData.length > 0 && (
            <div className={cardClass}>
              <h3 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
                <TrendUp className="h-5 w-5 text-blue-500" />
                Monthly Trends (Last 6 Months)
              </h3>
              <div className="space-y-4">
                {trendsData.map((trend, index) => (
                  <div key={index} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                    <div className="font-medium text-foreground">{trend.month}</div>
                    <div className="flex items-center space-x-6">
                      <div className="text-center">
                        <div className={`text-sm font-medium ${getFairnessColor(trend.fairness)}`}>
                          {(trend.fairness * 100).toFixed(0)}%
                        </div>
                        <div className="text-xs text-gray-700 dark:text-gray-200">Fairness</div>
                      </div>
                      <div className="text-center">
                        <div className="text-sm font-medium text-foreground">{trend.avgWorkload}</div>
                        <div className="text-xs text-gray-700 dark:text-gray-200">Avg Days</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 6. Recommendations */}
          {fairnessData && fairnessData.recommendations.length > 0 && (
            <div className={cardClass}>
              <h3 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
                <Lightbulb className="h-5 w-5 text-yellow-500" />
                Recommendations
              </h3>
              <ul className="space-y-2">
                {fairnessData.recommendations.map((recommendation, index) => (
                  <li key={index} className="flex items-start space-x-2">
                    <span className="text-primary mt-1">•</span>
                    <span className="text-gray-700 dark:text-gray-200">{recommendation}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* 7. ML Insights */}
          <div className={cardClass}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
                <Robot className="h-5 w-5 text-purple-500" />
                ML Insights
              </h3>
              <div className="text-sm text-gray-700 dark:text-gray-200">
                Powered by simple algorithms
              </div>
            </div>

            {/* ML Tab Navigation */}
            <div className="flex space-x-1 bg-muted p-1 rounded-lg mb-6">
              {[
                { id: 'burnout', label: 'Burnout Risk', icon: <Warning className="h-4 w-4" /> },
                { id: 'workload', label: 'Workload', icon: <Users className="h-4 w-4" /> },
                { id: 'demand', label: 'Demand', icon: <ChartBar className="h-4 w-4" /> },
                { id: 'conflicts', label: 'Conflicts', icon: <Siren className="h-4 w-4" /> }
              ].map((tab) => (
                <Button
                  key={tab.id}
                  onClick={() => setActiveMLTab(tab.id as any)}
                  variant={activeMLTab === tab.id ? 'primary' : 'ghost'}
                  size="sm"
                  className="flex-1 flex items-center justify-center gap-2"
                >
                  {tab.icon} {tab.label}
                </Button>
              ))}
            </div>

            {/* Burnout Risk Tab */}
            {activeMLTab === 'burnout' && (
              <div className="space-y-3">
                {burnoutRisks
                  .filter(risk => risk.riskLevel !== 'LOW')
                  .sort((a, b) => b.riskScore - a.riskScore)
                  .map((risk) => (
                    <div key={risk.analystId} className="p-4 border border-border rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <div className="font-medium text-foreground">{risk.analystName}</div>
                        <div className={`px-2 py-1 rounded-full text-xs font-medium ${getRiskColor(risk.riskLevel)}`}>
                          {risk.riskLevel} ({risk.riskScore}%)
                        </div>
                      </div>
                      <div className="text-sm text-gray-700 dark:text-gray-200 mb-2">
                        <strong>Risk Factors:</strong> {risk.factors.join(', ')}
                      </div>
                      <div className="text-sm text-gray-700 dark:text-gray-200">
                        <strong>Recommendations:</strong> {risk.recommendations.join(', ')}
                      </div>
                    </div>
                  ))}
                {burnoutRisks.filter(risk => risk.riskLevel !== 'LOW').length === 0 && (
                  <div className="text-center text-gray-700 dark:text-gray-200 py-8">
                    <CheckCircle className="h-12 w-12 mx-auto mb-2 text-green-500" />
                    <div>No high-risk burnout cases detected</div>
                    <div className="text-sm">All analysts have balanced workloads</div>
                  </div>
                )}
              </div>
            )}

            {/* Workload Prediction Tab */}
            {activeMLTab === 'workload' && (
              <div className="space-y-3">
                {workloadPredictions.map((prediction, index) => (
                  <div key={index} className="flex items-center justify-between p-3 border border-border rounded-lg">
                    <div>
                      <div className="font-medium text-foreground">
                        {moment(prediction.date).format('dddd, MMM D')}
                      </div>
                      <div className="text-sm text-gray-700 dark:text-gray-200">
                        Confidence: {(prediction.confidence * 100).toFixed(0)}%
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-bold text-primary">
                        {prediction.predictedRequiredStaff}
                      </div>
                      <div className="text-sm text-gray-700 dark:text-gray-200">analysts needed</div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Demand Forecast Tab */}
            {activeMLTab === 'demand' && demandForecast && (
              <div className="flex items-center justify-between mb-4">
                <div>
                  <div className="text-3xl font-bold text-primary">
                    {demandForecast.predictedDemand}
                  </div>
                  <div className="text-sm text-gray-700 dark:text-gray-200">predicted demand</div>
                </div>
                <div className="text-right">
                  <div className="text-2xl mb-1 flex justify-end">{getTrendIcon(demandForecast.trend)}</div>
                  <div className="text-sm font-medium text-foreground capitalize">
                    {demandForecast.trend.toLowerCase()}
                  </div>
                  <div className="text-xs text-gray-700 dark:text-gray-200">
                    {(demandForecast.confidence * 100).toFixed(0)}% confidence
                  </div>
                </div>
              </div>
            )}

            {/* Conflict Predictions Tab */}
            {activeMLTab === 'conflicts' && (
              <div className="space-y-3">
                {conflictPredictions
                  .sort((a, b) => b.probability - a.probability)
                  .map((conflict, index) => (
                    <div key={index} className={`p-4 border-l-4 rounded-lg ${getSeverityColor(conflict.severity)}`}>
                      <div className="flex items-center justify-between mb-2">
                        <div className="font-medium text-foreground">
                          {moment(conflict.date).format('MMM D, YYYY')}
                        </div>
                        <div className="text-sm font-medium">
                          {(conflict.probability * 100).toFixed(0)}% probability
                        </div>
                      </div>
                      <div className="text-sm text-gray-700 dark:text-gray-200 mb-2">
                        <strong>{conflict.conflictType}:</strong> {conflict.description}
                      </div>
                      <div className="text-sm text-gray-700 dark:text-gray-200">
                        <strong>Preventive Actions:</strong> {conflict.preventiveActions.join(', ')}
                      </div>
                    </div>
                  ))}
                {conflictPredictions.length === 0 && (
                  <div className="text-center text-gray-700 dark:text-gray-200 py-8">
                    <CheckCircle className="h-12 w-12 mx-auto mb-2 text-green-500" />
                    <div>No conflicts predicted for the next 7 days</div>
                    <div className="text-sm">Schedule looks good!</div>
                  </div>
                )}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default Analytics; 