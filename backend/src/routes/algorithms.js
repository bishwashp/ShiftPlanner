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
const express_1 = require("express");
const prisma_1 = require("../lib/prisma");
const AlgorithmRegistry_1 = require("../services/scheduling/AlgorithmRegistry");
const router = (0, express_1.Router)();
// Get all algorithms
router.get('/', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const algorithms = yield prisma_1.prisma.algorithmConfig.findMany({
            orderBy: { name: 'asc' }
        });
        res.json(algorithms);
    }
    catch (error) {
        console.error('Error fetching algorithms:', error);
        res.status(500).json({ error: 'Failed to fetch algorithms' });
    }
}));
// Get algorithm by ID
router.get('/:id', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { id } = req.params;
        const algorithm = yield prisma_1.prisma.algorithmConfig.findUnique({
            where: { id }
        });
        if (!algorithm) {
            return res.status(404).json({ error: 'Algorithm not found' });
        }
        res.json(algorithm);
    }
    catch (error) {
        console.error('Error fetching algorithm:', error);
        res.status(500).json({ error: 'Failed to fetch algorithm' });
    }
}));
// Create new algorithm
router.post('/', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { name, description, config } = req.body;
        if (!name || !config) {
            return res.status(400).json({ error: 'Name and config are required' });
        }
        const algorithm = yield prisma_1.prisma.algorithmConfig.create({
            data: { name, description, config: config }
        });
        res.status(201).json(algorithm);
    }
    catch (error) {
        console.error('Error creating algorithm:', error);
        if (error.code === 'P2002') {
            return res.status(400).json({ error: 'Algorithm name already exists' });
        }
        res.status(400).json({ error: 'Failed to create algorithm' });
    }
}));
// Update algorithm
router.put('/:id', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { id } = req.params;
        const { name, description, config, isActive } = req.body;
        const algorithm = yield prisma_1.prisma.algorithmConfig.update({
            where: { id },
            data: { name, description, config: config, isActive }
        });
        res.json(algorithm);
    }
    catch (error) {
        console.error('Error updating algorithm:', error);
        if (error.code === 'P2025') {
            return res.status(404).json({ error: 'Algorithm not found' });
        }
        res.status(400).json({ error: 'Failed to update algorithm' });
    }
}));
// Delete algorithm
router.delete('/:id', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { id } = req.params;
        yield prisma_1.prisma.algorithmConfig.delete({ where: { id } });
        res.status(204).send();
    }
    catch (error) {
        console.error('Error deleting algorithm:', error);
        if (error.code === 'P2025') {
            return res.status(404).json({ error: 'Algorithm not found' });
        }
        res.status(400).json({ error: 'Failed to delete algorithm' });
    }
}));
// Activate algorithm
router.post('/:id/activate', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { id } = req.params;
        yield prisma_1.prisma.$transaction((tx) => __awaiter(void 0, void 0, void 0, function* () {
            yield tx.algorithmConfig.updateMany({
                where: { isActive: true },
                data: { isActive: false }
            });
            const algorithm = yield tx.algorithmConfig.update({
                where: { id },
                data: { isActive: true }
            });
            res.json(algorithm);
        }));
    }
    catch (error) {
        console.error('Error activating algorithm:', error);
        if (error.code === 'P2025') {
            return res.status(404).json({ error: 'Algorithm not found' });
        }
        res.status(400).json({ error: 'Failed to activate algorithm' });
    }
}));
// Get currently active algorithm
router.get('/active/current', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const algorithm = yield prisma_1.prisma.algorithmConfig.findFirst({
            where: { isActive: true }
        });
        if (!algorithm) {
            return res.status(404).json({ error: 'No active algorithm found' });
        }
        res.json(algorithm);
    }
    catch (error) {
        console.error('Error fetching active algorithm:', error);
        res.status(500).json({ error: 'Failed to fetch active algorithm' });
    }
}));
// Generate automated schedule preview
router.post('/generate-preview', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b, _c, _d, _e, _f;
    console.log('🚀 generate-preview route called');
    try {
        const { startDate, endDate, algorithmType = 'weekend-rotation' } = req.body;
        if (!startDate || !endDate) {
            return res.status(400).json({ error: 'Start date and end date are required' });
        }
        const algorithm = AlgorithmRegistry_1.AlgorithmRegistry.getAlgorithm(algorithmType);
        if (!algorithm) {
            return res.status(400).json({ error: `Algorithm '${algorithmType}' not found.` });
        }
        console.log('Retrieved algorithm:', {
            name: algorithm.name,
            description: algorithm.description,
            version: algorithm.version,
            supportedFeatures: algorithm.supportedFeatures
        });
        const start = new Date(startDate);
        const end = new Date(endDate);
        const analysts = yield prisma_1.prisma.analyst.findMany({
            where: { isActive: true },
            include: {
                vacations: { where: { isApproved: true, OR: [{ startDate: { lte: end }, endDate: { gte: start } }] } },
                constraints: { where: { isActive: true, OR: [{ startDate: { lte: end }, endDate: { gte: start } }] } }
            },
            orderBy: { name: 'asc' }
        });
        if (analysts.length === 0) {
            return res.status(400).json({ error: 'No active analysts found' });
        }
        const existingSchedules = yield prisma_1.prisma.schedule.findMany({
            where: { date: { gte: start, lte: end } },
            include: { analyst: true }
        });
        const globalConstraints = yield prisma_1.prisma.schedulingConstraint.findMany({
            where: { analystId: null, isActive: true, startDate: { lte: end }, endDate: { gte: start } }
        });
        const result = yield algorithm.generateSchedules({ startDate: start, endDate: end, analysts, existingSchedules, globalConstraints });
        console.log('Algorithm result structure:', {
            hasFairnessMetrics: !!result.fairnessMetrics,
            hasPerformanceMetrics: !!result.performanceMetrics,
            fairnessScore: (_a = result.fairnessMetrics) === null || _a === void 0 ? void 0 : _a.overallFairnessScore,
            executionTime: (_b = result.performanceMetrics) === null || _b === void 0 ? void 0 : _b.algorithmExecutionTime,
            resultKeys: Object.keys(result),
            resultType: typeof result,
            isArray: Array.isArray(result)
        });
        const preview = {
            startDate,
            endDate,
            algorithmType,
            proposedSchedules: result.proposedSchedules,
            conflicts: result.conflicts,
            overwrites: result.overwrites,
            fairnessMetrics: result.fairnessMetrics,
            performanceMetrics: result.performanceMetrics,
            summary: {
                totalDays: Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1,
                totalSchedules: result.proposedSchedules.length,
                newSchedules: result.proposedSchedules.filter(s => s.type === 'NEW_SCHEDULE').length,
                overwrittenSchedules: result.overwrites.length,
                conflicts: result.conflicts.length,
                fairnessScore: ((_c = result.fairnessMetrics) === null || _c === void 0 ? void 0 : _c.overallFairnessScore) || 0,
                executionTime: ((_d = result.performanceMetrics) === null || _d === void 0 ? void 0 : _d.algorithmExecutionTime) || 0
            }
        };
        console.log('Algorithm result structure:', {
            hasFairnessMetrics: !!result.fairnessMetrics,
            hasPerformanceMetrics: !!result.performanceMetrics,
            fairnessScore: (_e = result.fairnessMetrics) === null || _e === void 0 ? void 0 : _e.overallFairnessScore,
            executionTime: (_f = result.performanceMetrics) === null || _f === void 0 ? void 0 : _f.algorithmExecutionTime
        });
        res.json(preview);
    }
    catch (error) {
        console.error('Error generating schedule preview:', error);
        res.status(500).json({ error: 'Failed to generate schedule preview' });
    }
}));
// Apply automated schedule
router.post('/apply-schedule', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { startDate, endDate, algorithmType = 'weekend-rotation', overwriteExisting = false } = req.body;
        if (!startDate || !endDate) {
            return res.status(400).json({ error: 'Start date and end date are required' });
        }
        const algorithm = AlgorithmRegistry_1.AlgorithmRegistry.getAlgorithm(algorithmType);
        if (!algorithm) {
            return res.status(400).json({ error: `Algorithm '${algorithmType}' not found.` });
        }
        const start = new Date(startDate);
        const end = new Date(endDate);
        const analysts = yield prisma_1.prisma.analyst.findMany({
            where: { isActive: true },
            include: {
                vacations: { where: { isApproved: true, OR: [{ startDate: { lte: end }, endDate: { gte: start } }] } },
                constraints: { where: { isActive: true, OR: [{ startDate: { lte: end }, endDate: { gte: start } }] } }
            },
            orderBy: { name: 'asc' }
        });
        if (analysts.length === 0) {
            return res.status(400).json({ error: 'No active analysts found' });
        }
        const existingSchedules = yield prisma_1.prisma.schedule.findMany({
            where: { date: { gte: start, lte: end } },
            include: { analyst: true }
        });
        const globalConstraints = yield prisma_1.prisma.schedulingConstraint.findMany({
            where: { analystId: null, isActive: true, startDate: { lte: end }, endDate: { gte: start } }
        });
        const { proposedSchedules, conflicts } = yield algorithm.generateSchedules({ startDate: start, endDate: end, analysts, existingSchedules, globalConstraints });
        const result = {
            message: '',
            createdSchedules: [],
            updatedSchedules: [],
            deletedSchedules: [],
            conflicts: conflicts
        };
        for (const schedule of proposedSchedules) {
            try {
                const existing = existingSchedules.find((s) => s.analystId === schedule.analystId && new Date(s.date).toISOString().split('T')[0] === schedule.date);
                if (existing) {
                    if (overwriteExisting && (existing.shiftType !== schedule.shiftType || existing.isScreener !== schedule.isScreener)) {
                        const updated = yield prisma_1.prisma.schedule.update({
                            where: { id: existing.id },
                            data: { shiftType: schedule.shiftType, isScreener: schedule.isScreener },
                            include: { analyst: true }
                        });
                        result.updatedSchedules.push(updated);
                    }
                }
                else {
                    const created = yield prisma_1.prisma.schedule.create({
                        data: {
                            analystId: schedule.analystId,
                            date: new Date(schedule.date),
                            shiftType: schedule.shiftType,
                            isScreener: schedule.isScreener
                        },
                        include: { analyst: true }
                    });
                    result.createdSchedules.push(created);
                }
            }
            catch (error) {
                result.conflicts.push({
                    date: schedule.date,
                    type: 'CONSTRAINT_VIOLATION',
                    description: error.message,
                    severity: 'HIGH'
                });
            }
        }
        result.message = `Successfully processed ${result.createdSchedules.length} new schedules and ${result.updatedSchedules.length} updated schedules`;
        res.json(result);
    }
    catch (error) {
        console.error('Error applying schedule:', error);
        res.status(500).json({ error: 'Failed to apply schedule' });
    }
}));
exports.default = router;
