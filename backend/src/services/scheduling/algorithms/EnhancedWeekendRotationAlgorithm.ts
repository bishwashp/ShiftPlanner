import { SchedulingAlgorithm, SchedulingContext, SchedulingResult, DEFAULT_ALGORITHM_CONFIG } from './types';
import { Analyst, Schedule, SchedulingConstraint } from '../../../../generated/prisma';
import { fairnessEngine } from './FairnessEngine';
import { constraintEngine } from './ConstraintEngine';
import { optimizationEngine } from './OptimizationEngine';
import { rotationStateManager, RotationAssignment } from '../RotationStateManager';
import { autoCompAssignmentEngine } from '../AutoCompAssignmentEngine';
import { workloadBalancingSystem } from '../WorkloadBalancingSystem';
import { compOffBankService } from '../CompOffBankService';
import { prisma } from '../../../lib/prisma';
import { createLocalDate, isWeekend } from '../../../utils/dateUtils';

export class EnhancedWeekendRotationAlgorithm {
    name = 'EnhancedWeekendRotationAlgorithm';
    description = 'Foundation algorithm with auto-comp logic and dual-analyst rotation system';
    version = '3.0.0';
    supportedFeatures = [
        'Auto-Compensatory Time Off',
        'Dual-Analyst Rotation',
        '4-Day Weekend Logic',
        'Workload Balancing',
        'Fairness-Based Selection',
        'Rotation Continuity',
        'Comp-Off Banking',
        'Overtime Compensation'
    ];
    
    /**
     * Generate schedules using the foundation algorithm
     */
    async generateSchedules(context: SchedulingContext): Promise<SchedulingResult> {
        console.log(`🚀 Starting Enhanced Weekend Rotation Algorithm v${this.version}`);
        const startTime = Date.now();
        
        try {
            // Normalize to full Sun–Sat weeks to avoid partial-week starts
            const originalStart = new Date(context.startDate);
            const originalEnd = new Date(context.endDate);
            const normalizedStart = new Date(originalStart);
            normalizedStart.setHours(0,0,0,0);
            normalizedStart.setDate(normalizedStart.getDate() - normalizedStart.getDay());
            const normalizedEnd = new Date(originalEnd);
            normalizedEnd.setHours(0,0,0,0);
            normalizedEnd.setDate(normalizedEnd.getDate() + (6 - normalizedEnd.getDay()));
            const normContext: SchedulingContext = { ...context, startDate: normalizedStart, endDate: normalizedEnd };

            // 1. Generate regular rotation schedules
            const regularSchedules = await this.generateRegularRotationSchedules(normContext);
            
            // 2. Apply auto-comp logic for weekend and holiday work
            const schedulesWithCompOff = await this.applyAutoCompLogic(regularSchedules, normContext);
            
            // 3. Validate workload balance
            const balancedSchedules = await this.validateWorkloadBalance(schedulesWithCompOff, normContext);
            
            // 4. Generate screener assignments (respecting comp-off days)
            const finalSchedules = await this.generateScreenerSchedules(balancedSchedules, normContext);
            
            // 5. Optimize schedules
            const optimizedSchedules = await optimizationEngine.optimizeSchedules(finalSchedules, normContext);

            // 5b. Preview filter: remove any Friday assignment for an analyst
            // who is also assigned on the Sunday of the same Sun–Sat week
            const hasSundayByWeek = new Set<string>();
            const hasSaturdayByWeek = new Set<string>();
            for (const s of optimizedSchedules) {
                const d = new Date(s.date + 'T00:00:00Z');
                const dow = d.getUTCDay();
                if (dow === 0) {
                    const weekKey = `${s.analystId}|${s.date}`; // Sunday is the week key
                    hasSundayByWeek.add(weekKey);
                } else if (dow === 6) {
                    // Compute the Sunday of this week for a consistent key
                    const weekSunday = new Date(d);
                    weekSunday.setUTCDate(d.getUTCDate() - d.getUTCDay());
                    const weekKey = `${s.analystId}|${weekSunday.toISOString().slice(0,10)}`;
                    hasSaturdayByWeek.add(weekKey);
                }
            }
            const filteredSchedulesPreRange = optimizedSchedules.filter((s: any) => {
                const d = new Date(s.date + 'T00:00:00Z');
                const dow = d.getUTCDay();
                const weekSunday = new Date(d);
                weekSunday.setUTCDate(d.getUTCDate() - d.getUTCDay());
                const weekKey = `${s.analystId}|${weekSunday.toISOString().slice(0,10)}`;
                // Drop Friday if Sunday exists in same week
                if (dow === 5 && hasSundayByWeek.has(weekKey)) return false;
                // Drop Monday if Saturday exists in same week
                if (dow === 1 && hasSaturdayByWeek.has(weekKey)) return false;
                return true;
            });

            // Limit to the originally requested range after normalization
            const filteredSchedules = filteredSchedulesPreRange.filter((s: any) => {
                const sd = new Date(s.date + 'T00:00:00Z');
                return sd >= originalStart && sd <= originalEnd;
            });
            
            // 6. Calculate fairness metrics
            const fairnessMetrics = fairnessEngine.calculateFairness(optimizedSchedules, normContext.analysts);
            
            const executionTime = Date.now() - startTime;
            console.log(`✅ Enhanced Weekend Rotation Algorithm completed in ${executionTime}ms`);
            
            // Update rotation state for next generation
            try {
                await this.updateRotationStates(normContext, regularSchedules);
            } catch (error) {
                console.warn('Failed to update rotation states:', error);
            }
            
            return {
                proposedSchedules: filteredSchedules,
                conflicts: [],
                overwrites: [],
                fairnessMetrics,
                performanceMetrics: {
                    totalQueries: 0,
                    averageQueryTime: 0,
                    slowQueries: 0,
                    cacheHitRate: 0,
                    algorithmExecutionTime: executionTime,
                    memoryUsage: 0,
                    optimizationIterations: 0
                }
            };
            
        } catch (error) {
            console.error('❌ Enhanced Weekend Rotation Algorithm failed:', error);
            throw error;
        }
    }
    
    /**
     * Update rotation states after generation
     */
    private async updateRotationStates(context: SchedulingContext, schedules: any[]): Promise<void> {
        const morningAnalysts = context.analysts.filter(a => a.shiftType === 'MORNING' && a.isActive);
        const eveningAnalysts = context.analysts.filter(a => a.shiftType === 'EVENING' && a.isActive);
        
        // Update morning rotation
        if (morningAnalysts.length > 0) {
            const morningAssignment = await rotationStateManager.getRotationAssignments(
                this.name, 'MORNING', context.startDate, morningAnalysts
            );
            await rotationStateManager.updateRotationState(
                this.name, 'MORNING', morningAssignment, morningAnalysts
            );
        }
        
        // Update evening rotation
        if (eveningAnalysts.length > 0) {
            const eveningAssignment = await rotationStateManager.getRotationAssignments(
                this.name, 'EVENING', context.startDate, eveningAnalysts
            );
            await rotationStateManager.updateRotationState(
                this.name, 'EVENING', eveningAssignment, eveningAnalysts
            );
        }
    }
    
    /**
     * Generate regular rotation schedules using dual-analyst system
     */
    private async generateRegularRotationSchedules(context: SchedulingContext): Promise<any[]> {
        const schedules: any[] = [];
        
        // Precompute rotation assignments for both shifts for Sunday guard across shifts
        const morningAnalysts = context.analysts.filter(a => a.shiftType === 'MORNING' && a.isActive);
        const eveningAnalysts = context.analysts.filter(a => a.shiftType === 'EVENING' && a.isActive);

        const morningAssignment = morningAnalysts.length > 0
            ? await rotationStateManager.getRotationAssignments(this.name, 'MORNING', context.startDate, morningAnalysts)
            : null;
        const eveningAssignment = eveningAnalysts.length > 0
            ? await rotationStateManager.getRotationAssignments(this.name, 'EVENING', context.startDate, eveningAnalysts)
            : null;

        // Track actual Sunday workers per Sun–Sat week using Sunday date as key
        const sundayWorkersPerWeek = new Map<string, Set<string>>();
        
        // Generate for each shift type, using cross-shift Sunday guard
        const shiftTypes: ('MORNING' | 'EVENING')[] = ['MORNING', 'EVENING'];
        for (const shiftType of shiftTypes) {
            const shiftAnalysts = context.analysts.filter(a => a.shiftType === shiftType && a.isActive);
            if (shiftAnalysts.length === 0) continue;
            const rotationAssignment = shiftType === 'MORNING' ? morningAssignment : eveningAssignment;
            if (!rotationAssignment) continue;

            const shiftSchedules = await this.generateShiftSchedules(
                rotationAssignment,
                shiftAnalysts,
                context,
                sundayWorkersPerWeek,
                shiftType
            );
            schedules.push(...shiftSchedules);
        }
        
        return schedules;
    }
    
    /**
     * Generate schedules for a specific shift type
     */
    private async generateShiftSchedules(
        assignment: RotationAssignment,
        analysts: Analyst[],
        context: SchedulingContext,
        sundayWorkersPerWeek: Map<string, Set<string>>,
        shiftType: 'MORNING' | 'EVENING'
    ): Promise<any[]> {
        const schedules: any[] = [];
        const currentDate = new Date(context.startDate);


        while (currentDate <= context.endDate) {
            const dateStr = currentDate.toISOString().split('T')[0];
            const dayOfWeek = currentDate.getDay();
            
            // Check for blackout dates and holidays
            if (await this.isBlackoutDate(currentDate, context.globalConstraints)) {
                currentDate.setDate(currentDate.getDate() + 1);
                continue;
            }
            
            // Generate schedules based on day of week and rotation assignment
            if (dayOfWeek === 0) { // Sunday
                // Sun-Thu analyst works
                const sunThuAnalyst = analysts.find(a => a.id === assignment.sunThuAnalyst);
                if (sunThuAnalyst && !(await this.isAnalystOnVacation(sunThuAnalyst, currentDate))) {
                    schedules.push(this.createScheduleEntry(sunThuAnalyst, currentDate, shiftType, false));
                    // Record that this analyst worked on this week's Sunday (keyed by Sunday date)
                    const sundayKey = dateStr;
                    const set = sundayWorkersPerWeek.get(sundayKey) || new Set<string>();
                    set.add(sunThuAnalyst.id);
                    sundayWorkersPerWeek.set(sundayKey, set);
                }
            } else if (dayOfWeek === 6) { // Saturday
                // Tue-Sat analyst works
                const tueSatAnalyst = analysts.find(a => a.id === assignment.tueSatAnalyst);
                if (tueSatAnalyst && !(await this.isAnalystOnVacation(tueSatAnalyst, currentDate))) {
                    schedules.push(this.createScheduleEntry(tueSatAnalyst, currentDate, shiftType, false));
                }
            } else { // Monday-Friday
                // Regular analysts work (fallback to all non-rotation analysts if regular list is empty)
                const regularIds = assignment.regularAnalysts && assignment.regularAnalysts.length > 0
                    ? assignment.regularAnalysts
                    : analysts
                        .filter(a => a.id !== assignment.sunThuAnalyst && a.id !== assignment.tueSatAnalyst)
                        .map(a => a.id);

                for (const analystId of regularIds) {
                    const analyst = analysts.find(a => a.id === analystId);
                    if (analyst && !(await this.isAnalystOnVacation(analyst, currentDate))) {
                        // Hard constraint: Friday off if analyst worked Sunday of same week
                        if (dayOfWeek === 5) {
                            const weekSunday = new Date(currentDate);
                            weekSunday.setDate(currentDate.getDate() - currentDate.getDay());
                            const wkKey = weekSunday.toISOString().split('T')[0];
                            // Check against precomputed rotation assignments (cross-shift)
                            const isSunWorker = await (async ()=>{
                                const aId = analyst.id;
                                // Same logic as workedOnSundayThisWeek earlier
                                // If Sunday is blackout or analyst on vacation Sunday, treat as not working Sunday
                                if (await this.isBlackoutDate(weekSunday, context.globalConstraints)) return false;
                                if (await this.isAnalystOnVacation(analyst, weekSunday)) return false;
                                return (assignment.sunThuAnalyst === aId);
                            })();
                            if (isSunWorker) {
                                continue;
                            }
                        }
                        schedules.push(this.createScheduleEntry(analyst, currentDate, shiftType, false));
                    }
                }
                
                // Sun-Thu analyst works (Monday-Thursday)
                if (dayOfWeek >= 1 && dayOfWeek <= 4) {
                    const sunThuAnalyst = analysts.find(a => a.id === assignment.sunThuAnalyst);
                    if (sunThuAnalyst && !(await this.isAnalystOnVacation(sunThuAnalyst, currentDate))) {
                        schedules.push(this.createScheduleEntry(sunThuAnalyst, currentDate, shiftType, false));
                    }
                }
                
                // Tue-Sat analyst works (Tuesday-Saturday, but we're in weekday loop)
                if (dayOfWeek >= 2 && dayOfWeek <= 5) {
                    const tueSatAnalyst = analysts.find(a => a.id === assignment.tueSatAnalyst);
                    if (tueSatAnalyst && !(await this.isAnalystOnVacation(tueSatAnalyst, currentDate))) {
                        // Friday guard applies to anyone who worked Sunday this week
                        if (dayOfWeek === 5) {
                            const weekSunday = new Date(currentDate);
                            weekSunday.setDate(currentDate.getDate() - currentDate.getDay());
                            const isSunWorker = await (async ()=>{
                                const aId = tueSatAnalyst.id;
                                if (await this.isBlackoutDate(weekSunday, context.globalConstraints)) return false;
                                if (await this.isAnalystOnVacation(tueSatAnalyst, weekSunday)) return false;
                                return (assignment.sunThuAnalyst === aId);
                            })();
                            if (isSunWorker) {
                                // skip
                            } else {
                                schedules.push(this.createScheduleEntry(tueSatAnalyst, currentDate, shiftType, false));
                            }
                        } else {
                            schedules.push(this.createScheduleEntry(tueSatAnalyst, currentDate, shiftType, false));
                        }
                    }
                }
            }
            
            currentDate.setDate(currentDate.getDate() + 1);
        }
        
        return schedules;
    }
    
    /**
     * Apply auto-comp logic for weekend and holiday work
     */
    private async applyAutoCompLogic(schedules: any[], context: SchedulingContext): Promise<any[]> {
        // Enforce policy without creating synthetic COMP_OFF schedules.
        // Only process Sunday and holidays; Saturday has no extra auto-comp.
        for (const schedule of schedules) {
            const workDate = new Date(schedule.date);
            const day = workDate.getDay();

            const isHoliday = await this.isHoliday(workDate, context.globalConstraints);

            // Sunday or holiday work → try auto-comp (policy-aware in engine). Skip Saturday.
            if (isHoliday || day === 0) {
                const workType = isHoliday ? 'HOLIDAY' : 'WEEKEND';
                await autoCompAssignmentEngine.processWeekendWork(
                    schedule.analystId,
                    workDate,
                    workType
                );
            }
        }

        // Return original schedules; comp-off visibility is enforced via bank and constraints.
        return schedules;
    }
    
    /**
     * Validate workload balance and process violations
     */
    private async validateWorkloadBalance(schedules: any[], context: SchedulingContext): Promise<any[]> {
        // Analyze workload for all analysts
        const workloadAnalysis = await workloadBalancingSystem.analyzeWorkloadBalance(
            context.analysts.map(a => a.id),
            context.startDate,
            context.endDate
        );
        
        // Process overtime violations
        await workloadBalancingSystem.processOvertimeViolations(workloadAnalysis.workloads);
        
        // Log workload violations
        if (workloadAnalysis.overallBalance.totalViolations > 0) {
            console.log(`⚠️ Found ${workloadAnalysis.overallBalance.totalViolations} workload violations`);
            workloadAnalysis.recommendations.forEach(rec => console.log(`   - ${rec}`));
        }
        
        return schedules;
    }
    
    /**
     * Generate screener assignments respecting comp-off days
     */
    private async generateScreenerSchedules(schedules: any[], context: SchedulingContext): Promise<any[]> {
        const schedulesWithScreeners = [...schedules];
        
        // Group schedules by date
        const schedulesByDate = this.groupSchedulesByDate(schedules);
        
        // Process each weekday for screener assignments
        const currentDate = new Date(context.startDate);
        while (currentDate <= context.endDate) {
            const dayOfWeek = currentDate.getDay();
            
            // Only assign screeners on weekdays
            if (dayOfWeek >= 1 && dayOfWeek <= 5) {
                const dateStr = currentDate.toISOString().split('T')[0];
                const daySchedules = schedulesByDate[dateStr] || [];
                
                // Get working analysts for this day
                const workingAnalysts = [];
                for (const s of daySchedules) {
                    // Rely solely on banked comp-off, no synthetic COMP_OFF filtering
                    if (!s.isScreener && !(await compOffBankService.hasCompOffOnDate(s.analystId, currentDate))) {
                        workingAnalysts.push(s);
                    }
                }
                
                // Separate by shift type
                const morningAnalysts = workingAnalysts.filter(s => s.shiftType === 'MORNING');
                const eveningAnalysts = workingAnalysts.filter(s => s.shiftType === 'EVENING');
                
                // Assign screeners
                if (morningAnalysts.length > 0) {
                    const screener = this.selectScreener(morningAnalysts, currentDate);
                    if (screener) {
                        schedulesWithScreeners.push({
                            ...screener,
                            isScreener: true,
                            type: 'SCREENER_SCHEDULE'
                        });
                    }
                }
                
                if (eveningAnalysts.length > 0) {
                    const screener = this.selectScreener(eveningAnalysts, currentDate);
                    if (screener) {
                        schedulesWithScreeners.push({
                            ...screener,
                            isScreener: true,
                            type: 'SCREENER_SCHEDULE'
                        });
                    }
                }
            }
            
            currentDate.setDate(currentDate.getDate() + 1);
        }
        
        return schedulesWithScreeners;
    }
    
    /**
     * Select screener based on fairness and constraints
     */
    private selectScreener(analysts: any[], date: Date): any | null {
        if (analysts.length === 0) return null;
        
        // Simple selection logic - can be enhanced with more sophisticated algorithms
        // For now, select the first available analyst
        return analysts[0];
    }
    
    /**
     * Group schedules by date
     */
    private groupSchedulesByDate(schedules: any[]): Record<string, any[]> {
        return schedules.reduce((groups, schedule) => {
            const date = schedule.date;
            if (!groups[date]) {
                groups[date] = [];
            }
            groups[date].push(schedule);
            return groups;
        }, {} as Record<string, any[]>);
    }
    
    /**
     * Create schedule entry
     */
    private createScheduleEntry(analyst: Analyst, date: Date, shiftType: string, isScreener: boolean): any {
        return {
            date: date.toISOString().split('T')[0],
            analystId: analyst.id,
            analystName: analyst.name,
            shiftType,
            isScreener,
            type: 'NEW_SCHEDULE'
        };
    }
    
    /**
     * Check if date is a blackout date
     */
    private async isBlackoutDate(date: Date, constraints: SchedulingConstraint[]): Promise<boolean> {
        return constraints.some(c => 
            c.constraintType === 'BLACKOUT_DATE' &&
            new Date(c.startDate) <= date &&
            new Date(c.endDate) >= date
        );
    }
    
    /**
     * Check if date is a holiday
     */
    private async isHoliday(date: Date, constraints: SchedulingConstraint[]): Promise<boolean> {
        return constraints.some(c => 
            c.constraintType === 'HOLIDAY' &&
            new Date(c.startDate) <= date &&
            new Date(c.endDate) >= date
        );
    }
    
    /**
     * Check if analyst is on vacation
     */
    private async isAnalystOnVacation(analyst: Analyst, date: Date): Promise<boolean> {
        // Get vacations from database since they're not included in the analyst object
        const vacations = await prisma.vacation.findMany({
            where: {
                analystId: analyst.id,
                isApproved: true,
                startDate: { lte: date },
                endDate: { gte: date }
            }
        });
        
        return vacations.length > 0;
    }
    
    /**
     * Update rotation state after schedule generation
     */
    private async updateRotationState(
        context: SchedulingContext,
        schedules: any[]
    ): Promise<void> {
        // Update rotation state for both shift types
        const shiftTypes: ('MORNING' | 'EVENING')[] = ['MORNING', 'EVENING'];
        
        for (const shiftType of shiftTypes) {
            const shiftAnalysts = context.analysts.filter(a => a.shiftType === shiftType && a.isActive);
            
            if (shiftAnalysts.length === 0) continue;
            
            // Get current rotation assignment
            const rotationAssignment = await rotationStateManager.getRotationAssignments(
                this.name,
                shiftType,
                context.startDate,
                shiftAnalysts
            );
            
            // Update rotation state
            await rotationStateManager.updateRotationState(
                this.name,
                shiftType,
                rotationAssignment,
                shiftAnalysts
            );
        }
    }
}

export default new EnhancedWeekendRotationAlgorithm();
