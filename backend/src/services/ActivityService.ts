import { prisma } from '../lib/prisma';
import moment from 'moment';

export interface ActivityData {
  type: string;
  category: 'SCHEDULE' | 'ANALYST' | 'ALGORITHM' | 'ABSENCE' | 'SYSTEM';
  title: string;
  description: string;
  performedBy?: string;
  resourceType?: string;
  resourceId?: string;
  metadata?: any;
  impact?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
}

export interface ActivityFilters {
  category?: string;
  type?: string;
  performedBy?: string;
  impact?: string;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
}

export class ActivityService {
  /**
   * Log a new activity
   */
  static async logActivity(data: ActivityData): Promise<void> {
    try {
      await prisma.activity.create({
        data: {
          type: data.type,
          category: data.category,
          title: data.title,
          description: data.description,
          performedBy: data.performedBy,
          resourceType: data.resourceType,
          resourceId: data.resourceId,
          metadata: data.metadata ? JSON.stringify(data.metadata) : null,
          impact: data.impact || 'LOW',
        },
      });
    } catch (error) {
      console.error('Failed to log activity:', error);
      // Don't throw - activity logging should not break the main flow
    }
  }

  /**
   * Get recent activities for dashboard
   */
  static async getRecentActivities(limit: number = 10): Promise<any[]> {
    try {
      const activities = await prisma.activity.findMany({
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          type: true,
          category: true,
          title: true,
          description: true,
          performedBy: true,
          resourceType: true,
          resourceId: true,
          impact: true,
          createdAt: true,
        },
      });

      return activities.map((activity: any) => ({
        ...activity,
        metadata: activity.metadata ? JSON.parse(activity.metadata) : null,
      }));
    } catch (error) {
      console.error('Failed to fetch recent activities:', error);
      return [];
    }
  }

  /**
   * Get activities with filters
   */
  static async getActivities(filters: ActivityFilters = {}): Promise<any[]> {
    try {
      const where: any = {};

      if (filters.category) {
        where.category = filters.category;
      }

      if (filters.type) {
        where.type = filters.type;
      }

      if (filters.performedBy) {
        where.performedBy = filters.performedBy;
      }

      if (filters.impact) {
        where.impact = filters.impact;
      }

      if (filters.startDate || filters.endDate) {
        where.createdAt = {};
        if (filters.startDate) {
          where.createdAt.gte = filters.startDate;
        }
        if (filters.endDate) {
          where.createdAt.lte = filters.endDate;
        }
      }

      const activities = await prisma.activity.findMany({
        where,
        take: filters.limit || 50,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          type: true,
          category: true,
          title: true,
          description: true,
          performedBy: true,
          resourceType: true,
          resourceId: true,
          impact: true,
          createdAt: true,
        },
      });

      return activities.map((activity: any) => ({
        ...activity,
        metadata: activity.metadata ? JSON.parse(activity.metadata) : null,
      }));
    } catch (error) {
      console.error('Failed to fetch activities:', error);
      return [];
    }
  }

  /**
   * Get activity statistics
   */
  static async getActivityStats(days: number = 30): Promise<{
    totalActivities: number;
    activitiesByCategory: Record<string, number>;
    activitiesByImpact: Record<string, number>;
    mostActiveUser: string | null;
    recentActivityTrend: Array<{ date: string; count: number }>;
  }> {
    try {
      const since = new Date();
      since.setDate(since.getDate() - days);

      const activities = await prisma.activity.findMany({
        where: { createdAt: { gte: since } },
        select: {
          category: true,
          impact: true,
          performedBy: true,
          createdAt: true,
        },
      });

      const totalActivities = activities.length;

      // Count by category
      const activitiesByCategory = activities.reduce((acc, activity) => {
        acc[activity.category] = (acc[activity.category] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      // Count by impact
      const activitiesByImpact = activities.reduce((acc, activity) => {
        acc[activity.impact] = (acc[activity.impact] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      // Find most active user
      const userActivityCount = activities.reduce((acc, activity) => {
        if (activity.performedBy) {
          acc[activity.performedBy] = (acc[activity.performedBy] || 0) + 1;
        }
        return acc;
      }, {} as Record<string, number>);

      const mostActiveUser = Object.entries(userActivityCount)
        .sort(([,a], [,b]) => b - a)[0]?.[0] || null;

      // Recent activity trend (last 7 days)
      const trendDays = Math.min(7, days);
      const trendData = [];
      for (let i = trendDays - 1; i >= 0; i--) {
        const date = moment().subtract(i, 'days').format('YYYY-MM-DD');
        const dayStart = moment(date).startOf('day').toDate();
        const dayEnd = moment(date).endOf('day').toDate();
        
        const dayCount = activities.filter(activity => 
          activity.createdAt >= dayStart && activity.createdAt <= dayEnd
        ).length;
        
        trendData.push({ date, count: dayCount });
      }

      return {
        totalActivities,
        activitiesByCategory,
        activitiesByImpact,
        mostActiveUser,
        recentActivityTrend: trendData,
      };
    } catch (error) {
      console.error('Failed to fetch activity statistics:', error);
      return {
        totalActivities: 0,
        activitiesByCategory: {},
        activitiesByImpact: {},
        mostActiveUser: null,
        recentActivityTrend: [],
      };
    }
  }

  /**
   * Clean up old activities (data retention policy)
   * Keeps activities for 90 days, with critical activities kept for 1 year
   */
  static async cleanupOldActivities(): Promise<{ deleted: number; criticalKept: number }> {
    try {
      const ninetyDaysAgo = new Date();
      ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
      
      const oneYearAgo = new Date();
      oneYearAgo.setDate(oneYearAgo.getDate() - 365);

      // Delete activities older than 90 days, except CRITICAL ones
      const deletedResult = await prisma.activity.deleteMany({
        where: {
          createdAt: { lt: ninetyDaysAgo },
          impact: { not: 'CRITICAL' }
        }
      });

      // Delete CRITICAL activities older than 1 year
      const criticalDeletedResult = await prisma.activity.deleteMany({
        where: {
          createdAt: { lt: oneYearAgo },
          impact: 'CRITICAL'
        }
      });

      const totalDeleted = deletedResult.count + criticalDeletedResult.count;

      // Count how many critical activities are being kept (between 90 days and 1 year)
      const criticalKeptResult = await prisma.activity.count({
        where: {
          createdAt: { 
            gte: oneYearAgo,
            lt: ninetyDaysAgo 
          },
          impact: 'CRITICAL'
        }
      });

      console.log(`🧹 Activity cleanup completed: ${totalDeleted} activities deleted, ${criticalKeptResult} critical activities kept`);

      return {
        deleted: totalDeleted,
        criticalKept: criticalKeptResult
      };
    } catch (error) {
      console.error('Failed to cleanup old activities:', error);
      return { deleted: 0, criticalKept: 0 };
    }
  }

  // Predefined activity templates for common actions
  static ActivityTemplates = {
    // Schedule Management
    SCHEDULE_GENERATED: (count: number, dateRange: string, algorithm: string, user?: string) => ({
      type: 'SCHEDULE_GENERATED',
      category: 'SCHEDULE' as const,
      title: 'Schedule Generated',
      description: `${count} new schedule${count !== 1 ? 's' : ''} generated for ${dateRange} using ${algorithm} algorithm`,
      performedBy: user || 'admin',
      resourceType: 'schedule',
      impact: count > 10 ? 'HIGH' : 'MEDIUM' as const,
    }),

    SCHEDULE_EDITED: (analystName: string, date: string, changes: string, user?: string) => ({
      type: 'SCHEDULE_EDITED',
      category: 'SCHEDULE' as const,
      title: 'Schedule Updated',
      description: `Manual schedule update for ${analystName} on ${date}: ${changes}`,
      performedBy: user || 'admin',
      resourceType: 'schedule',
      impact: 'MEDIUM' as const,
    }),

    SCHEDULE_EXPORTED: (format: string, dateRange: string, user?: string) => ({
      type: 'SCHEDULE_EXPORTED',
      category: 'SCHEDULE' as const,
      title: 'Schedule Exported',
      description: `Schedule exported to ${format} format for ${dateRange}`,
      performedBy: user || 'admin',
      resourceType: 'schedule',
      impact: 'LOW' as const,
    }),

    // Analyst Management
    ANALYST_ADDED: (analystName: string, shiftType: string, user?: string) => ({
      type: 'ANALYST_ADDED',
      category: 'ANALYST' as const,
      title: 'New Analyst Added',
      description: `Added new analyst: ${analystName} (${shiftType} shift)`,
      performedBy: user || 'admin',
      resourceType: 'analyst',
      impact: 'HIGH' as const,
    }),

    ANALYST_UPDATED: (analystName: string, changes: string, user?: string) => ({
      type: 'ANALYST_UPDATED',
      category: 'ANALYST' as const,
      title: 'Analyst Details Updated',
      description: `Updated details for ${analystName}: ${changes}`,
      performedBy: user || 'admin',
      resourceType: 'analyst',
      impact: 'MEDIUM' as const,
    }),

    ANALYST_ACTIVATED: (analystName: string, user?: string) => ({
      type: 'ANALYST_ACTIVATED',
      category: 'ANALYST' as const,
      title: 'Analyst Activated',
      description: `${analystName} has been activated and is now available for scheduling`,
      performedBy: user || 'admin',
      resourceType: 'analyst',
      impact: 'MEDIUM' as const,
    }),

    ANALYST_DEACTIVATED: (analystName: string, user?: string) => ({
      type: 'ANALYST_DEACTIVATED',
      category: 'ANALYST' as const,
      title: 'Analyst Deactivated',
      description: `${analystName} has been deactivated and removed from scheduling`,
      performedBy: user || 'admin',
      resourceType: 'analyst',
      impact: 'HIGH' as const,
    }),

    // Algorithm Management
    ALGORITHM_ADDED: (algorithmName: string, user?: string) => ({
      type: 'ALGORITHM_ADDED',
      category: 'ALGORITHM' as const,
      title: 'New Algorithm Added',
      description: `Added new scheduling algorithm: ${algorithmName}`,
      performedBy: user || 'admin',
      resourceType: 'algorithm',
      impact: 'HIGH' as const,
    }),

    ALGORITHM_UPDATED: (algorithmName: string, changes: string, user?: string) => ({
      type: 'ALGORITHM_UPDATED',
      category: 'ALGORITHM' as const,
      title: 'Algorithm Updated',
      description: `Updated ${algorithmName} configuration: ${changes}`,
      performedBy: user || 'admin',
      resourceType: 'algorithm',
      impact: 'MEDIUM' as const,
    }),

    ALGORITHM_ACTIVATED: (algorithmName: string, user?: string) => ({
      type: 'ALGORITHM_ACTIVATED',
      category: 'ALGORITHM' as const,
      title: 'Algorithm Activated',
      description: `${algorithmName} has been activated as the primary scheduling algorithm`,
      performedBy: user || 'admin',
      resourceType: 'algorithm',
      impact: 'HIGH' as const,
    }),

    // Absence Management
    ABSENCE_ADDED: (analystName: string, type: string, dateRange: string, user?: string) => ({
      type: 'ABSENCE_ADDED',
      category: 'ABSENCE' as const,
      title: 'Absence Recorded',
      description: `${type} absence recorded for ${analystName} from ${dateRange}`,
      performedBy: user || 'admin',
      resourceType: 'absence',
      impact: 'MEDIUM' as const,
    }),

    VACATION_APPROVED: (analystName: string, dateRange: string, user?: string) => ({
      type: 'VACATION_APPROVED',
      category: 'ABSENCE' as const,
      title: 'Vacation Approved',
      description: `Vacation request approved for ${analystName} from ${dateRange}`,
      performedBy: user || 'admin',
      resourceType: 'absence',
      impact: 'MEDIUM' as const,
    }),

    // System Operations
    SYSTEM_MAINTENANCE: (description: string, user?: string) => ({
      type: 'SYSTEM_MAINTENANCE',
      category: 'SYSTEM' as const,
      title: 'System Maintenance',
      description,
      performedBy: user || 'system',
      resourceType: 'system',
      impact: 'HIGH' as const,
    }),

    BULK_OPERATION: (operation: string, count: number, user?: string) => ({
      type: 'BULK_OPERATION',
      category: 'SYSTEM' as const,
      title: 'Bulk Operation',
      description: `${operation} performed on ${count} items`,
      performedBy: user || 'admin',
      resourceType: 'system',
      impact: count > 50 ? 'HIGH' : 'MEDIUM' as const,
    }),
  };
}

export const activityService = ActivityService;
