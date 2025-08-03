import React, { useState, useEffect } from 'react';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { apiService, LeaveRequestImpact, Analyst } from '../services/api';

interface LeaveRequestImpactProps {
  onClose?: () => void;
}

const LeaveRequestImpactComponent: React.FC<LeaveRequestImpactProps> = ({ onClose }) => {
  const [analysts, setAnalysts] = useState<Analyst[]>([]);
  const [selectedAnalyst, setSelectedAnalyst] = useState<string>('');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [reason, setReason] = useState<string>('');
  const [impact, setImpact] = useState<LeaveRequestImpact | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    const fetchAnalysts = async () => {
      try {
        const data = await apiService.getAnalysts();
        setAnalysts(data.filter(a => a.isActive));
      } catch (error) {
        console.error('Failed to fetch analysts:', error);
        setError('Failed to load analysts');
      }
    };
    fetchAnalysts();
  }, []);

  const calculateImpact = async () => {
    if (!selectedAnalyst || !startDate || !endDate) {
      setError('Please fill in all required fields');
      return;
    }

    try {
      setLoading(true);
      setError('');
      
      const impactData = await apiService.calculateLeaveRequestImpact({
        analystId: selectedAnalyst,
        startDate,
        endDate,
        reason
      });
      
      setImpact(impactData);
    } catch (error) {
      console.error('Failed to calculate impact:', error);
      setError('Failed to calculate leave request impact');
    } finally {
      setLoading(false);
    }
  };

  const getRiskLevelColor = (riskLevel: string) => {
    switch (riskLevel) {
      case 'HIGH': return '#EF4444';
      case 'MEDIUM': return '#F59E0B';
      case 'LOW': return '#10B981';
      default: return '#6B7280';
    }
  };

  const getRiskLevelBgColor = (riskLevel: string) => {
    switch (riskLevel) {
      case 'HIGH': return '#FEE2E2';
      case 'MEDIUM': return '#FEF3C7';
      case 'LOW': return '#D1FAE5';
      default: return '#F3F4F6';
    }
  };

  const formatPercentage = (value: number) => `${(value * 100).toFixed(1)}%`;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-background rounded-xl shadow-lg max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-foreground">Leave Request Impact Analysis</h2>
            {onClose && (
              <button
                onClick={onClose}
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>

          {/* Form */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Analyst *
              </label>
              <select
                value={selectedAnalyst}
                onChange={(e) => setSelectedAnalyst(e.target.value)}
                className="w-full px-3 py-2 border border-border rounded-lg bg-input focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="">Select an analyst</option>
                {analysts.map((analyst) => (
                  <option key={analyst.id} value={analyst.id}>
                    {analyst.name} ({analyst.shiftType})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Reason
              </label>
              <input
                type="text"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Vacation, sick leave, etc."
                className="w-full px-3 py-2 border border-border rounded-lg bg-input focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Start Date *
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-3 py-2 border border-border rounded-lg bg-input focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                End Date *
              </label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full px-3 py-2 border border-border rounded-lg bg-input focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded-lg">
              {error}
            </div>
          )}

          <div className="flex justify-end mb-6">
            <button
              onClick={calculateImpact}
              disabled={loading}
              className="px-6 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? 'Calculating...' : 'Calculate Impact'}
            </button>
          </div>

          {/* Results */}
          {impact && (
            <div className="space-y-6">
              {/* Impact Summary */}
              <div className="bg-card text-card-foreground rounded-xl shadow-sm border border-border p-6">
                <h3 className="text-lg font-semibold mb-4">Impact Summary</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="text-center">
                    <p className="text-sm text-muted-foreground">Before Leave</p>
                    <p className="text-2xl font-bold">{formatPercentage(impact.fairnessImpact.beforeScore)}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-sm text-muted-foreground">After Leave</p>
                    <p className="text-2xl font-bold">{formatPercentage(impact.fairnessImpact.afterScore)}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-sm text-muted-foreground">Change</p>
                    <p className={`text-2xl font-bold ${impact.fairnessImpact.change > 0 ? 'text-red-600' : 'text-green-600'}`}>
                      {impact.fairnessImpact.change > 0 ? '+' : ''}{formatPercentage(impact.fairnessImpact.change)}
                    </p>
                  </div>
                </div>
                
                <div className="mt-4 p-4 rounded-lg" style={{ backgroundColor: getRiskLevelBgColor(impact.fairnessImpact.riskLevel) }}>
                  <div className="flex items-center space-x-2">
                    <div 
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: getRiskLevelColor(impact.fairnessImpact.riskLevel) }}
                    ></div>
                    <span className="font-medium">Risk Level: {impact.fairnessImpact.riskLevel}</span>
                  </div>
                </div>
              </div>

              {/* Impact Chart */}
              <div className="bg-card text-card-foreground rounded-xl shadow-sm border border-border p-6">
                <h3 className="text-lg font-semibold mb-4">Fairness Impact Visualization</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={[
                    { 
                      period: 'Before Leave', 
                      score: impact.fairnessImpact.beforeScore,
                      fill: '#10B981'
                    },
                    { 
                      period: 'After Leave', 
                      score: impact.fairnessImpact.afterScore,
                      fill: impact.fairnessImpact.change > 0 ? '#EF4444' : '#10B981'
                    }
                  ]}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="period" />
                    <YAxis />
                    <Tooltip formatter={(value) => formatPercentage(value as number)} />
                    <Bar dataKey="score" fill="#3B82F6" />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Recommendations */}
              <div className="bg-card text-card-foreground rounded-xl shadow-sm border border-border p-6">
                <h3 className="text-lg font-semibold mb-4">Recommendations</h3>
                <div className="space-y-3">
                  {impact.recommendations.map((recommendation, index) => (
                    <div key={index} className="flex items-start space-x-3 p-3 bg-muted rounded-lg">
                      <div className="w-2 h-2 bg-blue-500 rounded-full mt-2 flex-shrink-0"></div>
                      <span className="text-sm">{recommendation}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Alternative Dates */}
              {impact.alternativeDates && impact.alternativeDates.length > 0 && (
                <div className="bg-card text-card-foreground rounded-xl shadow-sm border border-border p-6">
                  <h3 className="text-lg font-semibold mb-4">Alternative Dates</h3>
                  <p className="text-sm text-muted-foreground mb-3">
                    Consider these alternative dates for potentially lower impact:
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {impact.alternativeDates.map((date, index) => (
                      <div key={index} className="p-3 bg-muted rounded-lg text-center">
                        <span className="text-sm font-medium">
                          {new Date(date).toLocaleDateString('en-US', { 
                            weekday: 'short', 
                            month: 'short', 
                            day: 'numeric' 
                          })}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default LeaveRequestImpactComponent; 