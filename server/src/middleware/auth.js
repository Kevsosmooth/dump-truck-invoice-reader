import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const authenticateToken = async (req, res, next) => {
  try {
    const token = req.cookies?.token || req.headers.authorization?.split(' ')[1];

    if (!token) {
      console.log('[AUTH] No token provided');
      return res.status(401).json({ error: 'Access denied. No token provided.' });
    }

    // Verify JWT token
    let decoded;
    const jwtSecret = process.env.JWT_SECRET || process.env.SESSION_SECRET;
    console.log('[AUTH] Verifying token with secret:', jwtSecret ? 'Secret is defined' : 'NO SECRET DEFINED!');
    
    try {
      decoded = jwt.verify(token, jwtSecret);
      console.log('[AUTH] Token decoded successfully, userId:', decoded.userId);
    } catch (jwtError) {
      console.error('[AUTH] JWT verification failed:', jwtError.message);
      console.error('[AUTH] Token preview:', token.substring(0, 20) + '...');
      return res.status(403).json({ error: 'Invalid token format.' });
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