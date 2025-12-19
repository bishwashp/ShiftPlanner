import { Request, Response, NextFunction } from 'express';
import { AuthService } from '../services/AuthService';

export interface AuthenticatedRequest extends Request {
    user?: {
        id: string;
        email: string;
        firstName: string;
        lastName: string;
        role: string;
        analystId: string | null;
        analyst?: any;
    };
}

/**
 * Authentication middleware - verifies JWT token
 */
export const authenticate = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
) => {
    try {
        const authHeader = req.headers.authorization;
        const token = authHeader?.startsWith('Bearer ')
            ? authHeader.substring(7)
            : authHeader;

        if (!token) {
            return res.status(401).json({
                error: 'Authentication required',
                message: 'No token provided'
            });
        }

        const user = await AuthService.validateToken(token);

        if (!user) {
            return res.status(401).json({
                error: 'Invalid or expired token',
                message: 'Please login again'
            });
        }

        req.user = user;
        next();
    } catch (error) {
        console.error('Authentication error:', error);
        res.status(401).json({
            error: 'Authentication failed',
            message: 'Invalid token'
        });
    }
};

/**
 * Require specific role(s)
 * Usage: requireRole('MANAGER', 'SUPER_ADMIN')
 */
export const requireRole = (...allowedRoles: string[]) => {
    return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
        if (!req.user) {
            return res.status(401).json({
                error: 'Authentication required',
                message: 'Please login first'
            });
        }

        if (!allowedRoles.includes(req.user.role)) {
            return res.status(403).json({
                error: 'Insufficient permissions',
                message: `This action requires one of the following roles: ${allowedRoles.join(', ')} `,
                required: allowedRoles,
                current: req.user.role
            });
        }

        next();
    };
};

/**
 * Check if user owns the resource or is a manager
 * Usage: requireOwnerOrManager('analystId')
 */
export const requireOwnerOrManager = (resourceIdField: string) => {
    return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
        if (!req.user) {
            return res.status(401).json({
                error: 'Authentication required'
            });
        }

        // Managers and super admins can access any resource
        if (req.user.role === 'MANAGER' || req.user.role === 'SUPER_ADMIN') {
            return next();
        }

        // Check if analyst owns the resource
        const resourceId = req.params[resourceIdField] || req.body[resourceIdField] || req.query[resourceIdField];

        if (resourceId === req.user.analystId) {
            return next();
        }

        res.status(403).json({
            error: 'Access denied',
            message: 'You can only access your own resources'
        });
    };
};

/**
 * Optional authentication - attach user if token present, but don't require it
 */
export const optionalAuth = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
) => {
    try {
        const authHeader = req.headers.authorization;
        const token = authHeader?.startsWith('Bearer ')
            ? authHeader.substring(7)
            : authHeader;

        if (token) {
            const user = await AuthService.validateToken(token);
            if (user) {
                req.user = user;
            }
        }

        next();
    } catch (error) {
        // Silently fail for optional auth
        next();
    }
};
