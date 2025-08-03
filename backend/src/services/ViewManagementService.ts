import { PrismaClient } from '../generated/prisma';
import { DateRange } from '../types/common';

export interface ViewContext {
  viewType: 'day' | 'week' | 'month';
  date: Date;
  dateRange: DateRange;
  recommendedLayers: string[];
  defaultZoomLevel: number;
}

export interface ViewData {
  viewType: string;
  dateRange: DateRange;
  events: any[];
  conflicts: any[];
  metadata: any;
}

export interface ViewPreferences {
  viewType: string;
  defaultLayers: string[];
  zoomLevel: number;
  showConflicts: boolean;
  showFairnessIndicators: boolean;
}

export class ViewManagementService {
  private prisma: PrismaClient;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  /**
   * Get view context for specific view type and date
   */
  async getViewContext(viewType: 'day' | 'week' | 'month', date: Date): Promise<ViewContext> {
    const dateRange = this.calculateDateRange(viewType, date);
    const recommendedLayers = this.getRecommendedLayers(viewType);
    const defaultZoomLevel = this.getDefaultZoomLevel(viewType);

    return {
      viewType,
      date,
      dateRange,
      recommendedLayers,
      defaultZoomLevel
    };
  }

  /**
   * Get optimized data for specific view type
   */
  async getViewData(viewType: string, dateRange: DateRange, layers: string[]): Promise<ViewData> {
    const { startDate, endDate } = dateRange;
    
    // Get all events for the date range
    const events = await this.getAllEventsForDateRange(startDate, endDate);
    
    // Get conflicts for the date range
    const conflicts = await this.getConflictsForDateRange(startDate, endDate);
    
    // Filter events based on enabled layers
    const filteredEvents = this.filterEventsByLayers(events, layers);
    
    // Get view-specific metadata
    const metadata = await this.getViewMetadata(viewType, startDate, endDate);

    return {
      viewType,
      dateRange,
      events: filteredEvents,
      conflicts,
      metadata
    };
  }

  /**
   * Save view preferences for a user
   */
  async saveViewPreferences(analystId: string, preferences: ViewPreferences): Promise<void> {
    await this.prisma.viewPreference.upsert({
      where: {
        analystId_viewType: {
          analystId,
          viewType: preferences.viewType
        }
      },
      update: {
        defaultLayers: preferences.defaultLayers,
        zoomLevel: preferences.zoomLevel,
        showConflicts: preferences.showConflicts,
        showFairnessIndicators: preferences.showFairnessIndicators,
        updatedAt: new Date()
      },
      create: {
        analystId,
        viewType: preferences.viewType,
        defaultLayers: preferences.defaultLayers,
        zoomLevel: preferences.zoomLevel,
        showConflicts: preferences.showConflicts,
        showFairnessIndicators: preferences.showFairnessIndicators
      }
    });
  }

  /**
   * Get recommended layers for specific view type
   */
  async getRecommendedLayers(viewType: string): Promise<string[]> {
    const recommendations = {
      day: ['base', 'constraints', 'vacations', 'events'],
      week: ['base', 'constraints', 'vacations', 'fairness'],
      month: ['base', 'vacations', 'events', 'fairness']
    };

    return recommendations[viewType as keyof typeof recommendations] || ['base'];
  }

  /**
   * Get user's view preferences
   */
  async getUserViewPreferences(analystId: string, viewType: string): Promise<ViewPreferences | null> {
    const preference = await this.prisma.viewPreference.findUnique({
      where: {
        analystId_viewType: {
          analystId,
          viewType
        }
      }
    });

    if (!preference) {
      return null;
    }

    return {
      viewType: preference.viewType,
      defaultLayers: preference.defaultLayers,
      zoomLevel: preference.zoomLevel,
      showConflicts: preference.showConflicts,
      showFairnessIndicators: preference.showFairnessIndicators
    };
  }

  /**
   * Get default view preferences for a view type
   */
  getDefaultViewPreferences(viewType: string): ViewPreferences {
    const defaultLayers = this.getRecommendedLayers(viewType);
    
    return {
      viewType,
      defaultLayers,
      zoomLevel: this.getDefaultZoomLevel(viewType),
      showConflicts: true,
      showFairnessIndicators: true
    };
  }

  // Private helper methods

  private calculateDateRange(viewType: string, date: Date): DateRange {
    const startDate = new Date(date);
    let endDate = new Date(date);

    switch (viewType) {
      case 'day':
        // Single day view
        break;
      case 'week':
        // Week view - start from Monday of the week
        const dayOfWeek = startDate.getDay();
        const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
        startDate.setDate(startDate.getDate() - daysToMonday);
        endDate.setDate(startDate.getDate() + 6);
        break;
      case 'month':
        // Month view - start from first day of month
        startDate.setDate(1);
        endDate = new Date(startDate.getFullYear(), startDate.getMonth() + 1, 0);
        break;
      default:
        throw new Error(`Unknown view type: ${viewType}`);
    }

    return { startDate, endDate };
  }

  private getDefaultZoomLevel(viewType: string): number {
    const zoomLevels = {
      day: 3,    // High detail for day view
      week: 2,   // Medium detail for week view
      month: 1   // Low detail for month view
    };

    return zoomLevels[viewType as keyof typeof zoomLevels] || 1;
  }

  private async getAllEventsForDateRange(startDate: Date, endDate: Date): Promise<any[]> {
    const events = [];

    // Get schedules
    const schedules = await this.prisma.schedule.findMany({
      where: {
        date: {
          gte: startDate,
          lte: endDate
        }
      },
      include: {
        analyst: true
      }
    });

    events.push(...schedules.map(schedule => ({
      id: schedule.id,
      title: `${schedule.analyst.name} - ${schedule.shiftType}`,
      startDate: schedule.date,
      endDate: schedule.date,
      analystId: schedule.analystId,
      shiftType: schedule.shiftType,
      type: 'shift',
      layer: 'base'
    })));

    // Get constraints
    const constraints = await this.prisma.schedulingConstraint.findMany({
      where: {
        startDate: { gte: startDate },
        endDate: { lte: endDate },
        isActive: true
      },
      include: {
        analyst: true
      }
    });

    events.push(...constraints.map(constraint => ({
      id: constraint.id,
      title: constraint.description || `${constraint.constraintType} Constraint`,
      startDate: constraint.startDate,
      endDate: constraint.endDate,
      analystId: constraint.analystId,
      constraintType: constraint.constraintType,
      type: 'constraint',
      layer: 'constraints'
    })));

    // Get vacations
    const vacations = await this.prisma.vacation.findMany({
      where: {
        startDate: { gte: startDate },
        endDate: { lte: endDate },
        isApproved: true
      },
      include: {
        analyst: true
      }
    });

    events.push(...vacations.map(vacation => ({
      id: vacation.id,
      title: `${vacation.analyst.name} - Vacation`,
      startDate: vacation.startDate,
      endDate: vacation.endDate,
      analystId: vacation.analystId,
      reason: vacation.reason,
      type: 'vacation',
      layer: 'vacations'
    })));

    // Get calendar events
    const calendarEvents = await this.prisma.calendarEvent.findMany({
      where: {
        startDate: { gte: startDate },
        endDate: { lte: endDate }
      }
    });

    events.push(...calendarEvents.map(event => ({
      id: event.id,
      title: event.title,
      startDate: event.startDate,
      endDate: event.endDate,
      eventType: event.eventType,
      description: event.description,
      type: 'event',
      layer: 'events'
    })));

    // Get fairness metrics
    const fairnessMetrics = await this.prisma.fairnessMetrics.findMany({
      where: {
        date: {
          gte: startDate,
          lte: endDate
        }
      }
    });

    events.push(...fairnessMetrics.map(metric => ({
      id: metric.id,
      title: `Fairness Score: ${metric.overallScore}`,
      startDate: metric.date,
      endDate: metric.date,
      overallScore: metric.overallScore,
      workloadFairness: metric.workloadFairness,
      weekendFairness: metric.weekendFairness,
      type: 'fairness',
      layer: 'fairness'
    })));

    return events;
  }

  private async getConflictsForDateRange(startDate: Date, endDate: Date): Promise<any[]> {
    const conflicts = [];

    // Get schedules and constraints for conflict detection
    const schedules = await this.prisma.schedule.findMany({
      where: {
        date: { gte: startDate, lte: endDate }
      }
    });

    const constraints = await this.prisma.schedulingConstraint.findMany({
      where: {
        startDate: { gte: startDate },
        endDate: { lte: endDate },
        isActive: true
      }
    });

    // Check for conflicts between schedules and constraints
    for (const schedule of schedules) {
      for (const constraint of constraints) {
        if (constraint.analystId && constraint.analystId === schedule.analystId) {
          if (schedule.date >= constraint.startDate && schedule.date <= constraint.endDate) {
            conflicts.push({
              id: `conflict-${schedule.id}-${constraint.id}`,
              type: 'schedule-constraint',
              scheduleId: schedule.id,
              constraintId: constraint.id,
              date: schedule.date,
              analystId: schedule.analystId,
              description: `Schedule conflicts with ${constraint.constraintType} constraint`
            });
          }
        }
      }
    }

    return conflicts;
  }

  private filterEventsByLayers(events: any[], layers: string[]): any[] {
    return events.filter(event => layers.includes(event.layer));
  }

  private async getViewMetadata(viewType: string, startDate: Date, endDate: Date): Promise<any> {
    const metadata: any = {
      viewType,
      dateRange: { startDate, endDate },
      totalEvents: 0,
      totalConflicts: 0,
      layerCount: 0
    };

    // Get event counts by type
    const schedules = await this.prisma.schedule.count({
      where: {
        date: { gte: startDate, lte: endDate }
      }
    });

    const constraints = await this.prisma.schedulingConstraint.count({
      where: {
        startDate: { gte: startDate },
        endDate: { lte: endDate },
        isActive: true
      }
    });

    const vacations = await this.prisma.vacation.count({
      where: {
        startDate: { gte: startDate },
        endDate: { lte: endDate },
        isApproved: true
      }
    });

    const events = await this.prisma.calendarEvent.count({
      where: {
        startDate: { gte: startDate },
        endDate: { lte: endDate }
      }
    });

    metadata.totalEvents = schedules + constraints + vacations + events;
    metadata.eventBreakdown = {
      schedules,
      constraints,
      vacations,
      events
    };

    return metadata;
  }
} 