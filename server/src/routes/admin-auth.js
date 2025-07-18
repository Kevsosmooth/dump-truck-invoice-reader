import express from 'express';
import jwt from 'jsonwebtoken';
import passport from '../config/admin-passport.js';
import { authenticateAdmin } from '../middleware/admin-auth.js';
import { PrismaClient } from '@prisma/client';

const router = express.Router();
const prisma = new PrismaClient();

// Admin login (email/password)
router.post('/login', (req, res, next) => {
  passport.authenticate('admin-local', { session: false }, (err, user, info) => {
    if (err) {
      return res.status(500).json({ error: 'Authentication error' });
    }
    if (!user) {
      return res.status(401).json({ error: info?.message || 'Invalid credentials' });
    }

    // Generate admin JWT token
    const jwtSecret = process.env.ADMIN_JWT_SECRET || process.env.JWT_SECRET || process.env.SESSION_SECRET;
    
    if (!jwtSecret) {
      return res.status(500).json({ error: 'Authentication configuration error' });
    }
    
    const token = jwt.sign(
      { 
        userId: user.id,
        email: user.email,
        role: user.role,
        type: 'admin' 
      },
      jwtSecret,
      { expiresIn: process.env.ADMIN_SESSION_TIMEOUT || '2h' }
    );

    // Set admin cookie (different name from regular auth)
    res.cookie('adminToken', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 2 * 60 * 60 * 1000, // 2 hours
      path: '/',
    });

    // Create audit log entry
    prisma.auditLog.create({
      data: {
        userId: user.id,
        eventType: 'ADMIN_LOGIN',
        eventData: {
          action: 'ADMIN_LOGIN',
          entityType: 'USER',
          entityId: user.id
        },
        ipAddress: req.ip,
        userAgent: req.headers['user-agent']
      },
    }).catch(console.error);

    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
    });
  })(req, res, next);
});

// Google OAuth for Admin
router.get('/google', (req, res, next) => {
  // Create a state parameter to identify this as an admin login
  const state = Buffer.from(JSON.stringify({ 
    isAdmin: true, 
    timestamp: Date.now() 
  })).toString('base64');
  
  // Redirect to regular Google OAuth with state parameter
  const googleAuthUrl = `${req.protocol}://${req.get('host')}/auth/google?state=${state}`;
  res.redirect(googleAuthUrl);
});

// Google OAuth callback for Admin (internal redirect from main callback)
router.get('/google/callback', async (req, res) => {
  try {
    const userId = req.query.userId;
    
    if (!userId) {
      return res.redirect(`${process.env.ADMIN_URL || 'http://localhost:5174'}/login?error=auth_failed`);
    }
    
    // Fetch user details (convert string ID to integer)
    const user = await prisma.user.findUnique({
      where: { id: parseInt(userId, 10) }
    });
    
    // Check if user has admin role
    if (!user || user.role !== 'ADMIN') {
      return res.redirect(`${process.env.ADMIN_URL || 'http://localhost:5174'}/login?error=not_admin`);
    }

    // Check if account is active
    if (!user.isActive) {
      return res.redirect(`${process.env.ADMIN_URL || 'http://localhost:5174'}/login?error=account_disabled`);
    }

      // Generate admin JWT token
      const jwtSecret = process.env.ADMIN_JWT_SECRET || process.env.JWT_SECRET || process.env.SESSION_SECRET;
      
      console.log('Admin JWT Debug:', {
        hasAdminSecret: !!process.env.ADMIN_JWT_SECRET,
        hasJwtSecret: !!process.env.JWT_SECRET,
        hasSessionSecret: !!process.env.SESSION_SECRET,
        finalSecret: !!jwtSecret
      });
      
      if (!jwtSecret) {
        console.error('No JWT secret found. Please set JWT_SECRET or SESSION_SECRET in .env file');
        return res.redirect(`${process.env.ADMIN_URL || 'http://localhost:5174'}/login?error=auth_error`);
      }
      
      const token = jwt.sign(
        { 
          userId: user.id,
          email: user.email,
          role: user.role,
          type: 'admin' 
        },
        jwtSecret,
        { expiresIn: process.env.ADMIN_SESSION_TIMEOUT || '2h' }
      );

      // Set admin cookie
      const cookieOptions = {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax', // 'none' for cross-site cookies
        maxAge: 2 * 60 * 60 * 1000, // 2 hours
        path: '/',
      };
      
      // In production, we need to set domain if specified
      if (process.env.COOKIE_DOMAIN) {
        cookieOptions.domain = process.env.COOKIE_DOMAIN;
      }
      
      res.cookie('adminToken', token, cookieOptions);

      console.log('Admin login successful:', {
        userId: user.id,
        email: user.email,
        role: user.role,
        tokenGenerated: !!token,
        cookieSet: true
      });

      // Create audit log entry
      await prisma.auditLog.create({
        data: {
          userId: user.id,
          eventType: 'ADMIN_GOOGLE_LOGIN',
          eventData: {
            action: 'ADMIN_GOOGLE_LOGIN',
            entityType: 'USER',
            entityId: user.id,
            ip: req.ip,
            userAgent: req.headers['user-agent'],
          },
          ipAddress: req.ip,
          userAgent: req.headers['user-agent']
        },
      });

    // Redirect to admin auth callback with token
    const redirectUrl = `${process.env.ADMIN_URL || 'http://localhost:5174'}/auth/callback?token=${encodeURIComponent(token)}`;
    res.redirect(redirectUrl);
  } catch (error) {
    console.error('Admin Google auth error:', error);
    res.redirect(`${process.env.ADMIN_URL || 'http://localhost:5174'}/login?error=auth_error`);
  }
});

// Admin logout
router.post('/logout', authenticateAdmin, async (req, res) => {
  try {
    // Clear admin cookie
    res.clearCookie('adminToken', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
    });

    // Create audit log entry
    await prisma.auditLog.create({
      data: {
        userId: req.admin.id,
        eventType: 'ADMIN_LOGOUT',
        eventData: {
          action: 'ADMIN_LOGOUT',
          entityType: 'USER',
          entityId: req.admin.id
        }
      },
    });

    res.json({ message: 'Logged out successfully' });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ error: 'Logout failed' });
  }
});

// Get current admin user
router.get('/me', authenticateAdmin, (req, res) => {
  res.json({
    id: req.admin.id,
    email: req.admin.email,
    firstName: req.admin.firstName,
    lastName: req.admin.lastName,
    role: req.admin.role,
    organization: req.admin.organization,
  });
});

// Refresh admin token
router.post('/refresh', authenticateAdmin, (req, res) => {
  // Generate new token
  const jwtSecret = process.env.ADMIN_JWT_SECRET || process.env.JWT_SECRET || process.env.SESSION_SECRET;
  
  if (!jwtSecret) {
    return res.status(500).json({ error: 'Authentication configuration error' });
  }
  
  const token = jwt.sign(
    { 
      userId: req.admin.id,
      email: req.admin.email,
      role: req.admin.role,
      type: 'admin' 
    },
    jwtSecret,
    { expiresIn: process.env.ADMIN_SESSION_TIMEOUT || '2h' }
  );

  // Update cookie
  res.cookie('adminToken', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 2 * 60 * 60 * 1000, // 2 hours
    path: '/',
  });

  res.json({ token });
});

export default router;