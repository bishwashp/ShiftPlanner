import Redis from 'ioredis';
import { prisma } from './prisma';

// Redis client configuration
const redis = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD,
  maxRetriesPerRequest: 3,
  lazyConnect: true,
});

// Cache configuration
const CACHE_TTL = {
  SCHEDULES: 300, // 5 minutes
  ANALYSTS: 600,  // 10 minutes
  ANALYTICS: 1800, // 30 minutes
  ALGORITHM_RESULTS: 3600, // 1 hour
  QUERY_RESULTS: 300, // 5 minutes
};

// Cache key generators
const CACHE_KEYS = {
  schedules: (dateRange: string) => `schedules:${dateRange}`,
  analyst: (id: string) => `analyst:${id}`,
  analysts: (filters: string) => `analysts:${filters}`,
  analytics: (period: string) => `analytics:${period}`,
  algorithmResult: (params: string) => `algorithm:${params}`,
  queryResult: (query: string) => `query:${Buffer.from(query).toString('base64')}`,
};

// Multi-level caching service
class CacheService {
  private redis: Redis;

  constructor() {
    this.redis = redis;
    this.setupEventHandlers();
  }

  private setupEventHandlers() {
    this.redis.on('connect', () => {
      console.log('✅ Redis connected');
    });

    this.redis.on('error', (error) => {
      console.error('❌ Redis error:', error);
    });

    this.redis.on('ready', () => {
      console.log('🚀 Redis ready for caching');
    });
  }

  // Generic cache get/set with TTL
  async get<T>(key: string): Promise<T | null> {
    try {
      const value = await this.redis.get(key);
      return value ? JSON.parse(value) : null;
    } catch (error) {
      console.error('Cache get error:', error);
      return null;
    }
  }

  async set<T>(key: string, value: T, ttl: number = 300): Promise<void> {
    try {
      await this.redis.setex(key, ttl, JSON.stringify(value));
    } catch (error) {
      console.error('Cache set error:', error);
    }
  }

  async del(key: string): Promise<void> {
    try {
      await this.redis.del(key);
    } catch (error) {
      console.error('Cache delete error:', error);
    }
  }

  // Pattern-based cache invalidation
  async invalidatePattern(pattern: string): Promise<void> {
    try {
      const keys = await this.redis.keys(pattern);
      if (keys.length > 0) {
        await this.redis.del(...keys);
        console.log(`🗑️  Invalidated ${keys.length} cache keys matching pattern: ${pattern}`);
      }
    } catch (error) {
      console.error('Cache invalidation error:', error);
    }
  }

  // Schedule-specific caching
  async getSchedules(dateRange: string): Promise<any[] | null> {
    return this.get(CACHE_KEYS.schedules(dateRange));
  }

  async setSchedules(dateRange: string, schedules: any[]): Promise<void> {
    await this.set(CACHE_KEYS.schedules(dateRange), schedules, CACHE_TTL.SCHEDULES);
  }

  async invalidateScheduleCache(dateRange?: string): Promise<void> {
    if (dateRange) {
      await this.del(CACHE_KEYS.schedules(dateRange));
    } else {
      await this.invalidatePattern('schedules:*');
    }
  }

  // Analyst-specific caching
  async getAnalyst(id: string): Promise<any | null> {
    return this.get(CACHE_KEYS.analyst(id));
  }

  async setAnalyst(id: string, analyst: any): Promise<void> {
    await this.set(CACHE_KEYS.analyst(id), analyst, CACHE_TTL.ANALYSTS);
  }

  async getAnalysts(filters: string): Promise<any[] | null> {
    return this.get(CACHE_KEYS.analysts(filters));
  }

  async setAnalysts(filters: string, analysts: any[]): Promise<void> {
    await this.set(CACHE_KEYS.analysts(filters), analysts, CACHE_TTL.ANALYSTS);
  }

  async invalidateAnalystCache(analystId?: string): Promise<void> {
    if (analystId) {
      await this.del(CACHE_KEYS.analyst(analystId));
    } else {
      await this.invalidatePattern('analyst:*');
      await this.invalidatePattern('analysts:*');
    }
  }

  // Analytics caching
  async getAnalytics(period: string): Promise<any | null> {
    return this.get(CACHE_KEYS.analytics(period));
  }

  async setAnalytics(period: string, data: any): Promise<void> {
    await this.set(CACHE_KEYS.analytics(period), data, CACHE_TTL.ANALYTICS);
  }

  async invalidateAnalyticsCache(): Promise<void> {
    await this.invalidatePattern('analytics:*');
  }

  // Algorithm result caching
  async getAlgorithmResult(params: string): Promise<any | null> {
    return this.get(CACHE_KEYS.algorithmResult(params));
  }

  async setAlgorithmResult(params: string, result: any): Promise<void> {
    await this.set(CACHE_KEYS.algorithmResult(params), result, CACHE_TTL.ALGORITHM_RESULTS);
  }

  // Query result caching with intelligent key generation
  async getCachedOrCompute<T>(
    key: string,
    computeFn: () => Promise<T>,
    ttl: number = CACHE_TTL.QUERY_RESULTS
  ): Promise<T> {
    // Try to get from cache first
    const cached = await this.get<T>(key);
    if (cached !== null) {
      console.log(`📦 Cache HIT: ${key}`);
      return cached;
    }

    // Compute and cache the result
    console.log(`⚡ Cache MISS: ${key}`);
    const result = await computeFn();
    await this.set(key, result, ttl);
    return result;
  }

  // Cache warming for frequently accessed data
  async warmCache(): Promise<void> {
    try {
      console.log('🔥 Warming cache...');
      
      // Warm analyst cache
      const analysts = await prisma.analyst.findMany({
        where: { isActive: true },
        include: { preferences: true }
      });
      await this.setAnalysts('active', analysts);

      // Warm recent schedules cache
      const recentSchedules = await prisma.schedule.findMany({
        where: {
          date: {
            gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // Last 7 days
            lte: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // Next 7 days
          }
        },
        include: { analyst: true }
      });
      await this.setSchedules('recent', recentSchedules);

      console.log('✅ Cache warmed successfully');
    } catch (error) {
      console.error('❌ Cache warming failed:', error);
    }
  }

  // Cache statistics
  async getStats(): Promise<any> {
    try {
      const info = await this.redis.info();
      const keys = await this.redis.dbsize();
      
      return {
        keys,
        info: info.split('\r\n').reduce((acc: any, line: string) => {
          const [key, value] = line.split(':');
          if (key && value) {
            acc[key] = value;
          }
          return acc;
        }, {}),
      };
    } catch (error) {
      console.error('Cache stats error:', error);
      return { error: 'Failed to get cache stats' };
    }
  }

  // Health check
  async healthCheck(): Promise<boolean> {
    try {
      await this.redis.ping();
      return true;
    } catch (error) {
      console.error('Cache health check failed:', error);
      return false;
    }
  }
}

// Export singleton instance
export const cacheService = new CacheService();

// Export cache keys for external use
export { CACHE_KEYS, CACHE_TTL };

// Export Redis client for advanced usage
export { redis }; 