import { Request, Response, NextFunction, RequestHandler } from 'express';
import { AuthService } from '../services/AuthService';

export interface AuthenticatedUser {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    role: string;
    analystId: string | null;
    analyst?: any;
}

export interface AuthenticatedRequest extends Request {
    user?: AuthenticatedUser;
}

/**
 * Authentication middleware - verifies JWT token
 */
export const authenticate: RequestHandler = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        const authHeader = req.headers.authorization;
        const token = authHeader?.startsWith('Bearer ')
            ? authHeader.substring(7)
            : authHeader;

        if (!token) {
            res.status(401).json({
                error: 'Authentication required',
                message: 'No token provided'
            });
            return;
        }

        const user = await AuthService.validateToken(token);

        if (!user) {
            res.status(401).json({
                error: 'Invalid or expired token',
                message: 'Please login again'
            });
            return;
        }

        (req as AuthenticatedRequest).user = user;
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
export const requireRole = (...allowedRoles: string[]): RequestHandler => {
    return (req: Request, res: Response, next: NextFunction) => {
        const authReq = req as AuthenticatedRequest;
        if (!authReq.user) {
            res.status(401).json({
                error: 'Authentication required',
                message: 'Please login first'
            });
            return;
        }

        if (!allowedRoles.includes(authReq.user.role)) {
            res.status(403).json({
                error: 'Insufficient permissions',
                message: `This action requires one of the following roles: ${allowedRoles.join(', ')} `,
                required: allowedRoles,
                current: authReq.user.role
            });
            return;
        }

        next();
    };
};

/**
 * Check if user owns the resource or is a manager
 * Usage: requireOwnerOrManager('analystId')
 */
export const requireOwnerOrManager = (resourceIdField: string): RequestHandler => {
    return (req: Request, res: Response, next: NextFunction) => {
        const authReq = req as AuthenticatedRequest;
        if (!authReq.user) {
            res.status(401).json({
                error: 'Authentication required'
            });
            return;
        }

        // Managers and super admins can access any resource
        if (authReq.user.role === 'MANAGER' || authReq.user.role === 'SUPER_ADMIN') {
            next();
            return;
        }

        // Check if analyst owns the resource
        const resourceId = req.params[resourceIdField] || req.body[resourceIdField] || req.query[resourceIdField];

        if (resourceId === authReq.user.analystId) {
            next();
            return;
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
export const optionalAuth: RequestHandler = async (
    req: Request,
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
                (req as AuthenticatedRequest).user = user;
            }
        }

        next();
    } catch (error) {
        // Silently fail for optional auth
        next();
    }
};
