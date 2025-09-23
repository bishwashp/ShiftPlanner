import { prisma } from '../lib/prisma';

export interface ScheduleGenerationLogData {
  generatedBy?: string;
  algorithmType: string;
  startDate: Date;
  endDate: Date;
  schedulesGenerated: number;
  conflictsDetected?: number;
  fairnessScore?: number;
  executionTime?: number;
  status?: 'SUCCESS' | 'FAILED' | 'PARTIAL';
  errorMessage?: string;
  metadata?: any;
}

export class ScheduleGenerationLogger {
  /**
   * Log a successful schedule generation
   */
  static async logSuccess(data: ScheduleGenerationLogData): Promise<void> {
    try {
      await prisma.scheduleGenerationLog.create({
        data: {
          generatedBy: data.generatedBy || 'admin',
          algorithmType: data.algorithmType,
          startDate: data.startDate,
          endDate: data.endDate,
          schedulesGenerated: data.schedulesGenerated,
          conflictsDetected: data.conflictsDetected || 0,
          fairnessScore: data.fairnessScore,
          executionTime: data.executionTime,
          status: 'SUCCESS',
          metadata: data.metadata ? JSON.stringify(data.metadata) : null,
        },
      });
    } catch (error) {
      console.error('Failed to log schedule generation success:', error);
      // Don't throw - logging should not break the main flow
    }
  }

  /**
   * Log a failed schedule generation
   */
  static async logFailure(data: Omit<ScheduleGenerationLogData, 'schedulesGenerated' | 'fairnessScore'> & { 
    schedulesGenerated?: number;
    fairnessScore?: number;
  }): Promise<void> {
    try {
      await prisma.scheduleGenerationLog.create({
        data: {
          generatedBy: data.generatedBy || 'admin',
          algorithmType: data.algorithmType,
          startDate: data.startDate,
          endDate: data.endDate,
          schedulesGenerated: data.schedulesGenerated || 0,
          conflictsDetected: data.conflictsDetected || 0,
          fairnessScore: data.fairnessScore,
          executionTime: data.executionTime,
          status: 'FAILED',
          errorMessage: data.errorMessage,
          metadata: data.metadata ? JSON.stringify(data.metadata) : null,
        },
      });
    } catch (error) {
      console.error('Failed to log schedule generation failure:', error);
      // Don't throw - logging should not break the main flow
    }
  }

  /**
   * Log a partial schedule generation (some schedules generated but with issues)
   */
  static async logPartial(data: ScheduleGenerationLogData): Promise<void> {
    try {
      await prisma.scheduleGenerationLog.create({
        data: {
          generatedBy: data.generatedBy || 'admin',
          algorithmType: data.algorithmType,
          startDate: data.startDate,
          endDate: data.endDate,
          schedulesGenerated: data.schedulesGenerated,
          conflictsDetected: data.conflictsDetected || 0,
          fairnessScore: data.fairnessScore,
          executionTime: data.executionTime,
          status: 'PARTIAL',
          errorMessage: data.errorMessage,
          metadata: data.metadata ? JSON.stringify(data.metadata) : null,
        },
      });
    } catch (error) {
      console.error('Failed to log schedule generation partial:', error);
      // Don't throw - logging should not break the main flow
    }
  }

  /**
   * Get recent schedule generation logs for dashboard
   */
  static async getRecentLogs(limit: number = 10): Promise<any[]> {
    try {
      const logs = await prisma.scheduleGenerationLog.findMany({
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          generatedBy: true,
          algorithmType: true,
          startDate: true,
          endDate: true,
          schedulesGenerated: true,
          conflictsDetected: true,
          fairnessScore: true,
          executionTime: true,
          status: true,
          errorMessage: true,
          createdAt: true,
        },
      });

      return logs.map(log => ({
        ...log,
        metadata: log.metadata ? JSON.parse(log.metadata) : null,
      }));
    } catch (error) {
      console.error('Failed to fetch recent schedule generation logs:', error);
      return [];
    }
  }

  /**
   * Get logs by user
   */
  static async getLogsByUser(userId: string, limit: number = 20): Promise<any[]> {
    try {
      const logs = await prisma.scheduleGenerationLog.findMany({
        where: { generatedBy: userId },
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          generatedBy: true,
          algorithmType: true,
          startDate: true,
          endDate: true,
          schedulesGenerated: true,
          conflictsDetected: true,
          fairnessScore: true,
          executionTime: true,
          status: true,
          errorMessage: true,
          createdAt: true,
        },
      });

      return logs.map(log => ({
        ...log,
        metadata: log.metadata ? JSON.parse(log.metadata) : null,
      }));
    } catch (error) {
      console.error('Failed to fetch user schedule generation logs:', error);
      return [];
    }
  }

  /**
   * Get generation statistics
   */
  static async getGenerationStats(days: number = 30): Promise<{
    totalGenerations: number;
    successfulGenerations: number;
    failedGenerations: number;
    totalSchedulesGenerated: number;
    averageExecutionTime: number;
    mostUsedAlgorithm: string;
  }> {
    try {
      const since = new Date();
      since.setDate(since.getDate() - days);

      const logs = await prisma.scheduleGenerationLog.findMany({
        where: { createdAt: { gte: since } },
        select: {
          status: true,
          schedulesGenerated: true,
          executionTime: true,
          algorithmType: true,
        },
      });

      const totalGenerations = logs.length;
      const successfulGenerations = logs.filter(log => log.status === 'SUCCESS').length;
      const failedGenerations = logs.filter(log => log.status === 'FAILED').length;
      const totalSchedulesGenerated = logs.reduce((sum, log) => sum + log.schedulesGenerated, 0);
      
      const executionTimes = logs.filter(log => log.executionTime).map(log => log.executionTime!);
      const averageExecutionTime = executionTimes.length > 0 
        ? executionTimes.reduce((sum, time) => sum + time, 0) / executionTimes.length 
        : 0;

      // Find most used algorithm
      const algorithmCounts = logs.reduce((acc, log) => {
        acc[log.algorithmType] = (acc[log.algorithmType] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);
      
      const mostUsedAlgorithm = Object.entries(algorithmCounts)
        .sort(([,a], [,b]) => b - a)[0]?.[0] || 'N/A';

      return {
        totalGenerations,
        successfulGenerations,
        failedGenerations,
        totalSchedulesGenerated,
        averageExecutionTime: Math.round(averageExecutionTime),
        mostUsedAlgorithm,
      };
    } catch (error) {
      console.error('Failed to fetch generation statistics:', error);
      return {
        totalGenerations: 0,
        successfulGenerations: 0,
        failedGenerations: 0,
        totalSchedulesGenerated: 0,
        averageExecutionTime: 0,
        mostUsedAlgorithm: 'N/A',
      };
    }
  }
}

export const scheduleGenerationLogger = ScheduleGenerationLogger;
