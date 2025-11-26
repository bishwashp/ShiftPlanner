import { SchedulingContext, SchedulingResult } from '../algorithms/types';

export interface SchedulingStrategy {
    name: string;
    description: string;

    /**
     * Generate a schedule based on the provided context
     */
    generate(context: SchedulingContext): Promise<SchedulingResult>;
}
