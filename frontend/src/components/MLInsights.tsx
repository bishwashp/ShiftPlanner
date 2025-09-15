import React, { useState, useEffect } from 'react';
import { apiService } from '../services/api';
import moment from 'moment';

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

const MLInsights: React.FC = () => {
  const [burnoutRisks, setBurnoutRisks] = useState<BurnoutRisk[]>([]);
  const [workloadPredictions, setWorkloadPredictions] = useState<WorkloadPrediction[]>([]);
  const [demandForecast, setDemandForecast] = useState<DemandForecast | null>(null);
  const [conflictPredictions, setConflictPredictions] = useState<ConflictPrediction[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'burnout' | 'workload' | 'demand' | 'conflicts'>('burnout');

  useEffect(() => {
    const fetchMLInsights = async () => {
      try {
        setLoading(true);

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
      } finally {
        setLoading(false);
      }
    };

    fetchMLInsights();
  }, []);

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
      case 'INCREASING': return '📈';
      case 'DECREASING': return '📉';
      default: return '➡️';
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="text-muted-foreground">Loading ML insights...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6 bg-background text-foreground p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">🤖 ML Insights</h1>
        <div className="text-sm text-muted-foreground">
          Powered by simple algorithms • Updated {moment().format('HH:mm')}
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex space-x-1 bg-muted p-1 rounded-lg">
        {[
          { id: 'burnout', label: 'Burnout Risk', icon: '⚠️' },
          { id: 'workload', label: 'Workload', icon: '👥' },
          { id: 'demand', label: 'Demand', icon: '📊' },
          { id: 'conflicts', label: 'Conflicts', icon: '🚨' }
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`flex-1 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              activeTab === tab.id
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      {/* Burnout Risk Tab */}
      {activeTab === 'burnout' && (
        <div className="space-y-4">
          <div className="bg-card text-card-foreground rounded-xl shadow-sm border border-border p-6">
            <h3 className="text-lg font-semibold text-foreground mb-4">Burnout Risk Assessment</h3>
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
                    <div className="text-sm text-muted-foreground mb-2">
                      <strong>Risk Factors:</strong> {risk.factors.join(', ')}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      <strong>Recommendations:</strong> {risk.recommendations.join(', ')}
                    </div>
                  </div>
                ))}
              {burnoutRisks.filter(risk => risk.riskLevel !== 'LOW').length === 0 && (
                <div className="text-center text-muted-foreground py-8">
                  <div className="text-4xl mb-2">✅</div>
                  <div>No high-risk burnout cases detected</div>
                  <div className="text-sm">All analysts have balanced workloads</div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Workload Prediction Tab */}
      {activeTab === 'workload' && (
        <div className="space-y-4">
          <div className="bg-card text-card-foreground rounded-xl shadow-sm border border-border p-6">
            <h3 className="text-lg font-semibold text-foreground mb-4">7-Day Workload Predictions</h3>
            <div className="space-y-3">
              {workloadPredictions.map((prediction, index) => (
                <div key={index} className="flex items-center justify-between p-3 border border-border rounded-lg">
                  <div>
                    <div className="font-medium text-foreground">
                      {moment(prediction.date).format('dddd, MMM D')}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      Confidence: {(prediction.confidence * 100).toFixed(0)}%
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-bold text-primary">
                      {prediction.predictedRequiredStaff}
                    </div>
                    <div className="text-sm text-muted-foreground">analysts needed</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Demand Forecast Tab */}
      {activeTab === 'demand' && demandForecast && (
        <div className="space-y-4">
          <div className="bg-card text-card-foreground rounded-xl shadow-sm border border-border p-6">
            <h3 className="text-lg font-semibold text-foreground mb-4">Demand Forecast</h3>
            <div className="flex items-center justify-between mb-4">
              <div>
                <div className="text-3xl font-bold text-primary">
                  {demandForecast.predictedDemand}
                </div>
                <div className="text-sm text-muted-foreground">predicted demand</div>
              </div>
              <div className="text-right">
                <div className="text-2xl mb-1">{getTrendIcon(demandForecast.trend)}</div>
                <div className="text-sm font-medium text-foreground capitalize">
                  {demandForecast.trend.toLowerCase()}
                </div>
                <div className="text-xs text-muted-foreground">
                  {(demandForecast.confidence * 100).toFixed(0)}% confidence
                </div>
              </div>
            </div>
            <div className="text-sm text-muted-foreground">
              <strong>Factors:</strong> {demandForecast.factors.join(', ')}
            </div>
          </div>
        </div>
      )}

      {/* Conflict Predictions Tab */}
      {activeTab === 'conflicts' && (
        <div className="space-y-4">
          <div className="bg-card text-card-foreground rounded-xl shadow-sm border border-border p-6">
            <h3 className="text-lg font-semibold text-foreground mb-4">Conflict Predictions (Next 7 Days)</h3>
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
                    <div className="text-sm text-muted-foreground mb-2">
                      <strong>{conflict.conflictType}:</strong> {conflict.description}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      <strong>Preventive Actions:</strong> {conflict.preventiveActions.join(', ')}
                    </div>
                  </div>
                ))}
              {conflictPredictions.length === 0 && (
                <div className="text-center text-muted-foreground py-8">
                  <div className="text-4xl mb-2">✅</div>
                  <div>No conflicts predicted for the next 7 days</div>
                  <div className="text-sm">Schedule looks good!</div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MLInsights;
