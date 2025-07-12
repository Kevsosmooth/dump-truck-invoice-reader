import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateAdmin } from '../middleware/admin-auth.js';

const router = Router();
const prisma = new PrismaClient();

// Apply admin authentication middleware to all routes
router.use(authenticateAdmin);

// Get credit statistics
router.get('/stats', async (req, res) => {
  try {
    // Get total credits in system
    const totalCreditsResult = await prisma.user.aggregate({
      _sum: { credits: true }
    });

    // Get total credits used
    const totalCreditsUsedResult = await prisma.transaction.aggregate({
      where: { type: 'USAGE', status: 'COMPLETED' },
      _sum: { credits: true }
    });

    // Get total revenue
    const totalRevenueResult = await prisma.transaction.aggregate({
      where: { type: 'PURCHASE', status: 'COMPLETED' },
      _sum: { amount: true }
    });

    // Get average credits per user
    const userCount = await prisma.user.count();
    const averageCreditsPerUser = userCount > 0 
      ? (totalCreditsResult._sum.credits || 0) / userCount 
      : 0;

    return res.json({
      totalCreditsInSystem: totalCreditsResult._sum.credits || 0,
      totalCreditsUsed: Math.abs(totalCreditsUsedResult._sum.credits || 0),
      totalRevenue: totalRevenueResult._sum.amount || 0,
      averageCreditsPerUser: Math.round(averageCreditsPerUser)
    });
  } catch (error) {
    console.error('Get credit stats error:', error);
    return res.status(500).json({ error: 'Failed to fetch credit statistics' });
  }
});

// Get credit packages
router.get('/packages', async (req, res) => {
  try {
    // For now, return hardcoded packages. In production, these could be stored in DB
    const packages = [
      {
        id: 'basic',
        name: 'Basic Package',
        description: 'Perfect for small businesses',
        credits: 100,
        price: 999, // $9.99 in cents
      },
      {
        id: 'pro',
        name: 'Pro Package',
        description: 'Best value for regular users',
        credits: 500,
        price: 3999, // $39.99 in cents
      },
      {
        id: 'enterprise',
        name: 'Enterprise Package',
        description: 'For high-volume processing',
        credits: 2000,
        price: 14999, // $149.99 in cents
      }
    ];

    return res.json(packages);
  } catch (error) {
    console.error('Get packages error:', error);
    return res.status(500).json({ error: 'Failed to fetch packages' });
  }
});

// Get all transactions with filtering
router.get('/transactions', async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 20, 
      search = '', 
      type, 
      status,
      startDate,
      endDate 
    } = req.query;
    
    const skip = (Number(page) - 1) * Number(limit);

    // Build where clause
    const where = {};
    
    if (search) {
      where.user = {
        email: { contains: search, mode: 'insensitive' }
      };
    }

    if (type) {
      where.type = type;
    }

    if (status) {
      where.status = status;
    }

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) {
        where.createdAt.gte = new Date(startDate);
      }
      if (endDate) {
        where.createdAt.lte = new Date(endDate + 'T23:59:59.999Z');
      }
    }

    const [transactions, total] = await Promise.all([
      prisma.transaction.findMany({
        where,
        skip,
        take: Number(limit),
        include: {
          user: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true
            }
          }
        },
        orderBy: { createdAt: 'desc' }
      }),
      prisma.transaction.count({ where })
    ]);

    return res.json({
      transactions,
      pagination: {
        total,
        page: Number(page),
        limit: Number(limit),
        pages: Math.ceil(total / Number(limit))
      }
    });
  } catch (error) {
    console.error('Get transactions error:', error);
    return res.status(500).json({ error: 'Failed to fetch transactions' });
  }
});

// Export transactions to CSV
router.get('/transactions/export', async (req, res) => {
  try {
    const { search = '', type, status, startDate, endDate } = req.query;

    // Build where clause (same as above)
    const where = {};
    
    if (search) {
      where.user = {
        email: { contains: search, mode: 'insensitive' }
      };
    }

    if (type) {
      where.type = type;
    }

    if (status) {
      where.status = status;
    }

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) {
        where.createdAt.gte = new Date(startDate);
      }
      if (endDate) {
        where.createdAt.lte = new Date(endDate + 'T23:59:59.999Z');
      }
    }

    const transactions = await prisma.transaction.findMany({
      where,
      include: {
        user: {
          select: {
            email: true,
            firstName: true,
            lastName: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    // Transform data for CSV
    const data = transactions.map(t => ({
      Date: new Date(t.createdAt).toISOString(),
      'User Email': t.user.email,
      'User Name': `${t.user.firstName || ''} ${t.user.lastName || ''}`.trim() || 'N/A',
      Type: t.type,
      Description: t.description || '',
      Credits: t.credits,
      'Amount (USD)': t.amount ? (t.amount / 100).toFixed(2) : '',
      Status: t.status,
      'Transaction ID': t.id,
      'Stripe Payment ID': t.stripePaymentIntentId || ''
    }));

    // Generate CSV manually
    const headers = Object.keys(data[0] || {});
    const csvRows = [
      headers.join(','), // Header row
      ...data.map(row => 
        headers.map(header => {
          const value = row[header];
          // Escape quotes and wrap in quotes if contains comma or quotes
          const escaped = String(value || '').replace(/"/g, '""');
          return escaped.includes(',') || escaped.includes('"') || escaped.includes('\n') 
            ? `"${escaped}"` 
            : escaped;
        }).join(',')
      )
    ];
    const csv = csvRows.join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="credit-transactions-${new Date().toISOString().split('T')[0]}.csv"`);
    
    return res.send(csv);
  } catch (error) {
    console.error('Export transactions error:', error);
    return res.status(500).json({ error: 'Failed to export transactions' });
  }
});

// Bulk credit operation
router.post('/bulk-operation', async (req, res) => {
  try {
    const { emails, action, amount, reason } = req.body;

    if (!emails || !Array.isArray(emails) || emails.length === 0) {
      return res.status(400).json({ error: 'Invalid email list' });
    }

    if (!['add', 'remove'].includes(action)) {
      return res.status(400).json({ error: 'Invalid action' });
    }

    if (!amount || amount <= 0) {
      return res.status(400).json({ error: 'Invalid amount' });
    }

    if (!reason || !reason.trim()) {
      return res.status(400).json({ error: 'Reason is required' });
    }

    const results = {
      processed: 0,
      errors: []
    };

    // Process each user
    for (const email of emails) {
      try {
        const user = await prisma.user.findUnique({
          where: { email: email.toLowerCase() }
        });

        if (!user) {
          results.errors.push({ email, error: 'User not found' });
          continue;
        }

        const creditChange = action === 'add' ? amount : -amount;
        const newCredits = Math.max(0, user.credits + creditChange);

        // Update user credits
        await prisma.user.update({
          where: { id: user.id },
          data: { credits: newCredits }
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
              adminEmail: req.admin.email,
              bulkOperation: true
            }
          }
        });

        // Create audit log
        await prisma.auditLog.create({
          data: {
            userId: req.admin.id,
            eventType: 'BULK_CREDIT_ADJUSTMENT',
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

        results.processed++;
      } catch (error) {
        console.error(`Error processing user ${email}:`, error);
        results.errors.push({ email, error: error.message });
      }
    }

    return res.json(results);
  } catch (error) {
    console.error('Bulk operation error:', error);
    return res.status(500).json({ error: 'Failed to process bulk operation' });
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

// Adjust user credits (single user)
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