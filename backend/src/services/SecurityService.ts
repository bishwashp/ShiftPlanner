import { randomBytes } from 'crypto';
import { cacheService } from '../lib/cache';
import { Request, Response, NextFunction } from 'express';

// Types and interfaces
interface SecurityConfig {
  jwtSecret: string;
  jwtExpiresIn: string;
  refreshTokenExpiresIn: string;
  bcryptRounds: number;
  rateLimits: {
    api: RateLimitConfig;
    auth: RateLimitConfig;
    graphql: RateLimitConfig;
  };
  corsOrigins: string[];
  sessionTimeout: number;
}

interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
  message: string;
  statusCode: number;
}

interface User {
  id: string;
  email: string;
  role: 'admin' | 'manager' | 'user';
  permissions: string[];
  isActive: boolean;
  lastLogin?: Date;
  createdAt: Date;
  updatedAt: Date;
}

interface AuthToken {
  token: string;
  userId: string;
  expiresAt: Date;
  type: 'access' | 'refresh';
  ipAddress: string;
  userAgent: string;
}

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

interface AuditLog {
  id: string;
  userId?: string;
  action: string;
  resource: string;
  resourceId?: string;
  details: any;
  ipAddress: string;
  userAgent: string;
  timestamp: Date;
  success: boolean;
}

interface AuditLogFilters {
  userId?: string;
  action?: string;
  resource?: string;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
}

interface RateLimitStatus {
  current: number;
  limit: number;
  resetTime: number;
}

export class SecurityService {
  private rateLimitStore: Map<string, RateLimitEntry> = new Map();
  private auditLogs: AuditLog[] = [];
  private config: SecurityConfig;

  constructor() {
    this.config = this.loadSecurityConfig();
    this.startCleanupTasks();
  }

  // Load security configuration from environment variables
  private loadSecurityConfig(): SecurityConfig {
    return {
      jwtSecret: process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production',
      jwtExpiresIn: process.env.JWT_EXPIRES_IN || '15m',
      refreshTokenExpiresIn: process.env.REFRESH_TOKEN_EXPIRES_IN || '7d',
      bcryptRounds: parseInt(process.env.BCRYPT_ROUNDS || '12'),
      rateLimits: {
        api: {
          windowMs: 15 * 60 * 1000, // 15 minutes
          maxRequests: parseInt(process.env.RATE_LIMIT_API || '500'),
          message: 'Too many requests from this IP',
          statusCode: 429,
        },
        auth: {
          windowMs: 15 * 60 * 1000, // 15 minutes
          maxRequests: parseInt(process.env.RATE_LIMIT_AUTH || '5'),
          message: 'Too many authentication attempts',
          statusCode: 429,
        },
        graphql: {
          windowMs: 15 * 60 * 1000, // 15 minutes
          maxRequests: parseInt(process.env.RATE_LIMIT_GRAPHQL || '200'),
          message: 'Too many GraphQL requests',
          statusCode: 429,
        },
      },
      corsOrigins: process.env.CORS_ORIGINS?.split(',') || ['http://localhost:3000'],
      sessionTimeout: parseInt(process.env.SESSION_TIMEOUT || '3600000'), // 1 hour
    };
  }

  // Authentication methods
  async authenticateUser(email: string, password: string): Promise<User | null> {
    try {
      // In a real implementation, you would hash the password and compare with stored hash
      // For now, we'll use a simple mock authentication
      const user = await this.findUserByEmail(email);
      if (!user || !user.isActive) {
        await this.logAuditEvent('AUTH_FAILED', 'user', undefined, {
          email,
          reason: 'Invalid credentials or inactive user',
        });
        return null;
      }

      // Mock password verification (replace with bcrypt.compare in production)
      if (password !== 'password123') {
        await this.logAuditEvent('AUTH_FAILED', 'user', undefined, {
          email,
          reason: 'Invalid password',
        });
        return null;
      }

      // Update last login
      user.lastLogin = new Date();
      await this.logAuditEvent('AUTH_SUCCESS', 'user', user.id, {
        email,
        role: user.role,
      });

      return user;
    } catch (error) {
      await this.logAuditEvent('AUTH_ERROR', 'user', undefined, {
        email,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  async generateAuthToken(user: User, ipAddress: string, userAgent: string): Promise<AuthToken> {
    const token = this.generateSecureToken();
    const expiresAt = new Date(Date.now() + this.parseJwtExpiresIn(this.config.jwtExpiresIn));
    
    const authToken: AuthToken = {
      token,
      userId: user.id,
      expiresAt,
      type: 'access',
      ipAddress,
      userAgent,
    };

    // Store token in cache for quick validation
    await cacheService.set(`auth_token:${token}`, authToken, this.parseJwtExpiresIn(this.config.jwtExpiresIn) / 1000);
    
    await this.logAuditEvent('TOKEN_GENERATED', 'auth', user.id, {
      tokenType: 'access',
      expiresAt,
    });

    return authToken;
  }

  async validateAuthToken(token: string): Promise<User | null> {
    try {
      const cachedToken = await cacheService.get(`auth_token:${token}`);
      if (!cachedToken) {
        return null;
      }

      const authToken = cachedToken as AuthToken;
      if (authToken.expiresAt < new Date()) {
        await cacheService.del(`auth_token:${token}`);
        return null;
      }

      const user = await this.findUserById(authToken.userId);
      if (!user || !user.isActive) {
        await cacheService.del(`auth_token:${token}`);
        return null;
      }

      return user;
    } catch (error) {
      console.error('Token validation error:', error);
      return null;
    }
  }

  async revokeAuthToken(token: string): Promise<boolean> {
    try {
      await cacheService.del(`auth_token:${token}`);
      await this.logAuditEvent('TOKEN_REVOKED', 'auth', undefined, {
        token: token.substring(0, 10) + '...',
      });
      return true;
    } catch (error) {
      console.error('Token revocation error:', error);
      return false;
    }
  }

  // Authorization methods
  async checkPermission(user: User, permission: string): Promise<boolean> {
    return user.permissions.includes(permission) || user.role === 'admin';
  }

  async checkResourceAccess(user: User, resource: string, resourceId?: string): Promise<boolean> {
    // Admin has access to everything
    if (user.role === 'admin') return true;

    // Manager has access to most resources
    if (user.role === 'manager') {
      return ['analysts', 'schedules', 'constraints', 'analytics'].includes(resource);
    }

    // Regular users have limited access
    if (user.role === 'user') {
      return ['schedules', 'analytics'].includes(resource);
    }

    return false;
  }

  // Rate limiting
  async checkRateLimit(identifier: string, config: RateLimitConfig): Promise<boolean> {
    const now = Date.now();
    const key = `rate_limit:${identifier}`;
    const current = this.rateLimitStore.get(key);

    if (!current || now > current.resetTime) {
      // Reset or create new rate limit window
      this.rateLimitStore.set(key, {
        count: 1,
        resetTime: now + config.windowMs,
      });
      return true;
    }

    if (current.count >= config.maxRequests) {
      return false;
    }

    current.count++;
    return true;
  }

  // Rate limiting middleware
  createRateLimitMiddleware(config: RateLimitConfig) {
    return async (req: Request, res: Response, next: NextFunction) => {
      const identifier = req.ip || 'unknown';
      const allowed = await this.checkRateLimit(identifier, config);
      
      if (!allowed) {
        res.status(config.statusCode).json({
          error: 'Rate limit exceeded',
          message: config.message,
          retryAfter: Math.ceil(config.windowMs / 1000),
        });
        return;
      }
      
      next();
    };
  }

  // Authentication middleware
  createAuthMiddleware() {
    return async (req: Request, res: Response, next: NextFunction) => {
      try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
          res.status(401).json({
            error: 'Authentication required',
            message: 'Bearer token is required',
          });
          return;
        }

        const token = authHeader.substring(7);
        const user = await this.validateAuthToken(token);
        
        if (!user) {
          res.status(401).json({
            error: 'Invalid token',
            message: 'Token is invalid or expired',
          });
          return;
        }

        (req as any).user = user;
        next();
      } catch (error) {
        res.status(500).json({
          error: 'Authentication error',
          message: 'Internal server error during authentication',
        });
      }
    };
  }

  // Authorization middleware
  createPermissionMiddleware(permission: string) {
    return async (req: Request, res: Response, next: NextFunction) => {
      try {
        const user = (req as any).user;
        if (!user) {
          res.status(401).json({
            error: 'Authentication required',
            message: 'User must be authenticated',
          });
          return;
        }

        const hasPermission = await this.checkPermission(user, permission);
        if (!hasPermission) {
          res.status(403).json({
            error: 'Permission denied',
            message: `User does not have permission: ${permission}`,
          });
          return;
        }

        next();
      } catch (error) {
        res.status(500).json({
          error: 'Authorization error',
          message: 'Internal server error during authorization',
        });
      }
    };
  }

  // Audit logging
  async logAuditEvent(action: string, resource: string, resourceId: string | undefined, details: any, req?: Request): Promise<void> {
    const auditLog: AuditLog = {
      id: `audit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      userId: (req as any)?.user?.id,
      action,
      resource,
      resourceId,
      details,
      ipAddress: req?.ip || 'unknown',
      userAgent: req?.headers['user-agent'] || 'unknown',
      timestamp: new Date(),
      success: true,
    };

    this.auditLogs.push(auditLog);

    // Keep only last 1000 audit logs
    if (this.auditLogs.length > 1000) {
      this.auditLogs = this.auditLogs.slice(-1000);
    }

    console.log(`🔒 Audit: ${action} on ${resource}${resourceId ? `:${resourceId}` : ''}`);
  }

  async getAuditLogs(filters?: AuditLogFilters): Promise<AuditLog[]> {
    let filtered = this.auditLogs;

    if (filters?.userId) {
      filtered = filtered.filter(log => log.userId === filters.userId);
    }

    if (filters?.action) {
      filtered = filtered.filter(log => log.action === filters.action);
    }

    if (filters?.resource) {
      filtered = filtered.filter(log => log.resource === filters.resource);
    }

    if (filters?.startDate) {
      filtered = filtered.filter(log => log.timestamp >= filters.startDate!);
    }

    if (filters?.endDate) {
      filtered = filtered.filter(log => log.timestamp <= filters.endDate!);
    }

    if (filters?.limit) {
      filtered = filtered.slice(0, filters.limit);
    }

    return filtered.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  // Security utilities
  generateSecureToken(): string {
    return randomBytes(32).toString('hex');
  }

  private parseJwtExpiresIn(expiresIn: string): number {
    const unit = expiresIn.slice(-1);
    const value = parseInt(expiresIn.slice(0, -1));
    
    switch (unit) {
      case 's': return value * 1000;
      case 'm': return value * 60 * 1000;
      case 'h': return value * 60 * 60 * 1000;
      case 'd': return value * 24 * 60 * 60 * 1000;
      default: return 15 * 60 * 1000; // 15 minutes default
    }
  }

  // User management (mock implementation)
  async findUserByEmail(email: string): Promise<User | null> {
    // Mock user data - in production, this would query the database
    const mockUsers: User[] = [
      {
        id: 'user_1',
        email: 'admin@shiftplanner.com',
        role: 'admin',
        permissions: ['*'],
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 'user_2',
        email: 'manager@shiftplanner.com',
        role: 'manager',
        permissions: ['analysts:read', 'analysts:write', 'schedules:read', 'schedules:write'],
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 'user_3',
        email: 'user@shiftplanner.com',
        role: 'user',
        permissions: ['schedules:read', 'analytics:read'],
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];

    return mockUsers.find(user => user.email === email) || null;
  }

  async findUserById(id: string): Promise<User | null> {
    // Mock user data - in production, this would query the database
    const mockUsers: User[] = [
      {
        id: 'user_1',
        email: 'admin@shiftplanner.com',
        role: 'admin',
        permissions: ['*'],
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 'user_2',
        email: 'manager@shiftplanner.com',
        role: 'manager',
        permissions: ['analysts:read', 'analysts:write', 'schedules:read', 'schedules:write'],
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 'user_3',
        email: 'user@shiftplanner.com',
        role: 'user',
        permissions: ['schedules:read', 'analytics:read'],
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];

    return mockUsers.find(user => user.id === id) || null;
  }

  // Cleanup tasks
  private startCleanupTasks(): void {
    // Clean up expired rate limits every hour
    setInterval(() => {
      const now = Date.now();
      for (const [key, value] of this.rateLimitStore.entries()) {
        if (now > value.resetTime) {
          this.rateLimitStore.delete(key);
        }
      }
    }, 60 * 60 * 1000); // 1 hour

    // Clean up old audit logs daily
    setInterval(() => {
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      this.auditLogs = this.auditLogs.filter(log => log.timestamp > thirtyDaysAgo);
    }, 24 * 60 * 60 * 1000); // 24 hours
  }

  // Public API methods
  getConfig(): SecurityConfig {
    return { ...this.config };
  }

  async getRateLimitStatus(identifier: string): Promise<RateLimitStatus | null> {
    const key = `rate_limit:${identifier}`;
    const current = this.rateLimitStore.get(key);
    
    if (!current) return null;

    return {
      current: current.count,
      limit: this.config.rateLimits.api.maxRequests,
      resetTime: current.resetTime,
    };
  }
}

export const securityService = new SecurityService(); 