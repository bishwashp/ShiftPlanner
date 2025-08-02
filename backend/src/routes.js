"use strict";
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
const router = (0, express_1.Router)();
// Health check endpoint
router.get('/health', (req, res) => {
    res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        version: '1.0.0'
    });
});
// API versioning
router.get('/', (req, res) => {
    res.json({
        message: 'ShiftPlanner API v1.0.0',
        endpoints: {
            health: '/health',
            analysts: '/analysts',
            schedules: '/schedules',
            algorithms: '/algorithms',
            constraints: '/constraints',
            analytics: '/analytics',
            calendar: '/calendar'
        }
    });
});
// Feature routes
router.use('/analysts', analysts_1.default);
router.use('/schedules', schedules_1.default);
router.use('/algorithms', algorithms_1.default);
router.use('/constraints', constraints_1.default);
router.use('/analytics', analytics_1.default);
router.use('/calendar', calendar_1.default);
exports.default = router;
