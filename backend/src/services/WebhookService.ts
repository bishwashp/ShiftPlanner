import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { cacheService } from '../lib/cache';
import { securityService } from './SecurityService';

export interface Webhook {
  id: string;
  name: string;
  url: string;
  events: WebhookEvent[];
  secret?: string;
  isActive: boolean;
  retryCount: number;
  maxRetries: number;
  timeout: number;
  createdAt: Date;
  updatedAt: Date;
  lastTriggered?: Date;
  lastSuccess?: Date;
  lastError?: string;
}

export type WebhookEvent = 
  | 'schedule.created'
  | 'schedule.updated'
  | 'schedule.deleted'
  | 'analyst.created'
  | 'analyst.updated'
  | 'analyst.deleted'
  | 'constraint.created'
  | 'constraint.updated'
  | 'constraint.deleted'
  | 'algorithm.executed'
  | 'conflict.detected'
  | 'alert.triggered'
  | 'system.health.degraded';

export interface WebhookPayload {
  event: WebhookEvent;
  timestamp: string;
  data: any;
  metadata: {
    webhookId: string;
    attempt: number;
    source: string;
  };
}

export interface WebhookDelivery {
  id: string;
  webhookId: string;
  event: WebhookEvent;
  payload: WebhookPayload;
  status: 'pending' | 'delivered' | 'failed' | 'retrying';
  attempts: number;
  maxAttempts: number;
  nextRetryAt?: Date;
  deliveredAt?: Date;
  error?: string;
  responseCode?: number;
  responseBody?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface WebhookStats {
  totalWebhooks: number;
  activeWebhooks: number;
  totalDeliveries: number;
  successfulDeliveries: number;
  failedDeliveries: number;
  pendingDeliveries: number;
  averageDeliveryTime: number;
  successRate: number;
}

export class WebhookService {
  private webhooks: Webhook[] = [];
  private deliveries: WebhookDelivery[] = [];
  private isProcessing = false;

  constructor() {
    this.initializeDefaultWebhooks();
    this.startDeliveryProcessor();
  }

  // Initialize default webhooks for common integrations
  private initializeDefaultWebhooks(): void {
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
  async triggerWebhooks(event: WebhookEvent, data: any, source: string = 'system'): Promise<void> {
    const activeWebhooks = this.webhooks.filter(webhook => 
      webhook.isActive && webhook.events.includes(event)
    );

    if (activeWebhooks.length === 0) {
      console.log(`📡 No active webhooks for event: ${event}`);
      return;
    }

    console.log(`📡 Triggering ${activeWebhooks.length} webhooks for event: ${event}`);

    for (const webhook of activeWebhooks) {
      await this.createDelivery(webhook, event, data, source);
    }
  }

  // Create a webhook delivery
  private async createDelivery(
    webhook: Webhook,
    event: WebhookEvent,
    data: any,
    source: string
  ): Promise<void> {
    const payload: WebhookPayload = {
      event,
      timestamp: new Date().toISOString(),
      data,
      metadata: {
        webhookId: webhook.id,
        attempt: 1,
        source,
      },
    };

    const delivery: WebhookDelivery = {
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
  }

  // Process pending deliveries
  private async startDeliveryProcessor(): Promise<void> {
    if (this.isProcessing) return;

    this.isProcessing = true;

    // Process deliveries every 5 seconds
    setInterval(async () => {
      await this.processPendingDeliveries();
    }, 5000);

    console.log('📡 Webhook delivery processor started');
  }

  // Process all pending deliveries
  private async processPendingDeliveries(): Promise<void> {
    const pendingDeliveries = this.deliveries.filter(
      delivery => delivery.status === 'pending' || 
                 (delivery.status === 'retrying' && 
                  delivery.nextRetryAt && 
                  delivery.nextRetryAt <= new Date())
    );

    for (const delivery of pendingDeliveries) {
      await this.processDelivery(delivery);
    }
  }

  // Process a single delivery
  private async processDelivery(delivery: WebhookDelivery): Promise<void> {
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

      const response = await this.sendWebhook(webhook, delivery.payload);
      
      if (response.ok) {
        delivery.status = 'delivered';
        delivery.deliveredAt = new Date();
        delivery.responseCode = response.status;
        delivery.responseBody = await response.text();
        webhook.lastSuccess = new Date();
        webhook.retryCount = 0;

        console.log(`✅ Webhook delivered successfully: ${webhook.name}`);
      } else {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
    } catch (error) {
      console.error(`❌ Webhook delivery failed: ${webhook.name}`, error);

      delivery.error = error instanceof Error ? error.message : 'Unknown error';

      if (delivery.attempts >= delivery.maxAttempts) {
        delivery.status = 'failed';
        webhook.lastError = delivery.error;
        console.log(`💀 Webhook delivery failed permanently: ${webhook.name}`);
      } else {
        delivery.status = 'retrying';
        delivery.nextRetryAt = this.calculateNextRetry(delivery.attempts);
        console.log(`🔄 Webhook will retry at ${delivery.nextRetryAt}: ${webhook.name}`);
      }
    }
  }

  // Send webhook HTTP request
  private async sendWebhook(webhook: Webhook, payload: WebhookPayload): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), webhook.timeout);

    try {
      const headers: Record<string, string> = {
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

      const response = await fetch(webhook.url, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      return response;
    } catch (error) {
      clearTimeout(timeoutId);
      throw error;
    }
  }

  // Generate webhook signature
  private generateSignature(payload: WebhookPayload, secret: string): string {
    const crypto = require('crypto');
    const data = JSON.stringify(payload);
    return crypto.createHmac('sha256', secret).update(data).digest('hex');
  }

  // Calculate next retry time with exponential backoff
  private calculateNextRetry(attempt: number): Date {
    const baseDelay = 1000; // 1 second
    const maxDelay = 300000; // 5 minutes
    const delay = Math.min(baseDelay * Math.pow(2, attempt - 1), maxDelay);
    return new Date(Date.now() + delay);
  }

  // Webhook management API
  async createWebhook(webhookData: Omit<Webhook, 'id' | 'createdAt' | 'updatedAt'>): Promise<Webhook> {
    const webhook: Webhook = {
      ...webhookData,
      id: `webhook_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.webhooks.push(webhook);
    console.log(`📡 Created webhook: ${webhook.name}`);

    return webhook;
  }

  async updateWebhook(id: string, updates: Partial<Webhook>): Promise<Webhook | null> {
    const webhook = this.webhooks.find(w => w.id === id);
    if (!webhook) return null;

    Object.assign(webhook, updates, { updatedAt: new Date() });
    console.log(`📡 Updated webhook: ${webhook.name}`);

    return webhook;
  }

  async deleteWebhook(id: string): Promise<boolean> {
    const index = this.webhooks.findIndex(w => w.id === id);
    if (index === -1) return false;

    const webhook = this.webhooks[index];
    this.webhooks.splice(index, 1);
    console.log(`📡 Deleted webhook: ${webhook.name}`);

    return true;
  }

  async getWebhooks(): Promise<Webhook[]> {
    return this.webhooks;
  }

  async getWebhook(id: string): Promise<Webhook | null> {
    return this.webhooks.find(w => w.id === id) || null;
  }

  // Delivery management API
  async getDeliveries(filters?: {
    webhookId?: string;
    event?: WebhookEvent;
    status?: WebhookDelivery['status'];
    startDate?: Date;
    endDate?: Date;
  }): Promise<WebhookDelivery[]> {
    let filtered = this.deliveries;

    if (filters?.webhookId) {
      filtered = filtered.filter(d => d.webhookId === filters.webhookId);
    }

    if (filters?.event) {
      filtered = filtered.filter(d => d.event === filters.event);
    }

    if (filters?.status) {
      filtered = filtered.filter(d => d.status === filters.status);
    }

    if (filters?.startDate) {
      filtered = filtered.filter(d => d.createdAt >= filters.startDate!);
    }

    if (filters?.endDate) {
      filtered = filtered.filter(d => d.createdAt <= filters.endDate!);
    }

    return filtered.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async getDelivery(id: string): Promise<WebhookDelivery | null> {
    return this.deliveries.find(d => d.id === id) || null;
  }

  async retryDelivery(id: string): Promise<WebhookDelivery | null> {
    const delivery = this.deliveries.find(d => d.id === id);
    if (!delivery) return null;

    delivery.status = 'pending';
    delivery.updatedAt = new Date();
    delivery.nextRetryAt = undefined;

    console.log(`🔄 Manually retrying delivery: ${id}`);

    return delivery;
  }

  // Statistics
  async getWebhookStats(): Promise<WebhookStats> {
    const totalDeliveries = this.deliveries.length;
    const successfulDeliveries = this.deliveries.filter(d => d.status === 'delivered').length;
    const failedDeliveries = this.deliveries.filter(d => d.status === 'failed').length;
    const pendingDeliveries = this.deliveries.filter(d => d.status === 'pending' || d.status === 'retrying').length;

    const deliveredDeliveries = this.deliveries.filter(d => d.status === 'delivered' && d.deliveredAt);
    const averageDeliveryTime = deliveredDeliveries.length > 0
      ? deliveredDeliveries.reduce((sum, d) => {
          return sum + (d.deliveredAt!.getTime() - d.createdAt.getTime());
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
  }

  // Test webhook endpoint
  async testWebhook(webhookId: string): Promise<{ success: boolean; error?: string }> {
    const webhook = this.webhooks.find(w => w.id === webhookId);
    if (!webhook) {
      return { success: false, error: 'Webhook not found' };
    }

    const testPayload: WebhookPayload = {
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
      const response = await this.sendWebhook(webhook, testPayload);
      
      if (response.ok) {
        return { success: true };
      } else {
        return { 
          success: false, 
          error: `HTTP ${response.status}: ${response.statusText}` 
        };
      }
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }

  // Cleanup old deliveries
  private startCleanupTasks(): void {
    // Clean up old deliveries every hour
    setInterval(() => {
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      this.deliveries = this.deliveries.filter(d => d.createdAt > thirtyDaysAgo);
    }, 60 * 60 * 1000); // 1 hour
  }
}

export const webhookService = new WebhookService(); 