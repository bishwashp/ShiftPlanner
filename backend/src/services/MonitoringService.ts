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
    averageResponseTime: 0,
    errorRate: 0,
    cacheHitRate: 0,
    databaseConnections: 0,
    memoryUsage: 0,
    cpuUsage: 0,
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

  constructor() {
    this.startMetricsCollection();
  }

  // Application Metrics Collection
  async collectApplicationMetrics(): Promise<ApplicationMetrics> {
    const cacheStats = await cacheService.getStats();
    const dbPerformance = prisma.getPerformanceMetrics();
    
    this.metrics = {
      totalRequests: this.metrics.totalRequests + 1,
      activeUsers: await this.getActiveUsers(),
      averageResponseTime: this.calculateAverageResponseTime(),
      errorRate: this.calculateErrorRate(),
      cacheHitRate: cacheStats.hitRate || 0,
      databaseConnections: await this.getDatabaseConnections(),
      memoryUsage: process.memoryUsage().heapUsed / 1024 / 1024, // MB
      cpuUsage: await this.getCpuUsage(),
    };

    return this.metrics;
  }

  // Performance Monitoring
  async collectPerformanceMetrics(): Promise<PerformanceMetrics> {
    const dbPerformance = prisma.getPerformanceMetrics();
    const cacheStats = await cacheService.getStats();

    const performanceMetrics: PerformanceMetrics = {
      queryPerformance: {
        totalQueries: dbPerformance.totalQueries,
        slowQueries: dbPerformance.slowQueries,
        averageDuration: dbPerformance.averageDuration,
        slowQueryPercentage: dbPerformance.slowQueryPercentage,
      },
      apiPerformance: {
        totalRequests: this.metrics.totalRequests,
        averageResponseTime: this.metrics.averageResponseTime,
        p95ResponseTime: this.calculatePercentileResponseTime(95),
        p99ResponseTime: this.calculatePercentileResponseTime(99),
      },
      cachePerformance: {
        hitRate: cacheStats.hitRate || 0,
        missRate: 1 - (cacheStats.hitRate || 0),
        totalKeys: cacheStats.keys || 0,
        memoryUsage: cacheStats.memoryUsage || 0,
      },
    };

    this.performanceHistory.push(performanceMetrics);
    
    // Keep only last 100 entries
    if (this.performanceHistory.length > 100) {
      this.performanceHistory.shift();
    }

    return performanceMetrics;
  }

  // Error Tracking
  async trackError(error: Error, context?: any): Promise<void> {
    const errorMetrics: ErrorMetrics = {
      totalErrors: this.errorHistory.length > 0 ? this.errorHistory[this.errorHistory.length - 1].totalErrors + 1 : 1,
      errorRate: this.calculateErrorRate(),
      errorTypes: this.getErrorTypes(),
      recentErrors: [
        {
          timestamp: new Date(),
          error: error.message,
          stack: error.stack,
          context,
        },
        ...(this.errorHistory.length > 0 ? this.errorHistory[this.errorHistory.length - 1].recentErrors : []),
      ].slice(0, 50), // Keep only last 50 errors
    };

    this.errorHistory.push(errorMetrics);
    
    // Keep only last 100 entries
    if (this.errorHistory.length > 100) {
      this.errorHistory.shift();
    }

    console.error('🚨 Error tracked:', {
      message: error.message,
      timestamp: new Date().toISOString(),
      context,
    });
  }

  // User Analytics
  async collectUserAnalytics(): Promise<UserAnalytics> {
    this.userAnalytics = {
      activeUsers: await this.getActiveUsers(),
      userSessions: await this.getUserSessions(),
      averageSessionDuration: await this.getAverageSessionDuration(),
      popularFeatures: await this.getPopularFeatures(),
      userEngagement: await this.getUserEngagement(),
    };

    return this.userAnalytics;
  }

  // Health Check
  async performHealthCheck(): Promise<HealthStatus> {
    const checks = {
      database: await this.checkDatabaseHealth(),
      cache: await this.checkCacheHealth(),
      graphql: await this.checkGraphQLHealth(),
      memory: this.checkMemoryHealth(),
      cpu: this.checkCpuHealth(),
    };

    const details = {
      database: checks.database ? 'Connected' : 'Disconnected',
      cache: checks.cache ? 'Connected' : 'Disconnected',
      graphql: checks.graphql ? 'Healthy' : 'Unhealthy',
      memory: this.checkMemoryHealth() ? 'Normal' : 'High usage',
      cpu: this.checkCpuHealth() ? 'Normal' : 'High usage',
    };

    const status = Object.values(checks).every(check => check) 
      ? 'healthy' 
      : Object.values(checks).some(check => check) 
        ? 'degraded' 
        : 'unhealthy';

    return {
      status,
      timestamp: new Date(),
      checks,
      details,
    };
  }

  // SLA Compliance
  async generateSLAReport(): Promise<SLAReport> {
    const performanceMetrics = await this.collectPerformanceMetrics();
    const healthStatus = await this.performHealthCheck();

    const slaThresholds = {
      uptime: 99.9,
      averageResponseTime: 200, // ms
      errorRate: 0.01, // 1%
    };

    const violations = [];
    
    if (healthStatus.status !== 'healthy') {
      violations.push({
        metric: 'uptime',
        threshold: slaThresholds.uptime,
        actual: healthStatus.status === 'healthy' ? 100 : healthStatus.status === 'degraded' ? 95 : 0,
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
      uptime: healthStatus.status === 'healthy' ? 100 : healthStatus.status === 'degraded' ? 95 : 0,
      averageResponseTime: performanceMetrics.apiPerformance.averageResponseTime,
      errorRate: performanceMetrics.queryPerformance.slowQueryPercentage / 100,
      slaCompliance: violations.length === 0,
      violations,
    };
  }

  // Private helper methods
  private async getActiveUsers(): Promise<number> {
    // In a real implementation, this would track active user sessions
    return Math.floor(Math.random() * 50) + 10; // Mock data
  }

  private async getDatabaseConnections(): Promise<number> {
    try {
      const result = await prisma.$queryRaw`SHOW STATUS LIKE 'Threads_connected'`;
      return parseInt((result as any)[0]?.Value || '0');
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
    try {
      // Simple GraphQL health check
      return true;
    } catch {
      return false;
    }
  }

  private checkMemoryHealth(): boolean {
    const memoryUsage = process.memoryUsage();
    const heapUsedMB = memoryUsage.heapUsed / 1024 / 1024;
    return heapUsedMB < 500; // Alert if heap usage > 500MB
  }

  private checkCpuHealth(): boolean {
    return this.metrics.cpuUsage < 80; // Alert if CPU usage > 80%
  }

  private async getUserSessions(): Promise<number> {
    // Mock implementation
    return Math.floor(Math.random() * 100) + 20;
  }

  private async getAverageSessionDuration(): Promise<number> {
    // Mock implementation
    return Math.floor(Math.random() * 1800) + 300; // 5-35 minutes
  }

  private async getPopularFeatures(): Promise<Array<{ feature: string; usageCount: number }>> {
    // Mock implementation
    return [
      { feature: 'schedule_view', usageCount: 150 },
      { feature: 'analyst_management', usageCount: 80 },
      { feature: 'analytics', usageCount: 60 },
      { feature: 'constraints', usageCount: 40 },
    ];
  }

  private async getUserEngagement(): Promise<{ dailyActiveUsers: number; weeklyActiveUsers: number; monthlyActiveUsers: number }> {
    // Mock implementation
    return {
      dailyActiveUsers: Math.floor(Math.random() * 30) + 10,
      weeklyActiveUsers: Math.floor(Math.random() * 100) + 50,
      monthlyActiveUsers: Math.floor(Math.random() * 300) + 200,
    };
  }

  private startMetricsCollection(): void {
    // Collect metrics every 30 seconds
    setInterval(async () => {
      await this.collectApplicationMetrics();
      await this.collectPerformanceMetrics();
      await this.collectUserAnalytics();
    }, 30000);
  }
}

export const monitoringService = new MonitoringService(); 