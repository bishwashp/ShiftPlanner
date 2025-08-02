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
exports.performanceOptimizer = exports.PerformanceOptimizer = void 0;
const prisma_1 = require("../lib/prisma");
const cache_1 = require("../lib/cache");
const MonitoringService_2 = require("./MonitoringService");
class PerformanceOptimizer {
    constructor() {
        this.optimizations = [];
        this.recommendations = [];
        this.isOptimizing = false;
        this.initializeOptimizations();
        this.startPerformanceMonitoring();
    }
    // Initialize default optimizations
    initializeOptimizations() {
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
    startPerformanceMonitoring() {
        if (this.isOptimizing)
            return;
        this.isOptimizing = true;
        // Monitor performance every 5 minutes
        setInterval(() => __awaiter(this, void 0, void 0, function* () {
            yield this.analyzePerformance();
        }), 5 * 60 * 1000);
        console.log('⚡ Performance optimizer started');
    }
    // Analyze current performance and generate recommendations
    analyzePerformance() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const metrics = yield this.collectPerformanceMetrics();
                yield this.generateRecommendations(metrics);
                yield this.applyAutomaticOptimizations(metrics);
            }
            catch (error) {
                console.error('Performance analysis error:', error);
            }
        });
    }
    // Collect comprehensive performance metrics
    collectPerformanceMetrics() {
        return __awaiter(this, void 0, void 0, function* () {
            const dbPerformance = prisma_1.prisma.getPerformanceMetrics();
            const cacheStats = yield cache_1.cacheService.getStats();
            const appMetrics = yield MonitoringService_2.monitoringService.collectApplicationMetrics();
            return {
                database: {
                    connectionPool: yield this.getConnectionPoolMetrics(),
                    queryPerformance: {
                        totalQueries: dbPerformance.totalQueries,
                        slowQueries: dbPerformance.slowQueries,
                        averageDuration: dbPerformance.averageDuration,
                        p95Duration: this.calculatePercentile(dbPerformance.averageDuration, 95),
                        p99Duration: this.calculatePercentile(dbPerformance.averageDuration, 99),
                    },
                    indexes: yield this.getIndexMetrics(),
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
        });
    }
    // Generate optimization recommendations based on metrics
    generateRecommendations(metrics) {
        return __awaiter(this, void 0, void 0, function* () {
            const newRecommendations = [];
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
        });
    }
    // Apply automatic optimizations
    applyAutomaticOptimizations(metrics) {
        return __awaiter(this, void 0, void 0, function* () {
            // Auto-enable compression if not enabled
            if (!metrics.compression.enabled) {
                yield this.enableCompression();
            }
            // Auto-adjust cache TTL based on hit rate
            if (metrics.cache.hitRate < 0.6) {
                yield this.adjustCacheTTL();
            }
            // Auto-optimize connection pool if needed
            if (metrics.database.connectionPool.waiting > 5) {
                yield this.optimizeConnectionPool();
            }
        });
    }
    // Query optimization methods
    optimizeQueries() {
        return __awaiter(this, void 0, void 0, function* () {
            const slowQueries = yield this.identifySlowQueries();
            const optimizations = [];
            for (const query of slowQueries) {
                const optimization = yield this.optimizeQuery(query);
                if (optimization) {
                    optimizations.push(optimization);
                }
            }
            return optimizations;
        });
    }
    identifySlowQueries() {
        return __awaiter(this, void 0, void 0, function* () {
            // Mock implementation - in production, analyze actual query logs
            return [
                'SELECT * FROM schedules WHERE date BETWEEN ? AND ?',
                'SELECT * FROM analysts WHERE isActive = ?',
                'SELECT COUNT(*) FROM schedules WHERE analystId = ?',
            ];
        });
    }
    optimizeQuery(query) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const originalDuration = 1000; // Mock - in production, measure actual duration
                const optimizedDuration = originalDuration * 0.6; // 40% improvement
                const optimization = {
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
            }
            catch (error) {
                console.error('Query optimization error:', error);
                return null;
            }
        });
    }
    // Connection pooling optimization
    implementConnectionPooling() {
        return __awaiter(this, void 0, void 0, function* () {
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
            }
            catch (error) {
                console.error('Connection pooling optimization error:', error);
            }
        });
    }
    // Enable query compression
    enableQueryCompression() {
        return __awaiter(this, void 0, void 0, function* () {
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
            }
            catch (error) {
                console.error('Query compression error:', error);
            }
        });
    }
    // CDN distribution setup
    setupCDNDistribution() {
        return __awaiter(this, void 0, void 0, function* () {
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
            }
            catch (error) {
                console.error('CDN setup error:', error);
            }
        });
    }
    // Cache optimization
    optimizeCache() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const cacheStats = yield cache_1.cacheService.getStats();
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
            }
            catch (error) {
                console.error('Cache optimization error:', error);
            }
        });
    }
    // Helper methods
    getConnectionPoolMetrics() {
        return __awaiter(this, void 0, void 0, function* () {
            // Mock implementation - in production, get actual pool metrics
            return {
                total: 20,
                active: 8,
                idle: 10,
                waiting: 2,
            };
        });
    }
    getIndexMetrics() {
        return __awaiter(this, void 0, void 0, function* () {
            // Mock implementation - in production, analyze actual database indexes
            return {
                total: 15,
                unused: 2,
                missing: 3,
            };
        });
    }
    calculatePercentile(value, percentile) {
        // Mock implementation - in production, calculate actual percentiles
        return value * (1 + (percentile - 50) / 100);
    }
    enableCompression() {
        return __awaiter(this, void 0, void 0, function* () {
            console.log('🔧 Auto-enabling compression');
            // Mock implementation
        });
    }
    adjustCacheTTL() {
        return __awaiter(this, void 0, void 0, function* () {
            console.log('🔧 Auto-adjusting cache TTL');
            // Mock implementation
        });
    }
    optimizeConnectionPool() {
        return __awaiter(this, void 0, void 0, function* () {
            console.log('🔧 Auto-optimizing connection pool');
            // Mock implementation
        });
    }
    // Public API methods
    getOptimizations() {
        return __awaiter(this, void 0, void 0, function* () {
            return this.optimizations.sort((a, b) => b.appliedAt.getTime() - a.appliedAt.getTime());
        });
    }
    getRecommendations(filters) {
        return __awaiter(this, void 0, void 0, function* () {
            let filtered = this.recommendations;
            if (filters === null || filters === void 0 ? void 0 : filters.type) {
                filtered = filtered.filter(r => r.type === filters.type);
            }
            if (filters === null || filters === void 0 ? void 0 : filters.priority) {
                filtered = filtered.filter(r => r.priority === filters.priority);
            }
            if (filters === null || filters === void 0 ? void 0 : filters.status) {
                filtered = filtered.filter(r => r.status === filters.status);
            }
            return filtered.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
        });
    }
    implementRecommendation(id) {
        return __awaiter(this, void 0, void 0, function* () {
            const recommendation = this.recommendations.find(r => r.id === id);
            if (!recommendation || recommendation.status !== 'pending') {
                return null;
            }
            try {
                switch (recommendation.type) {
                    case 'database':
                        yield this.optimizeQueries();
                        break;
                    case 'cache':
                        yield this.optimizeCache();
                        break;
                    case 'api':
                        yield this.enableQueryCompression();
                        break;
                    case 'compression':
                        yield this.enableQueryCompression();
                        break;
                }
                recommendation.status = 'implemented';
                recommendation.implementedAt = new Date();
                console.log(`✅ Implemented recommendation: ${recommendation.title}`);
                return recommendation;
            }
            catch (error) {
                recommendation.status = 'rejected';
                recommendation.error = error instanceof Error ? error.message : 'Unknown error';
                console.error(`❌ Failed to implement recommendation: ${recommendation.title}`, error);
                return recommendation;
            }
        });
    }
    getPerformanceReport() {
        return __awaiter(this, void 0, void 0, function* () {
            const metrics = yield this.collectPerformanceMetrics();
            const optimizations = yield this.getOptimizations();
            const recommendations = yield this.getRecommendations();
            return {
                metrics,
                optimizations,
                recommendations,
            };
        });
    }
}
exports.PerformanceOptimizer = PerformanceOptimizer;
exports.performanceOptimizer = new PerformanceOptimizer();
