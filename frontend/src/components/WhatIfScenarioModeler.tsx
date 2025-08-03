import React, { useState } from 'react';
import moment from 'moment-timezone';
import apiService, { SchedulingConstraint } from '../services/api';

interface ScenarioChange {
  id: string;
  type: 'CREATE' | 'UPDATE' | 'DELETE';
  constraint: Partial<SchedulingConstraint>;
  originalConstraint?: SchedulingConstraint;
  description: string;
}

interface ScenarioAnalysis {
  scenario: {
    id: string;
    name: string;
    description: string;
  };
  impact: {
    affectedDates: string[];
    affectedAnalysts: string[];
    scheduleChanges: {
      conflicts: Array<{
        date: string;
        message: string;
        severity: 'HIGH' | 'MEDIUM' | 'LOW';
      }>;
    };
    fairnessImpact: {
      before: number;
      after: number;
      change: number;
    };
    coverageImpact: {
      gapsIntroduced: number;
      gapsResolved: number;
      netCoverageChange: number;
    };
  };
  comparison: {
    baseline: {
      conflictCount: number;
      fairnessScore: number;
      coverageGaps: number;
    };
    projected: {
      conflictCount: number;
      fairnessScore: number;
      coverageGaps: number;
    };
    improvements: {
      conflictReduction: number;
      fairnessImprovement: number;
      coverageImprovement: number;
    };
    netBenefit: number;
  };
  recommendations: string[];
  riskAssessment: {
    overallRisk: 'LOW' | 'MEDIUM' | 'HIGH';
    riskFactors: string[];
    mitigationStrategies: string[];
  };
}

const WhatIfScenarioModeler: React.FC = () => {
  const [scenarioName, setScenarioName] = useState('');
  const [scenarioDescription, setScenarioDescription] = useState('');
  const [dateRange, setDateRange] = useState({
    startDate: moment().format('YYYY-MM-DD'),
    endDate: moment().add(30, 'days').format('YYYY-MM-DD')
  });
  const [changes, setChanges] = useState<ScenarioChange[]>([]);
  const [analysis, setAnalysis] = useState<ScenarioAnalysis | null>(null);
  const [scenarios, setScenarios] = useState<{ analysis: ScenarioAnalysis; changes: ScenarioChange[] }[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'builder' | 'compare' | 'incremental'>('builder');

  const addChange = () => {
    const newChange: ScenarioChange = {
      id: `change_${Date.now()}`,
      type: 'CREATE',
      constraint: {
        constraintType: 'BLACKOUT_DATE',
        startDate: moment().format('YYYY-MM-DD'),
        endDate: moment().add(1, 'day').format('YYYY-MM-DD'),
        isActive: true
      },
      description: 'New constraint'
    };
    setChanges([...changes, newChange]);
  };

  const updateChange = (id: string, updates: Partial<ScenarioChange>) => {
    setChanges(changes.map(change => 
      change.id === id ? { ...change, ...updates } : change
    ));
  };

  const removeChange = (id: string) => {
    setChanges(changes.filter(change => change.id !== id));
  };

  const analyzeScenario = async () => {
    if (!scenarioName || changes.length === 0) {
      setError('Please provide a scenario name and at least one change');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch('http://localhost:4000/api/constraints/scenario/analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: scenarioName,
          description: scenarioDescription,
          changes: changes.map(change => ({
            type: change.type,
            constraint: change.constraint,
            originalConstraint: change.originalConstraint
          })),
          dateRange: {
            startDate: dateRange.startDate,
            endDate: dateRange.endDate
          },
          includeReschedule: false,
          includePredictions: true
        })
      });

      if (!response.ok) {
        throw new Error('Failed to analyze scenario');
      }

      const analysisResult = await response.json();
      setAnalysis(analysisResult);
    } catch (err: any) {
      setError(err.message || 'Failed to analyze scenario');
    } finally {
      setLoading(false);
    }
  };

  const saveScenario = () => {
    if (analysis) {
      setScenarios([...scenarios, { analysis, changes: [...changes] }]);
      setScenarioName('');
      setScenarioDescription('');
      setChanges([]);
      setAnalysis(null);
    }
  };

  const compareScenarios = async () => {
    if (scenarios.length < 2) {
      setError('Need at least 2 scenarios to compare');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const scenarioRequests = scenarios.map(s => ({
        name: s.analysis.scenario.name,
        description: s.analysis.scenario.description,
        changes: s.changes.map(change => ({
          type: change.type,
          constraint: change.constraint,
          originalConstraint: change.originalConstraint
        })),
        dateRange: {
          startDate: dateRange.startDate,
          endDate: dateRange.endDate
        }
      }));

      const response = await fetch('http://localhost:4000/api/constraints/scenario/compare', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ scenarios: scenarioRequests })
      });

      if (!response.ok) {
        throw new Error('Failed to compare scenarios');
      }

      const comparison = await response.json();
      console.log('Scenario comparison:', comparison);
      // Handle comparison results
    } catch (err: any) {
      setError(err.message || 'Failed to compare scenarios');
    } finally {
      setLoading(false);
    }
  };

  const renderConstraintForm = (change: ScenarioChange, index: number) => (
    <div key={change.id} className="p-4 border border-border rounded-lg bg-card">
      <div className="flex justify-between items-start mb-3">
        <h4 className="font-medium text-foreground">Change #{index + 1}</h4>
        <button
          onClick={() => removeChange(change.id)}
          className="text-destructive hover:text-destructive/80"
        >
          Remove
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-muted-foreground mb-2">Action</label>
          <select
            value={change.type}
            onChange={(e) => updateChange(change.id, { type: e.target.value as any })}
            className="w-full input bg-input border-border text-foreground"
          >
            <option value="CREATE">Create</option>
            <option value="UPDATE">Update</option>
            <option value="DELETE">Delete</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-muted-foreground mb-2">Constraint Type</label>
          <select
            value={change.constraint.constraintType || 'BLACKOUT_DATE'}
            onChange={(e) => updateChange(change.id, {
              constraint: { ...change.constraint, constraintType: e.target.value as any }
            })}
            className="w-full input bg-input border-border text-foreground"
          >
            <option value="BLACKOUT_DATE">Blackout Date</option>
            <option value="MAX_SCREENER_DAYS">Max Screener Days</option>
            <option value="MIN_SCREENER_DAYS">Min Screener Days</option>
            <option value="PREFERRED_SCREENER">Preferred Screener</option>
            <option value="UNAVAILABLE_SCREENER">Unavailable Screener</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-muted-foreground mb-2">Start Date</label>
          <input
            type="date"
            value={change.constraint.startDate || ''}
            onChange={(e) => updateChange(change.id, {
              constraint: { ...change.constraint, startDate: e.target.value }
            })}
            className="w-full input bg-input border-border text-foreground"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-muted-foreground mb-2">End Date</label>
          <input
            type="date"
            value={change.constraint.endDate || ''}
            onChange={(e) => updateChange(change.id, {
              constraint: { ...change.constraint, endDate: e.target.value }
            })}
            className="w-full input bg-input border-border text-foreground"
          />
        </div>

        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-muted-foreground mb-2">Description</label>
          <input
            type="text"
            value={change.description}
            onChange={(e) => updateChange(change.id, { description: e.target.value })}
            className="w-full input bg-input border-border text-foreground"
            placeholder="Describe this change..."
          />
        </div>
      </div>
    </div>
  );

  const renderAnalysisResults = () => {
    if (!analysis) return null;

    const getRiskColor = (risk: string) => {
      switch (risk) {
        case 'HIGH': return 'text-red-600 bg-red-50';
        case 'MEDIUM': return 'text-yellow-600 bg-yellow-50';
        case 'LOW': return 'text-green-600 bg-green-50';
        default: return 'text-gray-600 bg-gray-50';
      }
    };

    const getBenefitColor = (benefit: number) => {
      if (benefit > 0.3) return 'text-green-600 bg-green-50';
      if (benefit > 0.1) return 'text-yellow-600 bg-yellow-50';
      if (benefit < -0.1) return 'text-red-600 bg-red-50';
      return 'text-gray-600 bg-gray-50';
    };

    return (
      <div className="space-y-6">
        {/* Summary */}
        <div className="bg-card rounded-lg p-6 border">
          <h3 className="text-xl font-semibold text-foreground mb-4">{analysis.scenario.name}</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className={`p-4 rounded-lg ${getRiskColor(analysis.riskAssessment.overallRisk)}`}>
              <div className="font-medium">Risk Level</div>
              <div className="text-2xl font-bold">{analysis.riskAssessment.overallRisk}</div>
            </div>

            <div className={`p-4 rounded-lg ${getBenefitColor(analysis.comparison.netBenefit)}`}>
              <div className="font-medium">Net Benefit</div>
              <div className="text-2xl font-bold">{(analysis.comparison.netBenefit * 100).toFixed(1)}%</div>
            </div>

            <div className="p-4 rounded-lg bg-blue-50 text-blue-600">
              <div className="font-medium">Affected Days</div>
              <div className="text-2xl font-bold">{analysis.impact.affectedDates.length}</div>
            </div>
          </div>

          {/* Impact Details */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h4 className="font-semibold text-foreground mb-3">Impact Comparison</h4>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span>Conflicts:</span>
                  <span className={analysis.comparison.improvements.conflictReduction >= 0 ? 'text-green-600' : 'text-red-600'}>
                    {analysis.comparison.baseline.conflictCount} → {analysis.comparison.projected.conflictCount}
                    ({analysis.comparison.improvements.conflictReduction >= 0 ? '-' : '+'}{Math.abs(analysis.comparison.improvements.conflictReduction)})
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Fairness:</span>
                  <span className={analysis.comparison.improvements.fairnessImprovement >= 0 ? 'text-green-600' : 'text-red-600'}>
                    {(analysis.comparison.baseline.fairnessScore * 100).toFixed(1)}% → {(analysis.comparison.projected.fairnessScore * 100).toFixed(1)}%
                    ({analysis.comparison.improvements.fairnessImprovement >= 0 ? '+' : ''}{(analysis.comparison.improvements.fairnessImprovement * 100).toFixed(1)}%)
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Coverage Gaps:</span>
                  <span className={analysis.comparison.improvements.coverageImprovement >= 0 ? 'text-green-600' : 'text-red-600'}>
                    {analysis.comparison.baseline.coverageGaps} → {analysis.comparison.projected.coverageGaps}
                    ({analysis.comparison.improvements.coverageImprovement >= 0 ? '-' : '+'}{Math.abs(analysis.comparison.improvements.coverageImprovement)})
                  </span>
                </div>
              </div>
            </div>

            <div>
              <h4 className="font-semibold text-foreground mb-3">Recommendations</h4>
              <div className="space-y-2">
                {analysis.recommendations.map((rec, index) => (
                  <div key={index} className="text-sm p-2 bg-muted rounded">
                    {rec}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Risk Factors */}
          {analysis.riskAssessment.riskFactors.length > 0 && (
            <div className="mt-6">
              <h4 className="font-semibold text-foreground mb-3">Risk Factors</h4>
              <div className="space-y-2">
                {analysis.riskAssessment.riskFactors.map((factor, index) => (
                  <div key={index} className="text-sm p-2 bg-yellow-50 text-yellow-800 rounded">
                    ⚠️ {factor}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Mitigation Strategies */}
          {analysis.riskAssessment.mitigationStrategies.length > 0 && (
            <div className="mt-6">
              <h4 className="font-semibold text-foreground mb-3">Mitigation Strategies</h4>
              <div className="space-y-2">
                {analysis.riskAssessment.mitigationStrategies.map((strategy, index) => (
                  <div key={index} className="text-sm p-2 bg-blue-50 text-blue-800 rounded">
                    💡 {strategy}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex space-x-4">
          <button
            onClick={saveScenario}
            className="px-6 py-2 bg-primary text-primary-foreground rounded hover:bg-primary/90"
          >
            Save Scenario
          </button>
          <button
            onClick={() => setAnalysis(null)}
            className="px-6 py-2 bg-muted text-muted-foreground rounded hover:bg-muted/80"
          >
            Create New Scenario
          </button>
        </div>
      </div>
    );
  };

  const renderScenarioBuilder = () => (
    <div className="space-y-6">
      {/* Scenario Details */}
      <div className="bg-card rounded-lg p-6 border">
        <h3 className="text-lg font-semibold text-foreground mb-4">Scenario Details</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <div>
            <label className="block text-sm font-medium text-muted-foreground mb-2">Scenario Name</label>
            <input
              type="text"
              value={scenarioName}
              onChange={(e) => setScenarioName(e.target.value)}
              className="w-full input bg-input border-border text-foreground"
              placeholder="e.g., Holiday Coverage Plan"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-muted-foreground mb-2">Description</label>
            <input
              type="text"
              value={scenarioDescription}
              onChange={(e) => setScenarioDescription(e.target.value)}
              className="w-full input bg-input border-border text-foreground"
              placeholder="Brief description of this scenario"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-muted-foreground mb-2">Start Date</label>
            <input
              type="date"
              value={dateRange.startDate}
              onChange={(e) => setDateRange({ ...dateRange, startDate: e.target.value })}
              className="w-full input bg-input border-border text-foreground"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-muted-foreground mb-2">End Date</label>
            <input
              type="date"
              value={dateRange.endDate}
              onChange={(e) => setDateRange({ ...dateRange, endDate: e.target.value })}
              className="w-full input bg-input border-border text-foreground"
            />
          </div>
        </div>
      </div>

      {/* Changes */}
      <div className="bg-card rounded-lg p-6 border">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold text-foreground">Constraint Changes</h3>
          <button
            onClick={addChange}
            className="px-4 py-2 bg-primary text-primary-foreground rounded hover:bg-primary/90"
          >
            Add Change
          </button>
        </div>

        <div className="space-y-4">
          {changes.map((change, index) => renderConstraintForm(change, index))}
          
          {changes.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              No changes added yet. Click "Add Change" to start building your scenario.
            </div>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex justify-end space-x-4">
        <button
          onClick={analyzeScenario}
          disabled={loading || !scenarioName || changes.length === 0}
          className="px-6 py-2 bg-primary text-primary-foreground rounded hover:bg-primary/90 disabled:opacity-50"
        >
          {loading ? 'Analyzing...' : 'Analyze Scenario'}
        </button>
      </div>
    </div>
  );

  return (
    <div className="bg-background text-foreground p-6">
      <div className="max-w-6xl mx-auto">
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-foreground mb-2">What-If Scenario Modeler</h2>
          <p className="text-muted-foreground">
            Test different constraint combinations and see their impact before implementing changes.
          </p>
        </div>

        {/* Tab Navigation */}
        <div className="flex space-x-2 mb-6">
          {[
            { key: 'builder', label: 'Scenario Builder' },
            { key: 'compare', label: `Compare Scenarios (${scenarios.length})` },
            { key: 'incremental', label: 'Incremental Testing' }
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as any)}
              className={`px-4 py-2 rounded font-medium transition-colors ${
                activeTab === tab.key
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Error Display */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-800">
            {error}
          </div>
        )}

        {/* Tab Content */}
        {activeTab === 'builder' && (
          <div className="space-y-6">
            {analysis ? renderAnalysisResults() : renderScenarioBuilder()}
          </div>
        )}

        {activeTab === 'compare' && (
          <div className="space-y-6">
            <div className="bg-card rounded-lg p-6 border">
              <h3 className="text-lg font-semibold text-foreground mb-4">
                Scenario Comparison ({scenarios.length} scenarios)
              </h3>
              
              {scenarios.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  No scenarios saved yet. Create and save scenarios in the builder to compare them.
                </div>
              )}

              {scenarios.length > 0 && (
                <div className="space-y-4">
                  {scenarios.map((scenario, index) => (
                    <div key={index} className="p-4 border border-border rounded-lg">
                      <h4 className="font-medium text-foreground">{scenario.analysis.scenario.name}</h4>
                      <p className="text-sm text-muted-foreground">{scenario.analysis.scenario.description}</p>
                      <div className="mt-2 text-sm">
                        <span className={`px-2 py-1 rounded ${
                          scenario.analysis.comparison.netBenefit > 0 ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                        }`}>
                          {(scenario.analysis.comparison.netBenefit * 100).toFixed(1)}% net benefit
                        </span>
                        <span className="ml-2 text-muted-foreground">
                          {scenario.changes.length} changes
                        </span>
                      </div>
                    </div>
                  ))}

                  {scenarios.length >= 2 && (
                    <button
                      onClick={compareScenarios}
                      disabled={loading}
                      className="w-full py-2 bg-primary text-primary-foreground rounded hover:bg-primary/90 disabled:opacity-50"
                    >
                      {loading ? 'Comparing...' : 'Compare All Scenarios'}
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'incremental' && (
          <div className="bg-card rounded-lg p-6 border">
            <h3 className="text-lg font-semibold text-foreground mb-4">Incremental Testing</h3>
            <p className="text-muted-foreground mb-6">
              Test changes one by one to see the incremental impact and find the optimal stopping point.
            </p>
            <div className="text-center py-8 text-muted-foreground">
              Feature coming soon - will allow step-by-step constraint testing.
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default WhatIfScenarioModeler;