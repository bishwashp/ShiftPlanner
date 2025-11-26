import { SchedulingStrategy } from './strategies/SchedulingStrategy';
import { SchedulingContext, SchedulingResult } from './algorithms/types';

export class UnifiedSchedulingEngine {
    private strategy: SchedulingStrategy;

    constructor(initialStrategy: SchedulingStrategy) {
        this.strategy = initialStrategy;
    }

    /**
     * Set the scheduling strategy dynamically
     */
    setStrategy(strategy: SchedulingStrategy) {
        this.strategy = strategy;
        console.log(`Switched scheduling strategy to: ${strategy.name}`);
    }

    /**
     * Get the current strategy name
     */
    getStrategyName(): string {
        return this.strategy.name;
    }

    /**
     * Generate a schedule using the current strategy
     */
    async generateSchedule(context: SchedulingContext): Promise<SchedulingResult> {
        console.log(`Generating schedule using ${this.strategy.name}...`);
        return this.strategy.generate(context);
    }
}
