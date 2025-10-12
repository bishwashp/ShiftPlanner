import { SchedulingAlgorithm } from "./algorithms/types";
import WeekendRotationAlgorithm from "./algorithms/WeekendRotationAlgorithm";
import EnhancedWeekendRotationAlgorithm from "./algorithms/EnhancedWeekendRotationAlgorithm";
import CoreWeekendRotationScheduler from "./CoreWeekendRotationScheduler";

const algorithms: { [name: string]: any } = {
    // New unified core algorithm (recommended)
    [CoreWeekendRotationScheduler.name]: CoreWeekendRotationScheduler,
    'core-weekend-rotation': CoreWeekendRotationScheduler,
    
    // Legacy algorithms (deprecated, for backward compatibility)
    [WeekendRotationAlgorithm.name]: WeekendRotationAlgorithm,
    'weekend-rotation': WeekendRotationAlgorithm,
    [EnhancedWeekendRotationAlgorithm.name]: EnhancedWeekendRotationAlgorithm,
    'enhanced-weekend-rotation': EnhancedWeekendRotationAlgorithm,
};

export const AlgorithmRegistry = {
    getAlgorithm(name: string): SchedulingAlgorithm | undefined {
        return algorithms[name];
    },

    listAlgorithms(): SchedulingAlgorithm[] {
        return Object.values(algorithms);
    },
    
    getDefaultAlgorithm(): SchedulingAlgorithm {
        return CoreWeekendRotationScheduler;
    }
}; 