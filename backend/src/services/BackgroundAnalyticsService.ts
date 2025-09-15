import { PrismaClient } from '@prisma/client';
import { CacheService } from '../lib/cache';
import { AnalyticsEngine } from './AnalyticsEngine';
import { PredictiveEngine } from './PredictiveEngine';
import { DashboardService } from './DashboardService';

interface AnalyticsJob {
  id: string;
  name: string;
  frequency: number; // milliseconds
  enabled: boolean;
  lastRun?: Date;
  nextRun: Date;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  executor: () => Promise<void>;
}

interface AnalyticsMetrics {
  totalJobsRun: number;
  successfulJobs: number;
  failedJobs: number;
  averageExecutionTime: number;
  lastHealthCheck: Date;
  systemHealth: 'HEALTHY' | 'DEGRADED' | 'CRITICAL';
}

interface BackgroundInsight {
  id: string;
  type: 'TREND' | 'ANOMALY' | 'PREDICTION' | 'RECOMMENDATION';
  title: string;
  description: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  confidence: number;
  generatedAt: Date;
  data: any;
  actionable: boolean;
  suggestedActions?: string[];
}

export class BackgroundAnalyticsService {
  private prisma: PrismaClient;
  private cache: CacheService;
  private analyticsEngine: AnalyticsEngine;
  private predictiveEngine: PredictiveEngine;
  private dashboardService: DashboardService;
  private jobs: AnalyticsJob[] = [];
  private isRunning: boolean = false;
  private metrics: AnalyticsMetrics = {
    totalJobsRun: 0,
    successfulJobs: 0,
    failedJobs: 0,
    averageExecutionTime: 0,
    lastHealthCheck: new Date(),
    systemHealth: 'HEALTHY'
  };
  private insights: BackgroundInsight[] = [];

  constructor(
    prisma: PrismaClient,
    cache: CacheService,
    analyticsEngine: AnalyticsEngine,
    predictiveEngine: PredictiveEngine,
    dashboardService: DashboardService
  ) {
    this.prisma = prisma;
    this.cache = cache;
    this.analyticsEngine = analyticsEngine;
    this.predictiveEngine = predictiveEngine;
    this.dashboardService = dashboardService;

    this.initializeJobs();
    this.start();
  }

  private initializeJobs(): void {
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

    this.jobs.push({
      id: 'trend_analysis',
      name: 'Long-term Trend Analysis',
      frequency: 24 * 60 * 60 * 1000, // 24 hours
      enabled: true,
      nextRun: this.getNextDailyRun(1),
      priority: 'LOW',
      executor: () => this.analyzeLongTermTrends()
    });

    this.jobs.push({
      id: 'optimization_opportunities',
      name: 'Optimization Opportunity Detection',
      frequency: 24 * 60 * 60 * 1000, // 24 hours
      enabled: true,
      nextRun: this.getNextDailyRun(2),
      priority: 'MEDIUM',
      executor: () => this.detectOptimizationOpportunities()
    });

    // Weekly jobs (every 7 days)
    this.jobs.push({
      id: 'weekly_report',
      name: 'Weekly Analytics Report',
      frequency: 7 * 24 * 60 * 60 * 1000, // 7 days
      enabled: true,
      nextRun: this.getNextWeeklyRun(),
      priority: 'LOW',
      executor: () => this.generateWeeklyReport()
    });

    console.log(`📊 Initialized ${this.jobs.length} background analytics jobs`);
  }

  private getNextDailyRun(offsetHours: number = 0): Date {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(6 + offsetHours, 0, 0, 0); // 6 AM + offset
    return tomorrow;
  }

  private getNextWeeklyRun(): Date {
    const nextWeek = new Date();
    nextWeek.setDate(nextWeek.getDate() + (7 - nextWeek.getDay() + 1)); // Next Monday
    nextWeek.setHours(8, 0, 0, 0); // 8 AM Monday
    return nextWeek;
  }

  public start(): void {
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

  public stop(): void {
    this.isRunning = false;
    console.log('🛑 Background analytics service stopped');
  }

  private async processJobs(): Promise<void> {
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
      await this.executeJob(job);
    }
  }

  private async executeJob(job: AnalyticsJob): Promise<void> {
    const startTime = Date.now();
    
    try {
      console.log(`📊 Executing job: ${job.name}`);
      await job.executor();
      
      const executionTime = Date.now() - startTime;
      this.updateJobMetrics(job, executionTime, true);
      
      console.log(`✅ Job completed: ${job.name} (${executionTime}ms)`);
    } catch (error) {
      const executionTime = Date.now() - startTime;
      this.updateJobMetrics(job, executionTime, false);
      
      console.error(`❌ Job failed: ${job.name}`, error);
      
      // Create insight for job failure if it's a critical job
      if (job.priority === 'CRITICAL' || job.priority === 'HIGH') {
        await this.createInsight({
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
  }

  private updateJobMetrics(job: AnalyticsJob, executionTime: number, success: boolean): void {
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
  private async collectRealTimeMetrics(): Promise<void> {
    const [
      totalSchedules,
      upcomingSchedules,
      activeAnalysts,
      avgWorkload,
      recentConflicts
    ] = await Promise.all([
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

    await this.cache.set('real_time_metrics', metrics, 300); // Cache for 5 minutes

    // Detect anomalies
    if (metrics.utilizationRate > 0.9) {
      await this.createInsight({
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
  }

  private async analyzeWorkloadDistribution(): Promise<void> {
    const workloadDistribution = await this.dashboardService.generateWorkloadDistribution();
    
    // Detect workload imbalances
    if (workloadDistribution.standardDeviation > 3) {
      await this.createInsight({
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
    await this.cache.set('workload_distribution_analysis', workloadDistribution, 900); // 15 minutes
  }

  private async monitorFairnessScores(): Promise<void> {
    const fairnessReport = await this.analyticsEngine.generateFairnessReport({
      startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // Last 7 days
      endDate: new Date()
    });

    // Monitor fairness trends
    if (fairnessReport.overallFairnessScore < 0.6) {
      await this.createInsight({
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

    // Check for individual analysts with low fairness scores
    const lowFairnessAnalysts = fairnessReport.individualScores.filter(score => score.fairnessScore < 0.3);
    if (lowFairnessAnalysts.length > 0) {
      await this.createInsight({
        type: 'RECOMMENDATION',
        title: 'Individual Fairness Attention Needed',
        description: `${lowFairnessAnalysts.length} analyst(s) have critically low fairness scores`,
        severity: 'MEDIUM',
        confidence: 0.85,
        data: { analysts: lowFairnessAnalysts },
        actionable: true,
        suggestedActions: [
          'Review individual scheduling patterns',
          'Reduce consecutive work days',
          'Balance screener and weekend assignments'
        ]
      });
    }

    await this.cache.set('fairness_monitoring', fairnessReport, 900); // 15 minutes
  }

  private async runPredictiveAnalysis(): Promise<void> {
    const predictions = await this.dashboardService.generatePredictions();
    
    // Analyze staffing predictions
    const understaffedDays = predictions.staffingNeeds.filter(prediction => 
      prediction.required > await this.getAvailableAnalystsCount()
    );

    if (understaffedDays.length > 0) {
      await this.createInsight({
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

    await this.cache.set('predictive_analysis', predictions, 1800); // 30 minutes
  }

  private async assessBurnoutRisks(): Promise<void> {
    const analysts = await this.prisma.analyst.findMany({ where: { isActive: true } });
    const burnoutAssessments = await this.predictiveEngine.identifyBurnoutRisk(analysts);
    
    const highRiskAnalysts = burnoutAssessments.filter(assessment => 
      assessment.riskLevel === 'HIGH' || assessment.riskLevel === 'CRITICAL'
    );

    if (highRiskAnalysts.length > 0) {
      await this.createInsight({
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

    await this.cache.set('burnout_assessments', burnoutAssessments, 1800); // 30 minutes
  }

  private async generateDailySummary(): Promise<void> {
    const summary = await this.dashboardService.generateSummary();
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

    await this.cache.set('daily_summary', dailySummary, 86400); // 24 hours
    
    // Store in insights as a trend
    await this.createInsight({
      type: 'TREND',
      title: 'Daily Analytics Summary Generated',
      description: `Generated daily summary with ${todaysInsights.length} insights and ${dailySummary.topConcerns.length} top concerns`,
      severity: 'LOW',
      confidence: 1.0,
      data: dailySummary,
      actionable: false
    });
  }

  private async analyzeLongTermTrends(): Promise<void> {
    // Analyze trends over the past 30 days
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    
    const [
      scheduleTrend,
      workloadTrend,
      fairnessTrend
    ] = await Promise.all([
      this.calculateScheduleTrend(thirtyDaysAgo),
      this.calculateWorkloadTrend(thirtyDaysAgo),
      this.calculateFairnessTrend(thirtyDaysAgo)
    ]);

    const trends = { scheduleTrend, workloadTrend, fairnessTrend };

    // Detect significant trends
    if (Math.abs(workloadTrend.changePercent) > 20) {
      await this.createInsight({
        type: 'TREND',
        title: 'Significant Workload Trend Detected',
        description: `Workload has ${workloadTrend.changePercent > 0 ? 'increased' : 'decreased'} by ${Math.abs(workloadTrend.changePercent).toFixed(1)}% over the past 30 days`,
        severity: Math.abs(workloadTrend.changePercent) > 30 ? 'HIGH' : 'MEDIUM',
        confidence: 0.85,
        data: trends,
        actionable: true,
        suggestedActions: [
          workloadTrend.changePercent > 0 ? 'Consider hiring additional staff' : 'Evaluate optimal staffing levels',
          'Review scheduling algorithms',
          'Analyze demand patterns'
        ]
      });
    }

    await this.cache.set('long_term_trends', trends, 86400); // 24 hours
  }

  private async detectOptimizationOpportunities(): Promise<void> {
    const recentSchedules = await this.prisma.schedule.findMany({
      where: {
        date: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }
      },
      include: { analyst: true }
    });

    const opportunities = await this.analyticsEngine.identifyOptimizationOpportunities(recentSchedules);
    
    for (const opportunity of opportunities) {
      await this.createInsight({
        type: 'RECOMMENDATION',
        title: `Optimization Opportunity: ${opportunity.type}`,
        description: opportunity.description,
        severity: opportunity.severity as any,
        confidence: 0.8,
        data: opportunity,
        actionable: true,
        suggestedActions: opportunity.suggestedActions
      });
    }

    await this.cache.set('optimization_opportunities', opportunities, 86400); // 24 hours
  }

  private async generateWeeklyReport(): Promise<void> {
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    
    const weeklyReport = {
      weekOf: weekAgo.toISOString().split('T')[0],
      insights: this.insights.filter(insight => insight.generatedAt >= weekAgo),
      totalJobs: this.metrics.totalJobsRun,
      successRate: this.metrics.successfulJobs / this.metrics.totalJobsRun,
      systemHealth: this.metrics.systemHealth,
      recommendations: await this.generateWeeklyRecommendations()
    };

    await this.cache.set('weekly_report', weeklyReport, 7 * 24 * 60 * 60 * 1000); // 7 days
  }

  // Helper methods
  private async createInsight(insight: Omit<BackgroundInsight, 'id' | 'generatedAt'>): Promise<void> {
    const newInsight: BackgroundInsight = {
      id: `insight_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      generatedAt: new Date(),
      ...insight
    };

    this.insights.push(newInsight);
    
    // Keep only the last 1000 insights in memory
    if (this.insights.length > 1000) {
      this.insights = this.insights.slice(-1000);
    }

    // Cache the latest insights
    await this.cache.set('latest_insights', this.insights.slice(-50), 3600); // Last 50 insights for 1 hour
  }

  private async calculateCurrentAvgWorkload(): Promise<number> {
    const schedules = await this.prisma.schedule.findMany({
      where: {
        date: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }
      }
    });

    const analysts = await this.prisma.analyst.findMany({
      where: { isActive: true }
    });

    return schedules.length / analysts.length;
  }

  private async getAvailableAnalystsCount(): Promise<number> {
    return await this.prisma.analyst.count({ where: { isActive: true } });
  }

  private async calculateScheduleTrend(since: Date): Promise<{ current: number; previous: number; changePercent: number }> {
    const current = await this.prisma.schedule.count({
      where: { date: { gte: since } }
    });
    
    const previousPeriod = new Date(since.getTime() - (Date.now() - since.getTime()));
    const previous = await this.prisma.schedule.count({
      where: {
        date: { gte: previousPeriod, lt: since }
      }
    });

    const changePercent = previous > 0 ? ((current - previous) / previous) * 100 : 0;
    return { current, previous, changePercent };
  }

  private async calculateWorkloadTrend(since: Date): Promise<{ current: number; previous: number; changePercent: number }> {
    const current = await this.calculateCurrentAvgWorkload();
    
    // This would need historical workload data for accurate comparison
    // For now, using a simplified approach
    const previous = current * 0.9; // Placeholder
    const changePercent = ((current - previous) / previous) * 100;
    
    return { current, previous, changePercent };
  }

  private async calculateFairnessTrend(since: Date): Promise<{ current: number; previous: number; changePercent: number }> {
    const currentReport = await this.analyticsEngine.generateFairnessReport({
      startDate: since,
      endDate: new Date()
    });

    // For simplicity, using current score
    // In a real implementation, you'd track historical fairness scores
    const current = currentReport.overallFairnessScore;
    const previous = current * 0.95; // Placeholder
    const changePercent = ((current - previous) / previous) * 100;

    return { current, previous, changePercent };
  }

  private async generateWeeklyRecommendations(): Promise<string[]> {
    const recommendations = [];
    
    const criticalInsights = this.insights.filter(insight => 
      insight.severity === 'CRITICAL' && 
      insight.generatedAt > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    );

    if (criticalInsights.length > 0) {
      recommendations.push('Address critical insights immediately');
    }

    const successRate = this.metrics.successfulJobs / this.metrics.totalJobsRun;
    if (successRate < 0.9) {
      recommendations.push('Investigate analytics job failures');
    }

    return recommendations;
  }

  private performHealthCheck(): void {
    const successRate = this.metrics.successfulJobs / Math.max(this.metrics.totalJobsRun, 1);
    
    let health: 'HEALTHY' | 'DEGRADED' | 'CRITICAL' = 'HEALTHY';
    
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

  private cleanupOldInsights(): void {
    const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000); // 7 days
    this.insights = this.insights.filter(insight => insight.generatedAt > cutoff);
  }

  // Public API methods
  public getMetrics(): AnalyticsMetrics {
    return { ...this.metrics };
  }

  public getLatestInsights(limit: number = 10): BackgroundInsight[] {
    return this.insights.slice(-limit);
  }

  public getInsightsByType(type: BackgroundInsight['type']): BackgroundInsight[] {
    return this.insights.filter(insight => insight.type === type);
  }

  public getJobs(): AnalyticsJob[] {
    return this.jobs.map(job => ({
      ...job,
      executor: undefined as any // Don't expose the executor function
    }));
  }

  public enableJob(jobId: string): boolean {
    const job = this.jobs.find(j => j.id === jobId);
    if (job) {
      job.enabled = true;
      return true;
    }
    return false;
  }

  public disableJob(jobId: string): boolean {
    const job = this.jobs.find(j => j.id === jobId);
    if (job) {
      job.enabled = false;
      return true;
    }
    return false;
  }
}