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
const cache_1 = require("../lib/cache");
const router = (0, express_1.Router)();
// Get all analysts with caching
router.get('/', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { active, shiftType } = req.query;
        // Create cache key based on filters
        const filters = `active:${active || 'all'}_shift:${shiftType || 'all'}`;
        // Try to get from cache first
        const cachedAnalysts = yield cache_1.cacheService.getAnalysts(filters);
        if (cachedAnalysts) {
            return res.json(cachedAnalysts);
        }
        // Build query conditions
        const where = {};
        if (active !== undefined) {
            where.isActive = active === 'true';
        }
        if (shiftType) {
            where.shiftType = shiftType;
        }
        // Optimized query with selective includes
        const analysts = yield prisma_1.prisma.analyst.findMany({
            where,
            include: {
                preferences: {
                    select: {
                        shiftType: true,
                        dayOfWeek: true,
                        preference: true
                    }
                },
                schedules: {
                    where: {
                        date: {
                            gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Last 30 days
                            lte: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // Next 30 days
                        }
                    },
                    orderBy: { date: 'desc' },
                    take: 10,
                    select: {
                        id: true,
                        date: true,
                        shiftType: true,
                        isScreener: true
                    }
                }
            },
            orderBy: { name: 'asc' }
        });
        // Cache the result
        yield cache_1.cacheService.setAnalysts(filters, analysts);
        res.json(analysts);
    }
    catch (error) {
        console.error('Error fetching analysts:', error);
        res.status(500).json({ error: 'Failed to fetch analysts' });
    }
}));
// Get analyst by ID with caching
router.get('/:id', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { id } = req.params;
        // Try to get from cache first
        const cachedAnalyst = yield cache_1.cacheService.getAnalyst(id);
        if (cachedAnalyst) {
            return res.json(cachedAnalyst);
        }
        const analyst = yield prisma_1.prisma.analyst.findUnique({
            where: { id },
            include: {
                preferences: {
                    select: {
                        id: true,
                        shiftType: true,
                        dayOfWeek: true,
                        preference: true
                    }
                },
                schedules: {
                    where: {
                        date: {
                            gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Last 30 days
                            lte: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // Next 30 days
                        }
                    },
                    orderBy: { date: 'desc' },
                    take: 50,
                    select: {
                        id: true,
                        date: true,
                        shiftType: true,
                        isScreener: true
                    }
                },
                vacations: {
                    where: {
                        endDate: {
                            gte: new Date()
                        }
                    },
                    orderBy: { startDate: 'asc' },
                    select: {
                        id: true,
                        startDate: true,
                        endDate: true,
                        reason: true,
                        isApproved: true
                    }
                }
            }
        });
        if (!analyst) {
            return res.status(404).json({ error: 'Analyst not found' });
        }
        // Cache the result
        yield cache_1.cacheService.setAnalyst(id, analyst);
        res.json(analyst);
    }
    catch (error) {
        console.error('Error fetching analyst:', error);
        res.status(500).json({ error: 'Failed to fetch analyst' });
    }
}));
// Create new analyst with cache invalidation
router.post('/', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { name, email, shiftType, customAttributes, skills } = req.body;
        // Validate required fields
        if (!name || !email || !shiftType) {
            return res.status(400).json({ error: 'Name, email, and shiftType are required' });
        }
        const analyst = yield prisma_1.prisma.analyst.create({
            data: {
                name,
                email,
                shiftType,
                customAttributes: customAttributes || {},
                skills: skills || []
            },
            include: {
                preferences: true
            }
        });
        // Invalidate relevant caches
        yield cache_1.cacheService.invalidateAnalystCache();
        yield cache_1.cacheService.invalidatePattern('analysts:*');
        res.status(201).json(analyst);
    }
    catch (error) {
        console.error('Error creating analyst:', error);
        if (error.code === 'P2002') {
            res.status(400).json({ error: 'Analyst with this email already exists' });
        }
        else {
            res.status(500).json({ error: 'Failed to create analyst' });
        }
    }
}));
// Update analyst with cache invalidation
router.put('/:id', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { id } = req.params;
        const { name, email, shiftType, isActive, customAttributes, skills } = req.body;
        const analyst = yield prisma_1.prisma.analyst.update({
            where: { id },
            data: Object.assign(Object.assign(Object.assign(Object.assign(Object.assign(Object.assign({}, (name && { name })), (email && { email })), (shiftType && { shiftType })), (typeof isActive === 'boolean' && { isActive })), (customAttributes && { customAttributes })), (skills && { skills })),
            include: {
                preferences: true
            }
        });
        // Invalidate specific analyst cache and general caches
        yield cache_1.cacheService.invalidateAnalystCache(id);
        yield cache_1.cacheService.invalidatePattern('analysts:*');
        res.json(analyst);
    }
    catch (error) {
        console.error('Error updating analyst:', error);
        if (error.code === 'P2025') {
            res.status(404).json({ error: 'Analyst not found' });
        }
        else if (error.code === 'P2002') {
            res.status(400).json({ error: 'Analyst with this email already exists' });
        }
        else {
            res.status(500).json({ error: 'Failed to update analyst' });
        }
    }
}));
// Delete analyst with cache invalidation
router.delete('/:id', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { id } = req.params;
        yield prisma_1.prisma.analyst.delete({
            where: { id }
        });
        // Invalidate all analyst-related caches
        yield cache_1.cacheService.invalidateAnalystCache(id);
        yield cache_1.cacheService.invalidatePattern('analysts:*');
        yield cache_1.cacheService.invalidatePattern('schedules:*'); // Schedules will be affected
        res.status(204).send();
    }
    catch (error) {
        console.error('Error deleting analyst:', error);
        if (error.code === 'P2025') {
            res.status(404).json({ error: 'Analyst not found' });
        }
        else {
            res.status(500).json({ error: 'Failed to delete analyst' });
        }
    }
}));
exports.default = router;
