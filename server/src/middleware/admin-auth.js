import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const authenticateAdmin = async (req, res, next) => {
  try {
    // Get token from Authorization header or adminToken cookie
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith('Bearer ') 
      ? authHeader.slice(7) 
      : req.cookies?.adminToken;

    if (!token) {
      return res.status(401).json({ error: 'Admin authentication required' });
    }

    // Verify token with admin-specific secret
    const jwtSecret = process.env.ADMIN_JWT_SECRET || process.env.JWT_SECRET || process.env.SESSION_SECRET;
    const decoded = jwt.verify(token, jwtSecret);

    // Get user from database
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        isActive: true,
        organization: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (!user) {
      return res.status(401).json({ error: 'Invalid admin token' });
    }

    // Verify admin role
    if (user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    // Verify account is active
    if (!user.isActive) {
      return res.status(403).json({ error: 'Account is disabled' });
    }

    // Attach user to request
    req.admin = user;
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Admin token expired' });
    }
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ error: 'Invalid admin token' });
    }
    console.error('Admin auth middleware error:', error);
    return res.status(500).json({ error: 'Authentication error' });
  }
};

// Optional: Verify specific permissions
export const requirePermission = (permission) => {
  return (req, res, next) => {
    // For now, all admins have all permissions
    // This can be expanded to support granular permissions
    if (!req.admin) {
      return res.status(401).json({ error: 'Admin authentication required' });
    }
    next();
  };
};