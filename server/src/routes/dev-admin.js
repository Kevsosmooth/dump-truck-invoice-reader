import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';

const router = Router();
const prisma = new PrismaClient();

// Development only - Create an admin user
router.post('/create-admin', async (req, res) => {
  if (process.env.NODE_ENV === 'production') {
    return res.status(403).json({ error: 'This endpoint is disabled in production' });
  }

  try {
    const { email, password, firstName, lastName } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      // Update existing user to be admin
      const updatedUser = await prisma.user.update({
        where: { email },
        data: { 
          role: 'ADMIN',
          isActive: true,
          password: await bcrypt.hash(password, 10)
        }
      });
      
      return res.json({ 
        message: 'Existing user updated to admin',
        user: {
          id: updatedUser.id,
          email: updatedUser.email,
          role: updatedUser.role
        }
      });
    }

    // Create new admin user
    const hashedPassword = await bcrypt.hash(password, 10);
    const adminUser = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        firstName: firstName || 'Admin',
        lastName: lastName || 'User',
        role: 'ADMIN',
        isActive: true,
        credits: 1000 // Give admin users some credits
      }
    });

    return res.json({
      message: 'Admin user created successfully',
      user: {
        id: adminUser.id,
        email: adminUser.email,
        role: adminUser.role
      }
    });
  } catch (error) {
    console.error('Create admin error:', error);
    return res.status(500).json({ error: 'Failed to create admin user' });
  }
});

// Test admin authentication
router.post('/test-admin-auth', async (req, res) => {
  if (process.env.NODE_ENV === 'production') {
    return res.status(403).json({ error: 'This endpoint is disabled in production' });
  }

  try {
    const adminJwtSecret = process.env.ADMIN_JWT_SECRET || process.env.JWT_SECRET || process.env.SESSION_SECRET;
    
    return res.json({
      hasAdminJwtSecret: !!process.env.ADMIN_JWT_SECRET,
      adminSecretDefined: !!adminJwtSecret,
      adminSessionTimeout: process.env.ADMIN_SESSION_TIMEOUT || '4h',
      adminIpWhitelist: process.env.ADMIN_IP_WHITELIST || 'not configured',
      endpoints: {
        login: '/admin/auth/login',
        logout: '/admin/auth/logout',
        me: '/admin/auth/me',
        refresh: '/admin/auth/refresh',
        changePassword: '/admin/auth/change-password'
      },
      adminApiRoutes: {
        stats: '/api/admin/stats',
        users: '/api/admin/users',
        invoices: '/api/admin/invoices',
        settings: '/api/admin/settings'
      }
    });
  } catch (error) {
    console.error('Test admin auth error:', error);
    return res.status(500).json({ error: 'Failed to test admin auth' });
  }
});

// List all admin users
router.get('/list-admins', async (req, res) => {
  if (process.env.NODE_ENV === 'production') {
    return res.status(403).json({ error: 'This endpoint is disabled in production' });
  }

  try {
    const admins = await prisma.user.findMany({
      where: { role: 'ADMIN' },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        isActive: true,
        createdAt: true,
        lastLoginAt: true
      }
    });

    return res.json({ admins });
  } catch (error) {
    console.error('List admins error:', error);
    return res.status(500).json({ error: 'Failed to list admin users' });
  }
});

export default router;