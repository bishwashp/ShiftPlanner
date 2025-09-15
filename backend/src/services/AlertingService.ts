import { monitoringService } from './MonitoringService';
import { getSLAConfig, getAlertSeverity } from '../config/sla-config';

// Types and interfaces
interface AlertCondition {
  metric: string;
  operator: 'gt' | 'lt' | 'eq' | 'gte' | 'lte';
  threshold: number;
  durationMinutes: number;
}

interface AlertRule {
  id: string;
  name: string;
  type: string;
  condition: AlertCondition;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  enabled: boolean;
  cooldownMinutes: number;
  lastTriggered?: Date;
}

interface Alert {
  id: string;
  type: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  message: string;
  timestamp: Date;
  context: any;
  resolved: boolean;
  acknowledged: boolean;
  acknowledgedAt?: Date;
  acknowledgedBy?: string;
  resolvedAt?: Date;
}

interface Notification {
  id: string;
  alertId: string;
  type: 'email' | 'slack' | 'webhook' | 'sms';
  recipient: string;
  sent: boolean;
  sentAt?: Date;
  error?: string;
}

interface AlertFilters {
  severity?: string;
  resolved?: boolean;
}

interface MetricsContext {
  healthStatus: any;
  performanceMetrics: any;
  slaReport: any;
  cpuUsage?: number;
}

export class AlertingService {
  private alerts: Alert[] = [];
  private alertRules: AlertRule[] = [];
  private notifications: Notification[] = [];
  private isMonitoring: boolean = false;
  private slaViolationStartTime: number | null = null;

  constructor() {
    this.initializeDefaultRules();
    this.startMonitoring();
  }

  // Initialize default alert rules
  private initializeDefaultRules(): void {
    const slaConfig = getSLAConfig();
    const environment = process.env.NODE_ENV || 'development';
    
    this.alertRules = [
      {
        id: 'perf-degradation',
        name: 'Performance Degradation',
        type: 'PERFORMANCE_DEGRADATION',
        condition: {
          metric: 'averageResponseTime',
          operator: 'gt',
          threshold: slaConfig.thresholds.averageResponseTime, // Environment-specific threshold
          durationMinutes: 5,
        },
        severity: 'MEDIUM',
        enabled: true,
        cooldownMinutes: 15,
      },
      {
        id: 'high-error-rate',
        name: 'High Error Rate',
        type: 'HIGH_ERROR_RATE',
        condition: {
          metric: 'errorRate',
          operator: 'gt',
          threshold: slaConfig.thresholds.errorRate, // Environment-specific threshold
          durationMinutes: 2,
        },
        severity: 'HIGH',
        enabled: true,
        cooldownMinutes: 10,
      },
      {
        id: 'memory-usage-high',
        name: 'High Memory Usage',
        type: 'MEMORY_USAGE_HIGH',
        condition: {
          metric: 'memoryUsage',
          operator: 'gt',
          threshold: 800, // MB
          durationMinutes: 3,
        },
        severity: 'MEDIUM',
        enabled: true,
        cooldownMinutes: 20,
      },
      {
        id: 'cpu-usage-high',
        name: 'High CPU Usage',
        type: 'CPU_USAGE_HIGH',
        condition: {
          metric: 'cpuUsage',
          operator: 'gt',
          threshold: 80, // %
          durationMinutes: 3,
        },
        severity: 'MEDIUM',
        enabled: true,
        cooldownMinutes: 20,
      },
      {
        id: 'database-slow-queries',
        name: 'Database Slow Queries',
        type: 'DATABASE_SLOW_QUERIES',
        condition: {
          metric: 'slowQueryPercentage',
          operator: 'gt',
          threshold: 10, // %
          durationMinutes: 5,
        },
        severity: 'HIGH',
        enabled: true,
        cooldownMinutes: 15,
      },
      {
        id: 'cache-miss-rate-high',
        name: 'High Cache Miss Rate',
        type: 'CACHE_MISS_RATE_HIGH',
        condition: {
          metric: 'cacheMissRate',
          operator: 'gt',
          threshold: 0.3, // 30%
          durationMinutes: 5,
        },
        severity: 'LOW',
        enabled: true,
        cooldownMinutes: 30,
      },
      {
        id: 'sla-violation',
        name: 'SLA Violation',
        type: 'SLA_VIOLATION',
        condition: {
          metric: 'slaCompliance',
          operator: 'eq',
          threshold: 0, // false
          durationMinutes: slaConfig.violationDurationMinutes, // Environment-specific duration
        },
        severity: getAlertSeverity('slaCompliance', environment),
        enabled: environment !== 'development', // Disable in development
        cooldownMinutes: slaConfig.alertCooldownMinutes,
      },
    ];
  }

  // Start monitoring for alerts
  private startMonitoring(): void {
    if (this.isMonitoring) return;
    
    this.isMonitoring = true;
    
    // Check for alerts every 30 seconds
    setInterval(async () => {
      await this.checkAlertConditions();
    }, 30000);
    
    console.log('🚨 Alerting service started');
  }

  // Check all alert conditions
  private async checkAlertConditions(): Promise<void> {
    const healthStatus = await monitoringService.performHealthCheck();
    const performanceMetrics = await monitoringService.collectPerformanceMetrics();
    const slaReport = await monitoringService.generateSLAReport();

    for (const rule of this.alertRules) {
      if (!rule.enabled) continue;

      // Check cooldown
      if (rule.lastTriggered && 
          Date.now() - rule.lastTriggered.getTime() < rule.cooldownMinutes * 60 * 1000) {
        continue;
      }

      const shouldAlert = await this.evaluateCondition(rule.condition, {
        healthStatus,
        performanceMetrics,
        slaReport,
      });

      if (shouldAlert) {
        await this.createAlert(rule, {
          healthStatus,
          performanceMetrics,
          slaReport,
        });
        rule.lastTriggered = new Date();
      }
    }
  }

  // Evaluate a single alert condition
  private async evaluateCondition(condition: AlertCondition, metrics: MetricsContext): Promise<boolean> {
    const { healthStatus, performanceMetrics, slaReport } = metrics;
    let currentValue: number;

    switch (condition.metric) {
      case 'averageResponseTime':
        currentValue = performanceMetrics.apiPerformance.averageResponseTime;
        break;
      case 'errorRate':
        currentValue = performanceMetrics.queryPerformance.slowQueryPercentage / 100;
        break;
      case 'memoryUsage':
        currentValue = process.memoryUsage().heapUsed / 1024 / 1024; // MB
        break;
      case 'cpuUsage':
        currentValue = await this.getCpuUsage();
        break;
      case 'slowQueryPercentage':
        currentValue = performanceMetrics.queryPerformance.slowQueryPercentage;
        break;
      case 'cacheMissRate':
        currentValue = performanceMetrics.cachePerformance.missRate;
        break;
      case 'slaCompliance':
        currentValue = slaReport.slaCompliance ? 1 : 0;
        break;
      default:
        return false;
    }

    // For SLA compliance, check if violation has been persistent
    if (condition.metric === 'slaCompliance' && condition.durationMinutes) {
      return this.checkDurationBasedCondition(currentValue, condition);
    }

    switch (condition.operator) {
      case 'gt':
        return currentValue > condition.threshold;
      case 'lt':
        return currentValue < condition.threshold;
      case 'eq':
        return currentValue === condition.threshold;
      case 'gte':
        return currentValue >= condition.threshold;
      case 'lte':
        return currentValue <= condition.threshold;
      default:
        return false;
    }
  }

  // Check if condition has been met for the specified duration
  private checkDurationBasedCondition(currentValue: number, condition: AlertCondition): boolean {
    const now = Date.now();
    const durationMs = condition.durationMinutes * 60 * 1000;
    
    // For SLA violations, we need to check if the service has been down for the full duration
    if (condition.metric === 'slaCompliance' && currentValue === 0) {
      // Initialize violation start time if not exists
      if (!this.slaViolationStartTime) {
        this.slaViolationStartTime = now;
        return false; // Don't alert immediately
      }
      
      // Check if violation has persisted for the required duration
      const violationDuration = now - this.slaViolationStartTime;
      if (violationDuration >= durationMs) {
        return true; // Alert after duration has passed
      }
      
      return false; // Still within duration window
    } else {
      // Reset violation start time if SLA is now compliant
      this.slaViolationStartTime = null;
      return false;
    }
  }

  // Create a new alert
  private async createAlert(rule: AlertRule, context: MetricsContext): Promise<void> {
    const alert: Alert = {
      id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type: rule.type,
      severity: rule.severity,
      message: this.generateAlertMessage(rule, context),
      timestamp: new Date(),
      context,
      resolved: false,
      acknowledged: false,
    };

    this.alerts.push(alert);

    // Send notifications
    await this.sendNotifications(alert);
    
    console.log(`🚨 Alert created: ${alert.type} - ${alert.message}`);
  }

  // Generate alert message
  private generateAlertMessage(rule: AlertRule, context: MetricsContext): string {
    const { healthStatus, performanceMetrics, slaReport } = context;

    switch (rule.type) {
      case 'PERFORMANCE_DEGRADATION':
        return `Performance degradation detected. Average response time: ${performanceMetrics.apiPerformance.averageResponseTime.toFixed(2)}ms`;
      case 'HIGH_ERROR_RATE':
        return `High error rate detected: ${(performanceMetrics.queryPerformance.slowQueryPercentage).toFixed(2)}%`;
      case 'MEMORY_USAGE_HIGH':
        const memoryMB = process.memoryUsage().heapUsed / 1024 / 1024;
        return `High memory usage detected: ${memoryMB.toFixed(2)}MB`;
      case 'CPU_USAGE_HIGH':
        return `High CPU usage detected: ${context.cpuUsage?.toFixed(2)}%`;
      case 'DATABASE_SLOW_QUERIES':
        return `Database slow queries detected: ${performanceMetrics.queryPerformance.slowQueryPercentage.toFixed(2)}%`;
      case 'CACHE_MISS_RATE_HIGH':
        return `High cache miss rate detected: ${(performanceMetrics.cachePerformance.missRate * 100).toFixed(2)}%`;
      case 'SLA_VIOLATION':
        return `SLA violation detected. Uptime: ${slaReport.uptime.toFixed(2)}%, Response time: ${slaReport.averageResponseTime.toFixed(2)}ms`;
      case 'SYSTEM_UNHEALTHY':
        return `System health degraded. Status: ${healthStatus.status}`;
      default:
        return `Alert: ${rule.name}`;
    }
  }

  // Send notifications for an alert
  private async sendNotifications(alert: Alert): Promise<void> {
    const notificationTypes = this.getNotificationTypes(alert.severity);

    for (const type of notificationTypes) {
      const notification: Notification = {
        id: `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        alertId: alert.id,
        type,
        recipient: this.getRecipient(type),
        sent: false,
      };

      try {
        await this.sendNotification(notification, alert);
        notification.sent = true;
        notification.sentAt = new Date();
      } catch (error) {
        notification.error = error instanceof Error ? error.message : 'Unknown error';
        console.error(`Failed to send ${type} notification:`, error);
      }

      this.notifications.push(notification);
    }
  }

  // Get notification types based on alert severity
  private getNotificationTypes(severity: string): ('email' | 'slack' | 'webhook' | 'sms')[] {
    switch (severity) {
      case 'CRITICAL':
        return ['email', 'slack', 'webhook', 'sms'];
      case 'HIGH':
        return ['email', 'slack', 'webhook'];
      case 'MEDIUM':
        return ['email', 'slack'];
      case 'LOW':
        return ['email'];
      default:
        return ['email'];
    }
  }

  // Get recipient for notification type
  private getRecipient(type: string): string {
    switch (type) {
      case 'email':
        return process.env.ALERT_EMAIL || 'admin@shiftplanner.com';
      case 'slack':
        return process.env.SLACK_WEBHOOK_URL || '';
      case 'webhook':
        return process.env.ALERT_WEBHOOK_URL || '';
      case 'sms':
        return process.env.ALERT_SMS_NUMBER || '';
      default:
        return '';
    }
  }

  // Send a single notification
  private async sendNotification(notification: Notification, alert: Alert): Promise<void> {
    switch (notification.type) {
      case 'email':
        await this.sendEmailNotification(notification, alert);
        break;
      case 'slack':
        await this.sendSlackNotification(notification, alert);
        break;
      case 'webhook':
        await this.sendWebhookNotification(notification, alert);
        break;
      case 'sms':
        await this.sendSMSNotification(notification, alert);
        break;
    }
  }

  // Email notification (mock implementation)
  private async sendEmailNotification(notification: Notification, alert: Alert): Promise<void> {
    console.log(`📧 Email notification sent to ${notification.recipient}: ${alert.message}`);
    // In production, use a real email service like SendGrid, AWS SES, etc.
  }

  // Slack notification (mock implementation)
  private async sendSlackNotification(notification: Notification, alert: Alert): Promise<void> {
    console.log(`💬 Slack notification sent: ${alert.message}`);
    // In production, use Slack webhook API
  }

  // Webhook notification (mock implementation)
  private async sendWebhookNotification(notification: Notification, alert: Alert): Promise<void> {
    console.log(`🔗 Webhook notification sent to ${notification.recipient}: ${alert.message}`);
    // In production, make HTTP POST request to webhook URL
  }

  // SMS notification (mock implementation)
  private async sendSMSNotification(notification: Notification, alert: Alert): Promise<void> {
    console.log(`📱 SMS notification sent to ${notification.recipient}: ${alert.message}`);
    // In production, use SMS service like Twilio, AWS SNS, etc.
  }

  // Public API methods
  async getAlerts(filters?: AlertFilters): Promise<Alert[]> {
    let filtered = this.alerts;

    if (filters?.severity) {
      filtered = filtered.filter(alert => alert.severity === filters.severity);
    }

    if (filters?.resolved !== undefined) {
      filtered = filtered.filter(alert => alert.resolved === filters.resolved);
    }

    return filtered.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  async acknowledgeAlert(alertId: string, acknowledgedBy: string): Promise<Alert | null> {
    const alert = this.alerts.find(a => a.id === alertId);
    if (!alert) return null;

    alert.acknowledged = true;
    alert.acknowledgedAt = new Date();
    alert.acknowledgedBy = acknowledgedBy;

    return alert;
  }

  async resolveAlert(alertId: string): Promise<Alert | null> {
    const alert = this.alerts.find(a => a.id === alertId);
    if (!alert) return null;

    alert.resolved = true;
    alert.resolvedAt = new Date();

    return alert;
  }

  async getAlertRules(): Promise<AlertRule[]> {
    return this.alertRules;
  }

  async updateAlertRule(ruleId: string, updates: Partial<AlertRule>): Promise<AlertRule | null> {
    const rule = this.alertRules.find(r => r.id === ruleId);
    if (!rule) return null;

    Object.assign(rule, updates);
    return rule;
  }

  async getNotificationHistory(alertId?: string): Promise<Notification[]> {
    if (alertId) {
      return this.notifications.filter(n => n.alertId === alertId);
    }
    return this.notifications;
  }

  // Helper method to get CPU usage
  private async getCpuUsage(): Promise<number> {
    const startUsage = process.cpuUsage();
    await new Promise(resolve => setTimeout(resolve, 100));
    const endUsage = process.cpuUsage(startUsage);
    return (endUsage.user + endUsage.system) / 1000000; // Convert to seconds
  }
}

export const alertingService = new AlertingService(); 