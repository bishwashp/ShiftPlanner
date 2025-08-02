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
exports.httpServer = exports.app = exports.prisma = void 0;
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const compression_1 = __importDefault(require("compression"));
const http_1 = require("http");
const prisma_1 = require("./lib/prisma");
Object.defineProperty(exports, "prisma", { enumerable: true, get: function () { return prisma_1.prisma; } });
const cache_1 = require("./lib/cache");
const routes_1 = __importDefault(require("./routes"));
const server_1 = require("./graphql/server");
// import { securityService } from './services/SecurityService';
const MonitoringService_1 = require("./services/MonitoringService");
const app = (0, express_1.default)();
exports.app = app;
const httpServer = (0, http_1.createServer)(app);
exports.httpServer = httpServer;
// Security middleware
app.use((0, helmet_1.default)({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            scriptSrc: ["'self'"],
            imgSrc: ["'self'", "data:", "https:"],
        },
    },
    crossOriginEmbedderPolicy: false,
}));
// CORS configuration
app.use((0, cors_1.default)({
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
}));
// Compression middleware
app.use((0, compression_1.default)({
    filter: (req, res) => {
        if (req.headers['x-no-compression']) {
            return false;
        }
        return compression_1.default.filter(req, res);
    },
    level: 6,
    threshold: 1024,
}));
// Body parsing middleware
app.use(express_1.default.json({ limit: '10mb' }));
app.use(express_1.default.urlencoded({ extended: true, limit: '10mb' }));
// Rate limiting middleware for API routes
// app.use('/api', securityService.createRateLimitMiddleware(securityService.getConfig().rateLimits.api));
// Request logging middleware
app.use((req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    const startTime = Date.now();
    // Log request start
    // await securityService.logAuditEvent('REQUEST_START', 'api', undefined, {
    //   method: req.method,
    //   url: req.url,
    //   ip: req.ip,
    //   userAgent: req.headers['user-agent'],
    // }, req);
    // Override res.end to log response
    const originalEnd = res.end;
    res.end = function (chunk, encoding) {
        const duration = Date.now() - startTime;
        // Log request completion
        // securityService.logAuditEvent('REQUEST_END', 'api', undefined, {
        //   method: req.method,
        //   url: req.url,
        //   statusCode: res.statusCode,
        //   duration,
        // }, req);
        return originalEnd.call(this, chunk, encoding);
    };
    next();
}));
// Authentication middleware for protected routes
// app.use('/api/analysts', securityService.createAuthMiddleware());
// app.use('/api/schedules', securityService.createAuthMiddleware());
// app.use('/api/algorithms', securityService.createAuthMiddleware());
// app.use('/api/constraints', securityService.createAuthMiddleware());
// app.use('/api/analytics', securityService.createAuthMiddleware());
// app.use('/api/monitoring', securityService.createAuthMiddleware());
// Health check endpoint with database, cache, and GraphQL performance metrics
app.get('/health', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        // Test database connection
        yield prisma_1.prisma.$queryRaw `SELECT 1`;
        // Test cache connection
        const cacheHealthy = yield cache_1.cacheService.healthCheck();
        // Test GraphQL server
        const graphqlHealth = yield (0, server_1.graphqlHealthCheck)();
        const performanceMetrics = (0, prisma_1.getDatabasePerformance)();
        const cacheStats = yield cache_1.cacheService.getStats();
        res.json({
            status: 'ok',
            timestamp: new Date().toISOString(),
            version: '1.0.0',
            database: {
                status: 'connected',
                performance: performanceMetrics
            },
            cache: {
                status: cacheHealthy ? 'connected' : 'disconnected',
                stats: cacheStats
            },
            graphql: {
                status: graphqlHealth.status,
                message: graphqlHealth.message
            }
        });
    }
    catch (error) {
        res.status(503).json({
            status: 'error',
            timestamp: new Date().toISOString(),
            version: '1.0.0',
            database: {
                status: 'disconnected',
                error: error instanceof Error ? error.message : 'Unknown error'
            },
            cache: {
                status: 'unknown'
            },
            graphql: {
                status: 'unknown',
                error: error instanceof Error ? error.message : 'Unknown error'
            }
        });
    }
}));
// Database performance endpoint
app.get('/health/db-performance', (req, res) => {
    const metrics = (0, prisma_1.getDatabasePerformance)();
    res.json({
        timestamp: new Date().toISOString(),
        metrics
    });
});
// Cache performance endpoint
app.get('/health/cache-performance', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const stats = yield cache_1.cacheService.getStats();
        const healthy = yield cache_1.cacheService.healthCheck();
        res.json({
            timestamp: new Date().toISOString(),
            healthy,
            stats
        });
    }
    catch (error) {
        res.status(503).json({
            timestamp: new Date().toISOString(),
            healthy: false,
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
}));
// GraphQL performance endpoint
app.get('/health/graphql-performance', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const health = yield (0, server_1.graphqlHealthCheck)();
        res.json({
            timestamp: new Date().toISOString(),
            health
        });
    }
    catch (error) {
        res.status(503).json({
            timestamp: new Date().toISOString(),
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
}));
// Cache warming endpoint
app.post('/health/warm-cache', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        yield cache_1.cacheService.warmCache();
        res.json({
            timestamp: new Date().toISOString(),
            status: 'Cache warmed successfully'
        });
    }
    catch (error) {
        res.status(500).json({
            timestamp: new Date().toISOString(),
            error: error instanceof Error ? error.message : 'Failed to warm cache'
        });
    }
}));
// API routes
app.use('/api', routes_1.default);
// GraphQL endpoint info
app.get('/graphql', (req, res) => {
    res.json({
        message: 'GraphQL endpoint',
        playground: '/graphql',
        documentation: 'Use GraphQL Playground for interactive queries',
        examples: {
            health: `
        query {
          health {
            status
            timestamp
            version
            database {
              status
              performance {
                totalQueries
                averageDuration
              }
            }
            cache {
              status
              stats {
                keys
                hitRate
              }
            }
          }
        }
      `,
            analysts: `
        query {
          analysts {
            id
            name
            email
            shiftType
            isActive
            totalWorkDays
            screenerDays
            weekendDays
            fairnessScore
          }
        }
      `,
            schedulePreview: `
        query {
          generateSchedulePreview(input: {
            startDate: "2025-01-01"
            endDate: "2025-01-07"
            algorithmType: "WeekendRotationAlgorithm"
          }) {
            startDate
            endDate
            algorithmType
            summary {
              totalDays
              totalSchedules
              fairnessScore
              executionTime
            }
            fairnessMetrics {
              overallFairnessScore
              recommendations
            }
            performanceMetrics {
              algorithmExecutionTime
              memoryUsage
            }
          }
        }
      `
        }
    });
});
// Error handling middleware
app.use((err, req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    // Track error with monitoring service
    yield MonitoringService_1.monitoringService.trackError(err, {
        url: req.url,
        method: req.method,
        ip: req.ip,
        userAgent: req.headers['user-agent'],
    });
    // Log audit event
    // await securityService.logAuditEvent('ERROR', 'api', undefined, {
    //   error: err.message,
    //   stack: err.stack,
    //   url: req.url,
    //   method: req.method,
    // }, req);
    console.error('Express Error:', err);
    res.status(500).json({
        error: 'Internal server error',
        message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
    });
}));
// 404 handler
app.use('*', (req, res) => {
    res.status(404).json({
        error: 'Not found',
        message: `Route ${req.originalUrl} not found`,
        availableEndpoints: {
            health: '/health',
            api: '/api',
            graphql: '/graphql',
            graphqlPlayground: '/graphql'
        }
    });
});
