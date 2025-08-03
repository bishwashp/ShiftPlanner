import { SchedulingConstraint, Analyst, Schedule } from '../../generated/prisma';
import { prisma } from '../lib/prisma';
import { ConstraintEngine } from './scheduling/algorithms/ConstraintEngine';
import { IntelligentScheduler } from './IntelligentScheduler';
import { AlgorithmRegistry } from './scheduling/AlgorithmRegistry';

export interface ConstraintChange {
  type: 'CREATE' | 'UPDATE' | 'DELETE';
  constraint: Partial<SchedulingConstraint>;
  originalConstraint?: SchedulingConstraint;
}

export interface ScheduleImpact {
  affectedDates: Date[];
  affectedAnalysts: string[];
  scheduleChanges: {
    before: Schedule[];
    after: Schedule[];
    conflicts: {
      date: Date;
      message: string;
      severity: 'HIGH' | 'MEDIUM' | 'LOW';
      analystId?: string;
    }[];
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
  recommendations: string[];
}

export interface ImpactSimulationRequest {
  constraintChange: ConstraintChange;
  dateRange: {
    startDate: Date;
    endDate: Date;
  };
  algorithmConfig?: any;
  includeReschedule?: boolean;
}

export class ConstraintImpactSimulator {
  private constraintEngine: ConstraintEngine;
  private scheduler: IntelligentScheduler;

  constructor() {
    this.constraintEngine = new ConstraintEngine();
    this.scheduler = new IntelligentScheduler(prisma);
  }

  /**
   * Simulate the impact of constraint changes on existing schedules
   */
  async simulateConstraintImpact(request: ImpactSimulationRequest): Promise<ScheduleImpact> {
    const { constraintChange, dateRange, algorithmConfig, includeReschedule = false } = request;
    
    // Get current state
    const currentSchedules = await this.getCurrentSchedules(dateRange);
    const currentConstraints = await this.getCurrentConstraints(dateRange);
    const analysts = await this.getActiveAnalysts();

    // Simulate new constraint state
    const newConstraints = this.applyConstraintChange(currentConstraints, constraintChange);
    
    // Analyze immediate impact without rescheduling
    const immediateImpact = await this.analyzeImmediateImpact(
      currentSchedules,
      currentConstraints,
      newConstraints,
      analysts
    );

    // If rescheduling is requested, simulate optimal schedule with new constraints
    let rescheduleImpact = null;
    if (includeReschedule) {
      rescheduleImpact = await this.simulateReschedule(
        dateRange,
        newConstraints,
        analysts,
        algorithmConfig
      );
    }

    return this.buildImpactReport(
      currentSchedules,
      immediateImpact,
      rescheduleImpact,
      analysts
    );
  }

  /**
   * Get current schedules in the date range
   */
  private async getCurrentSchedules(dateRange: { startDate: Date; endDate: Date }): Promise<Schedule[]> {
    return await prisma.schedule.findMany({
      where: {
        date: {
          gte: dateRange.startDate,
          lte: dateRange.endDate
        }
      },
      include: {
        analyst: true
      },
      orderBy: { date: 'asc' }
    });
  }

  /**
   * Get current constraints in the date range
   */
  private async getCurrentConstraints(dateRange: { startDate: Date; endDate: Date }): Promise<SchedulingConstraint[]> {
    return await prisma.schedulingConstraint.findMany({
      where: {
        isActive: true,
        OR: [
          {
            startDate: { lte: dateRange.endDate },
            endDate: { gte: dateRange.startDate }
          }
        ]
      },
      include: {
        analyst: true
      }
    });
  }

  /**
   * Get active analysts
   */
  private async getActiveAnalysts(): Promise<Analyst[]> {
    return await prisma.analyst.findMany({
      where: { isActive: true },
      include: {
        vacations: {
          where: { isApproved: true }
        },
        constraints: {
          where: { isActive: true }
        }
      }
    });
  }

  /**
   * Apply constraint change to current constraint set
   */
  private applyConstraintChange(
    currentConstraints: SchedulingConstraint[],
    constraintChange: ConstraintChange
  ): SchedulingConstraint[] {
    const newConstraints = [...currentConstraints];

    switch (constraintChange.type) {
      case 'CREATE':
        if (constraintChange.constraint.id) {
          newConstraints.push(constraintChange.constraint as SchedulingConstraint);
        }
        break;
      
      case 'UPDATE':
        const updateIndex = newConstraints.findIndex(c => c.id === constraintChange.constraint.id);
        if (updateIndex !== -1 && constraintChange.constraint.id) {
          newConstraints[updateIndex] = { ...newConstraints[updateIndex], ...constraintChange.constraint } as SchedulingConstraint;
        }
        break;
      
      case 'DELETE':
        const deleteIndex = newConstraints.findIndex(c => c.id === constraintChange.constraint.id);
        if (deleteIndex !== -1) {
          newConstraints.splice(deleteIndex, 1);
        }
        break;
    }

    return newConstraints;
  }

  /**
   * Analyze immediate impact without rescheduling
   */
  private async analyzeImmediateImpact(
    currentSchedules: Schedule[],
    currentConstraints: SchedulingConstraint[],
    newConstraints: SchedulingConstraint[],
    analysts: Analyst[]
  ) {
    // Validate current schedules against new constraints
    const proposedSchedules = currentSchedules.map(schedule => ({
      analystId: schedule.analystId,
      analystName: (schedule as any).analyst?.name || 'Unknown',
      date: schedule.date.toISOString().split('T')[0],
      shiftType: schedule.shiftType as 'MORNING' | 'EVENING' | 'WEEKEND',
      isScreener: schedule.isScreener,
      type: 'NEW_SCHEDULE' as const
    }));

    const beforeValidation = this.constraintEngine.validateConstraints(proposedSchedules, currentConstraints);
    const afterValidation = this.constraintEngine.validateConstraints(proposedSchedules, newConstraints);

    // Identify newly introduced violations
    const newViolations = afterValidation.violations.filter(violation => 
      !beforeValidation.violations.some(beforeViolation => 
        beforeViolation.description === violation.description &&
        beforeViolation.type === violation.type
      )
    );

    // Identify resolved violations
    const resolvedViolations = beforeValidation.violations.filter(violation => 
      !afterValidation.violations.some(afterViolation => 
        afterViolation.description === violation.description &&
        afterViolation.type === violation.type
      )
    );

    return {
      beforeValidation,
      afterValidation,
      newViolations,
      resolvedViolations
    };
  }

  /**
   * Simulate rescheduling with new constraints
   */
  private async simulateReschedule(
    dateRange: { startDate: Date; endDate: Date },
    newConstraints: SchedulingConstraint[],
    analysts: Analyst[],
    algorithmConfig?: any
  ) {
    try {
      // Use genetic algorithm for simulation
      const algorithm = AlgorithmRegistry.getAlgorithm('GENETIC');
      if (!algorithm) {
        throw new Error('Genetic algorithm not available for simulation');
      }

      // Get existing schedules for reference
      const existingSchedules = await this.getCurrentSchedules(dateRange);

      // Generate new schedule with updated constraints
      const result = await algorithm.generateSchedules({
        startDate: dateRange.startDate,
        endDate: dateRange.endDate,
        analysts,
        existingSchedules,
        globalConstraints: newConstraints,
        algorithmConfig: algorithmConfig || {}
      });

      return result;
    } catch (error) {
      console.error('Error in reschedule simulation:', error);
      return null;
    }
  }

  /**
   * Build comprehensive impact report
   */
  private buildImpactReport(
    currentSchedules: Schedule[],
    immediateImpact: any,
    rescheduleImpact: any,
    analysts: Analyst[]
  ): ScheduleImpact {
    const affectedDates = new Set<string>();
    const affectedAnalysts = new Set<string>();
    const conflicts: any[] = [];
    const recommendations: string[] = [];

    // Process immediate impact violations
    immediateImpact.newViolations.forEach((violation: any) => {
      if (violation.details?.date) {
        affectedDates.add(violation.details.date.toISOString().split('T')[0]);
      }
      if (violation.details?.analystId) {
        affectedAnalysts.add(violation.details.analystId);
      }
      
      conflicts.push({
        date: violation.details?.date || new Date(),
        message: violation.description,
        severity: violation.type === 'HARD' ? 'HIGH' : 'MEDIUM',
        analystId: violation.details?.analystId
      });
    });

    // Generate recommendations
    if (immediateImpact.newViolations.length > 0) {
      recommendations.push(`${immediateImpact.newViolations.length} new constraint violations introduced`);
      
      const hardViolations = immediateImpact.newViolations.filter((v: any) => v.type === 'HARD');
      if (hardViolations.length > 0) {
        recommendations.push(`⚠️  ${hardViolations.length} hard constraint violations require immediate attention`);
        recommendations.push(`Consider rescheduling affected periods to resolve violations`);
      }
    }

    if (immediateImpact.resolvedViolations.length > 0) {
      recommendations.push(`✅ ${immediateImpact.resolvedViolations.length} existing violations will be resolved`);
    }

    // Calculate fairness impact (simplified)
    const fairnessImpact = {
      before: immediateImpact.beforeValidation.score,
      after: immediateImpact.afterValidation.score,
      change: immediateImpact.afterValidation.score - immediateImpact.beforeValidation.score
    };

    // Calculate coverage impact
    const coverageImpact = {
      gapsIntroduced: immediateImpact.newViolations.filter((v: any) => v.type === 'COVERAGE_GAP').length,
      gapsResolved: immediateImpact.resolvedViolations.filter((v: any) => v.type === 'COVERAGE_GAP').length,
      netCoverageChange: 0
    };
    coverageImpact.netCoverageChange = coverageImpact.gapsResolved - coverageImpact.gapsIntroduced;

    return {
      affectedDates: Array.from(affectedDates).map(date => new Date(date)),
      affectedAnalysts: Array.from(affectedAnalysts),
      scheduleChanges: {
        before: currentSchedules,
        after: rescheduleImpact?.schedules || currentSchedules,
        conflicts
      },
      fairnessImpact,
      coverageImpact,
      recommendations
    };
  }

  /**
   * Quick impact preview for real-time feedback
   */
  async getQuickImpactPreview(constraintChange: ConstraintChange): Promise<{
    estimatedImpact: 'LOW' | 'MEDIUM' | 'HIGH';
    affectedDaysCount: number;
    estimatedConflicts: number;
    message: string;
  }> {
    const { constraint } = constraintChange;
    
    if (!constraint.startDate || !constraint.endDate) {
      return {
        estimatedImpact: 'LOW',
        affectedDaysCount: 0,
        estimatedConflicts: 0,
        message: 'Invalid date range'
      };
    }

    const startDate = new Date(constraint.startDate);
    const endDate = new Date(constraint.endDate);
    const affectedDaysCount = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;

    // Get existing schedules in the affected range
    const existingSchedules = await prisma.schedule.findMany({
      where: {
        date: { gte: startDate, lte: endDate },
        ...(constraint.analystId && { analystId: constraint.analystId })
      }
    });

    let estimatedConflicts = 0;
    let estimatedImpact: 'LOW' | 'MEDIUM' | 'HIGH' = 'LOW';
    let message = '';

    // Estimate impact based on constraint type and existing schedules
    switch (constraint.constraintType) {
      case 'BLACKOUT_DATE':
        estimatedConflicts = existingSchedules.length;
        estimatedImpact = estimatedConflicts > 5 ? 'HIGH' : estimatedConflicts > 2 ? 'MEDIUM' : 'LOW';
        message = `Blackout will affect ${existingSchedules.length} existing assignments`;
        break;
      
      case 'UNAVAILABLE_SCREENER':
        const screenerSchedules = existingSchedules.filter(s => s.isScreener);
        estimatedConflicts = screenerSchedules.length;
        estimatedImpact = estimatedConflicts > 0 ? 'HIGH' : 'LOW';
        message = `Will affect ${screenerSchedules.length} screener assignments`;
        break;
      
      default:
        estimatedImpact = affectedDaysCount > 7 ? 'MEDIUM' : 'LOW';
        message = `Constraint will affect ${affectedDaysCount} days`;
    }

    return {
      estimatedImpact,
      affectedDaysCount,
      estimatedConflicts,
      message
    };
  }
}

export const constraintImpactSimulator = new ConstraintImpactSimulator();