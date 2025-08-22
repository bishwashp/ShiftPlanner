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
exports.createBatchOperations = exports.createSchedulesByDateRangeLoader = exports.createConstraintsByAnalystLoader = exports.createVacationsByAnalystLoader = exports.createSchedulesByAnalystLoader = exports.createConstraintLoader = exports.createVacationLoader = exports.createScheduleLoader = exports.createAnalystLoader = void 0;
const dataloader_1 = __importDefault(require("dataloader"));
const prisma_1 = require("../lib/prisma");
// Analyst DataLoader
const createAnalystLoader = () => {
    return new dataloader_1.default((ids) => __awaiter(void 0, void 0, void 0, function* () {
        const analysts = yield prisma_1.prisma.analyst.findMany({
            where: { id: { in: [...ids] } },
            include: {
                preferences: true,
                schedules: true,
                vacations: true,
                constraints: true,
            }
        });
        // Return analysts in the same order as the requested IDs
        return ids.map(id => analysts.find(analyst => analyst.id === id));
    }));
};
exports.createAnalystLoader = createAnalystLoader;
// Schedule DataLoader
const createScheduleLoader = () => {
    return new dataloader_1.default((ids) => __awaiter(void 0, void 0, void 0, function* () {
        const schedules = yield prisma_1.prisma.schedule.findMany({
            where: { id: { in: [...ids] } },
            include: { analyst: true }
        });
        return ids.map(id => schedules.find(schedule => schedule.id === id));
    }));
};
exports.createScheduleLoader = createScheduleLoader;
// Vacation DataLoader
const createVacationLoader = () => {
    return new dataloader_1.default((ids) => __awaiter(void 0, void 0, void 0, function* () {
        const vacations = yield prisma_1.prisma.vacation.findMany({
            where: { id: { in: [...ids] } },
            include: { analyst: true }
        });
        return ids.map(id => vacations.find(vacation => vacation.id === id));
    }));
};
exports.createVacationLoader = createVacationLoader;
// Constraint DataLoader
const createConstraintLoader = () => {
    return new dataloader_1.default((ids) => __awaiter(void 0, void 0, void 0, function* () {
        const constraints = yield prisma_1.prisma.schedulingConstraint.findMany({
            where: { id: { in: [...ids] } },
            include: { analyst: true }
        });
        return ids.map(id => constraints.find(constraint => constraint.id === id));
    }));
};
exports.createConstraintLoader = createConstraintLoader;
// Schedules by Analyst DataLoader
const createSchedulesByAnalystLoader = () => {
    return new dataloader_1.default((analystIds) => __awaiter(void 0, void 0, void 0, function* () {
        const schedules = yield prisma_1.prisma.schedule.findMany({
            where: { analystId: { in: [...analystIds] } },
            include: { analyst: true },
            orderBy: { date: 'asc' }
        });
        // Group schedules by analyst ID
        const schedulesByAnalyst = analystIds.map(analystId => schedules.filter(schedule => schedule.analystId === analystId));
        return schedulesByAnalyst;
    }));
};
exports.createSchedulesByAnalystLoader = createSchedulesByAnalystLoader;
// Vacations by Analyst DataLoader
const createVacationsByAnalystLoader = () => {
    return new dataloader_1.default((analystIds) => __awaiter(void 0, void 0, void 0, function* () {
        const vacations = yield prisma_1.prisma.vacation.findMany({
            where: { analystId: { in: [...analystIds] } },
            include: { analyst: true },
            orderBy: { startDate: 'asc' }
        });
        // Group vacations by analyst ID
        const vacationsByAnalyst = analystIds.map(analystId => vacations.filter(vacation => vacation.analystId === analystId));
        return vacationsByAnalyst;
    }));
};
exports.createVacationsByAnalystLoader = createVacationsByAnalystLoader;
// Constraints by Analyst DataLoader
const createConstraintsByAnalystLoader = () => {
    return new dataloader_1.default((analystIds) => __awaiter(void 0, void 0, void 0, function* () {
        const constraints = yield prisma_1.prisma.schedulingConstraint.findMany({
            where: { analystId: { in: [...analystIds] } },
            include: { analyst: true },
            orderBy: { startDate: 'asc' }
        });
        // Group constraints by analyst ID
        const constraintsByAnalyst = analystIds.map(analystId => constraints.filter(constraint => constraint.analystId === analystId));
        return constraintsByAnalyst;
    }));
};
exports.createConstraintsByAnalystLoader = createConstraintsByAnalystLoader;
// Schedules by Date Range DataLoader
const createSchedulesByDateRangeLoader = () => {
    return new dataloader_1.default((dateRanges) => __awaiter(void 0, void 0, void 0, function* () {
        const schedules = yield prisma_1.prisma.schedule.findMany({
            where: {
                OR: dateRanges.map(range => ({
                    date: {
                        gte: range.start,
                        lte: range.end
                    }
                }))
            },
            include: { analyst: true },
            orderBy: { date: 'asc' }
        });
        // Group schedules by date range
        const schedulesByRange = dateRanges.map(range => schedules.filter(schedule => schedule.date >= range.start && schedule.date <= range.end));
        return schedulesByRange;
    }));
};
exports.createSchedulesByDateRangeLoader = createSchedulesByDateRangeLoader;
// Batch operations for creating multiple schedules
const createBatchOperations = () => {
    return new dataloader_1.default((operations) => __awaiter(void 0, void 0, void 0, function* () {
        const results = [];
        for (const operation of operations) {
            try {
                switch (operation.type) {
                    case 'create':
                        const creation = {
                            analystId: operation.data.analystId,
                            date: new Date(operation.data.date),
                            shiftType: operation.data.shiftType,
                            isScreener: operation.data.isScreener
                        };
                        const created = yield prisma_1.prisma.schedule.create({
                            data: creation,
                            include: { analyst: true }
                        });
                        results.push(created);
                        break;
                    case 'update':
                        const updated = yield prisma_1.prisma.schedule.update({
                            where: { id: operation.data.id },
                            data: {
                                shiftType: operation.data.shiftType,
                                isScreener: operation.data.isScreener
                            },
                            include: { analyst: true }
                        });
                        results.push(updated);
                        break;
                    case 'delete':
                        const deleted = yield prisma_1.prisma.schedule.delete({
                            where: { id: operation.data.id },
                            include: { analyst: true }
                        });
                        results.push(deleted);
                        break;
                }
            }
            catch (error) {
                results.push(null);
            }
        }
        return results;
    }));
};
exports.createBatchOperations = createBatchOperations;
