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
// Get all constraints
router.get('/', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { analystId } = req.query;
        const where = {};
        if (analystId) {
            where.analystId = analystId;
        }
        const constraints = yield prisma_1.prisma.schedulingConstraint.findMany({
            where,
            orderBy: { startDate: 'asc' },
        });
        res.json(constraints);
    }
    catch (error) {
        console.error('Error fetching constraints:', error);
        res.status(500).json({ error: 'Failed to fetch constraints' });
    }
}));
// Create new constraint
router.post('/', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { analystId, shiftType, startDate, endDate, constraintType, description, isActive } = req.body;
        if (!startDate || !endDate || !constraintType) {
            return res.status(400).json({ error: 'startDate, endDate, and constraintType are required' });
        }
        const constraint = yield prisma_1.prisma.schedulingConstraint.create({
            data: {
                analystId,
                shiftType,
                startDate: new Date(startDate),
                endDate: new Date(endDate),
                constraintType,
                description,
                isActive,
            },
        });
        res.status(201).json(constraint);
    }
    catch (error) {
        console.error('Error creating constraint:', error);
        res.status(400).json({ error: 'Failed to create constraint' });
    }
}));
// Update constraint
router.put('/:id', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { id } = req.params;
        const { analystId, shiftType, startDate, endDate, constraintType, description, isActive } = req.body;
        const constraint = yield prisma_1.prisma.schedulingConstraint.update({
            where: { id },
            data: {
                analystId,
                shiftType,
                startDate: startDate ? new Date(startDate) : undefined,
                endDate: endDate ? new Date(endDate) : undefined,
                constraintType,
                description,
                isActive,
            },
        });
        res.json(constraint);
    }
    catch (error) {
        console.error('Error updating constraint:', error);
        if (error.code === 'P2025') {
            return res.status(404).json({ error: 'Constraint not found' });
        }
        res.status(400).json({ error: 'Failed to update constraint' });
    }
}));
// Delete constraint
router.delete('/:id', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { id } = req.params;
        yield prisma_1.prisma.schedulingConstraint.delete({ where: { id } });
        res.status(204).send();
    }
    catch (error) {
        console.error('Error deleting constraint:', error);
        if (error.code === 'P2025') {
            return res.status(404).json({ error: 'Constraint not found' });
        }
        res.status(400).json({ error: 'Failed to delete constraint' });
    }
}));
exports.default = router;
