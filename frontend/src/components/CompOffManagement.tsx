import React, { useState, useEffect } from 'react';
import apiService from '../services/api';

interface CompOffTransaction {
  id: string;
  analystId: string;
  type: 'EARNED' | 'USED' | 'AUTO_ASSIGNED';
  earnedDate?: string;
  compOffDate?: string;
  reason: 'WEEKEND_WORK' | 'HOLIDAY_WORK' | 'OVERTIME' | 'MANUAL_REQUEST';
  days: number;
  isAutoAssigned: boolean;
  isBanked: boolean;
  description: string;
  createdAt: string;
}

interface CompOffBalance {
  analystId: string;
  availableBalance: number;
  totalEarned: number;
  totalUsed: number;
  recentTransactions: CompOffTransaction[];
}

interface WeeklyWorkload {
  id: string;
  analystId: string;
  weekStart: string;
  weekEnd: string;
  scheduledWorkDays: number;
  weekendWorkDays: number;
  holidayWorkDays: number;
  overtimeDays: number;
  autoCompOffDays: number;
  bankedCompOffDays: number;
  totalWorkDays: number;
  isBalanced: boolean;
}

interface RotationState {
  id: string;
  algorithmType: string;
  shiftType: 'MORNING' | 'EVENING';
  currentSunThuAnalyst?: string;
  currentTueSatAnalyst?: string;
  completedAnalysts: string[];
  inProgressAnalysts: string[];
  lastUpdated: string;
}

interface Analyst {
  id: string;
  name: string;
  email: string;
  shiftType: string;
}

const CompOffManagement: React.FC = () => {
  const [analysts, setAnalysts] = useState<Analyst[]>([]);
  const [selectedAnalyst, setSelectedAnalyst] = useState<string>('');
  const [compOffBalance, setCompOffBalance] = useState<CompOffBalance | null>(null);
  const [compOffTransactions, setCompOffTransactions] = useState<CompOffTransaction[]>([]);
  const [weeklyWorkloads, setWeeklyWorkloads] = useState<WeeklyWorkload[]>([]);
  const [rotationStates, setRotationStates] = useState<RotationState[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'balance' | 'transactions' | 'workload' | 'rotation'>('balance');

  // Load analysts on component mount
  useEffect(() => {
    loadAnalysts();
  }, []);

  // Load comp-off data when analyst is selected
  useEffect(() => {
    if (selectedAnalyst) {
      loadCompOffData();
    }
  }, [selectedAnalyst]);

  const loadAnalysts = async () => {
    try {
      setLoading(true);
      const data = await apiService.getAnalysts();
      setAnalysts(data.filter(analyst => analyst.isActive));
      if (data.length > 0) {
        setSelectedAnalyst(data[0].id);
      }
    } catch (err) {
      setError('Failed to load analysts');
      console.error('Error loading analysts:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadCompOffData = async () => {
    if (!selectedAnalyst) return;

    try {
      setLoading(true);
      setError(null);

      // Load comp-off balance
      const balanceData = await apiService.getCompOffBalance(selectedAnalyst);
      if (balanceData) {
        setCompOffBalance(balanceData);
        setCompOffTransactions(balanceData.recentTransactions || []);
      } else {
        setCompOffBalance(null);
        setCompOffTransactions([]);
        console.warn('No comp-off balance data returned');
      }

      try {
        // Load weekly workloads
        const workloadData = await apiService.getWeeklyWorkloads(selectedAnalyst);
        setWeeklyWorkloads(workloadData || []);
      } catch (workloadErr) {
        console.error('Error loading weekly workloads:', workloadErr);
        setWeeklyWorkloads([]);
      }

      try {
        // Load rotation states
        const rotationData = await apiService.getRotationStates();
        setRotationStates(rotationData || []);
      } catch (rotationErr) {
        console.error('Error loading rotation states:', rotationErr);
        setRotationStates([]);
      }

    } catch (err) {
      setError('Failed to load comp-off data');
      console.error('Error loading comp-off data:', err);
      setCompOffBalance(null);
      setCompOffTransactions([]);
      setWeeklyWorkloads([]);
      setRotationStates([]);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const getTransactionTypeColor = (type: string) => {
    switch (type) {
      case 'EARNED': return 'text-green-600 bg-green-100 dark:text-green-300 dark:bg-green-900/30';
      case 'USED': return 'text-red-600 bg-red-100 dark:text-red-300 dark:bg-red-900/30';
      case 'AUTO_ASSIGNED': return 'text-blue-600 bg-blue-100 dark:text-blue-300 dark:bg-blue-900/30';
      default: return 'text-gray-600 bg-gray-100 dark:text-gray-300 dark:bg-gray-800';
    }
  };

  const getReasonText = (reason: string) => {
    switch (reason) {
      case 'WEEKEND_WORK': return 'Weekend Work';
      case 'HOLIDAY_WORK': return 'Holiday Work';
      case 'OVERTIME': return 'Overtime';
      case 'MANUAL_REQUEST': return 'Manual Request';
      default: return reason;
    }
  };

  const renderBalanceTab = () => (
    <div className="space-y-6">
      {compOffBalance && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 dark:bg-green-900/20 dark:border-green-800">
            <div className="text-sm font-medium text-green-600 dark:text-green-300">Available Balance</div>
            <div className="text-2xl font-bold text-green-700 dark:text-green-200">{compOffBalance.availableBalance} days</div>
          </div>
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 dark:bg-blue-900/20 dark:border-blue-800">
            <div className="text-sm font-medium text-blue-600 dark:text-blue-300">Total Earned</div>
            <div className="text-2xl font-bold text-blue-700 dark:text-blue-200">{compOffBalance.totalEarned} days</div>
          </div>
          <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 dark:bg-orange-900/20 dark:border-orange-800">
            <div className="text-sm font-medium text-orange-600 dark:text-orange-300">Total Used</div>
            <div className="text-2xl font-bold text-orange-700 dark:text-orange-200">{compOffBalance.totalUsed} days</div>
          </div>
        </div>
      )}

      <div className="bg-card border border-border rounded-lg p-4">
        <h3 className="text-lg font-semibold text-card-foreground mb-4">Comp-Off Summary</h3>
        <div className="space-y-2 text-sm text-muted-foreground">
          <p>• <strong>Auto-Assigned:</strong> Comp-off automatically assigned for weekend/holiday work</p>
          <p>• <strong>Banked:</strong> Comp-off earned but not yet assigned due to scheduling conflicts</p>
          <p>• <strong>Available:</strong> Comp-off days you can use for time off</p>
        </div>
      </div>
    </div>
  );

  const renderTransactionsTab = () => (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold text-card-foreground">Recent Transactions</h3>
        <button 
          onClick={loadCompOffData}
          className="px-3 py-1 text-sm bg-primary text-primary-foreground rounded hover:bg-primary/90"
        >
          Refresh
        </button>
      </div>
      
      {compOffTransactions.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          No comp-off transactions found
        </div>
      ) : (
        <div className="space-y-3">
          {compOffTransactions.map((transaction) => (
            <div key={transaction.id} className="bg-card border border-border rounded-lg p-4">
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getTransactionTypeColor(transaction.type)}`}>
                      {transaction.type.replace('_', ' ')}
                    </span>
                    <span className="text-sm text-muted-foreground">
                      {getReasonText(transaction.reason)}
                    </span>
                    {transaction.isAutoAssigned && (
                      <span className="px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-300">
                        Auto
                      </span>
                    )}
                    {transaction.isBanked && (
                      <span className="px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-600 dark:bg-yellow-900/30 dark:text-yellow-300">
                        Banked
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-card-foreground">{transaction.description}</p>
                  <div className="flex gap-4 mt-2 text-xs text-muted-foreground">
                    {transaction.earnedDate && (
                      <span>Earned: {formatDate(transaction.earnedDate)}</span>
                    )}
                    {transaction.compOffDate && (
                      <span>Comp-off: {formatDate(transaction.compOffDate)}</span>
                    )}
                    <span>Created: {formatDate(transaction.createdAt)}</span>
                  </div>
                </div>
                <div className="text-right">
                  <div className={`text-lg font-semibold ${
                    transaction.type === 'EARNED' ? 'text-green-600 dark:text-green-300' : 'text-red-600 dark:text-red-300'
                  }`}>
                    {transaction.type === 'EARNED' ? '+' : '-'}{transaction.days} day{transaction.days !== 1 ? 's' : ''}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  const renderWorkloadTab = () => (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-card-foreground">Weekly Workload Analysis</h3>
      
      {weeklyWorkloads.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          No workload data available
        </div>
      ) : (
        <div className="space-y-4">
          {weeklyWorkloads.map((workload) => (
            <div key={workload.id} className="bg-card border border-border rounded-lg p-4">
              <div className="flex justify-between items-start mb-3">
                <div>
                  <h4 className="font-medium text-card-foreground">
                    Week of {formatDate(workload.weekStart)}
                  </h4>
                  <p className="text-sm text-muted-foreground">
                    {formatDate(workload.weekStart)} - {formatDate(workload.weekEnd)}
                  </p>
                </div>
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                  workload.isBalanced ? 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-300' : 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-300'
                }`}>
                  {workload.isBalanced ? 'Balanced' : 'Unbalanced'}
                </span>
              </div>
              
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <div className="text-muted-foreground">Scheduled</div>
                  <div className="font-semibold">{workload.scheduledWorkDays} days</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Weekend</div>
                  <div className="font-semibold">{workload.weekendWorkDays} days</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Auto Comp-off</div>
                  <div className="font-semibold">{workload.autoCompOffDays} days</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Total Work</div>
                  <div className="font-semibold">{workload.totalWorkDays} days</div>
                </div>
              </div>
              
              {workload.overtimeDays > 0 && (
                <div className="mt-3 p-2 bg-red-50 border border-red-200 rounded text-sm text-red-700 dark:bg-red-900/30 dark:border-red-800 dark:text-red-300">
                  ⚠️ Overtime: {workload.overtimeDays} day{workload.overtimeDays !== 1 ? 's' : ''} 
                  (comp-off credited to bank)
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );

  const renderRotationTab = () => (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-card-foreground">Rotation Status</h3>
      
      {rotationStates.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          No rotation data available
        </div>
      ) : (
        <div className="space-y-4">
          {rotationStates.map((state) => (
            <div key={state.id} className="bg-card border border-border rounded-lg p-4">
              <div className="flex justify-between items-start mb-3">
                <div>
                  <h4 className="font-medium text-card-foreground">
                    {state.algorithmType} - {state.shiftType}
                  </h4>
                  <p className="text-sm text-muted-foreground">
                    Last updated: {formatDate(state.lastUpdated)}
                  </p>
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <div className="text-sm text-muted-foreground mb-1">Sun-Thu Rotation</div>
                  <div className="font-medium">
                    {state.currentSunThuAnalyst ? 
                      analysts.find(a => a.id === state.currentSunThuAnalyst)?.name || 'Unknown' :
                      'None'
                    }
                  </div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground mb-1">Tue-Sat Rotation</div>
                  <div className="font-medium">
                    {state.currentTueSatAnalyst ? 
                      analysts.find(a => a.id === state.currentTueSatAnalyst)?.name || 'Unknown' :
                      'None'
                    }
                  </div>
                </div>
              </div>
              
              <div className="mt-3 pt-3 border-t border-border">
                <div className="text-sm text-muted-foreground">
                  In Progress: {state.inProgressAnalysts.length} analysts | 
                  Completed: {state.completedAnalysts.length} analysts
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  if (loading && !compOffBalance) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-card-foreground mb-2">Compensatory Time Off Management</h2>
        <p className="text-muted-foreground">Manage comp-off balances, transactions, and rotation status</p>
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 dark:bg-red-900/30 dark:border-red-800 dark:text-red-300">
          <div className="flex items-center">
            <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zm-1 9a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd"></path>
            </svg>
            <span className="font-medium">{error}</span>
          </div>
          <div className="mt-2 text-sm">
            Please try refreshing the page. If the problem persists, contact the system administrator.
          </div>
        </div>
      )}

      {/* Analyst Selection */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-muted-foreground mb-2">
          Select Analyst
        </label>
        <select
          value={selectedAnalyst}
          onChange={(e) => setSelectedAnalyst(e.target.value)}
          className="w-full md:w-64 px-3 py-2 border border-border rounded-lg bg-card text-card-foreground focus:ring-2 focus:ring-primary focus:border-primary"
        >
          {analysts.map((analyst) => (
            <option key={analyst.id} value={analyst.id}>
              {analyst.name} ({analyst.shiftType})
            </option>
          ))}
        </select>
      </div>

      {/* Tabs */}
      <div className="mb-6">
        <div className="border-b border-border">
          <nav className="-mb-px flex space-x-8">
            {[
              { id: 'balance', label: 'Balance' },
              { id: 'transactions', label: 'Transactions' },
              { id: 'workload', label: 'Workload' },
              { id: 'rotation', label: 'Rotation' }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`py-2 px-1 border-b-2 font-medium text-sm ${
                  activeTab === tab.id
                    ? 'border-primary text-primary'
                    : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </div>
      </div>

      {/* Tab Content */}
      <div className="min-h-96">
        {activeTab === 'balance' && renderBalanceTab()}
        {activeTab === 'transactions' && renderTransactionsTab()}
        {activeTab === 'workload' && renderWorkloadTab()}
        {activeTab === 'rotation' && renderRotationTab()}
      </div>
    </div>
  );
};

export default CompOffManagement;
