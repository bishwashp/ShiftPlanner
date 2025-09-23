import { SchedulingAlgorithm } from "./algorithms/types";
import WeekendRotationAlgorithm from "./algorithms/WeekendRotationAlgorithm";

const algorithms: { [name: string]: SchedulingAlgorithm } = {
    [WeekendRotationAlgorithm.name]: WeekendRotationAlgorithm,
    'weekend-rotation': WeekendRotationAlgorithm, // Alias for backward compatibility
};

export const AlgorithmRegistry = {
    getAlgorithm(name: string): SchedulingAlgorithm | undefined {
        return algorithms[name];
    },

    listAlgorithms(): SchedulingAlgorithm[] {
        return Object.values(algorithms);
    }
}; 