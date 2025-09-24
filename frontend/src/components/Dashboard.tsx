import React, { useState, useEffect } from 'react';
import { View } from './layout/CollapsibleSidebar';
import AnalystsIcon from './icons/AnalystsIcon';
import CheckIcon from './icons/CheckIcon';
import ScheduleIcon from './icons/ScheduleIcon';
import PlusIcon from './icons/PlusIcon';
import AnalyticsIcon from './icons/AnalyticsIcon';
import AlertIcon from './icons/AlertIcon';
import { apiService, DashboardStats, Activity } from '../services/api';
import ScheduleSnapshot from './ScheduleSnapshot';
import { formatDateTime } from '../utils/formatDateTime';
import moment from 'moment-timezone';
import FairnessReportModal from './FairnessReport';
import { useActionPrompts } from '../contexts/ActionPromptContext';
import ScheduleGenerationForm from './ScheduleGenerationForm';
import ScheduleGenerationModal from './ScheduleGenerationModal';

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

interface DashboardProps { 
  onViewChange: (view: View) => void;
  onError?: (error: string) => void;
  onSuccess?: (message: string) => void;
  isLoading?: (loading: boolean) => void;
  onRefresh?: () => void;
  isRefreshing?: boolean;
}

const Dashboard: React.FC<DashboardProps> = ({ onViewChange, onError, onSuccess, isLoading, onRefresh, isRefreshing }) => {
  const { showCriticalPrompt, hasActivePrompts } = useActionPrompts();
  const [stats, setStats] = useState<DashboardStats>({
    totalAnalysts: 0,
    activeAnalysts: 0,
    scheduledShifts: 0,
    pendingSchedules: 0,
  });
  const [conflicts, setConflicts] = useState<{ critical: any[]; recommended: any[] }>({ critical: [], recommended: [] });
  const [recentActivity, setRecentActivity] = useState<Activity[]>([]);
  const [allActivities, setAllActivities] = useState<Activity[]>([]);
  const [activeActivityTab, setActiveActivityTab] = useState<'recent' | 'all'>('recent');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [showFairnessReport, setShowFairnessReport] = useState(false);
  
  // Schedule generation state
  const [showGenerationForm, setShowGenerationForm] = useState(false);
  const [showGenerationModal, setShowGenerationModal] = useState(false);
  const [generatedSchedules, setGeneratedSchedules] = useState<any[]>([]);
  const [generationSummary, setGenerationSummary] = useState<any>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  const fetchDashboardData = async () => {
    setLoading(true);
    setError(null);
    try {
      // Use dynamic date range based on current date
      const startDate = moment().format('YYYY-MM-DD');
      const endDate = moment().add(30, 'days').format('YYYY-MM-DD');

      // Fetch data sequentially to avoid rate limiting
      const stats = await apiService.getDashboardStats();
      setStats(stats);
      
      // Add a small delay between requests
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const conflictsData = await apiService.getAllConflicts(startDate, endDate);
      setConflicts(conflictsData);
      
      // Add a small delay between requests
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const activityData = await apiService.getRecentActivities(3);
      setRecentActivity(activityData);
      
      // Also fetch all activities for the "All Activities" tab
      const allActivityData = await apiService.getActivities({ limit: 50 });
      setAllActivities(allActivityData);
    } catch (err: any) {
      console.error('Error fetching dashboard data:', err);
      
      // Handle rate limiting specifically
      if (err.response?.status === 429) {
        const retryAfter = err.response.data?.retryAfter || 60;
        setError(`Rate limit exceeded. Please wait ${retryAfter} seconds and try again.`);
      } else {
        setError('Failed to load dashboard data. Please try again.');
      }
    }
    setLastUpdated(new Date());
    setLoading(false);
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  // Handle refresh from header button
  useEffect(() => {
    if (isRefreshing && onRefresh) {
      handleRefresh();
    }
  }, [isRefreshing, onRefresh]);

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
  }, [conflicts.critical.length, conflicts.critical, loading, showCriticalPrompt, onViewChange]);

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
  
  const getActivityColor = (activity: Activity): string => {
    switch (activity.impact) {
      case 'CRITICAL': return 'bg-red-500';
      case 'HIGH': return 'bg-orange-500';
      case 'MEDIUM': return 'bg-blue-500';
      case 'LOW': return 'bg-green-500';
      default: return 'bg-gray-500';
    }
  };

  const getActivityIcon = (category: string): string => {
    switch (category) {
      case 'SCHEDULE': return '📅';
      case 'ANALYST': return '👤';
      case 'ALGORITHM': return '⚙️';
      case 'ABSENCE': return '🏖️';
      case 'SYSTEM': return '🔧';
      default: return '📝';
    }
  };


  const handleRefresh = () => {
    fetchDashboardData();
  };

  const handleAddAnalyst = () => {
    onViewChange('analysts');
  };

  const handleGenerateSchedule = () => {
    setShowGenerationForm(true);
  };

  const handleViewAnalytics = () => {
    onViewChange('analytics');
  };


  // Schedule generation handlers
  const handleGenerateSchedules = async (startDate: string, endDate: string, algorithm: string) => {
    setIsGenerating(true);
    isLoading?.(true);
    try {
      const result = await apiService.generateSchedulePreview({
        startDate,
        endDate,
        algorithmType: algorithm
      });
      
      setGeneratedSchedules(result.proposedSchedules);
      setGenerationSummary({
        totalConflicts: result.conflicts.length,
        criticalConflicts: result.conflicts.filter(c => c.type === 'CRITICAL').length,
        assignmentsNeeded: result.proposedSchedules.length,
        estimatedTime: 'Generated'
      });
      setShowGenerationForm(false);
      setShowGenerationModal(true);
      
      onSuccess?.(`Generated ${result.proposedSchedules.length} schedule assignments`);
    } catch (err) {
      console.error('Error generating schedules:', err);
      onError?.('Failed to generate schedules. Please try again.');
    } finally {
      setIsGenerating(false);
      isLoading?.(false);
    }
  };

  const handleApplySchedules = async (schedulesToApply: any[]) => {
    try {
      console.log('Applying schedules:', schedulesToApply);
      
      // Transform the schedules to the format expected by the API
      const assignments = schedulesToApply.map(schedule => ({
        date: schedule.date,
        analystId: schedule.analystId,
        shiftType: schedule.shiftType,
        isScreener: schedule.isScreener
      }));
      
      // Call the API to apply the schedules
      const result = await apiService.applyAutoFix({ assignments });
      
      console.log('Schedules applied successfully:', result);
      
      // Refresh the dashboard data to show updated stats
      await fetchDashboardData();
      
      setShowGenerationModal(false);
      
      // Handle success message with details
      const successCount = result.createdSchedules?.length || 0;
      const errorCount = result.errors?.length || 0;
      
      if (errorCount > 0) {
        onSuccess?.(`Applied ${successCount} schedules successfully, ${errorCount} failed. Check console for details.`);
        console.warn('Some schedules failed to apply:', result.errors);
      } else {
        onSuccess?.(`Successfully applied ${successCount} schedules to the calendar`);
      }
    } catch (err) {
      console.error('Error applying schedules:', err);
      onError?.('Failed to apply schedules. Please try again.');
    }
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
          <div className="text-sm text-muted-foreground">
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
              text="Fairness Report"
              icon={CheckIcon}
              onClick={() => setShowFairnessReport(true)}
            />
          </div>
        </div>

        {/* Schedule Snapshot */}
        <div className="mt-8">
          <ScheduleSnapshot />
        </div>

        <div className="mt-8 bg-card text-card-foreground rounded-2xl p-6 shadow-sm border border-border">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-foreground">Recent Activity</h2>
            <div className="flex space-x-1 bg-muted rounded-lg p-1">
              <button
                onClick={() => setActiveActivityTab('recent')}
                className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                  activeActivityTab === 'recent' 
                    ? 'bg-background text-foreground shadow-sm' 
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Recent
              </button>
              <button
                onClick={() => setActiveActivityTab('all')}
                className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                  activeActivityTab === 'all' 
                    ? 'bg-background text-foreground shadow-sm' 
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                All Activities
              </button>
            </div>
          </div>
          <div className="space-y-2">
            {loading ? (
              // Loading skeleton
              Array.from({ length: 3 }).map((_, index) => (
                <div key={index} className="flex items-center justify-between text-sm">
                  <div className="flex items-center">
                    <div className="w-2.5 h-2.5 rounded-full mr-3 bg-muted animate-pulse"></div>
                    <div className="h-4 bg-muted rounded animate-pulse w-64"></div>
                  </div>
                  <div className="h-4 bg-muted rounded animate-pulse w-16"></div>
                </div>
              ))
            ) : (() => {
              const currentActivities = activeActivityTab === 'recent' ? recentActivity : allActivities;
              const isEmpty = currentActivities.length === 0;
              
              if (isEmpty) {
                return (
                  <div className="text-center py-8">
                    <p className="text-muted-foreground">
                      {activeActivityTab === 'recent' ? 'No recent activity' : 'No activities found'}
                    </p>
                    <p className="text-sm text-muted-foreground/70 mt-1">
                      {activeActivityTab === 'recent' 
                        ? 'Activities will appear here as you use the system'
                        : 'Try adjusting your filters or check back later'
                      }
                    </p>
                  </div>
                );
              }

              return currentActivities.map((activity) => (
                <div key={activity.id} className="flex items-start justify-between text-sm p-2 rounded-lg hover:bg-muted/50 transition-colors">
                  <div className="flex items-start flex-1">
                    <div className="flex items-center mr-3">
                      <span className="text-base mr-2">{getActivityIcon(activity.category)}</span>
                      <span className={`w-2 h-2 rounded-full ${getActivityColor(activity)}`}></span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <h3 className="font-medium text-foreground text-sm">{activity.title}</h3>
                        <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${
                          activity.impact === 'CRITICAL' ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' :
                          activity.impact === 'HIGH' ? 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200' :
                          activity.impact === 'MEDIUM' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' :
                          'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                        }`}>
                          {activity.impact}
                        </span>
                        <span className="inline-block px-2 py-0.5 rounded-full text-xs font-medium bg-muted text-muted-foreground">
                          {activity.category}
                        </span>
                      </div>
                      <p className="text-muted-foreground text-xs mb-1 leading-relaxed">{activity.description}</p>
                      {activity.performedBy && (
                        <p className="text-xs text-muted-foreground/70">
                          by {activity.performedBy}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="text-right ml-3 flex-shrink-0">
                    <p className="text-muted-foreground/50 text-xs">
                      {activeActivityTab === 'recent' 
                        ? moment(activity.createdAt).fromNow()
                        : moment(activity.createdAt).format('MMM D, h:mm A')
                      }
                    </p>
                  </div>
                </div>
              ));
            })()}
          </div>
        </div>
      </div>

      {showFairnessReport && (
        <FairnessReportModal
          startDate={moment().subtract(30, 'days').format('YYYY-MM-DD')}
          endDate={moment().format('YYYY-MM-DD')}
          onClose={() => setShowFairnessReport(false)}
        />
      )}

      {/* Schedule Generation Form */}
      {showGenerationForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-background border border-border rounded-lg shadow-xl max-w-2xl w-full">
            <div className="p-6">
              <ScheduleGenerationForm
                onGenerate={handleGenerateSchedules}
                isLoading={isGenerating}
              />
            </div>
            <div className="flex justify-end p-6 border-t border-border">
              <button
                onClick={() => setShowGenerationForm(false)}
                className="px-4 py-2 border border-border rounded-md hover:bg-muted transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Schedule Generation Modal */}
      <ScheduleGenerationModal
        isOpen={showGenerationModal}
        onClose={() => setShowGenerationModal(false)}
        onApply={handleApplySchedules}
        generatedSchedules={generatedSchedules}
        summary={generationSummary || {
          totalConflicts: 0,
          criticalConflicts: 0,
          assignmentsNeeded: 0,
          estimatedTime: '0ms'
        }}
        isLoading={isGenerating}
      />
    </div>
  );
};

export default Dashboard;