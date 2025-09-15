"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const analysts_1 = __importDefault(require("./analysts"));
const schedules_1 = __importDefault(require("./schedules"));
const router = (0, express_1.Router)();
// Register all route modules
router.use('/analysts', analysts_1.default);
router.use('/schedules', schedules_1.default);
// API info endpoint
router.get('/', (req, res) => {
    res.json({
        message: 'ShiftPlanner API v1.0.0',
        endpoints: {
            analysts: {
                description: 'Employee management operations',
                routes: {
                    'GET /api/analysts': 'Get all analysts',
                    'POST /api/analysts': 'Create new analyst',
                    'GET /api/analysts/:id': 'Get analyst by ID',
                    'PUT /api/analysts/:id': 'Update analyst',
                    'DELETE /api/analysts/:id': 'Delete analyst'
                }
            },
            schedules: {
                description: 'Schedule management and generation',
                routes: {
                    'GET /api/schedules': 'Get all schedules',
                    'POST /api/schedules': 'Create new schedule',
                    'POST /api/schedules/generate': 'Generate schedule for date range (MVP)',
                    'POST /api/schedules/bulk': 'Create multiple schedules',
                    'GET /api/schedules/health/conflicts': 'Check schedule conflicts',
                    'POST /api/schedules/auto-fix-conflicts': 'Auto-fix schedule conflicts',
                    'POST /api/schedules/apply-auto-fix': 'Apply auto-fix assignments',
                    'GET /api/schedules/test-scheduler': 'Test scheduler availability'
                }
            }
        },
        features: [
            'Employee Management (CRUD)',
            'Schedule Generation (MVP)',
            'Conflict Detection',
            'Auto-fix Scheduling',
            'SQLite Database',
            'In-memory Cache Fallback'
        ]
    });
});
exports.default = router;
