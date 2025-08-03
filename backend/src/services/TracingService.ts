export enum LogLevel {
  ERROR = 0,
  WARN = 1,
  INFO = 2,
  DEBUG = 3,
  TRACE = 4
}

export interface TraceContext {
  operation: string;
  timestamp: number;
  level: LogLevel;
  environment: 'production' | 'development';
  data?: any;
  performance?: {
    startTime: number;
    duration?: number;
    memoryUsage?: number;
  };
}

export interface ProductionLogEntry {
  level: string;
  operation: string;
  timestamp: string;
  duration?: number;
  status?: 'success' | 'error' | 'warning';
  summary?: string;
  metrics?: { [key: string]: number };
}

export interface DevelopmentLogEntry extends ProductionLogEntry {
  context?: any;
  decisions?: any[];
  debug?: any;
  stack?: string;
}

export class TracingService {
  private currentLevel: LogLevel;
  private environment: 'production' | 'development';
  private performanceTracking: Map<string, number> = new Map();

  constructor() {
    // Auto-detect environment
    this.environment = process.env.NODE_ENV === 'production' ? 'production' : 'development';
    
    // Set log level based on environment
    if (this.environment === 'production') {
      this.currentLevel = LogLevel.INFO; // Production: ERROR, WARN, INFO only
    } else {
      this.currentLevel = LogLevel.TRACE; // Development: All levels
    }

    // Override with explicit setting if provided
    const logLevel = process.env.LOG_LEVEL;
    if (logLevel) {
      this.currentLevel = this.parseLogLevel(logLevel);
    }
  }

  /**
   * Production-optimized decision logging
   */
  logDecision(operation: string, data: {
    selected?: string;
    strategy?: string;
    score?: number;
    alternatives?: number;
    reason?: string;
  }): void {
    if (!this.shouldLog(LogLevel.INFO)) return;

    if (this.environment === 'production') {
      // Lightweight structured log
      const entry: ProductionLogEntry = {
        level: 'info',
        operation,
        timestamp: new Date().toISOString(),
        status: 'success',
        summary: `${operation}: ${data.selected || 'N/A'}`,
        metrics: {
          score: data.score || 0,
          alternatives: data.alternatives || 0
        }
      };
      console.log(JSON.stringify(entry));
    } else {
      // Rich development log
      const entry: DevelopmentLogEntry = {
        level: 'info',
        operation,
        timestamp: new Date().toISOString(),
        status: 'success',
        summary: `${operation}: ${data.selected || 'N/A'}`,
        metrics: {
          score: data.score || 0,
          alternatives: data.alternatives || 0
        },
        context: data,
        debug: `🎯 ${operation} → ${data.selected} (${data.strategy}) | Score: ${data.score?.toFixed(3)} | ${data.reason}`
      };
      console.log(`🎯 ${operation} → ${data.selected} (${data.strategy}) | Score: ${data.score?.toFixed(3)} | ${data.reason}`);
    }
  }

  /**
   * Performance and optimization tracking
   */
  logOptimization(operation: string, data: {
    iteration?: number;
    score?: number;
    deltaE?: number;
    temperature?: number;
    strategy?: string;
    improvement?: boolean;
  }): void {
    if (!this.shouldLog(LogLevel.DEBUG)) return;

    if (this.environment === 'production') {
      // Log only significant optimization milestones
      if (data.improvement || (data.iteration && data.iteration % 100 === 0)) {
        const entry: ProductionLogEntry = {
          level: 'debug',
          operation,
          timestamp: new Date().toISOString(),
          metrics: {
            iteration: data.iteration || 0,
            score: data.score || 0
          }
        };
        console.log(JSON.stringify(entry));
      }
    } else {
      // Verbose optimization logging for development
      const emoji = data.improvement ? '🏆' : '🔧';
      console.log(`${emoji} ${operation} | Iter: ${data.iteration} | Score: ${data.score?.toFixed(4)} | ΔE: ${data.deltaE?.toFixed(4)} | Temp: ${data.temperature?.toFixed(3)}`);
    }
  }

  /**
   * Error and warning logging (always enabled)
   */
  logError(operation: string, error: Error | string, context?: any): void {
    const entry: ProductionLogEntry = {
      level: 'error',
      operation,
      timestamp: new Date().toISOString(),
      status: 'error',
      summary: typeof error === 'string' ? error : error.message
    };

    if (this.environment === 'development') {
      console.error(`❌ ${operation}: ${typeof error === 'string' ? error : error.message}`);
      if (context) console.error('Context:', context);
      if (error instanceof Error && error.stack) console.error(error.stack);
    } else {
      console.error(JSON.stringify(entry));
    }
  }

  logWarning(operation: string, message: string, context?: any): void {
    if (!this.shouldLog(LogLevel.WARN)) return;

    const entry: ProductionLogEntry = {
      level: 'warn',
      operation,
      timestamp: new Date().toISOString(),
      status: 'warning',
      summary: message
    };

    if (this.environment === 'development') {
      console.warn(`⚠️ ${operation}: ${message}`);
      if (context) console.warn('Context:', context);
    } else {
      console.warn(JSON.stringify(entry));
    }
  }

  /**
   * Performance timing utilities
   */
  startTiming(operationId: string): void {
    if (!this.shouldLog(LogLevel.DEBUG)) return;
    this.performanceTracking.set(operationId, performance.now());
  }

  endTiming(operationId: string, operation: string, context?: any): number | undefined {
    if (!this.shouldLog(LogLevel.DEBUG)) return;

    const startTime = this.performanceTracking.get(operationId);
    if (!startTime) return;

    const duration = performance.now() - startTime;
    this.performanceTracking.delete(operationId);

    if (this.environment === 'production') {
      // Log only slow operations in production
      if (duration > 100) { // > 100ms
        const entry: ProductionLogEntry = {
          level: 'info',
          operation,
          timestamp: new Date().toISOString(),
          duration: Math.round(duration),
          status: duration > 1000 ? 'warning' : 'success'
        };
        console.log(JSON.stringify(entry));
      }
    } else {
      // Always log timing in development
      const emoji = duration > 1000 ? '🐌' : duration > 100 ? '⏱️' : '⚡';
      console.log(`${emoji} ${operation} completed in ${duration.toFixed(1)}ms`);
      if (context) console.log('Context:', context);
    }

    return duration;
  }

  /**
   * Strategy and configuration logging
   */
  logStrategy(operation: string, strategy: string, config?: any): void {
    if (!this.shouldLog(LogLevel.INFO)) return;

    if (this.environment === 'production') {
      const entry: ProductionLogEntry = {
        level: 'info',
        operation,
        timestamp: new Date().toISOString(),
        summary: `Using ${strategy} strategy`
      };
      console.log(JSON.stringify(entry));
    } else {
      console.log(`🔄 ${operation}: Using ${strategy} strategy`);
      if (config && this.shouldLog(LogLevel.DEBUG)) {
        console.log('Configuration:', config);
      }
    }
  }

  /**
   * Verbose development-only logging
   */
  logVerbose(operation: string, context: any): void {
    if (this.environment !== 'development' || !this.shouldLog(LogLevel.TRACE)) return;
    
    console.log(`🔍 ${operation}:`);
    console.log(context);
  }

  /**
   * Constraint and validation logging
   */
  logConstraint(operation: string, data: {
    type?: string;
    violated?: boolean;
    severity?: string;
    message?: string;
    affectedSchedules?: number;
  }): void {
    if (!this.shouldLog(LogLevel.INFO)) return;

    if (this.environment === 'production') {
      const entry: ProductionLogEntry = {
        level: data.violated ? 'warn' : 'info',
        operation,
        timestamp: new Date().toISOString(),
        status: data.violated ? 'warning' : 'success',
        summary: data.message || `${data.type} constraint`,
        metrics: {
          affectedSchedules: data.affectedSchedules || 0
        }
      };
      console.log(JSON.stringify(entry));
    } else {
      const emoji = data.violated ? '⚠️' : '✅';
      const severity = data.severity || 'INFO';
      console.log(`${emoji} ${operation} [${severity}]: ${data.message || data.type} (${data.affectedSchedules || 0} schedules)`);
    }
  }

  /**
   * Summary and completion logging
   */
  logSummary(operation: string, data: {
    success: boolean;
    duration?: number;
    metrics?: { [key: string]: number };
    summary?: string;
  }): void {
    if (!this.shouldLog(LogLevel.INFO)) return;

    if (this.environment === 'production') {
      const entry: ProductionLogEntry = {
        level: 'info',
        operation,
        timestamp: new Date().toISOString(),
        duration: data.duration ? Math.round(data.duration) : undefined,
        status: data.success ? 'success' : 'error',
        summary: data.summary || operation,
        metrics: data.metrics
      };
      console.log(JSON.stringify(entry));
    } else {
      const emoji = data.success ? '✅' : '❌';
      const duration = data.duration ? ` (${data.duration.toFixed(1)}ms)` : '';
      console.log(`${emoji} ${operation} completed${duration}: ${data.summary || 'Success'}`);
      if (data.metrics && this.shouldLog(LogLevel.DEBUG)) {
        console.log('Metrics:', data.metrics);
      }
    }
  }

  /**
   * Utility methods
   */
  private shouldLog(level: LogLevel): boolean {
    return level <= this.currentLevel;
  }

  private parseLogLevel(level: string): LogLevel {
    switch (level.toUpperCase()) {
      case 'ERROR': return LogLevel.ERROR;
      case 'WARN': return LogLevel.WARN;
      case 'INFO': return LogLevel.INFO;
      case 'DEBUG': return LogLevel.DEBUG;
      case 'TRACE': return LogLevel.TRACE;
      default: return LogLevel.INFO;
    }
  }

  /**
   * Configuration methods
   */
  setLogLevel(level: LogLevel): void {
    this.currentLevel = level;
  }

  getLogLevel(): LogLevel {
    return this.currentLevel;
  }

  getEnvironment(): string {
    return this.environment;
  }
}

// Export singleton instance
export const tracingService = new TracingService();