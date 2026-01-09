import { PrismaClient } from '../../generated/prisma';
import { replacementService } from './ReplacementService';
import { fairnessDebtService } from './FairnessDebtService';
import { notificationService } from './NotificationService';
import { DateUtils } from '../utils/dateUtils';
import moment from 'moment-timezone';

export interface AbsenceData {
  analystId: string;
  startDate: string; // ISO date string
  endDate: string; // ISO date string
  type: 'VACATION' | 'SICK_LEAVE' | 'PERSONAL' | 'EMERGENCY' | 'TRAINING' | 'CONFERENCE' | 'COMPOFF';
  reason?: string;
  isApproved?: boolean;
  isPlanned?: boolean;
  denialReason?: string;
  status?: 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';
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
    // Normalize to UTC noon for storage
    const start = DateUtils.asStorageDate(startDate);
    const end = DateUtils.asStorageDate(endDate);

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

    // Check for conflicts (overlapping or duplicate absences)
    const conflictingAbsence = await this.prisma.absence.findFirst({
      where: {
        analystId,
        OR: [
          // Exact duplicate (same type, same days) - check even if rejected
          {
            type,
            startDate: start,
            endDate: end
          },
          // General overlap (any type, overlapping) - only check non-rejected
          {
            status: { not: 'REJECTED' },
            OR: [
              {
                startDate: { lte: end },
                endDate: { gte: start }
              }
            ]
          }
        ]
      }
    });

    if (conflictingAbsence) {
      const isDuplicate = conflictingAbsence.type === type &&
        conflictingAbsence.startDate.getTime() === start.getTime() &&
        conflictingAbsence.endDate.getTime() === end.getTime();

      if (isDuplicate) {
        const error: any = new Error(`Duplicate entry found: ${conflictingAbsence.type} from ${DateUtils.formatDate(conflictingAbsence.startDate)} to ${DateUtils.formatDate(conflictingAbsence.endDate)}`);
        error.conflictId = conflictingAbsence.id;
        error.isDuplicate = true;
        throw error;
      } else {
        throw new Error(`Analyst already has an overlapping absence (${conflictingAbsence.type} from ${DateUtils.formatDate(conflictingAbsence.startDate)} to ${DateUtils.formatDate(conflictingAbsence.endDate)})`);
      }
    }

    const absence = await this.prisma.absence.create({
      data: {
        analystId,
        startDate: start,
        endDate: end,
        type,
        reason,
        isApproved: isApproved !== undefined ? isApproved : false,
        isPlanned: isPlanned !== undefined ? isPlanned : true,
        status: isApproved ? 'APPROVED' : 'PENDING'
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

    // Notify Managers about new request (after successful creation)
    // Notify Managers about new request (after successful creation)
    if (!absence.isApproved) {
      // Notification service uses its own Prisma instance, so it's safe to call outside the transaction.
      try {
        // Fetch all managers/admins to notify individually
        // This ensures each manager has their own 'read' status for the notification
        const managers = await this.prisma.user.findMany({
          where: { role: { in: ['MANAGER', 'SUPER_ADMIN'] } },
          select: { id: true }
        });

        console.log(`[AbsenceService] Notifying ${managers.length} managers about new request`);

        // Create individual notification for each manager
        await Promise.all(managers.map(manager =>
          notificationService.createNotification({
            userId: manager.id, // Target specific manager
            type: 'ALERT',
            title: 'New Absence Request',
            message: `${absence.analyst.name} requested ${absence.type} from ${DateUtils.formatDate(absence.startDate)} to ${DateUtils.formatDate(absence.endDate)}`,
            priority: 'MEDIUM',
            requiresAction: true,
            metadata: {
              category: 'ABSENCE_REQUEST',
              absenceId: absence.id,
              analystId: absence.analystId,
              link: '/absences?tab=approval'
            }
          })
        ));

      } catch (error) {
        console.error('[AbsenceService] Failed to send absence request notification:', error);
        // Do NOT duplicate the absence or fail the request. silently log error.
      }
    }

    return absence;
  }

  /**
   * Update an existing absence
   */
  async updateAbsence(id: string, absenceData: Partial<AbsenceData>): Promise<any> {
    const updateData: any = {};

    if (absenceData.startDate) {
      updateData.startDate = DateUtils.asStorageDate(absenceData.startDate);
    }
    if (absenceData.endDate) {
      updateData.endDate = DateUtils.asStorageDate(absenceData.endDate);
    }
    if (absenceData.type) updateData.type = absenceData.type;
    if (absenceData.reason !== undefined) updateData.reason = absenceData.reason;
    if (absenceData.isApproved !== undefined) {
      updateData.isApproved = absenceData.isApproved;
      updateData.status = absenceData.isApproved ? 'APPROVED' : (absenceData.status || 'PENDING');
    }
    if (absenceData.isPlanned !== undefined) updateData.isPlanned = absenceData.isPlanned;
    if (absenceData.denialReason !== undefined) updateData.denialReason = absenceData.denialReason;
    if (absenceData.status !== undefined) updateData.status = absenceData.status;

    // Validate date range if both dates are provided
    if (updateData.startDate && updateData.endDate) {
      if (updateData.startDate > updateData.endDate) {
        throw new Error('End date must be on or after start date');
      }
    } else if (updateData.startDate) {
      // Fetch existing end date to validate
      const current = await this.prisma.absence.findUnique({ where: { id }, select: { endDate: true } });
      if (current && updateData.startDate > current.endDate) {
        throw new Error('Start date cannot be after end date');
      }
    } else if (updateData.endDate) {
      // Fetch existing start date to validate
      const current = await this.prisma.absence.findUnique({ where: { id }, select: { startDate: true } });
      if (current && current.startDate > updateData.endDate) {
        throw new Error('End date cannot be before start date');
      }
    }

    // Handle Resubmission Logic
    const currentAbsence = await this.prisma.absence.findUnique({ where: { id } });

    // Check for conflicts (overlapping or duplicate absences)
    const finalStart = updateData.startDate || currentAbsence?.startDate;
    const finalEnd = updateData.endDate || currentAbsence?.endDate;
    const finalType = updateData.type || currentAbsence?.type;

    if (finalStart && finalEnd && finalType) {
      const conflictingAbsence = await this.prisma.absence.findFirst({
        where: {
          id: { not: id },
          analystId: currentAbsence?.analystId,
          OR: [
            // Exact duplicate
            {
              type: finalType,
              startDate: finalStart,
              endDate: finalEnd
            },
            // General overlap
            {
              status: { not: 'REJECTED' },
              OR: [
                {
                  startDate: { lte: finalEnd },
                  endDate: { gte: finalStart }
                }
              ]
            }
          ]
        }
      });

      if (conflictingAbsence) {
        const isDuplicate = conflictingAbsence.type === finalType &&
          conflictingAbsence.startDate.getTime() === finalStart.getTime() &&
          conflictingAbsence.endDate.getTime() === finalEnd.getTime();

        if (isDuplicate) {
          const error: any = new Error(`Duplicate entry found: ${conflictingAbsence.type} from ${DateUtils.formatDate(conflictingAbsence.startDate)} to ${DateUtils.formatDate(conflictingAbsence.endDate)}`);
          error.conflictId = conflictingAbsence.id;
          error.isDuplicate = true;
          throw error;
        } else {
          throw new Error(`Analyst already has an overlapping absence (${conflictingAbsence.type} from ${DateUtils.formatDate(conflictingAbsence.startDate)} to ${DateUtils.formatDate(conflictingAbsence.endDate)})`);
        }
      }
    }
    const isResubmission = currentAbsence?.status === 'REJECTED' && updateData.status === 'PENDING';

    if (isResubmission) {
      updateData.denialReason = null; // Clear previous denial reason
      updateData.isApproved = false;
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

    // Notify Manager on Resubmission
    if (isResubmission) {
      await notificationService.createNotification({
        type: 'ALERT',
        title: 'Absence Request Resubmitted',
        message: `${absence.analyst.name} resubmitted their request for ${DateUtils.formatDate(absence.startDate)}`,
        priority: 'MEDIUM',
        requiresAction: true,
        metadata: {
          category: 'ABSENCE_RESUBMISSION',
          absenceId: absence.id,
          analystId: absence.analystId,
          link: '/absences?tab=approval'
        }
      });
    }

    // Notify Analyst on Denial
    if (updateData.status === 'REJECTED') {
      console.log(`[AbsenceService] Creating denial notification for analyst ${absence.analystId}`);
      try {
        await notificationService.createNotification({
          analystId: absence.analystId,
          type: 'ALERT',
          title: 'Absence Request Denied',
          message: `Your absence request for ${DateUtils.formatDate(absence.startDate)} was denied. Reason: ${absence.denialReason}`,
          priority: 'HIGH',
          requiresAction: true,
          metadata: {
            category: 'ABSENCE_DENIAL',
            absenceId: absence.id,
            link: `/absences?highlight=${absence.id}` // Highlight the denied request
          }
        });
      } catch (error) {
        console.error('[AbsenceService] Failed to send denial notification:', error);
        // Continue execution - do not fail the update just because notification failed
      }
    }

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
            gte: DateUtils.getStartOfDay(startDate)
          }
        });
      }

      if (endDate) {
        where.OR.push({
          startDate: {
            lte: DateUtils.getEndOfDay(endDate)
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
            startDate: { lte: DateUtils.getEndOfDay(endDate) },
            endDate: { gte: DateUtils.getStartOfDay(startDate) }
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
    const absence = await this.prisma.absence.findFirst({
      where: {
        analystId,
        startDate: { lte: DateUtils.getEndOfDay(date) },
        endDate: { gte: DateUtils.getStartOfDay(date) },
        isApproved: true
      }
    });

    return !!absence;
  }

  /**
   * Get absent analysts for a specific date
   */
  async getAbsentAnalysts(date: string): Promise<any[]> {
    const absences = await this.prisma.absence.findMany({
      where: {
        startDate: { lte: DateUtils.getEndOfDay(date) },
        endDate: { gte: DateUtils.getStartOfDay(date) },
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

    const start = DateUtils.getStartOfDay(startDate);
    const end = DateUtils.getEndOfDay(endDate);

    // Check for overlapping schedules
    const existingSchedules = await this.prisma.schedule.findMany({
      where: {
        analystId,
        date: {
          gte: start,
          lte: end
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
        date: DateUtils.formatDate(start),
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
          startDate: { lte: end },
          endDate: { gte: start }
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
        date: DateUtils.formatDate(start),
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
        startDate: { lte: end },
        endDate: { gte: start },
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
        date: DateUtils.formatDate(start),
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
  async approveAbsence(id: string, isApproved: boolean, denialReason?: string): Promise<any> {
    const status = isApproved ? 'APPROVED' : 'REJECTED';

    const absence = await this.prisma.absence.update({
      where: { id },
      data: {
        isApproved,
        status,
        denialReason: isApproved ? null : denialReason
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

    if (isApproved) {
      // Trigger replacement logic
      await replacementService.distributeMultiDayReplacement(
        absence.id,
        absence.startDate,
        absence.endDate,
        absence.analystId
      );

      // Create Fairness Debt if Vacation
      if (absence.type === 'VACATION' || absence.isPlanned) {
        const days = DateUtils.getDurationInDays(absence.startDate, absence.endDate);

        await fairnessDebtService.createDebt(
          absence.analystId,
          days * 1.0, // Simplified debt calculation
          `Vacation from ${DateUtils.formatDate(absence.startDate)} to ${DateUtils.formatDate(absence.endDate)}`,
          absence.id,
          absence.type
        );
      }

      // Auto-debit CompOff balance when COMPOFF absence is approved
      if (absence.type === 'COMPOFF') {
        const days = DateUtils.getDurationInDays(absence.startDate, absence.endDate);

        try {
          // Dynamic import to avoid circular dependency
          const { compOffService } = await import('./CompOffService');

          // Check if analyst has sufficient balance
          const hasBalance = await compOffService.hasAvailableBalance(absence.analystId, days);

          if (hasBalance) {
            await compOffService.debitForAbsence(
              absence.analystId,
              absence.id,
              days
            );
            console.log(`💸 Auto-debited ${days} compoff units for absence ${absence.id}`);
          } else {
            console.warn(`⚠️ Analyst ${absence.analystId} has insufficient compoff balance for ${days} days`);
            // Note: The approval still proceeds - this is just a warning
            // In production, you might want to block approval if insufficient balance
          }
        } catch (error) {
          console.error('Failed to auto-debit compoff:', error);
          // Don't fail the approval, just log the error
        }
      }

      // Notify Analyst of Approval
      await notificationService.createNotification({
        analystId: absence.analystId,
        type: 'SUCCESS',
        title: 'Absence Request Approved',
        message: `Your request for ${absence.type} from ${DateUtils.formatDate(absence.startDate)} to ${DateUtils.formatDate(absence.endDate)} has been approved.`,
        priority: 'LOW',
        metadata: {
          category: 'ABSENCE_UPDATE',
          absenceId: absence.id,
          status: 'APPROVED'
        }
      });

    } else {
      // Notify Analyst of Denial
      await notificationService.createNotification({
        analystId: absence.analystId,
        type: 'ALERT',
        title: 'Absence Request Denied',
        message: `Your request for ${absence.type} from ${DateUtils.formatDate(absence.startDate)} has been denied. Reason: ${denialReason || 'No reason provided'}`,
        priority: 'HIGH',
        requiresAction: true,
        metadata: {
          category: 'ABSENCE_UPDATE',
          absenceId: absence.id,
          status: 'REJECTED',
          denialReason
        }
      });
    }

    return absence;
  }

  /**
   * Get absence statistics for an analyst
   */
  async getAnalystAbsenceStats(analystId: string, year?: number): Promise<any> {
    const currentYear = year || moment.utc().year();
    const startOfYear = DateUtils.getStartOfDay(`${currentYear}-01-01`);
    const endOfYear = DateUtils.getEndOfDay(`${currentYear}-12-31`);

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
      const days = DateUtils.getDurationInDays(absence.startDate, absence.endDate);

      stats.totalDays += days;

      // Count by type
      if (!stats.byType[absence.type]) {
        stats.byType[absence.type] = { count: 0, days: 0 };
      }
      stats.byType[absence.type].count++;
      stats.byType[absence.type].days += days;

      // Count by month
      const month = DateUtils.formatDate(absence.startDate).substring(0, 7); // YYYY-MM
      stats.byMonth[month] = (stats.byMonth[month] || 0) + days;
    });

    return stats;
  }
}

export default AbsenceService;
