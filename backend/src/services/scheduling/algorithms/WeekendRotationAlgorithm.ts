import { SchedulingAlgorithm, SchedulingContext, SchedulingResult, DEFAULT_ALGORITHM_CONFIG, AlgorithmConfiguration } from './types';
import { Analyst, Schedule, SchedulingConstraint } from '../../../../generated/prisma';
import { fairnessEngine } from './FairnessEngine';
import { constraintEngine } from './ConstraintEngine';
import { optimizationEngine } from './OptimizationEngine';
import { screenerSelectionEngine } from '../../ScreenerSelectionEngine';
import { constraintHierarchy } from '../../ConstraintHierarchy';
import { weekendRotationEngine } from '../../WeekendRotationEngine';
import { tracingService } from '../../TracingService';
import { algorithmAuditService } from '../../AlgorithmAuditService';
import { reliabilityService } from '../../ReliabilityService';

class WeekendRotationAlgorithm implements SchedulingAlgorithm {
    name = 'WeekendRotationAlgorithm';
    description = 'Advanced weekend rotation algorithm with fairness optimization and constraint satisfaction';
    version = '2.0.0';
    supportedFeatures = [
        'Fairness Optimization',
        'Constraint Validation',
        'Multiple Optimization Strategies',
        'Workload Balancing',
        'Screener Assignment Optimization',
        'Weekend Rotation Fairness'
    ];

    async generateSchedules(context: SchedulingContext): Promise<SchedulingResult> {
        const startTime = Date.now();
        const originalConfig = context.algorithmConfig || DEFAULT_ALGORITHM_CONFIG;
        
        // Start audit session
        const auditSessionId = await algorithmAuditService.startAuditSession(
            this.name,
            this.version,
            originalConfig,
            {
                startDate: context.startDate,
                endDate: context.endDate,
                analystCount: context.analysts.length
            }
        );

        tracingService.startTiming('schedule_generation');
        tracingService.logSummary('algorithm_start', {
            success: true,
            summary: `${this.name} v${this.version} started with reliability scoring`,
            metrics: { analysts: context.analysts.length }
        });

        // Reliability scoring: Attempt schedule generation with fallback strategies
        let fallbacksUsed = 0;
        let bestResult: SchedulingResult | null = null;
        let bestConfidence: any = null;
        let currentConfig = originalConfig;

        while (fallbacksUsed <= 3) { // Max 4 attempts (primary + 3 fallbacks)
            try {
                tracingService.logStrategy('algorithm_attempt', `Attempt ${fallbacksUsed + 1}`, {
                    strategy: currentConfig.optimizationStrategy,
                    fallbacksUsed,
                    maxIterations: currentConfig.maxIterations
                });

                const result = await this.attemptScheduleGeneration(context, currentConfig, auditSessionId, fallbacksUsed);
                
                // Calculate confidence score for this attempt
                const confidenceScore = reliabilityService.calculateConfidenceScore(result, {
                    algorithmConfig: currentConfig,
                    executionTime: Date.now() - startTime,
                    fallbacksUsed,
                    optimizationIterations: result.performanceMetrics?.optimizationIterations || 0,
                    inputDataQuality: this.assessInputDataQuality(context)
                });

                tracingService.logSummary('confidence_assessment', {
                    success: true,
                    summary: `Confidence: ${confidenceScore.overall}% | Quality: ${confidenceScore.qualityGate} | Risk: ${confidenceScore.riskLevel}`,
                    metrics: {
                        confidence: confidenceScore.overall
                    }
                });

                // Store best result so far
                if (!bestResult || confidenceScore.overall > (bestConfidence?.overall || 0)) {
                    bestResult = { ...result, confidenceScore };
                    bestConfidence = confidenceScore;
                }

                // Check if result meets quality gates
                if (confidenceScore.qualityGate === 'PASS') {
                    tracingService.logSummary('quality_gate_passed', {
                        success: true,
                        summary: `Schedule accepted with ${confidenceScore.overall}% confidence`,
                        metrics: { 
                            confidence: confidenceScore.overall,
                            fallbacksUsed,
                            attemptNumber: fallbacksUsed + 1
                        }
                    });
                    break; // Accept this result
                }

                // Try fallback strategy if current result isn't good enough
                const fallbackStrategy = reliabilityService.getNextFallbackStrategy(fallbacksUsed);
                if (!fallbackStrategy) {
                    tracingService.logSummary('fallback_exhausted', {
                        success: false,
                        summary: `All fallback strategies exhausted. Best confidence: ${bestConfidence?.overall || 0}%`,
                        metrics: { 
                            bestConfidence: bestConfidence?.overall || 0,
                            totalAttempts: fallbacksUsed + 1
                        }
                    });
                    break; // No more fallbacks available
                }

                // Prepare fallback configuration
                currentConfig = reliabilityService.createFallbackConfiguration(originalConfig, fallbackStrategy);
                fallbacksUsed++;

                tracingService.logStrategy('fallback_strategy', fallbackStrategy.name, {
                    previousConfidence: confidenceScore.overall,
                    newStrategy: fallbackStrategy.optimizationStrategy,
                    fallbackNumber: fallbacksUsed
                });

            } catch (error) {
                tracingService.logSummary('algorithm_attempt_failed', {
                    success: false,
                    summary: `Attempt ${fallbacksUsed + 1} failed: ${error}`,
                    metrics: { fallbacksUsed }
                });

                // Try fallback on error
                const fallbackStrategy = reliabilityService.getNextFallbackStrategy(fallbacksUsed);
                if (!fallbackStrategy) break;
                
                currentConfig = reliabilityService.createFallbackConfiguration(originalConfig, fallbackStrategy);
                fallbacksUsed++;
            }
        }

        // Use best result found (should not be null, but handle gracefully)
        if (!bestResult) {
            throw new Error('Failed to generate any valid schedule with all available strategies');
        }

        // Complete audit session with reliability metrics
        const executionTime = Date.now() - startTime;
        await algorithmAuditService.completeAuditSession(auditSessionId, {
            schedulesGenerated: bestResult.proposedSchedules.length,
            conflictsFound: bestResult.conflicts.length,
            overwrites: bestResult.overwrites.length,
            fairnessScore: bestResult.fairnessMetrics.overallFairnessScore,
            constraintScore: bestResult.constraintValidation?.score || 0,
            efficiencyScore: (bestResult.proposedSchedules.length > 0 ? 1.0 : 0.0),
            overallScore: bestResult.confidenceScore?.overall || 0,
            success: true
        });

        const tracingDuration = tracingService.endTiming('schedule_generation', 'schedule_generation');
        tracingService.logSummary('algorithm_complete_with_reliability', {
            success: true,
            duration: executionTime,
            summary: `${this.name} completed with ${bestResult.confidenceScore?.overall || 0}% confidence (${bestResult.confidenceScore?.qualityGate || 'UNKNOWN'})`,
            metrics: {
                confidence: bestResult.confidenceScore?.overall || 0,
                fallbacksUsed,
                fairnessScore: parseFloat(bestResult.fairnessMetrics.overallFairnessScore.toFixed(4)),
                schedulesGenerated: bestResult.proposedSchedules.length,
                conflictsFound: bestResult.conflicts.length
            }
        });

        return bestResult;
    }

    /**
     * Attempt schedule generation with a specific configuration
     */
    private async attemptScheduleGeneration(
        context: SchedulingContext,
        config: AlgorithmConfiguration,
        auditSessionId: string,
        attemptNumber: number
    ): Promise<SchedulingResult> {
        
        // Update context with current config
        const updatedContext = { ...context, algorithmConfig: config };
        
        // Generate initial schedules
        const initialSchedules = await this.generateInitialSchedules(updatedContext, auditSessionId);
        
        // Validate constraints
        const constraintValidation = constraintEngine.validateConstraints(initialSchedules, context.globalConstraints);
        
        // Calculate initial fairness metrics
        const fairnessMetrics = fairnessEngine.calculateFairness(initialSchedules, context.analysts);
        
        // Optimize schedules if needed
        let optimizedSchedules = initialSchedules;
        if (config.optimizationStrategy !== 'GREEDY' || fairnessMetrics.overallFairnessScore < 0.7) {
            tracingService.logStrategy('schedule_optimization', config.optimizationStrategy, {
                fairnessWeight: config.fairnessWeight,
                efficiencyWeight: config.efficiencyWeight,
                constraintWeight: config.constraintWeight,
                attemptNumber
            });
            optimizedSchedules = await optimizationEngine.optimizeSchedules(initialSchedules, updatedContext);
        }

        // Recalculate metrics after optimization
        const finalFairnessMetrics = fairnessEngine.calculateFairness(optimizedSchedules, context.analysts);
        const finalConstraintValidation = constraintEngine.validateConstraints(optimizedSchedules, context.globalConstraints);
        
        // Generate conflicts and overwrites
        const conflicts = this.generateConflicts(optimizedSchedules, context);
        const overwrites = this.generateOverwrites(optimizedSchedules, context.existingSchedules);
        
        // Calculate performance metrics
        const performanceMetrics = {
            totalQueries: 0, // Will be updated by Prisma client
            averageQueryTime: 0,
            slowQueries: 0,
            cacheHitRate: 0,
            algorithmExecutionTime: 0, // Will be set by caller
            memoryUsage: process.memoryUsage().heapUsed / 1024 / 1024, // MB
            optimizationIterations: 100 // Estimated - will be updated by optimization engine
        };

        return {
            proposedSchedules: optimizedSchedules,
            conflicts,
            overwrites,
            fairnessMetrics: finalFairnessMetrics,
            constraintValidation: finalConstraintValidation,
            performanceMetrics
        };
    }

    /**
     * Assess the quality of input data for confidence scoring
     */
    private assessInputDataQuality(context: SchedulingContext): number {
        let quality = 1.0;

        // Check analyst data completeness
        const analystsWithMissingData = context.analysts.filter(a => 
            !a.shiftType || !a.isActive || !a.experienceLevel || !a.employeeType
        );
        if (analystsWithMissingData.length > 0) {
            quality -= (analystsWithMissingData.length / context.analysts.length) * 0.3;
        }

        // Check date range validity
        const daySpan = Math.ceil((context.endDate.getTime() - context.startDate.getTime()) / (1000 * 60 * 60 * 24));
        if (daySpan < 1 || daySpan > 365) {
            quality -= 0.2; // Invalid date range
        }

        // Check constraint validity
        const invalidConstraints = context.globalConstraints?.filter(c => 
            !c.constraintType || !c.analystId
        ) || [];
        if (invalidConstraints.length > 0) {
            quality -= (invalidConstraints.length / (context.globalConstraints?.length || 1)) * 0.2;
        }

        // Check for sufficient analyst coverage
        if (context.analysts.length < 2) {
            quality -= 0.3; // Need at least 2 analysts for rotation
        }

        return Math.max(0.0, Math.min(1.0, quality));
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

    private async generateInitialSchedules(context: SchedulingContext, auditSessionId?: string): Promise<any[]> {
        const { startDate, endDate, analysts, existingSchedules, globalConstraints } = context;

        const regularSchedulesResult = await this.generateRegularWorkSchedules(startDate, endDate, analysts, existingSchedules, globalConstraints, context.algorithmConfig);
    
        const allProposedSchedules = [...regularSchedulesResult.proposedSchedules];
        const allConflicts = [...regularSchedulesResult.conflicts];
        const allOverwrites = [...regularSchedulesResult.overwrites];
      
        const screenerSchedulesResult = await this.generateScreenerSchedules(
          startDate,
          endDate,
          analysts,
          existingSchedules,
          globalConstraints,
          allProposedSchedules,
          context.algorithmConfig,
          auditSessionId
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
        globalConstraints: any[],
        config?: any
      ) {
        const result = {
          proposedSchedules: [] as any[],
          conflicts: [] as any[],
          overwrites: [] as any[]
        };

        const algorithmConfig = config || DEFAULT_ALGORITHM_CONFIG;
        
        const morningAnalysts = analysts.filter(a => a.shiftType === 'MORNING');
        const eveningAnalysts = analysts.filter(a => a.shiftType === 'EVENING');
      
        // Create context for weekend rotation engine
        const rotationContext = {
          analysts: [...morningAnalysts, ...eveningAnalysts],
          startDate,
          endDate,
          existingSchedules,
          constraints: globalConstraints
        };

        // Use WeekendRotationEngine to get initial pattern assignments
        let morningPatterns = await weekendRotationEngine.applyWeekendRotation(
          morningAnalysts,
          algorithmConfig.weekendRotationStrategy,
          rotationContext,
          algorithmConfig
        );

        let eveningPatterns = await weekendRotationEngine.applyWeekendRotation(
          eveningAnalysts,
          algorithmConfig.weekendRotationStrategy,
          rotationContext,
          algorithmConfig
        );
      
        const loopEndDate = new Date(endDate);
        const currentDate = this.getWeekStart(new Date(startDate));
      
        tracingService.logStrategy('weekend_rotation', algorithmConfig.weekendRotationStrategy, {
            screenerStrategy: algorithmConfig.screenerAssignmentStrategy,
            randomizationFactor: algorithmConfig.randomizationFactor
        });

        while (currentDate <= loopEndDate) {
          const weekStart = new Date(currentDate);
          const weekEnd = new Date(weekStart);
          weekEnd.setDate(weekEnd.getDate() + 6);
          
          const effectiveWeekStart = new Date(Math.max(weekStart.getTime(), startDate.getTime()));
          const effectiveWeekEnd = new Date(Math.min(weekEnd.getTime(), endDate.getTime()));
      
          if (effectiveWeekStart <= effectiveWeekEnd) {
            const weekSchedules = this.generateWeekSchedules(
              effectiveWeekStart, 
              effectiveWeekEnd, 
              morningPatterns, 
              eveningPatterns, 
              existingSchedules, 
              globalConstraints, 
              result.overwrites
            );
            result.proposedSchedules.push(...weekSchedules.proposedSchedules);
            result.conflicts.push(...weekSchedules.conflicts);
          }
      
          // Use WeekendRotationEngine to rotate patterns based on strategy
          morningPatterns = await weekendRotationEngine.rotatePatterns(
            morningPatterns,
            algorithmConfig.weekendRotationStrategy,
            {
              ...rotationContext,
              startDate: new Date(currentDate.getTime() + 7 * 24 * 60 * 60 * 1000) // Next week
            },
            algorithmConfig
          );

          eveningPatterns = await weekendRotationEngine.rotatePatterns(
            eveningPatterns,
            algorithmConfig.weekendRotationStrategy,
            {
              ...rotationContext,
              startDate: new Date(currentDate.getTime() + 7 * 24 * 60 * 60 * 1000) // Next week
            },
            algorithmConfig
          );
          
          currentDate.setDate(currentDate.getDate() + 7);
        }
      
        return result;
      }

      private assignAnalystsToPatterns(analysts: any[], patterns: any[]) {
        const assignments: { [key: string]: { pattern: any; analysts: any[] } } = {};
        patterns.forEach(p => {
          assignments[p.name] = { pattern: p, analysts: [] };
        });
      
        analysts.forEach((analyst, index) => {
          const patternName = patterns[index % patterns.length].name;
          assignments[patternName].analysts.push(analyst);
        });
      
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
        for (const patternName in patternAssignments) {
          const assignment = patternAssignments[patternName];
          if (assignment.pattern.days.includes(dayOfWeek)) {
            workingAnalysts.push(...assignment.analysts);
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
        regularSchedules: any[],
        config?: any,
        auditSessionId?: string
    ) {
        const result = {
          proposedSchedules: [] as any[],
          conflicts: [] as any[],
          overwrites: [] as any[]
        };
      
        const algorithmConfig = config || DEFAULT_ALGORITHM_CONFIG;
        const currentDate = new Date(startDate);
      
        while (currentDate <= endDate) {
          const dateStr = currentDate.toISOString().split('T')[0];
          const dayOfWeek = currentDate.getDay();
      
          // Skip weekends (screeners only work weekdays)
          if (dayOfWeek === 0 || dayOfWeek === 6) {
            currentDate.setDate(currentDate.getDate() + 1);
            continue;
          }
      
          // Check for blackout constraints
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
      
          // Get analysts working regular shifts on this date
          const workingAnalysts = regularSchedules
            .filter(s => s.date === dateStr && !s.isScreener)
            .map(s => analysts.find(a => a.id === s.analystId))
            .filter(Boolean);
      
          const morningAnalysts = workingAnalysts.filter((a: any) => a.shiftType === 'MORNING');
          const eveningAnalysts = workingAnalysts.filter((a: any) => a.shiftType === 'EVENING');
      
          // Check if this is a major event requiring special coverage
          const eventConstraints = await constraintHierarchy.resolveConstraints({
            date: currentDate,
            isScreenerAssignment: true
          });
          
          const isMajorEvent = eventConstraints.some(c => 
            c.source === 'EVENT' && c.constraint.minimumCoverage
          );

          // Assign screeners using configured strategy
          await this.assignScreenerUsingStrategy(
            morningAnalysts, 
            'MORNING', 
            currentDate, 
            algorithmConfig,
            isMajorEvent,
            existingSchedules,
            result,
            auditSessionId
          );

          await this.assignScreenerUsingStrategy(
            eveningAnalysts, 
            'EVENING', 
            currentDate, 
            algorithmConfig,
            isMajorEvent,
            existingSchedules,
            result,
            auditSessionId
          );
      
          currentDate.setDate(currentDate.getDate() + 1);
        }
      
        return result;
    }

    /**
     * Assign screener using the configured strategy
     */
    private async assignScreenerUsingStrategy(
      eligibleAnalysts: any[],
      shiftType: 'MORNING' | 'EVENING',
      date: Date,
      config: any,
      isMajorEvent: boolean,
      existingSchedules: any[],
      result: any,
      auditSessionId?: string
    ) {
      if (eligibleAnalysts.length === 0) {
        result.conflicts.push({
          date: date.toISOString().split('T')[0],
          type: 'NO_ELIGIBLE_SCREENERS',
          description: `No eligible ${shiftType.toLowerCase()} analysts for screener assignment`,
          severity: 'HIGH'
        });
        return;
      }

      // Filter out analysts on vacation
      const availableAnalysts = eligibleAnalysts.filter(a => 
        !a.vacations?.some((v: any) => 
          new Date(v.startDate) <= date && new Date(v.endDate) >= date
        )
      );

      if (availableAnalysts.length === 0) {
        result.conflicts.push({
          date: date.toISOString().split('T')[0],
          type: 'NO_AVAILABLE_SCREENERS',
          description: `All eligible ${shiftType.toLowerCase()} analysts are on vacation`,
          severity: 'HIGH'
        });
        return;
      }

      try {
        // Use the ScreenerSelectionEngine with configured strategy
        const selectionResult = await screenerSelectionEngine.selectScreener(
          {
            date,
            shiftType,
            eligibleAnalysts: availableAnalysts,
            existingSchedules,
            isMajorEvent
          },
          config.screenerAssignmentStrategy,
          config,
          auditSessionId
        );

        // Create schedule entry for selected screener
        const screenerSchedule = this.createScreenerSchedule(
          selectionResult.selectedAnalyst, 
          date, 
          shiftType, 
          existingSchedules, 
          result.overwrites
        );

        if (screenerSchedule) {
          result.proposedSchedules.push({
            ...screenerSchedule,
            selectionReason: selectionResult.reason,
            selectionScore: selectionResult.selectionScore
          });
        }

      } catch (error) {
        result.conflicts.push({
          date: date.toISOString().split('T')[0],
          type: 'SCREENER_SELECTION_ERROR',
          description: `Failed to assign ${shiftType.toLowerCase()} screener: ${error instanceof Error ? error.message : 'Unknown error'}`,
          severity: 'HIGH'
        });
      }
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
        const dailyCoverage = new Map<string, { morning: number; evening: number }>();
        
        for (const schedule of schedules) {
            const date = schedule.date;
            if (!dailyCoverage.has(date)) {
                dailyCoverage.set(date, { morning: 0, evening: 0 });
            }
            
            const coverage = dailyCoverage.get(date)!;
            if (schedule.shiftType === 'MORNING') {
                coverage.morning++;
            } else if (schedule.shiftType === 'EVENING') {
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