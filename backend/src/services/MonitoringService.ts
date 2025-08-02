import { prisma } from '../lib/prisma';
import { cacheService } from '../lib/cache';

export interface ApplicationMetrics {
  totalRequests: number;
  activeUsers: number;
  averageResponseTime: number;
  errorRate: number;
  cacheHitRate: number;
  databaseConnections: number;
  memoryUsage: number;
  cpuUsage: number;
  uptime: number;
}

export interface PerformanceMetrics {
  queryPerformance: {
    totalQueries: number;
    slowQueries: number;
    averageDuration: number;
    slowQueryPercentage: number;
  };
  apiPerformance: {
    totalRequests: number;
    averageResponseTime: number;
    p95ResponseTime: number;
    p99ResponseTime: number;
  };
  cachePerformance: {
    hitRate: number;
    missRate: number;
    totalKeys: number;
    memoryUsage: number;
  };
  avgResponseTime: number;
  avgQueryTime: number;
  totalQueries: number;
  slowQueries: number;
}

export interface ErrorMetrics {
  totalErrors: number;
  errorRate: number;
  errorTypes: Record<string, number>;
  recentErrors: Array<{
    timestamp: Date;
    error: string;
    stack?: string;
    context?: any;
  }>;
}

export interface UserAnalytics {
  activeUsers: number;
  userSessions: number;
  averageSessionDuration: number;
  popularFeatures: Array<{
    feature: string;
    usageCount: number;
  }>;
  userEngagement: {
    dailyActiveUsers: number;
    weeklyActiveUsers: number;
    monthlyActiveUsers: number;
  };
}

export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: Date;
  checks: {
    database: boolean;
    cache: boolean;
    graphql: boolean;
    memory: boolean;
    cpu: boolean;
  };
  details: {
    database: string;
    cache: string;
    graphql: string;
    memory: string;
    cpu: string;
  };
}

export interface SLAReport {
  uptime: number;
  averageResponseTime: number;
  errorRate: number;
  slaCompliance: boolean;
  violations: Array<{
    metric: string;
    threshold: number;
    actual: number;
    timestamp: Date;
  }>;
}

export class MonitoringService {
  private metrics: ApplicationMetrics = {
    totalRequests: 0,
    activeUsers: 0,
    averageResponseTime: 50, // Start with reasonable default
    errorRate: 0,
    cacheHitRate: 0.8,
    databaseConnections: 0,
    memoryUsage: 0,
    cpuUsage: 0,
    uptime: 0,
  };

  private performanceHistory: PerformanceMetrics[] = [];
  private errorHistory: ErrorMetrics[] = [];
  private userAnalytics: UserAnalytics = {
    activeUsers: 0,
    userSessions: 0,
    averageSessionDuration: 0,
    popularFeatures: [],
    userEngagement: {
      dailyActiveUsers: 0,
      weeklyActiveUsers: 0,
      monthlyActiveUsers: 0,
    },
  };

  private startTime = Date.now();

  constructor() {
    this.startMetricsCollection();
  }

  async collectApplicationMetrics(): Promise<ApplicationMetrics> {
    this.metrics.totalRequests += Math.floor(Math.random() * 10) + 1;
    this.metrics.activeUsers = await this.getActiveUsers();
    // Set a reasonable default response time if no history exists
    this.metrics.averageResponseTime = this.performanceHistory.length > 0 
      ? this.calculateAverageResponseTime() 
      : 50; // Default 50ms response time
    this.metrics.errorRate = this.calculateErrorRate();
    this.metrics.databaseConnections = await this.getDatabaseConnections();
    this.metrics.memoryUsage = process.memoryUsage().heapUsed;
    this.metrics.cpuUsage = await this.getCpuUsage();
    this.metrics.uptime = (Date.now() - this.startTime) / 1000;

    return this.metrics;
  }

  async collectPerformanceMetrics(): Promise<PerformanceMetrics> {
    const performanceMetrics: PerformanceMetrics = {
      queryPerformance: {
        totalQueries: this.metrics.totalRequests * 2,
        slowQueries: Math.floor(this.metrics.totalRequests * 0.1),
        averageDuration: 15,
        slowQueryPercentage: 5,
      },
      apiPerformance: {
        totalRequests: this.metrics.totalRequests,
        averageResponseTime: this.metrics.averageResponseTime,
        p95ResponseTime: this.calculatePercentileResponseTime(95),
        p99ResponseTime: this.calculatePercentileResponseTime(99),
      },
      cachePerformance: {
        hitRate: this.metrics.cacheHitRate,
        missRate: 1 - this.metrics.cacheHitRate,
        totalKeys: 1000,
        memoryUsage: 50 * 1024 * 1024, // 50MB
      },
      avgResponseTime: this.metrics.averageResponseTime,
      avgQueryTime: 15,
      totalQueries: this.metrics.totalRequests * 2,
      slowQueries: Math.floor(this.metrics.totalRequests * 0.1),
    };

    this.performanceHistory.push(performanceMetrics);
    if (this.performanceHistory.length > 100) {
      this.performanceHistory.shift();
    }

    return performanceMetrics;
  }

  async trackError(error: Error, context?: any): Promise<void> {
    const errorMetrics: ErrorMetrics = {
      totalErrors: this.errorHistory.length > 0 ? this.errorHistory[this.errorHistory.length - 1].totalErrors + 1 : 1,
      errorRate: 0.01,
      errorTypes: this.getErrorTypes(),
      recentErrors: [
        {
          timestamp: new Date(),
          error: error.message,
          stack: error.stack,
          context,
        },
      ],
    };

    this.errorHistory.push(errorMetrics);
    if (this.errorHistory.length > 50) {
      this.errorHistory.shift();
    }
  }

  async collectUserAnalytics(): Promise<UserAnalytics> {
    this.userAnalytics.activeUsers = await this.getActiveUsers();
    this.userAnalytics.userSessions = await this.getUserSessions();
    this.userAnalytics.averageSessionDuration = await this.getAverageSessionDuration();
    this.userAnalytics.popularFeatures = await this.getPopularFeatures();
    this.userAnalytics.userEngagement = await this.getUserEngagement();

    return this.userAnalytics;
  }

  async performHealthCheck(): Promise<HealthStatus> {
    const databaseHealth = await this.checkDatabaseHealth();
    const cacheHealth = await this.checkCacheHealth();
    const graphqlHealth = await this.checkGraphQLHealth();
    const memoryHealth = this.checkMemoryHealth();
    const cpuHealth = this.checkCpuHealth();

    const checks = {
      database: databaseHealth,
      cache: cacheHealth,
      graphql: graphqlHealth,
      memory: memoryHealth,
      cpu: cpuHealth,
    };

    const healthyChecks = Object.values(checks).filter(Boolean).length;
    let status: 'healthy' | 'degraded' | 'unhealthy';

    if (healthyChecks === 5) {
      status = 'healthy';
    } else if (healthyChecks >= 3) {
      status = 'degraded';
    } else {
      status = 'unhealthy';
    }

    return {
      status,
      timestamp: new Date(),
      checks,
      details: {
        database: databaseHealth ? 'Connected' : 'Disconnected',
        cache: cacheHealth ? 'Connected' : 'Disconnected',
        graphql: graphqlHealth ? 'Running' : 'Stopped',
        memory: memoryHealth ? 'OK' : 'High usage',
        cpu: cpuHealth ? 'OK' : 'High usage',
      },
    };
  }

  async generateSLAReport(): Promise<SLAReport> {
    const performanceMetrics = await this.collectPerformanceMetrics();
    const healthStatus = await this.performHealthCheck();

    const slaThresholds = {
      uptime: 99.9,
      averageResponseTime: 200, // ms
      errorRate: 0.01, // 1%
    };

    const violations = [];
    
    const uptimeValue = healthStatus.status === 'healthy' ? 100 : healthStatus.status === 'degraded' ? 95 : 0;
    if (uptimeValue < slaThresholds.uptime) {
      violations.push({
        metric: 'uptime',
        threshold: slaThresholds.uptime,
        actual: uptimeValue,
        timestamp: new Date(),
      });
    }

    if (performanceMetrics.apiPerformance.averageResponseTime > slaThresholds.averageResponseTime) {
      violations.push({
        metric: 'averageResponseTime',
        threshold: slaThresholds.averageResponseTime,
        actual: performanceMetrics.apiPerformance.averageResponseTime,
        timestamp: new Date(),
      });
    }

    if (performanceMetrics.queryPerformance.slowQueryPercentage > slaThresholds.errorRate * 100) {
      violations.push({
        metric: 'errorRate',
        threshold: slaThresholds.errorRate * 100,
        actual: performanceMetrics.queryPerformance.slowQueryPercentage,
        timestamp: new Date(),
      });
    }

    return {
      uptime: uptimeValue,
      averageResponseTime: performanceMetrics.apiPerformance.averageResponseTime,
      errorRate: performanceMetrics.queryPerformance.slowQueryPercentage / 100,
      slaCompliance: violations.length === 0,
      violations,
    };
  }

  // Private helper methods
  private async getActiveUsers(): Promise<number> {
    return Math.floor(Math.random() * 50) + 10; // Mock data
  }

  private async getDatabaseConnections(): Promise<number> {
    try {
      // PostgreSQL equivalent of MySQL's SHOW STATUS
      const result = await prisma.$queryRaw`
        SELECT count(*) as connection_count 
        FROM pg_stat_activity 
        WHERE state = 'active'
      `;
      return parseInt((result as any)[0]?.connection_count || '0');
    } catch {
      return 0;
    }
  }

  private async getCpuUsage(): Promise<number> {
    const startUsage = process.cpuUsage();
    await new Promise(resolve => setTimeout(resolve, 100));
    const endUsage = process.cpuUsage(startUsage);
    return (endUsage.user + endUsage.system) / 1000000; // Convert to seconds
  }

  private calculateAverageResponseTime(): number {
    if (this.performanceHistory.length === 0) return 0;
    const recent = this.performanceHistory.slice(-10);
    return recent.reduce((sum, p) => sum + p.apiPerformance.averageResponseTime, 0) / recent.length;
  }

  private calculateErrorRate(): number {
    if (this.errorHistory.length === 0) return 0;
    const recent = this.errorHistory.slice(-10);
    return recent.reduce((sum, e) => sum + e.errorRate, 0) / recent.length;
  }

  private calculatePercentileResponseTime(percentile: number): number {
    if (this.performanceHistory.length === 0) return 0;
    const responseTimes = this.performanceHistory.map(p => p.apiPerformance.averageResponseTime).sort((a, b) => a - b);
    const index = Math.ceil((percentile / 100) * responseTimes.length) - 1;
    return responseTimes[index] || 0;
  }

  private getErrorTypes(): Record<string, number> {
    if (this.errorHistory.length === 0) return {};
    const recent = this.errorHistory[this.errorHistory.length - 1];
    return recent.recentErrors.reduce((acc, error) => {
      const type = error.error.split(':')[0];
      acc[type] = (acc[type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
  }

  private async checkDatabaseHealth(): Promise<boolean> {
    try {
      await prisma.$queryRaw`SELECT 1`;
      return true;
    } catch {
      return false;
    }
  }

  private async checkCacheHealth(): Promise<boolean> {
    return await cacheService.healthCheck();
  }

  private async checkGraphQLHealth(): Promise<boolean> {
    return true; // Mock implementation
  }

  private checkMemoryHealth(): boolean {
    const memUsage = process.memoryUsage();
    return memUsage.heapUsed < 100 * 1024 * 1024; // Less than 100MB
  }

  private checkCpuHealth(): boolean {
    return true; // Mock implementation
  }

  private async getUserSessions(): Promise<number> {
    return Math.floor(Math.random() * 20) + 5; // Mock data
  }

  private async getAverageSessionDuration(): Promise<number> {
    return Math.floor(Math.random() * 30) + 10; // Mock data in minutes
  }

  private async getPopularFeatures(): Promise<Array<{ feature: string; usageCount: number }>> {
    return [
      { feature: 'schedule_view', usageCount: 150 },
      { feature: 'analytics', usageCount: 120 },
      { feature: 'calendar_export', usageCount: 80 },
    ];
  }

  private async getUserEngagement(): Promise<{ dailyActiveUsers: number; weeklyActiveUsers: number; monthlyActiveUsers: number }> {
    return {
      dailyActiveUsers: Math.floor(Math.random() * 100) + 50,
      weeklyActiveUsers: Math.floor(Math.random() * 300) + 200,
      monthlyActiveUsers: Math.floor(Math.random() * 1000) + 800,
    };
  }

  private startMetricsCollection(): void {
    setInterval(async () => {
      await this.collectApplicationMetrics();
      await this.collectPerformanceMetrics();
      await this.collectUserAnalytics();
    }, 30000); // Collect metrics every 30 seconds
  }
}

export const monitoringService = new MonitoringService();
