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
const router = (0, express_1.Router)();
// Get all vacations with optional analyst filter
router.get('/', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { analystId } = req.query;
        const where = {};
        if (analystId) {
            where.analystId = analystId;
        }
        const vacations = yield prisma_1.prisma.vacation.findMany({
            where,
            include: {
                analyst: true
            },
            orderBy: { startDate: 'asc' }
        });
        res.json(vacations);
    }
    catch (error) {
        console.error('Error fetching vacations:', error);
        res.status(500).json({ error: 'Failed to fetch vacations' });
    }
}));
// Get vacation by ID
router.get('/:id', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { id } = req.params;
        const vacation = yield prisma_1.prisma.vacation.findUnique({
            where: { id },
            include: { analyst: true }
        });
        if (!vacation) {
            return res.status(404).json({ error: 'Vacation not found' });
        }
        res.json(vacation);
    }
    catch (error) {
        console.error('Error fetching vacation:', error);
        res.status(500).json({ error: 'Failed to fetch vacation' });
    }
}));
// Create new vacation
router.post('/', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { analystId, startDate, endDate, reason, isApproved = true } = req.body;
        if (!analystId || !startDate || !endDate) {
            return res.status(400).json({ error: 'analystId, startDate, and endDate are required' });
        }
        // Verify analyst exists
        const analyst = yield prisma_1.prisma.analyst.findUnique({
            where: { id: analystId }
        });
        if (!analyst) {
            return res.status(404).json({ error: 'Analyst not found' });
        }
        const vacation = yield prisma_1.prisma.vacation.create({
            data: {
                analystId,
                startDate: new Date(startDate),
                endDate: new Date(endDate),
                reason,
                isApproved
            },
            include: { analyst: true }
        });
        res.status(201).json(vacation);
    }
    catch (error) {
        console.error('Error creating vacation:', error);
        res.status(400).json({ error: 'Failed to create vacation' });
    }
}));
// Update vacation
router.put('/:id', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { id } = req.params;
        const { startDate, endDate, reason, isApproved } = req.body;
        const vacation = yield prisma_1.prisma.vacation.update({
            where: { id },
            data: {
                startDate: startDate ? new Date(startDate) : undefined,
                endDate: endDate ? new Date(endDate) : undefined,
                reason,
                isApproved
            },
            include: { analyst: true }
        });
        res.json(vacation);
    }
    catch (error) {
        console.error('Error updating vacation:', error);
        if (error.code === 'P2025') {
            return res.status(404).json({ error: 'Vacation not found' });
        }
        res.status(400).json({ error: 'Failed to update vacation' });
    }
}));
// Delete vacation
router.delete('/:id', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { id } = req.params;
        yield prisma_1.prisma.vacation.delete({ where: { id } });
        res.status(204).send();
    }
    catch (error) {
        console.error('Error deleting vacation:', error);
        if (error.code === 'P2025') {
            return res.status(404).json({ error: 'Vacation not found' });
        }
        res.status(400).json({ error: 'Failed to delete vacation' });
    }
}));
exports.default = router;
