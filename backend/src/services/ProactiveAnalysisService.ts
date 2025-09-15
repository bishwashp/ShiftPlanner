import { PrismaClient } from '@prisma/client';
import { cacheService } from '../lib/cache';
import { AnalyticsEngine } from './AnalyticsEngine';
import { PredictiveEngine } from './PredictiveEngine';
import { AlertingService, alertingService } from './AlertingService';
import { IntelligentScheduler } from './IntelligentScheduler';
import { ProactiveAnalysisEngine } from './ProactiveAnalysisEngine';
import { prisma } from '../lib/prisma';

/**
 * Safe singleton wrapper for ProactiveAnalysisEngine
 * 
 * This service provides a controlled way to initialize and manage
 * the proactive analysis engine without breaking existing functionality.
 */
class ProactiveAnalysisService {
  private engine: ProactiveAnalysisEngine | null = null;
  private initialized: boolean = false;

  /**
   * Initialize the proactive analysis engine
   * This is called manually when needed, not automatically
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      // Create dependencies safely - they should already exist
      const analyticsEngine = new AnalyticsEngine(prisma, cacheService);
      const predictiveEngine = new PredictiveEngine(prisma, cacheService);
      const scheduler = new IntelligentScheduler(prisma);

      // Create the proactive analysis engine
      this.engine = new ProactiveAnalysisEngine(
        prisma,
        cacheService,
        analyticsEngine,
        predictiveEngine,
        alertingService,
        scheduler
      );

      this.initialized = true;
      console.log('✅ ProactiveAnalysisService initialized');
    } catch (error) {
      console.error('❌ Failed to initialize ProactiveAnalysisService:', error);
      throw error;
    }
  }

  /**
   * Get the engine instance (initializes if needed)
   */
  async getEngine(): Promise<ProactiveAnalysisEngine> {
    if (!this.initialized) {
      await this.initialize();
    }
    
    if (!this.engine) {
      throw new Error('ProactiveAnalysisEngine not initialized');
    }
    
    return this.engine;
  }

  /**
   * Enable and start proactive analysis
   */
  async enable(): Promise<void> {
    const engine = await this.getEngine();
    await engine.enable();
    await engine.start();
  }

  /**
   * Disable and stop proactive analysis
   */
  async disable(): Promise<void> {
    if (this.engine) {
      await this.engine.disable();
    }
  }

  /**
   * Get status without initializing
   */
  async getStatus(): Promise<any> {
    if (!this.initialized || !this.engine) {
      return {
        initialized: false,
        isRunning: false,
        message: 'ProactiveAnalysisEngine not initialized'
      };
    }
    
    return await this.engine.getStatus();
  }

  /**
   * Safe shutdown
   */
  async shutdown(): Promise<void> {
    if (this.engine) {
      await this.engine.stop();
      console.log('✅ ProactiveAnalysisService shutdown complete');
    }
  }

  /**
   * Check if engine is available
   */
  isAvailable(): boolean {
    return this.initialized && this.engine !== null;
  }
}

// Export singleton instance
export const proactiveAnalysisService = new ProactiveAnalysisService();
export { ProactiveAnalysisEngine };