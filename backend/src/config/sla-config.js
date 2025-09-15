"use strict";
/**
 * SLA Configuration for different environments
 * This allows for environment-specific SLA thresholds
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.slaConfigurations = void 0;
exports.getSLAConfig = getSLAConfig;
exports.isStrictSLAMonitoring = isStrictSLAMonitoring;
exports.getAlertSeverity = getAlertSeverity;
// Environment-specific configurations
exports.slaConfigurations = {
    development: {
        environment: 'development',
        thresholds: {
            uptime: 95.0, // More lenient for development
            averageResponseTime: 1000, // 1 second
            errorRate: 0.1, // 10% error rate acceptable in dev
            slowQueryPercentage: 20, // 20% slow queries acceptable
        },
        alertCooldownMinutes: 60, // 1 hour cooldown
        violationDurationMinutes: 10, // Require 10 minutes of violation
    },
    staging: {
        environment: 'staging',
        thresholds: {
            uptime: 98.0, // Stricter than dev
            averageResponseTime: 750, // 750ms
            errorRate: 0.05, // 5% error rate
            slowQueryPercentage: 15, // 15% slow queries
        },
        alertCooldownMinutes: 30, // 30 minutes cooldown
        violationDurationMinutes: 5, // Require 5 minutes of violation
    },
    production: {
        environment: 'production',
        thresholds: {
            uptime: 99.5, // Strict for production
            averageResponseTime: 300, // 300ms
            errorRate: 0.01, // 1% error rate
            slowQueryPercentage: 5, // 5% slow queries
        },
        alertCooldownMinutes: 15, // 15 minutes cooldown
        violationDurationMinutes: 2, // Require 2 minutes of violation
    },
};
/**
 * Get SLA configuration for current environment
 */
function getSLAConfig() {
    const env = process.env.NODE_ENV || 'development';
    return exports.slaConfigurations[env] || exports.slaConfigurations.development;
}
/**
 * Check if current environment should have strict SLA monitoring
 */
function isStrictSLAMonitoring() {
    const env = process.env.NODE_ENV || 'development';
    return env === 'production';
}
/**
 * Get alert severity based on SLA violation type and environment
 */
function getAlertSeverity(metric, environment) {
    if (environment === 'development') {
        return 'LOW'; // All alerts are low severity in development
    }
    if (environment === 'staging') {
        switch (metric) {
            case 'uptime':
                return 'HIGH';
            case 'averageResponseTime':
                return 'MEDIUM';
            case 'errorRate':
                return 'HIGH';
            default:
                return 'MEDIUM';
        }
    }
    // Production environment
    switch (metric) {
        case 'uptime':
            return 'CRITICAL';
        case 'averageResponseTime':
            return 'HIGH';
        case 'errorRate':
            return 'CRITICAL';
        default:
            return 'HIGH';
    }
}
