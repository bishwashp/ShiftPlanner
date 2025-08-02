import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import { createServer } from 'http';
import { prisma, getDatabasePerformance } from './lib/prisma';
import { cacheService } from './lib/cache';
import routes from './routes';
import { createApolloServer, startApolloServer, graphqlHealthCheck } from './graphql/server';
// import { securityService } from './services/SecurityService';
import { monitoringService } from './services/MonitoringService';
// import { alertingService } from './services/AlertingService';
// import { webhookService } from './services/WebhookService';

// Export prisma for use in other modules
export { prisma };

const app = express();
const httpServer = createServer(app);

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
  crossOriginEmbedderPolicy: false,
}));

// CORS configuration
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
}));

// Compression middleware
app.use(compression({
  filter: (req, res) => {
    if (req.headers['x-no-compression']) {
      return false;
    }
    return compression.filter(req, res);
  },
  level: 6,
  threshold: 1024,
}));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Rate limiting middleware for API routes
// app.use('/api', securityService.createRateLimitMiddleware(securityService.getConfig().rateLimits.api));

// Request logging middleware
app.use(async (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const startTime = Date.now();
  
  // Log request start
  // await securityService.logAuditEvent('REQUEST_START', 'api', undefined, {
  //   method: req.method,
  //   url: req.url,
  //   ip: req.ip,
  //   userAgent: req.headers['user-agent'],
  // }, req);

  // Override res.end to log response
  const originalEnd = res.end;
  res.end = function(this: any, chunk?: any, encoding?: any) {
    const duration = Date.now() - startTime;
    
    // Log request completion
    // securityService.logAuditEvent('REQUEST_END', 'api', undefined, {
    //   method: req.method,
    //   url: req.url,
    //   statusCode: res.statusCode,
    //   duration,
    // }, req);

    return originalEnd.call(this, chunk, encoding);
  };

  next();
});

// Authentication middleware for protected routes
// app.use('/api/analysts', securityService.createAuthMiddleware());
// app.use('/api/schedules', securityService.createAuthMiddleware());
// app.use('/api/algorithms', securityService.createAuthMiddleware());
// app.use('/api/constraints', securityService.createAuthMiddleware());
// app.use('/api/analytics', securityService.createAuthMiddleware());
// app.use('/api/monitoring', securityService.createAuthMiddleware());

// Health check endpoint with database, cache, and GraphQL performance metrics
app.get('/health', async (req, res) => {
  try {
    // Test database connection
    await prisma.$queryRaw`SELECT 1`;
    
    // Test cache connection
    const cacheHealthy = await cacheService.healthCheck();
    
    // Test GraphQL server
    const graphqlHealth = await graphqlHealthCheck();
    
    const performanceMetrics = getDatabasePerformance();
    const cacheStats = await cacheService.getStats();
    
    res.json({ 
      status: 'ok', 
      timestamp: new Date().toISOString(),
      version: '1.0.0',
      database: {
        status: 'connected',
        performance: performanceMetrics
      },
      cache: {
        status: cacheHealthy ? 'connected' : 'disconnected',
        stats: cacheStats
      },
      graphql: {
        status: graphqlHealth.status,
        message: graphqlHealth.message
      }
    });
  } catch (error) {
    res.status(503).json({
      status: 'error',
      timestamp: new Date().toISOString(),
      version: '1.0.0',
      database: {
        status: 'disconnected',
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      cache: {
        status: 'unknown'
      },
      graphql: {
        status: 'unknown',
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    });
  }
});

// Database performance endpoint
app.get('/health/db-performance', (req, res) => {
  const metrics = getDatabasePerformance();
  res.json({
    timestamp: new Date().toISOString(),
    metrics
  });
});

// Cache performance endpoint
app.get('/health/cache-performance', async (req, res) => {
  try {
    const stats = await cacheService.getStats();
    const healthy = await cacheService.healthCheck();
    
    res.json({
      timestamp: new Date().toISOString(),
      healthy,
      stats
    });
  } catch (error) {
    res.status(503).json({
      timestamp: new Date().toISOString(),
      healthy: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// GraphQL performance endpoint
app.get('/health/graphql-performance', async (req, res) => {
  try {
    const health = await graphqlHealthCheck();
    
    res.json({
      timestamp: new Date().toISOString(),
      health
    });
  } catch (error) {
    res.status(503).json({
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Cache warming endpoint
app.post('/health/warm-cache', async (req, res) => {
  try {
    await cacheService.warmCache();
    res.json({
      timestamp: new Date().toISOString(),
      status: 'Cache warmed successfully'
    });
  } catch (error) {
    res.status(500).json({
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Failed to warm cache'
    });
  }
});

// API routes
app.use('/api', routes);

// GraphQL endpoint info
app.get('/graphql', (req, res) => {
  res.json({
    message: 'GraphQL endpoint',
    playground: '/graphql',
    documentation: 'Use GraphQL Playground for interactive queries',
    examples: {
      health: `
        query {
          health {
            status
            timestamp
            version
            database {
              status
              performance {
                totalQueries
                averageDuration
              }
            }
            cache {
              status
              stats {
                keys
                hitRate
              }
            }
          }
        }
      `,
      analysts: `
        query {
          analysts {
            id
            name
            email
            shiftType
            isActive
            totalWorkDays
            screenerDays
            weekendDays
            fairnessScore
          }
        }
      `,
      schedulePreview: `
        query {
          generateSchedulePreview(input: {
            startDate: "2025-01-01"
            endDate: "2025-01-07"
            algorithmType: "WeekendRotationAlgorithm"
          }) {
            startDate
            endDate
            algorithmType
            summary {
              totalDays
              totalSchedules
              fairnessScore
              executionTime
            }
            fairnessMetrics {
              overallFairnessScore
              recommendations
            }
            performanceMetrics {
              algorithmExecutionTime
              memoryUsage
            }
          }
        }
      `
    }
  });
});

// Error handling middleware
app.use(async (err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  // Track error with monitoring service
  await monitoringService.trackError(err, {
    url: req.url,
    method: req.method,
    ip: req.ip,
    userAgent: req.headers['user-agent'],
  });

  // Log audit event
  // await securityService.logAuditEvent('ERROR', 'api', undefined, {
  //   error: err.message,
  //   stack: err.stack,
  //   url: req.url,
  //   method: req.method,
  // }, req);

  console.error('Express Error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Not found',
    message: `Route ${req.originalUrl} not found`,
    availableEndpoints: {
      health: '/health',
      api: '/api',
      graphql: '/graphql',
      graphqlPlayground: '/graphql'
    }
  });
});

export { app, httpServer };
