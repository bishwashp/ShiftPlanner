module.exports = {
  // Database Configuration
  database: {
    url: process.env.DATABASE_URL || 'postgresql://username:password@localhost:5432/shiftplanner',
    pool: {
      min: parseInt(process.env.DATABASE_POOL_MIN) || 5,
      max: parseInt(process.env.DATABASE_POOL_MAX) || 20,
      acquireTimeoutMillis: 30000,
      createTimeoutMillis: 30000,
      destroyTimeoutMillis: 5000,
      idleTimeoutMillis: 30000,
      reapIntervalMillis: 1000,
      createRetryIntervalMillis: 200,
    },
  },

  // Redis Configuration
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT) || 6379,
    password: process.env.REDIS_PASSWORD,
    db: parseInt(process.env.REDIS_DB) || 0,
    maxRetriesPerRequest: 3,
    lazyConnect: true,
    retryDelayOnFailover: 100,
    connectTimeout: 2000,
    commandTimeout: 2000,
  },

  // Server Configuration
  server: {
    port: parseInt(process.env.PORT) || 4000,
    nodeEnv: process.env.NODE_ENV || 'production',
    frontendUrl: process.env.FRONTEND_URL || 'http://localhost:3000',
  },

  // Security Configuration
  security: {
    jwtSecret: process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production',
    jwtExpiresIn: process.env.JWT_EXPIRES_IN || '15m',
    refreshTokenExpiresIn: process.env.REFRESH_TOKEN_EXPIRES_IN || '7d',
    bcryptRounds: parseInt(process.env.BCRYPT_ROUNDS) || 12,
    rateLimits: {
      api: {
        windowMs: 15 * 60 * 1000, // 15 minutes
        maxRequests: parseInt(process.env.RATE_LIMIT_API) || 100,
        message: 'Too many requests from this IP',
        statusCode: 429,
      },
      auth: {
        windowMs: 15 * 60 * 1000, // 15 minutes
        maxRequests: parseInt(process.env.RATE_LIMIT_AUTH) || 5,
        message: 'Too many authentication attempts',
        statusCode: 429,
      },
      graphql: {
        windowMs: 15 * 60 * 1000, // 15 minutes
        maxRequests: parseInt(process.env.RATE_LIMIT_GRAPHQL) || 200,
        message: 'Too many GraphQL requests',
        statusCode: 429,
      },
    },
    corsOrigins: process.env.CORS_ORIGINS?.split(',') || ['http://localhost:3000'],
    sessionTimeout: parseInt(process.env.SESSION_TIMEOUT) || 3600000, // 1 hour
  },

  // Monitoring Configuration
  monitoring: {
    enabled: process.env.MONITORING_ENABLED === 'true',
    metricsCollectionInterval: parseInt(process.env.METRICS_COLLECTION_INTERVAL) || 30000,
    alertingEnabled: process.env.ALERTING_ENABLED === 'true',
  },

  // Alerting Configuration
  alerting: {
    email: process.env.ALERT_EMAIL || 'admin@shiftplanner.com',
    slackWebhookUrl: process.env.SLACK_WEBHOOK_URL,
    alertWebhookUrl: process.env.ALERT_WEBHOOK_URL,
    smsNumber: process.env.ALERT_SMS_NUMBER,
  },

  // Webhook Configuration
  webhooks: {
    calendar: {
      url: process.env.CALENDAR_WEBHOOK_URL || 'https://calendar.example.com/webhook',
      secret: process.env.CALENDAR_WEBHOOK_SECRET,
    },
    slack: {
      url: process.env.SLACK_WEBHOOK_URL || 'https://hooks.slack.com/services/xxx/yyy/zzz',
      secret: process.env.SLACK_WEBHOOK_SECRET,
    },
    analytics: {
      url: process.env.ANALYTICS_WEBHOOK_URL || 'https://analytics.example.com/webhook',
      secret: process.env.ANALYTICS_WEBHOOK_SECRET,
    },
  },

  // Performance Configuration
  performance: {
    compression: {
      enabled: process.env.COMPRESSION_ENABLED === 'true',
      level: parseInt(process.env.COMPRESSION_LEVEL) || 6,
      threshold: parseInt(process.env.COMPRESSION_THRESHOLD) || 1024,
    },
    cdn: {
      provider: process.env.CDN_PROVIDER || 'cloudflare',
      domain: process.env.CDN_DOMAIN || 'api.shiftplanner.com',
      enabled: process.env.CDN_ENABLED === 'true',
    },
  },

  // Cache Configuration
  cache: {
    ttl: {
      schedules: parseInt(process.env.CACHE_TTL_SCHEDULES) || 300, // 5 minutes
      analysts: parseInt(process.env.CACHE_TTL_ANALYSTS) || 600, // 10 minutes
      analytics: parseInt(process.env.CACHE_TTL_ANALYTICS) || 1800, // 30 minutes
      algorithmResults: parseInt(process.env.CACHE_TTL_ALGORITHM_RESULTS) || 3600, // 1 hour
    },
  },

  // GraphQL Configuration
  graphql: {
    introspection: process.env.GRAPHQL_INTROSPECTION === 'true',
    playground: process.env.GRAPHQL_PLAYGROUND === 'true',
    csrfPrevention: process.env.GRAPHQL_CSRF_PREVENTION === 'true',
  },

  // Logging Configuration
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    format: process.env.LOG_FORMAT || 'json',
    file: process.env.LOG_FILE || 'logs/app.log',
  },

  // Health Check Configuration
  healthCheck: {
    interval: parseInt(process.env.HEALTH_CHECK_INTERVAL) || 30000,
    timeout: parseInt(process.env.HEALTH_CHECK_TIMEOUT) || 5000,
  },

  // SSL/TLS Configuration
  ssl: {
    enabled: process.env.SSL_ENABLED === 'true',
    keyPath: process.env.SSL_KEY_PATH,
    certPath: process.env.SSL_CERT_PATH,
  },

  // Backup Configuration
  backup: {
    enabled: process.env.BACKUP_ENABLED === 'true',
    schedule: process.env.BACKUP_SCHEDULE || '0 2 * * *',
    retentionDays: parseInt(process.env.BACKUP_RETENTION_DAYS) || 30,
    s3Bucket: process.env.BACKUP_S3_BUCKET,
  },

  // Email Configuration
  email: {
    smtp: {
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.SMTP_PORT) || 587,
      user: process.env.SMTP_USER || 'notifications@shiftplanner.com',
      pass: process.env.SMTP_PASS,
      secure: process.env.SMTP_SECURE === 'true',
    },
  },

  // SMS Configuration
  sms: {
    provider: process.env.SMS_PROVIDER || 'twilio',
    twilio: {
      accountSid: process.env.TWILIO_ACCOUNT_SID,
      authToken: process.env.TWILIO_AUTH_TOKEN,
      phoneNumber: process.env.TWILIO_PHONE_NUMBER,
    },
  },

  // External API Configuration
  externalApi: {
    timeout: parseInt(process.env.EXTERNAL_API_TIMEOUT) || 10000,
    retries: parseInt(process.env.EXTERNAL_API_RETRIES) || 3,
    retryDelay: parseInt(process.env.EXTERNAL_API_RETRY_DELAY) || 1000,
  },

  // Development overrides
  development: {
    debug: process.env.DEBUG === 'true',
    logLevel: process.env.LOG_LEVEL || 'debug',
    graphqlIntrospection: process.env.GRAPHQL_INTROSPECTION === 'true',
    graphqlPlayground: process.env.GRAPHQL_PLAYGROUND === 'true',
  },
}; 