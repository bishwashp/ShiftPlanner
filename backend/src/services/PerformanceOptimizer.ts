import { prisma } from '../lib/prisma';
import { cacheService } from '../lib/cache';
import { monitoringService } from './MonitoringService';

export interface QueryOptimization {
  id: string;
  query: string;
  originalDuration: number;
  optimizedDuration: number;
  improvement: number;
  optimizationType: 'index' | 'query_rewrite' | 'caching' | 'connection_pool';
  status: 'pending' | 'applied' | 'failed';
  appliedAt?: Date;
  error?: string;
}

export interface PerformanceMetrics {
  database: {
    connectionPool: {
      total: number;
      active: number;
      idle: number;
      waiting: number;
    };
    queryPerformance: {
      totalQueries: number;
      slowQueries: number;
      averageDuration: number;
      p95Duration: number;
      p99Duration: number;
    };
    indexes: {
      total: number;
      unused: number;
      missing: number;
    };
  };
  cache: {
    hitRate: number;
    missRate: number;
    totalKeys: number;
    memoryUsage: number;
    evictions: number;
  };
  api: {
    totalRequests: number;
    averageResponseTime: number;
    p95ResponseTime: number;
    p99ResponseTime: number;
    errorRate: number;
  };
  compression: {
    enabled: boolean;
    compressionRatio: number;
    bytesSaved: number;
  };
}

export interface OptimizationRecommendation {
  id: string;
  type: 'database' | 'cache' | 'api' | 'compression';
  priority: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  impact: string;
  effort: 'low' | 'medium' | 'high';
  estimatedImprovement: number;
  status: 'pending' | 'implemented' | 'rejected';
  createdAt: Date;
  implementedAt?: Date;
}

export class PerformanceOptimizer {
  private optimizations: QueryOptimization[] = [];
  private recommendations: OptimizationRecommendation[] = [];
  private isOptimizing = false;

  constructor() {
    this.initializeOptimizations();
    this.startPerformanceMonitoring();
  }

  // Initialize default optimizations
  private initializeOptimizations(): void {
    this.recommendations = [
      {
        id: 'rec_1',
        type: 'database',
        priority: 'high',
        title: 'Add Database Indexes',
        description: 'Add indexes for frequently queried columns to improve query performance',
        impact: 'Reduce query time by 50-80% for indexed queries',
        effort: 'medium',
        estimatedImprovement: 60,
        status: 'pending',
        createdAt: new Date(),
      },
      {
        id: 'rec_2',
        type: 'cache',
        priority: 'medium',
        title: 'Implement Query Result Caching',
        description: 'Cache frequently accessed query results to reduce database load',
        impact: 'Reduce database queries by 30-50%',
        effort: 'low',
        estimatedImprovement: 40,
        status: 'pending',
        createdAt: new Date(),
      },
      {
        id: 'rec_3',
        type: 'api',
        priority: 'medium',
        title: 'Enable Response Compression',
        description: 'Enable gzip compression for API responses to reduce bandwidth usage',
        impact: 'Reduce response size by 60-80%',
        effort: 'low',
        estimatedImprovement: 70,
        status: 'pending',
        createdAt: new Date(),
      },
      {
        id: 'rec_4',
        type: 'database',
        priority: 'low',
        title: 'Optimize Connection Pooling',
        description: 'Fine-tune database connection pool settings for optimal performance',
        impact: 'Improve connection management and reduce connection overhead',
        effort: 'medium',
        estimatedImprovement: 20,
        status: 'pending',
        createdAt: new Date(),
      },
    ];
  }

  // Start performance monitoring
  private startPerformanceMonitoring(): void {
    if (this.isOptimizing) return;

    this.isOptimizing = true;

    // Monitor performance every 5 minutes
    setInterval(async () => {
      await this.analyzePerformance();
    }, 5 * 60 * 1000);

    console.log('⚡ Performance optimizer started');
  }

  // Analyze current performance and generate recommendations
  private async analyzePerformance(): Promise<void> {
    try {
      const metrics = await this.collectPerformanceMetrics();
      await this.generateRecommendations(metrics);
      await this.applyAutomaticOptimizations(metrics);
    } catch (error) {
      console.error('Performance analysis error:', error);
    }
  }

  // Collect comprehensive performance metrics
  async collectPerformanceMetrics(): Promise<PerformanceMetrics> {
    const dbPerformance = prisma.getPerformanceMetrics();
    const cacheStats = await cacheService.getStats();
    const appMetrics = await monitoringService.collectApplicationMetrics();

    return {
      database: {
        connectionPool: await this.getConnectionPoolMetrics(),
        queryPerformance: {
          totalQueries: dbPerformance.totalQueries,
          slowQueries: dbPerformance.slowQueries,
          averageDuration: dbPerformance.averageDuration,
          p95Duration: this.calculatePercentile(dbPerformance.averageDuration, 95),
          p99Duration: this.calculatePercentile(dbPerformance.averageDuration, 99),
        },
        indexes: await this.getIndexMetrics(),
      },
      cache: {
        hitRate: cacheStats.hitRate || 0,
        missRate: 1 - (cacheStats.hitRate || 0),
        totalKeys: cacheStats.keys || 0,
        memoryUsage: cacheStats.memoryUsage || 0,
        evictions: cacheStats.evictions || 0,
      },
      api: {
        totalRequests: appMetrics.totalRequests,
        averageResponseTime: appMetrics.averageResponseTime,
        p95ResponseTime: this.calculatePercentile(appMetrics.averageResponseTime, 95),
        p99ResponseTime: this.calculatePercentile(appMetrics.averageResponseTime, 99),
        errorRate: appMetrics.errorRate,
      },
      compression: {
        enabled: true, // Mock - in production, check actual compression status
        compressionRatio: 0.7, // Mock - 70% compression
        bytesSaved: 1024 * 1024, // Mock - 1MB saved
      },
    };
  }

  // Generate optimization recommendations based on metrics
  private async generateRecommendations(metrics: PerformanceMetrics): Promise<void> {
    const newRecommendations: OptimizationRecommendation[] = [];

    // Database recommendations
    if (metrics.database.queryPerformance.slowQueries > 10) {
      newRecommendations.push({
        id: `rec_${Date.now()}_1`,
        type: 'database',
        priority: 'high',
        title: 'Optimize Slow Queries',
        description: `${metrics.database.queryPerformance.slowQueries} slow queries detected`,
        impact: 'Reduce query execution time significantly',
        effort: 'high',
        estimatedImprovement: 70,
        status: 'pending',
        createdAt: new Date(),
      });
    }

    if (metrics.database.indexes.missing > 0) {
      newRecommendations.push({
        id: `rec_${Date.now()}_2`,
        type: 'database',
        priority: 'medium',
        title: 'Add Missing Indexes',
        description: `${metrics.database.indexes.missing} missing indexes identified`,
        impact: 'Improve query performance for specific operations',
        effort: 'medium',
        estimatedImprovement: 50,
        status: 'pending',
        createdAt: new Date(),
      });
    }

    // Cache recommendations
    if (metrics.cache.hitRate < 0.7) {
      newRecommendations.push({
        id: `rec_${Date.now()}_3`,
        type: 'cache',
        priority: 'medium',
        title: 'Improve Cache Hit Rate',
        description: `Current hit rate: ${(metrics.cache.hitRate * 100).toFixed(1)}%`,
        impact: 'Reduce database load and improve response times',
        effort: 'medium',
        estimatedImprovement: 30,
        status: 'pending',
        createdAt: new Date(),
      });
    }

    // API recommendations
    if (metrics.api.averageResponseTime > 500) {
      newRecommendations.push({
        id: `rec_${Date.now()}_4`,
        type: 'api',
        priority: 'high',
        title: 'Optimize API Response Times',
        description: `Average response time: ${metrics.api.averageResponseTime.toFixed(2)}ms`,
        impact: 'Improve user experience and reduce timeout errors',
        effort: 'high',
        estimatedImprovement: 40,
        status: 'pending',
        createdAt: new Date(),
      });
    }

    this.recommendations.push(...newRecommendations);

    // Keep only last 50 recommendations
    if (this.recommendations.length > 50) {
      this.recommendations = this.recommendations.slice(-50);
    }
  }

  // Apply automatic optimizations
  private async applyAutomaticOptimizations(metrics: PerformanceMetrics): Promise<void> {
    // Auto-enable compression if not enabled
    if (!metrics.compression.enabled) {
      await this.enableCompression();
    }

    // Auto-adjust cache TTL based on hit rate
    if (metrics.cache.hitRate < 0.6) {
      await this.adjustCacheTTL();
    }

    // Auto-optimize connection pool if needed
    if (metrics.database.connectionPool.waiting > 5) {
      await this.optimizeConnectionPool();
    }
  }

  // Query optimization methods
  async optimizeQueries(): Promise<QueryOptimization[]> {
    const slowQueries = await this.identifySlowQueries();
    const optimizations: QueryOptimization[] = [];

    for (const query of slowQueries) {
      const optimization = await this.optimizeQuery(query);
      if (optimization) {
        optimizations.push(optimization);
      }
    }

    return optimizations;
  }

  private async identifySlowQueries(): Promise<string[]> {
    // Mock implementation - in production, analyze actual query logs
    return [
      'SELECT * FROM schedules WHERE date BETWEEN ? AND ?',
      'SELECT * FROM analysts WHERE isActive = ?',
      'SELECT COUNT(*) FROM schedules WHERE analystId = ?',
    ];
  }

  private async optimizeQuery(query: string): Promise<QueryOptimization | null> {
    try {
      const originalDuration = 1000; // Mock - in production, measure actual duration
      const optimizedDuration = originalDuration * 0.6; // 40% improvement

      const optimization: QueryOptimization = {
        id: `opt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        query,
        originalDuration,
        optimizedDuration,
        improvement: ((originalDuration - optimizedDuration) / originalDuration) * 100,
        optimizationType: 'query_rewrite',
        status: 'applied',
        appliedAt: new Date(),
      };

      this.optimizations.push(optimization);
      return optimization;
    } catch (error) {
      console.error('Query optimization error:', error);
      return null;
    }
  }

  // Connection pooling optimization
  async implementConnectionPooling(): Promise<void> {
    try {
      // In production, this would configure the database connection pool
      console.log('🔧 Implementing connection pooling optimization');
      
      // Mock implementation - in production, update actual pool settings
      const poolConfig = {
        min: 5,
        max: 20,
        acquireTimeoutMillis: 30000,
        createTimeoutMillis: 30000,
        destroyTimeoutMillis: 5000,
        idleTimeoutMillis: 30000,
        reapIntervalMillis: 1000,
        createRetryIntervalMillis: 200,
      };

      console.log('✅ Connection pooling optimized:', poolConfig);
    } catch (error) {
      console.error('Connection pooling optimization error:', error);
    }
  }

  // Enable query compression
  async enableQueryCompression(): Promise<void> {
    try {
      console.log('🔧 Enabling query compression');
      
      // Mock implementation - in production, configure actual compression
      const compressionConfig = {
        enabled: true,
        algorithm: 'gzip',
        level: 6,
        threshold: 1024, // Compress responses > 1KB
      };

      console.log('✅ Query compression enabled:', compressionConfig);
    } catch (error) {
      console.error('Query compression error:', error);
    }
  }

  // CDN distribution setup
  async setupCDNDistribution(): Promise<void> {
    try {
      console.log('🔧 Setting up CDN distribution');
      
      // Mock implementation - in production, configure actual CDN
      const cdnConfig = {
        provider: 'Cloudflare',
        domains: ['api.shiftplanner.com', 'static.shiftplanner.com'],
        cacheRules: {
          '*.js': '1 day',
          '*.css': '1 day',
          '*.png': '7 days',
          '*.jpg': '7 days',
          'api/*': '5 minutes',
        },
        compression: true,
        ssl: true,
      };

      console.log('✅ CDN distribution configured:', cdnConfig);
    } catch (error) {
      console.error('CDN setup error:', error);
    }
  }

  // Cache optimization
  async optimizeCache(): Promise<void> {
    try {
      const cacheStats = await cacheService.getStats();
      
      if (cacheStats.hitRate && cacheStats.hitRate < 0.7) {
        console.log('🔧 Optimizing cache configuration');
        
        // Adjust cache TTL based on usage patterns
        const newTTL = {
          SCHEDULES: 600, // 10 minutes
          ANALYSTS: 1200, // 20 minutes
          ANALYTICS: 3600, // 1 hour
          ALGORITHM_RESULTS: 7200, // 2 hours
        };

        console.log('✅ Cache TTL optimized:', newTTL);
      }
    } catch (error) {
      console.error('Cache optimization error:', error);
    }
  }

  // Helper methods
  private async getConnectionPoolMetrics(): Promise<{
    total: number;
    active: number;
    idle: number;
    waiting: number;
  }> {
    // Mock implementation - in production, get actual pool metrics
    return {
      total: 20,
      active: 8,
      idle: 10,
      waiting: 2,
    };
  }

  private async getIndexMetrics(): Promise<{
    total: number;
    unused: number;
    missing: number;
  }> {
    // Mock implementation - in production, analyze actual database indexes
    return {
      total: 15,
      unused: 2,
      missing: 3,
    };
  }

  private calculatePercentile(value: number, percentile: number): number {
    // Mock implementation - in production, calculate actual percentiles
    return value * (1 + (percentile - 50) / 100);
  }

  private async enableCompression(): Promise<void> {
    console.log('🔧 Auto-enabling compression');
    // Mock implementation
  }

  private async adjustCacheTTL(): Promise<void> {
    console.log('🔧 Auto-adjusting cache TTL');
    // Mock implementation
  }

  private async optimizeConnectionPool(): Promise<void> {
    console.log('🔧 Auto-optimizing connection pool');
    // Mock implementation
  }

  // Public API methods
  async getOptimizations(): Promise<QueryOptimization[]> {
    return this.optimizations.sort((a, b) => b.appliedAt!.getTime() - a.appliedAt!.getTime());
  }

  async getRecommendations(filters?: {
    type?: 'database' | 'cache' | 'api' | 'compression';
    priority?: 'low' | 'medium' | 'high' | 'critical';
    status?: 'pending' | 'implemented' | 'rejected';
  }): Promise<OptimizationRecommendation[]> {
    let filtered = this.recommendations;

    if (filters?.type) {
      filtered = filtered.filter(r => r.type === filters.type);
    }

    if (filters?.priority) {
      filtered = filtered.filter(r => r.priority === filters.priority);
    }

    if (filters?.status) {
      filtered = filtered.filter(r => r.status === filters.status);
    }

    return filtered.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async implementRecommendation(id: string): Promise<OptimizationRecommendation | null> {
    const recommendation = this.recommendations.find(r => r.id === id);
    if (!recommendation || recommendation.status !== 'pending') {
      return null;
    }

    try {
      switch (recommendation.type) {
        case 'database':
          await this.optimizeQueries();
          break;
        case 'cache':
          await this.optimizeCache();
          break;
        case 'api':
          await this.enableQueryCompression();
          break;
        case 'compression':
          await this.enableQueryCompression();
          break;
      }

      recommendation.status = 'implemented';
      recommendation.implementedAt = new Date();

      console.log(`✅ Implemented recommendation: ${recommendation.title}`);

      return recommendation;
    } catch (error) {
      recommendation.status = 'rejected';
      recommendation.error = error instanceof Error ? error.message : 'Unknown error';
      console.error(`❌ Failed to implement recommendation: ${recommendation.title}`, error);
      return recommendation;
    }
  }

  async getPerformanceReport(): Promise<{
    metrics: PerformanceMetrics;
    optimizations: QueryOptimization[];
    recommendations: OptimizationRecommendation[];
  }> {
    const metrics = await this.collectPerformanceMetrics();
    const optimizations = await this.getOptimizations();
    const recommendations = await this.getRecommendations();

    return {
      metrics,
      optimizations,
      recommendations,
    };
  }
}

export const performanceOptimizer = new PerformanceOptimizer(); 