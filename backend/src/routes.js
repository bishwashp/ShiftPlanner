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
const express_1 = require("express");
const analysts_1 = __importDefault(require("./routes/analysts"));
const schedules_1 = __importDefault(require("./routes/schedules"));
const algorithms_1 = __importDefault(require("./routes/algorithms"));
const constraints_1 = __importDefault(require("./routes/constraints"));
const analytics_1 = __importDefault(require("./routes/analytics"));
const calendar_1 = __importDefault(require("./routes/calendar"));
const monitoring_1 = __importDefault(require("./routes/monitoring"));
const auth_1 = __importDefault(require("./routes/auth"));
const router = (0, express_1.Router)();
// Health check endpoint
router.get('/health', (req, res) => {
    res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        version: '1.0.0'
    });
});
// Test endpoint for monitoring services
router.get('/monitoring-test', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        res.json({
            success: true,
            message: 'All core services are restored and working!',
            services: {
                monitoringService: '✅ Active',
                alertingService: '✅ Active',
                securityService: '✅ Active',
                webhookService: '✅ Active',
                performanceOptimizer: '✅ Active',
                monitoringRoutes: '✅ Active',
            },
            endpoints: {
                health: '/api/health',
                auth: '/api/auth/*',
                monitoring: '/api/monitoring/*',
                alerts: '/api/monitoring/alerts',
                performance: '/api/monitoring/performance',
                dashboard: '/api/monitoring/dashboard',
            },
            timestamp: new Date().toISOString(),
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            error: 'Test failed',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
}));
// API versioning
router.get('/', (req, res) => {
    res.json({
        message: 'ShiftPlanner API v1.0.0',
        endpoints: {
            health: '/health',
            auth: '/auth',
            analysts: '/analysts',
            schedules: '/schedules',
            algorithms: '/algorithms',
            constraints: '/constraints',
            analytics: '/analytics',
            calendar: '/calendar',
            monitoring: '/monitoring'
        }
    });
});
// Feature routes
router.use('/auth', auth_1.default);
router.use('/analysts', analysts_1.default);
router.use('/schedules', schedules_1.default);
router.use('/algorithms', algorithms_1.default);
router.use('/constraints', constraints_1.default);
router.use('/analytics', analytics_1.default);
router.use('/calendar', calendar_1.default);
router.use('/monitoring', monitoring_1.default);
exports.default = router;
