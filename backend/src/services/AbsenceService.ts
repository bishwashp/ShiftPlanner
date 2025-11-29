import { PrismaClient } from '@prisma/client';
import moment from 'moment-timezone';

export interface AbsenceData {
  analystId: string;
  startDate: string; // ISO date string
  endDate: string; // ISO date string
  type: 'VACATION' | 'SICK_LEAVE' | 'PERSONAL' | 'EMERGENCY' | 'TRAINING' | 'CONFERENCE';
  reason?: string;
  isApproved?: boolean;
  isPlanned?: boolean;
}

export interface AbsenceConflict {
  type: 'OVERLAPPING_SCHEDULE' | 'OVERLAPPING_ABSENCE' | 'INSUFFICIENT_STAFF';
  date: string;
  description: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  affectedAnalysts?: string[];
  suggestedResolution?: string;
}

export class AbsenceService {
  private prisma: PrismaClient;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  /**
   * Create a new absence
   */
  async createAbsence(absenceData: AbsenceData): Promise<any> {
    const { analystId, startDate, endDate, type, reason, isApproved, isPlanned } = absenceData;

    // Validate date range
    const start = moment(startDate);
    const end = moment(endDate);

    if (start > end) {
      throw new Error('End date must be on or after start date');
    }

    // Verify analyst exists
    const analyst = await this.prisma.analyst.findUnique({
      where: { id: analystId }
    });

    if (!analyst) {
      throw new Error('Analyst not found');
    }

    // Check for overlapping absences
    const overlappingAbsence = await this.prisma.absence.findFirst({
      where: {
        analystId,
        OR: [
          {
            startDate: { lte: end.toDate() },
            endDate: { gte: start.toDate() }
          }
        ]
      }
    });

    if (overlappingAbsence) {
      throw new Error(`Analyst already has an absence during this period (${overlappingAbsence.type} from ${moment(overlappingAbsence.startDate).format('YYYY-MM-DD')} to ${moment(overlappingAbsence.endDate).format('YYYY-MM-DD')})`);
    }

    const absence = await this.prisma.absence.create({
      data: {
        analystId,
        startDate: start.toDate(),
        endDate: end.toDate(),
        type,
        reason,
        isApproved: isApproved !== undefined ? isApproved : true,
        isPlanned: isPlanned !== undefined ? isPlanned : true
      },
      include: {
        analyst: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      }
    });

    return absence;
  }

  /**
   * Update an existing absence
   */
  async updateAbsence(id: string, absenceData: Partial<AbsenceData>): Promise<any> {
    const updateData: any = {};

    if (absenceData.startDate) updateData.startDate = moment(absenceData.startDate).toDate();
    if (absenceData.endDate) updateData.endDate = moment(absenceData.endDate).toDate();
    if (absenceData.type) updateData.type = absenceData.type;
    if (absenceData.reason !== undefined) updateData.reason = absenceData.reason;
    if (absenceData.isApproved !== undefined) updateData.isApproved = absenceData.isApproved;
    if (absenceData.isPlanned !== undefined) updateData.isPlanned = absenceData.isPlanned;

    // Validate date range if both dates are provided
    if (absenceData.startDate && absenceData.endDate) {
      const start = moment(absenceData.startDate);
      const end = moment(absenceData.endDate);

      if (start > end) {
        throw new Error('End date must be on or after start date');
      }
    }

    const absence = await this.prisma.absence.update({
      where: { id },
      data: updateData,
      include: {
        analyst: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      }
    });

    return absence;
  }

  /**
   * Delete an absence
   */
  async deleteAbsence(id: string): Promise<void> {
    await this.prisma.absence.delete({
      where: { id }
    });
  }

  /**
   * Get absences for a specific analyst
   */
  async getAnalystAbsences(analystId: string, startDate?: string, endDate?: string): Promise<any[]> {
    const where: any = { analystId };

    if (startDate || endDate) {
      where.OR = [];

      if (startDate) {
        where.OR.push({
          endDate: {
            gte: moment(startDate).toDate()
          }
        });
      }

      if (endDate) {
        where.OR.push({
          startDate: {
            lte: moment(endDate).toDate()
          }
        });
      }
    }

    return await this.prisma.absence.findMany({
      where,
      orderBy: { startDate: 'asc' }
    });
  }

  /**
   * Get all absences for a date range
   */
  async getAbsencesForDateRange(startDate: string, endDate: string): Promise<any[]> {
    return await this.prisma.absence.findMany({
      where: {
        OR: [
          {
            startDate: { lte: moment(endDate).toDate() },
            endDate: { gte: moment(startDate).toDate() }
          }
        ],
        isApproved: true
      },
      include: {
        analyst: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      },
      orderBy: { startDate: 'asc' }
    });
  }

  /**
   * Check if an analyst is absent on a specific date
   */
  async isAnalystAbsent(analystId: string, date: string): Promise<boolean> {
    const momentDate = moment(date);

    const absence = await this.prisma.absence.findFirst({
      where: {
        analystId,
        startDate: { lte: momentDate.endOf('day').toDate() },
        endDate: { gte: momentDate.startOf('day').toDate() },
        isApproved: true
      }
    });

    return !!absence;
  }

  /**
   * Get absent analysts for a specific date
   */
  async getAbsentAnalysts(date: string): Promise<any[]> {
    const momentDate = moment(date);

    const absences = await this.prisma.absence.findMany({
      where: {
        startDate: { lte: momentDate.endOf('day').toDate() },
        endDate: { gte: momentDate.startOf('day').toDate() },
        isApproved: true
      },
      include: {
        analyst: {
          select: {
            id: true,
            name: true,
            email: true,
            shiftType: true
          }
        }
      }
    });

    return absences.map((absence: any) => absence.analyst);
  }

  /**
   * Check for scheduling conflicts when an absence is created/updated
   */
  async checkAbsenceConflicts(absenceData: AbsenceData, excludeId?: string): Promise<AbsenceConflict[]> {
    const conflicts: AbsenceConflict[] = [];
    const { analystId, startDate, endDate } = absenceData;

    const start = moment(startDate);
    const end = moment(endDate);

    // Check for overlapping schedules
    const existingSchedules = await this.prisma.schedule.findMany({
      where: {
        analystId,
        date: {
          gte: start.startOf('day').toDate(),
          lte: end.endOf('day').toDate()
        }
      },
      include: {
        analyst: {
          select: {
            id: true,
            name: true
          }
        }
      }
    });

    if (existingSchedules.length > 0) {
      conflicts.push({
        type: 'OVERLAPPING_SCHEDULE',
        date: start.format('YYYY-MM-DD'),
        description: `Absence conflicts with ${existingSchedules.length} existing schedule(s)`,
        severity: 'HIGH',
        affectedAnalysts: existingSchedules.map((s: any) => s.analyst.name),
        suggestedResolution: 'Consider rescheduling affected shifts or adjusting absence dates'
      });
    }

    // Check for overlapping absences (excluding current one if updating)
    const whereClause: any = {
      analystId,
      OR: [
        {
          startDate: { lte: end.toDate() },
          endDate: { gte: start.toDate() }
        }
      ]
    };

    if (excludeId) {
      whereClause.id = { not: excludeId };
    }

    const overlappingAbsences = await this.prisma.absence.findMany({
      where: whereClause
    });

    if (overlappingAbsences.length > 0) {
      conflicts.push({
        type: 'OVERLAPPING_ABSENCE',
        date: start.format('YYYY-MM-DD'),
        description: `Analyst already has ${overlappingAbsences.length} other absence(s) during this period`,
        severity: 'MEDIUM',
        affectedAnalysts: [analystId],
        suggestedResolution: 'Consider consolidating absences or adjusting dates'
      });
    }

    // Check for insufficient staff during absence period
    const totalAnalysts = await this.prisma.analyst.count({
      where: { isActive: true }
    });

    // Get all absences during this period (including the new one)
    const allAbsences = await this.prisma.absence.findMany({
      where: {
        startDate: { lte: end.endOf('day').toDate() },
        endDate: { gte: start.startOf('day').toDate() },
        isApproved: true
      }
    });

    // Count unique analysts absent during this period
    const absentAnalystIds = new Set(allAbsences.map((a: any) => a.analystId));
    if (excludeId) {
      // If updating, remove the current absence from the count
      const currentAbsence = await this.prisma.absence.findUnique({
        where: { id: excludeId },
        select: { analystId: true }
      });
      if (currentAbsence) {
        absentAnalystIds.delete(currentAbsence.analystId);
      }
    }
    // Add the new absence
    absentAnalystIds.add(analystId);

    const availableAnalysts = totalAnalysts - absentAnalystIds.size;

    if (availableAnalysts < 2) { // Minimum staff requirement
      conflicts.push({
        type: 'INSUFFICIENT_STAFF',
        date: start.format('YYYY-MM-DD'),
        description: `Only ${availableAnalysts} analysts available during absence period`,
        severity: 'CRITICAL',
        suggestedResolution: 'Consider hiring temporary staff or adjusting absence dates'
      });
    }

    return conflicts;
  }

  /**
   * Approve or reject an absence
   */
  async approveAbsence(id: string, isApproved: boolean): Promise<any> {
    const absence = await this.prisma.absence.update({
      where: { id },
      data: { isApproved },
      include: {
        analyst: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      }
    });

    return absence;
  }

  /**
   * Get absence statistics for an analyst
   */
  async getAnalystAbsenceStats(analystId: string, year?: number): Promise<any> {
    const currentYear = year || moment().year();
    const startOfYear = moment(`${currentYear}-01-01`).toDate();
    const endOfYear = moment(`${currentYear}-12-31`).endOf('day').toDate();

    const absences = await this.prisma.absence.findMany({
      where: {
        analystId,
        startDate: { gte: startOfYear },
        endDate: { lte: endOfYear },
        isApproved: true
      }
    });

    const stats = {
      totalAbsences: absences.length,
      totalDays: 0,
      byType: {} as Record<string, { count: number; days: number }>,
      byMonth: {} as Record<string, number>
    };

    absences.forEach((absence: any) => {
      const start = moment(absence.startDate);
      const end = moment(absence.endDate);
      const days = end.diff(start, 'days') + 1;

      stats.totalDays += days;

      // Count by type
      if (!stats.byType[absence.type]) {
        stats.byType[absence.type] = { count: 0, days: 0 };
      }
      stats.byType[absence.type].count++;
      stats.byType[absence.type].days += days;

      // Count by month
      const month = start.format('YYYY-MM');
      stats.byMonth[month] = (stats.byMonth[month] || 0) + days;
    });

    return stats;
  }
}

export default AbsenceService;
