import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateAdmin } from '../middleware/admin-auth.js';

const router = Router();
const prisma = new PrismaClient();

// Apply admin authentication middleware to all routes
router.use(authenticateAdmin);

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
        userId: req.admin.id,
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

// Get user transactions
router.get('/users/:userId/transactions', async (req, res) => {
  try {
    const { userId } = req.params;

    const transactions = await prisma.transaction.findMany({
      where: { userId: Number(userId) },
      orderBy: { createdAt: 'desc' },
      take: 50 // Limit to last 50 transactions
    });

    return res.json(transactions);
  } catch (error) {
    console.error('Get user transactions error:', error);
    return res.status(500).json({ error: 'Failed to fetch user transactions' });
  }
});

// Adjust user credits
router.post('/users/:userId/adjust-credits', async (req, res) => {
  try {
    const { userId } = req.params;
    const { action, amount, reason } = req.body;

    if (!['add', 'remove'].includes(action)) {
      return res.status(400).json({ error: 'Invalid action' });
    }

    if (!amount || amount <= 0) {
      return res.status(400).json({ error: 'Invalid amount' });
    }

    if (!reason || !reason.trim()) {
      return res.status(400).json({ error: 'Reason is required' });
    }

    const user = await prisma.user.findUnique({
      where: { id: Number(userId) }
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const creditChange = action === 'add' ? amount : -amount;
    const newCredits = Math.max(0, user.credits + creditChange);

    // Update user credits
    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: { credits: newCredits },
      include: {
        _count: {
          select: { jobs: true }
        },
        organization: true
      }
    });

    // Create transaction record
    await prisma.transaction.create({
      data: {
        userId: user.id,
        type: action === 'add' ? 'ADMIN_CREDIT' : 'ADMIN_DEBIT',
        amount: 0, // No monetary value for admin adjustments
        credits: creditChange,
        status: 'COMPLETED',
        description: reason,
        metadata: {
          adminId: req.admin.id,
          adminEmail: req.admin.email
        }
      }
    });

    // Create audit log
    await prisma.auditLog.create({
      data: {
        userId: req.admin.id,
        eventType: 'CREDIT_ADJUSTMENT',
        eventData: {
          targetUserId: user.id,
          targetEmail: user.email,
          action,
          amount,
          reason,
          previousCredits: user.credits,
          newCredits
        },
        ipAddress: req.ip,
        userAgent: req.headers['user-agent']
      }
    });

    return res.json({ 
      user: updatedUser,
      message: `Successfully ${action === 'add' ? 'added' : 'removed'} ${amount} credits` 
    });
  } catch (error) {
    console.error('Adjust credits error:', error);
    return res.status(500).json({ error: 'Failed to adjust credits' });
  }
});

export default router;