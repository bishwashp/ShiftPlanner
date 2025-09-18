import React, { useState, useEffect } from 'react';
import { View } from './layout/CollapsibleSidebar';
import AnalystsIcon from './icons/AnalystsIcon';
import CheckIcon from './icons/CheckIcon';
import ScheduleIcon from './icons/ScheduleIcon';
import PlusIcon from './icons/PlusIcon';
import AnalyticsIcon from './icons/AnalyticsIcon';
import AlertIcon from './icons/AlertIcon';
import { apiService, DashboardStats } from '../services/api';
import { formatDateTime } from '../utils/formatDateTime';
import moment from 'moment-timezone';
import { useNotifications } from '../hooks/useNotifications';
import { useActionPrompts } from '../contexts/ActionPromptContext';
import BellIcon from './icons/BellIcon';

interface StatCardProps {
    title: string;
    value: number | string;
    icon: React.ElementType;
    color: string;
    bgColor: string;
    highlight?: string;
    loading?: boolean;
    onClick?: () => void;
}

const StatCard: React.FC<StatCardProps> = ({ title, value, icon: Icon, color, bgColor, highlight = '', loading = false, onClick }) => (
  <div className={`bg-card text-card-foreground rounded-2xl p-5 shadow-sm border border-border flex items-center ${highlight}`}>
    <div className="flex-1">
      <p className="text-sm font-medium text-muted-foreground">{title}</p>
      {loading ? (
        <div className="h-8 bg-muted rounded animate-pulse mt-1"></div>
      ) : (
      <p className="text-3xl font-bold text-foreground">{value}</p>
      )}
    </div>
    <div className={`w-12 h-12 rounded-full flex items-center justify-center ${bgColor}`}>
      <Icon className={`w-6 h-6 ${color}`} />
    </div>
  </div>
);

interface QuickActionButtonProps {
    text: string;
    icon: React.ElementType;
    onClick?: () => void;
}

const QuickActionButton: React.FC<QuickActionButtonProps> = ({ text, icon: Icon, onClick }) => (
  <button 
    className="flex-1 flex items-center justify-center px-4 py-3 rounded-xl transition-all bg-primary/10 hover:bg-primary/20"
    onClick={onClick}
  >
    <Icon className="w-5 h-5 mr-2.5 text-primary" />
    <span className="text-sm font-semibold text-primary">{text}</span>
  </button>
);

interface DashboardProps { onViewChange: (view: View) => void; }

const Dashboard: React.FC<DashboardProps> = ({ onViewChange }) => {
  const { addDemoNotifications } = useNotifications();
  const { showCriticalPrompt, hasActivePrompts } = useActionPrompts();
  const [stats, setStats] = useState<DashboardStats>({
    totalAnalysts: 0,
    activeAnalysts: 0,
    scheduledShifts: 0,
    pendingSchedules: 0,
  });
  const [conflicts, setConflicts] = useState<{ critical: any[]; recommended: any[] }>({ critical: [], recommended: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

  const fetchDashboardData = async () => {
    setLoading(true);
    setError(null);
    try {
      const startDate = '2025-10-08';
      const endDate = '2025-11-08';

      const [stats, conflictsData] = await Promise.all([
        apiService.getDashboardStats(),
        apiService.getAllConflicts(startDate, endDate)
      ]);
      
      setStats(stats);
      setConflicts(conflictsData);
    } catch (err) {
      console.error('Error fetching dashboard data:', err);
      setError('Failed to load dashboard data. Please try again.');
    }
    setLastUpdated(new Date());
    setLoading(false);
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  // Show action prompt for critical conflicts (but not for schedule existence conflicts)
  useEffect(() => {
    const hasNoScheduleConflict = conflicts.critical.some(conflict => 
      conflict.type === 'NO_SCHEDULE_EXISTS' || 
      conflict.type === 'INCOMPLETE_SCHEDULES'
    );
    // Filter out NO_SCHEDULE_EXISTS and NO_ANALYST_ASSIGNED (which are essentially missing schedules)
    const actualConflicts = conflicts.critical.filter(conflict => 
      conflict.type !== 'NO_SCHEDULE_EXISTS' && 
      conflict.type !== 'NO_ANALYST_ASSIGNED' &&
      conflict.type !== 'INCOMPLETE_SCHEDULES'
    );
    
    if (actualConflicts.length > 0 && !loading && !hasNoScheduleConflict) {
      showCriticalPrompt(
        'Critical Schedule Conflicts Detected',
        `Found ${actualConflicts.length} critical conflict(s) that require immediate attention. These conflicts may affect operations and need to be resolved.`,
        [
          {
            label: 'Review & Fix Conflicts',
            variant: 'primary' as const,
            onClick: () => onViewChange('conflicts')
          },
          {
            label: 'Auto-Fix All Conflicts',
            variant: 'secondary' as const,
            onClick: () => {
              // This would trigger the auto-fix functionality
              console.log('Auto-fix all conflicts triggered');
            }
          }
        ],
        { relatedView: 'conflicts', conflictCount: actualConflicts.length }
      );
    }
  }, [conflicts.critical.length, loading, showCriticalPrompt, onViewChange]);

  // Check if there's a "no schedule exists" or "incomplete schedules" conflict (now in recommended section)
  const hasNoScheduleConflict = conflicts.recommended.some(conflict => 
    conflict.type === 'NO_SCHEDULE_EXISTS' || conflict.type === 'INCOMPLETE_SCHEDULES'
  );
  
  const conflictCard = {
    title: 'Schedule Conflicts',
    value: conflicts.critical.length + conflicts.recommended.length,
    icon: conflicts.critical.length > 0 ? AlertIcon : CheckIcon,
    color: conflicts.critical.length > 0 ? 'text-destructive' : 'text-green-600',
    bgColor: conflicts.critical.length > 0 ? 'bg-destructive/10' : 'bg-green-600/10',
    // Add yellow highlight when no schedules exist
    highlight: hasNoScheduleConflict ? 'ring-2 ring-yellow-500 ring-opacity-50' : '',
  };

  const handleNavigateToConflicts = () => {
    onViewChange('conflicts');
  };

  const statCards = [
    { title: 'Total Analysts', value: stats.totalAnalysts, icon: AnalystsIcon, color: 'text-primary', bgColor: 'bg-primary/10' },
    { title: 'Active Analysts', value: stats.activeAnalysts, icon: CheckIcon, color: 'text-green-600', bgColor: 'bg-green-600/10' },
    { title: 'Scheduled Shifts', value: stats.scheduledShifts, icon: ScheduleIcon, color: 'text-purple-600', bgColor: 'bg-purple-600/10' },
    { ...conflictCard, onClick: handleNavigateToConflicts },
  ];
  
  const recentActivity = [
      { text: 'Dashboard data refreshed', time: 'Just now', color: 'bg-primary' },
      { text: 'API connection established', time: '1 minute ago', color: 'bg-green-500' },
      { text: 'Backend server running', time: '2 minutes ago', color: 'bg-purple-500' },
  ];

  const handleRefresh = () => {
    fetchDashboardData();
  };

  const handleAddAnalyst = () => {
    onViewChange('analysts');
  };

  const handleGenerateSchedule = () => {
    onViewChange('schedule');
  };

  const handleViewAnalytics = () => {
    onViewChange('analytics');
  };

  const handleTestNotifications = () => {
    addDemoNotifications();
  };


  return (
    <div className="bg-background text-foreground p-6">
      <div className="max-w-7xl mx-auto">
        {error && (
          <div className="mb-6 p-4 bg-red-500/10 border-l-4 border-red-500 rounded">
            <p className="text-red-500 font-medium">{error}</p>
          </div>
        )}

        {conflicts.critical.length > 0 && !hasActivePrompts() && !hasNoScheduleConflict && (
          <div className="mb-6 p-4 bg-yellow-500/10 border-l-4 border-yellow-500 rounded flex items-center justify-between">
            <span className="text-yellow-700 dark:text-yellow-300 font-medium">Schedule issues have been detected for the next 30 days. Please review the Conflict Management for more details.</span>
            <button
              onClick={() => onViewChange('conflicts')}
              className="ml-4 px-4 py-2 bg-yellow-500 text-white rounded hover:bg-yellow-600 font-semibold"
            >
              View
            </button>
          </div>
        )}
        
        <div className="flex items-center justify-end mb-4">
          <button
            onClick={handleRefresh}
            disabled={loading}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Refreshing...' : 'Refresh'}
          </button>
          <div className="text-sm text-muted-foreground ml-4">
            Last updated: {formatDateTime(lastUpdated, moment.tz.guess())}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {statCards.map((card, index) => (
            card.title === 'Schedule Conflicts' ? (
              <button
                key={index}
                onClick={() => onViewChange('conflicts')}
                className="w-full cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary"
                style={{ background: 'none', border: 'none', padding: 0 }}
                tabIndex={0}
              >
                <StatCard {...card} loading={loading} />
              </button>
            ) : (
              <div key={index}>
                <StatCard {...card} loading={loading} />
              </div>
            )
          ))}
        </div>

        <div className="mt-8 bg-card text-card-foreground rounded-2xl p-6 shadow-sm border border-border">
          <h2 className="text-lg font-semibold text-foreground mb-4">Quick Actions</h2>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <QuickActionButton
              text="Add New Analyst"
              icon={PlusIcon}
              onClick={handleAddAnalyst}
            />
            <QuickActionButton
              text="Generate Schedule"
              icon={ScheduleIcon}
              onClick={handleGenerateSchedule}
            />
            <QuickActionButton
              text="View Analytics"
              icon={AnalyticsIcon}
              onClick={handleViewAnalytics}
            />
            <QuickActionButton
              text="Test Notifications"
              icon={BellIcon}
              onClick={handleTestNotifications}
            />
          </div>
        </div>

        <div className="mt-8 bg-card text-card-foreground rounded-2xl p-6 shadow-sm border border-border">
          <h2 className="text-lg font-semibold text-foreground mb-4">Recent Activity</h2>
          <div className="space-y-4">
            {recentActivity.map((activity, index) => (
              <div key={index} className="flex items-center justify-between text-sm">
                <div className="flex items-center">
                    <span className={`w-2.5 h-2.5 rounded-full mr-3 ${activity.color}`}></span>
                    <p className="text-muted-foreground">{activity.text}</p>
                </div>
                <p className="text-muted-foreground/50">{activity.time}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;