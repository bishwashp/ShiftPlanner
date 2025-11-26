import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { View } from './layout/CollapsibleSidebar';
import {
  Users,
  CheckCircle,
  CalendarBlank,
  Plus,
  ChartBar,
  Warning,
  User,
  Gear,
  Sun,
  Wrench,
  Note,
  CaretRight
} from '@phosphor-icons/react';
import { apiService, DashboardStats, Activity } from '../services/api';
import { formatDateTime } from '../utils/formatDateTime';
import moment from 'moment-timezone';
import FairnessReportModal from './FairnessReport';
import { useActionPrompts } from '../contexts/ActionPromptContext';
import ScheduleGenerationForm from './ScheduleGenerationForm';
import ScheduleGenerationModal from './ScheduleGenerationModal';
import GlassCard from './common/GlassCard';
import TodaysScreenersWidget from './dashboard/widgets/TodaysScreenersWidget';
import UpcomingHolidaysWidget from './dashboard/widgets/UpcomingHolidaysWidget';
import CoverageWidget from './dashboard/widgets/CoverageWidget';
import Button from './ui/Button';

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
  <GlassCard
    onClick={onClick}
    className={`p-0 ${highlight}`}
    interactive={!!onClick}
  >
    <div className="p-6 flex items-center h-full relative z-10">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1 truncate">{title}</p>
        {loading ? (
          <div className="h-8 w-24 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
        ) : (
          <div className="flex items-baseline">
            <p className="text-3xl font-bold text-gray-900 dark:text-white tracking-tight">{value}</p>
          </div>
        )}
      </div>

      <motion.div
        className={`w-12 h-12 rounded-xl flex items-center justify-center ${bgColor} shadow-inner ml-4 flex-shrink-0`}
      >
        <Icon className={`w-6 h-6 ${color}`} weight="duotone" />
      </motion.div>
    </div>
  </GlassCard>
);

interface QuickActionButtonProps {
  text: string;
  icon: React.ElementType;
  onClick?: () => void;
}

const QuickActionButton: React.FC<QuickActionButtonProps> = ({ text, icon: Icon, onClick }) => (
  <Button
    onClick={onClick}
    variant="primary"
    className="w-full h-full min-h-[60px]"
    leftIcon={Icon}
  >
    {text}
  </Button>
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
      // Use dynamic date range based on current month (matching Analytics)
      const startDate = moment().startOf('month').format('YYYY-MM-DD');
      const endDate = moment().endOf('month').format('YYYY-MM-DD');

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
    icon: conflicts.critical.length > 0 ? Warning : CheckCircle,
    color: conflicts.critical.length > 0 ? 'text-destructive' : 'text-green-600',
    bgColor: conflicts.critical.length > 0 ? 'bg-destructive/10' : 'bg-green-600/10',
    // Add yellow highlight when no schedules exist
    highlight: hasNoScheduleConflict ? 'ring-2 ring-yellow-500 ring-opacity-50' : '',
  };

  const handleNavigateToConflicts = () => {
    onViewChange('conflicts');
  };

  const statCards = [
    {
      title: 'Total Analysts',
      value: stats.totalAnalysts,
      icon: Users,
      color: 'text-blue-600 dark:text-blue-400',
      bgColor: 'bg-blue-100 dark:bg-blue-900/30',
      onClick: () => onViewChange('analysts')
    },
    {
      title: 'Active Analysts',
      value: stats.activeAnalysts,
      icon: CheckCircle,
      color: 'text-emerald-600 dark:text-emerald-400',
      bgColor: 'bg-emerald-100 dark:bg-emerald-900/30',
      onClick: () => onViewChange('analysts')
    },
    {
      title: 'Scheduled Shifts',
      value: stats.scheduledShifts,
      icon: CalendarBlank,
      color: 'text-violet-600 dark:text-violet-400',
      bgColor: 'bg-violet-100 dark:bg-violet-900/30',
      onClick: () => onViewChange('schedule')
    },
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

  const getActivityIcon = (category: string) => {
    switch (category) {
      case 'SCHEDULE': return CalendarBlank;
      case 'ANALYST': return User;
      case 'ALGORITHM': return Gear;
      case 'ABSENCE': return Sun;
      case 'SYSTEM': return Wrench;
      default: return Note;
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
      // Use the robust generateSchedule endpoint instead of the legacy preview
      const result = await apiService.generateSchedule({
        startDate,
        endDate,
        algorithm: 'INTELLIGENT'
      });

      setGeneratedSchedules(result.result.proposedSchedules);
      setGenerationSummary({
        totalConflicts: result.result.conflicts.length,
        criticalConflicts: result.result.conflicts.filter((c: any) => c.severity === 'CRITICAL').length,
        assignmentsNeeded: result.result.proposedSchedules.length,
        estimatedTime: 'Generated',
        fairnessMetrics: result.result.fairnessMetrics
      });
      setShowGenerationForm(false);
      setShowGenerationModal(true);

      onSuccess?.(`Generated ${result.result.proposedSchedules.length} schedule assignments`);
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
    <div className="p-6 relative z-10">
      <div className="max-w-7xl mx-auto">
        {error && (
          <div className="mb-6 p-4 bg-red-500/10 border-l-4 border-red-500 rounded backdrop-blur-sm">
            <p className="text-red-500 font-medium">{error}</p>
          </div>
        )}

        {conflicts.critical.length > 0 && !hasActivePrompts() && !hasNoScheduleConflict && (
          <div className="mb-6 p-4 bg-yellow-500/10 border-l-4 border-yellow-500 rounded flex items-center justify-between backdrop-blur-sm">
            <span className="text-yellow-700 dark:text-yellow-300 font-medium">Schedule issues have been detected for the next 30 days. Please review the Conflict Management for more details.</span>
            <Button
              onClick={() => onViewChange('conflicts')}
              variant="secondary"
              className="ml-4 bg-yellow-500 text-white hover:bg-yellow-600 border-none"
            >
              View
            </Button>
          </div>
        )}

        <div className="flex items-center justify-end mb-4">
          <div className="text-sm text-gray-700 dark:text-gray-200 bg-white/5 px-3 py-1 rounded-full backdrop-blur-sm">
            Last updated: {formatDateTime(lastUpdated, moment.tz.guess())}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {statCards.map((card, index) => (
            <StatCard key={index} {...card} loading={loading} />
          ))}
        </div>
        {/* New Widgets Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8 h-60">
          <TodaysScreenersWidget />
          <UpcomingHolidaysWidget />
          <CoverageWidget />
        </div>

        <GlassCard className="mb-8 p-6">
          <h2 className="text-lg font-semibold text-foreground mb-4">Quick Actions</h2>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <QuickActionButton
              text="Add New Analyst"
              icon={Plus}
              onClick={handleAddAnalyst}
            />
            <QuickActionButton
              text="Generate Schedule"
              icon={CalendarBlank}
              onClick={handleGenerateSchedule}
            />
            <QuickActionButton
              text="View Analytics"
              icon={ChartBar}
              onClick={handleViewAnalytics}
            />
            <QuickActionButton
              text="Fairness Report"
              icon={CheckCircle}
              onClick={() => setShowFairnessReport(true)}
            />
          </div>
        </GlassCard>

        <GlassCard className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-semibold text-foreground">Recent Activity</h2>
            <div className="flex bg-muted/50 rounded-lg p-1">
              <Button
                onClick={() => setActiveActivityTab('recent')}
                variant={activeActivityTab === 'recent' ? 'primary' : 'ghost'}
                size="sm"
                className={activeActivityTab === 'recent' ? '' : 'text-muted-foreground hover:text-foreground'}
              >
                Recent
              </Button>
              <Button
                onClick={() => setActiveActivityTab('all')}
                variant={activeActivityTab === 'all' ? 'primary' : 'ghost'}
                size="sm"
                className={activeActivityTab === 'all' ? '' : 'text-muted-foreground hover:text-foreground'}
              >
                All Activities
              </Button>
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
                    <p className="text-gray-700 dark:text-gray-200">
                      {activeActivityTab === 'recent' ? 'No recent activity' : 'No activities found'}
                    </p>
                    <p className="text-sm text-gray-700 dark:text-gray-200/70 mt-1">
                      {activeActivityTab === 'recent'
                        ? 'Activities will appear here as you use the system'
                        : 'Try adjusting your filters or check back later'
                      }
                    </p>
                  </div>
                );
              }

              return (
                <div className="relative pl-4 border-l border-white/10 space-y-6">
                  {currentActivities.map((activity, index) => {
                    const ActivityIcon = getActivityIcon(activity.category);
                    return (
                      <motion.div
                        key={activity.id}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.05 }}
                        className="relative group"
                      >
                        {/* Timeline Dot */}
                        <div className={`absolute -left-[21px] top-1.5 w-3 h-3 rounded-full border-2 border-background ${getActivityColor(activity)}`} />

                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <ActivityIcon className="w-4 h-4 text-muted-foreground" />
                              <span className="text-sm font-medium text-gray-900 dark:text-white truncate">
                                {activity.title}
                              </span>
                              <span className="text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">
                                {activeActivityTab === 'recent'
                                  ? moment(activity.createdAt).fromNow()
                                  : moment(activity.createdAt).format('MMM D, h:mm A')}
                              </span>
                            </div>

                            <p className="text-xs text-gray-600 dark:text-gray-300 line-clamp-2 mb-2">
                              {activity.description}
                            </p>

                            {/* Action Button based on Category/Type */}
                            {activity.category === 'SCHEDULE' && (
                              <button
                                onClick={() => onViewChange('schedule')}
                                className="text-xs font-medium text-primary hover:text-primary/80 flex items-center gap-1 transition-colors"
                              >
                                View Schedule <CaretRight className="inline w-3 h-3" />
                              </button>
                            )}
                            {activity.category === 'ANALYST' && (
                              <button
                                onClick={() => onViewChange('analysts')}
                                className="text-xs font-medium text-primary hover:text-primary/80 flex items-center gap-1 transition-colors"
                              >
                                View Analyst <CaretRight className="inline w-3 h-3" />
                              </button>
                            )}
                            {activity.category === 'CONFLICT' && (
                              <button
                                onClick={() => onViewChange('conflicts')}
                                className="text-xs font-medium text-red-500 hover:text-red-400 flex items-center gap-1 transition-colors"
                              >
                                Resolve Conflict <CaretRight className="inline w-3 h-3" />
                              </button>
                            )}
                          </div>

                          {/* Impact Badge */}
                          <div className={`flex-shrink-0 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${activity.impact === 'CRITICAL' ? 'bg-red-500/10 text-red-500' :
                            activity.impact === 'HIGH' ? 'bg-orange-500/10 text-orange-500' :
                              activity.impact === 'MEDIUM' ? 'bg-blue-500/10 text-blue-500' :
                                'bg-green-500/10 text-green-500'
                            }`}>
                            {activity.impact}
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              );
            })()}
          </div>
        </GlassCard>
      </div>

      {showFairnessReport && (
        <FairnessReportModal
          startDate={moment().startOf('month').format('YYYY-MM-DD')}
          endDate={moment().endOf('month').format('YYYY-MM-DD')}
          onClose={() => setShowFairnessReport(false)}
        />
      )}

      {/* Schedule Generation Form */}
      {showGenerationForm && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <GlassCard className="max-w-2xl w-full" interactive={false}>
            <div className="p-6">
              <ScheduleGenerationForm
                onGenerate={handleGenerateSchedules}
                isLoading={isGenerating}
              />
            </div>
            <div className="flex justify-end p-6 border-t border-white/10">
              <Button
                onClick={() => setShowGenerationForm(false)}
                variant="secondary"
              >
                Cancel
              </Button>
            </div>
          </GlassCard>
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