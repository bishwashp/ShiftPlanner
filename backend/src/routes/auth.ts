import { Router } from 'express';
import { AuthService } from '../services/AuthService';
import { authenticate, requireRole, AuthenticatedRequest } from '../middleware/auth';
import { prisma } from '../lib/prisma';

const router = Router();

/**
 * POST /api/auth/register
 * Register new user (Manager-only - invite system)
 */
router.post('/register', authenticate, requireRole('MANAGER', 'SUPER_ADMIN'), async (req, res) => {
  try {
    const { email, password, firstName, lastName, role, analystId } = req.body;

    if (!email || !password || !firstName || !lastName || !role) {
      return res.status(400).json({
        error: 'Missing required fields',
        message: 'email, password, firstName, lastName, and role are required'
      });
    }

    // Validate role
    if (!['ANALYST', 'MANAGER'].includes(role)) {
      return res.status(400).json({
        error: 'Invalid role',
        message: 'Role must be ANALYST or MANAGER'
      });
    }

    // Check if user already exists
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return res.status(400).json({
        error: 'User already exists',
        message: 'An account with this email already exists'
      });
    }

    const user = await AuthService.register({
      email,
      password,
      firstName,
      lastName,
      role,
      analystId
    });

    res.status(201).json({
      success: true,
      message: 'User created successfully',
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role
      }
    });
  } catch (error: any) {
    console.error('Registration error:', error);
    res.status(500).json({
      error: 'Registration failed',
      message: error.message || 'Internal server error'
    });
  }
});

/**
 * POST /api/auth/login
 * Login with email/password
 */
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        error: 'Missing credentials',
        message: 'Email and password are required'
      });
    }

    const result = await AuthService.login(
      email,
      password,
      req.ip || 'unknown',
      req.headers['user-agent'] || ''
    );

    res.json({
      success: true,
      message: 'Authentication successful',
      token: result.token,
      user: result.user
    });
  } catch (error: any) {
    console.error('Login error:', error);
    res.status(401).json({
      error: 'Authentication failed',
      message: error.message || 'Invalid credentials'
    });
  }
});

/**
 * POST /api/auth/logout
 * Logout and invalidate session
 */
router.post('/logout', authenticate, async (req: AuthenticatedRequest, res) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith('Bearer ')
      ? authHeader.substring(7)
      : authHeader;

    if (token) {
      await AuthService.logout(token);
    }

    res.json({
      success: true,
      message: 'Logged out successfully'
    });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({
      error: 'Logout error',
      message: 'Internal server error'
    });
  }
});

/**
 * GET /api/auth/me
 * Get current user info
 */
router.get('/me', authenticate, async (req: AuthenticatedRequest, res) => {
  try {
    res.json({
      success: true,
      user: req.user
    });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({
      error: 'Failed to fetch user',
      message: 'Internal server error'
    });
  }
});

/**
 * GET /api/auth/users
 * Get all users (Manager-only)
 */
router.get('/users', authenticate, requireRole('MANAGER', 'SUPER_ADMIN'), async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        authProvider: true,
        isActive: true,
        lastLogin: true,
        createdAt: true,
        analystId: true,
        analyst: {
          select: {
            id: true,
            name: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json({ success: true, users });
  } catch (error) {
    console.error('Fetch users error:', error);
    res.status(500).json({
      error: 'Failed to fetch users',
      message: 'Internal server error'
    });
  }
});

/**
 * PUT /api/auth/users/:id/role
 * Update user role (Manager-only)
 */
router.put('/users/:id/role', authenticate, requireRole('MANAGER', 'SUPER_ADMIN'), async (req, res) => {
  try {
    const { id } = req.params;
    const { role } = req.body;

    if (!['ANALYST', 'MANAGER', 'SUPER_ADMIN'].includes(role)) {
      return res.status(400).json({
        error: 'Invalid role',
        message: 'Role must be ANALYST, MANAGER, or SUPER_ADMIN'
      });
    }

    const user = await prisma.user.update({
      where: { id },
      data: { role }
    });

    res.json({
      success: true,
      message: 'User role updated',
      user: {
        id: user.id,
        email: user.email,
        role: user.role
      }
    });
  } catch (error) {
    console.error('Update role error:', error);
    res.status(500).json({
      error: 'Failed to update role',
      message: 'Internal server error'
    });
  }
});

/**
 * PUT /api/auth/users/:id/status
 * Activate/deactivate user (Manager-only)
 */
router.put('/users/:id/status', authenticate, requireRole('MANAGER', 'SUPER_ADMIN'), async (req, res) => {
  try {
    const { id } = req.params;
    const { isActive } = req.body;

    const user = await prisma.user.update({
      where: { id },
      data: { isActive }
    });

    // If deactivating, clear their sessions
    if (!isActive) {
      await prisma.session.deleteMany({ where: { userId: id } });
    }

    res.json({
      success: true,
      message: `User ${isActive ? 'activated' : 'deactivated'}`,
      user: {
        id: user.id,
        email: user.email,
        isActive: user.isActive
      }
    });
  } catch (error) {
    console.error('Update status error:', error);
    res.status(500).json({
      error: 'Failed to update status',
      message: 'Internal server error'
    });
  }
});

export default router;
