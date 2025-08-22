"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolvers = void 0;
const graphql_1 = require("graphql");
const prisma_1 = require("../lib/prisma");
const cache_1 = require("../lib/cache");
const AlgorithmRegistry_1 = require("../services/scheduling/AlgorithmRegistry");
const FairnessEngine_1 = require("../services/scheduling/algorithms/FairnessEngine");
const prisma_2 = require("../lib/prisma");
const CalendarExportService_1 = require("../services/CalendarExportService");
// Custom scalar resolvers
const dateTimeScalar = {
    DateTime: {
        serialize: (value) => value.toISOString(),
        parseValue: (value) => new Date(value),
        parseLiteral: (ast) => {
            if (ast.kind === 'StringValue') {
                return new Date(ast.value);
            }
            return null;
        },
    },
};
const jsonScalar = {
    JSON: {
        serialize: (value) => value,
        parseValue: (value) => value,
        parseLiteral: (ast) => {
            if (ast.kind === 'ObjectValue') {
                return ast.fields.reduce((obj, field) => {
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
    health: () => __awaiter(void 0, void 0, void 0, function* () {
        try {
            yield prisma_1.prisma.$queryRaw `SELECT 1`;
            const cacheHealthy = yield cache_1.cacheService.healthCheck();
            const performanceMetrics = (0, prisma_2.getDatabasePerformance)();
            const cacheStats = yield cache_1.cacheService.getStats();
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
        }
        catch (error) {
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
    }),
    // Analysts
    analysts: (_1, _a) => __awaiter(void 0, [_1, _a], void 0, function* (_, { filter }) {
        const where = {};
        if (filter) {
            if (filter.isActive !== undefined)
                where.isActive = filter.isActive;
            if (filter.shiftType)
                where.shiftType = filter.shiftType;
            if (filter.skills && filter.skills.length > 0) {
                where.skills = { hasSome: filter.skills };
            }
        }
        return yield prisma_1.prisma.analyst.findMany({
            where,
            include: {
                preferences: true,
                schedules: true,
                vacations: true,
                constraints: true,
            },
            orderBy: { name: 'asc' }
        });
    }),
    analyst: (_1, _a) => __awaiter(void 0, [_1, _a], void 0, function* (_, { id }) {
        return yield prisma_1.prisma.analyst.findUnique({
            where: { id },
            include: {
                preferences: true,
                schedules: true,
                vacations: true,
                constraints: true,
            }
        });
    }),
    // Schedules
    schedules: (_1, _a) => __awaiter(void 0, [_1, _a], void 0, function* (_, { filter }) {
        const where = {};
        if (filter) {
            if (filter.startDate)
                where.date = { gte: filter.startDate };
            if (filter.endDate)
                where.date = Object.assign(Object.assign({}, where.date), { lte: filter.endDate });
            if (filter.analystId)
                where.analystId = filter.analystId;
            if (filter.shiftType)
                where.shiftType = filter.shiftType;
            if (filter.isScreener !== undefined)
                where.isScreener = filter.isScreener;
        }
        return yield prisma_1.prisma.schedule.findMany({
            where,
            include: { analyst: true },
            orderBy: { date: 'asc' }
        });
    }),
    schedule: (_1, _a) => __awaiter(void 0, [_1, _a], void 0, function* (_, { id }) {
        return yield prisma_1.prisma.schedule.findUnique({
            where: { id },
            include: { analyst: true }
        });
    }),
    // Vacations
    vacations: (_1, _a) => __awaiter(void 0, [_1, _a], void 0, function* (_, { analystId }) {
        const where = {};
        if (analystId)
            where.analystId = analystId;
        return yield prisma_1.prisma.vacation.findMany({
            where,
            include: { analyst: true },
            orderBy: { startDate: 'asc' }
        });
    }),
    vacation: (_1, _a) => __awaiter(void 0, [_1, _a], void 0, function* (_, { id }) {
        return yield prisma_1.prisma.vacation.findUnique({
            where: { id },
            include: { analyst: true }
        });
    }),
    // Constraints
    constraints: (_1, _a) => __awaiter(void 0, [_1, _a], void 0, function* (_, { analystId }) {
        const where = { isActive: true };
        if (analystId)
            where.analystId = analystId;
        return yield prisma_1.prisma.schedulingConstraint.findMany({
            where,
            include: { analyst: true },
            orderBy: { startDate: 'asc' }
        });
    }),
    constraint: (_1, _a) => __awaiter(void 0, [_1, _a], void 0, function* (_, { id }) {
        return yield prisma_1.prisma.schedulingConstraint.findUnique({
            where: { id },
            include: { analyst: true }
        });
    }),
    // Algorithm configurations
    algorithmConfigs: () => __awaiter(void 0, void 0, void 0, function* () {
        return yield prisma_1.prisma.algorithmConfig.findMany({
            orderBy: { name: 'asc' }
        });
    }),
    algorithmConfig: (_1, _a) => __awaiter(void 0, [_1, _a], void 0, function* (_, { id }) {
        return yield prisma_1.prisma.algorithmConfig.findUnique({
            where: { id }
        });
    }),
    // Schedule generation
    generateSchedulePreview: (_1, _a) => __awaiter(void 0, [_1, _a], void 0, function* (_, { input }) {
        var _b, _c;
        const algorithm = AlgorithmRegistry_1.AlgorithmRegistry.getAlgorithm(input.algorithmType);
        if (!algorithm) {
            throw new graphql_1.GraphQLError(`Algorithm '${input.algorithmType}' not found.`);
        }
        const start = new Date(input.startDate);
        const end = new Date(input.endDate);
        const analysts = yield prisma_1.prisma.analyst.findMany({
            where: { isActive: true },
            include: {
                vacations: { where: { isApproved: true, OR: [{ startDate: { lte: end }, endDate: { gte: start } }] } },
                constraints: { where: { isActive: true, OR: [{ startDate: { lte: end }, endDate: { gte: start } }] } }
            },
            orderBy: { name: 'asc' }
        });
        if (analysts.length === 0) {
            throw new graphql_1.GraphQLError('No active analysts found');
        }
        const existingSchedules = yield prisma_1.prisma.schedule.findMany({
            where: { date: { gte: start, lte: end } },
            include: { analyst: true }
        });
        const globalConstraints = yield prisma_1.prisma.schedulingConstraint.findMany({
            where: { analystId: null, isActive: true, startDate: { lte: end }, endDate: { gte: start } }
        });
        const result = yield algorithm.generateSchedules({
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
                newSchedules: result.proposedSchedules.filter((s) => s.type === 'NEW_SCHEDULE').length,
                overwrittenSchedules: result.overwrites.length,
                conflicts: result.conflicts.length,
                fairnessScore: ((_b = result.fairnessMetrics) === null || _b === void 0 ? void 0 : _b.overallFairnessScore) || 0,
                executionTime: ((_c = result.performanceMetrics) === null || _c === void 0 ? void 0 : _c.algorithmExecutionTime) || 0
            }
        };
    }),
    // Analytics
    analyticsData: (_1, _a) => __awaiter(void 0, [_1, _a], void 0, function* (_, { analystId, startDate, endDate }) {
        // This would query the actual analytics data table when it exists
        // For now, return empty array as placeholder
        return [];
    }),
    // Advanced Analytics
    monthlyTallies: (_1, _a) => __awaiter(void 0, [_1, _a], void 0, function* (_, { month, year }) {
        const { AnalyticsEngine } = yield Promise.resolve().then(() => __importStar(require('../services/AnalyticsEngine')));
        const analyticsEngine = new AnalyticsEngine(prisma_1.prisma, cache_1.cacheService);
        return yield analyticsEngine.calculateMonthlyTallies(month, year);
    }),
    fairnessReport: (_1, _a) => __awaiter(void 0, [_1, _a], void 0, function* (_, { startDate, endDate }) {
        const { AnalyticsEngine } = yield Promise.resolve().then(() => __importStar(require('../services/AnalyticsEngine')));
        const analyticsEngine = new AnalyticsEngine(prisma_1.prisma, cache_1.cacheService);
        return yield analyticsEngine.generateFairnessReport({ startDate, endDate });
    }),
    workloadPredictions: (_1, _a) => __awaiter(void 0, [_1, _a], void 0, function* (_, { months }) {
        const { AnalyticsEngine } = yield Promise.resolve().then(() => __importStar(require('../services/AnalyticsEngine')));
        const analyticsEngine = new AnalyticsEngine(prisma_1.prisma, cache_1.cacheService);
        return yield analyticsEngine.predictWorkloadTrends(months);
    }),
    optimizationOpportunities: (_1, _a) => __awaiter(void 0, [_1, _a], void 0, function* (_, { dateRange }) {
        const { AnalyticsEngine } = yield Promise.resolve().then(() => __importStar(require('../services/AnalyticsEngine')));
        const analyticsEngine = new AnalyticsEngine(prisma_1.prisma, cache_1.cacheService);
        let schedules;
        if (dateRange) {
            const [startDate, endDate] = dateRange.split(',');
            schedules = yield prisma_1.prisma.schedule.findMany({
                where: {
                    date: {
                        gte: new Date(startDate),
                        lte: new Date(endDate),
                    },
                },
                include: { analyst: true },
            });
        }
        else {
            schedules = yield prisma_1.prisma.schedule.findMany({
                where: {
                    date: {
                        gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
                    },
                },
                include: { analyst: true },
            });
        }
        return yield analyticsEngine.identifyOptimizationOpportunities(schedules);
    }),
    // Predictive Intelligence
    staffingPrediction: (_1, _a) => __awaiter(void 0, [_1, _a], void 0, function* (_, { date }) {
        const { PredictiveEngine } = yield Promise.resolve().then(() => __importStar(require('../services/PredictiveEngine')));
        const predictiveEngine = new PredictiveEngine(prisma_1.prisma, cache_1.cacheService);
        return yield predictiveEngine.predictStaffingNeeds(date);
    }),
    burnoutRiskAssessments: (_1, _a) => __awaiter(void 0, [_1, _a], void 0, function* (_, { includeLowRisk = false }) {
        const { PredictiveEngine } = yield Promise.resolve().then(() => __importStar(require('../services/PredictiveEngine')));
        const predictiveEngine = new PredictiveEngine(prisma_1.prisma, cache_1.cacheService);
        const analysts = yield prisma_1.prisma.analyst.findMany({
            where: { isActive: true },
        });
        const assessments = yield predictiveEngine.identifyBurnoutRisk(analysts);
        return includeLowRisk
            ? assessments
            : assessments.filter(assessment => assessment.riskLevel !== 'LOW');
    }),
    rotationSuggestions: () => __awaiter(void 0, void 0, void 0, function* () {
        const { PredictiveEngine } = yield Promise.resolve().then(() => __importStar(require('../services/PredictiveEngine')));
        const predictiveEngine = new PredictiveEngine(prisma_1.prisma, cache_1.cacheService);
        const constraints = yield prisma_1.prisma.schedulingConstraint.findMany();
        return yield predictiveEngine.suggestOptimalRotations(constraints);
    }),
    conflictForecasts: (_1, _a) => __awaiter(void 0, [_1, _a], void 0, function* (_, { pattern }) {
        const { PredictiveEngine } = yield Promise.resolve().then(() => __importStar(require('../services/PredictiveEngine')));
        const predictiveEngine = new PredictiveEngine(prisma_1.prisma, cache_1.cacheService);
        return yield predictiveEngine.forecastConflicts(pattern);
    }),
    // Dashboard
    dashboard: () => __awaiter(void 0, void 0, void 0, function* () {
        const { DashboardService } = yield Promise.resolve().then(() => __importStar(require('../services/DashboardService')));
        const { AnalyticsEngine } = yield Promise.resolve().then(() => __importStar(require('../services/AnalyticsEngine')));
        const { PredictiveEngine } = yield Promise.resolve().then(() => __importStar(require('../services/PredictiveEngine')));
        const analyticsEngine = new AnalyticsEngine(prisma_1.prisma, cache_1.cacheService);
        const predictiveEngine = new PredictiveEngine(prisma_1.prisma, cache_1.cacheService);
        const dashboardService = new DashboardService(prisma_1.prisma, cache_1.cacheService, analyticsEngine, predictiveEngine);
        return yield dashboardService.generateRealTimeDashboard();
    }),
    // Reports and Exports
    customReport: (_1, _a) => __awaiter(void 0, [_1, _a], void 0, function* (_, { config }) {
        const { DashboardService } = yield Promise.resolve().then(() => __importStar(require('../services/DashboardService')));
        const { AnalyticsEngine } = yield Promise.resolve().then(() => __importStar(require('../services/AnalyticsEngine')));
        const { PredictiveEngine } = yield Promise.resolve().then(() => __importStar(require('../services/PredictiveEngine')));
        const analyticsEngine = new AnalyticsEngine(prisma_1.prisma, cache_1.cacheService);
        const predictiveEngine = new PredictiveEngine(prisma_1.prisma, cache_1.cacheService);
        const dashboardService = new DashboardService(prisma_1.prisma, cache_1.cacheService, analyticsEngine, predictiveEngine);
        return yield dashboardService.createCustomReport(config);
    }),
    exportAnalytics: (_1, _a) => __awaiter(void 0, [_1, _a], void 0, function* (_, { format, filters }) {
        const { DashboardService } = yield Promise.resolve().then(() => __importStar(require('../services/DashboardService')));
        const { AnalyticsEngine } = yield Promise.resolve().then(() => __importStar(require('../services/AnalyticsEngine')));
        const { PredictiveEngine } = yield Promise.resolve().then(() => __importStar(require('../services/PredictiveEngine')));
        const analyticsEngine = new AnalyticsEngine(prisma_1.prisma, cache_1.cacheService);
        const predictiveEngine = new PredictiveEngine(prisma_1.prisma, cache_1.cacheService);
        const dashboardService = new DashboardService(prisma_1.prisma, cache_1.cacheService, analyticsEngine, predictiveEngine);
        return yield dashboardService.exportAnalytics(format, filters);
    }),
    workloadAnalysis: (_1, _a) => __awaiter(void 0, [_1, _a], void 0, function* (_, { analystId }) {
        const analyst = yield prisma_1.prisma.analyst.findUnique({
            where: { id: analystId },
            include: { schedules: true }
        });
        if (!analyst) {
            throw new graphql_1.GraphQLError('Analyst not found');
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
            }
            else {
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
            shiftType: schedule.shiftType,
            isScreener: schedule.isScreener,
            type: 'NEW_SCHEDULE'
        }));
        const fairnessScore = FairnessEngine_1.fairnessEngine.calculateIndividualFairnessScore(proposedSchedules, 1);
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
    }),
    // Fairness metrics
    fairnessMetrics: (_1, _a) => __awaiter(void 0, [_1, _a], void 0, function* (_, { schedules }) {
        const scheduleData = yield prisma_1.prisma.schedule.findMany({
            where: { id: { in: schedules } },
            include: { analyst: true }
        });
        const analysts = yield prisma_1.prisma.analyst.findMany({
            where: { isActive: true }
        });
        // Convert Schedule objects to ProposedSchedule format
        const proposedSchedules = scheduleData.map(schedule => ({
            date: schedule.date.toISOString().split('T')[0],
            analystId: schedule.analystId,
            analystName: schedule.analyst.name,
            shiftType: schedule.shiftType,
            isScreener: schedule.isScreener,
            type: 'NEW_SCHEDULE'
        }));
        return FairnessEngine_1.fairnessEngine.calculateFairness(proposedSchedules, analysts);
    }),
    // Performance metrics
    performanceMetrics: () => __awaiter(void 0, void 0, void 0, function* () {
        const dbMetrics = (0, prisma_2.getDatabasePerformance)();
        const cacheStats = yield cache_1.cacheService.getStats();
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
    }),
    // Calendar export
    calendarExport: (_1, _a) => __awaiter(void 0, [_1, _a], void 0, function* (_, { analystId, format, options }) {
        const calendarService = new CalendarExportService_1.CalendarExportService(prisma_1.prisma);
        try {
            switch (format) {
                case 'ICAL':
                    const icalContent = yield calendarService.generateICalFeed(analystId, options);
                    return {
                        format: 'ICAL',
                        content: icalContent,
                        filename: `schedule-${analystId}.ics`
                    };
                case 'GOOGLE_CALENDAR':
                    const googleEvents = yield calendarService.generateGoogleCalendarEvents(analystId, options);
                    return {
                        format: 'GOOGLE_CALENDAR',
                        content: JSON.stringify(googleEvents),
                        filename: `schedule-${analystId}-google.json`
                    };
                case 'OUTLOOK':
                    const outlookEvents = yield calendarService.generateOutlookEvents(analystId, options);
                    return {
                        format: 'OUTLOOK',
                        content: JSON.stringify(outlookEvents),
                        filename: `schedule-${analystId}-outlook.json`
                    };
                default:
                    throw new graphql_1.GraphQLError(`Unsupported calendar format: ${format}`);
            }
        }
        catch (error) {
            throw new graphql_1.GraphQLError(`Failed to generate calendar export: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }),
    // Team calendar export
    teamCalendarExport: (_1, _a) => __awaiter(void 0, [_1, _a], void 0, function* (_, { format, options }) {
        const calendarService = new CalendarExportService_1.CalendarExportService(prisma_1.prisma);
        try {
            if (format === 'ICAL') {
                const icalContent = yield calendarService.generateTeamCalendar(options);
                return {
                    format: 'ICAL',
                    content: icalContent,
                    filename: 'team-schedule.ics'
                };
            }
            else {
                throw new graphql_1.GraphQLError(`Team calendar export only supports ICAL format`);
            }
        }
        catch (error) {
            throw new graphql_1.GraphQLError(`Failed to generate team calendar export: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    })
};
// Mutation resolvers
const Mutation = {
    // Analysts
    createAnalyst: (_1, _a) => __awaiter(void 0, [_1, _a], void 0, function* (_, { input }) {
        const analyst = yield prisma_1.prisma.analyst.create({
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
    }),
    updateAnalyst: (_1, _a) => __awaiter(void 0, [_1, _a], void 0, function* (_, { id, input }) {
        const updateData = {};
        if (input.name !== undefined)
            updateData.name = input.name;
        if (input.email !== undefined)
            updateData.email = input.email;
        if (input.shiftType !== undefined)
            updateData.shiftType = input.shiftType;
        if (input.isActive !== undefined)
            updateData.isActive = input.isActive;
        if (input.customAttributes !== undefined)
            updateData.customAttributes = input.customAttributes;
        if (input.skills !== undefined)
            updateData.skills = input.skills;
        const analyst = yield prisma_1.prisma.analyst.update({
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
    }),
    deleteAnalyst: (_1, _a) => __awaiter(void 0, [_1, _a], void 0, function* (_, { id }) {
        yield prisma_1.prisma.analyst.delete({ where: { id } });
        return true;
    }),
    // Vacations
    createVacation: (_1, _a) => __awaiter(void 0, [_1, _a], void 0, function* (_, { input }) {
        const vacation = yield prisma_1.prisma.vacation.create({
            data: {
                analystId: input.analystId,
                startDate: input.startDate,
                endDate: input.endDate,
                reason: input.reason
            },
            include: { analyst: true }
        });
        return vacation;
    }),
    updateVacation: (_1, _a) => __awaiter(void 0, [_1, _a], void 0, function* (_, { id, input }) {
        const vacation = yield prisma_1.prisma.vacation.update({
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
    }),
    deleteVacation: (_1, _a) => __awaiter(void 0, [_1, _a], void 0, function* (_, { id }) {
        yield prisma_1.prisma.vacation.delete({ where: { id } });
        return true;
    }),
    approveVacation: (_1, _a) => __awaiter(void 0, [_1, _a], void 0, function* (_, { id }) {
        return yield prisma_1.prisma.vacation.update({
            where: { id },
            data: { isApproved: true },
            include: { analyst: true }
        });
    }),
    // Constraints
    createConstraint: (_1, _a) => __awaiter(void 0, [_1, _a], void 0, function* (_, { input }) {
        const constraint = yield prisma_1.prisma.schedulingConstraint.create({
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
    }),
    updateConstraint: (_1, _a) => __awaiter(void 0, [_1, _a], void 0, function* (_, { id, input }) {
        return yield prisma_1.prisma.schedulingConstraint.update({
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
    }),
    deleteConstraint: (_1, _a) => __awaiter(void 0, [_1, _a], void 0, function* (_, { id }) {
        yield prisma_1.prisma.schedulingConstraint.delete({ where: { id } });
        return true;
    }),
    // Schedules
    createSchedule: (_1, _a) => __awaiter(void 0, [_1, _a], void 0, function* (_, { analystId, date, shiftType, isScreener }) {
        const schedule = yield prisma_1.prisma.schedule.create({
            data: {
                analystId,
                date,
                shiftType: shiftType,
                isScreener
            },
            include: { analyst: true }
        });
        return schedule;
    }),
    updateSchedule: (_1, _a) => __awaiter(void 0, [_1, _a], void 0, function* (_, { id, shiftType, isScreener }) {
        const updateData = {};
        if (shiftType !== undefined)
            updateData.shiftType = shiftType;
        if (isScreener !== undefined)
            updateData.isScreener = isScreener;
        const schedule = yield prisma_1.prisma.schedule.update({
            where: { id },
            data: updateData,
            include: { analyst: true }
        });
        return schedule;
    }),
    deleteSchedule: (_1, _a) => __awaiter(void 0, [_1, _a], void 0, function* (_, { id }) {
        yield prisma_1.prisma.schedule.delete({ where: { id } });
        return true;
    }),
    // Algorithm configurations
    createAlgorithmConfig: (_1, _a) => __awaiter(void 0, [_1, _a], void 0, function* (_, { name, description, config }) {
        return yield prisma_1.prisma.algorithmConfig.create({
            data: { name, description, config }
        });
    }),
    updateAlgorithmConfig: (_1, _a) => __awaiter(void 0, [_1, _a], void 0, function* (_, { id, name, description, config, isActive }) {
        const updateData = {};
        if (name !== undefined)
            updateData.name = name;
        if (description !== undefined)
            updateData.description = description;
        if (config !== undefined)
            updateData.config = config;
        if (isActive !== undefined)
            updateData.isActive = isActive;
        return yield prisma_1.prisma.algorithmConfig.update({
            where: { id },
            data: updateData
        });
    }),
    deleteAlgorithmConfig: (_1, _a) => __awaiter(void 0, [_1, _a], void 0, function* (_, { id }) {
        yield prisma_1.prisma.algorithmConfig.delete({ where: { id } });
        return true;
    }),
    // Schedule generation
    generateSchedules: (_1, _a) => __awaiter(void 0, [_1, _a], void 0, function* (_, { input }) {
        const algorithm = AlgorithmRegistry_1.AlgorithmRegistry.getAlgorithm(input.algorithmType);
        if (!algorithm) {
            throw new graphql_1.GraphQLError(`Algorithm '${input.algorithmType}' not found.`);
        }
        const start = new Date(input.startDate);
        const end = new Date(input.endDate);
        const analysts = yield prisma_1.prisma.analyst.findMany({
            where: { isActive: true },
            include: {
                vacations: { where: { isApproved: true, OR: [{ startDate: { lte: end }, endDate: { gte: start } }] } },
                constraints: { where: { isActive: true, OR: [{ startDate: { lte: end }, endDate: { gte: start } }] } }
            },
            orderBy: { name: 'asc' }
        });
        if (analysts.length === 0) {
            throw new graphql_1.GraphQLError('No active analysts found');
        }
        const existingSchedules = yield prisma_1.prisma.schedule.findMany({
            where: { date: { gte: start, lte: end } },
            include: { analyst: true }
        });
        const globalConstraints = yield prisma_1.prisma.schedulingConstraint.findMany({
            where: { analystId: null, isActive: true, startDate: { lte: end }, endDate: { gte: start } }
        });
        const result = yield algorithm.generateSchedules({
            startDate: start,
            endDate: end,
            analysts,
            existingSchedules,
            globalConstraints,
            algorithmConfig: input.algorithmConfig
        });
        return result;
    }),
    applySchedules: (_1, _a) => __awaiter(void 0, [_1, _a], void 0, function* (_, { input, overwriteExisting }) {
        const algorithm = AlgorithmRegistry_1.AlgorithmRegistry.getAlgorithm(input.algorithmType);
        if (!algorithm) {
            throw new graphql_1.GraphQLError(`Algorithm '${input.algorithmType}' not found.`);
        }
        const start = new Date(input.startDate);
        const end = new Date(input.endDate);
        const analysts = yield prisma_1.prisma.analyst.findMany({
            where: { isActive: true },
            include: {
                vacations: { where: { isApproved: true, OR: [{ startDate: { lte: end }, endDate: { gte: start } }] } },
                constraints: { where: { isActive: true, OR: [{ startDate: { lte: end }, endDate: { gte: start } }] } }
            },
            orderBy: { name: 'asc' }
        });
        if (analysts.length === 0) {
            throw new graphql_1.GraphQLError('No active analysts found');
        }
        const existingSchedules = yield prisma_1.prisma.schedule.findMany({
            where: { date: { gte: start, lte: end } },
            include: { analyst: true }
        });
        const globalConstraints = yield prisma_1.prisma.schedulingConstraint.findMany({
            where: { analystId: null, isActive: true, startDate: { lte: end }, endDate: { gte: start } }
        });
        const result = yield algorithm.generateSchedules({
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
                const existing = existingSchedules.find(s => s.analystId === schedule.analystId &&
                    new Date(s.date).toISOString().split('T')[0] === schedule.date);
                if (existing) {
                    if (overwriteExisting && (existing.shiftType !== schedule.shiftType || existing.isScreener !== schedule.isScreener)) {
                        yield prisma_1.prisma.schedule.update({
                            where: { id: existing.id },
                            data: {
                                shiftType: schedule.shiftType,
                                isScreener: schedule.isScreener
                            }
                        });
                    }
                }
                else {
                    yield prisma_1.prisma.schedule.create({
                        data: {
                            analystId: schedule.analystId,
                            date: new Date(schedule.date),
                            shiftType: schedule.shiftType,
                            isScreener: schedule.isScreener
                        }
                    });
                }
            }
            catch (error) {
                result.conflicts.push({
                    date: schedule.date,
                    type: 'CONSTRAINT_VIOLATION',
                    description: error instanceof Error ? error.message : 'Failed to apply schedule',
                    severity: 'HIGH'
                });
            }
        }
        return result;
    }),
    // System operations
    warmCache: () => __awaiter(void 0, void 0, void 0, function* () {
        yield cache_1.cacheService.warmCache();
        return true;
    })
};
// Field resolvers for computed fields
const Analyst = {
    totalWorkDays: (parent) => __awaiter(void 0, void 0, void 0, function* () {
        const schedules = yield prisma_1.prisma.schedule.findMany({
            where: { analystId: parent.id }
        });
        return schedules.length;
    }),
    screenerDays: (parent) => __awaiter(void 0, void 0, void 0, function* () {
        const schedules = yield prisma_1.prisma.schedule.findMany({
            where: { analystId: parent.id, isScreener: true }
        });
        return schedules.length;
    }),
    weekendDays: (parent) => __awaiter(void 0, void 0, void 0, function* () {
        const schedules = yield prisma_1.prisma.schedule.findMany({
            where: { analystId: parent.id }
        });
        return schedules.filter(s => {
            const dayOfWeek = s.date.getDay();
            return dayOfWeek === 0 || dayOfWeek === 6;
        }).length;
    }),
    fairnessScore: (parent) => __awaiter(void 0, void 0, void 0, function* () {
        const schedules = yield prisma_1.prisma.schedule.findMany({
            where: { analystId: parent.id }
        });
        // Convert Schedule objects to ProposedSchedule format
        const proposedSchedules = schedules.map(schedule => ({
            date: schedule.date.toISOString().split('T')[0],
            analystId: schedule.analystId,
            analystName: parent.name,
            shiftType: schedule.shiftType,
            isScreener: schedule.isScreener,
            type: 'NEW_SCHEDULE'
        }));
        return FairnessEngine_1.fairnessEngine.calculateIndividualFairnessScore(proposedSchedules, 1);
    }),
    workloadAnalysis: (parent) => __awaiter(void 0, void 0, void 0, function* () {
        const schedules = yield prisma_1.prisma.schedule.findMany({
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
            }
            else {
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
            shiftType: schedule.shiftType,
            isScreener: schedule.isScreener,
            type: 'NEW_SCHEDULE'
        }));
        const fairnessScore = FairnessEngine_1.fairnessEngine.calculateIndividualFairnessScore(proposedSchedules, 1);
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
    })
};
exports.resolvers = Object.assign(Object.assign(Object.assign({}, dateTimeScalar), jsonScalar), { Query,
    Mutation,
    Analyst });
