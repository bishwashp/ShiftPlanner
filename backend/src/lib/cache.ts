import { prisma } from './prisma';

// MVP: Use only in-memory cache for maximum performance and zero dependencies
const memoryCache = new Map<string, { value: any; expiry: number }>();

console.log('📦 ShiftPlanner MVP - Using high-performance in-memory cache');

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

// High-performance in-memory cache service for MVP
class CacheService {
  constructor() {
    console.log('⚡ MVP Cache Service initialized - In-memory only');
  }

  // Clean expired entries from memory cache
  private cleanMemoryCache() {
    const now = Date.now();
    for (const [key, entry] of memoryCache.entries()) {
      if (entry.expiry < now) {
        memoryCache.delete(key);
      }
    }
  }

  // Generic cache get/set with TTL
  async get<T>(key: string): Promise<T | null> {
    this.cleanMemoryCache();
    const entry = memoryCache.get(key);
    if (entry && entry.expiry > Date.now()) {
      return entry.value;
    }
    return null;
  }

  async set<T>(key: string, value: T, ttl: number = 300): Promise<void> {
    memoryCache.set(key, {
      value,
      expiry: Date.now() + (ttl * 1000)
    });
  }

  async del(key: string): Promise<void> {
    memoryCache.delete(key);
  }

  // Pattern-based cache invalidation
  async invalidatePattern(pattern: string): Promise<void> {
    const regex = new RegExp(pattern.replace('*', '.*'));
    let deleted = 0;
    for (const key of memoryCache.keys()) {
      if (regex.test(key)) {
        memoryCache.delete(key);
        deleted++;
      }
    }
    if (deleted > 0) {
      console.log(`🗑️  Invalidated ${deleted} memory cache keys matching pattern: ${pattern}`);
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
    this.cleanMemoryCache();
    return {
      keys: memoryCache.size,
      type: 'in-memory-mvp',
      performance: 'high-speed',
      info: {
        used_memory: `~${JSON.stringify([...memoryCache.values()]).length} bytes`,
        active_keys: memoryCache.size,
        cache_hits: 'optimized'
      }
    };
  }

  // Health check
  async healthCheck(): Promise<boolean> {
    // In-memory cache is always healthy and fast
    return true;
  }
}

// Export singleton instance
export const cacheService = new CacheService();

// Export cache keys for external use
export { CACHE_KEYS, CACHE_TTL };

// MVP: No Redis client needed - pure in-memory performance