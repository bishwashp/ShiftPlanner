import { PrismaClient } from '@prisma/client';
import { PatternContinuity } from '../../../generated/prisma';

interface ContinuityData {
  analystId: string;
  lastPattern: string;
  lastWorkDate: Date;
  weekNumber: number;
  metadata?: any;
}

export class PatternContinuityService {
  private prisma: PrismaClient;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  /**
   * Load pattern continuity data for a specific algorithm
   */
  async loadContinuityData(algorithmType: string): Promise<Map<string, ContinuityData>> {
    const continuityRecords = await this.prisma.patternContinuity.findMany({
      where: { algorithmType },
      orderBy: { updatedAt: 'desc' }
    });

    const continuityMap = new Map<string, ContinuityData>();
    
    continuityRecords.forEach(record => {
      continuityMap.set(record.analystId, {
        analystId: record.analystId,
        lastPattern: record.lastPattern,
        lastWorkDate: new Date(record.lastWorkDate),
        weekNumber: record.weekNumber,
        metadata: record.metadata ? JSON.parse(record.metadata) : undefined
      });
    });

    return continuityMap;
  }

  /**
   * Save pattern continuity data after schedule generation
   */
  async saveContinuityData(
    algorithmType: string,
    continuityData: ContinuityData[]
  ): Promise<void> {
    const operations = continuityData.map(data => 
      this.prisma.patternContinuity.upsert({
        where: {
          algorithmType_analystId: {
            algorithmType,
            analystId: data.analystId
          }
        },
        update: {
          lastPattern: data.lastPattern,
          lastWorkDate: data.lastWorkDate,
          weekNumber: data.weekNumber,
          metadata: data.metadata ? JSON.stringify(data.metadata) : null,
          updatedAt: new Date()
        },
        create: {
          algorithmType,
          analystId: data.analystId,
          lastPattern: data.lastPattern,
          lastWorkDate: data.lastWorkDate,
          weekNumber: data.weekNumber,
          metadata: data.metadata ? JSON.stringify(data.metadata) : null
        }
      })
    );

    await this.prisma.$transaction(operations);
  }

  /**
   * Get the next pattern in rotation based on the last pattern
   */
  getNextPattern(lastPattern: string, patterns: any[]): string {
    const currentPattern = patterns.find(p => p.name === lastPattern);
    if (!currentPattern) {
      // If pattern not found, start with the first pattern
      return patterns[0].name;
    }
    return currentPattern.nextPattern;
  }

  /**
   * Calculate week number based on the date range and cycle length
   */
  calculateWeekNumber(startDate: Date, lastWorkDate: Date, cycleWeeks: number): number {
    const weeksDiff = Math.floor((startDate.getTime() - lastWorkDate.getTime()) / (1000 * 60 * 60 * 24 * 7));
    return (weeksDiff % cycleWeeks) + 1;
  }

  /**
   * Clean up old continuity data (optional maintenance)
   */
  async cleanupOldData(algorithmType: string, daysToKeep: number = 365): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

    const result = await this.prisma.patternContinuity.deleteMany({
      where: {
        algorithmType,
        updatedAt: {
          lt: cutoffDate
        }
      }
    });

    return result.count;
  }

  /**
   * Get continuity summary for reporting
   */
  async getContinuitySummary(algorithmType: string): Promise<{
    totalAnalysts: number;
    patternsInUse: { [pattern: string]: number };
    averageWeekNumber: number;
    lastUpdated: Date | null;
  }> {
    const records = await this.prisma.patternContinuity.findMany({
      where: { algorithmType }
    });

    if (records.length === 0) {
      return {
        totalAnalysts: 0,
        patternsInUse: {},
        averageWeekNumber: 0,
        lastUpdated: null
      };
    }

    const patternsInUse: { [pattern: string]: number } = {};
    let totalWeekNumber = 0;
    let lastUpdated = new Date(0);

    records.forEach(record => {
      patternsInUse[record.lastPattern] = (patternsInUse[record.lastPattern] || 0) + 1;
      totalWeekNumber += record.weekNumber;
      if (record.updatedAt > lastUpdated) {
        lastUpdated = record.updatedAt;
      }
    });

    return {
      totalAnalysts: records.length,
      patternsInUse,
      averageWeekNumber: totalWeekNumber / records.length,
      lastUpdated
    };
  }
}
