import { PrismaClient } from '../generated/prisma';
import { DateRange } from '../types/common';

export interface CalendarLayer {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  opacity: number;
  color: string;
  orderIndex: number;
  dataType: 'shifts' | 'constraints' | 'vacations' | 'events' | 'fairness';
  icon?: string;
}

export interface LayerData {
  layerId: string;
  events: any[];
  conflicts: any[];
  metadata?: any;
}

export interface LayerPreferences {
  layerId: string;
  enabled?: boolean;
  opacity?: number;
  color?: string;
  orderIndex?: number;
}

export interface CalendarLayers {
  layers: CalendarLayer[];
  conflicts: any[];
}

export class CalendarLayerService {
  private prisma: PrismaClient;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  /**
   * Get all available calendar layers with user preferences
   */
  async getCalendarLayers(dateRange: DateRange, userId: string): Promise<CalendarLayers> {
    const defaultLayers = this.getDefaultLayers();
    const userPreferences = await this.getUserLayerPreferences(userId);
    
    // Merge default layers with user preferences
    const layers = defaultLayers.map(layer => {
      const preference = userPreferences.find(p => p.layerId === layer.id);
      return {
        ...layer,
        enabled: preference?.enabled ?? layer.enabled,
        opacity: preference?.opacity ?? layer.opacity,
        color: preference?.color ?? layer.color,
        orderIndex: preference?.orderIndex ?? layer.orderIndex
      };
    });

    // Get conflicts across all enabled layers
    const conflicts = await this.getLayerConflicts(dateRange, layers.filter(l => l.enabled).map(l => l.id));

    return {
      layers: layers.sort((a, b) => a.orderIndex - b.orderIndex),
      conflicts
    };
  }

  /**
   * Get data for specific layer within date range
   */
  async getLayerData(layerId: string, dateRange: DateRange): Promise<LayerData> {
    const { startDate, endDate } = dateRange;
    
    switch (layerId) {
      case 'base':
        return this.getBaseLayerData(startDate, endDate);
      case 'constraints':
        return this.getConstraintLayerData(startDate, endDate);
      case 'vacations':
        return this.getVacationLayerData(startDate, endDate);
      case 'events':
        return this.getEventLayerData(startDate, endDate);
      case 'fairness':
        return this.getFairnessLayerData(startDate, endDate);
      default:
        throw new Error(`Unknown layer ID: ${layerId}`);
    }
  }

  /**
   * Toggle layer visibility for a user
   */
  async toggleLayer(layerId: string, enabled: boolean, userId: string): Promise<void> {
    await this.prisma.calendarLayerPreference.upsert({
      where: {
        userId_layerId: {
          userId,
          layerId
        }
      },
      update: {
        enabled,
        updatedAt: new Date()
      },
      create: {
        userId,
        layerId,
        enabled
      }
    });
  }

  /**
   * Update layer preferences for a user
   */
  async updateLayerPreferences(userId: string, preferences: LayerPreferences): Promise<void> {
    await this.prisma.calendarLayerPreference.upsert({
      where: {
        userId_layerId: {
          userId,
          layerId: preferences.layerId
        }
      },
      update: {
        enabled: preferences.enabled,
        opacity: preferences.opacity,
        color: preferences.color,
        orderIndex: preferences.orderIndex,
        updatedAt: new Date()
      },
      create: {
        userId,
        layerId: preferences.layerId,
        enabled: preferences.enabled ?? true,
        opacity: preferences.opacity ?? 1.0,
        color: preferences.color ?? '#3B82F6',
        orderIndex: preferences.orderIndex ?? 0
      }
    });
  }

  /**
   * Get default layer preferences
   */
  async getDefaultLayerPreferences(): Promise<CalendarLayer[]> {
    return this.getDefaultLayers();
  }

  /**
   * Get conflicts across specified layers
   */
  async getLayerConflicts(layerId: string, dateRange: DateRange): Promise<any[]> {
    const { startDate, endDate } = dateRange;
    
    // Get conflicts for the specific layer
    const conflicts = await this.getLayerConflictsForDateRange(layerId, startDate, endDate);
    return conflicts;
  }

  /**
   * Reset layer preferences to defaults for a user
   */
  async resetLayerPreferences(userId: string): Promise<void> {
    await this.prisma.calendarLayerPreference.deleteMany({
      where: { userId }
    });
  }

  // Private helper methods

  private getDefaultLayers(): CalendarLayer[] {
    return [
      {
        id: 'base',
        name: 'Assigned Shifts',
        description: 'Core shift assignments and schedules',
        enabled: true,
        opacity: 1.0,
        color: '#3B82F6',
        orderIndex: 0,
        dataType: 'shifts',
        icon: '📅'
      },
      {
        id: 'constraints',
        name: 'Constraints',
        description: 'Blackout dates and scheduling restrictions',
        enabled: true,
        opacity: 0.8,
        color: '#EF4444',
        orderIndex: 1,
        dataType: 'constraints',
        icon: '🚫'
      },
      {
        id: 'vacations',
        name: 'Vacations',
        description: 'Approved time off and leave requests',
        enabled: true,
        opacity: 0.9,
        color: '#10B981',
        orderIndex: 2,
        dataType: 'vacations',
        icon: '🏖️'
      },
      {
        id: 'events',
        name: 'Special Events',
        description: 'Holidays, releases, and special coverage needs',
        enabled: true,
        opacity: 0.85,
        color: '#F59E0B',
        orderIndex: 3,
        dataType: 'events',
        icon: '🎉'
      },
      {
        id: 'fairness',
        name: 'Fairness Indicators',
        description: 'Color-coded fairness and workload indicators',
        enabled: true,
        opacity: 0.7,
        color: '#8B5CF6',
        orderIndex: 4,
        dataType: 'fairness',
        icon: '⚖️'
      }
    ];
  }

  private async getUserLayerPreferences(userId: string) {
    return this.prisma.calendarLayerPreference.findMany({
      where: { userId }
    });
  }

  private async getBaseLayerData(startDate: Date, endDate: Date): Promise<LayerData> {
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

    return {
      layerId: 'base',
      events: schedules.map(schedule => ({
        id: schedule.id,
        title: `${schedule.analyst.name} - ${schedule.shiftType}`,
        startDate: schedule.date,
        endDate: schedule.date,
        analystId: schedule.analystId,
        shiftType: schedule.shiftType,
        type: 'shift'
      })),
      conflicts: []
    };
  }

  private async getConstraintLayerData(startDate: Date, endDate: Date): Promise<LayerData> {
    const constraints = await this.prisma.schedulingConstraint.findMany({
      where: {
        startDate: {
          gte: startDate
        },
        endDate: {
          lte: endDate
        },
        isActive: true
      },
      include: {
        analyst: true
      }
    });

    return {
      layerId: 'constraints',
      events: constraints.map(constraint => ({
        id: constraint.id,
        title: constraint.description || `${constraint.constraintType} Constraint`,
        startDate: constraint.startDate,
        endDate: constraint.endDate,
        analystId: constraint.analystId,
        constraintType: constraint.constraintType,
        type: 'constraint'
      })),
      conflicts: []
    };
  }

  private async getVacationLayerData(startDate: Date, endDate: Date): Promise<LayerData> {
    const vacations = await this.prisma.vacation.findMany({
      where: {
        startDate: {
          gte: startDate
        },
        endDate: {
          lte: endDate
        },
        isApproved: true
      },
      include: {
        analyst: true
      }
    });

    return {
      layerId: 'vacations',
      events: vacations.map(vacation => ({
        id: vacation.id,
        title: `${vacation.analyst.name} - Vacation`,
        startDate: vacation.startDate,
        endDate: vacation.endDate,
        analystId: vacation.analystId,
        reason: vacation.reason,
        type: 'vacation'
      })),
      conflicts: []
    };
  }

  private async getEventLayerData(startDate: Date, endDate: Date): Promise<LayerData> {
    const events = await this.prisma.calendarEvent.findMany({
      where: {
        startDate: {
          gte: startDate
        },
        endDate: {
          lte: endDate
        }
      }
    });

    return {
      layerId: 'events',
      events: events.map(event => ({
        id: event.id,
        title: event.title,
        startDate: event.startDate,
        endDate: event.endDate,
        eventType: event.eventType,
        description: event.description,
        type: 'event'
      })),
      conflicts: []
    };
  }

  private async getFairnessLayerData(startDate: Date, endDate: Date): Promise<LayerData> {
    const fairnessMetrics = await this.prisma.fairnessMetrics.findMany({
      where: {
        date: {
          gte: startDate,
          lte: endDate
        }
      }
    });

    return {
      layerId: 'fairness',
      events: fairnessMetrics.map(metric => ({
        id: metric.id,
        title: `Fairness Score: ${metric.overallScore}`,
        startDate: metric.date,
        endDate: metric.date,
        overallScore: metric.overallScore,
        workloadFairness: metric.workloadFairness,
        weekendFairness: metric.weekendFairness,
        type: 'fairness'
      })),
      conflicts: []
    };
  }

  private async getLayerConflictsForDateRange(layerId: string, startDate: Date, endDate: Date): Promise<any[]> {
    // This is a simplified conflict detection - in a real implementation,
    // you would have more sophisticated conflict detection logic
    const conflicts = [];
    
    // Example: Check for overlapping shifts and constraints
    if (layerId === 'base' || layerId === 'constraints') {
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
    }

    return conflicts;
  }
} 