import { SchedulingConstraint, Schedule, Analyst } from '../../generated/prisma';
import { prisma } from '../lib/prisma';
import { predictiveAnalyticsEngine } from './PredictiveAnalyticsEngine';
import moment from 'moment';

export interface WarningAlert {
  id: string;
  type: 'CONSTRAINT_APPROACHING' | 'WORKLOAD_IMBALANCE' | 'COVERAGE_GAP' | 'FAIRNESS_VIOLATION' | 'SCHEDULE_CONFLICT';
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  title: string;
  description: string;
  recommendedActions: string[];
  timeframe: {
    estimatedOccurrence: Date;
    daysUntilImpact: number;
    confidenceLevel: number; // 0-1
  };
  affectedEntities: {
    analysts?: string[];
    dates?: string[];
    constraints?: string[];
    schedules?: string[];
  };
  metrics: {
    currentValue: number;
    thresholdValue: number;
    projectedValue: number;
    historicalTrend: 'IMPROVING' | 'STABLE' | 'DETERIORATING';
  };
  autoResolutionOptions?: {
    canAutoResolve: boolean;
    suggestedActions: Array<{
      action: string;
      confidence: number;
      impact: 'LOW' | 'MEDIUM' | 'HIGH';
      description: string;
    }>;
  };
  createdAt: Date;
  notificationsSent: string[];
  isResolved: boolean;
  resolvedAt?: Date;
  resolvedBy?: string;
}

export interface EarlyWarningConfig {
  enabled: boolean;
  lookAheadDays: number; // Default: 14 days
  checkIntervalHours: number; // Default: 12 hours
  severityThresholds: {
    low: number;
    medium: number;
    high: number;
    critical: number;
  };
  notificationChannels: string[];
  autoResolutionEnabled: boolean;
  suppressDuplicateAlerts: boolean;
  alertRetentionDays: number;
}

export interface WarningSystemMetrics {
  totalWarnings: number;
  activeWarnings: number;
  resolvedWarnings: number;
  averageResolutionTime: number;
  accuracyRate: number;
  falsePositiveRate: number;
  criticalWarnings: number;
  trendsLastWeek: {
    newWarnings: number;
    resolvedWarnings: number;
    escalations: number;
  };
}

export class EarlyWarningSystem {
  private warnings: Map<string, WarningAlert> = new Map();
  private config: EarlyWarningConfig;
  private lastCheckTime: Date = new Date();
  private checkInterval?: NodeJS.Timeout;

  constructor(config?: Partial<EarlyWarningConfig>) {
    this.config = {
      enabled: true,
      lookAheadDays: 14,
      checkIntervalHours: 12,
      severityThresholds: {
        low: 0.3,
        medium: 0.5,
        high: 0.7,
        critical: 0.9
      },
      notificationChannels: ['email', 'slack'],
      autoResolutionEnabled: false,
      suppressDuplicateAlerts: true,
      alertRetentionDays: 30,
      ...config
    };

    if (this.config.enabled) {
      this.startMonitoring();
    }
  }

  /**
   * Start continuous monitoring for early warnings
   */
  startMonitoring(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
    }

    this.checkInterval = setInterval(async () => {
      try {
        await this.performComprehensiveCheck();
      } catch (error) {
        console.error('Early warning system check failed:', error);
      }
    }, this.config.checkIntervalHours * 60 * 60 * 1000);

    console.log(`🚨 Early warning system started - checking every ${this.config.checkIntervalHours} hours`);
  }

  /**
   * Stop monitoring
   */
  stopMonitoring(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = undefined;
    }
    console.log('🛑 Early warning system stopped');
  }

  /**
   * Perform comprehensive early warning check
   */
  async performComprehensiveCheck(): Promise<WarningAlert[]> {
    console.log('🔍 Running early warning system comprehensive check...');
    
    const endDate = moment().add(this.config.lookAheadDays, 'days').toDate();
    const startDate = new Date();

    const newWarnings: WarningAlert[] = [];

    // Check different types of potential issues
    const [
      constraintWarnings,
      workloadWarnings,
      coverageWarnings,
      fairnessWarnings,
      conflictWarnings
    ] = await Promise.all([
      this.checkApproachingConstraintLimits(startDate, endDate),
      this.checkWorkloadImbalanceRisks(startDate, endDate),
      this.checkCoverageGapRisks(startDate, endDate),
      this.checkFairnessViolationRisks(startDate, endDate),
      this.checkScheduleConflictRisks(startDate, endDate)
    ]);

    newWarnings.push(
      ...constraintWarnings,
      ...workloadWarnings,
      ...coverageWarnings,
      ...fairnessWarnings,
      ...conflictWarnings
    );

    // Process and store new warnings
    for (const warning of newWarnings) {
      await this.processWarning(warning);
    }

    // Clean up old warnings
    await this.cleanupOldWarnings();

    this.lastCheckTime = new Date();
    console.log(`✅ Early warning check complete - ${newWarnings.length} new warnings detected`);

    return newWarnings;
  }

  /**
   * Check for approaching constraint limits
   */
  private async checkApproachingConstraintLimits(startDate: Date, endDate: Date): Promise<WarningAlert[]> {
    const warnings: WarningAlert[] = [];

    // Get active constraints
    const constraints = await prisma.schedulingConstraint.findMany({
      where: {
        isActive: true,
        endDate: { gte: startDate }
      },
      include: { analyst: true }
    });

    // Get current and projected schedules
    const currentSchedules = await prisma.schedule.findMany({
      where: {
        date: { gte: startDate, lte: endDate }
      },
      include: { analyst: true }
    });

    for (const constraint of constraints) {
      let warning: WarningAlert | null = null;

      switch (constraint.constraintType) {
        case 'MAX_SCREENER_DAYS':
          warning = await this.checkMaxScreenerApproaching(constraint, currentSchedules, startDate, endDate);
          break;
        case 'MIN_SCREENER_DAYS':
          warning = await this.checkMinScreenerAtRisk(constraint, currentSchedules, startDate, endDate);
          break;
        case 'BLACKOUT_DATE':
          warning = await this.checkBlackoutConflicts(constraint, currentSchedules);
          break;
      }

      if (warning) {
        warnings.push(warning);
      }
    }

    return warnings;
  }

  /**
   * Check for workload imbalance risks
   */
  private async checkWorkloadImbalanceRisks(startDate: Date, endDate: Date): Promise<WarningAlert[]> {
    const warnings: WarningAlert[] = [];

    // Get analyst workload data
    const analysts = await prisma.analyst.findMany({
      include: {
        schedules: {
          where: {
            date: { gte: startDate, lte: endDate }
          }
        }
      }
    });

    // Calculate workload distribution
    const workloads = analysts.map(analyst => ({
      analystId: analyst.id,
      analystName: analyst.name,
      totalDays: analyst.schedules.length,
      screenerDays: analyst.schedules.filter(s => s.isScreener).length,
      weekendDays: analyst.schedules.filter(s => s.shiftType === 'WEEKEND').length
    }));

    // Check for imbalances
    const totalDaysVariance = this.calculateVariance(workloads.map(w => w.totalDays));
    const screenerVariance = this.calculateVariance(workloads.map(w => w.screenerDays));

    if (totalDaysVariance > 5) { // Threshold for variance
      warnings.push({
        id: `workload_imbalance_${Date.now()}`,
        type: 'WORKLOAD_IMBALANCE',
        severity: totalDaysVariance > 10 ? 'HIGH' : 'MEDIUM',
        title: 'Workload Imbalance Detected',
        description: `High variance in workload distribution detected (variance: ${totalDaysVariance.toFixed(1)})`,
        recommendedActions: [
          'Review assignment algorithm parameters',
          'Consider manual adjustments for upcoming schedules',
          'Check for analyst availability constraints'
        ],
        timeframe: {
          estimatedOccurrence: new Date(),
          daysUntilImpact: 0,
          confidenceLevel: 0.8
        },
        affectedEntities: {
          analysts: workloads.filter(w => Math.abs(w.totalDays - (workloads.reduce((sum, w) => sum + w.totalDays, 0) / workloads.length)) > 3).map(w => w.analystId)
        },
        metrics: {
          currentValue: totalDaysVariance,
          thresholdValue: 5,
          projectedValue: totalDaysVariance * 1.2, // Projected to worsen
          historicalTrend: 'DETERIORATING'
        },
        autoResolutionOptions: {
          canAutoResolve: true,
          suggestedActions: [
            {
              action: 'AUTO_REBALANCE',
              confidence: 0.7,
              impact: 'MEDIUM',
              description: 'Automatically rebalance upcoming assignments'
            }
          ]
        },
        createdAt: new Date(),
        notificationsSent: [],
        isResolved: false
      });
    }

    return warnings;
  }

  /**
   * Check for coverage gap risks
   */
  private async checkCoverageGapRisks(startDate: Date, endDate: Date): Promise<WarningAlert[]> {
    const warnings: WarningAlert[] = [];

    // Get schedule coverage for the period
    const dateRange = this.getDateRange(startDate, endDate);
    
    for (const date of dateRange) {
      const daySchedules = await prisma.schedule.findMany({
        where: { date: date }
      });

      // Check for coverage gaps
      const hasScreener = daySchedules.some(s => s.isScreener);
      const hasMorningShift = daySchedules.some(s => s.shiftType === 'MORNING');
      const hasEveningShift = daySchedules.some(s => s.shiftType === 'EVENING');

      if (!hasScreener || !hasMorningShift || !hasEveningShift) {
        const daysUntilImpact = Math.ceil((date.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
        
        if (daysUntilImpact <= this.config.lookAheadDays) {
          warnings.push({
            id: `coverage_gap_${date.toISOString().split('T')[0]}`,
            type: 'COVERAGE_GAP',
            severity: daysUntilImpact <= 3 ? 'CRITICAL' : daysUntilImpact <= 7 ? 'HIGH' : 'MEDIUM',
            title: 'Coverage Gap Detected',
            description: `Incomplete coverage detected for ${date.toDateString()}. Missing: ${[
              !hasScreener ? 'Screener' : '',
              !hasMorningShift ? 'Morning Shift' : '',
              !hasEveningShift ? 'Evening Shift' : ''
            ].filter(Boolean).join(', ')}`,
            recommendedActions: [
              'Assign missing roles immediately',
              'Check analyst availability for this date',
              'Consider emergency coverage protocols'
            ],
            timeframe: {
              estimatedOccurrence: date,
              daysUntilImpact,
              confidenceLevel: 0.95
            },
            affectedEntities: {
              dates: [date.toISOString().split('T')[0]]
            },
            metrics: {
              currentValue: daySchedules.length,
              thresholdValue: 3, // Expected minimum coverage
              projectedValue: daySchedules.length,
              historicalTrend: 'STABLE'
            },
            autoResolutionOptions: {
              canAutoResolve: true,
              suggestedActions: [
                {
                  action: 'AUTO_ASSIGN_AVAILABLE',
                  confidence: 0.6,
                  impact: 'HIGH',
                  description: 'Automatically assign available analysts to fill gaps'
                }
              ]
            },
            createdAt: new Date(),
            notificationsSent: [],
            isResolved: false
          });
        }
      }
    }

    return warnings;
  }

  /**
   * Check for fairness violation risks
   */
  private async checkFairnessViolationRisks(startDate: Date, endDate: Date): Promise<WarningAlert[]> {
    const warnings: WarningAlert[] = [];

    // Use predictive analytics to identify fairness risks
    const predictions = await predictiveAnalyticsEngine.predictViolations({
      startDate,
      endDate,
      minProbability: 0.4,
      minConfidence: 0.6
    });

    const fairnessPredictions = predictions.filter(p => 
              p.conflictType === 'FAIRNESS_ISSUE' && 
      p.probability > 0.5
    );

    for (const prediction of fairnessPredictions) {
      const daysUntilImpact = Math.ceil((new Date(prediction.date).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
      
      warnings.push({
        id: `fairness_risk_${prediction.date}`,
        type: 'FAIRNESS_VIOLATION',
        severity: prediction.probability > 0.8 ? 'HIGH' : 'MEDIUM',
        title: 'Fairness Violation Risk',
        description: prediction.description,
        recommendedActions: [
          'Review upcoming assignments for balance',
          'Consider adjusting rotation patterns',
          'Implement fairness correction measures'
        ],
        timeframe: {
          estimatedOccurrence: new Date(prediction.date),
          daysUntilImpact,
          confidenceLevel: prediction.confidence
        },
        affectedEntities: {
          analysts: prediction.affectedAnalysts
        },
        metrics: {
          currentValue: prediction.probability,
          thresholdValue: 0.5,
          projectedValue: prediction.probability,
          historicalTrend: 'DETERIORATING'
        },
        autoResolutionOptions: {
          canAutoResolve: false,
          suggestedActions: [
            {
              action: 'MANUAL_REVIEW',
              confidence: 0.9,
              impact: 'LOW',
              description: 'Requires manual review and adjustment'
            }
          ]
        },
        createdAt: new Date(),
        notificationsSent: [],
        isResolved: false
      });
    }

    return warnings;
  }

  /**
   * Check for schedule conflict risks
   */
  private async checkScheduleConflictRisks(startDate: Date, endDate: Date): Promise<WarningAlert[]> {
    const warnings: WarningAlert[] = [];

    // Check for potential conflicts with existing constraints
    const conflicts = await predictiveAnalyticsEngine.predictViolations({
      startDate,
      endDate,
      minProbability: 0.6,
      minConfidence: 0.7
    });

    const conflictPredictions = conflicts.filter(p => 
      p.conflictType === 'CONSTRAINT_VIOLATION'
    );

    for (const conflict of conflictPredictions) {
      const daysUntilImpact = Math.ceil((new Date(conflict.date).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
      
      warnings.push({
        id: `conflict_risk_${conflict.date}_${conflict.affectedAnalysts.join('_')}`,
        type: 'SCHEDULE_CONFLICT',
        severity: conflict.probability > 0.8 ? 'CRITICAL' : 'HIGH',
        title: 'Schedule Conflict Risk',
        description: conflict.description,
        recommendedActions: [
          'Review constraint configuration',
          'Adjust scheduling parameters',
          'Consider constraint priority changes'
        ],
        timeframe: {
          estimatedOccurrence: new Date(conflict.date),
          daysUntilImpact,
          confidenceLevel: conflict.confidence
        },
        affectedEntities: {
          analysts: conflict.affectedAnalysts,
          dates: [moment(conflict.date).format('YYYY-MM-DD')]
        },
        metrics: {
          currentValue: conflict.probability,
          thresholdValue: 0.6,
          projectedValue: conflict.probability,
          historicalTrend: 'STABLE'
        },
        autoResolutionOptions: {
          canAutoResolve: true,
          suggestedActions: [
            {
              action: 'CONSTRAINT_ADJUSTMENT',
              confidence: 0.5,
              impact: 'MEDIUM',
              description: 'Automatically adjust constraint parameters'
            }
          ]
        },
        createdAt: new Date(),
        notificationsSent: [],
        isResolved: false
      });
    }

    return warnings;
  }

  // Helper methods for specific constraint checks
  private async checkMaxScreenerApproaching(
    constraint: any,
    schedules: Schedule[],
    startDate: Date,
    endDate: Date
  ): Promise<WarningAlert | null> {
    if (!constraint.analystId) return null;

    const analystSchedules = schedules.filter(s => s.analystId === constraint.analystId);
    const screenerDays = analystSchedules.filter(s => s.isScreener).length;
    const maxAllowed = parseInt(constraint.description || '10'); // Extract from constraint

    if (screenerDays >= maxAllowed * 0.8) { // 80% of limit
      return {
        id: `max_screener_${constraint.id}`,
        type: 'CONSTRAINT_APPROACHING',
        severity: screenerDays >= maxAllowed * 0.9 ? 'HIGH' : 'MEDIUM',
        title: 'Max Screener Days Approaching',
        description: `${constraint.analyst?.name} has ${screenerDays}/${maxAllowed} screener days (${((screenerDays/maxAllowed)*100).toFixed(1)}%)`,
        recommendedActions: [
          'Reduce screener assignments for this analyst',
          'Redistribute screener duties to other analysts',
          'Review constraint limits'
        ],
        timeframe: {
          estimatedOccurrence: moment().add(Math.ceil((maxAllowed - screenerDays) * 2), 'days').toDate(),
          daysUntilImpact: Math.ceil((maxAllowed - screenerDays) * 2),
          confidenceLevel: 0.85
        },
        affectedEntities: {
          analysts: [constraint.analystId],
          constraints: [constraint.id]
        },
        metrics: {
          currentValue: screenerDays,
          thresholdValue: maxAllowed * 0.8,
          projectedValue: maxAllowed,
          historicalTrend: 'DETERIORATING'
        },
        createdAt: new Date(),
        notificationsSent: [],
        isResolved: false
      };
    }

    return null;
  }

  private async checkMinScreenerAtRisk(
    constraint: any,
    schedules: Schedule[],
    startDate: Date,
    endDate: Date
  ): Promise<WarningAlert | null> {
    if (!constraint.analystId) return null;

    const analystSchedules = schedules.filter(s => s.analystId === constraint.analystId);
    const screenerDays = analystSchedules.filter(s => s.isScreener).length;
    const minRequired = parseInt(constraint.description || '2');
    const totalPeriodDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
    const remainingDays = Math.ceil((endDate.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));

    // Check if it's becoming impossible to meet minimum
    if (screenerDays + remainingDays < minRequired) {
      return {
        id: `min_screener_risk_${constraint.id}`,
        type: 'CONSTRAINT_APPROACHING',
        severity: 'CRITICAL',
        title: 'Minimum Screener Days At Risk',
        description: `${constraint.analyst?.name} cannot meet minimum ${minRequired} screener days (current: ${screenerDays}, remaining days: ${remainingDays})`,
        recommendedActions: [
          'Immediately assign screener duties',
          'Review minimum constraint requirements',
          'Adjust scheduling to prioritize this analyst'
        ],
        timeframe: {
          estimatedOccurrence: new Date(),
          daysUntilImpact: 0,
          confidenceLevel: 0.95
        },
        affectedEntities: {
          analysts: [constraint.analystId],
          constraints: [constraint.id]
        },
        metrics: {
          currentValue: screenerDays,
          thresholdValue: minRequired,
          projectedValue: screenerDays + Math.floor(remainingDays * 0.3), // Estimated based on typical assignment rate
          historicalTrend: 'DETERIORATING'
        },
        createdAt: new Date(),
        notificationsSent: [],
        isResolved: false
      };
    }

    return null;
  }

  private async checkBlackoutConflicts(
    constraint: SchedulingConstraint,
    schedules: Schedule[]
  ): Promise<WarningAlert | null> {
    // Check if there are schedules during blackout periods
    const conflictingSchedules = schedules.filter(s => 
      s.date >= constraint.startDate && 
      s.date <= constraint.endDate &&
      (!constraint.analystId || s.analystId === constraint.analystId)
    );

    if (conflictingSchedules.length > 0) {
      return {
        id: `blackout_conflict_${constraint.id}`,
        type: 'SCHEDULE_CONFLICT',
        severity: 'HIGH',
        title: 'Blackout Period Violation',
        description: `${conflictingSchedules.length} schedule(s) found during blackout period ${constraint.startDate.toDateString()} - ${constraint.endDate.toDateString()}`,
        recommendedActions: [
          'Remove conflicting schedules',
          'Reassign affected dates to other analysts',
          'Review blackout constraint configuration'
        ],
        timeframe: {
          estimatedOccurrence: constraint.startDate,
          daysUntilImpact: Math.ceil((constraint.startDate.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)),
          confidenceLevel: 1.0
        },
        affectedEntities: {
          dates: conflictingSchedules.map(s => s.date.toISOString().split('T')[0]),
          schedules: conflictingSchedules.map(s => s.id),
          constraints: [constraint.id]
        },
        metrics: {
          currentValue: conflictingSchedules.length,
          thresholdValue: 0,
          projectedValue: conflictingSchedules.length,
          historicalTrend: 'STABLE'
        },
        createdAt: new Date(),
        notificationsSent: [],
        isResolved: false
      };
    }

    return null;
  }

  /**
   * Process and handle a new warning
   */
  private async processWarning(warning: WarningAlert): Promise<void> {
    // Check for duplicates if suppression is enabled
    if (this.config.suppressDuplicateAlerts) {
      const existingWarning = Array.from(this.warnings.values()).find(w => 
        w.type === warning.type &&
        w.affectedEntities.analysts?.join(',') === warning.affectedEntities.analysts?.join(',') &&
        w.affectedEntities.dates?.join(',') === warning.affectedEntities.dates?.join(',') &&
        !w.isResolved
      );

      if (existingWarning) {
        // Update existing warning instead of creating duplicate
        existingWarning.severity = warning.severity;
        existingWarning.metrics = warning.metrics;
        existingWarning.timeframe = warning.timeframe;
        return;
      }
    }

    // Store the warning
    this.warnings.set(warning.id, warning);

    // Send notifications
    await this.sendNotifications(warning);

    // Try auto-resolution if enabled
    if (this.config.autoResolutionEnabled && warning.autoResolutionOptions?.canAutoResolve) {
      await this.attemptAutoResolution(warning);
    }

    console.log(`🚨 New ${warning.severity} warning: ${warning.title}`);
  }

  /**
   * Send notifications for a warning
   */
  private async sendNotifications(warning: WarningAlert): Promise<void> {
    for (const channel of this.config.notificationChannels) {
      try {
        switch (channel) {
          case 'email':
            await this.sendEmailNotification(warning);
            break;
          case 'slack':
            await this.sendSlackNotification(warning);
            break;
          case 'webhook':
            await this.sendWebhookNotification(warning);
            break;
        }
        warning.notificationsSent.push(channel);
      } catch (error) {
        console.error(`Failed to send ${channel} notification:`, error);
      }
    }
  }

  /**
   * Attempt automatic resolution of a warning
   */
  private async attemptAutoResolution(warning: WarningAlert): Promise<boolean> {
    if (!warning.autoResolutionOptions?.canAutoResolve) {
      return false;
    }

    for (const action of warning.autoResolutionOptions.suggestedActions) {
      if (action.confidence > 0.7) { // Only attempt high-confidence actions
        try {
          const resolved = await this.executeAutoResolutionAction(warning, action);
          if (resolved) {
            warning.isResolved = true;
            warning.resolvedAt = new Date();
            warning.resolvedBy = 'AUTO_RESOLUTION';
            console.log(`✅ Auto-resolved warning ${warning.id} using action: ${action.action}`);
            return true;
          }
        } catch (error) {
          console.error(`Auto-resolution failed for ${warning.id}:`, error);
        }
      }
    }

    return false;
  }

  /**
   * Execute a specific auto-resolution action
   */
  private async executeAutoResolutionAction(warning: WarningAlert, action: any): Promise<boolean> {
    switch (action.action) {
      case 'AUTO_REBALANCE':
        // Implement workload rebalancing logic
        return await this.rebalanceWorkload(warning);
      
      case 'AUTO_ASSIGN_AVAILABLE':
        // Implement automatic assignment logic
        return await this.autoAssignAvailable(warning);
      
      case 'CONSTRAINT_ADJUSTMENT':
        // Implement constraint parameter adjustment
        return await this.adjustConstraintParameters(warning);
      
      default:
        return false;
    }
  }

  // Auto-resolution implementation stubs
  private async rebalanceWorkload(warning: WarningAlert): Promise<boolean> {
    // Implementation would rebalance assignments
    console.log(`Attempting workload rebalance for warning ${warning.id}`);
    return false; // Placeholder
  }

  private async autoAssignAvailable(warning: WarningAlert): Promise<boolean> {
    // Implementation would assign available analysts
    console.log(`Attempting auto-assignment for warning ${warning.id}`);
    return false; // Placeholder
  }

  private async adjustConstraintParameters(warning: WarningAlert): Promise<boolean> {
    // Implementation would adjust constraint parameters
    console.log(`Attempting constraint adjustment for warning ${warning.id}`);
    return false; // Placeholder
  }

  // Notification implementation stubs
  private async sendEmailNotification(warning: WarningAlert): Promise<void> {
    console.log(`📧 Email notification sent for warning: ${warning.title}`);
  }

  private async sendSlackNotification(warning: WarningAlert): Promise<void> {
    console.log(`💬 Slack notification sent for warning: ${warning.title}`);
  }

  private async sendWebhookNotification(warning: WarningAlert): Promise<void> {
    console.log(`🔗 Webhook notification sent for warning: ${warning.title}`);
  }

  /**
   * Clean up old resolved warnings
   */
  private async cleanupOldWarnings(): Promise<void> {
    const cutoffDate = moment().subtract(this.config.alertRetentionDays, 'days').toDate();
    
    for (const [id, warning] of this.warnings.entries()) {
      if (warning.isResolved && warning.resolvedAt && warning.resolvedAt < cutoffDate) {
        this.warnings.delete(id);
      }
    }
  }

  // Public API methods

  /**
   * Get all active warnings
   */
  getActiveWarnings(): WarningAlert[] {
    return Array.from(this.warnings.values()).filter(w => !w.isResolved);
  }

  /**
   * Get warnings by severity
   */
  getWarningsBySeverity(severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'): WarningAlert[] {
    return Array.from(this.warnings.values()).filter(w => w.severity === severity && !w.isResolved);
  }

  /**
   * Get system metrics
   */
  getSystemMetrics(): WarningSystemMetrics {
    const allWarnings = Array.from(this.warnings.values());
    const activeWarnings = allWarnings.filter(w => !w.isResolved);
    const resolvedWarnings = allWarnings.filter(w => w.isResolved);
    
    const weekAgo = moment().subtract(7, 'days').toDate();
    const recentWarnings = allWarnings.filter(w => w.createdAt >= weekAgo);
    const recentResolved = resolvedWarnings.filter(w => w.resolvedAt && w.resolvedAt >= weekAgo);

    return {
      totalWarnings: allWarnings.length,
      activeWarnings: activeWarnings.length,
      resolvedWarnings: resolvedWarnings.length,
      averageResolutionTime: this.calculateAverageResolutionTime(resolvedWarnings),
      accuracyRate: 0.85, // Placeholder - would be calculated from historical data
      falsePositiveRate: 0.15, // Placeholder
      criticalWarnings: activeWarnings.filter(w => w.severity === 'CRITICAL').length,
      trendsLastWeek: {
        newWarnings: recentWarnings.length,
        resolvedWarnings: recentResolved.length,
        escalations: 0 // Placeholder
      }
    };
  }

  /**
   * Manually resolve a warning
   */
  async resolveWarning(warningId: string, resolvedBy: string, notes?: string): Promise<boolean> {
    const warning = this.warnings.get(warningId);
    if (!warning || warning.isResolved) {
      return false;
    }

    warning.isResolved = true;
    warning.resolvedAt = new Date();
    warning.resolvedBy = resolvedBy;

    console.log(`✅ Warning ${warningId} resolved by ${resolvedBy}`);
    return true;
  }

  /**
   * Update configuration
   */
  updateConfiguration(newConfig: Partial<EarlyWarningConfig>): void {
    this.config = { ...this.config, ...newConfig };
    
    if (newConfig.enabled !== undefined) {
      if (newConfig.enabled && !this.checkInterval) {
        this.startMonitoring();
      } else if (!newConfig.enabled && this.checkInterval) {
        this.stopMonitoring();
      }
    }
  }

  // Utility methods
  private calculateVariance(values: number[]): number {
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const squaredDiffs = values.map(val => Math.pow(val - mean, 2));
    return squaredDiffs.reduce((sum, diff) => sum + diff, 0) / values.length;
  }

  private getDateRange(startDate: Date, endDate: Date): Date[] {
    const dates: Date[] = [];
    const currentDate = new Date(startDate);
    
    while (currentDate <= endDate) {
      dates.push(new Date(currentDate));
      currentDate.setDate(currentDate.getDate() + 1);
    }
    
    return dates;
  }

  private calculateAverageResolutionTime(resolvedWarnings: WarningAlert[]): number {
    if (resolvedWarnings.length === 0) return 0;
    
    const resolutionTimes = resolvedWarnings
      .filter(w => w.resolvedAt)
      .map(w => (w.resolvedAt!.getTime() - w.createdAt.getTime()) / (1000 * 60 * 60)); // Hours
    
    return resolutionTimes.reduce((sum, time) => sum + time, 0) / resolutionTimes.length;
  }
}

// Export singleton instance
export const earlyWarningSystem = new EarlyWarningSystem({
  enabled: true,
  lookAheadDays: 14,
  checkIntervalHours: 12,
  autoResolutionEnabled: false,
  notificationChannels: ['email', 'slack']
});