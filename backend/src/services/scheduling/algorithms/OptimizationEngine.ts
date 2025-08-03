import { Analyst, SchedulingConstraint } from '../../../../generated/prisma';
import { ProposedSchedule, SchedulingContext, OptimizationStrategy, AlgorithmConfiguration } from './types';
import { fairnessEngine } from './FairnessEngine';
import { randomizationService } from '../../RandomizationService';
import { tracingService } from '../../TracingService';
import { constraintEngine } from './ConstraintEngine';

export class OptimizationEngine {
    
    /**
     * Optimize schedules using the specified strategy
     */
    async optimizeSchedules(
        schedules: ProposedSchedule[], 
        context: SchedulingContext
    ): Promise<ProposedSchedule[]> {
        const config = context.algorithmConfig || {
            optimizationStrategy: 'HILL_CLIMBING',
            maxIterations: 1000,
            convergenceThreshold: 0.001,
            fairnessWeight: 0.4,
            efficiencyWeight: 0.3,
            constraintWeight: 0.3,
            randomizationFactor: 0.1,
            screenerAssignmentStrategy: 'WORKLOAD_BALANCE',
            weekendRotationStrategy: 'FAIRNESS_OPTIMIZED'
        };
        
        switch (config.optimizationStrategy) {
            case 'HILL_CLIMBING':
                return this.hillClimbingOptimization(schedules, context, config);
            case 'SIMULATED_ANNEALING':
                return this.simulatedAnnealingOptimization(schedules, context, config);
            case 'GENETIC':
                return this.geneticOptimization(schedules, context, config);
            case 'GREEDY':
            default:
                return this.greedyOptimization(schedules, context, config);
        }
    }
    
    /**
     * Hill climbing optimization
     */
    private async hillClimbingOptimization(
        schedules: ProposedSchedule[], 
        context: SchedulingContext, 
        config: AlgorithmConfiguration
    ): Promise<ProposedSchedule[]> {
        let currentSchedules = [...schedules];
        let currentScore = this.calculateOverallScore(currentSchedules, context, config);
        let iterations = 0;
        let improvements = 0;
        
        tracingService.startTiming('hill_climbing');
        tracingService.logStrategy('optimization', 'hill_climbing', { schedules: currentSchedules.length });
        
        while (iterations < config.maxIterations) {
            iterations++;
            
            // Generate neighbor solutions
            const neighbors = this.generateNeighbors(currentSchedules, context);
            let bestNeighbor = currentSchedules;
            let bestNeighborScore = currentScore;
            
            // Evaluate neighbors
            for (const neighbor of neighbors) {
                const neighborScore = this.calculateOverallScore(neighbor, context, config);
                
                if (neighborScore > bestNeighborScore) {
                    bestNeighbor = neighbor;
                    bestNeighborScore = neighborScore;
                }
            }
            
            // Check for improvement
            if (bestNeighborScore > currentScore + config.convergenceThreshold) {
                currentSchedules = bestNeighbor;
                currentScore = bestNeighborScore;
                improvements++;
                
                tracingService.logOptimization('hill_climbing_progress', {
                    iteration: iterations,
                    score: currentScore,
                    improvement: true,
                    strategy: 'hill_climbing'
                });
            } else {
                // No improvement found, try different neighborhood
                if (iterations % 100 === 0) {
                    console.log(`🔄 No improvement for 100 iterations, trying different approach`);
                    currentSchedules = this.generateRandomNeighbor(currentSchedules, context);
                    currentScore = this.calculateOverallScore(currentSchedules, context, config);
                } else {
                    break; // Local optimum reached
                }
            }
        }
        
        const duration = tracingService.endTiming('hill_climbing', 'hill_climbing_optimization');
        tracingService.logSummary('hill_climbing_complete', {
            success: true,
            duration,
            summary: `Hill climbing optimization completed`,
            metrics: { iterations, improvements, finalScore: currentScore }
        });
        return currentSchedules;
    }
    
    /**
     * Simulated annealing optimization
     */
    private async simulatedAnnealingOptimization(
        schedules: ProposedSchedule[], 
        context: SchedulingContext, 
        config: AlgorithmConfiguration
    ): Promise<ProposedSchedule[]> {
        let currentSchedules = [...schedules];
        let currentScore = this.calculateOverallScore(currentSchedules, context, config);
        let bestSchedules = [...currentSchedules];
        let bestScore = currentScore;
        
        let temperature = 1.0;
        const coolingRate = 0.95;
        let iterations = 0;
        
        tracingService.startTiming('simulated_annealing');
        tracingService.logStrategy('optimization', 'simulated_annealing', { 
            initialTemperature: temperature,
            coolingRate: coolingRate 
        });
        
        while (iterations < config.maxIterations && temperature > 0.01) {
            iterations++;
            
            // Generate random neighbor
            const neighbor = this.generateRandomNeighbor(currentSchedules, context);
            const neighborScore = this.calculateOverallScore(neighbor, context, config);
            
            // Calculate acceptance probability using randomization service
            const deltaE = neighborScore - currentScore;
            const acceptanceProbability = randomizationService.calculateAcceptanceProbability(
                deltaE, temperature, config
            );
            
            // Accept or reject neighbor with controlled randomization
            if (deltaE > 0 || Math.random() < acceptanceProbability) {
                currentSchedules = neighbor;
                currentScore = neighborScore;
                
                // Update best solution
                if (currentScore > bestScore) {
                    bestSchedules = [...currentSchedules];
                    bestScore = currentScore;
                    tracingService.logOptimization('simulated_annealing_best', {
                        iteration: iterations,
                        score: bestScore,
                        temperature,
                        improvement: true,
                        strategy: 'simulated_annealing'
                    });
                }
            }
            
            // Cool down
            temperature *= coolingRate;
            
            if (iterations % 100 === 0) {
                tracingService.logOptimization('simulated_annealing_progress', {
                    iteration: iterations,
                    score: currentScore,
                    temperature,
                    strategy: 'simulated_annealing'
                });
            }
        }
        
        const duration = tracingService.endTiming('simulated_annealing', 'simulated_annealing_optimization');
        tracingService.logSummary('simulated_annealing_complete', {
            success: true,
            duration,
            summary: `Simulated annealing optimization completed`,
            metrics: { iterations, bestScore, finalTemperature: temperature }
        });
        return bestSchedules;
    }
    
    /**
     * Genetic algorithm optimization
     */
    private async geneticOptimization(
        schedules: ProposedSchedule[], 
        context: SchedulingContext, 
        config: AlgorithmConfiguration
    ): Promise<ProposedSchedule[]> {
        const populationSize = 20;
        const mutationRate = 0.1;
        const crossoverRate = 0.8;
        
        // Initialize population
        let population = [schedules];
        for (let i = 1; i < populationSize; i++) {
            population.push(this.generateRandomNeighbor(schedules, context));
        }
        
        let generation = 0;
        let bestScore = 0;
        let bestSchedules = schedules;
        
        console.log(`🧬 Starting genetic algorithm optimization`);
        
        while (generation < config.maxIterations / 10) { // Fewer generations, more complex operations
            generation++;
            
            // Evaluate fitness for all individuals
            const fitnessScores = population.map(individual => ({
                schedules: individual,
                fitness: this.calculateOverallScore(individual, context, config)
            }));
            
            // Sort by fitness
            fitnessScores.sort((a, b) => b.fitness - a.fitness);
            
            // Update best solution
            if (fitnessScores[0].fitness > bestScore) {
                bestScore = fitnessScores[0].fitness;
                bestSchedules = [...fitnessScores[0].schedules];
                console.log(`🏆 Generation ${generation}: New best fitness ${bestScore.toFixed(4)}`);
            }
            
            // Create new population
            const newPopulation = [];
            
            // Elitism: keep best 20%
            const eliteCount = Math.floor(populationSize * 0.2);
            for (let i = 0; i < eliteCount; i++) {
                newPopulation.push([...fitnessScores[i].schedules]);
            }
            
            // Generate rest through crossover and mutation
            while (newPopulation.length < populationSize) {
                const parent1 = this.selectParent(fitnessScores);
                const parent2 = this.selectParent(fitnessScores);
                
                let child = [...parent1];
                
                // Crossover
                if (Math.random() < crossoverRate) {
                    child = this.crossover(parent1, parent2, context);
                }
                
                // Mutation
                if (Math.random() < mutationRate) {
                    child = this.mutate(child, context);
                }
                
                newPopulation.push(child);
            }
            
            population = newPopulation;
            
            if (generation % 10 === 0) {
                console.log(`🧬 Generation ${generation}: Best fitness ${bestScore.toFixed(4)}`);
            }
        }
        
        console.log(`✅ Genetic algorithm completed: ${generation} generations, best fitness ${bestScore.toFixed(4)}`);
        return bestSchedules;
    }
    
    /**
     * Greedy optimization
     */
    private async greedyOptimization(
        schedules: ProposedSchedule[], 
        context: SchedulingContext, 
        config: AlgorithmConfiguration
    ): Promise<ProposedSchedule[]> {
        let currentSchedules = [...schedules];
        let improved = true;
        let iterations = 0;
        
        tracingService.startTiming('greedy_optimization');
        tracingService.logStrategy('optimization', 'greedy', { schedules: schedules.length });
        
        while (improved && iterations < config.maxIterations) {
            iterations++;
            improved = false;
            
            // Try swapping each pair of schedules
            for (let i = 0; i < currentSchedules.length; i++) {
                for (let j = i + 1; j < currentSchedules.length; j++) {
                    const swapped = this.swapSchedules(currentSchedules, i, j);
                    const swappedScore = this.calculateOverallScore(swapped, context, config);
                    const currentScore = this.calculateOverallScore(currentSchedules, context, config);
                    
                    if (swappedScore > currentScore + config.convergenceThreshold) {
                        currentSchedules = swapped;
                        improved = true;
                        tracingService.logOptimization('greedy_progress', {
                        iteration: iterations,
                        score: swappedScore,
                        improvement: true,
                        strategy: 'greedy'
                    });
                        break;
                    }
                }
                if (improved) break;
            }
        }
        
        const duration = tracingService.endTiming('greedy_optimization', 'greedy_optimization');
        tracingService.logSummary('greedy_complete', {
            success: true,
            duration,
            summary: `Greedy optimization completed`,
            metrics: { iterations, finalScore: this.calculateOverallScore(currentSchedules, context, config) }
        });
        return currentSchedules;
    }
    
    /**
     * Calculate overall optimization score
     */
    private calculateOverallScore(
        schedules: ProposedSchedule[], 
        context: SchedulingContext, 
        config: AlgorithmConfiguration
    ): number {
        const fairnessMetrics = fairnessEngine.calculateFairness(schedules, context.analysts);
        const constraintValidation = constraintEngine.validateConstraints(schedules, context.globalConstraints);
        
        const fairnessScore = fairnessMetrics.overallFairnessScore;
        const constraintScore = constraintValidation.score;
        const efficiencyScore = this.calculateEfficiencyScore(schedules, context);
        
        const baseScore = (
            fairnessScore * config.fairnessWeight +
            constraintScore * config.constraintWeight +
            efficiencyScore * config.efficiencyWeight
        );

        // Apply randomization perturbation to overall score
        return randomizationService.applyScorePerturbation(baseScore, config, 0.02); // 2% perturbation
    }
    
    /**
     * Calculate efficiency score
     */
    private calculateEfficiencyScore(schedules: ProposedSchedule[], context: SchedulingContext): number {
        // Calculate coverage efficiency
        const totalDays = Math.ceil((context.endDate.getTime() - context.startDate.getTime()) / (1000 * 60 * 60 * 24));
        const coveredDays = new Set(schedules.map(s => s.date)).size;
        const coverageRatio = coveredDays / totalDays;
        
        // Calculate workload balance
        const analystWorkloads = new Map<string, number>();
        for (const schedule of schedules) {
            analystWorkloads.set(schedule.analystId, (analystWorkloads.get(schedule.analystId) || 0) + 1);
        }
        
        const workloads = Array.from(analystWorkloads.values());
        const avgWorkload = workloads.reduce((sum, w) => sum + w, 0) / workloads.length;
        const workloadVariance = workloads.reduce((sum, w) => sum + Math.pow(w - avgWorkload, 2), 0) / workloads.length;
        const workloadBalance = 1 / (1 + Math.sqrt(workloadVariance));
        
        return (coverageRatio * 0.6 + workloadBalance * 0.4);
    }
    
    /**
     * Generate neighbor solutions for hill climbing
     */
    private generateNeighbors(schedules: ProposedSchedule[], context: SchedulingContext): ProposedSchedule[][] {
        const neighbors: ProposedSchedule[][] = [];
        
        // Swap random pairs of schedules
        for (let i = 0; i < 10; i++) {
            const neighbor = this.generateRandomNeighbor(schedules, context);
            neighbors.push(neighbor);
        }
        
        return neighbors;
    }
    
    /**
     * Generate random neighbor
     */
    private generateRandomNeighbor(schedules: ProposedSchedule[], context: SchedulingContext): ProposedSchedule[] {
        const neighbor = [...schedules];
        
        // Random swap
        const i = Math.floor(Math.random() * neighbor.length);
        const j = Math.floor(Math.random() * neighbor.length);
        
        if (i !== j) {
            [neighbor[i], neighbor[j]] = [neighbor[j], neighbor[i]];
        }
        
        return neighbor;
    }
    
    /**
     * Swap two schedules
     */
    private swapSchedules(schedules: ProposedSchedule[], i: number, j: number): ProposedSchedule[] {
        const swapped = [...schedules];
        [swapped[i], swapped[j]] = [swapped[j], swapped[i]];
        return swapped;
    }
    
    /**
     * Select parent for genetic algorithm
     */
    private selectParent(fitnessScores: { schedules: ProposedSchedule[], fitness: number }[]): ProposedSchedule[] {
        // Tournament selection
        const tournamentSize = 3;
        let best = fitnessScores[Math.floor(Math.random() * fitnessScores.length)];
        
        for (let i = 1; i < tournamentSize; i++) {
            const candidate = fitnessScores[Math.floor(Math.random() * fitnessScores.length)];
            if (candidate.fitness > best.fitness) {
                best = candidate;
            }
        }
        
        return best.schedules;
    }
    
    /**
     * Crossover operation for genetic algorithm
     */
    private crossover(parent1: ProposedSchedule[], parent2: ProposedSchedule[], context: SchedulingContext): ProposedSchedule[] {
        const child: ProposedSchedule[] = [];
        const crossoverPoint = Math.floor(parent1.length / 2);
        
        // Take first half from parent1
        child.push(...parent1.slice(0, crossoverPoint));
        
        // Take remaining from parent2, avoiding duplicates
        const usedDates = new Set(child.map(s => s.date));
        for (const schedule of parent2) {
            if (!usedDates.has(schedule.date)) {
                child.push(schedule);
                usedDates.add(schedule.date);
            }
        }
        
        return child;
    }
    
    /**
     * Mutation operation for genetic algorithm
     */
    private mutate(schedules: ProposedSchedule[], context: SchedulingContext): ProposedSchedule[] {
        const mutated = [...schedules];
        
        // Random swap mutation
        const i = Math.floor(Math.random() * mutated.length);
        const j = Math.floor(Math.random() * mutated.length);
        
        if (i !== j) {
            [mutated[i], mutated[j]] = [mutated[j], mutated[i]];
        }
        
        return mutated;
    }
}

export const optimizationEngine = new OptimizationEngine(); 