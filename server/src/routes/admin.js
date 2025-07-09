import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateToken, requireAdmin } from '../middleware/auth.js';

const router = Router();
const prisma = new PrismaClient();

// Apply authentication and admin middleware to all routes
router.use(authenticateToken);
router.use(requireAdmin);

// Dashboard stats
router.get('/stats', async (req, res) => {
  try {
    const [userCount, invoiceCount, totalRevenue, activeUsers] = await Promise.all([
      prisma.user.count(),
      prisma.job.count(),
      prisma.transaction.aggregate({
        where: { type: 'PURCHASE', status: 'COMPLETED' },
        _sum: { amount: true }
      }),
      prisma.user.count({
        where: {
          lastLoginAt: {
            gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) // Last 30 days
          }
        }
      })
    ]);

    const recentActivity = await prisma.auditLog.findMany({
      take: 10,
      orderBy: { createdAt: 'desc' },
      include: {
        user: {
          select: { email: true, firstName: true, lastName: true }
        }
      }
    });

    return res.json({
      stats: {
        totalUsers: userCount,
        totalInvoices: invoiceCount,
        totalRevenue: (totalRevenue._sum.amount || 0) / 100, // Convert cents to dollars
        activeUsers
      },
      recentActivity
    });
  } catch (error) {
    console.error('Admin stats error:', error);
    return res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

// User management
router.get('/users', async (req, res) => {
  try {
    const { page = 1, limit = 10, search = '' } = req.query;
    const skip = (Number(page) - 1) * Number(limit);

    const where = search ? {
      OR: [
        { email: { contains: String(search), mode: 'insensitive' } },
        { firstName: { contains: String(search), mode: 'insensitive' } },
        { lastName: { contains: String(search), mode: 'insensitive' } }
      ]
    } : {};

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        skip,
        take: Number(limit),
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          role: true,
          credits: true,
          isActive: true,
          createdAt: true,
          lastLoginAt: true,
          _count: {
            select: { jobs: true }
          }
        },
        orderBy: { createdAt: 'desc' }
      }),
      prisma.user.count({ where })
    ]);

    return res.json({
      users,
      pagination: {
        total,
        page: Number(page),
        limit: Number(limit),
        pages: Math.ceil(total / Number(limit))
      }
    });
  } catch (error) {
    console.error('Get users error:', error);
    return res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// Update user
router.patch('/users/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { role, isActive, credits } = req.body;

    const user = await prisma.user.update({
      where: { id: Number(id) },
      data: {
        ...(role && { role }),
        ...(isActive !== undefined && { isActive }),
        ...(credits !== undefined && { credits })
      }
    });

    // Log the action
    await prisma.auditLog.create({
      data: {
        userId: req.user.id,
        eventType: 'USER_UPDATED',
        eventData: {
          targetUserId: user.id,
          changes: req.body
        }
      }
    });

    return res.json(user);
  } catch (error) {
    console.error('Update user error:', error);
    return res.status(500).json({ error: 'Failed to update user' });
  }
});

// Invoice management
router.get('/invoices', async (req, res) => {
  try {
    const { page = 1, limit = 10, status } = req.query;
    const skip = (Number(page) - 1) * Number(limit);

    const where = status ? { status: status } : {};

    const [invoices, total] = await Promise.all([
      prisma.job.findMany({
        where,
        skip,
        take: Number(limit),
        include: {
          user: {
            select: { email: true, firstName: true, lastName: true }
          }
        },
        orderBy: { createdAt: 'desc' }
      }),
      prisma.job.count({ where })
    ]);

    return res.json({
      invoices,
      pagination: {
        total,
        page: Number(page),
        limit: Number(limit),
        pages: Math.ceil(total / Number(limit))
      }
    });
  } catch (error) {
    console.error('Get invoices error:', error);
    return res.status(500).json({ error: 'Failed to fetch invoices' });
  }
});

// System settings
router.get('/settings', async (req, res) => {
  try {
    // You can store settings in a separate table or return hardcoded values
    return res.json({
      defaultCredits: 100,
      creditPricing: {
        basic: { credits: 100, price: 9.99 },
        pro: { credits: 500, price: 39.99 },
        enterprise: { credits: 2000, price: 149.99 }
      },
      features: {
        maxFileSize: 4 * 1024 * 1024, // 4MB
        maxPagesPerDocument: 2,
        supportedFormats: ['pdf', 'jpg', 'jpeg', 'png']
      }
    });
  } catch (error) {
    console.error('Get settings error:', error);
    return res.status(500).json({ error: 'Failed to fetch settings' });
  }
});

export default router;