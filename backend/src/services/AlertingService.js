"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try {
            step(generator.next(value));
        }
        catch (e) {
            reject(e);
        } }
        function rejected(value) { try {
            step(generator["throw"](value));
        }
        catch (e) {
            reject(e);
        } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.alertingService = exports.AlertingService = void 0;
const MonitoringService_1 = require("./MonitoringService");
class AlertingService {
    constructor() {
        this.alerts = [];
        this.alertRules = [];
        this.notifications = [];
        this.isMonitoring = false;
        this.initializeDefaultRules();
        this.startMonitoring();
    }
    // Initialize default alert rules
    initializeDefaultRules() {
        this.alertRules = [
            {
                id: 'perf-degradation',
                name: 'Performance Degradation',
                type: 'PERFORMANCE_DEGRADATION',
                condition: {
                    metric: 'averageResponseTime',
                    operator: 'gt',
                    threshold: 500, // ms
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
                    threshold: 0.05, // 5%
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
                    durationMinutes: 1,
                },
                severity: 'CRITICAL',
                enabled: true,
                cooldownMinutes: 5,
            },
        ];
    }
    // Start monitoring for alerts
    startMonitoring() {
        if (this.isMonitoring)
            return;
        this.isMonitoring = true;
        // Check for alerts every 30 seconds
        setInterval(() => __awaiter(this, void 0, void 0, function* () {
            yield this.checkAlertConditions();
        }), 30000);
        console.log('🚨 Alerting service started');
    }
    // Check all alert conditions
    checkAlertConditions() {
        return __awaiter(this, void 0, void 0, function* () {
            const healthStatus = yield MonitoringService_1.monitoringService.performHealthCheck();
            const performanceMetrics = yield MonitoringService_1.monitoringService.collectPerformanceMetrics();
            const slaReport = yield MonitoringService_1.monitoringService.generateSLAReport();
            for (const rule of this.alertRules) {
                if (!rule.enabled)
                    continue;
                // Check cooldown
                if (rule.lastTriggered &&
                    Date.now() - rule.lastTriggered.getTime() < rule.cooldownMinutes * 60 * 1000) {
                    continue;
                }
                const shouldAlert = yield this.evaluateCondition(rule.condition, {
                    healthStatus,
                    performanceMetrics,
                    slaReport,
                });
                if (shouldAlert) {
                    yield this.createAlert(rule, {
                        healthStatus,
                        performanceMetrics,
                        slaReport,
                    });
                    rule.lastTriggered = new Date();
                }
            }
        });
    }
    // Evaluate a single alert condition
    evaluateCondition(condition, metrics) {
        return __awaiter(this, void 0, void 0, function* () {
            const { healthStatus, performanceMetrics, slaReport } = metrics;
            let currentValue;
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
                    currentValue = yield this.getCpuUsage();
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
        });
    }
    // Create a new alert
    createAlert(rule, context) {
        return __awaiter(this, void 0, void 0, function* () {
            const alert = {
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
            yield this.sendNotifications(alert);
            console.log(`🚨 Alert created: ${alert.type} - ${alert.message}`);
        });
    }
    // Generate alert message
    generateAlertMessage(rule, context) {
        var _a;
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
                return `High CPU usage detected: ${(_a = context.cpuUsage) === null || _a === void 0 ? void 0 : _a.toFixed(2)}%`;
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
    sendNotifications(alert) {
        return __awaiter(this, void 0, void 0, function* () {
            const notificationTypes = this.getNotificationTypes(alert.severity);
            for (const type of notificationTypes) {
                const notification = {
                    id: `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                    alertId: alert.id,
                    type,
                    recipient: this.getRecipient(type),
                    sent: false,
                };
                try {
                    yield this.sendNotification(notification, alert);
                    notification.sent = true;
                    notification.sentAt = new Date();
                }
                catch (error) {
                    notification.error = error instanceof Error ? error.message : 'Unknown error';
                    console.error(`Failed to send ${type} notification:`, error);
                }
                this.notifications.push(notification);
            }
        });
    }
    // Get notification types based on alert severity
    getNotificationTypes(severity) {
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
    getRecipient(type) {
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
    sendNotification(notification, alert) {
        return __awaiter(this, void 0, void 0, function* () {
            switch (notification.type) {
                case 'email':
                    yield this.sendEmailNotification(notification, alert);
                    break;
                case 'slack':
                    yield this.sendSlackNotification(notification, alert);
                    break;
                case 'webhook':
                    yield this.sendWebhookNotification(notification, alert);
                    break;
                case 'sms':
                    yield this.sendSMSNotification(notification, alert);
                    break;
            }
        });
    }
    // Email notification (mock implementation)
    sendEmailNotification(notification, alert) {
        return __awaiter(this, void 0, void 0, function* () {
            console.log(`📧 Email notification sent to ${notification.recipient}: ${alert.message}`);
            // In production, use a real email service like SendGrid, AWS SES, etc.
        });
    }
    // Slack notification (mock implementation)
    sendSlackNotification(notification, alert) {
        return __awaiter(this, void 0, void 0, function* () {
            console.log(`💬 Slack notification sent: ${alert.message}`);
            // In production, use Slack webhook API
        });
    }
    // Webhook notification (mock implementation)
    sendWebhookNotification(notification, alert) {
        return __awaiter(this, void 0, void 0, function* () {
            console.log(`🔗 Webhook notification sent to ${notification.recipient}: ${alert.message}`);
            // In production, make HTTP POST request to webhook URL
        });
    }
    // SMS notification (mock implementation)
    sendSMSNotification(notification, alert) {
        return __awaiter(this, void 0, void 0, function* () {
            console.log(`📱 SMS notification sent to ${notification.recipient}: ${alert.message}`);
            // In production, use SMS service like Twilio, AWS SNS, etc.
        });
    }
    // Public API methods
    getAlerts(filters) {
        return __awaiter(this, void 0, void 0, function* () {
            let filtered = this.alerts;
            if (filters === null || filters === void 0 ? void 0 : filters.severity) {
                filtered = filtered.filter(alert => alert.severity === filters.severity);
            }
            if ((filters === null || filters === void 0 ? void 0 : filters.resolved) !== undefined) {
                filtered = filtered.filter(alert => alert.resolved === filters.resolved);
            }
            return filtered.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
        });
    }
    acknowledgeAlert(alertId, acknowledgedBy) {
        return __awaiter(this, void 0, void 0, function* () {
            const alert = this.alerts.find(a => a.id === alertId);
            if (!alert)
                return null;
            alert.acknowledged = true;
            alert.acknowledgedAt = new Date();
            alert.acknowledgedBy = acknowledgedBy;
            return alert;
        });
    }
    resolveAlert(alertId) {
        return __awaiter(this, void 0, void 0, function* () {
            const alert = this.alerts.find(a => a.id === alertId);
            if (!alert)
                return null;
            alert.resolved = true;
            alert.resolvedAt = new Date();
            return alert;
        });
    }
    getAlertRules() {
        return __awaiter(this, void 0, void 0, function* () {
            return this.alertRules;
        });
    }
    updateAlertRule(ruleId, updates) {
        return __awaiter(this, void 0, void 0, function* () {
            const rule = this.alertRules.find(r => r.id === ruleId);
            if (!rule)
                return null;
            Object.assign(rule, updates);
            return rule;
        });
    }
    getNotificationHistory(alertId) {
        return __awaiter(this, void 0, void 0, function* () {
            if (alertId) {
                return this.notifications.filter(n => n.alertId === alertId);
            }
            return this.notifications;
        });
    }
    // Helper method to get CPU usage
    getCpuUsage() {
        return __awaiter(this, void 0, void 0, function* () {
            const startUsage = process.cpuUsage();
            yield new Promise(resolve => setTimeout(resolve, 100));
            const endUsage = process.cpuUsage(startUsage);
            return (endUsage.user + endUsage.system) / 1000000; // Convert to seconds
        });
    }
}
exports.AlertingService = AlertingService;
exports.alertingService = new AlertingService();
