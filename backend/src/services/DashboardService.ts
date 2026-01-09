
import { prisma } from '../lib/prisma';
import moment from 'moment-timezone';

interface OperationalStatus {
  currentShift: {
    id: string;
    name: string;
    isOvernight: boolean;
  } | null;
  nextHandover: {
    id: string;
    sourceShift: string;
    targetRegion: string;
    targetShift: string;
    handoverTime: string;
    handoverTimeUtc: string;
    timeUntil: number; // seconds
    timestamp: string; // ISO
  } | null;
}

export class DashboardService {
  private prisma: any;
  private cacheService: any;
  private analyticsEngine: any;
  private predictiveEngine: any;

  constructor(prisma?: any, cacheService?: any, analyticsEngine?: any, predictiveEngine?: any) {
    this.prisma = prisma;
    this.cacheService = cacheService;
    this.analyticsEngine = analyticsEngine;
    this.predictiveEngine = predictiveEngine;
  }

  async generateRealTimeDashboard(): Promise<any> {
    const globalStatus = await this.getGlobalOperationalStatus();
    return {
      operationalStatus: globalStatus,
      alerts: [],
      metrics: {
        totalAnalysts: 0,
        activeSchedules: 0,
        conflicts: 0
      }
    };
  }

  async createCustomReport(config: any): Promise<any> {
    return {
      id: 'report-' + Date.now(),
      url: 'http://placeholder/report.pdf',
      generatedAt: new Date(),
      config
    };
  }

  async exportAnalytics(format: any, filters: any): Promise<any> {
    return {
      format,
      content: 'placeholder-content',
      filename: `analytics-export.${format.toLowerCase()}`
    };
  }

  async getOperationalStatus(regionId: string): Promise<OperationalStatus> {
    // 1. Get Region Info
    const region = await prisma.region.findUnique({
      where: { id: regionId }
    });

    if (!region) throw new Error('Region not found');

    const now = moment.tz(region.timezone);
    const timeValue = now.hour() + now.minute() / 60; // Decimal hour for easier comparison

    // 2. Get Shifts and Handovers for this Region
    const shifts = await prisma.shiftDefinition.findMany({
      where: { regionId: region.id },
      include: {
        outgoingHandovers: {
          include: {
            targetShift: {
              include: { region: true }
            }
          }
        }
      }
    });

    // 3. Determine Current Shift
    // Logic: specific time ranges. A bit complex with overnight shifts.
    // Simplified: iterate shifts, check if now is between start and end.
    let currentShift = null;

    for (const shift of shifts) {
      const startParts = shift.startResult.split(':').map(Number);
      const endParts = shift.endResult.split(':').map(Number);
      const startVal = startParts[0] + startParts[1] / 60;
      const endVal = endParts[0] + endParts[1] / 60;

      if (shift.isOvernight) {
        // e.g., 17:00 to 01:00
        if (timeValue >= startVal || timeValue < endVal) {
          currentShift = shift;
          break;
        }
      } else {
        // e.g. 09:00 to 17:00
        if (timeValue >= startVal && timeValue < endVal) {
          currentShift = shift;
          break;
        }
      }
    }

    // 4. Calculate Next Handover
    // Usually handover happens at the end of a specific shift.
    // We look for the NEXT scheduled handover event.

    let nextHandoverEvent = null;
    let minDiff = Infinity;

    // Flatten all handovers
    const allHandovers = shifts.flatMap(s => s.outgoingHandovers);

    for (const h of allHandovers) {
      const hParts = h.handoverTime.split(':').map(Number);
      // Handover time is stored in UTC - create a moment in UTC
      let hTimeUtc = moment.utc().hour(hParts[0]).minute(hParts[1]).second(0);

      // If this UTC time has already passed today (in UTC), it's tomorrow
      if (hTimeUtc.isBefore(moment.utc())) {
        hTimeUtc.add(1, 'day');
      }

      // Calculate time difference from now (in seconds)
      const diff = hTimeUtc.diff(moment.utc(), 'seconds');

      if (diff < minDiff) {
        minDiff = diff;
        // Convert to region's timezone for display
        const localTime = hTimeUtc.clone().tz(region.timezone).format('HH:mm');

        nextHandoverEvent = {
          id: h.id,
          sourceShift: shifts.find(s => s.id === h.sourceShiftId)?.name || '',
          targetRegion: h.targetShift.region.name,
          targetShift: h.targetShift.name,
          handoverTime: localTime, // Display in user's region timezone
          handoverTimeUtc: h.handoverTime, // Original UTC for reference
          timeUntil: diff,
          timestamp: hTimeUtc.toISOString()
        };
      }
    }

    return {
      currentShift: currentShift ? {
        id: currentShift.id,
        name: currentShift.name,
        isOvernight: currentShift.isOvernight
      } : null,
      nextHandover: nextHandoverEvent
    };
  }

  /**
   * Get GLOBAL operational status - finds the next handover across ALL regions
   * Used for dashboard widgets that need a unified, region-agnostic view
   */
  async getGlobalOperationalStatus(): Promise<{
    nextHandover: {
      id: string;
      sourceRegion: string;
      sourceShift: string;
      targetRegion: string;
      targetShift: string;
      handoverTime: string;
      handoverTimeUtc: string;
      timeUntil: number;
      timestamp: string;
    } | null;
  }> {
    // Fetch ALL handovers across ALL regions
    const allHandovers = await prisma.handoverDefinition.findMany({
      include: {
        sourceShift: {
          include: { region: true }
        },
        targetShift: {
          include: { region: true }
        }
      }
    });

    let nextHandoverEvent = null;
    let minDiff = Infinity;

    for (const h of allHandovers) {
      const hParts = h.handoverTime.split(':').map(Number);
      // Handover time is stored in UTC
      let hTimeUtc = moment.utc().hour(hParts[0]).minute(hParts[1]).second(0);

      // If this UTC time has already passed today, it's tomorrow
      if (hTimeUtc.isBefore(moment.utc())) {
        hTimeUtc.add(1, 'day');
      }

      const diff = hTimeUtc.diff(moment.utc(), 'seconds');

      if (diff < minDiff) {
        minDiff = diff;

        nextHandoverEvent = {
          id: h.id,
          sourceRegion: h.sourceShift.region.name,
          sourceShift: h.sourceShift.name,
          targetRegion: h.targetShift.region.name,
          targetShift: h.targetShift.name,
          handoverTime: hTimeUtc.format('HH:mm'), // UTC for global view
          handoverTimeUtc: h.handoverTime,
          timeUntil: diff,
          timestamp: hTimeUtc.toISOString()
        };
      }
    }

    return { nextHandover: nextHandoverEvent };
  }
}

export const dashboardService = new DashboardService();