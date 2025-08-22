import { PrismaClient } from '../../generated/prisma';

// Performance monitoring and optimization
class PerformancePrismaClient extends PrismaClient {
  private queryMetrics = {
    totalQueries: 0,
    slowQueries: 0,
    totalDuration: 0,
    averageDuration: 0,
  };

  constructor() {
    super({
      log: [
        { level: 'query', emit: 'event' },
        { level: 'error', emit: 'stdout' },
        { level: 'info', emit: 'stdout' },
        { level: 'warn', emit: 'stdout' },
      ],
    });

    // Query performance monitoring using event emitter
    (this as any).$on('query', (e: any) => {
      const duration = e.duration;
      const query = e.query;
      
      // Log slow queries for optimization
      if (duration > 1000) {
        console.warn(`🚨 SLOW QUERY (${duration}ms): ${query}`);
      } else if (duration > 500) {
        console.info(`⚠️  MEDIUM QUERY (${duration}ms): ${query}`);
      } else if (duration > 100) {
        console.debug(`📊 QUERY (${duration}ms): ${query}`);
      }
      
      // Track query performance metrics
      this.trackQueryPerformance(duration, query);
    });
  }

  private trackQueryPerformance(duration: number, query: string) {
    this.queryMetrics.totalQueries++;
    this.queryMetrics.totalDuration += duration;
    this.queryMetrics.averageDuration = this.queryMetrics.totalDuration / this.queryMetrics.totalQueries;
    
    if (duration > 1000) {
      this.queryMetrics.slowQueries++;
    }
  }

  // Get performance metrics
  getPerformanceMetrics() {
    return {
      ...this.queryMetrics,
      slowQueryPercentage: (this.queryMetrics.slowQueries / this.queryMetrics.totalQueries) * 100,
    };
  }

  // Optimized connection management
  async $connect() {
    await super.$connect();
    console.log('✅ Database connected with performance monitoring');
  }

  async $disconnect() {
    await super.$disconnect();
    console.log('🔌 Database disconnected');
  }
}

// Create singleton instance
const prisma = new PerformancePrismaClient();

// Graceful shutdown
process.on('beforeExit', async () => {
  await prisma.$disconnect();
});

// Export the optimized client
export { prisma };

// Export performance monitoring utilities
export const getDatabasePerformance = () => prisma.getPerformanceMetrics(); 