import { SchedulingConstraint, Schedule, Analyst } from '../../generated/prisma';
import { prisma } from '../lib/prisma';
import moment from 'moment';

export interface EventDefinition {
  id: string;
  name: string;
  description: string;
  type: 'HOLIDAY' | 'SPECIAL_COVERAGE' | 'SEASONAL' | 'MAINTENANCE' | 'TRAINING' | 'CUSTOM';
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  recurrence: {
    type: 'NONE' | 'ANNUAL' | 'MONTHLY' | 'WEEKLY' | 'CUSTOM';
    pattern?: string; // Cron-like pattern for custom recurrence
    exceptions?: string[]; // Dates to skip
  };
  constraints: Array<{
    constraintType: 'BLACKOUT_DATE' | 'MIN_COVERAGE' | 'MAX_COVERAGE' | 'REQUIRED_SCREENER' | 'OVERTIME_ALLOWED' | 'SKILL_REQUIRED';
    parameters: Record<string, any>;
    applicableAnalysts?: string[]; // If null, applies to all
    autoApply: boolean;
  }>;
  coverage: {
    minimumStaff: number;
    requiredRoles: string[];
    preferredAnalysts?: string[];
    excludedAnalysts?: string[];
    overtime: {
      allowed: boolean;
      maxHours?: number;
      approvalRequired: boolean;
    };
  };
  notifications: {
    advance: number; // Days in advance to notify
    channels: string[];
    recipients: string[];
    customMessage?: string;
  };
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface EventInstance {
  id: string;
  eventDefinitionId: string;
  name: string;
  date: Date;
  endDate?: Date;
  status: 'PENDING' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED';
  appliedConstraints: string[]; // IDs of auto-applied constraints
  schedulingNotes?: string;
  approvalStatus?: 'PENDING' | 'APPROVED' | 'REJECTED';
  approvedBy?: string;
  createdAt: Date;
}

export interface HolidayCalendarEntry {
  date: string;
  name: string;
  type: 'FEDERAL' | 'STATE' | 'COMPANY' | 'RELIGIOUS' | 'CULTURAL';
  country?: string;
  region?: string;
  observance?: 'PUBLIC' | 'OPTIONAL' | 'PARTIAL';
}

export interface EventConstraintApplication {
  eventInstanceId: string;
  constraintId: string;
  status: 'APPLIED' | 'FAILED' | 'SKIPPED';
  reason?: string;
  appliedAt: Date;
  impact: {
    affectedAnalysts: number;
    affectedDates: number;
    conflicts: number;
  };
}

export interface CoverageTemplate {
  id: string;
  name: string;
  description: string;
  eventTypes: string[];
  coverage: {
    minimumStaff: number;
    requiredRoles: string[];
    shiftPatterns: Array<{
      shiftType: 'MORNING' | 'EVENING' | 'WEEKEND' | 'OVERNIGHT';
      requiredCount: number;
      preferredSkills?: string[];
    }>;
  };
  constraints: Array<{
    type: string;
    parameters: Record<string, any>;
  }>;
}

export class EventConstraintManager {
  private eventDefinitions: Map<string, EventDefinition> = new Map();
  private eventInstances: Map<string, EventInstance> = new Map();
  private holidayCalendar: Map<string, HolidayCalendarEntry> = new Map();
  private coverageTemplates: Map<string, CoverageTemplate> = new Map();

  constructor() {
    this.initializeDefaultEvents();
    this.loadHolidayCalendar();
  }

  /**
   * Initialize with common event definitions
   */
  private initializeDefaultEvents(): void {
    // Major US Holidays
    this.addEventDefinition({
      id: 'new-years-day',
      name: 'New Year\'s Day',
      description: 'Federal holiday with reduced staffing',
      type: 'HOLIDAY',
      priority: 'HIGH',
      recurrence: {
        type: 'ANNUAL',
        pattern: '0 0 1 1 *' // January 1st
      },
      constraints: [
        {
          constraintType: 'MIN_COVERAGE',
          parameters: { minimumStaff: 2, requiredRoles: ['screener'] },
          autoApply: true
        },
        {
          constraintType: 'OVERTIME_ALLOWED',
          parameters: { maxHours: 12, multiplier: 2.0 },
          autoApply: true
        }
      ],
      coverage: {
        minimumStaff: 2,
        requiredRoles: ['screener'],
        overtime: {
          allowed: true,
          maxHours: 12,
          approvalRequired: false
        }
      },
      notifications: {
        advance: 7,
        channels: ['email', 'slack'],
        recipients: ['managers', 'schedulers']
      },
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date()
    });

    this.addEventDefinition({
      id: 'christmas-day',
      name: 'Christmas Day',
      description: 'Major holiday with minimal essential staffing only',
      type: 'HOLIDAY',
      priority: 'CRITICAL',
      recurrence: {
        type: 'ANNUAL',
        pattern: '0 0 25 12 *' // December 25th
      },
      constraints: [
        {
          constraintType: 'MIN_COVERAGE',
          parameters: { minimumStaff: 1, emergencyOnly: true },
          autoApply: true
        },
        {
          constraintType: 'OVERTIME_ALLOWED',
          parameters: { maxHours: 16, multiplier: 3.0 },
          autoApply: true
        }
      ],
      coverage: {
        minimumStaff: 1,
        requiredRoles: ['screener'],
        overtime: {
          allowed: true,
          maxHours: 16,
          approvalRequired: true
        }
      },
      notifications: {
        advance: 14,
        channels: ['email', 'slack', 'sms'],
        recipients: ['managers', 'schedulers', 'executives']
      },
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date()
    });

    this.addEventDefinition({
      id: 'thanksgiving-day',
      name: 'Thanksgiving Day',
      description: 'Major US holiday with reduced operations',
      type: 'HOLIDAY',
      priority: 'HIGH',
      recurrence: {
        type: 'CUSTOM',
        pattern: 'fourth-thursday-november' // Complex rule
      },
      constraints: [
        {
          constraintType: 'MIN_COVERAGE',
          parameters: { minimumStaff: 2, requiredRoles: ['screener'] },
          autoApply: true
        }
      ],
      coverage: {
        minimumStaff: 2,
        requiredRoles: ['screener'],
        overtime: {
          allowed: true,
          maxHours: 12,
          approvalRequired: false
        }
      },
      notifications: {
        advance: 10,
        channels: ['email', 'slack'],
        recipients: ['managers', 'schedulers']
      },
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date()
    });

    // System maintenance events
    this.addEventDefinition({
      id: 'monthly-maintenance',
      name: 'System Maintenance Window',
      description: 'Monthly system maintenance requiring technical coverage',
      type: 'MAINTENANCE',
      priority: 'MEDIUM',
      recurrence: {
        type: 'MONTHLY',
        pattern: '0 2 1 * *' // First Sunday of each month at 2 AM
      },
      constraints: [
        {
          constraintType: 'SKILL_REQUIRED',
          parameters: { requiredSkills: ['technical', 'system_admin'] },
          autoApply: true
        },
        {
          constraintType: 'MIN_COVERAGE',
          parameters: { minimumStaff: 1, preferNightShift: true },
          autoApply: true
        }
      ],
      coverage: {
        minimumStaff: 1,
        requiredRoles: ['technical_screener'],
        overtime: {
          allowed: true,
          maxHours: 4,
          approvalRequired: false
        }
      },
      notifications: {
        advance: 3,
        channels: ['email'],
        recipients: ['technical_team', 'schedulers']
      },
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date()
    });
  }

  /**
   * Load holiday calendar from external source or database
   */
  private async loadHolidayCalendar(): Promise<void> {
    // In real implementation, this would load from external API or database
    const currentYear = new Date().getFullYear();
    const holidays: HolidayCalendarEntry[] = [
      { date: `${currentYear}-01-01`, name: 'New Year\'s Day', type: 'FEDERAL', observance: 'PUBLIC' },
      { date: `${currentYear}-01-15`, name: 'Martin Luther King Jr. Day', type: 'FEDERAL', observance: 'PUBLIC' },
      { date: `${currentYear}-02-19`, name: 'Presidents\' Day', type: 'FEDERAL', observance: 'PUBLIC' },
      { date: `${currentYear}-05-27`, name: 'Memorial Day', type: 'FEDERAL', observance: 'PUBLIC' },
      { date: `${currentYear}-06-19`, name: 'Juneteenth', type: 'FEDERAL', observance: 'PUBLIC' },
      { date: `${currentYear}-07-04`, name: 'Independence Day', type: 'FEDERAL', observance: 'PUBLIC' },
      { date: `${currentYear}-09-02`, name: 'Labor Day', type: 'FEDERAL', observance: 'PUBLIC' },
      { date: `${currentYear}-10-14`, name: 'Columbus Day', type: 'FEDERAL', observance: 'PUBLIC' },
      { date: `${currentYear}-11-11`, name: 'Veterans Day', type: 'FEDERAL', observance: 'PUBLIC' },
      { date: `${currentYear}-11-28`, name: 'Thanksgiving Day', type: 'FEDERAL', observance: 'PUBLIC' },
      { date: `${currentYear}-12-25`, name: 'Christmas Day', type: 'FEDERAL', observance: 'PUBLIC' }
    ];

    for (const holiday of holidays) {
      this.holidayCalendar.set(holiday.date, holiday);
    }

    console.log(`📅 Loaded ${holidays.length} holidays for ${currentYear}`);
  }

  /**
   * Add or update an event definition
   */
  addEventDefinition(definition: EventDefinition): void {
    this.eventDefinitions.set(definition.id, definition);
    console.log(`📝 Added event definition: ${definition.name}`);
  }

  /**
   * Generate event instances for a date range
   */
  async generateEventInstances(startDate: Date, endDate: Date): Promise<EventInstance[]> {
    console.log(`🔄 Generating event instances from ${moment(startDate).format('YYYY-MM-DD')} to ${moment(endDate).format('YYYY-MM-DD')}`);
    
    const instances: EventInstance[] = [];

    for (const [id, definition] of this.eventDefinitions.entries()) {
      if (!definition.isActive) continue;

      const eventDates = this.calculateEventDates(definition, startDate, endDate);
      
      for (const date of eventDates) {
        const instanceId = `${id}_${moment(date).format('YYYY-MM-DD')}`;
        
        // Check if instance already exists
        if (this.eventInstances.has(instanceId)) {
          continue;
        }

        const instance: EventInstance = {
          id: instanceId,
          eventDefinitionId: id,
          name: `${definition.name} - ${moment(date).format('MMM DD, YYYY')}`,
          date,
          status: 'PENDING',
          appliedConstraints: [],
          createdAt: new Date()
        };

        this.eventInstances.set(instanceId, instance);
        instances.push(instance);
      }
    }

    console.log(`✨ Generated ${instances.length} new event instances`);
    return instances;
  }

  /**
   * Calculate dates when an event should occur based on recurrence rules
   */
  private calculateEventDates(definition: EventDefinition, startDate: Date, endDate: Date): Date[] {
    const dates: Date[] = [];

    switch (definition.recurrence.type) {
      case 'ANNUAL':
        // Handle annual recurrence (e.g., holidays)
        const years = [];
        for (let year = startDate.getFullYear(); year <= endDate.getFullYear(); year++) {
          years.push(year);
        }

        for (const year of years) {
          const eventDate = this.parseAnnualPattern(definition.recurrence.pattern!, year);
          if (eventDate && eventDate >= startDate && eventDate <= endDate) {
            dates.push(eventDate);
          }
        }
        break;

      case 'MONTHLY':
        // Handle monthly recurrence
        const monthlyDates = this.parseMonthlyPattern(definition.recurrence.pattern!, startDate, endDate);
        dates.push(...monthlyDates);
        break;

      case 'WEEKLY':
        // Handle weekly recurrence
        const weeklyDates = this.parseWeeklyPattern(definition.recurrence.pattern!, startDate, endDate);
        dates.push(...weeklyDates);
        break;

      case 'CUSTOM':
        // Handle custom patterns (like "fourth Thursday of November")
        const customDates = this.parseCustomPattern(definition.recurrence.pattern!, startDate, endDate);
        dates.push(...customDates);
        break;

      case 'NONE':
      default:
        // One-time event - check if it falls within range
        if (definition.recurrence.pattern) {
          const oneTimeDate = new Date(definition.recurrence.pattern);
          if (oneTimeDate >= startDate && oneTimeDate <= endDate) {
            dates.push(oneTimeDate);
          }
        }
        break;
    }

    // Filter out exceptions
    if (definition.recurrence.exceptions) {
      const exceptionDates = definition.recurrence.exceptions.map(d => new Date(d).getTime());
      return dates.filter(date => !exceptionDates.includes(date.getTime()));
    }

    return dates;
  }

  /**
   * Apply constraints automatically for event instances
   */
  async applyEventConstraints(eventInstanceId: string): Promise<EventConstraintApplication[]> {
    const instance = this.eventInstances.get(eventInstanceId);
    if (!instance) {
      throw new Error(`Event instance ${eventInstanceId} not found`);
    }

    const definition = this.eventDefinitions.get(instance.eventDefinitionId);
    if (!definition) {
      throw new Error(`Event definition ${instance.eventDefinitionId} not found`);
    }

    console.log(`🔧 Applying constraints for event: ${instance.name}`);

    const applications: EventConstraintApplication[] = [];

    for (const constraintDef of definition.constraints) {
      if (!constraintDef.autoApply) {
        console.log(`⏭️ Skipping manual constraint: ${constraintDef.constraintType}`);
        continue;
      }

      try {
        const constraintData = this.buildConstraintFromDefinition(constraintDef, instance, definition);
        
        // Create the constraint in database
        const constraint = await prisma.schedulingConstraint.create({
          data: constraintData
        });

        // Calculate impact
        const impact = await this.calculateConstraintImpact(constraint.id, instance.date);

        const application: EventConstraintApplication = {
          eventInstanceId,
          constraintId: constraint.id,
          status: 'APPLIED',
          appliedAt: new Date(),
          impact
        };

        applications.push(application);
        instance.appliedConstraints.push(constraint.id);

        console.log(`✅ Applied constraint ${constraintDef.constraintType} for ${instance.name}`);

      } catch (error) {
        console.error(`❌ Failed to apply constraint ${constraintDef.constraintType}:`, error);
        
        applications.push({
          eventInstanceId,
          constraintId: '',
          status: 'FAILED',
          reason: error instanceof Error ? error.message : 'Unknown error',
          appliedAt: new Date(),
          impact: { affectedAnalysts: 0, affectedDates: 0, conflicts: 0 }
        });
      }
    }

    // Update instance status
    instance.status = 'ACTIVE';

    return applications;
  }

  /**
   * Build constraint data from event definition
   */
  private buildConstraintFromDefinition(
    constraintDef: any,
    instance: EventInstance,
    definition: EventDefinition
  ): any {
    const baseData = {
      constraintType: constraintDef.constraintType,
      startDate: instance.date,
      endDate: instance.endDate || instance.date,
      isActive: true,
      description: `Auto-generated for ${definition.name} - ${instance.name}`,
      analystId: null // Global by default
    };

    // Add specific parameters based on constraint type
    switch (constraintDef.constraintType) {
      case 'BLACKOUT_DATE':
        return {
          ...baseData,
          description: `${baseData.description} - No scheduling allowed`
        };

      case 'MIN_COVERAGE':
        return {
          ...baseData,
          description: `${baseData.description} - Minimum ${constraintDef.parameters.minimumStaff} staff required`
        };

      case 'OVERTIME_ALLOWED':
        return {
          ...baseData,
          description: `${baseData.description} - Overtime authorized (${constraintDef.parameters.multiplier}x pay)`
        };

      case 'SKILL_REQUIRED':
        return {
          ...baseData,
          description: `${baseData.description} - Required skills: ${constraintDef.parameters.requiredSkills.join(', ')}`
        };

      default:
        return baseData;
    }
  }

  /**
   * Calculate impact of applying a constraint
   */
  private async calculateConstraintImpact(constraintId: string, date: Date): Promise<any> {
    // Get affected schedules
    const affectedSchedules = await prisma.schedule.findMany({
      where: { date: date }
    });

    // Get all analysts
    const analysts = await prisma.analyst.findMany();

    return {
      affectedAnalysts: affectedSchedules.length > 0 ? affectedSchedules.map(s => s.analystId).filter((id, index, arr) => arr.indexOf(id) === index).length : 0,
      affectedDates: 1,
      conflicts: 0 // Would implement proper conflict detection
    };
  }

  /**
   * Get upcoming events
   */
  async getUpcomingEvents(days: number = 30): Promise<EventInstance[]> {
    const startDate = new Date();
    const endDate = moment().add(days, 'days').toDate();

    // Generate instances if they don't exist
    await this.generateEventInstances(startDate, endDate);

    return Array.from(this.eventInstances.values())
      .filter(instance => 
        instance.date >= startDate && 
        instance.date <= endDate &&
        instance.status !== 'CANCELLED'
      )
      .sort((a, b) => a.date.getTime() - b.date.getTime());
  }

  /**
   * Check if a date is a holiday
   */
  isHoliday(date: Date): HolidayCalendarEntry | null {
    const dateKey = moment(date).format('YYYY-MM-DD');
    return this.holidayCalendar.get(dateKey) || null;
  }

  /**
   * Get events affecting a specific date
   */
  getEventsForDate(date: Date): EventInstance[] {
    const dateKey = moment(date).format('YYYY-MM-DD');
    return Array.from(this.eventInstances.values()).filter(instance => 
      moment(instance.date).format('YYYY-MM-DD') === dateKey
    );
  }

  /**
   * Process automatic constraint application for all pending events
   */
  async processAutomaticConstraints(): Promise<{
    processed: number;
    applied: number;
    failed: number;
    applications: EventConstraintApplication[];
  }> {
    console.log('🤖 Processing automatic constraint applications...');

    const pendingEvents = Array.from(this.eventInstances.values())
      .filter(instance => instance.status === 'PENDING');

    let processed = 0;
    let applied = 0;
    let failed = 0;
    const allApplications: EventConstraintApplication[] = [];

    for (const event of pendingEvents) {
      try {
        const applications = await this.applyEventConstraints(event.id);
        
        const successfulApplications = applications.filter(app => app.status === 'APPLIED');
        const failedApplications = applications.filter(app => app.status === 'FAILED');
        
        applied += successfulApplications.length;
        failed += failedApplications.length;
        processed++;
        
        allApplications.push(...applications);
        
      } catch (error) {
        console.error(`❌ Failed to process event ${event.id}:`, error);
        failed++;
      }
    }

    console.log(`✅ Processed ${processed} events, applied ${applied} constraints, ${failed} failed`);

    return { processed, applied, failed, applications: allApplications };
  }

  // Pattern parsing methods (simplified implementations)

  private parseAnnualPattern(pattern: string, year: number): Date | null {
    // Simple patterns like "0 0 1 1 *" (January 1st)
    const parts = pattern.split(' ');
    if (parts.length >= 4) {
      const day = parseInt(parts[2]);
      const month = parseInt(parts[3]) - 1; // Month is 0-indexed
      
      if (!isNaN(day) && !isNaN(month)) {
        return new Date(year, month, day);
      }
    }
    return null;
  }

  private parseMonthlyPattern(pattern: string, startDate: Date, endDate: Date): Date[] {
    // Simplified monthly pattern parsing
    const dates: Date[] = [];
    const current = moment(startDate).startOf('month');
    
    while (current.toDate() <= endDate) {
      // Add first Sunday of each month as example
      const firstSunday = current.clone().day(0); // Get first Sunday
      if (firstSunday.toDate() >= startDate && firstSunday.toDate() <= endDate) {
        dates.push(firstSunday.toDate());
      }
      current.add(1, 'month');
    }
    
    return dates;
  }

  private parseWeeklyPattern(pattern: string, startDate: Date, endDate: Date): Date[] {
    // Simplified weekly pattern parsing
    return [];
  }

  private parseCustomPattern(pattern: string, startDate: Date, endDate: Date): Date[] {
    const dates: Date[] = [];
    
    if (pattern === 'fourth-thursday-november') {
      // Thanksgiving: fourth Thursday of November
      for (let year = startDate.getFullYear(); year <= endDate.getFullYear(); year++) {
        const november = moment([year, 10]); // November (0-indexed)
        const firstThursday = november.clone().day(4); // First Thursday
        const fourthThursday = firstThursday.add(3, 'weeks'); // Fourth Thursday
        
        if (fourthThursday.toDate() >= startDate && fourthThursday.toDate() <= endDate) {
          dates.push(fourthThursday.toDate());
        }
      }
    }
    
    return dates;
  }

  // Public API methods

  /**
   * Get all event definitions
   */
  getEventDefinitions(): EventDefinition[] {
    return Array.from(this.eventDefinitions.values());
  }

  /**
   * Get event definition by ID
   */
  getEventDefinition(id: string): EventDefinition | null {
    return this.eventDefinitions.get(id) || null;
  }

  /**
   * Update event definition
   */
  updateEventDefinition(id: string, updates: Partial<EventDefinition>): boolean {
    const existing = this.eventDefinitions.get(id);
    if (!existing) return false;

    const updated = { ...existing, ...updates, updatedAt: new Date() };
    this.eventDefinitions.set(id, updated);
    return true;
  }

  /**
   * Delete event definition
   */
  deleteEventDefinition(id: string): boolean {
    return this.eventDefinitions.delete(id);
  }

  /**
   * Get holiday calendar for a date range
   */
  getHolidayCalendar(startDate: Date, endDate: Date): HolidayCalendarEntry[] {
    const holidays: HolidayCalendarEntry[] = [];
    const current = moment(startDate);
    
    while (current.toDate() <= endDate) {
      const holiday = this.isHoliday(current.toDate());
      if (holiday) {
        holidays.push(holiday);
      }
      current.add(1, 'day');
    }
    
    return holidays;
  }

  /**
   * Get system statistics
   */
  getSystemStats(): {
    totalDefinitions: number;
    activeDefinitions: number;
    totalInstances: number;
    pendingInstances: number;
    appliedConstraints: number;
    upcomingEvents: number;
  } {
    const definitions = Array.from(this.eventDefinitions.values());
    const instances = Array.from(this.eventInstances.values());
    const upcoming = instances.filter(i => i.date > new Date()).length;
    const pending = instances.filter(i => i.status === 'PENDING').length;
    const totalConstraints = instances.reduce((sum, i) => sum + i.appliedConstraints.length, 0);

    return {
      totalDefinitions: definitions.length,
      activeDefinitions: definitions.filter(d => d.isActive).length,
      totalInstances: instances.length,
      pendingInstances: pending,
      appliedConstraints: totalConstraints,
      upcomingEvents: upcoming
    };
  }
}

// Export singleton instance
export const eventConstraintManager = new EventConstraintManager();