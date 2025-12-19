import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { prisma } from '../lib/prisma';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
const JWT_EXPIRES_IN = '7d'; // Relaxed: 7 days instead of 24 hours
const SESSION_DURATION = 7 * 24 * 60 * 60 * 1000; // 7 days in milliseconds

export class AuthService {
  /**
   * Register new user with email/password
   */
  static async register(data: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    role: string;
    analystId?: string;
  }) {
    // Relaxed password hashing: 10 rounds (faster than 12)
    const passwordHash = await bcrypt.hash(data.password, 10);
    
    const user = await prisma.user.create({
      data: {
        email: data.email,
        passwordHash,
        firstName: data.firstName,
        lastName: data.lastName,
        role: data.role,
        authProvider: 'local',
        analystId: data.analystId,
        emailVerified: true // Skip email verification for simplicity
      }
    });

    return user;
  }

  /**
   * Login with email/password
   */
  static async login(
    email: string,
    password: string,
    ipAddress?: string,
    userAgent?: string
  ) {
    const user = await prisma.user.findUnique({
      where: { email },
      include: { analyst: true }
    });
    
    if (!user || !user.passwordHash) {
      throw new Error('Invalid credentials');
    }

    const isValid = await bcrypt.compare(password, user.passwordHash);
    if (!isValid) {
      throw new Error('Invalid credentials');
    }

    if (!user.isActive) {
      throw new Error('Account is disabled');
    }

    // Generate JWT
    const token = jwt.sign(
      {
        userId: user.id,
        email: user.email,
        role: user.role,
        analystId: user.analystId
      },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );

    // Create session
    await prisma.session.create({
      data: {
        userId: user.id,
        token,
        ipAddress,
        userAgent,
        expiresAt: new Date(Date.now() + SESSION_DURATION)
      }
    });

    // Update last login
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLogin: new Date() }
    });

    return {
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        analystId: user.analystId
      },
      token
    };
  }

  /**
   * Logout - invalidate session
   */
  static async logout(token: string) {
    await prisma.session.deleteMany({ where: { token } });
  }

  /**
   * Validate JWT token and return user
   */
  static async validateToken(token: string) {
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as any;
      
      // Check if session exists and is valid
      const session = await prisma.session.findFirst({
        where: {
          token,
          userId: decoded.userId,
          expiresAt: { gt: new Date() }
        },
        include: {
          user: {
            include: { analyst: true }
          }
        }
      });

      if (!session || !session.user.isActive) {
        return null;
      }

      return {
        id: session.user.id,
        email: session.user.email,
        firstName: session.user.firstName,
        lastName: session.user.lastName,
        role: session.user.role,
        analystId: session.user.analystId,
        analyst: session.user.analyst
      };
    } catch (error) {
      return null;
    }
  }

  /**
   * SSO authentication (OIDC)
   */
  static async ssoLogin(profile: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    groups?: string[];
  }, provider: string = 'oidc') {
    // Find or create user based on SSO identifier
    let user = await prisma.user.findFirst({
      where: { ssoIdentifier: profile.id },
      include: { analyst: true }
    });

    if (!user) {
      // Create new user from SSO profile
      user = await prisma.user.create({
        data: {
          email: profile.email,
          firstName: profile.firstName,
          lastName: profile.lastName,
          ssoIdentifier: profile.id,
          authProvider: provider,
          role: this.mapSSORole(profile),
          emailVerified: true
        },
        include: { analyst: true }
      });
    }

    // Generate JWT and session
    const token = jwt.sign(
      {
        userId: user.id,
        email: user.email,
        role: user.role,
        analystId: user.analystId
      },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );

    await prisma.session.create({
      data: {
        userId: user.id,
        token,
        expiresAt: new Date(Date.now() + SESSION_DURATION)
      }
    });

    await prisma.user.update({
      where: { id: user.id },
      data: { lastLogin: new Date() }
    });

    return {
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        analystId: user.analystId
      },
      token
    };
  }

  /**
   * Map SSO groups to application roles
   */
  private static mapSSORole(profile: { groups?: string[] }): string {
    // Check for admin/manager groups
    const adminKeywords = ['admin', 'supervisor', 'manager', 'lead'];
    const userGroups = (profile.groups || []).map(g => g.toLowerCase());
    
    const isAdmin = userGroups.some(group =>
      adminKeywords.some(keyword => group.includes(keyword))
    );

    return isAdmin ? 'MANAGER' : 'ANALYST';
  }

  /**
   * Clean up expired sessions
   */
  static async cleanupExpiredSessions() {
    await prisma.session.deleteMany({
      where: {
        expiresAt: { lt: new Date() }
      }
    });
  }
}
