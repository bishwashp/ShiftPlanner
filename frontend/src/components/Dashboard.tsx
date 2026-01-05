import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
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
  CaretRight,
  Lightning,
  Clock
} from '@phosphor-icons/react';
import { apiService, DashboardStats, Activity } from '../services/api';
import { formatDateTime } from '../utils/formatDateTime';
import moment from 'moment-timezone';
import FairnessReportModal from './FairnessReport';

import ScheduleGenerationForm from './ScheduleGenerationForm';
import ScheduleGenerationModal from './ScheduleGenerationModal';
import GlassCard from './common/GlassCard';
import CommandCenter from './dashboard/command/CommandCenter';
import SystemHealth from './dashboard/command/SystemHealth';
import Button from './ui/Button';
import CreateAbsenceModal from './modals/CreateAbsenceModal';



interface DashboardProps {
  onViewChange: (view: View) => void;
  onError?: (error: string) => void;
  onSuccess?: (message: string) => void;
  isLoading?: (loading: boolean) => void;
  onRefresh?: () => void;
  isRefreshing?: boolean;
  onConflictTabChange?: (tab: 'critical' | 'recommended') => void;
  onAvailabilityTabChange?: (tab: 'holidays' | 'absences') => void;
}



const Dashboard: React.FC<DashboardProps> = ({ onViewChange, onError, onSuccess, isLoading, onRefresh, isRefreshing, onConflictTabChange, onAvailabilityTabChange }) => {
  const { isManager } = useAuth();

  const [conflicts, setConflicts] = useState<{ critical: any[]; recommended: any[] }>({ critical: [], recommended: [] });
  const [recentActivity, setRecentActivity] = useState<Activity[]>([]);
  const [allActivities, setAllActivities] = useState<Activity[]>([]);
  const [activeActivityTab, setActiveActivityTab] = useState<'recent' | 'all'>('recent');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [showFairnessReport, setShowFairnessReport] = useState(false);
  const [showAbsenceModal, setShowAbsenceModal] = useState(false);
  const [analysts, setAnalysts] = useState<any[]>([]);

  // Schedule generation state
  const [showGenerationForm, setShowGenerationForm] = useState(false);
  const [showGenerationModal, setShowGenerationModal] = useState(false);
  const [generatedSchedules, setGeneratedSchedules] = useState<any[]>([]);
  const [generationSummary, setGenerationSummary] = useState<any>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  const [refreshKey, setRefreshKey] = useState(0);

  const fetchDashboardData = async (refreshChildren: boolean = false) => {
    setLoading(true);
    setError(null);
    try {
      // Use dynamic date range based on current month (matching Analytics)
      const startDate = moment().startOf('month').format('YYYY-MM-DD');
      const endDate = moment().endOf('month').format('YYYY-MM-DD');

      const conflictsData = await apiService.getAllConflicts(startDate, endDate);
      setConflicts(conflictsData);

      // Add a small delay between requests
      await new Promise(resolve => setTimeout(resolve, 100));

      const activityData = await apiService.getRecentActivities(3);
      setRecentActivity(activityData);

      // Also fetch all activities for the "All Activities" tab
      const allActivityData = await apiService.getActivities({ limit: 50 });
      setAllActivities(allActivityData);

      // Increment refresh key to force re-mount of child components that fetch their own data
      // Only do this if explicitly requested (e.g. manual refresh), not on initial load
      if (refreshChildren) {
        setRefreshKey(prev => prev + 1);
      }
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

  const fetchAnalysts = async () => {
    try {
      const data = await apiService.getAnalysts();
      setAnalysts(data);
    } catch (err) {
      console.error('Error fetching analysts:', err);
    }
  };

  useEffect(() => {
    fetchDashboardData(false); // Don't force refresh children on initial mount
    fetchAnalysts();
  }, []);

  // Handle refresh from header button
  useEffect(() => {
    if (isRefreshing) {
      handleRefresh();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isRefreshing]);

  // Check if there's a "no schedule exists" or "incomplete schedules" conflict (now in recommended section)
  const hasNoScheduleConflict = conflicts.recommended.some(conflict =>
    conflict.type === 'NO_SCHEDULE_EXISTS' || conflict.type === 'INCOMPLETE_SCHEDULES'
  );

  const handleNavigateToConflicts = () => {
    onViewChange('conflicts');
  };

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
    fetchDashboardData(true); // Force refresh children on manual refresh
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
      await fetchDashboardData(true); // Force refresh children to show new data

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



        <div className="flex items-center justify-end gap-3 mb-4">
          <SystemHealth
            key={refreshKey}
            onResolveCritical={() => {
              // Ensure we're on the critical tab
              onConflictTabChange?.('critical');
              onViewChange('conflicts');
            }}
            onReviewRecommended={() => {
              // Switch to recommended tab
              onConflictTabChange?.('recommended');
              onViewChange('conflicts');
            }}
          />
          <div className="text-sm text-gray-700 dark:text-gray-200 bg-white/5 px-3 py-1 rounded-full backdrop-blur-sm whitespace-nowrap">
            Last updated: {formatDateTime(lastUpdated, moment.tz.guess())}
          </div>
        </div>

        {/* Operational Command Center */}
        <CommandCenter key={refreshKey} onResolve={() => onViewChange('conflicts')} />

        {/* Quick Actions - Role-specific */}
        <GlassCard className="mb-4 p-4">
          <div className="flex items-center gap-2 mb-3 text-gray-500 dark:text-gray-400">
            <Lightning className="w-4 h-4" weight="fill" />
            <h2 className="text-xs font-medium uppercase tracking-wider">Quick Actions</h2>
          </div>
          <div className="flex flex-wrap gap-3">
            {isManager ? (
              // Manager Quick Actions
              <>
                <Button
                  onClick={handleAddAnalyst}
                  variant="secondary"
                  className="flex items-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  Add New Analyst
                </Button>
                <Button
                  onClick={handleGenerateSchedule}
                  variant="secondary"
                  className="flex items-center gap-2"
                >
                  <CalendarBlank className="w-4 h-4" />
                  Generate Schedule
                </Button>
                <Button
                  onClick={handleViewAnalytics}
                  variant="secondary"
                  className="flex items-center gap-2"
                >
                  <ChartBar className="w-4 h-4" />
                  View Analytics
                </Button>
                <Button
                  onClick={() => setShowFairnessReport(true)}
                  variant="secondary"
                  className="flex items-center gap-2"
                >
                  <CheckCircle className="w-4 h-4" />
                  Fairness Report
                </Button>
              </>
            ) : (
              // Analyst Quick Actions
              <>
                <Button
                  onClick={() => setShowAbsenceModal(true)}
                  variant="primary"
                  className="flex items-center gap-2"
                >
                  <CalendarBlank className="w-4 h-4" />
                  Request Leave
                </Button>
                <Button
                  onClick={() => {
                    onViewChange('availability');
                    onAvailabilityTabChange?.('absences');
                  }}
                  variant="secondary"
                  className="flex items-center gap-2"
                >
                  <Clock className="w-4 h-4" />
                  View Absences
                </Button>
                <Button
                  onClick={() => onViewChange('schedule')}
                  variant="secondary"
                  className="flex items-center gap-2"
                >
                  <CalendarBlank className="w-4 h-4" />
                  View Schedule
                </Button>
                <Button
                  onClick={handleViewAnalytics}
                  variant="secondary"
                  className="flex items-center gap-2"
                >
                  <ChartBar className="w-4 h-4" />
                  Shift Distribution
                </Button>
              </>
            )}
          </div>
        </GlassCard>

        {isManager && (
          <>
            <GlassCard className="p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400">
                  <Clock className="w-4 h-4" weight="fill" />
                  <h2 className="text-xs font-medium uppercase tracking-wider">Recent Activity</h2>
                </div>
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
          </>
        )}
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

      {/* Absence Request Modal */}
      <CreateAbsenceModal
        isOpen={showAbsenceModal}
        onClose={() => setShowAbsenceModal(false)}
        onSuccess={() => setShowAbsenceModal(false)}
        analysts={analysts}
      />
    </div>
  );
};

export default Dashboard;