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
exports.CACHE_TTL = exports.CACHE_KEYS = exports.cacheService = void 0;
const prisma_1 = require("./prisma");

// MVP: Use only in-memory cache for maximum performance and zero dependencies
const memoryCache = new Map();

console.log('📦 ShiftPlanner MVP - Using high-performance in-memory cache');

// Cache configuration
const CACHE_TTL = {
    SCHEDULES: 300, // 5 minutes
    ANALYSTS: 600,  // 10 minutes
    ANALYTICS: 1800, // 30 minutes
    ALGORITHM_RESULTS: 3600, // 1 hour
    QUERY_RESULTS: 300, // 5 minutes
};
exports.CACHE_TTL = CACHE_TTL;

// Cache key generators
const CACHE_KEYS = {
    schedules: (dateRange) => `schedules:${dateRange}`,
    analyst: (id) => `analyst:${id}`,
    analysts: (filters) => `analysts:${filters}`,
    analytics: (period) => `analytics:${period}`,
    algorithmResult: (params) => `algorithm:${params}`,
    queryResult: (query) => `query:${Buffer.from(query).toString('base64')}`,
};
exports.CACHE_KEYS = CACHE_KEYS;

// High-performance in-memory cache service for MVP
class CacheService {
    constructor() {
        console.log('⚡ MVP Cache Service initialized - In-memory only');
    }

    // Clean expired entries from memory cache
    cleanMemoryCache() {
        const now = Date.now();
        for (const [key, entry] of memoryCache.entries()) {
            if (entry.expiry < now) {
                memoryCache.delete(key);
            }
        }
    }

    // Generic cache get/set with TTL
    get(key) {
        return __awaiter(this, void 0, void 0, function* () {
            this.cleanMemoryCache();
            const entry = memoryCache.get(key);
            if (entry && entry.expiry > Date.now()) {
                return entry.value;
            }
            return null;
        });
    }

    set(key, value, ttl = 300) {
        return __awaiter(this, void 0, void 0, function* () {
            memoryCache.set(key, {
                value,
                expiry: Date.now() + (ttl * 1000)
            });
        });
    }

    del(key) {
        return __awaiter(this, void 0, void 0, function* () {
            memoryCache.delete(key);
        });
    }

    // Pattern-based cache invalidation
    invalidatePattern(pattern) {
        return __awaiter(this, void 0, void 0, function* () {
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
        });
    }

    // Schedule-specific caching
    getSchedules(dateRange) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.get(CACHE_KEYS.schedules(dateRange));
        });
    }

    setSchedules(dateRange, schedules) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.set(CACHE_KEYS.schedules(dateRange), schedules, CACHE_TTL.SCHEDULES);
        });
    }

    invalidateScheduleCache(dateRange) {
        return __awaiter(this, void 0, void 0, function* () {
            if (dateRange) {
                yield this.del(CACHE_KEYS.schedules(dateRange));
            }
            else {
                yield this.invalidatePattern('schedules:*');
            }
        });
    }

    // Analyst-specific caching
    getAnalyst(id) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.get(CACHE_KEYS.analyst(id));
        });
    }

    setAnalyst(id, analyst) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.set(CACHE_KEYS.analyst(id), analyst, CACHE_TTL.ANALYSTS);
        });
    }

    getAnalysts(filters) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.get(CACHE_KEYS.analysts(filters));
        });
    }

    setAnalysts(filters, analysts) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.set(CACHE_KEYS.analysts(filters), analysts, CACHE_TTL.ANALYSTS);
        });
    }

    invalidateAnalystCache(analystId) {
        return __awaiter(this, void 0, void 0, function* () {
            if (analystId) {
                yield this.del(CACHE_KEYS.analyst(analystId));
            }
            else {
                yield this.invalidatePattern('analyst:*');
                yield this.invalidatePattern('analysts:*');
            }
        });
    }

    // Analytics caching
    getAnalytics(period) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.get(CACHE_KEYS.analytics(period));
        });
    }

    setAnalytics(period, data) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.set(CACHE_KEYS.analytics(period), data, CACHE_TTL.ANALYTICS);
        });
    }

    invalidateAnalyticsCache() {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.invalidatePattern('analytics:*');
        });
    }

    // Algorithm result caching
    getAlgorithmResult(params) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.get(CACHE_KEYS.algorithmResult(params));
        });
    }

    setAlgorithmResult(params, result) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.set(CACHE_KEYS.algorithmResult(params), result, CACHE_TTL.ALGORITHM_RESULTS);
        });
    }

    // Query result caching with intelligent key generation
    getCachedOrCompute(key, computeFn, ttl = CACHE_TTL.QUERY_RESULTS) {
        return __awaiter(this, void 0, void 0, function* () {
            // Try to get from cache first
            const cached = yield this.get(key);
            if (cached !== null) {
                console.log(`📦 Cache HIT: ${key}`);
                return cached;
            }
            // Compute and cache the result
            console.log(`⚡ Cache MISS: ${key}`);
            const result = yield computeFn();
            yield this.set(key, result, ttl);
            return result;
        });
    }

    // Cache warming for frequently accessed data
    warmCache() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                console.log('🔥 Warming cache...');
                // Warm analyst cache
                const analysts = yield prisma_1.prisma.analyst.findMany({
                    where: { isActive: true },
                    include: { preferences: true }
                });
                yield this.setAnalysts('active', analysts);
                // Warm recent schedules cache
                const recentSchedules = yield prisma_1.prisma.schedule.findMany({
                    where: {
                        date: {
                            gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // Last 7 days
                            lte: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // Next 7 days
                        }
                    },
                    include: { analyst: true }
                });
                yield this.setSchedules('recent', recentSchedules);
                console.log('✅ Cache warmed successfully');
            }
            catch (error) {
                console.error('❌ Cache warming failed:', error);
            }
        });
    }

    // Cache statistics
    getStats() {
        return __awaiter(this, void 0, void 0, function* () {
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
        });
    }

    // Health check
    healthCheck() {
        return __awaiter(this, void 0, void 0, function* () {
            // In-memory cache is always healthy and fast
            return true;
        });
    }
}

// Export singleton instance
exports.cacheService = new CacheService();

// MVP: No Redis client needed - pure in-memory performance
