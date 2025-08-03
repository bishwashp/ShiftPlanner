// Development Configuration for ShiftPlanner
// This file contains optimized settings for development environment

module.exports = {
  // Rate Limiting - Higher limits for development
  rateLimits: {
    api: {
      windowMs: 15 * 60 * 1000, // 15 minutes
      maxRequests: 1000, // 1000 requests per 15 minutes (vs 100 in production)
      message: 'Too many requests from this IP',
      statusCode: 429,
    },
    auth: {
      windowMs: 15 * 60 * 1000, // 15 minutes
      maxRequests: 50, // 50 requests per 15 minutes (vs 5 in production)
      message: 'Too many authentication attempts',
      statusCode: 429,
    },
    graphql: {
      windowMs: 15 * 60 * 1000, // 15 minutes
      maxRequests: 2000, // 2000 requests per 15 minutes (vs 200 in production)
      message: 'Too many GraphQL requests',
      statusCode: 429,
    },
  },

  // Cache Configuration
  cache: {
    ttl: 300, // 5 minutes default TTL
    maxSize: 1000, // Maximum cache entries
  },

  // API Configuration
  api: {
    timeout: 10000, // 10 seconds
    retryAttempts: 3,
    retryDelay: 1000, // 1 second
  },

  // Logging Configuration
  logging: {
    level: 'debug',
    enableRequestLogging: true,
    enablePerformanceLogging: true,
  },

  // Development-specific settings
  development: {
    enableHotReload: true,
    enableDebugMode: true,
    skipAuthentication: true, // Skip auth for development
    enableMockData: false,
  },
}; 