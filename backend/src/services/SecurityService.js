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
exports.securityService = exports.SecurityService = void 0;
const crypto_1 = require("crypto");
const cache_1 = require("../lib/cache");
class SecurityService {
    constructor() {
        this.rateLimitStore = new Map();
        this.auditLogs = [];
        this.config = this.loadSecurityConfig();
        this.startCleanupTasks();
    }
    // Load security configuration from environment variables
    loadSecurityConfig() {
        var _a;
        return {
            jwtSecret: process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production',
            jwtExpiresIn: process.env.JWT_EXPIRES_IN || '15m',
            refreshTokenExpiresIn: process.env.REFRESH_TOKEN_EXPIRES_IN || '7d',
            bcryptRounds: parseInt(process.env.BCRYPT_ROUNDS || '12'),
            rateLimits: {
                api: {
                    windowMs: 15 * 60 * 1000, // 15 minutes
                    maxRequests: parseInt(process.env.RATE_LIMIT_API || '100'),
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
            corsOrigins: ((_a = process.env.CORS_ORIGINS) === null || _a === void 0 ? void 0 : _a.split(',')) || ['http://localhost:3000'],
            sessionTimeout: parseInt(process.env.SESSION_TIMEOUT || '3600000'), // 1 hour
        };
    }
    // Authentication methods
    authenticateUser(email, password) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                // In a real implementation, you would hash the password and compare with stored hash
                // For now, we'll use a simple mock authentication
                const user = yield this.findUserByEmail(email);
                if (!user || !user.isActive) {
                    yield this.logAuditEvent('AUTH_FAILED', 'user', undefined, {
                        email,
                        reason: 'Invalid credentials or inactive user',
                    });
                    return null;
                }
                // Mock password verification (replace with bcrypt.compare in production)
                if (password !== 'password123') {
                    yield this.logAuditEvent('AUTH_FAILED', 'user', undefined, {
                        email,
                        reason: 'Invalid password',
                    });
                    return null;
                }
                // Update last login
                user.lastLogin = new Date();
                yield this.logAuditEvent('AUTH_SUCCESS', 'user', user.id, {
                    email,
                    role: user.role,
                });
                return user;
            }
            catch (error) {
                yield this.logAuditEvent('AUTH_ERROR', 'user', undefined, {
                    email,
                    error: error instanceof Error ? error.message : 'Unknown error',
                });
                throw error;
            }
        });
    }
    generateAuthToken(user, ipAddress, userAgent) {
        return __awaiter(this, void 0, void 0, function* () {
            const token = this.generateSecureToken();
            const expiresAt = new Date(Date.now() + this.parseJwtExpiresIn(this.config.jwtExpiresIn));
            const authToken = {
                token,
                userId: user.id,
                expiresAt,
                type: 'access',
                ipAddress,
                userAgent,
            };
            // Store token in cache for quick validation
            yield cache_1.cacheService.set(`auth_token:${token}`, authToken, this.parseJwtExpiresIn(this.config.jwtExpiresIn) / 1000);
            yield this.logAuditEvent('TOKEN_GENERATED', 'auth', user.id, {
                tokenType: 'access',
                expiresAt,
            });
            return authToken;
        });
    }
    validateAuthToken(token) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const cachedToken = yield cache_1.cacheService.get(`auth_token:${token}`);
                if (!cachedToken) {
                    return null;
                }
                const authToken = cachedToken;
                if (authToken.expiresAt < new Date()) {
                    yield cache_1.cacheService.del(`auth_token:${token}`);
                    return null;
                }
                const user = yield this.findUserById(authToken.userId);
                if (!user || !user.isActive) {
                    yield cache_1.cacheService.del(`auth_token:${token}`);
                    return null;
                }
                return user;
            }
            catch (error) {
                console.error('Token validation error:', error);
                return null;
            }
        });
    }
    revokeAuthToken(token) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                yield cache_1.cacheService.del(`auth_token:${token}`);
                yield this.logAuditEvent('TOKEN_REVOKED', 'auth', undefined, {
                    token: token.substring(0, 10) + '...',
                });
                return true;
            }
            catch (error) {
                console.error('Token revocation error:', error);
                return false;
            }
        });
    }
    // Authorization methods
    checkPermission(user, permission) {
        return __awaiter(this, void 0, void 0, function* () {
            return user.permissions.includes(permission) || user.role === 'admin';
        });
    }
    checkResourceAccess(user, resource, resourceId) {
        return __awaiter(this, void 0, void 0, function* () {
            // Admin has access to everything
            if (user.role === 'admin')
                return true;
            // Manager has access to most resources
            if (user.role === 'manager') {
                return ['analysts', 'schedules', 'constraints', 'analytics'].includes(resource);
            }
            // Regular users have limited access
            if (user.role === 'user') {
                return ['schedules', 'analytics'].includes(resource);
            }
            return false;
        });
    }
    // Rate limiting
    checkRateLimit(identifier, config) {
        return __awaiter(this, void 0, void 0, function* () {
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
        });
    }
    // Rate limiting middleware
    createRateLimitMiddleware(config) {
        return (req, res, next) => __awaiter(this, void 0, void 0, function* () {
            const identifier = req.ip || 'unknown';
            const allowed = yield this.checkRateLimit(identifier, config);
            if (!allowed) {
                res.status(config.statusCode).json({
                    error: 'Rate limit exceeded',
                    message: config.message,
                    retryAfter: Math.ceil(config.windowMs / 1000),
                });
                return;
            }
            next();
        });
    }
    // Authentication middleware
    createAuthMiddleware() {
        return (req, res, next) => __awaiter(this, void 0, void 0, function* () {
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
                const user = yield this.validateAuthToken(token);
                if (!user) {
                    res.status(401).json({
                        error: 'Invalid token',
                        message: 'Token is invalid or expired',
                    });
                    return;
                }
                req.user = user;
                next();
            }
            catch (error) {
                res.status(500).json({
                    error: 'Authentication error',
                    message: 'Internal server error during authentication',
                });
            }
        });
    }
    // Authorization middleware
    createPermissionMiddleware(permission) {
        return (req, res, next) => __awaiter(this, void 0, void 0, function* () {
            try {
                const user = req.user;
                if (!user) {
                    res.status(401).json({
                        error: 'Authentication required',
                        message: 'User must be authenticated',
                    });
                    return;
                }
                const hasPermission = yield this.checkPermission(user, permission);
                if (!hasPermission) {
                    res.status(403).json({
                        error: 'Permission denied',
                        message: `User does not have permission: ${permission}`,
                    });
                    return;
                }
                next();
            }
            catch (error) {
                res.status(500).json({
                    error: 'Authorization error',
                    message: 'Internal server error during authorization',
                });
            }
        });
    }
    // Audit logging
    logAuditEvent(action, resource, resourceId, details, req) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            const auditLog = {
                id: `audit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                userId: (_a = req === null || req === void 0 ? void 0 : req.user) === null || _a === void 0 ? void 0 : _a.id,
                action,
                resource,
                resourceId,
                details,
                ipAddress: (req === null || req === void 0 ? void 0 : req.ip) || 'unknown',
                userAgent: (req === null || req === void 0 ? void 0 : req.headers['user-agent']) || 'unknown',
                timestamp: new Date(),
                success: true,
            };
            this.auditLogs.push(auditLog);
            // Keep only last 1000 audit logs
            if (this.auditLogs.length > 1000) {
                this.auditLogs = this.auditLogs.slice(-1000);
            }
            console.log(`🔒 Audit: ${action} on ${resource}${resourceId ? `:${resourceId}` : ''}`);
        });
    }
    getAuditLogs(filters) {
        return __awaiter(this, void 0, void 0, function* () {
            let filtered = this.auditLogs;
            if (filters === null || filters === void 0 ? void 0 : filters.userId) {
                filtered = filtered.filter(log => log.userId === filters.userId);
            }
            if (filters === null || filters === void 0 ? void 0 : filters.action) {
                filtered = filtered.filter(log => log.action === filters.action);
            }
            if (filters === null || filters === void 0 ? void 0 : filters.resource) {
                filtered = filtered.filter(log => log.resource === filters.resource);
            }
            if (filters === null || filters === void 0 ? void 0 : filters.startDate) {
                filtered = filtered.filter(log => log.timestamp >= filters.startDate);
            }
            if (filters === null || filters === void 0 ? void 0 : filters.endDate) {
                filtered = filtered.filter(log => log.timestamp <= filters.endDate);
            }
            if (filters === null || filters === void 0 ? void 0 : filters.limit) {
                filtered = filtered.slice(0, filters.limit);
            }
            return filtered.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
        });
    }
    // Security utilities
    generateSecureToken() {
        return (0, crypto_1.randomBytes)(32).toString('hex');
    }
    parseJwtExpiresIn(expiresIn) {
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
    findUserByEmail(email) {
        return __awaiter(this, void 0, void 0, function* () {
            // Mock user data - in production, this would query the database
            const mockUsers = [
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
        });
    }
    findUserById(id) {
        return __awaiter(this, void 0, void 0, function* () {
            // Mock user data - in production, this would query the database
            const mockUsers = [
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
        });
    }
    // Cleanup tasks
    startCleanupTasks() {
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
    getConfig() {
        return Object.assign({}, this.config);
    }
    getRateLimitStatus(identifier) {
        return __awaiter(this, void 0, void 0, function* () {
            const key = `rate_limit:${identifier}`;
            const current = this.rateLimitStore.get(key);
            if (!current)
                return null;
            return {
                current: current.count,
                limit: this.config.rateLimits.api.maxRequests,
                resetTime: current.resetTime,
            };
        });
    }
}
exports.SecurityService = SecurityService;
exports.securityService = new SecurityService();
