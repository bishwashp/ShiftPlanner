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
exports.BackgroundAnalyticsService = void 0;

class BackgroundAnalyticsService {
    constructor(prisma, cache, analyticsEngine, predictiveEngine, dashboardService) {
        this.prisma = prisma;
        this.cache = cache;
        this.analyticsEngine = analyticsEngine;
        this.predictiveEngine = predictiveEngine;
        this.dashboardService = dashboardService;
        this.jobs = [];
        this.isRunning = false;
        this.metrics = {
            totalJobsRun: 0,
            successfulJobs: 0,
            failedJobs: 0,
            averageExecutionTime: 0,
            lastHealthCheck: new Date(),
            systemHealth: 'HEALTHY'
        };
        this.insights = [];

        this.initializeJobs();
        this.start();
    }

    initializeJobs() {
        // High-frequency jobs (every 5 minutes)
        this.jobs.push({
            id: 'real_time_metrics',
            name: 'Real-time Metrics Collection',
            frequency: 5 * 60 * 1000, // 5 minutes
            enabled: true,
            nextRun: new Date(),
            priority: 'HIGH',
            executor: () => this.collectRealTimeMetrics()
        });

        // Medium-frequency jobs (every 15 minutes)
        this.jobs.push({
            id: 'workload_analysis',
            name: 'Workload Distribution Analysis',
            frequency: 15 * 60 * 1000, // 15 minutes
            enabled: true,
            nextRun: new Date(Date.now() + 5 * 60 * 1000),
            priority: 'HIGH',
            executor: () => this.analyzeWorkloadDistribution()
        });

        this.jobs.push({
            id: 'fairness_monitoring',
            name: 'Fairness Score Monitoring',
            frequency: 15 * 60 * 1000, // 15 minutes
            enabled: true,
            nextRun: new Date(Date.now() + 7 * 60 * 1000),
            priority: 'HIGH',
            executor: () => this.monitorFairnessScores()
        });

        // Lower-frequency jobs (every 30 minutes)
        this.jobs.push({
            id: 'predictive_analysis',
            name: 'Predictive Analytics',
            frequency: 30 * 60 * 1000, // 30 minutes
            enabled: true,
            nextRun: new Date(Date.now() + 10 * 60 * 1000),
            priority: 'MEDIUM',
            executor: () => this.runPredictiveAnalysis()
        });

        this.jobs.push({
            id: 'burnout_assessment',
            name: 'Burnout Risk Assessment',
            frequency: 30 * 60 * 1000, // 30 minutes
            enabled: true,
            nextRun: new Date(Date.now() + 15 * 60 * 1000),
            priority: 'MEDIUM',
            executor: () => this.assessBurnoutRisks()
        });

        // Daily jobs (every 24 hours)
        this.jobs.push({
            id: 'daily_summary',
            name: 'Daily Analytics Summary',
            frequency: 24 * 60 * 60 * 1000, // 24 hours
            enabled: true,
            nextRun: this.getNextDailyRun(),
            priority: 'MEDIUM',
            executor: () => this.generateDailySummary()
        });

        console.log(`📊 Initialized ${this.jobs.length} background analytics jobs`);
    }

    getNextDailyRun(offsetHours = 0) {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        tomorrow.setHours(6 + offsetHours, 0, 0, 0); // 6 AM + offset
        return tomorrow;
    }

    start() {
        if (this.isRunning) {
            console.log('⚠️ Background analytics service is already running');
            return;
        }

        this.isRunning = true;
        console.log('🚀 Starting background analytics service...');

        // Main job scheduler - runs every 30 seconds
        setInterval(() => {
            this.processJobs();
        }, 30000);

        // Health check and cleanup - runs every 5 minutes
        setInterval(() => {
            this.performHealthCheck();
            this.cleanupOldInsights();
        }, 5 * 60 * 1000);

        console.log('✅ Background analytics service started successfully');
    }

    stop() {
        this.isRunning = false;
        console.log('🛑 Background analytics service stopped');
    }

    processJobs() {
        return __awaiter(this, void 0, void 0, function* () {
            if (!this.isRunning) return;

            const now = new Date();
            const jobsToRun = this.jobs.filter(job => 
                job.enabled && job.nextRun <= now
            ).sort((a, b) => {
                // Sort by priority first, then by how overdue they are
                const priorityOrder = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
                const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
                if (priorityDiff !== 0) return priorityDiff;
                
                return a.nextRun.getTime() - b.nextRun.getTime();
            });

            for (const job of jobsToRun) {
                yield this.executeJob(job);
            }
        });
    }

    executeJob(job) {
        return __awaiter(this, void 0, void 0, function* () {
            const startTime = Date.now();
            
            try {
                console.log(`📊 Executing job: ${job.name}`);
                yield job.executor();
                
                const executionTime = Date.now() - startTime;
                this.updateJobMetrics(job, executionTime, true);
                
                console.log(`✅ Job completed: ${job.name} (${executionTime}ms)`);
            } catch (error) {
                const executionTime = Date.now() - startTime;
                this.updateJobMetrics(job, executionTime, false);
                
                console.error(`❌ Job failed: ${job.name}`, error);
                
                // Create insight for job failure if it's a critical job
                if (job.priority === 'CRITICAL' || job.priority === 'HIGH') {
                    yield this.createInsight({
                        type: 'ANOMALY',
                        title: 'Analytics Job Failure',
                        description: `Background job "${job.name}" failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
                        severity: job.priority === 'CRITICAL' ? 'CRITICAL' : 'HIGH',
                        confidence: 1.0,
                        data: { jobId: job.id, error: error instanceof Error ? error.message : error },
                        actionable: true,
                        suggestedActions: ['Check system resources', 'Review job logs', 'Restart analytics service']
                    });
                }
            }

            // Schedule next run
            job.lastRun = new Date();
            job.nextRun = new Date(job.lastRun.getTime() + job.frequency);
        });
    }

    updateJobMetrics(job, executionTime, success) {
        this.metrics.totalJobsRun++;
        if (success) {
            this.metrics.successfulJobs++;
        } else {
            this.metrics.failedJobs++;
        }

        // Update average execution time
        this.metrics.averageExecutionTime = 
            (this.metrics.averageExecutionTime * (this.metrics.totalJobsRun - 1) + executionTime) / 
            this.metrics.totalJobsRun;
    }

    // Job Executors
    collectRealTimeMetrics() {
        return __awaiter(this, void 0, void 0, function* () {
            const [
                totalSchedules,
                upcomingSchedules,
                activeAnalysts,
                avgWorkload,
                recentConflicts
            ] = yield Promise.all([
                this.prisma.schedule.count(),
                this.prisma.schedule.count({
                    where: { date: { gte: new Date() } }
                }),
                this.prisma.analyst.count({ where: { isActive: true } }),
                this.calculateCurrentAvgWorkload(),
                this.prisma.schedulingConstraint.count({
                    where: {
                        createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
                    }
                })
            ]);

            const metrics = {
                timestamp: new Date(),
                totalSchedules,
                upcomingSchedules,
                activeAnalysts,
                avgWorkload,
                recentConflicts,
                utilizationRate: upcomingSchedules / (activeAnalysts * 30), // Approximate monthly utilization
            };

            yield this.cache.set('real_time_metrics', metrics, 300); // Cache for 5 minutes

            // Detect anomalies
            if (metrics.utilizationRate > 0.9) {
                yield this.createInsight({
                    type: 'ANOMALY',
                    title: 'High Utilization Rate Detected',
                    description: `Current utilization rate is ${(metrics.utilizationRate * 100).toFixed(1)}%, indicating potential overallocation`,
                    severity: metrics.utilizationRate > 0.95 ? 'CRITICAL' : 'HIGH',
                    confidence: 0.8,
                    data: metrics,
                    actionable: true,
                    suggestedActions: ['Review upcoming schedules', 'Consider hiring additional analysts', 'Optimize schedule distribution']
                });
            }
        });
    }

    analyzeWorkloadDistribution() {
        return __awaiter(this, void 0, void 0, function* () {
            const workloadDistribution = yield this.dashboardService.generateWorkloadDistribution();
            
            // Detect workload imbalances
            if (workloadDistribution.standardDeviation > 3) {
                yield this.createInsight({
                    type: 'ANOMALY',
                    title: 'Workload Imbalance Detected',
                    description: `Workload distribution shows high variance (σ=${workloadDistribution.standardDeviation.toFixed(2)}), indicating unfair distribution`,
                    severity: workloadDistribution.standardDeviation > 5 ? 'HIGH' : 'MEDIUM',
                    confidence: 0.9,
                    data: workloadDistribution,
                    actionable: true,
                    suggestedActions: [
                        'Redistribute shifts from high-workload analysts',
                        'Increase assignments for underutilized analysts',
                        'Review scheduling algorithm parameters'
                    ]
                });
            }

            // Cache the analysis
            yield this.cache.set('workload_distribution_analysis', workloadDistribution, 900); // 15 minutes
        });
    }

    monitorFairnessScores() {
        return __awaiter(this, void 0, void 0, function* () {
            const fairnessReport = yield this.analyticsEngine.generateFairnessReport({
                startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // Last 7 days
                endDate: new Date()
            });

            // Monitor fairness trends
            if (fairnessReport.overallFairnessScore < 0.6) {
                yield this.createInsight({
                    type: 'ANOMALY',
                    title: 'Low Fairness Score Alert',
                    description: `Overall fairness score has dropped to ${(fairnessReport.overallFairnessScore * 100).toFixed(1)}%`,
                    severity: fairnessReport.overallFairnessScore < 0.4 ? 'CRITICAL' : 'HIGH',
                    confidence: 0.95,
                    data: fairnessReport,
                    actionable: true,
                    suggestedActions: fairnessReport.recommendations
                });
            }

            yield this.cache.set('fairness_monitoring', fairnessReport, 900); // 15 minutes
        });
    }

    runPredictiveAnalysis() {
        return __awaiter(this, void 0, void 0, function* () {
            const predictions = yield this.dashboardService.generatePredictions();
            
            // Analyze staffing predictions
            const understaffedDays = predictions.staffingNeeds.filter(prediction => 
                prediction.required > yield this.getAvailableAnalystsCount()
            );

            if (understaffedDays.length > 0) {
                yield this.createInsight({
                    type: 'PREDICTION',
                    title: 'Upcoming Staffing Shortages Predicted',
                    description: `${understaffedDays.length} day(s) in the next week are predicted to have staffing shortages`,
                    severity: understaffedDays.length > 3 ? 'HIGH' : 'MEDIUM',
                    confidence: 0.75,
                    data: { understaffedDays },
                    actionable: true,
                    suggestedActions: [
                        'Recruit temporary staff',
                        'Adjust schedule requirements',
                        'Implement overtime policies',
                        'Cross-train existing analysts'
                    ]
                });
            }

            yield this.cache.set('predictive_analysis', predictions, 1800); // 30 minutes
        });
    }

    assessBurnoutRisks() {
        return __awaiter(this, void 0, void 0, function* () {
            const analysts = yield this.prisma.analyst.findMany({ where: { isActive: true } });
            const burnoutAssessments = yield this.predictiveEngine.identifyBurnoutRisk(analysts);
            
            const highRiskAnalysts = burnoutAssessments.filter(assessment => 
                assessment.riskLevel === 'HIGH' || assessment.riskLevel === 'CRITICAL'
            );

            if (highRiskAnalysts.length > 0) {
                yield this.createInsight({
                    type: 'PREDICTION',
                    title: 'High Burnout Risk Detected',
                    description: `${highRiskAnalysts.length} analyst(s) show high risk of burnout based on current workload patterns`,
                    severity: 'HIGH',
                    confidence: 0.8,
                    data: { highRiskAnalysts },
                    actionable: true,
                    suggestedActions: [
                        'Reduce workload for high-risk analysts',
                        'Implement mandatory rest periods',
                        'Consider temporary staff reallocation',
                        'Schedule wellness check-ins'
                    ]
                });
            }

            yield this.cache.set('burnout_assessments', burnoutAssessments, 1800); // 30 minutes
        });
    }

    generateDailySummary() {
        return __awaiter(this, void 0, void 0, function* () {
            const summary = yield this.dashboardService.generateSummary();
            const todaysInsights = this.insights.filter(insight => 
                insight.generatedAt > new Date(Date.now() - 24 * 60 * 60 * 1000)
            );

            const dailySummary = {
                date: new Date().toISOString().split('T')[0],
                summary,
                insights: todaysInsights,
                topConcerns: todaysInsights
                    .filter(insight => insight.severity === 'HIGH' || insight.severity === 'CRITICAL')
                    .slice(0, 5),
                analyticsHealth: this.metrics
            };

            yield this.cache.set('daily_summary', dailySummary, 86400); // 24 hours
            
            // Store in insights as a trend
            yield this.createInsight({
                type: 'TREND',
                title: 'Daily Analytics Summary Generated',
                description: `Generated daily summary with ${todaysInsights.length} insights and ${dailySummary.topConcerns.length} top concerns`,
                severity: 'LOW',
                confidence: 1.0,
                data: dailySummary,
                actionable: false
            });
        });
    }

    // Helper methods
    createInsight(insight) {
        return __awaiter(this, void 0, void 0, function* () {
            const newInsight = Object.assign({
                id: `insight_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                generatedAt: new Date()
            }, insight);

            this.insights.push(newInsight);
            
            // Keep only the last 1000 insights in memory
            if (this.insights.length > 1000) {
                this.insights = this.insights.slice(-1000);
            }

            // Cache the latest insights
            yield this.cache.set('latest_insights', this.insights.slice(-50), 3600); // Last 50 insights for 1 hour
        });
    }

    calculateCurrentAvgWorkload() {
        return __awaiter(this, void 0, void 0, function* () {
            const schedules = yield this.prisma.schedule.findMany({
                where: {
                    date: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }
                }
            });

            const analysts = yield this.prisma.analyst.findMany({
                where: { isActive: true }
            });

            return schedules.length / Math.max(analysts.length, 1);
        });
    }

    getAvailableAnalystsCount() {
        return __awaiter(this, void 0, void 0, function* () {
            return yield this.prisma.analyst.count({ where: { isActive: true } });
        });
    }

    performHealthCheck() {
        const successRate = this.metrics.successfulJobs / Math.max(this.metrics.totalJobsRun, 1);
        
        let health = 'HEALTHY';
        
        if (successRate < 0.5) {
            health = 'CRITICAL';
        } else if (successRate < 0.8) {
            health = 'DEGRADED';
        }

        if (this.metrics.averageExecutionTime > 10000) { // 10 seconds
            health = 'DEGRADED';
        }

        this.metrics.systemHealth = health;
        this.metrics.lastHealthCheck = new Date();
    }

    cleanupOldInsights() {
        const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000); // 7 days
        this.insights = this.insights.filter(insight => insight.generatedAt > cutoff);
    }

    // Public API methods
    getMetrics() {
        return Object.assign({}, this.metrics);
    }

    getLatestInsights(limit = 10) {
        return this.insights.slice(-limit);
    }

    getInsightsByType(type) {
        return this.insights.filter(insight => insight.type === type);
    }

    getJobs() {
        return this.jobs.map(job => (Object.assign(Object.assign({}, job), { executor: undefined })));
    }

    enableJob(jobId) {
        const job = this.jobs.find(j => j.id === jobId);
        if (job) {
            job.enabled = true;
            return true;
        }
        return false;
    }

    disableJob(jobId) {
        const job = this.jobs.find(j => j.id === jobId);
        if (job) {
            job.enabled = false;
            return true;
        }
        return false;
    }
}
exports.BackgroundAnalyticsService = BackgroundAnalyticsService;