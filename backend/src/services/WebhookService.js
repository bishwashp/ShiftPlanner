"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.webhookService = exports.WebhookService = void 0;
class WebhookService {
    constructor() {
        this.webhooks = [];
        this.deliveries = [];
        this.isProcessing = false;
        this.initializeDefaultWebhooks();
        this.startDeliveryProcessor();
    }
    // Initialize default webhooks for common integrations
    initializeDefaultWebhooks() {
        this.webhooks = [
            {
                id: 'webhook_1',
                name: 'Calendar Integration',
                url: process.env.CALENDAR_WEBHOOK_URL || 'https://calendar.example.com/webhook',
                events: ['schedule.created', 'schedule.updated', 'schedule.deleted'],
                secret: process.env.CALENDAR_WEBHOOK_SECRET,
                isActive: true,
                retryCount: 0,
                maxRetries: 3,
                timeout: 10000,
                createdAt: new Date(),
                updatedAt: new Date(),
            },
            {
                id: 'webhook_2',
                name: 'Slack Notifications',
                url: process.env.SLACK_WEBHOOK_URL || 'https://hooks.slack.com/services/xxx/yyy/zzz',
                events: ['alert.triggered', 'conflict.detected', 'system.health.degraded'],
                secret: process.env.SLACK_WEBHOOK_SECRET,
                isActive: true,
                retryCount: 0,
                maxRetries: 3,
                timeout: 5000,
                createdAt: new Date(),
                updatedAt: new Date(),
            },
            {
                id: 'webhook_3',
                name: 'Analytics Dashboard',
                url: process.env.ANALYTICS_WEBHOOK_URL || 'https://analytics.example.com/webhook',
                events: ['algorithm.executed', 'analyst.created', 'analyst.updated'],
                secret: process.env.ANALYTICS_WEBHOOK_SECRET,
                isActive: true,
                retryCount: 0,
                maxRetries: 3,
                timeout: 8000,
                createdAt: new Date(),
                updatedAt: new Date(),
            },
        ];
    }
    // Trigger webhooks for a specific event
    triggerWebhooks(event_1, data_1) {
        return __awaiter(this, arguments, void 0, function* (event, data, source = 'system') {
            const activeWebhooks = this.webhooks.filter(webhook => webhook.isActive && webhook.events.includes(event));
            if (activeWebhooks.length === 0) {
                console.log(`📡 No active webhooks for event: ${event}`);
                return;
            }
            console.log(`📡 Triggering ${activeWebhooks.length} webhooks for event: ${event}`);
            for (const webhook of activeWebhooks) {
                yield this.createDelivery(webhook, event, data, source);
            }
        });
    }
    // Create a webhook delivery
    createDelivery(webhook, event, data, source) {
        return __awaiter(this, void 0, void 0, function* () {
            const payload = {
                event,
                timestamp: new Date().toISOString(),
                data,
                metadata: {
                    webhookId: webhook.id,
                    attempt: 1,
                    source,
                },
            };
            const delivery = {
                id: `delivery_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                webhookId: webhook.id,
                event,
                payload,
                status: 'pending',
                attempts: 0,
                maxAttempts: webhook.maxRetries,
                createdAt: new Date(),
                updatedAt: new Date(),
            };
            this.deliveries.push(delivery);
            webhook.lastTriggered = new Date();
            console.log(`📡 Created delivery ${delivery.id} for webhook ${webhook.name}`);
        });
    }
    // Process pending deliveries
    startDeliveryProcessor() {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.isProcessing)
                return;
            this.isProcessing = true;
            // Process deliveries every 5 seconds
            setInterval(() => __awaiter(this, void 0, void 0, function* () {
                yield this.processPendingDeliveries();
            }), 5000);
            console.log('📡 Webhook delivery processor started');
        });
    }
    // Process all pending deliveries
    processPendingDeliveries() {
        return __awaiter(this, void 0, void 0, function* () {
            const pendingDeliveries = this.deliveries.filter(delivery => delivery.status === 'pending' ||
                (delivery.status === 'retrying' &&
                    delivery.nextRetryAt &&
                    delivery.nextRetryAt <= new Date()));
            for (const delivery of pendingDeliveries) {
                yield this.processDelivery(delivery);
            }
        });
    }
    // Process a single delivery
    processDelivery(delivery) {
        return __awaiter(this, void 0, void 0, function* () {
            const webhook = this.webhooks.find(w => w.id === delivery.webhookId);
            if (!webhook) {
                delivery.status = 'failed';
                delivery.error = 'Webhook not found';
                delivery.updatedAt = new Date();
                return;
            }
            delivery.attempts++;
            delivery.updatedAt = new Date();
            try {
                console.log(`📡 Delivering webhook ${webhook.name} (attempt ${delivery.attempts}/${delivery.maxAttempts})`);
                const response = yield this.sendWebhook(webhook, delivery.payload);
                if (response.ok) {
                    delivery.status = 'delivered';
                    delivery.deliveredAt = new Date();
                    delivery.responseCode = response.status;
                    delivery.responseBody = yield response.text();
                    webhook.lastSuccess = new Date();
                    webhook.retryCount = 0;
                    console.log(`✅ Webhook delivered successfully: ${webhook.name}`);
                }
                else {
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }
            }
            catch (error) {
                console.error(`❌ Webhook delivery failed: ${webhook.name}`, error);
                delivery.error = error instanceof Error ? error.message : 'Unknown error';
                if (delivery.attempts >= delivery.maxAttempts) {
                    delivery.status = 'failed';
                    webhook.lastError = delivery.error;
                    console.log(`💀 Webhook delivery failed permanently: ${webhook.name}`);
                }
                else {
                    delivery.status = 'retrying';
                    delivery.nextRetryAt = this.calculateNextRetry(delivery.attempts);
                    console.log(`🔄 Webhook will retry at ${delivery.nextRetryAt}: ${webhook.name}`);
                }
            }
        });
    }
    // Send webhook HTTP request
    sendWebhook(webhook, payload) {
        return __awaiter(this, void 0, void 0, function* () {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), webhook.timeout);
            try {
                const headers = {
                    'Content-Type': 'application/json',
                    'User-Agent': 'ShiftPlanner-Webhook/1.0',
                    'X-Webhook-Event': payload.event,
                    'X-Webhook-Timestamp': payload.timestamp,
                };
                // Add signature if secret is provided
                if (webhook.secret) {
                    const signature = this.generateSignature(payload, webhook.secret);
                    headers['X-Webhook-Signature'] = signature;
                }
                const response = yield fetch(webhook.url, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(payload),
                    signal: controller.signal,
                });
                clearTimeout(timeoutId);
                return response;
            }
            catch (error) {
                clearTimeout(timeoutId);
                throw error;
            }
        });
    }
    // Generate webhook signature
    generateSignature(payload, secret) {
        const crypto = require('crypto');
        const data = JSON.stringify(payload);
        return crypto.createHmac('sha256', secret).update(data).digest('hex');
    }
    // Calculate next retry time with exponential backoff
    calculateNextRetry(attempt) {
        const baseDelay = 1000; // 1 second
        const maxDelay = 300000; // 5 minutes
        const delay = Math.min(baseDelay * Math.pow(2, attempt - 1), maxDelay);
        return new Date(Date.now() + delay);
    }
    // Webhook management API
    createWebhook(webhookData) {
        return __awaiter(this, void 0, void 0, function* () {
            const webhook = Object.assign(Object.assign({}, webhookData), { id: `webhook_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`, createdAt: new Date(), updatedAt: new Date() });
            this.webhooks.push(webhook);
            console.log(`📡 Created webhook: ${webhook.name}`);
            return webhook;
        });
    }
    updateWebhook(id, updates) {
        return __awaiter(this, void 0, void 0, function* () {
            const webhook = this.webhooks.find(w => w.id === id);
            if (!webhook)
                return null;
            Object.assign(webhook, updates, { updatedAt: new Date() });
            console.log(`📡 Updated webhook: ${webhook.name}`);
            return webhook;
        });
    }
    deleteWebhook(id) {
        return __awaiter(this, void 0, void 0, function* () {
            const index = this.webhooks.findIndex(w => w.id === id);
            if (index === -1)
                return false;
            const webhook = this.webhooks[index];
            this.webhooks.splice(index, 1);
            console.log(`📡 Deleted webhook: ${webhook.name}`);
            return true;
        });
    }
    getWebhooks() {
        return __awaiter(this, void 0, void 0, function* () {
            return this.webhooks;
        });
    }
    getWebhook(id) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.webhooks.find(w => w.id === id) || null;
        });
    }
    // Delivery management API
    getDeliveries(filters) {
        return __awaiter(this, void 0, void 0, function* () {
            let filtered = this.deliveries;
            if (filters === null || filters === void 0 ? void 0 : filters.webhookId) {
                filtered = filtered.filter(d => d.webhookId === filters.webhookId);
            }
            if (filters === null || filters === void 0 ? void 0 : filters.event) {
                filtered = filtered.filter(d => d.event === filters.event);
            }
            if (filters === null || filters === void 0 ? void 0 : filters.status) {
                filtered = filtered.filter(d => d.status === filters.status);
            }
            if (filters === null || filters === void 0 ? void 0 : filters.startDate) {
                filtered = filtered.filter(d => d.createdAt >= filters.startDate);
            }
            if (filters === null || filters === void 0 ? void 0 : filters.endDate) {
                filtered = filtered.filter(d => d.createdAt <= filters.endDate);
            }
            return filtered.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
        });
    }
    getDelivery(id) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.deliveries.find(d => d.id === id) || null;
        });
    }
    retryDelivery(id) {
        return __awaiter(this, void 0, void 0, function* () {
            const delivery = this.deliveries.find(d => d.id === id);
            if (!delivery)
                return null;
            delivery.status = 'pending';
            delivery.updatedAt = new Date();
            delivery.nextRetryAt = undefined;
            console.log(`🔄 Manually retrying delivery: ${id}`);
            return delivery;
        });
    }
    // Statistics
    getWebhookStats() {
        return __awaiter(this, void 0, void 0, function* () {
            const totalDeliveries = this.deliveries.length;
            const successfulDeliveries = this.deliveries.filter(d => d.status === 'delivered').length;
            const failedDeliveries = this.deliveries.filter(d => d.status === 'failed').length;
            const pendingDeliveries = this.deliveries.filter(d => d.status === 'pending' || d.status === 'retrying').length;
            const deliveredDeliveries = this.deliveries.filter(d => d.status === 'delivered' && d.deliveredAt);
            const averageDeliveryTime = deliveredDeliveries.length > 0
                ? deliveredDeliveries.reduce((sum, d) => {
                    return sum + (d.deliveredAt.getTime() - d.createdAt.getTime());
                }, 0) / deliveredDeliveries.length
                : 0;
            return {
                totalWebhooks: this.webhooks.length,
                activeWebhooks: this.webhooks.filter(w => w.isActive).length,
                totalDeliveries,
                successfulDeliveries,
                failedDeliveries,
                pendingDeliveries,
                averageDeliveryTime,
                successRate: totalDeliveries > 0 ? (successfulDeliveries / totalDeliveries) * 100 : 0,
            };
        });
    }
    // Test webhook endpoint
    testWebhook(webhookId) {
        return __awaiter(this, void 0, void 0, function* () {
            const webhook = this.webhooks.find(w => w.id === webhookId);
            if (!webhook) {
                return { success: false, error: 'Webhook not found' };
            }
            const testPayload = {
                event: 'test.webhook',
                timestamp: new Date().toISOString(),
                data: {
                    message: 'This is a test webhook from ShiftPlanner',
                    testId: `test_${Date.now()}`,
                },
                metadata: {
                    webhookId: webhook.id,
                    attempt: 1,
                    source: 'test',
                },
            };
            try {
                const response = yield this.sendWebhook(webhook, testPayload);
                if (response.ok) {
                    return { success: true };
                }
                else {
                    return {
                        success: false,
                        error: `HTTP ${response.status}: ${response.statusText}`
                    };
                }
            }
            catch (error) {
                return {
                    success: false,
                    error: error instanceof Error ? error.message : 'Unknown error'
                };
            }
        });
    }
    // Cleanup old deliveries
    startCleanupTasks() {
        // Clean up old deliveries every hour
        setInterval(() => {
            const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
            this.deliveries = this.deliveries.filter(d => d.createdAt > thirtyDaysAgo);
        }, 60 * 60 * 1000); // 1 hour
    }
}
exports.WebhookService = WebhookService;
exports.webhookService = new WebhookService();
