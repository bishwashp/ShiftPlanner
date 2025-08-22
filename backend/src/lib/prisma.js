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
exports.getDatabasePerformance = exports.prisma = void 0;
const prisma_1 = require("../../generated/prisma");
// Performance monitoring and optimization
class PerformancePrismaClient extends prisma_1.PrismaClient {
    constructor() {
        super({
            log: [
                { level: 'query', emit: 'event' },
                { level: 'error', emit: 'stdout' },
                { level: 'info', emit: 'stdout' },
                { level: 'warn', emit: 'stdout' },
            ],
        });
        this.queryMetrics = {
            totalQueries: 0,
            slowQueries: 0,
            totalDuration: 0,
            averageDuration: 0,
        };
        // Query performance monitoring using event emitter
        this.$on('query', (e) => {
            const duration = e.duration;
            const query = e.query;
            // Log slow queries for optimization
            if (duration > 1000) {
                console.warn(`🚨 SLOW QUERY (${duration}ms): ${query}`);
            }
            else if (duration > 500) {
                console.info(`⚠️  MEDIUM QUERY (${duration}ms): ${query}`);
            }
            else if (duration > 100) {
                console.debug(`📊 QUERY (${duration}ms): ${query}`);
            }
            // Track query performance metrics
            this.trackQueryPerformance(duration, query);
        });
    }
    trackQueryPerformance(duration, query) {
        this.queryMetrics.totalQueries++;
        this.queryMetrics.totalDuration += duration;
        this.queryMetrics.averageDuration = this.queryMetrics.totalDuration / this.queryMetrics.totalQueries;
        if (duration > 1000) {
            this.queryMetrics.slowQueries++;
        }
    }
    // Get performance metrics
    getPerformanceMetrics() {
        return Object.assign(Object.assign({}, this.queryMetrics), { slowQueryPercentage: (this.queryMetrics.slowQueries / this.queryMetrics.totalQueries) * 100 });
    }
    // Optimized connection management
    $connect() {
        const _super = Object.create(null, {
            $connect: { get: () => super.$connect }
        });
        return __awaiter(this, void 0, void 0, function* () {
            yield _super.$connect.call(this);
            console.log('✅ Database connected with performance monitoring');
        });
    }
    $disconnect() {
        const _super = Object.create(null, {
            $disconnect: { get: () => super.$disconnect }
        });
        return __awaiter(this, void 0, void 0, function* () {
            yield _super.$disconnect.call(this);
            console.log('🔌 Database disconnected');
        });
    }
}
// Create singleton instance
const prisma = new PerformancePrismaClient();
exports.prisma = prisma;
// Graceful shutdown
process.on('beforeExit', () => __awaiter(void 0, void 0, void 0, function* () {
    yield prisma.$disconnect();
}));
// Export performance monitoring utilities
const getDatabasePerformance = () => prisma.getPerformanceMetrics();
exports.getDatabasePerformance = getDatabasePerformance;
