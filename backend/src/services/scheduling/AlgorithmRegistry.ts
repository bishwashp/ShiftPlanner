import { SchedulingAlgorithm } from "./algorithms/types";
import WeekendRotationAlgorithm from "./algorithms/WeekendRotationAlgorithm";

const algorithms: { [name: string]: SchedulingAlgorithm } = {
    [WeekendRotationAlgorithm.name]: WeekendRotationAlgorithm,
};

export const AlgorithmRegistry = {
    getAlgorithm(name: string): SchedulingAlgorithm | undefined {
        return algorithms[name];
    },

    listAlgorithms(): SchedulingAlgorithm[] {
        return Object.values(algorithms);
    }
}; 