import { GraphQLError } from 'graphql';
import { prisma } from '../lib/prisma';
import { cacheService } from '../lib/cache';
import { AlgorithmRegistry } from '../services/scheduling/AlgorithmRegistry';
import { fairnessEngine } from '../services/scheduling/algorithms/FairnessEngine';
import { getDatabasePerformance } from '../lib/prisma';
import {
  createAnalystLoader,
  createScheduleLoader,
  createVacationLoader,
  createConstraintLoader,
  createSchedulesByAnalystLoader,
  createVacationsByAnalystLoader,
  createConstraintsByAnalystLoader,
  createSchedulesByDateRangeLoader,
  createBatchOperations
} from './dataloaders';
import { CalendarExportService } from '../services/CalendarExportService';

// Context type for resolvers
export interface GraphQLContext {
  prisma: typeof prisma;
  cache: typeof cacheService;
  user?: any; // Will be used for authentication later
  isSubscription?: boolean;
  loaders?: {
    analyst: ReturnType<typeof createAnalystLoader>;
    schedule: ReturnType<typeof createScheduleLoader>;
    vacation: ReturnType<typeof createVacationLoader>;
    constraint: ReturnType<typeof createConstraintLoader>;
    schedulesByAnalyst: ReturnType<typeof createSchedulesByAnalystLoader>;
    vacationsByAnalyst: ReturnType<typeof createVacationsByAnalystLoader>;
    constraintsByAnalyst: ReturnType<typeof createConstraintsByAnalystLoader>;
    schedulesByDateRange: ReturnType<typeof createSchedulesByDateRangeLoader>;
  };
  batchOperations?: ReturnType<typeof createBatchOperations>;
}

// Custom scalar resolvers
const dateTimeScalar = {
  DateTime: {
    serialize: (value: Date) => value.toISOString(),
    parseValue: (value: string) => new Date(value),
    parseLiteral: (ast: any) => {
      if (ast.kind === 'StringValue') {
        return new Date(ast.value);
      }
      return null;
    },
  },
};

const jsonScalar = {
  JSON: {
    serialize: (value: any) => value,
    parseValue: (value: any) => value,
    parseLiteral: (ast: any) => {
      if (ast.kind === 'ObjectValue') {
        return ast.fields.reduce((obj: any, field: any) => {
          obj[field.name.value] = field.value.value;
          return obj;
        }, {});
      }
      return null;
    },
  },
};

// Query resolvers
const Query = {
  // Health and system
  health: async () => {
    try {
      await prisma.$queryRaw`SELECT 1`;
      const cacheHealthy = await cacheService.healthCheck();
      const performanceMetrics = getDatabasePerformance();
      const cacheStats = await cacheService.getStats();

      return {
        status: 'ok',
        timestamp: new Date().toISOString(),
        version: '1.0.0',
        database: {
          status: 'connected',
          performance: performanceMetrics
        },
        cache: {
          status: cacheHealthy ? 'connected' : 'disconnected',
          stats: cacheStats
        }
      };
    } catch (error) {
      return {
        status: 'error',
        timestamp: new Date().toISOString(),
        version: '1.0.0',
        database: {
          status: 'disconnected',
          error: error instanceof Error ? error.message : 'Unknown error'
        },
        cache: {
          status: 'unknown'
        }
      };
    }
  },

  // Analysts
  analysts: async (_: any, { filter }: { filter?: any }) => {
    const where: any = {};

    if (filter) {
      if (filter.isActive !== undefined) where.isActive = filter.isActive;
      if (filter.shiftType) where.shiftType = filter.shiftType;
      if (filter.skills && filter.skills.length > 0) {
        where.skills = { hasSome: filter.skills };
      }
    }

    return await prisma.analyst.findMany({
      where,
      include: {
        preferences: true,
        schedules: true,
        vacations: true,
        constraints: true,
      },
      orderBy: { name: 'asc' }
    });
  },

  analyst: async (_: any, { id }: { id: string }) => {
    return await prisma.analyst.findUnique({
      where: { id },
      include: {
        preferences: true,
        schedules: true,
        vacations: true,
        constraints: true,
      }
    });
  },

  // Schedules
  schedules: async (_: any, { filter }: { filter?: any }) => {
    const where: any = {};

    if (filter) {
      if (filter.startDate) where.date = { gte: filter.startDate };
      if (filter.endDate) where.date = { ...where.date, lte: filter.endDate };
      if (filter.analystId) where.analystId = filter.analystId;
      if (filter.shiftType) where.shiftType = filter.shiftType;
      if (filter.isScreener !== undefined) where.isScreener = filter.isScreener;
    }

    return await prisma.schedule.findMany({
      where,
      include: { analyst: true },
      orderBy: { date: 'asc' }
    });
  },

  schedule: async (_: any, { id }: { id: string }) => {
    return await prisma.schedule.findUnique({
      where: { id },
      include: { analyst: true }
    });
  },

  // Vacations
  vacations: async (_: any, { analystId }: { analystId?: string }) => {
    const where: any = {};
    if (analystId) where.analystId = analystId;

    return await prisma.vacation.findMany({
      where,
      include: { analyst: true },
      orderBy: { startDate: 'asc' }
    });
  },

  vacation: async (_: any, { id }: { id: string }) => {
    return await prisma.vacation.findUnique({
      where: { id },
      include: { analyst: true }
    });
  },

  // Constraints
  constraints: async (_: any, { analystId }: { analystId?: string }) => {
    const where: any = { isActive: true };
    if (analystId) where.analystId = analystId;

    return await prisma.schedulingConstraint.findMany({
      where,
      include: { analyst: true },
      orderBy: { startDate: 'asc' }
    });
  },

  constraint: async (_: any, { id }: { id: string }) => {
    return await prisma.schedulingConstraint.findUnique({
      where: { id },
      include: { analyst: true }
    });
  },

  // Algorithm configurations
  algorithmConfigs: async () => {
    return await prisma.algorithmConfig.findMany({
      orderBy: { name: 'asc' }
    });
  },

  algorithmConfig: async (_: any, { id }: { id: string }) => {
    return await prisma.algorithmConfig.findUnique({
      where: { id }
    });
  },

  // Schedule generation
  generateSchedulePreview: async (_: any, { input }: { input: any }) => {
    const algorithm = AlgorithmRegistry.getAlgorithm(input.algorithmType);
    if (!algorithm) {
      throw new GraphQLError(`Algorithm '${input.algorithmType}' not found.`);
    }

    const start = new Date(input.startDate);
    const end = new Date(input.endDate);

    const analysts = await prisma.analyst.findMany({
      where: { isActive: true },
      include: {
        vacations: { where: { isApproved: true, OR: [{ startDate: { lte: end }, endDate: { gte: start } }] } },
        constraints: { where: { isActive: true, OR: [{ startDate: { lte: end }, endDate: { gte: start } }] } }
      },
      orderBy: { name: 'asc' }
    });

    if (analysts.length === 0) {
      throw new GraphQLError('No active analysts found');
    }

    const existingSchedules = await prisma.schedule.findMany({
      where: { date: { gte: start, lte: end } },
      include: { analyst: true }
    });

    const globalConstraints = await prisma.schedulingConstraint.findMany({
      where: { analystId: null, isActive: true, startDate: { lte: end }, endDate: { gte: start } }
    });

    const result = await algorithm.generateSchedules({
      startDate: start,
      endDate: end,
      analysts,
      existingSchedules,
      globalConstraints,
      algorithmConfig: input.algorithmConfig
    });

    const totalDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;

    return {
      startDate: input.startDate,
      endDate: input.endDate,
      algorithmType: input.algorithmType,
      proposedSchedules: result.proposedSchedules,
      conflicts: result.conflicts,
      overwrites: result.overwrites,
      fairnessMetrics: result.fairnessMetrics,
      performanceMetrics: result.performanceMetrics,
      summary: {
        totalDays,
        totalSchedules: result.proposedSchedules.length,
        newSchedules: result.proposedSchedules.filter((s: any) => s.type === 'NEW_SCHEDULE').length,
        overwrittenSchedules: result.overwrites.length,
        conflicts: result.conflicts.length,
        fairnessScore: result.fairnessMetrics?.overallFairnessScore || 0,
        executionTime: result.performanceMetrics?.algorithmExecutionTime || 0
      }
    };
  },

  // Analytics
  analyticsData: async (_: any, { analystId, startDate, endDate }: { analystId?: string, startDate?: Date, endDate?: Date }) => {
    // This would query the actual analytics data table when it exists
    // For now, return empty array as placeholder
    return [];
  },

  // Advanced Analytics
  monthlyTallies: async (_: any, { month, year }: { month: number, year: number }) => {
    const { AnalyticsEngine } = await import('../services/AnalyticsEngine');
    const analyticsEngine = new AnalyticsEngine(prisma, cacheService);
    return await analyticsEngine.calculateMonthlyTallies(month, year);
  },

  fairnessReport: async (_: any, { startDate, endDate }: { startDate: Date, endDate: Date }) => {
    const { AnalyticsEngine } = await import('../services/AnalyticsEngine');
    const analyticsEngine = new AnalyticsEngine(prisma, cacheService);
    return await analyticsEngine.generateFairnessReport({ startDate, endDate });
  },

  workloadPredictions: async (_: any, { months }: { months: number }) => {
    const { AnalyticsEngine } = await import('../services/AnalyticsEngine');
    const analyticsEngine = new AnalyticsEngine(prisma, cacheService);
    return await analyticsEngine.predictWorkloadTrends(months);
  },

  optimizationOpportunities: async (_: any, { dateRange }: { dateRange?: string }) => {
    const { AnalyticsEngine } = await import('../services/AnalyticsEngine');
    const analyticsEngine = new AnalyticsEngine(prisma, cacheService);

    let schedules;
    if (dateRange) {
      const [startDate, endDate] = dateRange.split(',');
      schedules = await prisma.schedule.findMany({
        where: {
          date: {
            gte: new Date(startDate),
            lte: new Date(endDate),
          },
        },
        include: { analyst: true },
      });
    } else {
      schedules = await prisma.schedule.findMany({
        where: {
          date: {
            gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
          },
        },
        include: { analyst: true },
      });
    }

    return await analyticsEngine.identifyOptimizationOpportunities(schedules);
  },

  // Predictive Intelligence
  staffingPrediction: async (_: any, { date }: { date: Date }) => {
    const { PredictiveEngine } = await import('../services/PredictiveEngine');
    const predictiveEngine = new PredictiveEngine(prisma, cacheService);
    return await predictiveEngine.predictStaffingNeeds(date);
  },

  burnoutRiskAssessments: async (_: any, { includeLowRisk = false }: { includeLowRisk?: boolean }) => {
    const { PredictiveEngine } = await import('../services/PredictiveEngine');
    const predictiveEngine = new PredictiveEngine(prisma, cacheService);

    const analysts = await prisma.analyst.findMany({
      where: { isActive: true },
    });

    const assessments = await predictiveEngine.identifyBurnoutRisk(analysts);

    return includeLowRisk
      ? assessments
      : assessments.filter(assessment => assessment.riskLevel !== 'LOW');
  },

  rotationSuggestions: async () => {
    const { PredictiveEngine } = await import('../services/PredictiveEngine');
    const predictiveEngine = new PredictiveEngine(prisma, cacheService);

    const constraints = await prisma.schedulingConstraint.findMany();
    return await predictiveEngine.suggestOptimalRotations(constraints);
  },

  conflictForecasts: async (_: any, { pattern }: { pattern: any }) => {
    const { PredictiveEngine } = await import('../services/PredictiveEngine');
    const predictiveEngine = new PredictiveEngine(prisma, cacheService);
    return await predictiveEngine.forecastConflicts(pattern);
  },

  // Dashboard
  dashboard: async () => {
    const { DashboardService } = await import('../services/DashboardService');
    const { AnalyticsEngine } = await import('../services/AnalyticsEngine');
    const { PredictiveEngine } = await import('../services/PredictiveEngine');

    const analyticsEngine = new AnalyticsEngine(prisma, cacheService);
    const predictiveEngine = new PredictiveEngine(prisma, cacheService);
    const dashboardService = new DashboardService(prisma, cacheService, analyticsEngine, predictiveEngine);

    return await dashboardService.generateRealTimeDashboard();
  },

  // Reports and Exports
  customReport: async (_: any, { config }: { config: any }) => {
    const { DashboardService } = await import('../services/DashboardService');
    const { AnalyticsEngine } = await import('../services/AnalyticsEngine');
    const { PredictiveEngine } = await import('../services/PredictiveEngine');

    const analyticsEngine = new AnalyticsEngine(prisma, cacheService);
    const predictiveEngine = new PredictiveEngine(prisma, cacheService);
    const dashboardService = new DashboardService(prisma, cacheService, analyticsEngine, predictiveEngine);

    return await dashboardService.createCustomReport(config);
  },

  exportAnalytics: async (_: any, { format, filters }: { format: any, filters: any }) => {
    const { DashboardService } = await import('../services/DashboardService');
    const { AnalyticsEngine } = await import('../services/AnalyticsEngine');
    const { PredictiveEngine } = await import('../services/PredictiveEngine');

    const analyticsEngine = new AnalyticsEngine(prisma, cacheService);
    const predictiveEngine = new PredictiveEngine(prisma, cacheService);
    const dashboardService = new DashboardService(prisma, cacheService, analyticsEngine, predictiveEngine);

    return await dashboardService.exportAnalytics(format, filters);
  },

  workloadAnalysis: async (_: any, { analystId }: { analystId: string }) => {
    const analyst = await prisma.analyst.findUnique({
      where: { id: analystId },
      include: { schedules: true }
    });

    if (!analyst) {
      throw new GraphQLError('Analyst not found');
    }

    const schedules = analyst.schedules;
    const totalWorkDays = schedules.length;
    const regularShiftDays = schedules.filter(s => !s.isScreener).length;
    const screenerDays = schedules.filter(s => s.isScreener).length;
    const weekendDays = schedules.filter(s => {
      const dayOfWeek = s.date.getDay();
      return dayOfWeek === 0 || dayOfWeek === 6;
    }).length;

    // Calculate consecutive work days
    const sortedDates = schedules
      .map(s => s.date)
      .sort((a, b) => a.getTime() - b.getTime());

    let maxConsecutive = 1;
    let currentConsecutive = 1;

    for (let i = 1; i < sortedDates.length; i++) {
      const daysDiff = (sortedDates[i].getTime() - sortedDates[i - 1].getTime()) / (1000 * 60 * 60 * 24);
      if (daysDiff === 1) {
        currentConsecutive++;
        maxConsecutive = Math.max(maxConsecutive, currentConsecutive);
      } else {
        currentConsecutive = 1;
      }
    }

    const averageWorkloadPerWeek = totalWorkDays / Math.max(1, (sortedDates.length > 0 ?
      (sortedDates[sortedDates.length - 1].getTime() - sortedDates[0].getTime()) / (1000 * 60 * 60 * 24 * 7) : 1));

    // Convert Schedule objects to ProposedSchedule format for fairness calculation
    const proposedSchedules = schedules.map(schedule => ({
      date: schedule.date.toISOString().split('T')[0],
      analystId: schedule.analystId,
      analystName: analyst.name,
      shiftType: schedule.shiftType as 'MORNING' | 'EVENING' | 'WEEKEND',
      isScreener: schedule.isScreener,
      type: 'NEW_SCHEDULE' as const
    }));

    const fairnessScore = fairnessEngine.calculateIndividualFairnessScore(proposedSchedules, 1);

    return {
      analystId: analyst.id,
      analystName: analyst.name,
      totalWorkDays,
      regularShiftDays,
      screenerDays,
      weekendDays,
      consecutiveWorkDays: maxConsecutive,
      averageWorkloadPerWeek,
      fairnessScore,
      recommendations: []
    };
  },

  analyzeAbsenceImpact: async (_: any, { analystId, startDate, endDate, type }: { analystId: string, startDate: Date, endDate: Date, type: string }) => {
    const { absenceImpactAnalyzer } = await import('../services/AbsenceImpactAnalyzer');
    return await absenceImpactAnalyzer.analyzeAbsenceImpact({
      analystId,
      startDate,
      endDate,
      type
    });
  },

  // Fairness metrics
  fairnessMetrics: async (_: any, { schedules }: { schedules: string[] }) => {
    const scheduleData = await prisma.schedule.findMany({
      where: { id: { in: schedules } },
      include: { analyst: true }
    });

    const analysts = await prisma.analyst.findMany({
      where: { isActive: true }
    });

    // Convert Schedule objects to ProposedSchedule format
    const proposedSchedules = scheduleData.map(schedule => ({
      date: schedule.date.toISOString().split('T')[0],
      analystId: schedule.analystId,
      analystName: schedule.analyst.name,
      shiftType: schedule.shiftType as 'MORNING' | 'EVENING' | 'WEEKEND',
      isScreener: schedule.isScreener,
      type: 'NEW_SCHEDULE' as const
    }));

    return fairnessEngine.calculateFairness(proposedSchedules, analysts);
  },

  // Performance metrics
  performanceMetrics: async () => {
    const dbMetrics = getDatabasePerformance();
    const cacheStats = await cacheService.getStats();
    const memoryUsage = process.memoryUsage().heapUsed / 1024 / 1024;

    return {
      totalQueries: dbMetrics.totalQueries,
      averageQueryTime: dbMetrics.averageDuration,
      slowQueries: dbMetrics.slowQueries,
      cacheHitRate: cacheStats.hitRate || 0,
      algorithmExecutionTime: 0,
      memoryUsage,
      optimizationIterations: 0
    };
  },

  // Calendar export
  calendarExport: async (_: any, { analystId, format, options }: { analystId: string, format: string, options?: any }) => {
    const calendarService = new CalendarExportService(prisma);

    try {
      switch (format) {
        case 'ICAL':
          const icalContent = await calendarService.generateICalFeed(analystId, options);
          return {
            format: 'ICAL',
            content: icalContent,
            filename: `schedule-${analystId}.ics`
          };

        case 'GOOGLE_CALENDAR':
          const googleEvents = await calendarService.generateGoogleCalendarEvents(analystId, options);
          return {
            format: 'GOOGLE_CALENDAR',
            content: JSON.stringify(googleEvents),
            filename: `schedule-${analystId}-google.json`
          };

        case 'OUTLOOK':
          const outlookEvents = await calendarService.generateOutlookEvents(analystId, options);
          return {
            format: 'OUTLOOK',
            content: JSON.stringify(outlookEvents),
            filename: `schedule-${analystId}-outlook.json`
          };

        default:
          throw new GraphQLError(`Unsupported calendar format: ${format}`);
      }
    } catch (error) {
      throw new GraphQLError(`Failed to generate calendar export: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  },

  // Team calendar export
  teamCalendarExport: async (_: any, { format, options }: { format: string, options?: any }) => {
    const calendarService = new CalendarExportService(prisma);

    try {
      if (format === 'ICAL') {
        const icalContent = await calendarService.generateTeamCalendar(options);
        return {
          format: 'ICAL',
          content: icalContent,
          filename: 'team-schedule.ics'
        };
      } else {
        throw new GraphQLError(`Team calendar export only supports ICAL format`);
      }
    } catch (error) {
      throw new GraphQLError(`Failed to generate team calendar export: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
};

// Mutation resolvers
const Mutation = {
  // Analysts
  createAnalyst: async (_: any, { input }: { input: any }) => {
    const analyst = await prisma.analyst.create({
      data: {
        name: input.name,
        email: input.email,
        shiftType: input.shiftType,
        customAttributes: input.customAttributes,
        skills: input.skills || []
      },
      include: {
        preferences: true,
        schedules: true,
        vacations: true,
        constraints: true,
      }
    });

    return analyst;
  },

  updateAnalyst: async (_: any, { id, input }: { id: string, input: any }) => {
    const updateData: any = {};
    if (input.name !== undefined) updateData.name = input.name;
    if (input.email !== undefined) updateData.email = input.email;
    if (input.shiftType !== undefined) updateData.shiftType = input.shiftType;
    if (input.isActive !== undefined) updateData.isActive = input.isActive;
    if (input.customAttributes !== undefined) updateData.customAttributes = input.customAttributes;
    if (input.skills !== undefined) updateData.skills = input.skills;

    const analyst = await prisma.analyst.update({
      where: { id },
      data: updateData,
      include: {
        preferences: true,
        schedules: true,
        vacations: true,
        constraints: true,
      }
    });

    return analyst;
  },

  deleteAnalyst: async (_: any, { id }: { id: string }) => {
    await prisma.analyst.delete({ where: { id } });

    return true;
  },

  // Vacations
  createVacation: async (_: any, { input }: { input: any }) => {
    const vacation = await prisma.vacation.create({
      data: {
        analystId: input.analystId,
        startDate: input.startDate,
        endDate: input.endDate,
        reason: input.reason
      },
      include: { analyst: true }
    });

    return vacation;
  },

  updateVacation: async (_: any, { id, input }: { id: string, input: any }) => {
    const vacation = await prisma.vacation.update({
      where: { id },
      data: {
        analystId: input.analystId,
        startDate: input.startDate,
        endDate: input.endDate,
        reason: input.reason
      },
      include: { analyst: true }
    });

    return vacation;
  },

  deleteVacation: async (_: any, { id }: { id: string }) => {
    await prisma.vacation.delete({ where: { id } });

    return true;
  },

  approveVacation: async (_: any, { id }: { id: string }) => {
    return await prisma.vacation.update({
      where: { id },
      data: { isApproved: true },
      include: { analyst: true }
    });
  },

  // Constraints
  createConstraint: async (_: any, { input }: { input: any }) => {
    const constraint = await prisma.schedulingConstraint.create({
      data: {
        analystId: input.analystId,
        constraintType: input.constraintType,
        startDate: input.startDate,
        endDate: input.endDate,
        description: input.description
      },
      include: { analyst: true }
    });

    return constraint;
  },

  updateConstraint: async (_: any, { id, input }: { id: string, input: any }) => {
    return await prisma.schedulingConstraint.update({
      where: { id },
      data: {
        analystId: input.analystId,
        constraintType: input.constraintType,
        startDate: input.startDate,
        endDate: input.endDate,
        description: input.description
      },
      include: { analyst: true }
    });
  },

  deleteConstraint: async (_: any, { id }: { id: string }) => {
    await prisma.schedulingConstraint.delete({ where: { id } });

    return true;
  },

  // Schedules
  createSchedule: async (_: any, { analystId, date, shiftType, isScreener }: { analystId: string, date: Date, shiftType: string, isScreener: boolean }) => {
    const schedule = await prisma.schedule.create({
      data: {
        analystId,
        date,
        shiftType: shiftType as any,
        isScreener
      },
      include: { analyst: true }
    });

    return schedule;
  },

  updateSchedule: async (_: any, { id, shiftType, isScreener }: { id: string, shiftType?: string, isScreener?: boolean }) => {
    const updateData: any = {};
    if (shiftType !== undefined) updateData.shiftType = shiftType as any;
    if (isScreener !== undefined) updateData.isScreener = isScreener;

    const schedule = await prisma.schedule.update({
      where: { id },
      data: updateData,
      include: { analyst: true }
    });

    return schedule;
  },

  deleteSchedule: async (_: any, { id }: { id: string }) => {
    await prisma.schedule.delete({ where: { id } });

    return true;
  },

  // Algorithm configurations
  createAlgorithmConfig: async (_: any, { name, description, config }: { name: string, description?: string, config: any }) => {
    return await prisma.algorithmConfig.create({
      data: { name, description, config }
    });
  },

  updateAlgorithmConfig: async (_: any, { id, name, description, config, isActive }: { id: string, name?: string, description?: string, config?: any, isActive?: boolean }) => {
    const updateData: any = {};
    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (config !== undefined) updateData.config = config;
    if (isActive !== undefined) updateData.isActive = isActive;

    return await prisma.algorithmConfig.update({
      where: { id },
      data: updateData
    });
  },

  deleteAlgorithmConfig: async (_: any, { id }: { id: string }) => {
    await prisma.algorithmConfig.delete({ where: { id } });
    return true;
  },

  // Schedule generation
  generateSchedules: async (_: any, { input }: { input: any }) => {
    const algorithm = AlgorithmRegistry.getAlgorithm(input.algorithmType);
    if (!algorithm) {
      throw new GraphQLError(`Algorithm '${input.algorithmType}' not found.`);
    }

    const start = new Date(input.startDate);
    const end = new Date(input.endDate);

    const analysts = await prisma.analyst.findMany({
      where: { isActive: true },
      include: {
        vacations: { where: { isApproved: true, OR: [{ startDate: { lte: end }, endDate: { gte: start } }] } },
        constraints: { where: { isActive: true, OR: [{ startDate: { lte: end }, endDate: { gte: start } }] } }
      },
      orderBy: { name: 'asc' }
    });

    if (analysts.length === 0) {
      throw new GraphQLError('No active analysts found');
    }

    const existingSchedules = await prisma.schedule.findMany({
      where: { date: { gte: start, lte: end } },
      include: { analyst: true }
    });

    const globalConstraints = await prisma.schedulingConstraint.findMany({
      where: { analystId: null, isActive: true, startDate: { lte: end }, endDate: { gte: start } }
    });

    const result = await algorithm.generateSchedules({
      startDate: start,
      endDate: end,
      analysts,
      existingSchedules,
      globalConstraints,
      algorithmConfig: input.algorithmConfig
    });

    return result;
  },

  applySchedules: async (_: any, { input, overwriteExisting }: { input: any, overwriteExisting?: boolean }) => {
    const algorithm = AlgorithmRegistry.getAlgorithm(input.algorithmType);
    if (!algorithm) {
      throw new GraphQLError(`Algorithm '${input.algorithmType}' not found.`);
    }

    const start = new Date(input.startDate);
    const end = new Date(input.endDate);

    const analysts = await prisma.analyst.findMany({
      where: { isActive: true },
      include: {
        vacations: { where: { isApproved: true, OR: [{ startDate: { lte: end }, endDate: { gte: start } }] } },
        constraints: { where: { isActive: true, OR: [{ startDate: { lte: end }, endDate: { gte: start } }] } }
      },
      orderBy: { name: 'asc' }
    });

    if (analysts.length === 0) {
      throw new GraphQLError('No active analysts found');
    }

    const existingSchedules = await prisma.schedule.findMany({
      where: { date: { gte: start, lte: end } },
      include: { analyst: true }
    });

    const globalConstraints = await prisma.schedulingConstraint.findMany({
      where: { analystId: null, isActive: true, startDate: { lte: end }, endDate: { gte: start } }
    });

    const result = await algorithm.generateSchedules({
      startDate: start,
      endDate: end,
      analysts,
      existingSchedules,
      globalConstraints,
      algorithmConfig: input.algorithmConfig
    });

    // Apply schedules to database
    for (const schedule of result.proposedSchedules) {
      try {
        const existing = existingSchedules.find(s =>
          s.analystId === schedule.analystId &&
          new Date(s.date).toISOString().split('T')[0] === schedule.date
        );

        if (existing) {
          if (overwriteExisting && (existing.shiftType !== schedule.shiftType || existing.isScreener !== schedule.isScreener)) {
            await prisma.schedule.update({
              where: { id: existing.id },
              data: {
                shiftType: schedule.shiftType,
                isScreener: schedule.isScreener
              }
            });
          }
        } else {
          await prisma.schedule.create({
            data: {
              analystId: schedule.analystId,
              date: new Date(schedule.date),
              shiftType: schedule.shiftType,
              isScreener: schedule.isScreener
            }
          });
        }
      } catch (error) {
        result.conflicts.push({
          date: schedule.date,
          type: 'CONSTRAINT_VIOLATION',
          description: error instanceof Error ? error.message : 'Failed to apply schedule',
          severity: 'HIGH'
        });
      }
    }

    return result;
  },

  // System operations
  warmCache: async () => {
    await cacheService.warmCache();
    return true;
  }
};

// Field resolvers for computed fields
const Analyst = {
  totalWorkDays: async (parent: any) => {
    const schedules = await prisma.schedule.findMany({
      where: { analystId: parent.id }
    });
    return schedules.length;
  },

  screenerDays: async (parent: any) => {
    const schedules = await prisma.schedule.findMany({
      where: { analystId: parent.id, isScreener: true }
    });
    return schedules.length;
  },

  weekendDays: async (parent: any) => {
    const schedules = await prisma.schedule.findMany({
      where: { analystId: parent.id }
    });
    return schedules.filter(s => {
      const dayOfWeek = s.date.getDay();
      return dayOfWeek === 0 || dayOfWeek === 6;
    }).length;
  },

  fairnessScore: async (parent: any) => {
    const schedules = await prisma.schedule.findMany({
      where: { analystId: parent.id }
    });

    // Convert Schedule objects to ProposedSchedule format
    const proposedSchedules = schedules.map(schedule => ({
      date: schedule.date.toISOString().split('T')[0],
      analystId: schedule.analystId,
      analystName: parent.name,
      shiftType: schedule.shiftType as 'MORNING' | 'EVENING' | 'WEEKEND',
      isScreener: schedule.isScreener,
      type: 'NEW_SCHEDULE' as const
    }));

    return fairnessEngine.calculateIndividualFairnessScore(proposedSchedules, 1);
  },

  workloadAnalysis: async (parent: any) => {
    const schedules = await prisma.schedule.findMany({
      where: { analystId: parent.id }
    });

    const totalWorkDays = schedules.length;
    const regularShiftDays = schedules.filter(s => !s.isScreener).length;
    const screenerDays = schedules.filter(s => s.isScreener).length;
    const weekendDays = schedules.filter(s => {
      const dayOfWeek = s.date.getDay();
      return dayOfWeek === 0 || dayOfWeek === 6;
    }).length;

    // Calculate consecutive work days
    const sortedDates = schedules
      .map(s => s.date)
      .sort((a, b) => a.getTime() - b.getTime());

    let maxConsecutive = 1;
    let currentConsecutive = 1;

    for (let i = 1; i < sortedDates.length; i++) {
      const daysDiff = (sortedDates[i].getTime() - sortedDates[i - 1].getTime()) / (1000 * 60 * 60 * 24);
      if (daysDiff === 1) {
        currentConsecutive++;
        maxConsecutive = Math.max(maxConsecutive, currentConsecutive);
      } else {
        currentConsecutive = 1;
      }
    }

    const averageWorkloadPerWeek = totalWorkDays / Math.max(1, (sortedDates.length > 0 ?
      (sortedDates[sortedDates.length - 1].getTime() - sortedDates[0].getTime()) / (1000 * 60 * 60 * 24 * 7) : 1));

    // Convert Schedule objects to ProposedSchedule format
    const proposedSchedules = schedules.map(schedule => ({
      date: schedule.date.toISOString().split('T')[0],
      analystId: schedule.analystId,
      analystName: parent.name,
      shiftType: schedule.shiftType as 'MORNING' | 'EVENING' | 'WEEKEND',
      isScreener: schedule.isScreener,
      type: 'NEW_SCHEDULE' as const
    }));

    const fairnessScore = fairnessEngine.calculateIndividualFairnessScore(proposedSchedules, 1);

    return {
      analystId: parent.id,
      analystName: parent.name,
      totalWorkDays,
      regularShiftDays,
      screenerDays,
      weekendDays,
      consecutiveWorkDays: maxConsecutive,
      averageWorkloadPerWeek,
      fairnessScore,
      recommendations: []
    };
  }
};

export const resolvers = {
  ...dateTimeScalar,
  ...jsonScalar,
  Query,
  Mutation,
  Analyst
}; 