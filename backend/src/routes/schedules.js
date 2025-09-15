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
        // Get screener assignments for each date
        const screenerAssignments = new Map();
        schedules.forEach(schedule => {
            const dateStr = schedule.date.toISOString().split('T')[0];
            if (schedule.isScreener) {
                if (!screenerAssignments.has(dateStr)) {
                    screenerAssignments.set(dateStr, { morning: 0, evening: 0 });
                }
                const assignments = screenerAssignments.get(dateStr);
                if (schedule.shiftType === 'MORNING') {
                    assignments.morning++;
                }
                else if (schedule.shiftType === 'EVENING') {
                    assignments.evening++;
                }
            }
        });
        allDates.forEach(dateStr => {
            const shifts = scheduledDates.get(dateStr);
            const screeners = screenerAssignments.get(dateStr) || { morning: 0, evening: 0 };
            let missingShifts = [];
            let screenerIssues = [];
            // Check for missing shifts
            if (!shifts || !shifts.morning) {
                missingShifts.push('Morning');
            }
            if (!shifts || !shifts.evening) {
                missingShifts.push('Evening');
            }
            // Check for screener requirements
            if (shifts && shifts.morning && screeners.morning === 0) {
                screenerIssues.push('Morning screener missing');
            }
            if (shifts && shifts.evening && screeners.evening === 0) {
                screenerIssues.push('Evening screener missing');
            }
            if (screeners.morning > 1) {
                screenerIssues.push(`Multiple morning screeners (${screeners.morning})`);
            }
            if (screeners.evening > 1) {
                screenerIssues.push(`Multiple evening screeners (${screeners.evening})`);
            }
            // Add missing shift conflicts
            if (missingShifts.length > 0) {
                conflicts.push({
                    date: dateStr,
                    message: `Missing ${missingShifts.join(' and ')} shift(s) on ${(0, moment_1.default)(dateStr).format('MMM D')}`,
                    type: 'NO_ANALYST_ASSIGNED',
                    missingShifts,
                    severity: 'critical'
                });
            }
            // Add screener conflicts
            if (screenerIssues.length > 0) {
                conflicts.push({
                    date: dateStr,
                    message: `${screenerIssues.join(', ')} on ${(0, moment_1.default)(dateStr).format('MMM D')}`,
                    type: 'SCREENER_CONFLICT',
                    missingShifts: screenerIssues,
                    severity: screenerIssues.some(issue => issue.includes('missing')) ? 'critical' : 'recommended'
                });
            }
        });
        // Categorize conflicts by severity
        const criticalConflicts = conflicts.filter(c => c.severity === 'critical');
        const recommendedConflicts = conflicts.filter(c => c.severity === 'recommended');
        const responseData = {
            critical: criticalConflicts,
            recommended: recommendedConflicts,
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
    var _a;
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
        console.log(`🔍 Auto-fix: Found ${conflictList.length} conflicts to resolve`);
        console.log('📋 Conflicts:', conflictList);
        const scheduler = new IntelligentScheduler_1.IntelligentScheduler(prisma_1.prisma);
        const resolution = yield scheduler.resolveConflicts(conflictList, startDate, endDate);
        console.log(`✅ Auto-fix: Generated ${((_a = resolution.suggestedAssignments) === null || _a === void 0 ? void 0 : _a.length) || 0} proposals`);
        console.log('📊 Resolution summary:', resolution.summary);
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
// Generate schedule for a date range - MVP endpoint
router.post('/generate', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { startDate, endDate, algorithm = 'WeekendRotationAlgorithm' } = req.body;
        if (!startDate || !endDate) {
            return res.status(400).json({ error: 'startDate and endDate are required' });
        }
        const start = new Date(startDate);
        const end = new Date(endDate);
        if (start >= end) {
            return res.status(400).json({ error: 'startDate must be before endDate' });
        }
        // Get all active analysts
        const analysts = yield prisma_1.prisma.analyst.findMany({
            where: { isActive: true },
            include: {
                schedules: {
                    where: {
                        date: {
                            gte: start,
                            lte: end
                        }
                    }
                }
            }
        });
        if (analysts.length === 0) {
            return res.status(400).json({ error: 'No active analysts found. Please add analysts first.' });
        }
        // Check if we have analysts for both shifts
        const morningAnalysts = analysts.filter(a => a.shiftType === 'MORNING');
        const eveningAnalysts = analysts.filter(a => a.shiftType === 'EVENING');
        if (morningAnalysts.length === 0) {
            return res.status(400).json({ error: 'No morning shift analysts found. Please add morning shift analysts first.' });
        }
        if (eveningAnalysts.length === 0) {
            return res.status(400).json({ error: 'No evening shift analysts found. Please add evening shift analysts first.' });
        }
        // Get existing schedules for the date range
        const existingSchedules = yield prisma_1.prisma.schedule.findMany({
            where: {
                date: {
                    gte: start,
                    lte: end
                }
            },
            include: { analyst: true }
        });
        // Use IntelligentScheduler for basic schedule generation
        const scheduler = new IntelligentScheduler_1.IntelligentScheduler(prisma_1.prisma);
        // Generate all dates in range and identify missing shifts
        const allDates = [];
        const currentDate = new Date(start);
        while (currentDate <= end) {
            allDates.push(currentDate.toISOString().split('T')[0]);
            currentDate.setDate(currentDate.getDate() + 1);
        }
        // Find conflicts (missing shifts)
        const conflicts = [];
        for (const dateStr of allDates) {
            const daySchedules = existingSchedules.filter(s => s.date.toISOString().split('T')[0] === dateStr);
            const hasMorning = daySchedules.some(s => s.shiftType === 'MORNING');
            const hasEvening = daySchedules.some(s => s.shiftType === 'EVENING');
            const missingShifts = [];
            if (!hasMorning)
                missingShifts.push('MORNING');
            if (!hasEvening)
                missingShifts.push('EVENING');
            if (missingShifts.length > 0) {
                conflicts.push({
                    date: dateStr,
                    missingShifts,
                    severity: 'critical'
                });
            }
        }
        if (conflicts.length === 0) {
            return res.json({
                message: 'Schedule is already complete for the specified date range',
                existingSchedules: existingSchedules.length,
                dateRange: { startDate: startDate, endDate: endDate },
                schedules: existingSchedules
            });
        }
        console.log(`🚀 Generating schedule for ${conflicts.length} missing shifts`);
        // Use IntelligentScheduler to resolve conflicts
        const resolution = yield scheduler.resolveConflicts(conflicts, startDate, endDate);
        res.json({
            message: `Schedule generation completed. Found ${resolution.summary.assignmentsNeeded} assignments for ${conflicts.length} conflicts.`,
            summary: resolution.summary,
            suggestedAssignments: resolution.suggestedAssignments,
            dateRange: { startDate: startDate, endDate: endDate },
            algorithm: algorithm,
            existingSchedules: existingSchedules.length,
            newAssignments: resolution.summary.assignmentsNeeded
        });
    }
    catch (error) {
        console.error('Error generating schedule:', error);
        res.status(500).json({ error: 'Failed to generate schedule' });
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
