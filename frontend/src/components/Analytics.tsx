import React, { useState, useEffect } from 'react';
import { apiService } from '../services/api';
import moment from 'moment';

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

const Analytics: React.FC = () => {
  const [tallyData, setTallyData] = useState<MonthlyTally[]>([]);
  const [fairnessData, setFairnessData] = useState<FairnessReport | null>(null);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [trendsData, setTrendsData] = useState<Array<{month: string, fairness: number, avgWorkload: number}>>([]);
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1); // Current month
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear()); // Current year
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

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

  const maxWorkload = Math.max(...tallyData.map(t => t.totalWorkDays), 1);

  return (
    <div className="space-y-6 bg-background text-foreground p-6">
      {/* Header with date selection */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Analytics Dashboard</h1>
          <div className="text-sm text-muted-foreground">
            Last updated: {lastUpdated.toLocaleTimeString()}
          </div>
        </div>
        <div className="flex space-x-3">
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 text-sm"
          >
            🔄 Refresh
          </button>
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
          <div className="text-muted-foreground">Loading analytics data...</div>
        </div>
      ) : tallyData.length === 0 ? (
        <div className="text-center py-12">
          <div className="text-6xl mb-4">📊</div>
          <h3 className="text-xl font-semibold text-foreground mb-2">No Schedule Data Found</h3>
          <p className="text-muted-foreground mb-4">
            No schedule data found for {selectedMonth}/{selectedYear}. 
            Try selecting a different month or generate some schedules first.
          </p>
          <div className="text-sm text-muted-foreground">
            Try selecting a different month or generate schedules for the current period
          </div>
        </div>
      ) : (
        <>
          {/* 1. Fairness Score */}
          <div className="bg-card text-card-foreground rounded-xl shadow-sm border border-border p-6">
            <h3 className="text-lg font-semibold text-foreground mb-4">Overall Fairness Score</h3>
            {fairnessData ? (
              <div className="flex items-center space-x-4">
                <div className={`text-4xl font-bold ${getFairnessColor(fairnessData.overallFairnessScore)}`}>
                  {(fairnessData.overallFairnessScore * 100).toFixed(1)}%
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">
                    {fairnessData.overallFairnessScore >= 0.8 ? 'Excellent' : 
                     fairnessData.overallFairnessScore >= 0.6 ? 'Good' : 'Needs Improvement'}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Based on workload distribution for {moment().format('MMMM YYYY')}
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center text-muted-foreground">
                <div className="text-2xl font-bold">N/A</div>
                <div className="text-sm">No data available for fairness calculation</div>
              </div>
            )}
          </div>

          {/* 2. Alerts */}
          {alerts.length > 0 && (
            <div className="bg-card text-card-foreground rounded-xl shadow-sm border border-border p-6">
              <h3 className="text-lg font-semibold text-foreground mb-4">⚠️ Upcoming Issues</h3>
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
          <div className="bg-card text-card-foreground rounded-xl shadow-sm border border-border p-6">
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
                  <div className="text-sm text-muted-foreground">
                    {analyst.totalWorkDays} days
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 4. Analyst Performance Summary */}
          <div className="bg-card text-card-foreground rounded-xl shadow-sm border border-border p-6">
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
                      <td className="py-2 text-muted-foreground">{analyst.totalWorkDays}</td>
                      <td className="py-2 text-muted-foreground">{analyst.weekendDays}</td>
                      <td className="py-2 text-muted-foreground">{analyst.screenerDays}</td>
                      <td className="py-2 text-muted-foreground">{analyst.consecutiveWorkDayStreaks}</td>
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
            <div className="bg-card text-card-foreground rounded-xl shadow-sm border border-border p-6">
              <h3 className="text-lg font-semibold text-foreground mb-4">📈 Monthly Trends (Last 6 Months)</h3>
              <div className="space-y-4">
                {trendsData.map((trend, index) => (
                  <div key={index} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                    <div className="font-medium text-foreground">{trend.month}</div>
                    <div className="flex items-center space-x-6">
                      <div className="text-center">
                        <div className={`text-sm font-medium ${getFairnessColor(trend.fairness)}`}>
                          {(trend.fairness * 100).toFixed(0)}%
                        </div>
                        <div className="text-xs text-muted-foreground">Fairness</div>
                      </div>
                      <div className="text-center">
                        <div className="text-sm font-medium text-foreground">{trend.avgWorkload}</div>
                        <div className="text-xs text-muted-foreground">Avg Days</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 6. Recommendations */}
          {fairnessData && fairnessData.recommendations.length > 0 && (
            <div className="bg-card text-card-foreground rounded-xl shadow-sm border border-border p-6">
              <h3 className="text-lg font-semibold text-foreground mb-4">💡 Recommendations</h3>
              <ul className="space-y-2">
                {fairnessData.recommendations.map((recommendation, index) => (
                  <li key={index} className="flex items-start space-x-2">
                    <span className="text-primary mt-1">•</span>
                    <span className="text-muted-foreground">{recommendation}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default Analytics; 