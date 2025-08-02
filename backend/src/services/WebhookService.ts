import { createHmac } from 'crypto';

// Types and interfaces
interface Webhook {
  id: string;
  name: string;
  url: string;
  events: string[];
  secret?: string;
  isActive: boolean;
  retryCount: number;
  maxRetries: number;
  timeout: number;
  createdAt: Date;
  updatedAt: Date;
}

interface WebhookDelivery {
  id: string;
  webhookId: string;
  event: string;
  payload: any;
  status: 'pending' | 'delivered' | 'failed' | 'retrying';
  attempts: number;
  maxAttempts: number;
  lastAttempt?: Date;
  nextRetry?: Date;
  response?: {
    statusCode: number;
    headers: any;
    body: string;
  };
  error?: string;
  createdAt: Date;
  deliveredAt?: Date;
}

interface WebhookPayload {
  event: string;
  timestamp: string;
  data: any;
  metadata: {
    webhookId: string;
    attempt: number;
    source: string;
  };
}

interface DeliveryFilters {
  webhookId?: string;
  status?: string;
  event?: string;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
}

interface WebhookStats {
  total: number;
  active: number;
  deliveries: {
    total: number;
    pending: number;
    delivered: number;
    failed: number;
    retrying: number;
  };
  events: {
    [key: string]: number;
  };
  performance: {
    averageDeliveryTime: number;
    successRate: number;
    averageRetries: number;
  };
}

export class WebhookService {
  private webhooks: Webhook[] = [];
  private deliveries: WebhookDelivery[] = [];
  private isProcessing: boolean = false;

  constructor() {
    this.initializeDefaultWebhooks();
    this.startDeliveryProcessor();
    this.startCleanupTasks();
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
  async triggerWebhooks(event: string, data: any, source: string = 'system'): Promise<void> {
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
  private async createDelivery(webhook: Webhook, event: string, data: any, source: string): Promise<void> {
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
    };

    this.deliveries.push(delivery);
    console.log(`📡 Created delivery ${delivery.id} for webhook ${webhook.name}`);
  }

  // Start the delivery processor
  private startDeliveryProcessor(): void {
    // Process pending deliveries every 5 seconds
    setInterval(async () => {
      if (!this.isProcessing) {
        await this.processPendingDeliveries();
      }
    }, 5000);

    console.log('📡 Webhook delivery processor started');
  }

  // Process pending deliveries
  private async processPendingDeliveries(): Promise<void> {
    if (this.isProcessing) return;

    this.isProcessing = true;
    const pendingDeliveries = this.deliveries.filter(d => 
      d.status === 'pending' && (!d.nextRetry || d.nextRetry <= new Date())
    );

    for (const delivery of pendingDeliveries) {
      await this.processDelivery(delivery);
    }

    this.isProcessing = false;
  }

  // Process a single delivery
  private async processDelivery(delivery: WebhookDelivery): Promise<void> {
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
      const response = await this.sendWebhook(webhook, delivery.payload);
      
      if (response.statusCode >= 200 && response.statusCode < 300) {
        delivery.status = 'delivered';
        delivery.deliveredAt = new Date();
        delivery.response = response;
        console.log(`✅ Webhook delivered successfully: ${webhook.name}`);
      } else {
        throw new Error(`HTTP ${response.statusCode}: ${response.body}`);
      }
    } catch (error) {
      delivery.error = error instanceof Error ? error.message : 'Unknown error';
      
      if (delivery.attempts >= delivery.maxAttempts) {
        delivery.status = 'failed';
        console.error(`❌ Webhook delivery failed permanently: ${webhook.name} - ${delivery.error}`);
      } else {
        delivery.nextRetry = this.calculateNextRetry(delivery.attempts);
        console.warn(`⚠️ Webhook delivery failed, will retry: ${webhook.name} - ${delivery.error}`);
      }
    }
  }

  // Send webhook HTTP request
  private async sendWebhook(webhook: Webhook, payload: WebhookPayload): Promise<any> {
    const headers: Record<string, string> = {
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
      const response = await fetch(webhook.url, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      const responseBody = await response.text();

      return {
        statusCode: response.status,
        headers: Object.fromEntries(response.headers.entries()),
        body: responseBody,
      };
    } catch (error) {
      clearTimeout(timeoutId);
      throw error;
    }
  }

  // Generate webhook signature
  private generateSignature(payload: WebhookPayload, secret: string): string {
    const payloadString = JSON.stringify(payload);
    return createHmac('sha256', secret).update(payloadString).digest('hex');
  }

  // Calculate next retry time
  private calculateNextRetry(attempt: number): Date {
    const baseDelay = 1000; // 1 second
    const maxDelay = 300000; // 5 minutes
    const delay = Math.min(baseDelay * Math.pow(2, attempt - 1), maxDelay);
    return new Date(Date.now() + delay);
  }

  // Public API methods
  async createWebhook(webhookData: Partial<Webhook>): Promise<Webhook> {
    const webhook: Webhook = {
      id: `webhook_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name: webhookData.name || 'New Webhook',
      url: webhookData.url || '',
      events: webhookData.events || [],
      secret: webhookData.secret,
      isActive: webhookData.isActive ?? true,
      retryCount: 0,
      maxRetries: webhookData.maxRetries || 3,
      timeout: webhookData.timeout || 10000,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.webhooks.push(webhook);
    return webhook;
  }

  async updateWebhook(id: string, updates: Partial<Webhook>): Promise<Webhook | null> {
    const webhook = this.webhooks.find(w => w.id === id);
    if (!webhook) return null;

    Object.assign(webhook, updates, { updatedAt: new Date() });
    return webhook;
  }

  async deleteWebhook(id: string): Promise<boolean> {
    const index = this.webhooks.findIndex(w => w.id === id);
    if (index === -1) return false;

    this.webhooks.splice(index, 1);
    return true;
  }

  async getWebhooks(): Promise<Webhook[]> {
    return this.webhooks;
  }

  async getWebhook(id: string): Promise<Webhook | null> {
    return this.webhooks.find(w => w.id === id) || null;
  }

  async getDeliveries(filters?: DeliveryFilters): Promise<WebhookDelivery[]> {
    let filtered = this.deliveries;

    if (filters?.webhookId) {
      filtered = filtered.filter(d => d.webhookId === filters.webhookId);
    }

    if (filters?.status) {
      filtered = filtered.filter(d => d.status === filters.status);
    }

    if (filters?.event) {
      filtered = filtered.filter(d => d.event === filters.event);
    }

    if (filters?.startDate) {
      filtered = filtered.filter(d => d.createdAt >= filters.startDate!);
    }

    if (filters?.endDate) {
      filtered = filtered.filter(d => d.createdAt <= filters.endDate!);
    }

    if (filters?.limit) {
      filtered = filtered.slice(0, filters.limit);
    }

    return filtered.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async getDelivery(id: string): Promise<WebhookDelivery | null> {
    return this.deliveries.find(d => d.id === id) || null;
  }

  async retryDelivery(id: string): Promise<WebhookDelivery | null> {
    const delivery = this.deliveries.find(d => d.id === id);
    if (!delivery || delivery.status === 'delivered') return null;

    delivery.status = 'pending';
    delivery.nextRetry = new Date();
    delivery.error = undefined;

    return delivery;
  }

  async getWebhookStats(): Promise<WebhookStats> {
    const totalDeliveries = this.deliveries.length;
    const deliveredDeliveries = this.deliveries.filter(d => d.status === 'delivered');
    const failedDeliveries = this.deliveries.filter(d => d.status === 'failed');
    const pendingDeliveries = this.deliveries.filter(d => d.status === 'pending');
    const retryingDeliveries = this.deliveries.filter(d => d.status === 'retrying');

    const eventCounts: Record<string, number> = {};
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
  }

  async testWebhook(webhookId: string): Promise<boolean> {
    const webhook = this.webhooks.find(w => w.id === webhookId);
    if (!webhook) return false;

    const testPayload: WebhookPayload = {
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
      await this.sendWebhook(webhook, testPayload);
      console.log(`✅ Test webhook sent successfully: ${webhook.name}`);
      return true;
    } catch (error) {
      console.error(`❌ Test webhook failed: ${webhook.name} - ${error}`);
      return false;
    }
  }

  // Cleanup tasks
  private startCleanupTasks(): void {
    // Clean up old deliveries every hour
    setInterval(() => {
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      this.deliveries = this.deliveries.filter(d => d.createdAt > thirtyDaysAgo);
    }, 60 * 60 * 1000); // 1 hour
  }
}

export const webhookService = new WebhookService(); 