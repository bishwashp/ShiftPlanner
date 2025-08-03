import { prisma } from '../lib/prisma';
import { EventConstraint, eventConstraintGenerator } from './EventConstraintGenerator';
import { SchedulingConstraint, CalendarEvent, Analyst } from '../../generated/prisma';

export interface ResolvedConstraint {
  source: 'EVENT' | 'GLOBAL' | 'ANALYST';
  priority: number;
  constraint: any;
  description: string;
  canOverride: boolean;
}

export interface ConstraintResolutionContext {
  date: Date;
  shiftType?: 'MORNING' | 'EVENING' | 'WEEKEND';
  analystId?: string;
  isScreenerAssignment?: boolean;
}

export class ConstraintHierarchy {
  
  /**
   * Resolve all constraints for a given date and context
   * Priority order (highest to lowest):
   * 1. Event-specific overrides (user-defined)
   * 2. Event-type defaults (MAJOR_RELEASE > MINOR_RELEASE > HOLIDAY)
   * 3. Global scheduling constraints
   * 4. Individual analyst preferences
   */
  async resolveConstraints(context: ConstraintResolutionContext): Promise<ResolvedConstraint[]> {
    const eventConstraints = await this.getEventConstraints(context.date);
    const globalConstraints = await this.getGlobalConstraints(context.date);
    const analystConstraints = await this.getAnalystConstraints(context.date, context.analystId);
    
    return this.mergeByPriority([
      ...eventConstraints,
      ...globalConstraints,
      ...analystConstraints
    ]);
  }

  /**
   * Get event-based constraints for a specific date
   */
  private async getEventConstraints(date: Date): Promise<ResolvedConstraint[]> {
    const events = await this.getEventsForDate(date);
    
    if (events.length === 0) {
      return [];
    }

    const eventConstraints = eventConstraintGenerator.generateEventConstraints(events);
    
    return eventConstraints.map(constraint => ({
      source: 'EVENT' as const,
      priority: constraint.priority,
      constraint: constraint.constraints,
      description: `Event: ${constraint.eventTitle}`,
      canOverride: constraint.constraints.informational || false
    }));
  }

  /**
   * Get global scheduling constraints for a specific date
   */
  private async getGlobalConstraints(date: Date): Promise<ResolvedConstraint[]> {
    const globalConstraints = await prisma.schedulingConstraint.findMany({
      where: {
        analystId: null, // Global constraints
        isActive: true,
        startDate: { lte: date },
        endDate: { gte: date }
      }
    });

    return globalConstraints.map((constraint, index) => ({
      source: 'GLOBAL' as const,
      priority: 100 + index, // Lower priority than events
      constraint: {
        type: constraint.constraintType,
        description: constraint.description
      },
      description: `Global: ${constraint.description || constraint.constraintType}`,
      canOverride: false
    }));
  }

  /**
   * Get analyst-specific constraints and preferences
   */
  private async getAnalystConstraints(date: Date, analystId?: string): Promise<ResolvedConstraint[]> {
    if (!analystId) return [];

    const analystConstraints = await prisma.schedulingConstraint.findMany({
      where: {
        analystId,
        isActive: true,
        startDate: { lte: date },
        endDate: { gte: date }
      }
    });

    return analystConstraints.map((constraint, index) => ({
      source: 'ANALYST' as const,
      priority: 200 + index, // Lowest priority
      constraint: {
        type: constraint.constraintType,
        description: constraint.description
      },
      description: `Analyst: ${constraint.description || constraint.constraintType}`,
      canOverride: true
    }));
  }

  /**
   * Get calendar events for a specific date
   */
  private async getEventsForDate(date: Date): Promise<CalendarEvent[]> {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    return await prisma.calendarEvent.findMany({
      where: {
        startDate: { lte: endOfDay },
        endDate: { gte: startOfDay }
      },
      orderBy: {
        eventType: 'asc' // MAJOR_RELEASE first, HOLIDAY last
      }
    });
  }

  /**
   * Merge constraints by priority and resolve conflicts
   */
  private mergeByPriority(constraints: ResolvedConstraint[]): ResolvedConstraint[] {
    // Sort by priority (lower number = higher priority)
    const sorted = constraints.sort((a, b) => a.priority - b.priority);
    
    // Remove duplicates and conflicts
    const resolved: ResolvedConstraint[] = [];
    const seenTypes = new Set<string>();
    
    for (const constraint of sorted) {
      const constraintKey = this.getConstraintKey(constraint);
      
      if (!seenTypes.has(constraintKey)) {
        resolved.push(constraint);
        seenTypes.add(constraintKey);
      }
      // Higher priority constraint already exists, skip this one
    }
    
    return resolved;
  }

  /**
   * Generate a unique key for constraint deduplication
   */
  private getConstraintKey(constraint: ResolvedConstraint): string {
    if (constraint.source === 'EVENT') {
      return `event_${constraint.description}`;
    }
    return `${constraint.source}_${constraint.constraint.type || 'general'}`;
  }

  /**
   * Check if constraints are satisfied for a given assignment
   */
  async validateAssignment(
    context: ConstraintResolutionContext,
    assignment: {
      analystId: string;
      shiftType: 'MORNING' | 'EVENING' | 'WEEKEND';
      isScreener: boolean;
    }
  ): Promise<{ valid: boolean; violations: string[] }> {
    const constraints = await this.resolveConstraints(context);
    const violations: string[] = [];

    const analyst = await prisma.analyst.findUnique({
      where: { id: assignment.analystId },
      include: {
        schedules: {
          where: {
            date: context.date
          }
        }
      }
    });

    if (!analyst) {
      violations.push('Analyst not found');
      return { valid: false, violations };
    }

    for (const constraint of constraints) {
      if (constraint.source === 'EVENT') {
        const eventViolations = await this.validateEventConstraint(
          constraint,
          assignment,
          analyst,
          context
        );
        violations.push(...eventViolations);
      }
    }

    return {
      valid: violations.length === 0,
      violations
    };
  }

  /**
   * Validate assignment against event constraints
   */
  private async validateEventConstraint(
    constraint: ResolvedConstraint,
    assignment: { analystId: string; shiftType: string; isScreener: boolean },
    analyst: Analyst,
    context: ConstraintResolutionContext
  ): Promise<string[]> {
    const violations: string[] = [];
    const eventConstraint = constraint.constraint;

    if (eventConstraint.noAdditionalConstraints || eventConstraint.informational) {
      return []; // No violations for informational constraints
    }

    if (eventConstraint.minimumCoverage) {
      const coverage = eventConstraint.minimumCoverage;
      
      // Check if analyst meets minimum coverage requirements
      if (coverage.employeeType && analyst.employeeType !== coverage.employeeType) {
        violations.push(
          `Event requires ${coverage.employeeType} employee, but ${analyst.name} is ${analyst.employeeType}`
        );
      }
      
      if (coverage.experienceLevel) {
        const requiredLevels = ['JUNIOR', 'MID_LEVEL', 'SENIOR', 'EXPERT'];
        const analystLevel = requiredLevels.indexOf(analyst.experienceLevel);
        const requiredLevel = requiredLevels.indexOf(coverage.experienceLevel);
        
        if (analystLevel < requiredLevel) {
          violations.push(
            `Event requires ${coverage.experienceLevel}+ experience, but ${analyst.name} is ${analyst.experienceLevel}`
          );
        }
      }

      // Handle OR conditions
      if (coverage.or) {
        const meetsAnyRequirement = coverage.or.some((req: any) => {
          let meets = true;
          if (req.employeeType && analyst.employeeType !== req.employeeType) {
            meets = false;
          }
          if (req.experienceLevel) {
            const requiredLevels = ['JUNIOR', 'MID_LEVEL', 'SENIOR', 'EXPERT'];
            const analystLevel = requiredLevels.indexOf(analyst.experienceLevel);
            const requiredLevel = requiredLevels.indexOf(req.experienceLevel);
            if (analystLevel < requiredLevel) {
              meets = false;
            }
          }
          return meets;
        });

        if (!meetsAnyRequirement) {
          violations.push(
            `Event coverage requirements not met by ${analyst.name}`
          );
        }
      }
    }

    return violations;
  }

  /**
   * Get constraint recommendations for schedule optimization
   */
  async getConstraintRecommendations(
    dateRange: { start: Date; end: Date }
  ): Promise<{
    criticalDates: Date[];
    recommendedActions: string[];
    coverageGaps: Array<{
      date: Date;
      eventTitle: string;
      missingRequirements: string[];
    }>;
  }> {
    const criticalDates: Date[] = [];
    const recommendedActions: string[] = [];
    const coverageGaps: Array<{
      date: Date;
      eventTitle: string;
      missingRequirements: string[];
    }> = [];

    // Get all events in date range
    const events = await prisma.calendarEvent.findMany({
      where: {
        startDate: { lte: dateRange.end },
        endDate: { gte: dateRange.start }
      }
    });

    for (const event of events) {
      if (event.eventType === 'MAJOR_RELEASE' || event.eventType === 'MINOR_RELEASE') {
        const eventDate = new Date(event.startDate);
        criticalDates.push(eventDate);

        // Check if we have adequate coverage
        const constraints = eventConstraintGenerator.generateDefaultConstraints(event.eventType);
        if (constraints.minimumCoverage) {
          coverageGaps.push({
            date: eventDate,
            eventTitle: event.title,
            missingRequirements: [`Needs ${JSON.stringify(constraints.minimumCoverage)}`]
          });
        }
      }
    }

    if (criticalDates.length > 0) {
      recommendedActions.push(
        `Review coverage for ${criticalDates.length} critical event(s)`
      );
    }

    return {
      criticalDates,
      recommendedActions,
      coverageGaps
    };
  }
}

// Export singleton instance
export const constraintHierarchy = new ConstraintHierarchy();