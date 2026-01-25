import { Analyst, Schedule, SchedulingConstraint } from '../../../../generated/prisma';

// Core scheduling interfaces
export interface SchedulingContext {
    startDate: Date;
    endDate: Date;
    regionId: string; // Multi-Region Support
    timezone?: string; // e.g. "America/New_York", "Asia/Singapore"
    analysts: Analyst[];
    existingSchedules: Schedule[];
    globalConstraints: SchedulingConstraint[];
    algorithmConfig?: AlgorithmConfiguration;
}

export interface SchedulingResult {
    proposedSchedules: ProposedSchedule[];
    conflicts: SchedulingConflict[];
    overwrites: ScheduleOverwrite[];
    fairnessMetrics: FairnessMetrics;
    performanceMetrics: PerformanceMetrics;
}

// Enhanced schedule types
export interface ProposedSchedule {
    date: string;
    analystId: string;
    analystName: string;
    shiftType: string;
    analystShiftType?: string;
    isScreener: boolean;
    type: 'NEW_SCHEDULE' | 'OVERWRITE_SCHEDULE';
    assignmentReason?: AssignmentReason;
    fairnessScore?: number;
    constraintSatisfaction?: ConstraintSatisfaction;
}

export interface ScheduleOverwrite {
    date: string;
    analystId: string;
    analystName: string;
    from: { shiftType: string; isScreener: boolean };
    to: { shiftType: string; isScreener: boolean };
    reason?: string;
}

export interface SchedulingConflict {
    date: string;
    type: 'BLACKOUT_DATE' | 'INSUFFICIENT_STAFF' | 'CONSTRAINT_VIOLATION' | 'FAIRNESS_VIOLATION';
    description: string;
    severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    affectedAnalysts?: string[];
    suggestedResolution?: string;
}

// Fairness and performance metrics
export interface FairnessMetrics {
    workloadDistribution: {
        standardDeviation: number;
        giniCoefficient: number;
        maxMinRatio: number;
    };
    screenerDistribution: {
        standardDeviation: number;
        maxMinRatio: number;
        fairnessScore: number;
    };
    weekendDistribution: {
        standardDeviation: number;
        maxMinRatio: number;
        fairnessScore: number;
    };
    overallFairnessScore: number;
    recommendations: string[];
}

export interface PerformanceMetrics {
    totalQueries: number;
    averageQueryTime: number;
    slowQueries: number;
    cacheHitRate: number;
    algorithmExecutionTime: number;
    memoryUsage: number;
    optimizationIterations: number;
}

// Assignment reasoning
export interface AssignmentReason {
    primaryReason: string;
    secondaryFactors: string[];
    workWeight: number;
    computationCost: 'LOW' | 'MEDIUM' | 'HIGH';
    confidence: number; // 0-1
}

export interface ConstraintSatisfaction {
    hardConstraints: { satisfied: boolean; violations: string[] };
    softConstraints: { score: number; violations: string[] };
    overallScore: number; // 0-1
}

// Algorithm configuration
export interface AlgorithmConfiguration {
    fairnessWeight: number; // 0-1
    efficiencyWeight: number; // 0-1
    constraintWeight: number; // 0-1
    optimizationStrategy: 'GREEDY' | 'GENETIC' | 'SIMULATED_ANNEALING' | 'HILL_CLIMBING';
    maxIterations: number;
    convergenceThreshold: number;
    randomizationFactor: number; // 0-1
    screenerAssignmentStrategy: 'ROUND_ROBIN' | 'EXPERIENCE_BASED' | 'WORKLOAD_BALANCE' | 'SKILL_BASED';
    weekendRotationStrategy: 'SEQUENTIAL' | 'FAIRNESS_OPTIMIZED' | 'CONSTRAINT_AWARE';
}

// Advanced algorithm interface
export interface SchedulingAlgorithm {
    name: string;
    description: string;
    version: string;
    supportedFeatures: string[];
    generateSchedules(context: SchedulingContext): Promise<SchedulingResult>;
    validateConstraints(schedules: ProposedSchedule[], constraints: SchedulingConstraint[]): ConstraintValidationResult;
    calculateFairness(schedules: ProposedSchedule[], analysts: Analyst[]): FairnessMetrics;
    optimizeSchedules(schedules: ProposedSchedule[], context: SchedulingContext): Promise<ProposedSchedule[]>;
}

// Constraint validation
export interface ConstraintValidationResult {
    isValid: boolean;
    violations: ConstraintViolation[];
    score: number; // 0-1
    suggestions: string[];
}

export interface ConstraintViolation {
    type: 'HARD' | 'SOFT';
    severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    description: string;
    affectedSchedules: string[];
    suggestedFix?: string;
}

// Workload analysis
export interface WorkloadAnalysis {
    analystId: string;
    analystName: string;
    totalWorkDays: number;
    regularShiftDays: number;
    screenerDays: number;
    weekendDays: number;
    consecutiveWorkDays: number;
    averageWorkloadPerWeek: number;
    fairnessScore: number;
    recommendations: string[];
}

// Optimization strategies
export interface OptimizationStrategy {
    name: string;
    description: string;
    optimize(schedules: ProposedSchedule[], context: SchedulingContext): Promise<ProposedSchedule[]>;
    calculateImprovement(before: ProposedSchedule[], after: ProposedSchedule[]): number;
}

// Algorithm performance tracking
export interface AlgorithmPerformance {
    algorithmName: string;
    executionTime: number;
    memoryUsage: number;
    iterations: number;
    fairnessScore: number;
    constraintSatisfaction: number;
    overallScore: number;
    timestamp: Date;
}

// Export default configuration
export const DEFAULT_ALGORITHM_CONFIG: AlgorithmConfiguration = {
    fairnessWeight: 0.4,
    efficiencyWeight: 0.3,
    constraintWeight: 0.3,
    optimizationStrategy: 'HILL_CLIMBING',
    maxIterations: 1000,
    convergenceThreshold: 0.001,
    randomizationFactor: 0.1,
    screenerAssignmentStrategy: 'WORKLOAD_BALANCE',
    weekendRotationStrategy: 'FAIRNESS_OPTIMIZED'
}; 