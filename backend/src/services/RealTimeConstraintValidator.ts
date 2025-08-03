import { SchedulingConstraint, Analyst, Schedule } from '../../generated/prisma';
import { prisma } from '../lib/prisma';
import { constraintImpactSimulator, ConstraintChange } from './ConstraintImpactSimulator';

export interface ValidationRequest {
  constraint: Partial<SchedulingConstraint>;
  operation: 'CREATE' | 'UPDATE' | 'DELETE';
  originalConstraint?: SchedulingConstraint;
}

export interface ValidationResult {
  isValid: boolean;
  warnings: ValidationWarning[];
  errors: ValidationError[];
  suggestions: string[];
  estimatedImpact: {
    severity: 'LOW' | 'MEDIUM' | 'HIGH';
    affectedDays: number;
    affectedSchedules: number;
    conflictProbability: number;
  };
  responseTime: number;
}

export interface ValidationWarning {
  type: 'OVERLAP' | 'FAIRNESS' | 'COVERAGE' | 'OPTIMIZATION';
  message: string;
  details?: any;
}

export interface ValidationError {
  type: 'CONFLICT' | 'INVALID_DATE' | 'INVALID_ANALYST' | 'LOGIC_ERROR';
  message: string;
  field?: string;
  details?: any;
}

export class RealTimeConstraintValidator {
  private cache: Map<string, any> = new Map();
  private cacheTimeout = 30000; // 30 seconds

  /**
   * Validate constraint with real-time feedback (<500ms target)
   */
  async validateConstraint(request: ValidationRequest): Promise<ValidationResult> {
    const startTime = Date.now();
    
    try {
      // Quick validation checks
      const basicValidation = this.performBasicValidation(request.constraint);
      if (!basicValidation.isValid) {
        return {
          isValid: false,
          warnings: [],
          errors: basicValidation.errors,
          suggestions: basicValidation.suggestions,
          estimatedImpact: {
            severity: 'LOW',
            affectedDays: 0,
            affectedSchedules: 0,
            conflictProbability: 0
          },
          responseTime: Date.now() - startTime
        };
      }

      // Check cache for similar validations
      const cacheKey = this.generateCacheKey(request);
      const cached = this.getFromCache(cacheKey);
      if (cached) {
        return {
          ...cached,
          responseTime: Date.now() - startTime
        };
      }

      // Parallel validation checks
      const [
        conflictValidation,
        overlapValidation,
        impactEstimation
      ] = await Promise.all([
        this.validateConflicts(request),
        this.validateOverlaps(request),
        this.estimateImpact(request)
      ]);

      // Combine results
      const result: ValidationResult = {
        isValid: conflictValidation.isValid && overlapValidation.isValid,
        warnings: [...overlapValidation.warnings],
        errors: [...conflictValidation.errors],
        suggestions: [
          ...conflictValidation.suggestions,
          ...overlapValidation.suggestions,
          ...impactEstimation.suggestions
        ],
        estimatedImpact: impactEstimation.impact,
        responseTime: Date.now() - startTime
      };

      // Cache result for future use
      this.setCache(cacheKey, result);

      return result;
    } catch (error) {
      console.error('Error in real-time validation:', error);
      return {
        isValid: false,
        warnings: [],
        errors: [{
          type: 'LOGIC_ERROR',
          message: 'Validation service temporarily unavailable'
        }],
        suggestions: ['Please try again in a moment'],
        estimatedImpact: {
          severity: 'LOW',
          affectedDays: 0,
          affectedSchedules: 0,
          conflictProbability: 0
        },
        responseTime: Date.now() - startTime
      };
    }
  }

  /**
   * Perform basic validation checks (date format, required fields, etc.)
   */
  private performBasicValidation(constraint: Partial<SchedulingConstraint>): {
    isValid: boolean;
    errors: ValidationError[];
    suggestions: string[];
  } {
    const errors: ValidationError[] = [];
    const suggestions: string[] = [];

    // Required fields validation
    if (!constraint.constraintType) {
      errors.push({
        type: 'INVALID_DATE',
        message: 'Constraint type is required',
        field: 'constraintType'
      });
    }

    if (!constraint.startDate) {
      errors.push({
        type: 'INVALID_DATE',
        message: 'Start date is required',
        field: 'startDate'
      });
    }

    if (!constraint.endDate) {
      errors.push({
        type: 'INVALID_DATE',
        message: 'End date is required',
        field: 'endDate'
      });
    }

    // Date logic validation
    if (constraint.startDate && constraint.endDate) {
      const startDate = new Date(constraint.startDate);
      const endDate = new Date(constraint.endDate);

      if (isNaN(startDate.getTime())) {
        errors.push({
          type: 'INVALID_DATE',
          message: 'Invalid start date format',
          field: 'startDate'
        });
      }

      if (isNaN(endDate.getTime())) {
        errors.push({
          type: 'INVALID_DATE',
          message: 'Invalid end date format',
          field: 'endDate'
        });
      }

      if (startDate.getTime() > endDate.getTime()) {
        errors.push({
          type: 'INVALID_DATE',
          message: 'Start date must be before end date',
          field: 'dateRange'
        });
      }

      // Warn about very long constraints
      const daysDiff = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
      if (daysDiff > 90) {
        suggestions.push('Consider breaking long constraints into smaller periods for better flexibility');
      }
    }

    // Past date validation
    if (constraint.endDate && new Date(constraint.endDate) < new Date()) {
      suggestions.push('Constraint end date is in the past - consider updating the date range');
    }

    return {
      isValid: errors.length === 0,
      errors,
      suggestions
    };
  }

  /**
   * Validate for conflicts with existing schedules
   */
  private async validateConflicts(request: ValidationRequest): Promise<{
    isValid: boolean;
    errors: ValidationError[];
    suggestions: string[];
  }> {
    const { constraint } = request;
    const errors: ValidationError[] = [];
    const suggestions: string[] = [];

    if (!constraint.startDate || !constraint.endDate) {
      return { isValid: true, errors, suggestions };
    }

    try {
      // Get existing schedules in the constraint date range
      const existingSchedules = await prisma.schedule.findMany({
        where: {
          date: {
            gte: new Date(constraint.startDate),
            lte: new Date(constraint.endDate)
          },
          ...(constraint.analystId && { analystId: constraint.analystId })
        },
        include: {
          analyst: true
        }
      });

      // Check for specific constraint type conflicts
      switch (constraint.constraintType) {
        case 'BLACKOUT_DATE':
          if (existingSchedules.length > 0) {
            errors.push({
              type: 'CONFLICT',
              message: `Blackout conflicts with ${existingSchedules.length} existing schedules`,
              details: {
                conflictingSchedules: existingSchedules.length,
                analystNames: [...new Set(existingSchedules.map(s => s.analyst.name))]
              }
            });
            suggestions.push('Consider rescheduling conflicting assignments or adjusting the blackout period');
          }
          break;

        case 'UNAVAILABLE_SCREENER':
          const screenerConflicts = existingSchedules.filter(s => s.isScreener);
          if (screenerConflicts.length > 0) {
            errors.push({
              type: 'CONFLICT',
              message: `Screener unavailability conflicts with ${screenerConflicts.length} screener assignments`,
              details: {
                conflictingSchedules: screenerConflicts.length
              }
            });
            suggestions.push('Reassign screener duties before applying this constraint');
          }
          break;

        case 'MAX_SCREENER_DAYS':
        case 'MIN_SCREENER_DAYS':
          // For these constraints, we provide warnings rather than hard errors
          const currentScreenerDays = existingSchedules.filter(s => s.isScreener).length;
          if (constraint.constraintType === 'MAX_SCREENER_DAYS' && currentScreenerDays > 0) {
            suggestions.push(`Analyst currently has ${currentScreenerDays} screener days in this period`);
          }
          break;
      }

    } catch (error) {
      console.error('Error validating conflicts:', error);
      suggestions.push('Unable to fully validate conflicts - please verify manually');
    }

    return {
      isValid: errors.length === 0,
      errors,
      suggestions
    };
  }

  /**
   * Validate for overlaps with other constraints
   */
  private async validateOverlaps(request: ValidationRequest): Promise<{
    isValid: boolean;
    warnings: ValidationWarning[];
    suggestions: string[];
  }> {
    const { constraint } = request;
    const warnings: ValidationWarning[] = [];
    const suggestions: string[] = [];

    if (!constraint.startDate || !constraint.endDate) {
      return { isValid: true, warnings, suggestions };
    }

    try {
      // Find overlapping constraints
      const overlappingConstraints = await prisma.schedulingConstraint.findMany({
        where: {
          isActive: true,
          ...(constraint.analystId && { analystId: constraint.analystId }),
          OR: [
            {
              startDate: { lte: new Date(constraint.endDate!) },
              endDate: { gte: new Date(constraint.startDate!) }
            }
          ],
          ...(request.operation === 'UPDATE' && constraint.id && {
            NOT: { id: constraint.id }
          })
        },
        include: {
          analyst: true
        }
      });

      if (overlappingConstraints.length > 0) {
        // Check for conflicting constraint types
        const conflictingTypes = overlappingConstraints.filter(existing => {
          return this.areConstraintTypesConflicting(constraint.constraintType!, existing.constraintType);
        });

        if (conflictingTypes.length > 0) {
          warnings.push({
            type: 'OVERLAP',
            message: `Overlaps with ${conflictingTypes.length} existing constraints`,
            details: {
              overlappingConstraints: conflictingTypes.map(c => ({
                type: c.constraintType,
                startDate: c.startDate,
                endDate: c.endDate,
                analyst: c.analyst?.name
              }))
            }
          });
          suggestions.push('Review overlapping constraints for potential conflicts');
        }

        // Check for redundant constraints
        const redundantConstraints = overlappingConstraints.filter(existing => 
          existing.constraintType === constraint.constraintType
        );

        if (redundantConstraints.length > 0) {
          warnings.push({
            type: 'OPTIMIZATION',
            message: `Similar constraint already exists for this period`,
            details: {
              redundantConstraints: redundantConstraints.length
            }
          });
          suggestions.push('Consider merging or adjusting constraint periods to avoid redundancy');
        }
      }

    } catch (error) {
      console.error('Error validating overlaps:', error);
      suggestions.push('Unable to fully validate overlaps - please review manually');
    }

    return {
      isValid: true, // Overlaps are warnings, not errors
      warnings,
      suggestions
    };
  }

  /**
   * Estimate impact using the constraint impact simulator
   */
  private async estimateImpact(request: ValidationRequest): Promise<{
    impact: ValidationResult['estimatedImpact'];
    suggestions: string[];
  }> {
    try {
      const constraintChange: ConstraintChange = {
        type: request.operation,
        constraint: request.constraint,
        originalConstraint: request.originalConstraint
      };

      const preview = await constraintImpactSimulator.getQuickImpactPreview(constraintChange);

      return {
        impact: {
          severity: preview.estimatedImpact,
          affectedDays: preview.affectedDaysCount,
          affectedSchedules: preview.estimatedConflicts,
          conflictProbability: this.calculateConflictProbability(preview)
        },
        suggestions: preview.estimatedImpact === 'HIGH' ? 
          ['High impact detected - consider reviewing affected schedules'] : []
      };
    } catch (error) {
      console.error('Error estimating impact:', error);
      return {
        impact: {
          severity: 'LOW',
          affectedDays: 0,
          affectedSchedules: 0,
          conflictProbability: 0
        },
        suggestions: []
      };
    }
  }

  /**
   * Check if two constraint types are conflicting
   */
  private areConstraintTypesConflicting(type1: string, type2: string): boolean {
    const conflictMatrix: Record<string, string[]> = {
      'BLACKOUT_DATE': ['PREFERRED_SCREENER'],
      'UNAVAILABLE_SCREENER': ['PREFERRED_SCREENER'],
      'PREFERRED_SCREENER': ['BLACKOUT_DATE', 'UNAVAILABLE_SCREENER'],
      'MAX_SCREENER_DAYS': ['MIN_SCREENER_DAYS'],
      'MIN_SCREENER_DAYS': ['MAX_SCREENER_DAYS']
    };

    return conflictMatrix[type1]?.includes(type2) || false;
  }

  /**
   * Calculate conflict probability based on preview data
   */
  private calculateConflictProbability(preview: any): number {
    let probability = 0;

    // Base probability on estimated conflicts
    if (preview.estimatedConflicts > 0) {
      probability += Math.min(preview.estimatedConflicts * 0.2, 0.8);
    }

    // Factor in impact level
    switch (preview.estimatedImpact) {
      case 'HIGH':
        probability += 0.3;
        break;
      case 'MEDIUM':
        probability += 0.2;
        break;
      case 'LOW':
        probability += 0.1;
        break;
    }

    return Math.min(probability, 1.0);
  }

  /**
   * Cache management
   */
  private generateCacheKey(request: ValidationRequest): string {
    const { constraint } = request;
    return `${request.operation}-${constraint.constraintType}-${constraint.analystId || 'global'}-${constraint.startDate}-${constraint.endDate}`;
  }

  private getFromCache(key: string): any {
    const cached = this.cache.get(key);
    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      return cached.data;
    }
    this.cache.delete(key);
    return null;
  }

  private setCache(key: string, data: any): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now()
    });

    // Clean up old cache entries
    if (this.cache.size > 100) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey !== undefined) {
        this.cache.delete(oldestKey);
      }
    }
  }
}

export const realTimeConstraintValidator = new RealTimeConstraintValidator();