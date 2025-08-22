"use strict";
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
exports.DashboardService = void 0;
class DashboardService {
    constructor(prisma, cache, analyticsEngine, predictiveEngine) {
        this.prisma = prisma;
        this.cache = cache;
        this.analyticsEngine = analyticsEngine;
        this.predictiveEngine = predictiveEngine;
    }
    generateRealTimeDashboard() {
        return __awaiter(this, void 0, void 0, function* () {
            const cacheKey = 'real_time_dashboard';
            // Try to get from cache first (cache for 5 minutes)
            const cached = yield this.cache.get(cacheKey);
            if (cached) {
                return cached;
            }
            // Generate summary
            const summary = yield this.generateSummary();
            // Generate fairness metrics
            const fairnessMetrics = yield this.generateFairnessMetrics();
            // Generate workload distribution
            const workloadDistribution = yield this.generateWorkloadDistribution();
            // Get recent activity
            const recentActivity = yield this.getRecentActivity();
            // Get alerts
            const alerts = yield this.generateAlerts();
            // Get predictions
            const predictions = yield this.generatePredictions();
            // Get performance metrics
            const performanceMetrics = yield this.getPerformanceMetrics();
            const dashboardData = {
                summary,
                fairnessMetrics,
                workloadDistribution,
                recentActivity,
                alerts,
                predictions,
                performanceMetrics,
            };
            // Cache for 5 minutes
            yield this.cache.set(cacheKey, dashboardData, 300);
            return dashboardData;
        });
    }
    createCustomReport(config) {
        return __awaiter(this, void 0, void 0, function* () {
            const reportId = `report_${Date.now()}`;
            let data;
            let summary;
            let recommendations = [];
            switch (config.type) {
                case 'FAIRNESS_REPORT':
                    const fairnessReport = yield this.analyticsEngine.generateFairnessReport(config.dateRange);
                    data = fairnessReport;
                    summary = `Fairness analysis for ${config.dateRange.startDate.toDateString()} to ${config.dateRange.endDate.toDateString()}. Overall fairness score: ${(fairnessReport.overallFairnessScore * 100).toFixed(1)}%`;
                    recommendations = fairnessReport.recommendations;
                    break;
                case 'WORKLOAD_REPORT':
                    const monthlyTallies = yield this.analyticsEngine.calculateMonthlyTallies(config.dateRange.startDate.getMonth() + 1, config.dateRange.startDate.getFullYear());
                    data = monthlyTallies;
                    summary = `Workload analysis for ${config.dateRange.startDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}. Average workload: ${(monthlyTallies.reduce((sum, tally) => sum + tally.totalWorkDays, 0) / monthlyTallies.length).toFixed(1)} days`;
                    break;
                case 'CONFLICT_REPORT':
                    const conflicts = yield this.prisma.schedulingConstraint.findMany({
                        where: {
                            startDate: { gte: config.dateRange.startDate },
                            endDate: { lte: config.dateRange.endDate },
                        },
                        include: { analyst: true },
                    });
                    data = conflicts;
                    summary = `Conflict analysis for ${config.dateRange.startDate.toDateString()} to ${config.dateRange.endDate.toDateString()}. Total conflicts: ${conflicts.length}`;
                    break;
                case 'PERFORMANCE_REPORT':
                    const performanceData = yield this.getPerformanceMetrics();
                    data = performanceData;
                    summary = `Performance analysis. System health: ${performanceData.systemHealth}, Average query time: ${performanceData.averageQueryTime}ms`;
                    break;
                default:
                    throw new Error(`Unknown report type: ${config.type}`);
            }
            const report = {
                id: reportId,
                name: `${config.type} - ${new Date().toISOString()}`,
                type: config.type,
                generatedAt: new Date(),
                data,
                summary,
                recommendations,
            };
            return report;
        });
    }
    exportAnalytics(format, filters) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                let data;
                if (filters.dateRange) {
                    // Export data for specific date range
                    const schedules = yield this.prisma.schedule.findMany({
                        where: Object.assign(Object.assign({ date: {
                                gte: filters.dateRange.startDate,
                                lte: filters.dateRange.endDate,
                            } }, (filters.analystIds && { analystId: { in: filters.analystIds } })), (filters.shiftTypes && { shiftType: { in: filters.shiftTypes } })),
                        include: { analyst: true },
                    });
                    data = schedules.map((schedule) => ({
                        date: schedule.date,
                        analystName: schedule.analyst.name,
                        shiftType: schedule.shiftType,
                        isScreener: schedule.isScreener,
                    }));
                }
                else {
                    // Export all data
                    const schedules = yield this.prisma.schedule.findMany({
                        include: { analyst: true },
                    });
                    data = schedules.map((schedule) => ({
                        date: schedule.date,
                        analystName: schedule.analyst.name,
                        shiftType: schedule.shiftType,
                        isScreener: schedule.isScreener,
                    }));
                }
                // Apply additional filters
                if (filters.minFairnessScore || filters.maxWorkload) {
                    // This would require additional processing to apply fairness/workload filters
                    // For now, return the basic data
                }
                let exportData;
                let fileUrl;
                switch (format.type) {
                    case 'JSON':
                        exportData = data;
                        break;
                    case 'CSV':
                        exportData = this.convertToCSV(data);
                        break;
                    case 'PDF':
                        // This would require a PDF generation library
                        exportData = { message: 'PDF export not implemented yet' };
                        break;
                    case 'EXCEL':
                        // This would require an Excel generation library
                        exportData = { message: 'Excel export not implemented yet' };
                        break;
                    default:
                        throw new Error(`Unsupported export format: ${format.type}`);
                }
                return {
                    success: true,
                    data: exportData,
                    fileUrl,
                    generatedAt: new Date(),
                };
            }
            catch (error) {
                return {
                    success: false,
                    error: error instanceof Error ? error.message : 'Unknown error',
                    generatedAt: new Date(),
                };
            }
        });
    }
    generateSummary() {
        return __awaiter(this, void 0, void 0, function* () {
            const [totalAnalysts, activeAnalysts, totalSchedules, upcomingSchedules, conflicts,] = yield Promise.all([
                this.prisma.analyst.count(),
                this.prisma.analyst.count({ where: { isActive: true } }),
                this.prisma.schedule.count(),
                this.prisma.schedule.count({
                    where: { date: { gte: new Date() } },
                }),
                this.prisma.schedulingConstraint.count(),
            ]);
            // Calculate average fairness score
            const fairnessReport = yield this.analyticsEngine.generateFairnessReport({
                startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Last 30 days
                endDate: new Date(),
            });
            return {
                totalAnalysts,
                activeAnalysts,
                totalSchedules,
                upcomingSchedules,
                conflicts,
                averageFairnessScore: fairnessReport.overallFairnessScore,
            };
        });
    }
    generateFairnessMetrics() {
        return __awaiter(this, void 0, void 0, function* () {
            const fairnessReport = yield this.analyticsEngine.generateFairnessReport({
                startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Last 30 days
                endDate: new Date(),
            });
            // Determine trend (simplified - would need historical data for real trend analysis)
            const trend = 'STABLE';
            return {
                overallScore: fairnessReport.overallFairnessScore,
                workloadFairness: 1 - (fairnessReport.workloadDistribution.standardDeviation / 10), // Normalize
                screenerFairness: fairnessReport.screenerDistribution.fairnessScore,
                weekendFairness: fairnessReport.weekendDistribution.fairnessScore,
                trend,
            };
        });
    }
    generateWorkloadDistribution() {
        return __awaiter(this, void 0, void 0, function* () {
            const analysts = yield this.prisma.analyst.findMany({
                where: { isActive: true },
            });
            const schedules = yield this.prisma.schedule.findMany({
                where: {
                    date: {
                        gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Last 30 days
                    },
                },
            });
            const distribution = analysts.map((analyst) => {
                const analystSchedules = schedules.filter((s) => s.analystId === analyst.id);
                const workload = analystSchedules.length;
                // Calculate fairness score for this analyst
                const fairnessScore = this.calculateIndividualFairnessScore({
                    totalWorkDays: workload,
                    screenerDays: analystSchedules.filter((s) => s.isScreener).length,
                    weekendDays: analystSchedules.filter((s) => s.shiftType === 'WEEKEND').length,
                    consecutiveWorkDayStreaks: this.calculateConsecutiveStreaks(analystSchedules),
                }, analystSchedules);
                return {
                    analystName: analyst.name,
                    workload,
                    fairnessScore,
                };
            });
            const workloads = distribution.map((d) => d.workload);
            const averageWorkload = workloads.reduce((a, b) => a + b, 0) / workloads.length;
            const standardDeviation = this.calculateStandardDeviation(workloads);
            return {
                averageWorkload,
                standardDeviation,
                distribution,
            };
        });
    }
    getRecentActivity() {
        return __awaiter(this, void 0, void 0, function* () {
            // This would typically come from an activity log table
            // For now, return mock data
            return [
                {
                    id: '1',
                    type: 'SCHEDULE_CREATED',
                    description: 'New schedule created for Alice Morning',
                    timestamp: new Date(Date.now() - 1000 * 60 * 30), // 30 minutes ago
                    analystName: 'Alice Morning',
                    impact: 'LOW',
                },
                {
                    id: '2',
                    type: 'CONFLICT_RESOLVED',
                    description: 'Conflict resolved for Bob Evening',
                    timestamp: new Date(Date.now() - 1000 * 60 * 60), // 1 hour ago
                    analystName: 'Bob Evening',
                    impact: 'MEDIUM',
                },
            ];
        });
    }
    generateAlerts() {
        return __awaiter(this, void 0, void 0, function* () {
            const alerts = [];
            // Check for fairness violations
            const fairnessReport = yield this.analyticsEngine.generateFairnessReport({
                startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // Last 7 days
                endDate: new Date(),
            });
            if (fairnessReport.overallFairnessScore < 0.6) {
                alerts.push({
                    id: '1',
                    type: 'FAIRNESS_VIOLATION',
                    severity: 'HIGH',
                    message: `Low fairness score detected: ${(fairnessReport.overallFairnessScore * 100).toFixed(1)}%`,
                    timestamp: new Date(),
                    actionable: true,
                    suggestedActions: fairnessReport.recommendations,
                });
            }
            // Check for workload imbalances
            const workloadDistribution = yield this.generateWorkloadDistribution();
            if (workloadDistribution.standardDeviation > 3) {
                alerts.push({
                    id: '2',
                    type: 'WORKLOAD_IMBALANCE',
                    severity: 'MEDIUM',
                    message: `Workload imbalance detected. Standard deviation: ${workloadDistribution.standardDeviation.toFixed(2)}`,
                    timestamp: new Date(),
                    actionable: true,
                    suggestedActions: ['Redistribute workload', 'Review scheduling algorithm'],
                });
            }
            return alerts;
        });
    }
    generatePredictions() {
        return __awaiter(this, void 0, void 0, function* () {
            // Generate staffing predictions for next 7 days
            const staffingNeeds = [];
            for (let i = 1; i <= 7; i++) {
                const futureDate = new Date(Date.now() + i * 24 * 60 * 60 * 1000);
                const prediction = yield this.predictiveEngine.predictStaffingNeeds(futureDate);
                staffingNeeds.push({
                    date: futureDate,
                    required: prediction.predictedRequiredStaff,
                    confidence: prediction.confidence,
                });
            }
            // Get burnout risk assessments
            const analysts = yield this.prisma.analyst.findMany({ where: { isActive: true } });
            const burnoutAssessments = yield this.predictiveEngine.identifyBurnoutRisk(analysts);
            const burnoutRisks = burnoutAssessments
                .filter(assessment => assessment.riskLevel !== 'LOW')
                .map(assessment => ({
                analystName: assessment.analystName,
                riskLevel: assessment.riskLevel,
                riskScore: assessment.riskScore,
            }));
            // Generate conflict forecasts
            const conflictForecasts = [
                {
                    date: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
                    probability: 0.3,
                    type: 'STAFFING_SHORTAGE',
                    severity: 'MEDIUM',
                },
            ];
            return {
                staffingNeeds,
                burnoutRisks,
                conflictForecasts,
            };
        });
    }
    getPerformanceMetrics() {
        return __awaiter(this, void 0, void 0, function* () {
            // This would typically come from monitoring systems
            // For now, return mock data
            return {
                averageQueryTime: 150,
                cacheHitRate: 0.85,
                activeConnections: 12,
                systemHealth: 'HEALTHY',
            };
        });
    }
    calculateIndividualFairnessScore(tally, schedules) {
        const baseScore = 1.0;
        const streakPenalty = Math.max(0, (tally.consecutiveWorkDayStreaks - 5) * 0.1);
        const screenerBalance = tally.screenerDays > 0 ? 0.1 : 0;
        const weekendBalance = tally.weekendDays > 0 ? 0.1 : 0;
        return Math.max(0, Math.min(1, baseScore - streakPenalty + screenerBalance + weekendBalance));
    }
    calculateConsecutiveStreaks(schedules) {
        if (schedules.length === 0)
            return 0;
        const sortedSchedules = schedules.sort((a, b) => a.date.getTime() - b.date.getTime());
        let maxStreak = 1;
        let currentStreak = 1;
        for (let i = 1; i < sortedSchedules.length; i++) {
            const prevDate = new Date(sortedSchedules[i - 1].date);
            const currDate = new Date(sortedSchedules[i].date);
            const diffTime = currDate.getTime() - prevDate.getTime();
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            if (diffDays === 1) {
                currentStreak++;
                maxStreak = Math.max(maxStreak, currentStreak);
            }
            else {
                currentStreak = 1;
            }
        }
        return maxStreak;
    }
    calculateStandardDeviation(values) {
        if (values.length === 0)
            return 0;
        const mean = values.reduce((a, b) => a + b, 0) / values.length;
        const squaredDiffs = values.map(value => Math.pow(value - mean, 2));
        const variance = squaredDiffs.reduce((a, b) => a + b, 0) / values.length;
        return Math.sqrt(variance);
    }
    convertToCSV(data) {
        if (data.length === 0)
            return '';
        const headers = Object.keys(data[0]);
        const csvRows = [headers.join(',')];
        for (const row of data) {
            const values = headers.map(header => {
                const value = row[header];
                return typeof value === 'string' ? `"${value}"` : value;
            });
            csvRows.push(values.join(','));
        }
        return csvRows.join('\n');
    }
}
exports.DashboardService = DashboardService;
