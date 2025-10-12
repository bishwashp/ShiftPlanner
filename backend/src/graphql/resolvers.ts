import { GraphQLError } from 'graphql';
import { prisma } from '../lib/prisma';
import { cacheService } from '../lib/cache';
import { AlgorithmRegistry } from '../services/scheduling/AlgorithmRegistry';
import { fairnessEngine } from '../services/scheduling/algorithms/FairnessEngine';
import { getDatabasePerformance } from '../lib/prisma';
import { compOffBankService } from '../services/scheduling/CompOffBankService';
import { workloadBalancingSystem } from '../services/scheduling/WorkloadBalancingSystem';
import { autoCompAssignmentEngine } from '../services/scheduling/AutoCompAssignmentEngine';
import { rotationStateManager } from '../services/scheduling/RotationStateManager';
import { IntelligentScheduler } from '../services/IntelligentScheduler';
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

    // Pre-resolve gaps iteratively: detect/resolve missing weekday shifts until no conflicts
    try {
      const scheduler = new IntelligentScheduler(prisma as any);
      const setKeys = () => new Set(result.proposedSchedules.map((s: any)=>`${s.analystId}|${s.date}|${s.shiftType}`));
      let iterations = 0;
      while (iterations < 3) {
        iterations++;
        // Build day map
        const byDate: Record<string, { MORNING: number; EVENING: number }> = {} as any;
        for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
          const iso = new Date(d).toISOString().split('T')[0];
          byDate[iso] = { MORNING: 0, EVENING: 0 };
        }
        for (const s of result.proposedSchedules) {
          if (!byDate[s.date]) byDate[s.date] = { MORNING: 0, EVENING: 0 };
          if (s.shiftType === 'MORNING' || s.shiftType === 'EVENING') {
            // @ts-ignore
            byDate[s.date][s.shiftType] = (byDate[s.date][s.shiftType] || 0) + 1;
          }
        }
        const missingConflicts: Array<{ date: string; missingShifts: string[]; severity: string }> = [];
        for (const iso of Object.keys(byDate)) {
          const day = new Date(iso + 'T00:00:00.000Z').getDay();
          if (day >= 1 && day <= 5) {
            const missing: string[] = [];
            if ((byDate[iso].MORNING || 0) === 0) missing.push('MORNING');
            if ((byDate[iso].EVENING || 0) === 0) missing.push('EVENING');
            if (missing.length > 0) missingConflicts.push({ date: iso, missingShifts: missing, severity: 'critical' });
          }
        }
        if (missingConflicts.length === 0) break;
        const res = await scheduler.resolveConflicts(missingConflicts as any, start.toISOString(), end.toISOString());
        const proposals = res.suggestedAssignments || [];
        const keys = setKeys();
        let added = 0;
        for (const p of proposals) {
          const iso = new Date(p.date).toISOString().split('T')[0];
          const key = `${p.analystId}|${iso}|${p.shiftType}`;
          if (keys.has(key)) continue;
          const day = new Date(iso + 'T00:00:00.000Z').getDay();
          // Guard checks
          if (day === 5) {
            const weekSunday = new Date(iso + 'T00:00:00.000Z');
            weekSunday.setDate(weekSunday.getDate() - weekSunday.getDay());
            const sundayStr = weekSunday.toISOString().split('T')[0];
            const workedSunday = result.proposedSchedules.some((ps: any)=> ps.analystId === p.analystId && ps.date === sundayStr);
            if (workedSunday) continue;
          }
          if (day === 1) {
            const weekSunday = new Date(iso + 'T00:00:00.000Z');
            weekSunday.setDate(weekSunday.getDate() - weekSunday.getDay());
            const saturday = new Date(weekSunday);
            saturday.setDate(weekSunday.getDate() + 6);
            const saturdayStr = saturday.toISOString().split('T')[0];
            const worksSaturday = result.proposedSchedules.some((ps: any)=> ps.analystId === p.analystId && ps.date === saturdayStr);
            if (worksSaturday) continue;
          }
          result.proposedSchedules.push({ date: iso, analystId: p.analystId, shiftType: p.shiftType, isScreener: false, type: 'NEW_SCHEDULE' } as any);
          keys.add(key);
          added++;
        }
        // Fallback: If still missing after proposals (due to guard filters), greedily assign first allowed candidate
        // Recompute missing
        const postByDate: Record<string, { MORNING: number; EVENING: number }> = {} as any;
        for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
          const iso2 = new Date(d).toISOString().split('T')[0];
          postByDate[iso2] = { MORNING: 0, EVENING: 0 };
        }
        for (const s of result.proposedSchedules) {
          if (!postByDate[s.date]) postByDate[s.date] = { MORNING: 0, EVENING: 0 };
          if (s.shiftType === 'MORNING' || s.shiftType === 'EVENING') {
            // @ts-ignore
            postByDate[s.date][s.shiftType] = (postByDate[s.date][s.shiftType] || 0) + 1;
          }
        }
        const stillMissing: Array<{ date: string; need: ('MORNING'|'EVENING')[] }> = [];
        for (const iso2 of Object.keys(postByDate)) {
          const dow = new Date(iso2 + 'T00:00:00.000Z').getDay();
          if (dow >= 1 && dow <= 5) {
            const need: any[] = [];
            if ((postByDate[iso2].MORNING || 0) === 0) need.push('MORNING');
            if ((postByDate[iso2].EVENING || 0) === 0) need.push('EVENING');
            if (need.length) stillMissing.push({ date: iso2, need });
          }
        }
        if (stillMissing.length) {
          for (const m of stillMissing) {
            for (const shift of m.need) {
              const dow = new Date(m.date + 'T00:00:00.000Z').getDay();
              // Candidate list by shift type
              const candidates = analysts.filter(a => a.shiftType === shift && a.isActive);
              for (const cand of candidates) {
                const candKey = `${cand.id}|${m.date}|${shift}`;
                if (keys.has(candKey)) continue;
                // Not already assigned same date
                const already = result.proposedSchedules.some(ps => ps.analystId === cand.id && ps.date === m.date);
                if (already) continue;
                // Guard rules
                if (dow === 5) {
                  const weekSunday = new Date(m.date + 'T00:00:00.000Z');
                  weekSunday.setDate(weekSunday.getDate() - weekSunday.getDay());
                  const sundayStr = weekSunday.toISOString().split('T')[0];
                  const workedSunday = result.proposedSchedules.some(ps => ps.analystId === cand.id && ps.date === sundayStr);
                  if (workedSunday) continue;
                }
                if (dow === 1) {
                  const weekSunday = new Date(m.date + 'T00:00:00.000Z');
                  weekSunday.setDate(weekSunday.getDate() - weekSunday.getDay());
                  const saturday = new Date(weekSunday);
                  saturday.setDate(weekSunday.getDate() + 6);
                  const saturdayStr = saturday.toISOString().split('T')[0];
                  const worksSaturday = result.proposedSchedules.some(ps => ps.analystId === cand.id && ps.date === saturdayStr);
                  if (worksSaturday) continue;
                }
                // Accept
                result.proposedSchedules.push({ date: m.date, analystId: cand.id, shiftType: shift, isScreener: false, type: 'NEW_SCHEDULE' } as any);
                keys.add(candKey);
                added++;
                break;
              }
            }
          }
        }
        if (added === 0) break;
      }

      // Ensure weekday screeners: for each weekday, if screener missing for a shift, assign one from working analysts
      const byDateShiftWorking: Record<string, { MORNING: string[]; EVENING: string[] }> = {} as any;
      const hasScreener: Record<string, { MORNING: boolean; EVENING: boolean }> = {} as any;
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        const iso = new Date(d).toISOString().split('T')[0];
        byDateShiftWorking[iso] = { MORNING: [], EVENING: [] };
        hasScreener[iso] = { MORNING: false, EVENING: false };
      }
      for (const s of result.proposedSchedules) {
        const iso = s.date;
        if (!byDateShiftWorking[iso]) {
          byDateShiftWorking[iso] = { MORNING: [], EVENING: [] } as any;
          hasScreener[iso] = { MORNING: false, EVENING: false } as any;
        }
        if (s.shiftType === 'MORNING' || s.shiftType === 'EVENING') {
          if (s.isScreener) {
            // @ts-ignore
            hasScreener[iso][s.shiftType] = true;
          } else {
            // @ts-ignore
            byDateShiftWorking[iso][s.shiftType].push(s.analystId);
          }
        }
      }
      const keysForScreeners = new Set(result.proposedSchedules.map((s: any)=>`${s.analystId}|${s.date}|${s.shiftType}|S`));
      for (const iso of Object.keys(byDateShiftWorking)) {
        const dow = new Date(iso + 'T00:00:00.000Z').getDay();
        if (dow >= 1 && dow <= 5) {
          for (const shift of ['MORNING','EVENING'] as const) {
            // @ts-ignore
            if (!hasScreener[iso][shift]) {
              // @ts-ignore
              const workers = byDateShiftWorking[iso][shift];
              if (workers.length > 0) {
                const cand = workers[0];
                const k = `${cand}|${iso}|${shift}|S`;
                if (!keysForScreeners.has(k)) {
                  // Mark existing working assignment as screener instead of creating a new row
                  const existingIdx = result.proposedSchedules.findIndex((ps: any) => ps.analystId === cand && ps.date === iso && ps.shiftType === shift);
                  if (existingIdx >= 0) {
                    result.proposedSchedules[existingIdx].isScreener = true;
                    // keep existing type; screener is a flag, not a separate schedule type
                  } else {
                    // Fallback: if not present (unlikely), create once
                    result.proposedSchedules.push({ date: iso, analystId: cand, shiftType: shift, isScreener: true, type: 'NEW_SCHEDULE' } as any);
                  }
                  keysForScreeners.add(k);
                }
              }
            }
          }
        }
      }
    } catch {}

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
      const daysDiff = (sortedDates[i].getTime() - sortedDates[i-1].getTime()) / (1000 * 60 * 60 * 24);
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
  },

  // Compensatory Time Off System Resolvers
  compOffBalance: async (_: any, { analystId }: { analystId: string }) => {
    try {
      return await compOffBankService.getCompOffBalance(analystId);
    } catch (error: any) {
      throw new GraphQLError(`Failed to get comp-off balance: ${error.message}`);
    }
  },

  compOffTransactions: async (_: any, { analystId, startDate, endDate }: { 
    analystId: string; 
    startDate?: Date; 
    endDate?: Date; 
  }) => {
    try {
      const start = startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // 30 days ago
      const end = endDate || new Date();
      
      return await compOffBankService.getCompOffTransactions(analystId, start, end);
    } catch (error: any) {
      throw new GraphQLError(`Failed to get comp-off transactions: ${error.message}`);
    }
  },

  weeklyWorkloads: async (_: any, { analystId, startDate, endDate }: { 
    analystId?: string; 
    startDate?: Date; 
    endDate?: Date; 
  }) => {
    try {
      const start = startDate || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000); // 1 week ago
      const end = endDate || new Date();
      
      if (analystId) {
        // Get workload for specific analyst
        const workloads = [];
        const currentDate = new Date(start);
        
        while (currentDate <= end) {
          const weekStart = new Date(currentDate);
          weekStart.setDate(currentDate.getDate() - currentDate.getDay()); // Start of week
          
          const workload = await workloadBalancingSystem.analyzeWeeklyWorkload(analystId, weekStart);
          workloads.push(workload);
          
          currentDate.setDate(currentDate.getDate() + 7); // Next week
        }
        
        return workloads;
      } else {
        // Get workloads for all analysts
        const analysts = await prisma.analyst.findMany({ where: { isActive: true } });
        const analystIds = analysts.map(a => a.id);
        
        const result = await workloadBalancingSystem.analyzeWorkloadBalance(analystIds, start, end);
        return result.workloads;
      }
    } catch (error: any) {
      throw new GraphQLError(`Failed to get weekly workloads: ${error.message}`);
    }
  },

  rotationStates: async (_: any, { algorithmType, shiftType }: { 
    algorithmType?: string; 
    shiftType?: string; 
  }) => {
    try {
      const states = [];
      
      if (algorithmType && shiftType) {
        // Get specific rotation state
        const state = await rotationStateManager.getCurrentRotationState(algorithmType, shiftType as 'MORNING' | 'EVENING');
        if (state) {
          states.push(state);
        }
      } else {
        // Get all rotation states
        const allStates = await prisma.rotationState.findMany({
          orderBy: { lastUpdated: 'desc' }
        });
        
        for (const state of allStates) {
          const mappedState = {
            id: state.id,
            algorithmType: state.algorithmType,
            shiftType: state.shiftType,
            currentSunThuAnalyst: state.currentSunThuAnalyst,
            currentTueSatAnalyst: state.currentTueSatAnalyst,
            completedAnalysts: JSON.parse(state.completedAnalysts || '[]'),
            inProgressAnalysts: JSON.parse(state.inProgressAnalysts || '[]'),
            lastUpdated: state.lastUpdated
          };
          states.push(mappedState);
        }
      }
      
      return states;
    } catch (error: any) {
      throw new GraphQLError(`Failed to get rotation states: ${error.message}`);
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

    // After creation, enforce override banking if week > 5 worked days (Sun–Sat)
    try {
      const weekStart = new Date(date);
      weekStart.setHours(0,0,0,0);
      weekStart.setDate(weekStart.getDate() - weekStart.getDay());
      const workload = await workloadBalancingSystem.analyzeWeeklyWorkload(analystId, weekStart);
      if (workload.overtimeDays > 0) {
        await autoCompAssignmentEngine.processOvertimeWork(analystId, weekStart, workload.overtimeDays);
      }
    } catch {}

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

    // After update, enforce override banking
    try {
      const analystId = schedule.analystId;
      const date = schedule.date;
      const weekStart = new Date(date);
      weekStart.setHours(0,0,0,0);
      weekStart.setDate(weekStart.getDate() - weekStart.getDay());
      const workload = await workloadBalancingSystem.analyzeWeeklyWorkload(analystId, weekStart);
      if (workload.overtimeDays > 0) {
        await autoCompAssignmentEngine.processOvertimeWork(analystId, weekStart, workload.overtimeDays);
      }
    } catch {}

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

    // If overwriting, perform sync: delete any schedules in range not present in proposals
    if (overwriteExisting) {
      const proposedKeys = new Set<string>();
      for (const s of result.proposedSchedules) {
        const key = `${s.analystId}|${s.date}|${s.shiftType}|${s.isScreener ? '1' : '0'}`;
        proposedKeys.add(key);
      }
      const existingInRange = await prisma.schedule.findMany({ where: { date: { gte: start, lte: end } } });
      for (const ex of existingInRange) {
        const d = ex.date.toISOString().split('T')[0];
        const key = `${ex.analystId}|${d}|${ex.shiftType}|${ex.isScreener ? '1' : '0'}`;
        if (!proposedKeys.has(key)) {
          await prisma.schedule.delete({ where: { id: ex.id } });
        }
      }
    }

    // Conflict coalescing structures and duplicate guard
    const appliedKeys = new Set<string>(); // analystId|date
    const fridayConflicts = new Map<string, Set<string>>(); // weekSundayISO -> analystIds
    const mondayConflicts = new Map<string, Set<string>>(); // weekSundayISO -> analystIds

    // Apply schedules to database
    for (const schedule of result.proposedSchedules) {
      try {
        // Pre-apply guard: block Friday if analyst worked Sunday of the same week
        const applyDate = new Date(schedule.date);
        const day = applyDate.getDay();
        if (day === 5) {
          const weekSunday = new Date(applyDate);
          weekSunday.setHours(0,0,0,0);
          weekSunday.setDate(weekSunday.getDate() - weekSunday.getDay());
          const sundayStr = weekSunday.toISOString().split('T')[0];
          const workedSunday = result.proposedSchedules.some(ps => ps.analystId === schedule.analystId && ps.date === sundayStr);
          if (workedSunday) {
            const weekKey = new Date(sundayStr + 'T00:00:00.000Z').toISOString().slice(0,10);
            const set = fridayConflicts.get(weekKey) || new Set<string>();
            set.add(schedule.analystId);
            fridayConflicts.set(weekKey, set);
            continue;
          }
        }
        // Pre-apply guard: block Monday if analyst works Saturday of the same week
        if (day === 1) {
          const weekSunday = new Date(applyDate);
          weekSunday.setHours(0,0,0,0);
          weekSunday.setDate(weekSunday.getDate() - weekSunday.getDay());
          const weekSaturday = new Date(weekSunday);
          weekSaturday.setDate(weekSunday.getDate() + 6);
          const saturdayStr = weekSaturday.toISOString().split('T')[0];
          const worksSaturday = result.proposedSchedules.some(ps => ps.analystId === schedule.analystId && ps.date === saturdayStr);
          if (worksSaturday) {
            const weekKey = weekSunday.toISOString().slice(0,10);
            const set = mondayConflicts.get(weekKey) || new Set<string>();
            set.add(schedule.analystId);
            mondayConflicts.set(weekKey, set);
            continue;
          }
        }
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
          // Skip identical duplicates within this apply run
          const key = `${schedule.analystId}|${schedule.date}`;
          if (appliedKeys.has(key)) {
            // already applied in this batch
          } else {
            // Double-check DB for existing identical record to avoid unique constraint
            const existingSameDay = await prisma.schedule.findFirst({
              where: { analystId: schedule.analystId, date: new Date(schedule.date) }
            });
            if (existingSameDay) {
              if (overwriteExisting && (existingSameDay.shiftType !== schedule.shiftType || existingSameDay.isScreener !== schedule.isScreener)) {
                await prisma.schedule.update({
                  where: { id: existingSameDay.id },
                  data: { shiftType: schedule.shiftType, isScreener: schedule.isScreener }
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
            appliedKeys.add(key);
          }
        }

        // After each apply, enforce override banking for the affected week
        try {
          const weekStart = new Date(schedule.date);
          weekStart.setHours(0,0,0,0);
          weekStart.setDate(weekStart.getDate() - weekStart.getDay());
          const workload = await workloadBalancingSystem.analyzeWeeklyWorkload(schedule.analystId, weekStart);
          if (workload.overtimeDays > 0) {
            await autoCompAssignmentEngine.processOvertimeWork(schedule.analystId, weekStart, workload.overtimeDays);
          }
        } catch {}
      } catch (error) {
        result.conflicts.push({
          date: schedule.date,
          type: 'CONSTRAINT_VIOLATION',
          description: error instanceof Error ? error.message : 'Failed to apply schedule',
          severity: 'HIGH'
        });
      }
    }

    // Advance rotation state after successful apply to ensure weekend rotation progresses
    try {
      // Get current rotation assignments and update state for both shifts
      const morningAnalysts = analysts.filter(a => a.shiftType === 'MORNING' && a.isActive);
      const eveningAnalysts = analysts.filter(a => a.shiftType === 'EVENING' && a.isActive);
      
      if (morningAnalysts.length > 0) {
        const morningAssignment = await rotationStateManager.getRotationAssignments('enhanced-weekend-rotation', 'MORNING', start, morningAnalysts);
        if (morningAssignment) {
          await rotationStateManager.updateRotationState('enhanced-weekend-rotation', 'MORNING', morningAssignment, morningAnalysts);
        }
      }
      
      if (eveningAnalysts.length > 0) {
        const eveningAssignment = await rotationStateManager.getRotationAssignments('enhanced-weekend-rotation', 'EVENING', start, eveningAnalysts);
        if (eveningAssignment) {
          await rotationStateManager.updateRotationState('enhanced-weekend-rotation', 'EVENING', eveningAssignment, eveningAnalysts);
        }
      }
    } catch (error) {
      console.warn('Failed to advance rotation state:', error);
    }

    // Coalesce guard conflicts into one per week and rule
    for (const [weekKey, set] of fridayConflicts.entries()) {
      result.conflicts.push({
        date: weekKey,
        type: 'CONSTRAINT_VIOLATION',
        description: `Friday-after-Sunday rule: blocked ${set.size} assignment(s) this week`,
        severity: 'CRITICAL',
        affectedAnalysts: Array.from(set)
      } as any);
    }
    for (const [weekKey, set] of mondayConflicts.entries()) {
      result.conflicts.push({
        date: weekKey,
        type: 'CONSTRAINT_VIOLATION',
        description: `Monday-when-Saturday rule: blocked ${set.size} assignment(s) this week`,
        severity: 'CRITICAL',
        affectedAnalysts: Array.from(set)
      } as any);
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
      const daysDiff = (sortedDates[i].getTime() - sortedDates[i-1].getTime()) / (1000 * 60 * 60 * 24);
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

// CompOffTransaction resolver
const CompOffTransaction = {
  analyst: async (parent: any) => {
    return await prisma.analyst.findUnique({ where: { id: parent.analystId } });
  }
};

// WeeklyWorkload resolver
const WeeklyWorkload = {
  analyst: async (parent: any) => {
    return await prisma.analyst.findUnique({ where: { id: parent.analystId } });
  },
  
  violations: async (parent: any) => {
    return await prisma.workloadViolation.findMany({
      where: { workloadId: parent.id }
    });
  }
};

// WorkloadViolation resolver
const WorkloadViolation = {
  workload: async (parent: any) => {
    return await prisma.weeklyWorkload.findUnique({ where: { id: parent.workloadId } });
  }
};

// RotationState resolver
const RotationState = {
  sunThuAnalyst: async (parent: any) => {
    if (!parent.currentSunThuAnalyst) return null;
    return await prisma.analyst.findUnique({ where: { id: parent.currentSunThuAnalyst } });
  },
  
  tueSatAnalyst: async (parent: any) => {
    if (!parent.currentTueSatAnalyst) return null;
    return await prisma.analyst.findUnique({ where: { id: parent.currentTueSatAnalyst } });
  },
  
  completedAnalystsList: async (parent: any) => {
    if (!parent.completedAnalysts || parent.completedAnalysts.length === 0) return [];
    return await prisma.analyst.findMany({
      where: { id: { in: parent.completedAnalysts } }
    });
  },
  
  inProgressAnalystsList: async (parent: any) => {
    if (!parent.inProgressAnalysts || parent.inProgressAnalysts.length === 0) return [];
    return await prisma.analyst.findMany({
      where: { id: { in: parent.inProgressAnalysts } }
    });
  }
};

export const resolvers = {
  ...dateTimeScalar,
  ...jsonScalar,
  Query,
  Mutation,
  Analyst,
  CompOffTransaction,
  WeeklyWorkload,
  WorkloadViolation,
  RotationState
}; 