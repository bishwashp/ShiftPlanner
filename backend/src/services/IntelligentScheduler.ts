import { PrismaClient } from '@prisma/client';
import moment from 'moment-timezone';
import HolidayService from './HolidayService';
import AbsenceService from './AbsenceService';

export interface AssignmentStrategy {
  id: string;
  name: string;
  priority: number;
  conditions: {
    workWeightThreshold?: number;
    dayOfWeek?: string[];
    analystAvailability?: boolean;
  };
  logic: 'ROUND_ROBIN' | 'EXPERIENCE_BASED' | 'WORKLOAD_BALANCE' | 'HOLIDAY_COVERAGE';
}

export interface AssignmentReason {
  primaryReason: string;
  secondaryFactors: string[];
  workWeight: number;
  computationCost: 'LOW' | 'MEDIUM' | 'HIGH';
}

export interface ProposedAssignment {
  date: string;
  shiftType: 'MORNING' | 'EVENING' | 'WEEKEND';
  analystId: string;
  analystName: string;
  reason: AssignmentReason;
  strategy: string;
}

export interface ConflictResolution {
  priority: 'critical' | 'warning' | 'info';
  autoFixable: boolean;
  suggestedAssignments: ProposedAssignment[];
  summary: {
    totalConflicts: number;
    criticalConflicts: number;
    assignmentsNeeded: number;
    estimatedTime: string;
  };
}

export class IntelligentScheduler {
  private prisma: PrismaClient;
  private holidayService: HolidayService;
  private absenceService: AbsenceService;
  private shiftDefinitions: any;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
    this.holidayService = new HolidayService(prisma);
    this.absenceService = new AbsenceService(prisma);
    this.shiftDefinitions = {
      MORNING: { startHour: 9, endHour: 18, tz: 'America/Chicago' },
      EVENING: { startHour: 9, endHour: 18, tz: 'America/Los_Angeles' },
      WEEKEND: { startHour: 9, endHour: 18, tz: 'America/Los_Angeles' },
    };
  }

  /**
   * Main method to resolve conflicts intelligently
   */
  async resolveConflicts(
    conflicts: Array<{ date: string; missingShifts: string[]; severity: string }>,
    startDate: string,
    endDate: string
  ): Promise<ConflictResolution> {
    const startTime = Date.now();
    
    // Get all available analysts
    const analysts = await this.prisma.analyst.findMany({
      where: { isActive: true },
      include: {
        schedules: {
          where: {
            date: {
              gte: new Date(startDate),
              lte: new Date(endDate)
            }
          }
        }
      }
    });

    console.log(`👥 Found ${analysts.length} active analysts for conflict resolution`);
    console.log('📅 Date range:', startDate, 'to', endDate);

    const proposedAssignments: ProposedAssignment[] = [];
    let criticalConflicts = 0;

    for (const conflict of conflicts) {
      if (conflict.severity === 'critical') {
        criticalConflicts++;
      }

      for (const shiftType of conflict.missingShifts) {
        console.log(`🔧 Attempting to assign ${shiftType} shift for ${conflict.date}`);
        const assignment = await this.assignAnalyst(
          conflict.date,
          shiftType as 'MORNING' | 'EVENING' | 'WEEKEND',
          analysts,
          startDate,
          endDate
        );
        
        if (assignment) {
          console.log(`✅ Successfully assigned analyst ${assignment.analystId} for ${shiftType} on ${conflict.date}`);
          proposedAssignments.push(assignment);
        } else {
          console.log(`❌ No suitable analyst found for ${shiftType} shift on ${conflict.date}`);
        }
      }
    }

    const endTime = Date.now();
    const computationTime = endTime - startTime;

    return {
      priority: criticalConflicts > 0 ? 'critical' : 'warning',
      autoFixable: true,
      suggestedAssignments: proposedAssignments,
      summary: {
        totalConflicts: conflicts.length,
        criticalConflicts,
        assignmentsNeeded: proposedAssignments.length,
        estimatedTime: `${computationTime}ms`
      }
    };
  }

  /**
   * Core assignment logic with strategy selection
   */
  private async assignAnalyst(
    date: string,
    shiftType: 'MORNING' | 'EVENING' | 'WEEKEND',
    analysts: any[],
    startDate: string,
    endDate: string
  ): Promise<ProposedAssignment | null> {
    const strategy = await this.getAssignmentStrategy(date, shiftType);
    const availableAnalysts = await this.getAvailableAnalysts(date, shiftType);
    
    console.log(`🔍 Assignment strategy for ${date} ${shiftType}:`, strategy.logic);
    console.log(`👥 Available analysts: ${availableAnalysts.length}/${analysts.length}`);
    
    if (availableAnalysts.length === 0) {
      console.log(`❌ No available analysts for ${shiftType} on ${date}`);
      return null;
    }

    let selectedAnalyst: any;
    let reason: AssignmentReason;

    switch (strategy.logic) {
      case 'HOLIDAY_COVERAGE':
        selectedAnalyst = this.assignHolidayCoverage(date, shiftType, availableAnalysts);
        reason = {
          primaryReason: 'Holiday coverage - experienced analyst',
          secondaryFactors: ['High work weight day', 'Requires reliable coverage'],
          workWeight: 2.0,
          computationCost: 'LOW'
        };
        break;

      case 'WORKLOAD_BALANCE':
        selectedAnalyst = this.assignWorkloadBalance(date, shiftType, availableAnalysts, startDate, endDate);
        reason = {
          primaryReason: 'Workload balance - equitable distribution',
          secondaryFactors: ['Analyst has lighter week', 'Maintains fair rotation'],
          workWeight: 1.5,
          computationCost: 'MEDIUM'
        };
        break;

      case 'EXPERIENCE_BASED':
        selectedAnalyst = this.assignExperienceBased(date, shiftType, availableAnalysts);
        reason = {
          primaryReason: 'Experience-based assignment',
          secondaryFactors: ['Analyst has relevant experience', 'Complex shift requirements'],
          workWeight: 1.8,
          computationCost: 'LOW'
        };
        break;

      case 'ROUND_ROBIN':
      default:
        selectedAnalyst = this.assignRoundRobin(date, shiftType, availableAnalysts);
        reason = {
          primaryReason: 'Round-robin rotation',
          secondaryFactors: ['Next in sequence', 'Fair distribution'],
          workWeight: 1.0,
          computationCost: 'LOW'
        };
        break;
    }
    
    const shiftDef = this.shiftDefinitions[shiftType];
    const shiftDate = moment.tz(date, shiftDef.tz).hour(shiftDef.startHour).minute(0).second(0).utc().format();

    return {
      date: shiftDate,
      shiftType,
      analystId: selectedAnalyst.id,
      analystName: selectedAnalyst.name,
      reason,
      strategy: strategy.name
    };
  }

  /**
   * Determine which assignment strategy to use
   */
  private async getAssignmentStrategy(date: string, shiftType: 'MORNING' | 'EVENING' | 'WEEKEND'): Promise<AssignmentStrategy> {
    const dayOfWeek = moment(date).day();
    const isHoliday = await this.isHoliday(date);
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

    if (isHoliday) {
      return {
        id: 'holiday-coverage',
        name: 'Holiday Coverage',
        priority: 1,
        conditions: { workWeightThreshold: 2.0 },
        logic: 'HOLIDAY_COVERAGE'
      };
    }

    if (isWeekend) {
      return {
        id: 'weekend-coverage',
        name: 'Weekend Coverage',
        priority: 2,
        conditions: { workWeightThreshold: 1.5 },
        logic: 'EXPERIENCE_BASED'
      };
    }

    return {
      id: 'round-robin',
      name: 'Round Robin',
      priority: 3,
      conditions: {},
      logic: 'ROUND_ROBIN'
    };
  }

  /**
   * Get analysts available for a specific date and shift
   */
  private getAvailableAnalysts(date: string, shiftType: 'MORNING' | 'EVENING' | 'WEEKEND', analysts: any[]): any[] {
    return analysts.filter(analyst => {
      // Check if analyst is assigned to this shift type
      if (analyst.shiftType !== shiftType) {
        return false;
      }

      // Check if analyst is already scheduled for this date
      const hasSchedule = analyst.schedules.some((schedule: any) => {
        const scheduleDate = schedule.date.toISOString().split('T')[0];
        return scheduleDate === date;
      });

      return !hasSchedule;
    });
  }

  /**
   * Round-robin assignment strategy
   */
  private assignRoundRobin(date: string, shiftType: 'MORNING' | 'EVENING' | 'WEEKEND', analysts: any[]): any {
    // Simple round-robin: select the first available analyst
    return analysts[0];
  }

  /**
   * Holiday coverage assignment strategy
   */
  private assignHolidayCoverage(date: string, shiftType: 'MORNING' | 'EVENING' | 'WEEKEND', analysts: any[]): any {
    // For holidays, prefer analysts with more experience (created earlier)
    return analysts.sort((a: any, b: any) => 
      new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    )[0];
  }

  /**
   * Workload balance assignment strategy
   */
  private assignWorkloadBalance(
    date: string, 
    shiftType: 'MORNING' | 'EVENING' | 'WEEKEND', 
    analysts: any[],
    startDate: string,
    endDate: string
  ): any {
    // For now, use round-robin as fallback
    // TODO: Implement actual workload calculation
    return analysts[0];
  }

  /**
   * Experience-based assignment strategy
   */
  private assignExperienceBased(date: string, shiftType: 'MORNING' | 'EVENING' | 'WEEKEND', analysts: any[]): any {
    // Prefer analysts with more experience (created earlier)
    return analysts.sort((a: any, b: any) => 
      new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    )[0];
  }

  /**
   * Check if a date is a holiday
   */
  private async isHoliday(date: string, timezone: string = 'America/New_York'): Promise<boolean> {
    return await this.holidayService.isHoliday(date, timezone);
  }

  /**
   * Check if an analyst is absent on a specific date
   */
  private async isAnalystAbsent(analystId: string, date: string): Promise<boolean> {
    return await this.absenceService.isAnalystAbsent(analystId, date);
  }

  /**
   * Get available analysts for a specific date (excluding absent ones)
   */
  private async getAvailableAnalysts(date: string, shiftType: 'MORNING' | 'EVENING' | 'WEEKEND'): Promise<any[]> {
    // Get all active analysts for the shift type
    const allAnalysts = await this.prisma.analyst.findMany({
      where: {
        isActive: true,
        shiftType: shiftType
      }
    });

    // Filter out absent analysts
    const availableAnalysts = [];
    for (const analyst of allAnalysts) {
      const isAbsent = await this.isAnalystAbsent(analyst.id, date);
      if (!isAbsent) {
        availableAnalysts.push(analyst);
      }
    }

    return availableAnalysts;
  }

  /**
   * Legacy method for backward compatibility - filters analysts by availability
   */
  private filterAvailableAnalysts(date: string, shiftType: 'MORNING' | 'EVENING' | 'WEEKEND', analysts: any[]): any[] {
    // This method is kept for backward compatibility but should be replaced
    // with the async getAvailableAnalysts method
    return analysts.filter(analyst => analyst.isActive && analyst.shiftType === shiftType);
  }
} 