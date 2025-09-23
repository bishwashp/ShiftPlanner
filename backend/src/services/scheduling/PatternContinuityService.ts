import { PrismaClient } from '@prisma/client';
import { PatternContinuity } from '../../../generated/prisma';

interface ContinuityData {
  analystId: string;
  lastPattern: string;
  lastWorkDate: Date;
  weekNumber: number;
  metadata?: any;
}

interface RotationState {
  currentAnalystId: string | null;
  currentPattern: string;
  rotationStartDate: Date;
  rotationEndDate: Date | null;
  completedAnalystIds: string[];
  nextAnalystId: string | null;
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
    
    continuityRecords.forEach((record: PatternContinuity) => {
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
   * Get the current rotation state for a specific algorithm and shift type
   */
  async getRotationState(algorithmType: string, shiftType: string): Promise<RotationState | null> {
    // Find records with rotation state metadata
    const metadataRecords = await this.prisma.patternContinuity.findMany({
      where: { 
        algorithmType,
        AND: [
          { metadata: { contains: `"shiftType":"${shiftType}"` } },
          { metadata: { contains: '"isRotationState":true' } }
        ]
      },
      orderBy: { updatedAt: 'desc' },
      take: 1
    });
    
    const metadataRecord = metadataRecords.length > 0 ? metadataRecords[0] : null;
    
    if (metadataRecord) {
      try {
        const metadata = JSON.parse(metadataRecord.metadata || '{}');
        if (metadata.rotationState) {
          return {
            currentAnalystId: metadata.rotationState.currentAnalystId,
            currentPattern: metadata.rotationState.currentPattern,
            rotationStartDate: new Date(metadata.rotationState.rotationStartDate),
            rotationEndDate: metadata.rotationState.rotationEndDate ? new Date(metadata.rotationState.rotationEndDate) : null,
            completedAnalystIds: metadata.rotationState.completedAnalystIds || [],
            nextAnalystId: metadata.rotationState.nextAnalystId
          };
        }
      } catch (e) {
        console.error('Error parsing rotation state metadata:', e);
      }
    }
    
    // If no rotation state found, check for any analysts with pattern continuity
    const records = await this.prisma.patternContinuity.findMany({
      where: { 
        algorithmType,
        metadata: { contains: `"shiftType":"${shiftType}"` }
      },
      orderBy: { lastWorkDate: 'desc' },
      take: 10
    });
    
    if (records.length === 0) {
      return null;
    }
    
    // Try to reconstruct rotation state from pattern continuity records
    // This is a fallback if we don't have explicit rotation state
    const latestRecord = records[0];
    
    return {
      currentAnalystId: latestRecord.analystId,
      currentPattern: latestRecord.lastPattern,
      rotationStartDate: new Date(latestRecord.lastWorkDate),
      rotationEndDate: null,
      completedAnalystIds: records.slice(1).map((r: PatternContinuity) => r.analystId),
      nextAnalystId: null
    };
  }
  
  /**
   * Save the current rotation state
   */
  async saveRotationState(
    algorithmType: string,
    shiftType: string,
    state: RotationState
  ): Promise<void> {
    const metadata = {
      shiftType,
      isRotationState: true,
      rotationState: {
        currentAnalystId: state.currentAnalystId,
        currentPattern: state.currentPattern,
        rotationStartDate: state.rotationStartDate.toISOString(),
        rotationEndDate: state.rotationEndDate ? state.rotationEndDate.toISOString() : null,
        completedAnalystIds: state.completedAnalystIds,
        nextAnalystId: state.nextAnalystId
      }
    };
    
    // Find a valid analyst to store the rotation state with
    const analysts = await this.prisma.analyst.findMany({
      where: { shiftType, isActive: true },
      take: 1
    });
    
    if (analysts.length === 0) {
      console.warn(`No active ${shiftType} analysts found to store rotation state`);
      return;
    }
    
    const analystId = analysts[0].id;
    
    // Create a record to store rotation state
    await this.prisma.patternContinuity.upsert({
      where: {
        algorithmType_analystId: {
          algorithmType,
          analystId
        }
      },
      update: {
        lastPattern: state.currentPattern,
        lastWorkDate: new Date(),
        weekNumber: 0, // Special value for rotation state
        metadata: JSON.stringify(metadata),
        updatedAt: new Date()
      },
      create: {
        algorithmType,
        analystId,
        lastPattern: state.currentPattern,
        lastWorkDate: new Date(),
        weekNumber: 0,
        metadata: JSON.stringify(metadata)
      }
    });
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

    records.forEach((record: PatternContinuity) => {
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
