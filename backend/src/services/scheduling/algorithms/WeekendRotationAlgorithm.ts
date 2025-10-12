import { SchedulingAlgorithm, SchedulingContext, SchedulingResult, DEFAULT_ALGORITHM_CONFIG } from './types';
import { Analyst, Schedule, SchedulingConstraint } from '../../../../generated/prisma';
import { fairnessEngine } from './FairnessEngine';
import { constraintEngine } from './ConstraintEngine';
import { optimizationEngine } from './OptimizationEngine';
import { PatternContinuityService } from '../PatternContinuityService';
import { rotationManager, RotationManager } from '../RotationManager';
import { fairnessCalculator } from '../FairnessCalculator';
import { prisma } from '../../../lib/prisma';
import { createLocalDate, isWeekend } from '../../../utils/dateUtils';

export class WeekendRotationAlgorithm implements SchedulingAlgorithm {
    name = 'WeekendRotationAlgorithm';
    description = 'Advanced weekend rotation algorithm with fairness optimization and constraint satisfaction';
    version = '2.0.0';
    supportedFeatures = [
        'Fairness Optimization',
        'Constraint Validation',
        'Multiple Optimization Strategies',
        'Workload Balancing',
        'Screener Assignment Optimization',
        'Weekend Rotation Fairness',
        'Pattern Continuity'
    ];
    
    private patternContinuityService: PatternContinuityService;
    
    constructor() {
        this.patternContinuityService = new PatternContinuityService(prisma);
        // Initialize rotation manager with pattern continuity service
        (rotationManager as any) = new RotationManager(this.patternContinuityService);
    }

    async generateSchedules(context: SchedulingContext): Promise<SchedulingResult> {
        const startTime = Date.now();
        console.log(`🚀 Starting ${this.name} v${this.version} with ${context.analysts.length} analysts`);
        
        // Use default config if not provided
        const config = context.algorithmConfig || DEFAULT_ALGORITHM_CONFIG;
        
        // Generate initial schedules
        const initialSchedules = await this.generateInitialSchedules(context);
        
        // Validate constraints
        const constraintValidation = constraintEngine.validateConstraints(initialSchedules, context.globalConstraints);
        
        // Calculate initial fairness metrics
        const fairnessMetrics = fairnessEngine.calculateFairness(initialSchedules, context.analysts);
        
        // Optimize schedules if needed
        let optimizedSchedules = initialSchedules;
        if (config.optimizationStrategy !== 'GREEDY' || fairnessMetrics.overallFairnessScore < 0.7) {
            console.log(`🔧 Optimizing schedules using ${config.optimizationStrategy} strategy`);
            optimizedSchedules = await optimizationEngine.optimizeSchedules(initialSchedules, context);
        }
        
        // Recalculate metrics after optimization
        const finalFairnessMetrics = fairnessEngine.calculateFairness(optimizedSchedules, context.analysts);
        const finalConstraintValidation = constraintEngine.validateConstraints(optimizedSchedules, context.globalConstraints);
        
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
    }

    validateConstraints(schedules: any[], constraints: SchedulingConstraint[]): any {
        return constraintEngine.validateConstraints(schedules, constraints);
    }

    calculateFairness(schedules: any[], analysts: Analyst[]): any {
        return fairnessEngine.calculateFairness(schedules, analysts);
    }

    async optimizeSchedules(schedules: any[], context: SchedulingContext): Promise<any[]> {
        return optimizationEngine.optimizeSchedules(schedules, context);
    }

    private async generateInitialSchedules(context: SchedulingContext): Promise<any[]> {
        const { startDate, endDate, analysts, existingSchedules, globalConstraints } = context;

        const regularSchedulesResult = await this.generateRegularWorkSchedules(startDate, endDate, analysts, existingSchedules, globalConstraints);
    
        const allProposedSchedules = [...regularSchedulesResult.proposedSchedules];
        const allConflicts = [...regularSchedulesResult.conflicts];
        const allOverwrites = [...regularSchedulesResult.overwrites];
      
        const screenerSchedulesResult = await this.generateScreenerSchedules(
          startDate,
          endDate,
          analysts,
          existingSchedules,
          globalConstraints,
          allProposedSchedules
        );
      
        screenerSchedulesResult.proposedSchedules.forEach(screenerSchedule => {
          const index = allProposedSchedules.findIndex(p => p.analystId === screenerSchedule.analystId && p.date === screenerSchedule.date);
      
          if (index !== -1) {
            allProposedSchedules[index].isScreener = true;
            if (screenerSchedule.type === 'OVERWRITE_SCHEDULE' && allProposedSchedules[index].type !== 'OVERWRITE_SCHEDULE') {
                allProposedSchedules[index].type = 'OVERWRITE_SCHEDULE';
                const existingOverwrite = allOverwrites.find(o => o.date === screenerSchedule.date && o.analystId === screenerSchedule.analystId);
                if(!existingOverwrite) {
                    allOverwrites.push({
                        date: screenerSchedule.date,
                        analystId: screenerSchedule.analystId,
                        analystName: screenerSchedule.analystName,
                        from: { shiftType: allProposedSchedules[index].shiftType, isScreener: false },
                        to: { shiftType: allProposedSchedules[index].shiftType, isScreener: true }
                    });
                }
            }
          } else {
            allProposedSchedules.push(screenerSchedule);
          }
        });
      
        allConflicts.push(...screenerSchedulesResult.conflicts);
        allOverwrites.push(...screenerSchedulesResult.overwrites.filter(o => !allOverwrites.some(existing => existing.date === o.date && existing.analystId === o.analystId)));
      
        return allProposedSchedules;
    }

    private async generateRegularWorkSchedules(
        startDate: Date,
        endDate: Date,
        analysts: any[],
        existingSchedules: any[],
        globalConstraints: any[]
      ) {
        const result = {
          proposedSchedules: [] as any[],
          conflicts: [] as any[],
          overwrites: [] as any[]
        };
        
        console.log(`🔄 Planning rotation for date range: ${startDate.toISOString().split('T')[0]} to ${endDate.toISOString().split('T')[0]}`);
        
        // Get morning and evening analysts
        const morningAnalysts = analysts.filter(a => a.shiftType === 'MORNING');
        const eveningAnalysts = analysts.filter(a => a.shiftType === 'EVENING');
        
        // Plan rotations for morning and evening shifts
        const morningRotationPlans = await rotationManager.planRotation(
          this.name,
          'MORNING',
          startDate,
          endDate,
          morningAnalysts,
          existingSchedules
        );
        
        const eveningRotationPlans = await rotationManager.planRotation(
          this.name,
          'EVENING',
          startDate,
          endDate,
          eveningAnalysts,
          existingSchedules
        );
        
        console.log(`📊 Generated ${morningRotationPlans.length} morning rotation plans and ${eveningRotationPlans.length} evening rotation plans`);
        
        // Generate schedules day by day
        const currentDate = new Date(startDate);
        
        while (currentDate <= endDate) {
          const dateStr = currentDate.toISOString().split('T')[0];
          const dayOfWeek = currentDate.getDay();
          
          // Check for blackout dates
          const blackoutConstraint = globalConstraints.find(c => 
            new Date((c as any).startDate) <= currentDate && 
            new Date((c as any).endDate) >= currentDate && 
            (c as any).constraintType === 'BLACKOUT_DATE'
          );
          
          if (blackoutConstraint) {
            result.conflicts.push({
              date: dateStr,
              type: 'BLACKOUT_DATE',
              description: (blackoutConstraint as any).description || 'No scheduling allowed on this date',
              severity: 'CRITICAL'
            });
            currentDate.setDate(currentDate.getDate() + 1);
            continue;
          }
          
          // Check for holidays
          const holidayConstraint = globalConstraints.find(c => 
            new Date((c as any).startDate) <= currentDate && 
            new Date((c as any).endDate) >= currentDate && 
            (c as any).constraintType === 'HOLIDAY'
          );
          
          if (holidayConstraint) {
            result.conflicts.push({
              date: dateStr,
              type: 'HOLIDAY',
              description: (holidayConstraint as any).description || 'Holiday - no regular scheduling',
              severity: 'INFO'
            });
            currentDate.setDate(currentDate.getDate() + 1);
            continue;
          }
          
          // Process morning analysts
          for (const analyst of morningAnalysts) {
            // Check if analyst should work based on rotation
            let shouldWork = rotationManager.shouldAnalystWork(
              analyst.id,
              currentDate,
              morningRotationPlans
            );
            
            // If not working based on rotation, check if weekend coverage is needed
            if (!shouldWork && isWeekend(currentDate)) {
              shouldWork = rotationManager.needsWeekendCoverage(
                analyst.id,
                currentDate,
                'MORNING',
                morningRotationPlans,
                morningAnalysts
              );
              
              // Debug logging for weekend coverage
              if (shouldWork) {
                console.log(`🔧 Weekend coverage: Assigned ${analyst.name} (${analyst.id}) for MORNING on ${dateStr}`);
              }
            }
            
            // Check for vacations
            const onVacation = analyst.vacations?.some((v: any) => 
              new Date(v.startDate) <= currentDate && 
              new Date(v.endDate) >= currentDate
            ) || false;
            
            if (shouldWork && !onVacation) {
              // Create schedule entry
              const schedule = this.createScheduleEntry(
                analyst,
                currentDate,
                'MORNING',
                false,
                existingSchedules,
                result.overwrites
              );
              
              if (schedule) {
                result.proposedSchedules.push(schedule);
              }
            }
          }
          
          // Process evening analysts
          for (const analyst of eveningAnalysts) {
            // Check if analyst should work based on rotation
            let shouldWork = rotationManager.shouldAnalystWork(
              analyst.id,
              currentDate,
              eveningRotationPlans
            );
            
            // If not working based on rotation, check if weekend coverage is needed
            if (!shouldWork && isWeekend(currentDate)) {
              shouldWork = rotationManager.needsWeekendCoverage(
                analyst.id,
                currentDate,
                'EVENING',
                eveningRotationPlans,
                eveningAnalysts
              );
              
              // Debug logging for weekend coverage
              if (shouldWork) {
                console.log(`🔧 Weekend coverage: Assigned ${analyst.name} (${analyst.id}) for EVENING on ${dateStr}`);
              }
            }
            
            // Check for vacations
            const onVacation = analyst.vacations?.some((v: any) => 
              new Date(v.startDate) <= currentDate && 
              new Date(v.endDate) >= currentDate
            ) || false;
            
            if (shouldWork && !onVacation) {
              // Create schedule entry
              const schedule = this.createScheduleEntry(
                analyst,
                currentDate,
                'EVENING',
                false,
                existingSchedules,
                result.overwrites
              );
              
              if (schedule) {
                result.proposedSchedules.push(schedule);
              }
            }
          }
          
          // Move to next day
          currentDate.setDate(currentDate.getDate() + 1);
        }
        
        return result;
      }

      private async assignAnalystsWithContinuity(
        analysts: any[], 
        patterns: any[], 
        continuityData: Map<string, any>,
        startDate: Date
      ) {
        const assignments: { [key: string]: { pattern: any; analysts: any[] } } = {};
        patterns.forEach(p => {
          assignments[p.name] = { pattern: p, analysts: [] };
        });
        
        // First, assign analysts based on continuity data
        const assignedAnalystIds = new Set<string>();
        
        analysts.forEach(analyst => {
          const analystContinuity = continuityData.get(analyst.id);
          if (analystContinuity) {
            // Calculate which pattern this analyst should be on based on continuity
            const weeksSinceLastWork = Math.floor(
              (startDate.getTime() - analystContinuity.lastWorkDate.getTime()) / (1000 * 60 * 60 * 24 * 7)
            );
            
            // Determine the pattern based on rotation
            let currentPattern = analystContinuity.lastPattern;
            for (let i = 0; i < weeksSinceLastWork; i++) {
              const pattern = patterns.find(p => p.name === currentPattern);
              if (pattern) {
                currentPattern = pattern.nextPattern;
              }
            }
            
            if (assignments[currentPattern]) {
              assignments[currentPattern].analysts.push(analyst);
              assignedAnalystIds.add(analyst.id);
            }
          }
        });
        
        // Then assign remaining analysts using the enhanced logic
        const unassignedAnalysts = analysts.filter(a => !assignedAnalystIds.has(a.id));
        if (unassignedAnalysts.length > 0) {
          const tempAssignments = this.assignAnalystsToPatterns(unassignedAnalysts, patterns);
          
          // Merge the temporary assignments
          for (const patternName in tempAssignments) {
            assignments[patternName].analysts.push(...tempAssignments[patternName].analysts);
          }
        }
        
        return assignments;
      }
      
      private async savePatternContinuity(
        morningPatterns: any,
        eveningPatterns: any,
        endDate: Date
      ) {
        const continuityData: any[] = [];
        const workPatterns = [
          { name: 'SUN_THU', days: [0, 1, 2, 3, 4], nextPattern: 'TUE_SAT' },
          { name: 'MON_FRI', days: [1, 2, 3, 4, 5], nextPattern: 'SUN_THU' },
          { name: 'TUE_SAT', days: [2, 3, 4, 5, 6], nextPattern: 'MON_FRI' }
        ];
        
        // Calculate week number based on a 3-week rotation cycle
        const cycleStartDate = new Date('2025-01-01'); // Reference date for cycle calculation
        const weekNumber = Math.floor((endDate.getTime() - cycleStartDate.getTime()) / (1000 * 60 * 60 * 24 * 7)) % 3 + 1;
        
        // Process morning patterns
        for (const patternName in morningPatterns) {
          const assignment = morningPatterns[patternName];
          assignment.analysts.forEach((analyst: any) => {
            continuityData.push({
              analystId: analyst.id,
              lastPattern: patternName,
              lastWorkDate: endDate,
              weekNumber: weekNumber,
              metadata: { shiftType: 'MORNING' }
            });
          });
        }
        
        // Process evening patterns
        for (const patternName in eveningPatterns) {
          const assignment = eveningPatterns[patternName];
          assignment.analysts.forEach((analyst: any) => {
            continuityData.push({
              analystId: analyst.id,
              lastPattern: patternName,
              lastWorkDate: endDate,
              weekNumber: weekNumber,
              metadata: { shiftType: 'EVENING' }
            });
          });
        }
        
        if (continuityData.length > 0) {
          await this.patternContinuityService.saveContinuityData(this.name, continuityData);
        }
      }

      private assignAnalystsToPatterns(analysts: any[], patterns: any[]) {
        const assignments: { [key: string]: { pattern: any; analysts: any[] } } = {};
        patterns.forEach(p => {
          assignments[p.name] = { pattern: p, analysts: [] };
        });
      
        // Enhanced assignment logic to ensure coverage
        if (analysts.length < patterns.length) {
          // If we have fewer analysts than patterns, ensure every analyst works
          // and some analysts work multiple patterns to ensure full coverage
          analysts.forEach((analyst, index) => {
            // Primary assignment
            const primaryPattern = patterns[index % patterns.length];
            assignments[primaryPattern.name].analysts.push(analyst);
            
            // Additional assignments to ensure coverage
            // Calculate how many patterns need coverage
            const patternsNeedingCoverage = patterns.filter(p => 
              assignments[p.name].analysts.length === 0
            );
            
            // Assign analysts to uncovered patterns
            if (patternsNeedingCoverage.length > 0 && index < patternsNeedingCoverage.length) {
              const additionalPattern = patternsNeedingCoverage[index];
              if (additionalPattern && additionalPattern.name !== primaryPattern.name) {
                assignments[additionalPattern.name].analysts.push(analyst);
              }
            }
          });
          
          // Final check: ensure all patterns have at least one analyst
          patterns.forEach(pattern => {
            if (assignments[pattern.name].analysts.length === 0 && analysts.length > 0) {
              // Assign the analyst with the least assignments
              const analystWorkload = new Map<string, number>();
              analysts.forEach(a => analystWorkload.set(a.id, 0));
              
              // Count current assignments
              Object.values(assignments).forEach(assignment => {
                assignment.analysts.forEach(a => {
                  analystWorkload.set(a.id, (analystWorkload.get(a.id) || 0) + 1);
                });
              });
              
              // Find analyst with least assignments
              let minWorkload = Infinity;
              let selectedAnalyst = analysts[0];
              analysts.forEach(a => {
                const workload = analystWorkload.get(a.id) || 0;
                if (workload < minWorkload) {
                  minWorkload = workload;
                  selectedAnalyst = a;
                }
              });
              
              assignments[pattern.name].analysts.push(selectedAnalyst);
            }
          });
        } else {
          // Standard assignment when we have enough analysts - distribute evenly across patterns
          const analystsPerPattern = Math.floor(analysts.length / patterns.length);
          const remainingAnalysts = analysts.length % patterns.length;
          
          let analystIndex = 0;
          patterns.forEach((pattern, patternIndex) => {
            // Calculate how many analysts this pattern should get
            const analystsForThisPattern = analystsPerPattern + (patternIndex < remainingAnalysts ? 1 : 0);
            
            // Assign analysts to this pattern
            for (let i = 0; i < analystsForThisPattern; i++) {
              if (analystIndex < analysts.length) {
                assignments[pattern.name].analysts.push(analysts[analystIndex]);
                analystIndex++;
              }
            }
          });
        }
      
        return assignments;
      }

      private rotatePatterns(
        patternAssignments: { [key: string]: { pattern: any; analysts: any[] } },
        patterns: any[]
      ) {
          const newAssignments: { [key: string]: { pattern: any; analysts: any[] } } = {};
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
      
      private getWeekStart(date: Date): Date {
        const result = new Date(date);
        result.setHours(0, 0, 0, 0);
        const day = result.getDay();
        result.setDate(result.getDate() - day);
        return result;
      }

      private generateWeekSchedules(
        weekStart: Date,
        weekEnd: Date,
        morningPatterns: any,
        eveningPatterns: any,
        existingSchedules: any[],
        globalConstraints: any[],
        overwrites: any[]
      ) {
        const result = {
          proposedSchedules: [] as any[],
          conflicts: [] as any[],
        };
      
        const currentDate = new Date(weekStart);
        while(currentDate <= weekEnd) {
          const dayOfWeek = currentDate.getDay();
      
          const blackoutConstraint = globalConstraints.find(c => new Date((c as any).startDate) <= currentDate && new Date((c as any).endDate) >= currentDate && (c as any).constraintType === 'BLACKOUT_DATE');
          if (blackoutConstraint) {
            result.conflicts.push({
              date: currentDate.toISOString().split('T')[0],
              type: 'BLACKOUT_DATE',
              description: (blackoutConstraint as any).description || 'No scheduling allowed on this date',
              severity: 'CRITICAL'
            });
            currentDate.setDate(currentDate.getDate() + 1);
            continue;
          }
          
          // Check if it's a holiday (treated as weekend - no screeners needed)
          const holidayConstraint = globalConstraints.find(c => 
            new Date((c as any).startDate) <= currentDate && 
            new Date((c as any).endDate) >= currentDate && 
            (c as any).constraintType === 'HOLIDAY'
          );
          const isHoliday = !!holidayConstraint;
      
          const processShift = (analysts: any[], shiftType: 'MORNING' | 'EVENING') => {
            analysts.forEach(analyst => {
              const schedule = this.createScheduleEntry(analyst, currentDate, shiftType, false, existingSchedules, overwrites);
              if (schedule) result.proposedSchedules.push(schedule);
            });
          };
      
          processShift(this.getAnalystsForDay(morningPatterns, dayOfWeek), 'MORNING');
          processShift(this.getAnalystsForDay(eveningPatterns, dayOfWeek), 'EVENING');
      
          currentDate.setDate(currentDate.getDate() + 1);
        }
      
        return result;
      }

      private getAnalystsForDay(patternAssignments: any, dayOfWeek: number) {
        const workingAnalysts: any[] = [];
        const addedAnalystIds = new Set<string>();
        
        for (const patternName in patternAssignments) {
          const assignment = patternAssignments[patternName];
          if (assignment.pattern.days.includes(dayOfWeek)) {
            // Avoid duplicates when an analyst works multiple patterns
            assignment.analysts.forEach((analyst: any) => {
              if (!addedAnalystIds.has(analyst.id)) {
                workingAnalysts.push(analyst);
                addedAnalystIds.add(analyst.id);
              }
            });
          }
        }
        return workingAnalysts;
      }

      private createScheduleEntry(
        analyst: any,
        date: Date,
        shiftType: string,
        isScreener: boolean,
        existingSchedules: any[],
        overwrites: any[]
      ) {
        const dateStr = date.toISOString().split('T')[0];
        
        const onVacation = analyst.vacations?.some((v: any) => new Date(v.startDate) <= date && new Date(v.endDate) >= date) || false;
        if (onVacation) return null;
      
        const existingSchedule = existingSchedules.find(s => (s as any).analystId === analyst.id && new Date((s as any).date).toISOString().split('T')[0] === dateStr);
      
        const scheduleData = {
          date: dateStr,
          analystId: analyst.id,
          analystName: analyst.name,
          shiftType,
          isScreener
        };
      
        if (existingSchedule) {
          if ((existingSchedule as any).shiftType !== shiftType || (existingSchedule as any).isScreener !== isScreener) {
              overwrites.push({
                  date: dateStr,
                  analystId: analyst.id,
                  analystName: analyst.name,
                  from: { shiftType: (existingSchedule as any).shiftType, isScreener: (existingSchedule as any).isScreener },
                  to: { shiftType, isScreener }
              });
            return { ...scheduleData, type: 'OVERWRITE_SCHEDULE' };
          }
          return null; 
        }
      
        return { ...scheduleData, type: 'NEW_SCHEDULE' };
      }

      private async generateScreenerSchedules(
        startDate: Date,
        endDate: Date,
        analysts: any[],
        existingSchedules: any[],
        globalConstraints: any[],
        regularSchedules: any[]
    ) {
        // Get rotation plans for both shifts
        const morningAnalysts = analysts.filter(a => a.shiftType === 'MORNING');
        const eveningAnalysts = analysts.filter(a => a.shiftType === 'EVENING');
        
        const morningRotationPlans = await rotationManager.planRotation(
          this.name,
          'MORNING',
          startDate,
          endDate,
          morningAnalysts,
          existingSchedules
        );
        
        const eveningRotationPlans = await rotationManager.planRotation(
          this.name,
          'EVENING',
          startDate,
          endDate,
          eveningAnalysts,
          existingSchedules
        );
        const result = {
          proposedSchedules: [] as any[],
          conflicts: [] as any[],
          overwrites: [] as any[]
        };
      
        // Track screener assignments for spacing
        const screenerAssignmentHistory = new Map<string, Date[]>();
        analysts.forEach(a => screenerAssignmentHistory.set(a.id, []));
        
        // Load recent screener assignments from existing schedules
        const lookbackDate = new Date(startDate);
        lookbackDate.setDate(lookbackDate.getDate() - 7);
        existingSchedules.forEach(schedule => {
          if (schedule.isScreener && new Date(schedule.date) >= lookbackDate && new Date(schedule.date) < startDate) {
            const history = screenerAssignmentHistory.get(schedule.analystId) || [];
            history.push(new Date(schedule.date));
            screenerAssignmentHistory.set(schedule.analystId, history);
          }
        });
      
        const currentDate = new Date(startDate);
        let screenerIndex = 0;
      
        while (currentDate <= endDate) {
          const dateStr = currentDate.toISOString().split('T')[0];
          const dayOfWeek = currentDate.getDay();
      
          // Check if it's weekend
          if (isWeekend(currentDate)) {
            currentDate.setDate(currentDate.getDate() + 1);
            continue;
          }
          
          // Check if it's a holiday (treated as weekend)
          const holidayConstraint = globalConstraints.find(c => 
            new Date((c as any).startDate) <= currentDate && 
            new Date((c as any).endDate) >= currentDate && 
            (c as any).constraintType === 'HOLIDAY'
          );
          if (holidayConstraint) {
            currentDate.setDate(currentDate.getDate() + 1);
            continue;
          }
      
          const blackoutConstraint = globalConstraints.find(c => new Date((c as any).startDate) <= currentDate && new Date((c as any).endDate) >= currentDate && (c as any).constraintType === 'BLACKOUT_DATE');
          if (blackoutConstraint) {
            result.conflicts.push({ 
              date: dateStr, 
              type: 'BLACKOUT_DATE', 
              description: (blackoutConstraint as any).description || 'No scheduling allowed on this date',
              severity: 'CRITICAL'
            });
            currentDate.setDate(currentDate.getDate() + 1);
            continue;
          }
      
          // Find working analysts from both proposed and existing schedules
          const proposedWorkingAnalysts = regularSchedules
            .filter(s => s.date === dateStr && !s.isScreener)
            .map(s => analysts.find(a => a.id === s.analystId))
            .filter(Boolean);
            
          const existingWorkingAnalysts = existingSchedules
            .filter(s => new Date((s as any).date).toISOString().split('T')[0] === dateStr && !(s as any).isScreener)
            .map(s => analysts.find(a => a.id === (s as any).analystId))
            .filter(Boolean);
            
          // Combine both lists, avoiding duplicates
          const workingAnalystIds = new Set<string>();
          const workingAnalysts: any[] = [];
          
          [...proposedWorkingAnalysts, ...existingWorkingAnalysts].forEach(analyst => {
            if (analyst && !workingAnalystIds.has(analyst.id)) {
              workingAnalystIds.add(analyst.id);
              workingAnalysts.push(analyst);
            }
          });
      
          const morningAnalysts = workingAnalysts.filter((a: any) => a.shiftType === 'MORNING');
          const eveningAnalysts = workingAnalysts.filter((a: any) => a.shiftType === 'EVENING');
      
          const assignScreener = (shiftAnalysts: any[], shiftType: 'MORNING' | 'EVENING') => {
            if (shiftAnalysts.length > 0) {
                const eligibleAnalysts = shiftAnalysts.filter(a => !a.vacations?.some((v: any) => new Date(v.startDate) <= currentDate && new Date(v.endDate) >= currentDate));
                if(eligibleAnalysts.length > 0) {
                    
                    // Enhanced screener assignment with spacing logic
                    const analystScores = eligibleAnalysts.map(analyst => {
                      const history = screenerAssignmentHistory.get(analyst.id) || [];
                      let score = 0;
                      
                      // Check consecutive screener days in the past week
                      const recentScreenerDays = history.filter(d => {
                        const daysDiff = Math.floor((currentDate.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
                        return daysDiff <= 7 && daysDiff >= 0;
                      }).length;
                      
                      // Penalize if already screened 2 days this week
                      if (recentScreenerDays >= 2) score -= 1000;
                      
                      // Check if screened yesterday (avoid consecutive days)
                      const yesterday = new Date(currentDate);
                      yesterday.setDate(yesterday.getDate() - 1);
                      const screenedYesterday = history.some(d => 
                        d.toISOString().split('T')[0] === yesterday.toISOString().split('T')[0]
                      );
                      if (screenedYesterday) score -= 500;
                      
                      // Check if analyst is in weekend rotation
                      const rotationPlans = shiftType === 'MORNING' ? 
                        morningRotationPlans : eveningRotationPlans;
                      
                      const isInRotation = rotationPlans.some(plan => 
                        plan.analystId === analyst.id && 
                        plan.startDate && plan.endDate &&
                        currentDate >= plan.startDate && currentDate <= plan.endDate
                      );
                      
                      // Penalize analysts in weekend rotation
                      if (isInRotation) {
                        // Check how many screener days they already have this week
                        const weekStartDate = new Date(currentDate);
                        weekStartDate.setDate(weekStartDate.getDate() - weekStartDate.getDay());
                        
                        const weekScreenerDays = history.filter(d => {
                          return d >= weekStartDate && d <= currentDate;
                        }).length;
                        
                        // If they already have one screener day this week, heavily penalize
                        if (weekScreenerDays >= 1) {
                          score -= 2000; // Make them very unlikely to be chosen
                        } else {
                          score -= 200; // Small penalty for first screener day
                        }
                      }
                      
                      // Prefer skilled analysts
                      if (analyst.skills?.includes('screener-training')) score += 100;
                      
                      // Add some rotation fairness
                      score -= history.length * 10;
                      
                      return { analyst, score };
                    });
                    
                    // Sort by score (highest first)
                    analystScores.sort((a, b) => b.score - a.score);
                    const selectedScreener = analystScores[0].analyst;

                    const screenerSchedule = this.createScreenerSchedule(selectedScreener, currentDate, shiftType, existingSchedules, result.overwrites);
                    if (screenerSchedule) {
                      result.proposedSchedules.push(screenerSchedule);
                      
                      // Update history
                      const history = screenerAssignmentHistory.get(selectedScreener.id) || [];
                      history.push(new Date(currentDate));
                      screenerAssignmentHistory.set(selectedScreener.id, history);
                    }
                }
            }
          };
      
          assignScreener(morningAnalysts, 'MORNING');
          assignScreener(eveningAnalysts, 'EVENING');
      
          screenerIndex++;
          currentDate.setDate(currentDate.getDate() + 1);
        }
      
        return result;
    }

    private createScreenerSchedule(
        analyst: any,
        date: Date,
        shiftType: string,
        existingSchedules: any[],
        overwrites: any[]
    ) {
        const dateStr = date.toISOString().split('T')[0];
      
        const scheduleData = {
            date: dateStr,
            analystId: analyst.id,
            analystName: analyst.name,
            shiftType,
            isScreener: true,
        };
    
        const existingSchedule = existingSchedules.find(s => (s as any).analystId === analyst.id && new Date((s as any).date).toISOString().split('T')[0] === dateStr);
    
        if (existingSchedule) {
          if (!(existingSchedule as any).isScreener) {
            overwrites.push({
                date: dateStr,
                analystId: analyst.id,
                analystName: analyst.name,
                from: { shiftType: (existingSchedule as any).shiftType, isScreener: false },
                to: { shiftType, isScreener: true }
            });
            return { ...scheduleData, type: 'OVERWRITE_SCHEDULE' };
          }
          return null;
        }
      
        return { ...scheduleData, type: 'NEW_SCHEDULE' };
    }

    private generateConflicts(schedules: any[], context: SchedulingContext): any[] {
        const conflicts: any[] = [];
        
        // Check for insufficient staff
        const dailyCoverage = new Map<string, { morning: number; evening: number; weekend: number }>();
        
        for (const schedule of schedules) {
            const date = schedule.date;
            if (!dailyCoverage.has(date)) {
                dailyCoverage.set(date, { morning: 0, evening: 0, weekend: 0 });
            }
            
            const coverage = dailyCoverage.get(date)!;
            if (schedule.shiftType === 'MORNING') {
                coverage.morning++;
            } else if (schedule.shiftType === 'EVENING') {
                coverage.evening++;
            }
            
            // Check if this is a weekend day
            const scheduleDate = new Date(date);
            if (scheduleDate.getDay() === 0 || scheduleDate.getDay() === 6) {
                coverage.weekend++;
            }
        }
        
        // Check for coverage issues
        for (const [date, coverage] of dailyCoverage) {
            const scheduleDate = new Date(date);
            const isWeekend = scheduleDate.getDay() === 0 || scheduleDate.getDay() === 6;
            
            // Check basic coverage
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
            
            // Check weekend rotation requirements (FR-2.4) - CRITICAL VALIDATION
            if (isWeekend) {
                if (coverage.morning === 0) {
                    conflicts.push({
                        date,
                        type: 'MISSING_WEEKEND_COVERAGE',
                        description: `CRITICAL: No morning analyst assigned for weekend ${date} (FR-2.4 violation)`,
                        severity: 'CRITICAL',
                        suggestedResolution: 'Assign exactly one morning analyst for weekend coverage'
                    });
                } else if (coverage.morning > 1) {
                    conflicts.push({
                        date,
                        type: 'INVALID_WEEKEND_ROTATION',
                        description: `HIGH: Multiple morning analysts assigned for weekend ${date} (${coverage.morning} analysts) - should be exactly one (FR-2.4 violation)`,
                        severity: 'HIGH',
                        suggestedResolution: 'Ensure only one morning analyst works weekends'
                    });
                }
                
                if (coverage.evening === 0) {
                    conflicts.push({
                        date,
                        type: 'MISSING_WEEKEND_COVERAGE',
                        description: `CRITICAL: No evening analyst assigned for weekend ${date} (FR-2.4 violation)`,
                        severity: 'CRITICAL',
                        suggestedResolution: 'Assign exactly one evening analyst for weekend coverage'
                    });
                } else if (coverage.evening > 1) {
                    conflicts.push({
                        date,
                        type: 'INVALID_WEEKEND_ROTATION',
                        description: `HIGH: Multiple evening analysts assigned for weekend ${date} (${coverage.evening} analysts) - should be exactly one (FR-2.4 violation)`,
                        severity: 'HIGH',
                        suggestedResolution: 'Ensure only one evening analyst works weekends'
                    });
                }
                
                // Additional validation: ensure weekend coverage is exactly 1 per shift type
                if (coverage.morning === 1 && coverage.evening === 1) {
                    // This is perfect - log for debugging
                    console.log(`✅ Weekend ${date}: Perfect coverage (1 morning, 1 evening)`);
                }
            }
        }
        
        // Check weekend rotation fairness
        const weekendFairnessConflicts = this.checkWeekendRotationFairness(schedules, context.analysts);
        conflicts.push(...weekendFairnessConflicts);
        
        return conflicts;
    }

    /**
     * Check weekend rotation fairness to ensure all analysts get fair weekend assignments
     */
    private checkWeekendRotationFairness(schedules: any[], analysts: any[]): any[] {
        const conflicts: any[] = [];
        
        // Count weekend assignments per analyst
        const weekendAssignments = new Map<string, number>();
        analysts.forEach(analyst => {
            const weekendCount = schedules.filter(s => {
                const scheduleDate = new Date(s.date);
                const isWeekend = scheduleDate.getDay() === 0 || scheduleDate.getDay() === 6;
                return s.analystId === analyst.id && isWeekend;
            }).length;
            weekendAssignments.set(analyst.id, weekendCount);
        });
        
        const weekendCounts = Array.from(weekendAssignments.values());
        if (weekendCounts.length === 0) return conflicts;
        
        const maxWeekends = Math.max(...weekendCounts);
        const minWeekends = Math.min(...weekendCounts);
        const averageWeekends = weekendCounts.reduce((a, b) => a + b, 0) / weekendCounts.length;
        
        // Check for unfair distribution (more than 2 weekends difference)
        if (maxWeekends - minWeekends > 2) {
            conflicts.push({
                date: 'MULTIPLE_DATES',
                type: 'UNFAIR_WEEKEND_DISTRIBUTION',
                description: `Unfair weekend distribution: some analysts have ${maxWeekends} weekends while others have ${minWeekends} (difference: ${maxWeekends - minWeekends})`,
                severity: 'MEDIUM',
                suggestedResolution: 'Adjust weekend rotation to ensure fair distribution among all analysts'
            });
        }
        
        return conflicts;
    }

    private generateOverwrites(schedules: any[], existingSchedules: any[]): any[] {
        const overwrites: any[] = [];
        
        for (const schedule of schedules) {
            const existing = existingSchedules.find(s => 
                s.analystId === schedule.analystId && 
                new Date(s.date).toISOString().split('T')[0] === schedule.date
            );
            
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

export default new WeekendRotationAlgorithm(); 