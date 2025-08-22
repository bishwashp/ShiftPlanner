"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_ALGORITHM_CONFIG = void 0;
// Export default configuration
exports.DEFAULT_ALGORITHM_CONFIG = {
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
