import { AlgorithmConfiguration } from './scheduling/algorithms/types';

export interface RandomizationContext {
  factor: number; // 0-1, where 0 = deterministic, 1 = maximum randomization
  seed?: string; // Optional seed for reproducible randomization
}

export class RandomizationService {
  private seedValue?: number;

  constructor(seed?: string) {
    if (seed) {
      this.seedValue = this.hashSeed(seed);
    }
  }

  /**
   * Apply randomization to tie-breaking scenarios
   */
  applyTieBreaking<T>(
    candidates: T[], 
    scoreFn: (item: T) => number,
    config: AlgorithmConfiguration,
    context?: { description?: string }
  ): T {
    if (candidates.length === 0) {
      throw new Error('Cannot apply tie-breaking to empty candidates array');
    }

    if (candidates.length === 1) {
      return candidates[0];
    }

    // Calculate scores for all candidates
    const scoredCandidates = candidates.map(candidate => ({
      item: candidate,
      baseScore: scoreFn(candidate)
    }));

    // Sort by base score (descending)
    scoredCandidates.sort((a, b) => b.baseScore - a.baseScore);

    // If randomization factor is 0, return the highest scorer
    if (config.randomizationFactor === 0) {
      return scoredCandidates[0].item;
    }

    // Find all candidates within the "best" tier for tie-breaking
    const bestScore = scoredCandidates[0].baseScore;
    const tieThreshold = config.randomizationFactor * 0.1; // Allow up to 10% score difference for ties
    
    const tieCandidates = scoredCandidates.filter(
      candidate => Math.abs(candidate.baseScore - bestScore) <= tieThreshold
    );

    if (tieCandidates.length === 1) {
      return tieCandidates[0].item;
    }

    // Apply randomization to break ties
    const randomIndex = this.generateRandomInt(0, tieCandidates.length - 1);
    const selected = tieCandidates[randomIndex];

    // Log only in development mode to avoid production overhead
    if (process.env.NODE_ENV !== 'production') {
      console.log(`🎲 Randomization tie-breaker: Selected from ${tieCandidates.length} candidates ` +
                  `(factor: ${config.randomizationFactor}) ${context?.description || ''}`);
    }

    return selected.item;
  }

  /**
   * Apply score perturbation for optimization algorithms
   */
  applyScorePerturbation(
    baseScore: number, 
    config: AlgorithmConfiguration,
    perturbationRange: number = 0.05 // Default 5% perturbation
  ): number {
    if (config.randomizationFactor === 0) {
      return baseScore;
    }

    // Scale perturbation by randomization factor
    const maxPerturbation = perturbationRange * config.randomizationFactor;
    const perturbation = this.generateRandomFloat(-maxPerturbation, maxPerturbation);
    
    return baseScore + (baseScore * perturbation);
  }

  /**
   * Weighted random selection with randomization factor
   */
  weightedRandomSelection<T>(
    items: T[], 
    weightFn: (item: T) => number,
    config: AlgorithmConfiguration
  ): T {
    if (items.length === 0) {
      throw new Error('Cannot select from empty items array');
    }

    if (items.length === 1 || config.randomizationFactor === 0) {
      // Deterministic: return highest weight
      return items.reduce((best, current) => 
        weightFn(current) > weightFn(best) ? current : best
      );
    }

    // Calculate adjusted weights with randomization
    const adjustedWeights = items.map(item => {
      const baseWeight = weightFn(item);
      const randomFactor = this.generateRandomFloat(0.5, 1.5); // ±50% variation
      const adjustedWeight = baseWeight * (1 + (randomFactor - 1) * config.randomizationFactor);
      return Math.max(0, adjustedWeight); // Ensure non-negative
    });

    // Weighted random selection
    const totalWeight = adjustedWeights.reduce((sum, weight) => sum + weight, 0);
    let randomValue = this.generateRandomFloat(0, totalWeight);

    for (let i = 0; i < items.length; i++) {
      randomValue -= adjustedWeights[i];
      if (randomValue <= 0) {
        return items[i];
      }
    }

    // Fallback (should not reach here)
    return items[items.length - 1];
  }

  /**
   * Shuffle array with controlled randomization
   */
  shuffleArray<T>(array: T[], config: AlgorithmConfiguration): T[] {
    if (config.randomizationFactor === 0) {
      return [...array]; // Return copy without shuffling
    }

    const shuffled = [...array];
    const shuffleStrength = Math.floor(array.length * config.randomizationFactor);

    // Partial shuffle based on randomization factor
    for (let i = 0; i < shuffleStrength; i++) {
      const randomIndex = this.generateRandomInt(i, array.length - 1);
      [shuffled[i], shuffled[randomIndex]] = [shuffled[randomIndex], shuffled[i]];
    }

    return shuffled;
  }

  /**
   * Generate optimization neighbors with randomization
   */
  generateOptimizationNoise(
    baseValue: number,
    config: AlgorithmConfiguration,
    noiseRange: number = 0.1
  ): number {
    if (config.randomizationFactor === 0) {
      return baseValue;
    }

    const maxNoise = noiseRange * config.randomizationFactor;
    const noise = this.generateRandomFloat(-maxNoise, maxNoise);
    
    return baseValue + noise;
  }

  /**
   * Acceptance probability for simulated annealing with randomization control
   */
  calculateAcceptanceProbability(
    deltaE: number,
    temperature: number,
    config: AlgorithmConfiguration
  ): number {
    const baseProbability = Math.exp(deltaE / temperature);
    
    if (config.randomizationFactor === 0) {
      return baseProbability;
    }

    // Add randomization to acceptance probability
    const randomNoise = this.generateRandomFloat(-0.1, 0.1) * config.randomizationFactor;
    return Math.max(0, Math.min(1, baseProbability + randomNoise));
  }

  /**
   * Private utility methods
   */
  private generateRandomFloat(min: number, max: number): number {
    if (this.seedValue !== undefined) {
      // Seeded random for reproducibility
      this.seedValue = (this.seedValue * 9301 + 49297) % 233280;
      return min + (this.seedValue / 233280) * (max - min);
    }
    return min + Math.random() * (max - min);
  }

  private generateRandomInt(min: number, max: number): number {
    return Math.floor(this.generateRandomFloat(min, max + 1));
  }

  private hashSeed(seed: string): number {
    let hash = 0;
    for (let i = 0; i < seed.length; i++) {
      const char = seed.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
  }

  /**
   * Static utility to create randomization context from config
   */
  static createContext(config: AlgorithmConfiguration, seed?: string): RandomizationContext {
    return {
      factor: config.randomizationFactor,
      seed
    };
  }
}

// Export singleton instance
export const randomizationService = new RandomizationService();