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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.redis = exports.CACHE_TTL = exports.CACHE_KEYS = exports.cacheService = void 0;
const ioredis_1 = __importDefault(require("ioredis"));
const prisma_1 = require("./prisma");
// Redis client configuration
const redis = new ioredis_1.default({
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    password: process.env.REDIS_PASSWORD,
    maxRetriesPerRequest: 3,
    lazyConnect: true,
});
exports.redis = redis;
// Cache configuration
const CACHE_TTL = {
    SCHEDULES: 300, // 5 minutes
    ANALYSTS: 600, // 10 minutes
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
// Multi-level caching service
class CacheService {
    constructor() {
        this.redis = redis;
        this.setupEventHandlers();
    }
    setupEventHandlers() {
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
    get(key) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const value = yield this.redis.get(key);
                return value ? JSON.parse(value) : null;
            }
            catch (error) {
                console.error('Cache get error:', error);
                return null;
            }
        });
    }
    set(key_1, value_1) {
        return __awaiter(this, arguments, void 0, function* (key, value, ttl = 300) {
            try {
                yield this.redis.setex(key, ttl, JSON.stringify(value));
            }
            catch (error) {
                console.error('Cache set error:', error);
            }
        });
    }
    del(key) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                yield this.redis.del(key);
            }
            catch (error) {
                console.error('Cache delete error:', error);
            }
        });
    }
    // Pattern-based cache invalidation
    invalidatePattern(pattern) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const keys = yield this.redis.keys(pattern);
                if (keys.length > 0) {
                    yield this.redis.del(...keys);
                    console.log(`🗑️  Invalidated ${keys.length} cache keys matching pattern: ${pattern}`);
                }
            }
            catch (error) {
                console.error('Cache invalidation error:', error);
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
    getCachedOrCompute(key_1, computeFn_1) {
        return __awaiter(this, arguments, void 0, function* (key, computeFn, ttl = CACHE_TTL.QUERY_RESULTS) {
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
            try {
                const info = yield this.redis.info();
                const keys = yield this.redis.dbsize();
                return {
                    keys,
                    info: info.split('\r\n').reduce((acc, line) => {
                        const [key, value] = line.split(':');
                        if (key && value) {
                            acc[key] = value;
                        }
                        return acc;
                    }, {}),
                };
            }
            catch (error) {
                console.error('Cache stats error:', error);
                return { error: 'Failed to get cache stats' };
            }
        });
    }
    // Health check
    healthCheck() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                yield this.redis.ping();
                return true;
            }
            catch (error) {
                console.error('Cache health check failed:', error);
                return false;
            }
        });
    }
}
// Export singleton instance
exports.cacheService = new CacheService();
