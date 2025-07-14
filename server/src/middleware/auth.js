import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const authenticateToken = async (req, res, next) => {
  try {
    // Try to get token from multiple sources
    let token = null;
    
    // 1. Try Authorization header (Bearer token)
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
      token = req.headers.authorization.split(' ')[1];
    }
    
    // 2. Try cookies
    if (!token && req.cookies?.token) {
      token = req.cookies.token;
    }
    
    // 3. Try Authorization header without Bearer prefix
    if (!token && req.headers.authorization) {
      token = req.headers.authorization;
    }

    if (!token || token === 'null' || token === 'undefined' || token === '') {
      return res.status(401).json({ error: 'Access denied. No token provided.' });
    }

    // Verify JWT token
    let decoded;
    const jwtSecret = process.env.JWT_SECRET || process.env.SESSION_SECRET;
    
    if (!jwtSecret) {
      console.error('[AUTH] JWT_SECRET or SESSION_SECRET not defined in environment');
      return res.status(500).json({ error: 'Server configuration error.' });
    }
    
    try {
      decoded = jwt.verify(token, jwtSecret);
    } catch (jwtError) {
      console.error('[AUTH] JWT verification failed:', jwtError.message);
      return res.status(403).json({ error: 'Invalid or expired token.' });
    }
    
    // Check if session exists in database
    const session = await prisma.session.findUnique({
      where: { token },
      include: { user: true }
    });

    if (!session) {
      console.log('[AUTH] Session not found in database');
      return res.status(401).json({ error: 'Session not found.' });
    }

    if (session.expiresAt < new Date()) {
      console.log('[AUTH] Session expired:', session.expiresAt);
      return res.status(401).json({ error: 'Session expired.' });
    }

    req.user = {
      id: session.user.id,
      email: session.user.email,
      role: session.user.role,
      credits: session.user.credits
    };

    next();
  } catch (error) {
    console.error('[AUTH] Unexpected error:', error);
    return res.status(500).json({ error: 'Authentication error.' });
  }
};

export const requireAdmin = (req, res, next) => {
  if (req.user?.role !== 'ADMIN') {
    return res.status(403).json({ error: 'Admin access required.' });
  }
  next();
};

// Alias for consistency with payment routes
export const requireAuth = authenticateToken;