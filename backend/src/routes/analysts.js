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
const app_1 = require("../app");
const router = (0, express_1.Router)();
// Get all analysts
router.get('/', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const analysts = yield app_1.prisma.analyst.findMany({
            include: {
                preferences: true,
                schedules: {
                    orderBy: { date: 'desc' },
                    take: 10
                }
            },
            orderBy: { name: 'asc' }
        });
        res.json(analysts);
    }
    catch (error) {
        console.error('Error fetching analysts:', error);
        res.status(500).json({ error: 'Failed to fetch analysts' });
    }
}));
// Get analyst by ID
router.get('/:id', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { id } = req.params;
        const analyst = yield app_1.prisma.analyst.findUnique({
            where: { id },
            include: {
                preferences: true,
                schedules: {
                    orderBy: { date: 'desc' },
                    take: 50
                }
            }
        });
        if (!analyst) {
            return res.status(404).json({ error: 'Analyst not found' });
        }
        res.json(analyst);
    }
    catch (error) {
        console.error('Error fetching analyst:', error);
        res.status(500).json({ error: 'Failed to fetch analyst' });
    }
}));
// Create new analyst
router.post('/', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { name, email, shiftType } = req.body;
        if (!name || !email || !shiftType) {
            return res.status(400).json({ error: 'Name, email, and shiftType are required' });
        }
        const analyst = yield app_1.prisma.analyst.create({
            data: {
                name,
                email,
                shiftType
            },
            include: { preferences: true }
        });
        res.status(201).json(analyst);
    }
    catch (error) {
        console.error('Error creating analyst:', error);
        if (error.code === 'P2002') {
            return res.status(400).json({ error: 'Email already exists' });
        }
        res.status(400).json({ error: 'Failed to create analyst' });
    }
}));
// Update analyst
router.put('/:id', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { id } = req.params;
        const { name, email, shiftType, isActive } = req.body;
        const analyst = yield app_1.prisma.analyst.update({
            where: { id },
            data: {
                name,
                email,
                shiftType,
                isActive
            },
            include: { preferences: true }
        });
        res.json(analyst);
    }
    catch (error) {
        console.error('Error updating analyst:', error);
        if (error.code === 'P2025') {
            return res.status(404).json({ error: 'Analyst not found' });
        }
        if (error.code === 'P2002') {
            return res.status(400).json({ error: 'Email already exists' });
        }
        res.status(400).json({ error: 'Failed to update analyst' });
    }
}));
// Delete analyst
router.delete('/:id', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { id } = req.params;
        yield app_1.prisma.analyst.delete({ where: { id } });
        res.status(204).send();
    }
    catch (error) {
        console.error('Error deleting analyst:', error);
        if (error.code === 'P2025') {
            return res.status(404).json({ error: 'Analyst not found' });
        }
        res.status(400).json({ error: 'Failed to delete analyst' });
    }
}));
// Get analyst preferences
router.get('/:id/preferences', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { id } = req.params;
        const preferences = yield app_1.prisma.analystPreference.findMany({
            where: { analystId: id }
        });
        res.json(preferences);
    }
    catch (error) {
        console.error('Error fetching preferences:', error);
        res.status(500).json({ error: 'Failed to fetch preferences' });
    }
}));
// Update analyst preferences
router.post('/:id/preferences', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { id } = req.params;
        const { shiftType, dayOfWeek, preference } = req.body;
        if (!shiftType || !dayOfWeek || !preference) {
            return res.status(400).json({ error: 'shiftType, dayOfWeek, and preference are required' });
        }
        const preferenceRecord = yield app_1.prisma.analystPreference.upsert({
            where: {
                analystId_shiftType_dayOfWeek: {
                    analystId: id,
                    shiftType,
                    dayOfWeek
                }
            },
            update: { preference },
            create: {
                analystId: id,
                shiftType,
                dayOfWeek,
                preference
            }
        });
        res.status(201).json(preferenceRecord);
    }
    catch (error) {
        console.error('Error updating preference:', error);
        res.status(400).json({ error: 'Failed to update preference' });
    }
}));
exports.default = router;
