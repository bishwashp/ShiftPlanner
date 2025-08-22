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
const crypto_1 = require("crypto");
class WebhookService {
    constructor() {
        this.webhooks = [];
        this.deliveries = [];
        this.isProcessing = false;
        this.initializeDefaultWebhooks();
        this.startDeliveryProcessor();
        this.startCleanupTasks();
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
            };
            this.deliveries.push(delivery);
            console.log(`📡 Created delivery ${delivery.id} for webhook ${webhook.name}`);
        });
    }
    // Start the delivery processor
    startDeliveryProcessor() {
        // Process pending deliveries every 5 seconds
        setInterval(() => __awaiter(this, void 0, void 0, function* () {
            if (!this.isProcessing) {
                yield this.processPendingDeliveries();
            }
        }), 5000);
        console.log('📡 Webhook delivery processor started');
    }
    // Process pending deliveries
    processPendingDeliveries() {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.isProcessing)
                return;
            this.isProcessing = true;
            const pendingDeliveries = this.deliveries.filter(d => d.status === 'pending' && (!d.nextRetry || d.nextRetry <= new Date()));
            for (const delivery of pendingDeliveries) {
                yield this.processDelivery(delivery);
            }
            this.isProcessing = false;
        });
    }
    // Process a single delivery
    processDelivery(delivery) {
        return __awaiter(this, void 0, void 0, function* () {
            const webhook = this.webhooks.find(w => w.id === delivery.webhookId);
            if (!webhook) {
                delivery.status = 'failed';
                delivery.error = 'Webhook not found';
                return;
            }
            delivery.attempts++;
            delivery.lastAttempt = new Date();
            delivery.status = 'retrying';
            try {
                const response = yield this.sendWebhook(webhook, delivery.payload);
                if (response.statusCode >= 200 && response.statusCode < 300) {
                    delivery.status = 'delivered';
                    delivery.deliveredAt = new Date();
                    delivery.response = response;
                    console.log(`✅ Webhook delivered successfully: ${webhook.name}`);
                }
                else {
                    throw new Error(`HTTP ${response.statusCode}: ${response.body}`);
                }
            }
            catch (error) {
                delivery.error = error instanceof Error ? error.message : 'Unknown error';
                if (delivery.attempts >= delivery.maxAttempts) {
                    delivery.status = 'failed';
                    console.error(`❌ Webhook delivery failed permanently: ${webhook.name} - ${delivery.error}`);
                }
                else {
                    delivery.nextRetry = this.calculateNextRetry(delivery.attempts);
                    console.warn(`⚠️ Webhook delivery failed, will retry: ${webhook.name} - ${delivery.error}`);
                }
            }
        });
    }
    // Send webhook HTTP request
    sendWebhook(webhook, payload) {
        return __awaiter(this, void 0, void 0, function* () {
            const headers = {
                'Content-Type': 'application/json',
                'User-Agent': 'ShiftPlanner-Webhook/1.0',
            };
            // Add signature if secret is provided
            if (webhook.secret) {
                const signature = this.generateSignature(payload, webhook.secret);
                headers['X-Webhook-Signature'] = signature;
            }
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), webhook.timeout);
            try {
                const response = yield fetch(webhook.url, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(payload),
                    signal: controller.signal,
                });
                clearTimeout(timeoutId);
                const responseBody = yield response.text();
                return {
                    statusCode: response.status,
                    headers: Object.fromEntries(response.headers.entries()),
                    body: responseBody,
                };
            }
            catch (error) {
                clearTimeout(timeoutId);
                throw error;
            }
        });
    }
    // Generate webhook signature
    generateSignature(payload, secret) {
        const payloadString = JSON.stringify(payload);
        return (0, crypto_1.createHmac)('sha256', secret).update(payloadString).digest('hex');
    }
    // Calculate next retry time
    calculateNextRetry(attempt) {
        const baseDelay = 1000; // 1 second
        const maxDelay = 300000; // 5 minutes
        const delay = Math.min(baseDelay * Math.pow(2, attempt - 1), maxDelay);
        return new Date(Date.now() + delay);
    }
    // Public API methods
    createWebhook(webhookData) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            const webhook = {
                id: `webhook_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                name: webhookData.name || 'New Webhook',
                url: webhookData.url || '',
                events: webhookData.events || [],
                secret: webhookData.secret,
                isActive: (_a = webhookData.isActive) !== null && _a !== void 0 ? _a : true,
                retryCount: 0,
                maxRetries: webhookData.maxRetries || 3,
                timeout: webhookData.timeout || 10000,
                createdAt: new Date(),
                updatedAt: new Date(),
            };
            this.webhooks.push(webhook);
            return webhook;
        });
    }
    updateWebhook(id, updates) {
        return __awaiter(this, void 0, void 0, function* () {
            const webhook = this.webhooks.find(w => w.id === id);
            if (!webhook)
                return null;
            Object.assign(webhook, updates, { updatedAt: new Date() });
            return webhook;
        });
    }
    deleteWebhook(id) {
        return __awaiter(this, void 0, void 0, function* () {
            const index = this.webhooks.findIndex(w => w.id === id);
            if (index === -1)
                return false;
            this.webhooks.splice(index, 1);
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
    getDeliveries(filters) {
        return __awaiter(this, void 0, void 0, function* () {
            let filtered = this.deliveries;
            if (filters === null || filters === void 0 ? void 0 : filters.webhookId) {
                filtered = filtered.filter(d => d.webhookId === filters.webhookId);
            }
            if (filters === null || filters === void 0 ? void 0 : filters.status) {
                filtered = filtered.filter(d => d.status === filters.status);
            }
            if (filters === null || filters === void 0 ? void 0 : filters.event) {
                filtered = filtered.filter(d => d.event === filters.event);
            }
            if (filters === null || filters === void 0 ? void 0 : filters.startDate) {
                filtered = filtered.filter(d => d.createdAt >= filters.startDate);
            }
            if (filters === null || filters === void 0 ? void 0 : filters.endDate) {
                filtered = filtered.filter(d => d.createdAt <= filters.endDate);
            }
            if (filters === null || filters === void 0 ? void 0 : filters.limit) {
                filtered = filtered.slice(0, filters.limit);
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
            if (!delivery || delivery.status === 'delivered')
                return null;
            delivery.status = 'pending';
            delivery.nextRetry = new Date();
            delivery.error = undefined;
            return delivery;
        });
    }
    getWebhookStats() {
        return __awaiter(this, void 0, void 0, function* () {
            const totalDeliveries = this.deliveries.length;
            const deliveredDeliveries = this.deliveries.filter(d => d.status === 'delivered');
            const failedDeliveries = this.deliveries.filter(d => d.status === 'failed');
            const pendingDeliveries = this.deliveries.filter(d => d.status === 'pending');
            const retryingDeliveries = this.deliveries.filter(d => d.status === 'retrying');
            const eventCounts = {};
            this.deliveries.forEach(d => {
                eventCounts[d.event] = (eventCounts[d.event] || 0) + 1;
            });
            const averageDeliveryTime = deliveredDeliveries.length > 0
                ? deliveredDeliveries.reduce((sum, d) => {
                    if (d.deliveredAt) {
                        return sum + (d.deliveredAt.getTime() - d.createdAt.getTime());
                    }
                    return sum;
                }, 0) / deliveredDeliveries.length
                : 0;
            const successRate = totalDeliveries > 0 ? deliveredDeliveries.length / totalDeliveries : 0;
            const averageRetries = totalDeliveries > 0
                ? this.deliveries.reduce((sum, d) => sum + d.attempts, 0) / totalDeliveries
                : 0;
            return {
                total: this.webhooks.length,
                active: this.webhooks.filter(w => w.isActive).length,
                deliveries: {
                    total: totalDeliveries,
                    pending: pendingDeliveries.length,
                    delivered: deliveredDeliveries.length,
                    failed: failedDeliveries.length,
                    retrying: retryingDeliveries.length,
                },
                events: eventCounts,
                performance: {
                    averageDeliveryTime,
                    successRate,
                    averageRetries,
                },
            };
        });
    }
    testWebhook(webhookId) {
        return __awaiter(this, void 0, void 0, function* () {
            const webhook = this.webhooks.find(w => w.id === webhookId);
            if (!webhook)
                return false;
            const testPayload = {
                event: 'test',
                timestamp: new Date().toISOString(),
                data: {
                    message: 'This is a test webhook from ShiftPlanner',
                    timestamp: new Date().toISOString(),
                },
                metadata: {
                    webhookId: webhook.id,
                    attempt: 1,
                    source: 'test',
                },
            };
            try {
                yield this.sendWebhook(webhook, testPayload);
                console.log(`✅ Test webhook sent successfully: ${webhook.name}`);
                return true;
            }
            catch (error) {
                console.error(`❌ Test webhook failed: ${webhook.name} - ${error}`);
                return false;
            }
        });
    }
    // Cleanup tasks
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
