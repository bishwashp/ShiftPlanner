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
const prisma_1 = require("../lib/prisma");
const moment_1 = __importDefault(require("moment"));
const IntelligentScheduler_1 = require("../services/IntelligentScheduler");
const router = (0, express_1.Router)();
// Get all schedules with optional filters
router.get('/', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { startDate, endDate, analystId } = req.query;
        const where = {};
        if (startDate && endDate) {
            where.date = {
                gte: new Date(startDate),
                lte: new Date(endDate)
            };
        }
        if (analystId) {
            where.analystId = analystId;
        }
        const schedules = yield prisma_1.prisma.schedule.findMany({
            where,
            include: {
                analyst: true
            },
            orderBy: { date: 'asc' }
        });
        res.json(schedules);
    }
    catch (error) {
        console.error('Error fetching schedules:', error);
        res.status(500).json({ error: 'Failed to fetch schedules' });
    }
}));
// Get schedule by ID
router.get('/:id', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { id } = req.params;
        const schedule = yield prisma_1.prisma.schedule.findUnique({
            where: { id },
            include: { analyst: true }
        });
        if (!schedule) {
            return res.status(404).json({ error: 'Schedule not found' });
        }
        res.json(schedule);
    }
    catch (error) {
        console.error('Error fetching schedule:', error);
        res.status(500).json({ error: 'Failed to fetch schedule' });
    }
}));
// Create new schedule
router.post('/', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { analystId, date, shiftType, isScreener = false } = req.body;
        if (!analystId || !date || !shiftType) {
            return res.status(400).json({ error: 'analystId, date, and shiftType are required' });
        }
        // Verify analyst exists and check if shiftType matches their assigned shift
        const analyst = yield prisma_1.prisma.analyst.findUnique({
            where: { id: analystId }
        });
        if (!analyst) {
            return res.status(404).json({ error: 'Analyst not found' });
        }
        if (analyst.shiftType !== shiftType) {
            return res.status(400).json({
                error: `Analyst is assigned to ${analyst.shiftType} shift but schedule is for ${shiftType} shift`
            });
        }
        // Check if analyst already has a schedule for this date
        const existingSchedule = yield prisma_1.prisma.schedule.findUnique({
            where: { analystId_date: { analystId, date: new Date(date) } }
        });
        if (existingSchedule) {
            return res.status(400).json({ error: 'Analyst already has a schedule for this date' });
        }
        // If this is a screener assignment, check if there's already a screener for this shift/date
        if (isScreener) {
            const existingScreener = yield prisma_1.prisma.schedule.findFirst({
                where: {
                    date: new Date(date),
                    shiftType,
                    isScreener: true
                }
            });
            if (existingScreener) {
                return res.status(400).json({
                    error: `There is already a screener assigned for ${shiftType} shift on ${new Date(date).toDateString()}`
                });
            }
        }
        const schedule = yield prisma_1.prisma.schedule.create({
            data: {
                analystId,
                date: new Date(date),
                shiftType,
                isScreener
            },
            include: { analyst: true }
        });
        res.status(201).json(schedule);
    }
    catch (error) {
        console.error('Error creating schedule:', error);
        if (error.code === 'P2002') {
            return res.status(400).json({ error: 'Schedule already exists for this analyst and date' });
        }
        res.status(400).json({ error: 'Failed to create schedule' });
    }
}));
// Update schedule
router.put('/:id', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { id } = req.params;
        const { analystId, date, shiftType, isScreener } = req.body;
        // Get current schedule to check for conflicts
        const currentSchedule = yield prisma_1.prisma.schedule.findUnique({
            where: { id },
            include: { analyst: true }
        });
        if (!currentSchedule) {
            return res.status(404).json({ error: 'Schedule not found' });
        }
        // If changing analyst, verify the new analyst exists and shiftType matches
        if (analystId && analystId !== currentSchedule.analystId) {
            const analyst = yield prisma_1.prisma.analyst.findUnique({
                where: { id: analystId }
            });
            if (!analyst) {
                return res.status(404).json({ error: 'Analyst not found' });
            }
            if (analyst.shiftType !== shiftType) {
                return res.status(400).json({
                    error: `Analyst is assigned to ${analyst.shiftType} shift but schedule is for ${shiftType} shift`
                });
            }
            // Check if new analyst already has a schedule for this date
            const existingSchedule = yield prisma_1.prisma.schedule.findUnique({
                where: { analystId_date: { analystId, date: new Date(date || currentSchedule.date) } }
            });
            if (existingSchedule) {
                return res.status(400).json({ error: 'Analyst already has a schedule for this date' });
            }
        }
        // If making this a screener assignment, check for conflicts
        if (isScreener && !currentSchedule.isScreener) {
            const existingScreener = yield prisma_1.prisma.schedule.findFirst({
                where: {
                    date: new Date(date || currentSchedule.date),
                    shiftType: shiftType || currentSchedule.shiftType,
                    isScreener: true,
                    id: { not: id } // Exclude current schedule
                }
            });
            if (existingScreener) {
                return res.status(400).json({
                    error: `There is already a screener assigned for this shift and date`
                });
            }
        }
        const schedule = yield prisma_1.prisma.schedule.update({
            where: { id },
            data: {
                analystId,
                date: date ? new Date(date) : undefined,
                shiftType,
                isScreener
            },
            include: { analyst: true }
        });
        res.json(schedule);
    }
    catch (error) {
        console.error('Error updating schedule:', error);
        if (error.code === 'P2025') {
            return res.status(404).json({ error: 'Schedule not found' });
        }
        if (error.code === 'P2002') {
            return res.status(400).json({ error: 'Schedule already exists for this analyst and date' });
        }
        res.status(400).json({ error: 'Failed to update schedule' });
    }
}));
// Delete schedule
router.delete('/:id', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { id } = req.params;
        yield prisma_1.prisma.schedule.delete({ where: { id } });
        res.status(204).send();
    }
    catch (error) {
        console.error('Error deleting schedule:', error);
        if (error.code === 'P2025') {
            return res.status(404).json({ error: 'Schedule not found' });
        }
        res.status(400).json({ error: 'Failed to delete schedule' });
    }
}));
// Create bulk schedules
router.post('/bulk', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { schedules } = req.body;
        if (!Array.isArray(schedules) || schedules.length === 0) {
            return res.status(400).json({ error: 'schedules array is required and must not be empty' });
        }
        const createdSchedules = [];
        const errors = [];
        for (const scheduleData of schedules) {
            try {
                const { analystId, date, shiftType, isScreener = false } = scheduleData;
                if (!analystId || !date || !shiftType) {
                    errors.push({ schedule: scheduleData, error: 'analystId, date, and shiftType are required' });
                    continue;
                }
                // Verify analyst exists and check shiftType
                const analyst = yield prisma_1.prisma.analyst.findUnique({
                    where: { id: analystId }
                });
                if (!analyst) {
                    errors.push({ schedule: scheduleData, error: 'Analyst not found' });
                    continue;
                }
                if (analyst.shiftType !== shiftType) {
                    errors.push({
                        schedule: scheduleData,
                        error: `Analyst is assigned to ${analyst.shiftType} shift but schedule is for ${shiftType} shift`
                    });
                    continue;
                }
                // Check for existing schedule
                const existingSchedule = yield prisma_1.prisma.schedule.findUnique({
                    where: { analystId_date: { analystId, date: new Date(date) } }
                });
                if (existingSchedule) {
                    errors.push({ schedule: scheduleData, error: 'Analyst already has a schedule for this date' });
                    continue;
                }
                // Check for screener conflicts
                if (isScreener) {
                    const existingScreener = yield prisma_1.prisma.schedule.findFirst({
                        where: {
                            date: new Date(date),
                            shiftType,
                            isScreener: true
                        }
                    });
                    if (existingScreener) {
                        errors.push({
                            schedule: scheduleData,
                            error: `There is already a screener assigned for ${shiftType} shift on ${new Date(date).toDateString()}`
                        });
                        continue;
                    }
                }
                const schedule = yield prisma_1.prisma.schedule.create({
                    data: {
                        analystId,
                        date: new Date(date),
                        shiftType,
                        isScreener
                    },
                    include: { analyst: true }
                });
                createdSchedules.push(schedule);
            }
            catch (error) {
                errors.push({ schedule: scheduleData, error: error.message });
            }
        }
        res.status(201).json({
            message: `Created ${createdSchedules.length} schedules${errors.length > 0 ? `, ${errors.length} failed` : ''}`,
            count: createdSchedules.length,
            schedules: createdSchedules,
            errors: errors.length > 0 ? errors : undefined
        });
    }
    catch (error) {
        console.error('Error creating bulk schedules:', error);
        res.status(500).json({ error: 'Failed to create bulk schedules' });
    }
}));
// Get schedule health and conflicts
router.get('/health/conflicts', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { startDate, endDate } = req.query;
        let start, end;
        if (typeof startDate === 'string' && typeof endDate === 'string') {
            start = new Date(startDate);
            end = new Date(endDate);
        }
        else {
            start = new Date();
            end = new Date();
            end.setDate(end.getDate() + 30);
        }
        const allDates = new Set();
        const currentDate = new Date(start);
        while (currentDate <= end) {
            allDates.add(currentDate.toISOString().split('T')[0]);
            currentDate.setDate(currentDate.getDate() + 1);
        }
        const schedules = yield prisma_1.prisma.schedule.findMany({
            where: {
                date: {
                    gte: start,
                    lte: end,
                },
            },
        });
        const scheduledDates = new Map();
        for (const schedule of schedules) {
            const dateStr = schedule.date.toISOString().split('T')[0];
            if (!scheduledDates.has(dateStr)) {
                scheduledDates.set(dateStr, { morning: false, evening: false });
            }
            const shifts = scheduledDates.get(dateStr);
            if (schedule.shiftType === 'MORNING') {
                shifts.morning = true;
            }
            if (schedule.shiftType === 'EVENING') {
                shifts.evening = true;
            }
        }
        const conflicts = [];
        allDates.forEach(dateStr => {
            const shifts = scheduledDates.get(dateStr);
            let missingShifts = [];
            if (!shifts || !shifts.morning) {
                missingShifts.push('Morning');
            }
            if (!shifts || !shifts.evening) {
                missingShifts.push('Evening');
            }
            if (missingShifts.length > 0) {
                conflicts.push({
                    date: dateStr,
                    message: `Missing ${missingShifts.join(' and ')} shift(s) on ${(0, moment_1.default)(dateStr).format('MMM D')}`,
                    type: 'NO_ANALYST_ASSIGNED',
                    missingShifts,
                    severity: 'critical'
                });
            }
        });
        const responseData = {
            critical: conflicts,
            recommended: [],
        };
        res.json(responseData);
    }
    catch (error) {
        console.error('Error checking schedule health:', error);
        res.status(500).json({ error: 'Failed to check schedule health' });
    }
}));
// Auto-fix conflicts endpoint
router.post('/auto-fix-conflicts', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { startDate, endDate } = req.body;
        if (!startDate || !endDate) {
            return res.status(400).json({ error: 'startDate and endDate are required' });
        }
        // Generate all dates in range
        const allDates = new Set();
        const currentDate = new Date(startDate);
        while (currentDate <= new Date(endDate)) {
            allDates.add(currentDate.toISOString().split('T')[0]);
            currentDate.setDate(currentDate.getDate() + 1);
        }
        // Get existing schedules for the date range
        const schedules = yield prisma_1.prisma.schedule.findMany({
            where: {
                date: {
                    gte: new Date(startDate),
                    lte: new Date(endDate),
                },
            },
        });
        // Group by date to identify missing shifts
        const scheduledDates = new Map();
        for (const schedule of schedules) {
            const dateStr = schedule.date.toISOString().split('T')[0];
            if (!scheduledDates.has(dateStr)) {
                scheduledDates.set(dateStr, { morning: false, evening: false });
            }
            const shifts = scheduledDates.get(dateStr);
            if (schedule.shiftType === 'MORNING') {
                shifts.morning = true;
            }
            if (schedule.shiftType === 'EVENING') {
                shifts.evening = true;
            }
        }
        // Identify conflicts
        const conflictList = [];
        allDates.forEach(dateStr => {
            const shifts = scheduledDates.get(dateStr);
            let missingShifts = [];
            if (!shifts || !shifts.morning) {
                missingShifts.push('Morning');
            }
            if (!shifts || !shifts.evening) {
                missingShifts.push('Evening');
            }
            if (missingShifts.length > 0) {
                conflictList.push({
                    date: dateStr,
                    missingShifts,
                    severity: 'critical'
                });
            }
        });
        // Use IntelligentScheduler to resolve conflicts
        const scheduler = new IntelligentScheduler_1.IntelligentScheduler(prisma_1.prisma);
        const resolution = yield scheduler.resolveConflicts(conflictList, startDate, endDate);
        res.json(resolution);
    }
    catch (error) {
        console.error('Error auto-fixing conflicts:', error);
        res.status(500).json({ error: 'Failed to auto-fix conflicts' });
    }
}));
// Apply auto-fix assignments endpoint
router.post('/apply-auto-fix', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { assignments } = req.body;
        if (!Array.isArray(assignments)) {
            return res.status(400).json({ error: 'assignments array is required' });
        }
        const createdSchedules = [];
        const errors = [];
        for (const assignment of assignments) {
            try {
                const { date, shiftType, analystId, isScreener = false } = assignment;
                // Check if analyst already has a schedule for this date
                const existingSchedule = yield prisma_1.prisma.schedule.findUnique({
                    where: { analystId_date: { analystId, date: new Date(date) } }
                });
                if (existingSchedule) {
                    errors.push({ assignment, error: 'Analyst already has a schedule for this date' });
                    continue;
                }
                // If this is a screener assignment, check for conflicts
                if (isScreener) {
                    const existingScreener = yield prisma_1.prisma.schedule.findFirst({
                        where: {
                            date: new Date(date),
                            shiftType,
                            isScreener: true
                        }
                    });
                    if (existingScreener) {
                        errors.push({
                            assignment,
                            error: `There is already a screener assigned for ${shiftType} shift on ${new Date(date).toDateString()}`
                        });
                        continue;
                    }
                }
                const schedule = yield prisma_1.prisma.schedule.create({
                    data: {
                        analystId,
                        date: new Date(date),
                        shiftType,
                        isScreener
                    },
                    include: { analyst: true }
                });
                createdSchedules.push(schedule);
            }
            catch (error) {
                errors.push({ assignment, error: error.message });
            }
        }
        res.json({
            message: `Applied ${createdSchedules.length} assignments${errors.length > 0 ? `, ${errors.length} failed` : ''}`,
            createdSchedules,
            errors: errors.length > 0 ? errors : undefined
        });
    }
    catch (error) {
        console.error('Error applying auto-fix assignments:', error);
        res.status(500).json({ error: 'Failed to apply auto-fix assignments' });
    }
}));
// Test endpoint for debugging IntelligentScheduler
router.get('/test-scheduler', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { date, shiftType } = req.query;
        if (!date || !shiftType) {
            return res.status(400).json({ error: 'date and shiftType are required' });
        }
        // Get all analysts
        const analysts = yield prisma_1.prisma.analyst.findMany({
            where: { isActive: true },
            include: {
                schedules: {
                    where: {
                        date: new Date(date)
                    }
                }
            }
        });
        // Test availability logic
        const availableAnalysts = analysts.filter((analyst) => {
            // Check if analyst is assigned to this shift type
            if (analyst.shiftType !== shiftType) {
                return false;
            }
            // Check if analyst is already scheduled for this date
            const hasSchedule = analyst.schedules.some((schedule) => schedule.date.toISOString().split('T')[0] === date);
            return !hasSchedule;
        });
        res.json({
            date,
            shiftType,
            totalAnalysts: analysts.length,
            availableAnalysts: availableAnalysts.length,
            availableAnalystNames: availableAnalysts.map((a) => a.name),
            analystDetails: analysts.map((a) => ({
                name: a.name,
                shiftType: a.shiftType,
                schedules: a.schedules.length,
                scheduleDates: a.schedules.map((s) => s.date.toISOString().split('T')[0])
            }))
        });
    }
    catch (error) {
        console.error('Error in test endpoint:', error);
        res.status(500).json({ error: 'Failed to test scheduler' });
    }
}));
exports.default = router;
