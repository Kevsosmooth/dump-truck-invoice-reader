import express from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateAdmin } from '../middleware/admin-auth.js';

const router = express.Router();
const prisma = new PrismaClient();

// Apply admin authentication to all routes
router.use(authenticateAdmin);

// Get overview statistics
router.get('/overview', async (req, res) => {
  try {
    // Get current date info
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);

    // Fetch all statistics in parallel
    const [
      totalUsers,
      lastMonthUsers,
      totalDocuments,
      lastMonthDocuments,
      creditsUsed,
      lastMonthCredits,
      activeSessions,
      recentActivity
    ] = await Promise.all([
      // Total users
      prisma.user.count(),
      
      // Users last month
      prisma.user.count({
        where: {
          createdAt: {
            gte: lastMonth,
            lt: startOfMonth
          }
        }
      }),
      
      // Total documents processed
      prisma.job.count({
        where: { status: 'completed' }
      }),
      
      // Documents last month
      prisma.job.count({
        where: {
          status: 'completed',
          createdAt: {
            gte: lastMonth,
            lt: startOfMonth
          }
        }
      }),
      
      // Total credits used (sum of all DEDUCT transactions)
      prisma.transaction.aggregate({
        where: { type: 'DEDUCT' },
        _sum: { amount: true }
      }),
      
      // Credits used last month
      prisma.transaction.aggregate({
        where: {
          type: 'DEDUCT',
          createdAt: {
            gte: lastMonth,
            lt: startOfMonth
          }
        },
        _sum: { amount: true }
      }),
      
      // Active processing sessions
      prisma.processingSession.count({
        where: { status: 'processing' }
      }),
      
      // Recent activity
      prisma.auditLog.findMany({
        take: 10,
        orderBy: { createdAt: 'desc' },
        include: {
          user: {
            select: {
              email: true,
              name: true
            }
          }
        }
      })
    ]);

    // Calculate trends
    const usersTrend = lastMonthUsers > 0 
      ? Math.round(((totalUsers - lastMonthUsers) / lastMonthUsers) * 100)
      : 0;
    
    const documentsTrend = lastMonthDocuments > 0
      ? Math.round(((totalDocuments - lastMonthDocuments) / lastMonthDocuments) * 100)
      : 0;
    
    const creditsTrend = lastMonthCredits._sum.amount > 0
      ? Math.round(((creditsUsed._sum.amount - lastMonthCredits._sum.amount) / lastMonthCredits._sum.amount) * 100)
      : 0;

    // Format recent activity
    const formattedActivity = recentActivity.map(log => ({
      id: log.id,
      description: formatActivityDescription(log),
      user: log.user?.name || log.user?.email || 'System',
      timestamp: log.createdAt,
      action: log.action,
      entityType: log.entityType
    }));

    // Get API response time (mock for now)
    const apiResponseTime = Math.floor(Math.random() * 50) + 20; // 20-70ms

    // Get storage usage (mock for now)
    const storageUsage = Math.floor(Math.random() * 30) + 40; // 40-70%

    res.json({
      totalUsers,
      usersTrend,
      totalDocuments,
      documentsTrend,
      creditsUsed: creditsUsed._sum.amount || 0,
      creditsTrend,
      activeSessions,
      recentActivity: formattedActivity,
      apiResponseTime,
      storageUsage
    });
  } catch (error) {
    console.error('Analytics overview error:', error);
    res.status(500).json({ error: 'Failed to fetch analytics data' });
  }
});

// Get user analytics
router.get('/users', async (req, res) => {
  try {
    const { days = 30 } = req.query;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - Number(days));

    const [
      userGrowth,
      usersByRole,
      activeUsers,
      topUsers
    ] = await Promise.all([
      // User growth over time
      prisma.$queryRaw`
        SELECT 
          DATE(created_at) as date,
          COUNT(*) as count
        FROM "User"
        WHERE created_at >= ${startDate}
        GROUP BY DATE(created_at)
        ORDER BY date
      `,
      
      // Users by role
      prisma.user.groupBy({
        by: ['role'],
        _count: {
          _all: true
        }
      }),
      
      // Active users (logged in within specified days)
      prisma.user.count({
        where: {
          lastLoginAt: {
            gte: startDate
          }
        }
      }),
      
      // Top users by credits used
      prisma.$queryRaw`
        SELECT 
          u.id, u.email, u.name,
          COALESCE(SUM(t.amount), 0) as credits_used
        FROM "User" u
        LEFT JOIN "Transaction" t ON u.id = t."userId" AND t.type = 'DEDUCT'
        GROUP BY u.id, u.email, u.name
        ORDER BY credits_used DESC
        LIMIT 10
      `
    ]);

    res.json({
      userGrowth,
      usersByRole: usersByRole.map(item => ({
        role: item.role,
        count: item._count._all
      })),
      activeUsers,
      topUsers
    });
  } catch (error) {
    console.error('User analytics error:', error);
    res.status(500).json({ error: 'Failed to fetch user analytics' });
  }
});

// Get credit analytics
router.get('/credits', async (req, res) => {
  try {
    const { days = 30 } = req.query;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - Number(days));

    const [
      creditUsage,
      transactionsByType,
      topCreditUsers,
      creditDistribution
    ] = await Promise.all([
      // Credit usage over time
      prisma.$queryRaw`
        SELECT 
          DATE(created_at) as date,
          SUM(CASE WHEN type = 'DEDUCT' THEN amount ELSE 0 END) as used,
          SUM(CASE WHEN type IN ('PURCHASE', 'ADMIN_CREDIT') THEN amount ELSE 0 END) as added
        FROM "Transaction"
        WHERE created_at >= ${startDate}
        GROUP BY DATE(created_at)
        ORDER BY date
      `,
      
      // Transactions by type
      prisma.transaction.groupBy({
        by: ['type'],
        _sum: {
          amount: true
        },
        _count: {
          _all: true
        }
      }),
      
      // Top credit users
      prisma.$queryRaw`
        SELECT 
          u.id, u.email, u.name, u.credits as current_credits,
          COALESCE(SUM(t.amount), 0) as total_used
        FROM "User" u
        LEFT JOIN "Transaction" t ON u.id = t."userId" AND t.type = 'DEDUCT'
        WHERE t.created_at >= ${startDate}
        GROUP BY u.id, u.email, u.name, u.credits
        ORDER BY total_used DESC
        LIMIT 10
      `,
      
      // Credit distribution
      prisma.$queryRaw`
        SELECT 
          CASE 
            WHEN credits = 0 THEN '0'
            WHEN credits BETWEEN 1 AND 50 THEN '1-50'
            WHEN credits BETWEEN 51 AND 100 THEN '51-100'
            WHEN credits BETWEEN 101 AND 500 THEN '101-500'
            ELSE '500+'
          END as range,
          COUNT(*) as count
        FROM "User"
        GROUP BY range
        ORDER BY 
          CASE range
            WHEN '0' THEN 1
            WHEN '1-50' THEN 2
            WHEN '51-100' THEN 3
            WHEN '101-500' THEN 4
            ELSE 5
          END
      `
    ]);

    res.json({
      creditUsage,
      transactionsByType: transactionsByType.map(item => ({
        type: item.type,
        total: item._sum.amount || 0,
        count: item._count._all
      })),
      topCreditUsers,
      creditDistribution
    });
  } catch (error) {
    console.error('Credit analytics error:', error);
    res.status(500).json({ error: 'Failed to fetch credit analytics' });
  }
});

// Get document processing analytics
router.get('/documents', async (req, res) => {
  try {
    const { days = 30 } = req.query;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - Number(days));

    const [
      processingStats,
      documentsByStatus,
      processingTime,
      errorRate
    ] = await Promise.all([
      // Processing statistics over time
      prisma.$queryRaw`
        SELECT 
          DATE(created_at) as date,
          COUNT(*) as total,
          COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed,
          COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed
        FROM "Job"
        WHERE created_at >= ${startDate}
        GROUP BY DATE(created_at)
        ORDER BY date
      `,
      
      // Documents by status
      prisma.job.groupBy({
        by: ['status'],
        _count: {
          _all: true
        }
      }),
      
      // Average processing time
      prisma.$queryRaw`
        SELECT 
          AVG(EXTRACT(EPOCH FROM (updated_at - created_at))) as avg_seconds
        FROM "Job"
        WHERE status = 'completed' AND created_at >= ${startDate}
      `,
      
      // Error rate by day
      prisma.$queryRaw`
        SELECT 
          DATE(created_at) as date,
          COUNT(CASE WHEN status = 'failed' THEN 1 END)::float / COUNT(*)::float * 100 as error_rate
        FROM "Job"
        WHERE created_at >= ${startDate}
        GROUP BY DATE(created_at)
        ORDER BY date
      `
    ]);

    res.json({
      processingStats,
      documentsByStatus: documentsByStatus.map(item => ({
        status: item.status,
        count: item._count._all
      })),
      averageProcessingTime: processingTime[0]?.avg_seconds || 0,
      errorRate
    });
  } catch (error) {
    console.error('Document analytics error:', error);
    res.status(500).json({ error: 'Failed to fetch document analytics' });
  }
});

// Get error logs
router.get('/errors', async (req, res) => {
  try {
    const { limit = 50 } = req.query;

    const errors = await prisma.job.findMany({
      where: {
        status: 'failed',
        error: { not: null }
      },
      select: {
        id: true,
        fileName: true,
        error: true,
        createdAt: true,
        user: {
          select: {
            email: true,
            name: true
          }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: Number(limit)
    });

    res.json(errors);
  } catch (error) {
    console.error('Error logs fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch error logs' });
  }
});

// Helper function to format activity descriptions
function formatActivityDescription(log) {
  const actions = {
    'USER_CREATED': 'New user registered',
    'USER_LOGIN': 'User logged in',
    'USER_LOGOUT': 'User logged out',
    'ADMIN_LOGIN': 'Admin logged in',
    'ADMIN_LOGOUT': 'Admin logged out',
    'DOCUMENT_UPLOADED': 'Document uploaded',
    'DOCUMENT_PROCESSED': 'Document processed',
    'CREDITS_ADDED': 'Credits added',
    'CREDITS_DEDUCTED': 'Credits deducted',
    'USER_UPDATED': 'User updated',
    'SESSION_CREATED': 'Processing session created',
    'SESSION_COMPLETED': 'Processing session completed'
  };

  return actions[log.action] || log.action;
}

export default router;