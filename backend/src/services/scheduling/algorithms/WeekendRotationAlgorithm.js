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
const types_1 = require("./types");
const FairnessEngine_1 = require("./FairnessEngine");
const ConstraintEngine_1 = require("./ConstraintEngine");
const OptimizationEngine_1 = require("./OptimizationEngine");
class WeekendRotationAlgorithm {
    constructor() {
        this.name = 'WeekendRotationAlgorithm';
        this.description = 'Advanced weekend rotation algorithm with fairness optimization and constraint satisfaction';
        this.version = '2.0.0';
        this.supportedFeatures = [
            'Fairness Optimization',
            'Constraint Validation',
            'Multiple Optimization Strategies',
            'Workload Balancing',
            'Screener Assignment Optimization',
            'Weekend Rotation Fairness'
        ];
    }
    generateSchedules(context) {
        return __awaiter(this, void 0, void 0, function* () {
            const startTime = Date.now();
            console.log(`🚀 Starting ${this.name} v${this.version} with ${context.analysts.length} analysts`);
            // Use default config if not provided
            const config = context.algorithmConfig || types_1.DEFAULT_ALGORITHM_CONFIG;
            // Generate initial schedules
            const initialSchedules = yield this.generateInitialSchedules(context);
            // Validate constraints
            const constraintValidation = ConstraintEngine_1.constraintEngine.validateConstraints(initialSchedules, context.globalConstraints);
            // Calculate initial fairness metrics
            const fairnessMetrics = FairnessEngine_1.fairnessEngine.calculateFairness(initialSchedules, context.analysts);
            // Optimize schedules if needed
            let optimizedSchedules = initialSchedules;
            if (config.optimizationStrategy !== 'GREEDY' || fairnessMetrics.overallFairnessScore < 0.7) {
                console.log(`🔧 Optimizing schedules using ${config.optimizationStrategy} strategy`);
                optimizedSchedules = yield OptimizationEngine_1.optimizationEngine.optimizeSchedules(initialSchedules, context);
            }
            // Recalculate metrics after optimization
            const finalFairnessMetrics = FairnessEngine_1.fairnessEngine.calculateFairness(optimizedSchedules, context.analysts);
            const finalConstraintValidation = ConstraintEngine_1.constraintEngine.validateConstraints(optimizedSchedules, context.globalConstraints);
            // Generate conflicts and overwrites
            const conflicts = this.generateConflicts(optimizedSchedules, context);
            const overwrites = this.generateOverwrites(optimizedSchedules, context.existingSchedules);
            // Calculate performance metrics
            const executionTime = Date.now() - startTime;
            const performanceMetrics = {
                totalQueries: 0, // Will be updated by Prisma client
                averageQueryTime: 0,
                slowQueries: 0,
                cacheHitRate: 0,
                algorithmExecutionTime: executionTime,
                memoryUsage: process.memoryUsage().heapUsed / 1024 / 1024, // MB
                optimizationIterations: 0 // Will be updated by optimization engine
            };
            console.log(`✅ ${this.name} completed in ${executionTime}ms`);
            console.log(`📊 Fairness Score: ${finalFairnessMetrics.overallFairnessScore.toFixed(4)}`);
            console.log(`🔒 Constraint Score: ${finalConstraintValidation.score.toFixed(4)}`);
            return {
                proposedSchedules: optimizedSchedules,
                conflicts,
                overwrites,
                fairnessMetrics: finalFairnessMetrics,
                performanceMetrics
            };
        });
    }
    validateConstraints(schedules, constraints) {
        return ConstraintEngine_1.constraintEngine.validateConstraints(schedules, constraints);
    }
    calculateFairness(schedules, analysts) {
        return FairnessEngine_1.fairnessEngine.calculateFairness(schedules, analysts);
    }
    optimizeSchedules(schedules, context) {
        return __awaiter(this, void 0, void 0, function* () {
            return OptimizationEngine_1.optimizationEngine.optimizeSchedules(schedules, context);
        });
    }
    generateInitialSchedules(context) {
        return __awaiter(this, void 0, void 0, function* () {
            const { startDate, endDate, analysts, existingSchedules, globalConstraints } = context;
            const regularSchedulesResult = yield this.generateRegularWorkSchedules(startDate, endDate, analysts, existingSchedules, globalConstraints);
            const allProposedSchedules = [...regularSchedulesResult.proposedSchedules];
            const allConflicts = [...regularSchedulesResult.conflicts];
            const allOverwrites = [...regularSchedulesResult.overwrites];
            const screenerSchedulesResult = yield this.generateScreenerSchedules(startDate, endDate, analysts, existingSchedules, globalConstraints, allProposedSchedules);
            screenerSchedulesResult.proposedSchedules.forEach(screenerSchedule => {
                const index = allProposedSchedules.findIndex(p => p.analystId === screenerSchedule.analystId && p.date === screenerSchedule.date);
                if (index !== -1) {
                    allProposedSchedules[index].isScreener = true;
                    if (screenerSchedule.type === 'OVERWRITE_SCHEDULE' && allProposedSchedules[index].type !== 'OVERWRITE_SCHEDULE') {
                        allProposedSchedules[index].type = 'OVERWRITE_SCHEDULE';
                        const existingOverwrite = allOverwrites.find(o => o.date === screenerSchedule.date && o.analystId === screenerSchedule.analystId);
                        if (!existingOverwrite) {
                            allOverwrites.push({
                                date: screenerSchedule.date,
                                analystId: screenerSchedule.analystId,
                                analystName: screenerSchedule.analystName,
                                from: { shiftType: allProposedSchedules[index].shiftType, isScreener: false },
                                to: { shiftType: allProposedSchedules[index].shiftType, isScreener: true }
                            });
                        }
                    }
                }
                else {
                    allProposedSchedules.push(screenerSchedule);
                }
            });
            allConflicts.push(...screenerSchedulesResult.conflicts);
            allOverwrites.push(...screenerSchedulesResult.overwrites.filter(o => !allOverwrites.some(existing => existing.date === o.date && existing.analystId === o.analystId)));
            return allProposedSchedules;
        });
    }
    generateRegularWorkSchedules(startDate, endDate, analysts, existingSchedules, globalConstraints) {
        return __awaiter(this, void 0, void 0, function* () {
            const result = {
                proposedSchedules: [],
                conflicts: [],
                overwrites: []
            };
            const workPatterns = [
                { name: 'SUN_THU', days: [0, 1, 2, 3, 4], nextPattern: 'TUE_SAT' },
                { name: 'MON_FRI', days: [1, 2, 3, 4, 5], nextPattern: 'SUN_THU' },
                { name: 'TUE_SAT', days: [2, 3, 4, 5, 6], nextPattern: 'MON_FRI' }
            ];
            const morningAnalysts = analysts.filter(a => a.shiftType === 'MORNING');
            const eveningAnalysts = analysts.filter(a => a.shiftType === 'EVENING');
            let morningPatterns = this.assignAnalystsToPatterns(morningAnalysts, workPatterns);
            let eveningPatterns = this.assignAnalystsToPatterns(eveningAnalysts, workPatterns);
            const loopEndDate = new Date(endDate);
            const currentDate = this.getWeekStart(new Date(startDate));
            while (currentDate <= loopEndDate) {
                const weekStart = new Date(currentDate);
                const weekEnd = new Date(weekStart);
                weekEnd.setDate(weekEnd.getDate() + 6);
                const effectiveWeekStart = new Date(Math.max(weekStart.getTime(), startDate.getTime()));
                const effectiveWeekEnd = new Date(Math.min(weekEnd.getTime(), endDate.getTime()));
                if (effectiveWeekStart <= effectiveWeekEnd) {
                    const weekSchedules = this.generateWeekSchedules(effectiveWeekStart, effectiveWeekEnd, morningPatterns, eveningPatterns, existingSchedules, globalConstraints, result.overwrites);
                    result.proposedSchedules.push(...weekSchedules.proposedSchedules);
                    result.conflicts.push(...weekSchedules.conflicts);
                }
                morningPatterns = this.rotatePatterns(morningPatterns, workPatterns);
                eveningPatterns = this.rotatePatterns(eveningPatterns, workPatterns);
                currentDate.setDate(currentDate.getDate() + 7);
            }
            return result;
        });
    }
    assignAnalystsToPatterns(analysts, patterns) {
        const assignments = {};
        patterns.forEach(p => {
            assignments[p.name] = { pattern: p, analysts: [] };
        });
        analysts.forEach((analyst, index) => {
            const patternName = patterns[index % patterns.length].name;
            assignments[patternName].analysts.push(analyst);
        });
        return assignments;
    }
    rotatePatterns(patternAssignments, patterns) {
        const newAssignments = {};
        patterns.forEach(p => {
            newAssignments[p.name] = { pattern: p, analysts: [] };
        });
        for (const patternName in patternAssignments) {
            const assignment = patternAssignments[patternName];
            const nextPatternName = assignment.pattern.nextPattern;
            newAssignments[nextPatternName].analysts.push(...assignment.analysts);
        }
        return newAssignments;
    }
    getWeekStart(date) {
        const result = new Date(date);
        result.setHours(0, 0, 0, 0);
        const day = result.getDay();
        result.setDate(result.getDate() - day);
        return result;
    }
    generateWeekSchedules(weekStart, weekEnd, morningPatterns, eveningPatterns, existingSchedules, globalConstraints, overwrites) {
        const result = {
            proposedSchedules: [],
            conflicts: [],
        };
        const currentDate = new Date(weekStart);
        while (currentDate <= weekEnd) {
            const dayOfWeek = currentDate.getDay();
            const blackoutConstraint = globalConstraints.find(c => new Date(c.startDate) <= currentDate && new Date(c.endDate) >= currentDate && c.constraintType === 'BLACKOUT_DATE');
            if (blackoutConstraint) {
                result.conflicts.push({
                    date: currentDate.toISOString().split('T')[0],
                    type: 'BLACKOUT_DATE',
                    description: blackoutConstraint.description || 'No scheduling allowed on this date',
                    severity: 'CRITICAL'
                });
                currentDate.setDate(currentDate.getDate() + 1);
                continue;
            }
            const processShift = (analysts, shiftType) => {
                analysts.forEach(analyst => {
                    const schedule = this.createScheduleEntry(analyst, currentDate, shiftType, false, existingSchedules, overwrites);
                    if (schedule)
                        result.proposedSchedules.push(schedule);
                });
            };
            processShift(this.getAnalystsForDay(morningPatterns, dayOfWeek), 'MORNING');
            processShift(this.getAnalystsForDay(eveningPatterns, dayOfWeek), 'EVENING');
            currentDate.setDate(currentDate.getDate() + 1);
        }
        return result;
    }
    getAnalystsForDay(patternAssignments, dayOfWeek) {
        const workingAnalysts = [];
        for (const patternName in patternAssignments) {
            const assignment = patternAssignments[patternName];
            if (assignment.pattern.days.includes(dayOfWeek)) {
                workingAnalysts.push(...assignment.analysts);
            }
        }
        return workingAnalysts;
    }
    createScheduleEntry(analyst, date, shiftType, isScreener, existingSchedules, overwrites) {
        var _a;
        const dateStr = date.toISOString().split('T')[0];
        const onVacation = ((_a = analyst.vacations) === null || _a === void 0 ? void 0 : _a.some((v) => new Date(v.startDate) <= date && new Date(v.endDate) >= date)) || false;
        if (onVacation)
            return null;
        const existingSchedule = existingSchedules.find(s => s.analystId === analyst.id && new Date(s.date).toISOString().split('T')[0] === dateStr);
        const scheduleData = {
            date: dateStr,
            analystId: analyst.id,
            analystName: analyst.name,
            shiftType,
            isScreener
        };
        if (existingSchedule) {
            if (existingSchedule.shiftType !== shiftType || existingSchedule.isScreener !== isScreener) {
                overwrites.push({
                    date: dateStr,
                    analystId: analyst.id,
                    analystName: analyst.name,
                    from: { shiftType: existingSchedule.shiftType, isScreener: existingSchedule.isScreener },
                    to: { shiftType, isScreener }
                });
                return Object.assign(Object.assign({}, scheduleData), { type: 'OVERWRITE_SCHEDULE' });
            }
            return null;
        }
        return Object.assign(Object.assign({}, scheduleData), { type: 'NEW_SCHEDULE' });
    }
    generateScreenerSchedules(startDate, endDate, analysts, existingSchedules, globalConstraints, regularSchedules) {
        return __awaiter(this, void 0, void 0, function* () {
            const result = {
                proposedSchedules: [],
                conflicts: [],
                overwrites: []
            };
            const currentDate = new Date(startDate);
            let screenerIndex = 0;
            while (currentDate <= endDate) {
                const dateStr = currentDate.toISOString().split('T')[0];
                const dayOfWeek = currentDate.getDay();
                if (dayOfWeek === 0 || dayOfWeek === 6) {
                    currentDate.setDate(currentDate.getDate() + 1);
                    continue;
                }
                const blackoutConstraint = globalConstraints.find(c => new Date(c.startDate) <= currentDate && new Date(c.endDate) >= currentDate && c.constraintType === 'BLACKOUT_DATE');
                if (blackoutConstraint) {
                    result.conflicts.push({
                        date: dateStr,
                        type: 'BLACKOUT_DATE',
                        description: blackoutConstraint.description || 'No scheduling allowed on this date',
                        severity: 'CRITICAL'
                    });
                    currentDate.setDate(currentDate.getDate() + 1);
                    continue;
                }
                const workingAnalysts = regularSchedules
                    .filter(s => s.date === dateStr && !s.isScreener)
                    .map(s => analysts.find(a => a.id === s.analystId))
                    .filter(Boolean);
                const morningAnalysts = workingAnalysts.filter((a) => a.shiftType === 'MORNING');
                const eveningAnalysts = workingAnalysts.filter((a) => a.shiftType === 'EVENING');
                const assignScreener = (shiftAnalysts, shiftType) => {
                    if (shiftAnalysts.length > 0) {
                        const eligibleAnalysts = shiftAnalysts.filter(a => { var _a; return !((_a = a.vacations) === null || _a === void 0 ? void 0 : _a.some((v) => new Date(v.startDate) <= currentDate && new Date(v.endDate) >= currentDate)); });
                        if (eligibleAnalysts.length > 0) {
                            // Skill-based assignment for screeners
                            const skilledAnalysts = eligibleAnalysts.filter(a => { var _a; return (_a = a.skills) === null || _a === void 0 ? void 0 : _a.includes('screener-training'); });
                            let selectedScreener;
                            if (skilledAnalysts.length > 0) {
                                selectedScreener = skilledAnalysts[screenerIndex % skilledAnalysts.length];
                            }
                            else {
                                selectedScreener = eligibleAnalysts[screenerIndex % eligibleAnalysts.length];
                            }
                            const screenerSchedule = this.createScreenerSchedule(selectedScreener, currentDate, shiftType, existingSchedules, result.overwrites);
                            if (screenerSchedule)
                                result.proposedSchedules.push(screenerSchedule);
                        }
                    }
                };
                assignScreener(morningAnalysts, 'MORNING');
                assignScreener(eveningAnalysts, 'EVENING');
                screenerIndex++;
                currentDate.setDate(currentDate.getDate() + 1);
            }
            return result;
        });
    }
    createScreenerSchedule(analyst, date, shiftType, existingSchedules, overwrites) {
        const dateStr = date.toISOString().split('T')[0];
        const scheduleData = {
            date: dateStr,
            analystId: analyst.id,
            analystName: analyst.name,
            shiftType,
            isScreener: true,
        };
        const existingSchedule = existingSchedules.find(s => s.analystId === analyst.id && new Date(s.date).toISOString().split('T')[0] === dateStr);
        if (existingSchedule) {
            if (!existingSchedule.isScreener) {
                overwrites.push({
                    date: dateStr,
                    analystId: analyst.id,
                    analystName: analyst.name,
                    from: { shiftType: existingSchedule.shiftType, isScreener: false },
                    to: { shiftType, isScreener: true }
                });
                return Object.assign(Object.assign({}, scheduleData), { type: 'OVERWRITE_SCHEDULE' });
            }
            return null;
        }
        return Object.assign(Object.assign({}, scheduleData), { type: 'NEW_SCHEDULE' });
    }
    generateConflicts(schedules, context) {
        const conflicts = [];
        // Check for insufficient staff
        const dailyCoverage = new Map();
        for (const schedule of schedules) {
            const date = schedule.date;
            if (!dailyCoverage.has(date)) {
                dailyCoverage.set(date, { morning: 0, evening: 0 });
            }
            const coverage = dailyCoverage.get(date);
            if (schedule.shiftType === 'MORNING') {
                coverage.morning++;
            }
            else if (schedule.shiftType === 'EVENING') {
                coverage.evening++;
            }
        }
        // Check for coverage issues
        for (const [date, coverage] of dailyCoverage) {
            if (coverage.morning === 0) {
                conflicts.push({
                    date,
                    type: 'INSUFFICIENT_STAFF',
                    description: 'No morning shift coverage',
                    severity: 'HIGH',
                    suggestedResolution: 'Assign additional morning analyst'
                });
            }
            if (coverage.evening === 0) {
                conflicts.push({
                    date,
                    type: 'INSUFFICIENT_STAFF',
                    description: 'No evening shift coverage',
                    severity: 'HIGH',
                    suggestedResolution: 'Assign additional evening analyst'
                });
            }
        }
        return conflicts;
    }
    generateOverwrites(schedules, existingSchedules) {
        const overwrites = [];
        for (const schedule of schedules) {
            const existing = existingSchedules.find(s => s.analystId === schedule.analystId &&
                new Date(s.date).toISOString().split('T')[0] === schedule.date);
            if (existing && (existing.shiftType !== schedule.shiftType || existing.isScreener !== schedule.isScreener)) {
                overwrites.push({
                    date: schedule.date,
                    analystId: schedule.analystId,
                    analystName: schedule.analystName,
                    from: { shiftType: existing.shiftType, isScreener: existing.isScreener },
                    to: { shiftType: schedule.shiftType, isScreener: schedule.isScreener },
                    reason: 'Algorithm optimization'
                });
            }
        }
        return overwrites;
    }
}
exports.default = new WeekendRotationAlgorithm();
