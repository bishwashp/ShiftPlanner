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
exports.IntelligentScheduler = void 0;
const moment_timezone_1 = __importDefault(require("moment-timezone"));
class IntelligentScheduler {
    constructor(prisma) {
        this.prisma = prisma;
        this.shiftDefinitions = {
            MORNING: { startHour: 9, endHour: 18, tz: 'America/Chicago' },
            EVENING: { startHour: 9, endHour: 18, tz: 'America/Los_Angeles' },
            WEEKEND: { startHour: 9, endHour: 18, tz: 'America/Los_Angeles' },
        };
    }
    /**
     * Main method to resolve conflicts intelligently
     */
    resolveConflicts(conflicts, startDate, endDate) {
        return __awaiter(this, void 0, void 0, function* () {
            const startTime = Date.now();
            // Get all available analysts
            const analysts = yield this.prisma.analyst.findMany({
                where: { isActive: true },
                include: {
                    schedules: {
                        where: {
                            date: {
                                gte: new Date(startDate),
                                lte: new Date(endDate)
                            }
                        }
                    }
                }
            });
            const proposedAssignments = [];
            let criticalConflicts = 0;
            for (const conflict of conflicts) {
                if (conflict.severity === 'critical') {
                    criticalConflicts++;
                }
                for (const shiftType of conflict.missingShifts) {
                    const assignment = yield this.assignAnalyst(conflict.date, shiftType, analysts, startDate, endDate);
                    if (assignment) {
                        proposedAssignments.push(assignment);
                    }
                }
            }
            const endTime = Date.now();
            const computationTime = endTime - startTime;
            return {
                priority: criticalConflicts > 0 ? 'critical' : 'warning',
                autoFixable: true,
                suggestedAssignments: proposedAssignments,
                summary: {
                    totalConflicts: conflicts.length,
                    criticalConflicts,
                    assignmentsNeeded: proposedAssignments.length,
                    estimatedTime: `${computationTime}ms`
                }
            };
        });
    }
    /**
     * Core assignment logic with strategy selection
     */
    assignAnalyst(date, shiftType, analysts, startDate, endDate) {
        return __awaiter(this, void 0, void 0, function* () {
            const strategy = this.getAssignmentStrategy(date, shiftType);
            const availableAnalysts = this.getAvailableAnalysts(date, shiftType, analysts);
            if (availableAnalysts.length === 0) {
                return null;
            }
            let selectedAnalyst;
            let reason;
            switch (strategy.logic) {
                case 'HOLIDAY_COVERAGE':
                    selectedAnalyst = this.assignHolidayCoverage(date, shiftType, availableAnalysts);
                    reason = {
                        primaryReason: 'Holiday coverage - experienced analyst',
                        secondaryFactors: ['High work weight day', 'Requires reliable coverage'],
                        workWeight: 2.0,
                        computationCost: 'LOW'
                    };
                    break;
                case 'WORKLOAD_BALANCE':
                    selectedAnalyst = this.assignWorkloadBalance(date, shiftType, availableAnalysts, startDate, endDate);
                    reason = {
                        primaryReason: 'Workload balance - equitable distribution',
                        secondaryFactors: ['Analyst has lighter week', 'Maintains fair rotation'],
                        workWeight: 1.5,
                        computationCost: 'MEDIUM'
                    };
                    break;
                case 'EXPERIENCE_BASED':
                    selectedAnalyst = this.assignExperienceBased(date, shiftType, availableAnalysts);
                    reason = {
                        primaryReason: 'Experience-based assignment',
                        secondaryFactors: ['Analyst has relevant experience', 'Complex shift requirements'],
                        workWeight: 1.8,
                        computationCost: 'LOW'
                    };
                    break;
                case 'ROUND_ROBIN':
                default:
                    selectedAnalyst = this.assignRoundRobin(date, shiftType, availableAnalysts);
                    reason = {
                        primaryReason: 'Round-robin rotation',
                        secondaryFactors: ['Next in sequence', 'Fair distribution'],
                        workWeight: 1.0,
                        computationCost: 'LOW'
                    };
                    break;
            }
            const shiftDef = this.shiftDefinitions[shiftType];
            const shiftDate = moment_timezone_1.default.tz(date, shiftDef.tz).hour(shiftDef.startHour).minute(0).second(0).utc().format();
            return {
                date: shiftDate,
                shiftType,
                analystId: selectedAnalyst.id,
                analystName: selectedAnalyst.name,
                reason,
                strategy: strategy.name
            };
        });
    }
    /**
     * Determine which assignment strategy to use
     */
    getAssignmentStrategy(date, shiftType) {
        const dayOfWeek = (0, moment_timezone_1.default)(date).day();
        const isHoliday = this.isHoliday(date);
        const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
        if (isHoliday) {
            return {
                id: 'holiday-coverage',
                name: 'Holiday Coverage',
                priority: 1,
                conditions: { workWeightThreshold: 2.0 },
                logic: 'HOLIDAY_COVERAGE'
            };
        }
        if (isWeekend) {
            return {
                id: 'weekend-coverage',
                name: 'Weekend Coverage',
                priority: 2,
                conditions: { workWeightThreshold: 1.5 },
                logic: 'EXPERIENCE_BASED'
            };
        }
        return {
            id: 'round-robin',
            name: 'Round Robin',
            priority: 3,
            conditions: {},
            logic: 'ROUND_ROBIN'
        };
    }
    /**
     * Get analysts available for a specific date and shift
     */
    getAvailableAnalysts(date, shiftType, analysts) {
        return analysts.filter(analyst => {
            // Check if analyst is assigned to this shift type
            if (analyst.shiftType !== shiftType) {
                return false;
            }
            // Check if analyst is already scheduled for this date
            const hasSchedule = analyst.schedules.some((schedule) => {
                const scheduleDate = schedule.date.toISOString().split('T')[0];
                return scheduleDate === date;
            });
            return !hasSchedule;
        });
    }
    /**
     * Round-robin assignment strategy
     */
    assignRoundRobin(date, shiftType, analysts) {
        // Simple round-robin: select the first available analyst
        return analysts[0];
    }
    /**
     * Holiday coverage assignment strategy
     */
    assignHolidayCoverage(date, shiftType, analysts) {
        // For holidays, prefer analysts with more experience (created earlier)
        return analysts.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())[0];
    }
    /**
     * Workload balance assignment strategy
     */
    assignWorkloadBalance(date, shiftType, analysts, startDate, endDate) {
        // For now, use round-robin as fallback
        // TODO: Implement actual workload calculation
        return analysts[0];
    }
    /**
     * Experience-based assignment strategy
     */
    assignExperienceBased(date, shiftType, analysts) {
        // Prefer analysts with more experience (created earlier)
        return analysts.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())[0];
    }
    /**
     * Check if a date is a holiday
     */
    isHoliday(date) {
        // TODO: Implement holiday calendar integration
        // For now, check for common US holidays
        const momentDate = (0, moment_timezone_1.default)(date);
        const month = momentDate.month();
        const day = momentDate.date();
        const dayOfWeek = momentDate.day();
        // New Year's Day
        if (month === 0 && day === 1)
            return true;
        // Independence Day
        if (month === 6 && day === 4)
            return true;
        // Christmas
        if (month === 11 && day === 25)
            return true;
        // Memorial Day (last Monday in May)
        if (month === 4 && dayOfWeek === 1 && day > 24)
            return true;
        // Labor Day (first Monday in September)
        if (month === 8 && dayOfWeek === 1 && day <= 7)
            return true;
        return false;
    }
}
exports.IntelligentScheduler = IntelligentScheduler;
