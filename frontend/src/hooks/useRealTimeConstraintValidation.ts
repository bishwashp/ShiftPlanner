import { useState, useEffect, useCallback, useRef } from 'react';
import apiService, { SchedulingConstraint } from '../services/api';

export interface ValidationState {
  isValid: boolean;
  isValidating: boolean;
  warnings: Array<{
    type: 'OVERLAP' | 'FAIRNESS' | 'COVERAGE' | 'OPTIMIZATION';
    message: string;
    details?: any;
  }>;
  errors: Array<{
    type: 'CONFLICT' | 'INVALID_DATE' | 'INVALID_ANALYST' | 'LOGIC_ERROR';
    message: string;
    field?: string;
    details?: any;
  }>;
  suggestions: string[];
  estimatedImpact: {
    severity: 'LOW' | 'MEDIUM' | 'HIGH';
    affectedDays: number;
    affectedSchedules: number;
    conflictProbability: number;
  } | null;
  responseTime: number;
  lastValidated: Date | null;
}

export interface UseRealTimeConstraintValidationOptions {
  debounceMs?: number;
  validateOnMount?: boolean;
  operation?: 'CREATE' | 'UPDATE' | 'DELETE';
  originalConstraint?: SchedulingConstraint;
}

const INITIAL_STATE: ValidationState = {
  isValid: true,
  isValidating: false,
  warnings: [],
  errors: [],
  suggestions: [],
  estimatedImpact: null,
  responseTime: 0,
  lastValidated: null
};

export const useRealTimeConstraintValidation = (
  constraint: Partial<SchedulingConstraint>,
  options: UseRealTimeConstraintValidationOptions = {}
) => {
  const {
    debounceMs = 300,
    validateOnMount = false,
    operation = 'CREATE',
    originalConstraint
  } = options;

  const [validationState, setValidationState] = useState<ValidationState>(INITIAL_STATE);
  const debounceTimeout = useRef<NodeJS.Timeout | null>(null);
  const abortController = useRef<AbortController | null>(null);

  // Validate constraint
  const validateConstraint = useCallback(async (constraintToValidate: Partial<SchedulingConstraint>) => {
    // Cancel any pending validation
    if (abortController.current) {
      abortController.current.abort();
    }

    // Check if constraint has minimum required fields
    if (!constraintToValidate.constraintType || !constraintToValidate.startDate || !constraintToValidate.endDate) {
      setValidationState(INITIAL_STATE);
      return;
    }

    setValidationState(prev => ({
      ...prev,
      isValidating: true
    }));

    // Create new abort controller for this request
    abortController.current = new AbortController();

    try {
      const startTime = Date.now();
      
      const result = await apiService.validateConstraintRealTime({
        constraint: constraintToValidate,
        operation,
        originalConstraint
      });

      // Check if request was aborted
      if (abortController.current.signal.aborted) {
        return;
      }

      setValidationState({
        isValid: result.isValid,
        isValidating: false,
        warnings: result.warnings,
        errors: result.errors,
        suggestions: result.suggestions,
        estimatedImpact: result.estimatedImpact,
        responseTime: Date.now() - startTime,
        lastValidated: new Date()
      });
    } catch (error: any) {
      // Don't update state if request was aborted
      if (error.name === 'AbortError' || abortController.current?.signal.aborted) {
        return;
      }

      console.error('Real-time validation error:', error);
      setValidationState({
        ...INITIAL_STATE,
        isValid: false,
        isValidating: false,
        errors: [{
          type: 'LOGIC_ERROR',
          message: 'Validation service temporarily unavailable'
        }],
        suggestions: ['Please check your input and try again'],
        lastValidated: new Date()
      });
    }
  }, [operation, originalConstraint]);

  // Debounced validation
  const debouncedValidate = useCallback((constraintToValidate: Partial<SchedulingConstraint>) => {
    if (debounceTimeout.current) {
      clearTimeout(debounceTimeout.current);
    }

    debounceTimeout.current = setTimeout(() => {
      validateConstraint(constraintToValidate);
    }, debounceMs);
  }, [validateConstraint, debounceMs]);

  // Trigger validation when constraint changes
  useEffect(() => {
    debouncedValidate(constraint);

    return () => {
      if (debounceTimeout.current) {
        clearTimeout(debounceTimeout.current);
      }
    };
  }, [
    constraint.constraintType,
    constraint.startDate,
    constraint.endDate,
    constraint.analystId,
    constraint.description,
    debouncedValidate
  ]);

  // Validate on mount if requested
  useEffect(() => {
    if (validateOnMount) {
      validateConstraint(constraint);
    }

    return () => {
      if (abortController.current) {
        abortController.current.abort();
      }
    };
  }, [validateOnMount, validateConstraint]);

  // Manual validation trigger (useful for form submission)
  const forceValidate = useCallback(() => {
    if (debounceTimeout.current) {
      clearTimeout(debounceTimeout.current);
    }
    validateConstraint(constraint);
  }, [validateConstraint, constraint]);

  // Clear validation state
  const clearValidation = useCallback(() => {
    if (debounceTimeout.current) {
      clearTimeout(debounceTimeout.current);
    }
    if (abortController.current) {
      abortController.current.abort();
    }
    setValidationState(INITIAL_STATE);
  }, []);

  // Get field-specific errors
  const getFieldErrors = useCallback((field: string) => {
    return validationState.errors.filter(error => error.field === field);
  }, [validationState.errors]);

  // Get impact severity color class
  const getImpactSeverityClass = useCallback(() => {
    if (!validationState.estimatedImpact) return '';
    
    switch (validationState.estimatedImpact.severity) {
      case 'LOW': return 'text-green-600 bg-green-50 border-green-200';
      case 'MEDIUM': return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      case 'HIGH': return 'text-red-600 bg-red-50 border-red-200';
      default: return '';
    }
  }, [validationState.estimatedImpact]);

  // Check if constraint can be safely applied
  const canApplySafely = useCallback(() => {
    return validationState.isValid && 
           validationState.errors.length === 0 && 
           !validationState.isValidating &&
           (!validationState.estimatedImpact || validationState.estimatedImpact.severity !== 'HIGH');
  }, [validationState]);

  // Get validation summary
  const getValidationSummary = useCallback(() => {
    if (validationState.isValidating) {
      return { type: 'loading', message: 'Validating...' };
    }

    if (validationState.errors.length > 0) {
      return { 
        type: 'error', 
        message: `${validationState.errors.length} error(s) found`,
        details: validationState.errors
      };
    }

    if (validationState.warnings.length > 0) {
      return { 
        type: 'warning', 
        message: `${validationState.warnings.length} warning(s)`,
        details: validationState.warnings
      };
    }

    if (validationState.estimatedImpact) {
      const { severity, affectedDays, affectedSchedules } = validationState.estimatedImpact;
      return {
        type: severity.toLowerCase(),
        message: `${severity} impact: ${affectedDays} days, ${affectedSchedules} schedules affected`,
        details: validationState.estimatedImpact
      };
    }

    return { type: 'success', message: 'Constraint is valid' };
  }, [validationState]);

  return {
    validationState,
    forceValidate,
    clearValidation,
    getFieldErrors,
    getImpactSeverityClass,
    canApplySafely,
    getValidationSummary,
    
    // Convenience properties
    isValid: validationState.isValid,
    isValidating: validationState.isValidating,
    hasErrors: validationState.errors.length > 0,
    hasWarnings: validationState.warnings.length > 0,
    errors: validationState.errors,
    warnings: validationState.warnings,
    suggestions: validationState.suggestions,
    estimatedImpact: validationState.estimatedImpact,
    responseTime: validationState.responseTime
  };
};

export default useRealTimeConstraintValidation;