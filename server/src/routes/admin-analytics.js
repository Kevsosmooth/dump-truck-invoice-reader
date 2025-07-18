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
    // Pagination for recent activity
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

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
      recentActivity,
      totalActivityCount
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
        where: { status: 'COMPLETED' }
      }),
      
      // Documents last month
      prisma.job.count({
        where: {
          status: 'COMPLETED',
          createdAt: {
            gte: lastMonth,
            lt: startOfMonth
          }
        }
      }),
      
      // Total credits used (sum of all USAGE transactions)
      prisma.transaction.aggregate({
        where: { type: 'USAGE' },
        _sum: { amount: true }
      }),
      
      // Credits used last month
      prisma.transaction.aggregate({
        where: {
          type: 'USAGE',
          createdAt: {
            gte: lastMonth,
            lt: startOfMonth
          }
        },
        _sum: { amount: true }
      }),
      
      // Active processing sessions
      prisma.processingSession.count({
        where: { status: 'PROCESSING' }
      }),
      
      // Recent activity with pagination
      prisma.auditLog.findMany({
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          user: {
            select: {
              email: true,
              firstName: true,
              lastName: true
            }
          }
        }
      }),
      
      // Total count of audit logs for pagination
      prisma.auditLog.count()
    ]);

    // Calculate trends
    const usersTrend = lastMonthUsers > 0 
      ? Math.round(((totalUsers - lastMonthUsers) / lastMonthUsers) * 100)
      : 0;
    
    const documentsTrend = lastMonthDocuments > 0
      ? Math.round(((totalDocuments - lastMonthDocuments) / lastMonthDocuments) * 100)
      : 0;
    
    const creditsTrend = lastMonthCredits._sum.amount && lastMonthCredits._sum.amount > 0
      ? Math.round((((creditsUsed._sum.amount || 0) - lastMonthCredits._sum.amount) / lastMonthCredits._sum.amount) * 100)
      : 0;

    // Format recent activity
    const formattedActivity = recentActivity.map(log => ({
      id: log.id,
      description: formatActivityDescription(log),
      user: log.user ? `${log.user.firstName || ''} ${log.user.lastName || ''}`.trim() || log.user.email : 'System',
      timestamp: log.createdAt,
      action: log.eventType,
      entityType: log.eventType
    }));

    // Get actual system metrics
    const [processingTimes, storageInfo] = await Promise.all([
      // Average API response time from recent jobs
      prisma.$queryRaw`
        SELECT 
          AVG(EXTRACT(EPOCH FROM ("completedAt" - "createdAt")) * 1000) as avg_ms
        FROM "Job"
        WHERE status = 'COMPLETED' 
          AND "createdAt" >= ${new Date(Date.now() - 24 * 60 * 60 * 1000)}
          AND "completedAt" IS NOT NULL
      `,
      
      // Get total storage used (count of jobs * average size estimate)
      prisma.job.count()
    ]);

    const apiResponseTime = processingTimes[0]?.avg_ms ? Math.round(processingTimes[0].avg_ms) : 45;
    const storageUsage = Math.min(Math.round((storageInfo * 0.5) / 1000), 95); // Estimate 0.5MB per job, cap at 95%

    res.json({
      totalUsers,
      usersTrend,
      totalDocuments,
      documentsTrend,
      creditsUsed: creditsUsed._sum.amount || 0,
      creditsTrend,
      activeSessions,
      recentActivity: formattedActivity,
      recentActivityPagination: {
        page,
        limit,
        total: totalActivityCount,
        totalPages: Math.ceil(totalActivityCount / limit)
      },
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
          DATE("createdAt") as date,
          COUNT(*) as count
        FROM "User"
        WHERE "createdAt" >= ${startDate}
        GROUP BY DATE("createdAt")
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
          u.id, u.email, u."firstName", u."lastName",
          COALESCE(SUM(t.amount), 0) as credits_used
        FROM "User" u
        LEFT JOIN "Transaction" t ON u.id = t."userId" AND t.type = 'USAGE'
        GROUP BY u.id, u.email, u."firstName", u."lastName"
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
          DATE("createdAt") as date,
          SUM(CASE WHEN type = 'USAGE' THEN amount ELSE 0 END) as used,
          SUM(CASE WHEN type IN ('PURCHASE', 'ADMIN_CREDIT') THEN amount ELSE 0 END) as added
        FROM "Transaction"
        WHERE "createdAt" >= ${startDate}
        GROUP BY DATE("createdAt")
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
          u.id, u.email, u."firstName", u."lastName", u.credits as current_credits,
          COALESCE(SUM(t.amount), 0) as total_used
        FROM "User" u
        LEFT JOIN "Transaction" t ON u.id = t."userId" AND t.type = 'USAGE'
        WHERE t."createdAt" >= ${startDate}
        GROUP BY u.id, u.email, u."firstName", u."lastName", u.credits
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
          DATE("createdAt") as date,
          COUNT(*) as total,
          COUNT(CASE WHEN status = 'COMPLETED' THEN 1 END) as completed,
          COUNT(CASE WHEN status = 'FAILED' THEN 1 END) as failed
        FROM "Job"
        WHERE "createdAt" >= ${startDate}
        GROUP BY DATE("createdAt")
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
          AVG(EXTRACT(EPOCH FROM ("completedAt" - "createdAt"))) as avg_seconds
        FROM "Job"
        WHERE status = 'COMPLETED' AND "createdAt" >= ${startDate} AND "completedAt" IS NOT NULL
      `,
      
      // Error rate by day
      prisma.$queryRaw`
        SELECT 
          DATE("createdAt") as date,
          COUNT(CASE WHEN status = 'FAILED' THEN 1 END)::float / COUNT(*)::float * 100 as error_rate
        FROM "Job"
        WHERE "createdAt" >= ${startDate}
        GROUP BY DATE("createdAt")
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
        status: 'FAILED',
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
            firstName: true,
            lastName: true
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

// Get system metrics
router.get('/system-metrics', async (req, res) => {
  try {
    const [
      dbSize,
      activeJobs,
      recentErrors,
      azureHealth
    ] = await Promise.all([
      // Database size
      prisma.$queryRaw`
        SELECT 
          pg_database_size(current_database()) as size,
          pg_size_pretty(pg_database_size(current_database())) as size_pretty
      `,
      
      // Active jobs
      prisma.job.count({
        where: {
          status: { in: ['PROCESSING', 'QUEUED'] }
        }
      }),
      
      // Recent error count (last hour)
      prisma.job.count({
        where: {
          status: 'FAILED',
          createdAt: { gte: new Date(Date.now() - 60 * 60 * 1000) }
        }
      }),
      
      // Azure API health (check if we have recent successful jobs)
      prisma.job.findFirst({
        where: {
          status: 'COMPLETED',
          createdAt: { gte: new Date(Date.now() - 5 * 60 * 1000) } // Last 5 minutes
        }
      })
    ]);

    res.json({
      database: {
        size: dbSize[0].size,
        sizePretty: dbSize[0].size_pretty,
        status: 'healthy'
      },
      processing: {
        activeJobs,
        queueStatus: activeJobs > 50 ? 'busy' : activeJobs > 20 ? 'moderate' : 'normal'
      },
      errors: {
        recentCount: recentErrors,
        status: recentErrors > 10 ? 'high' : recentErrors > 5 ? 'moderate' : 'low'
      },
      azure: {
        status: azureHealth ? 'connected' : 'unknown',
        lastSuccess: azureHealth?.createdAt || null
      }
    });
  } catch (error) {
    console.error('System metrics error:', error);
    res.status(500).json({ error: 'Failed to fetch system metrics' });
  }
});

// Get revenue analytics
router.get('/revenue', async (req, res) => {
  try {
    const { days = 30 } = req.query;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - Number(days));

    const [
      revenueOverTime,
      revenueByPackage,
      totalRevenue,
      averagePurchase
    ] = await Promise.all([
      // Revenue over time (assuming $0.10 per credit)
      prisma.$queryRaw`
        SELECT 
          DATE("createdAt") as date,
          SUM(amount) * 0.10 as revenue,
          COUNT(*) as purchases
        FROM "Transaction"
        WHERE type = 'PURCHASE' AND "createdAt" >= ${startDate}
        GROUP BY DATE("createdAt")
        ORDER BY date
      `,
      
      // Revenue by package size
      prisma.$queryRaw`
        SELECT 
          CASE 
            WHEN amount <= 100 THEN 'Small (1-100)'
            WHEN amount <= 500 THEN 'Medium (101-500)'
            WHEN amount <= 1000 THEN 'Large (501-1000)'
            ELSE 'Enterprise (1000+)'
          END as package_size,
          COUNT(*) as count,
          SUM(amount) * 0.10 as revenue
        FROM "Transaction"
        WHERE type = 'PURCHASE' AND "createdAt" >= ${startDate}
        GROUP BY package_size
      `,
      
      // Total revenue
      prisma.transaction.aggregate({
        where: { 
          type: 'PURCHASE',
          createdAt: { gte: startDate }
        },
        _sum: { amount: true }
      }),
      
      // Average purchase size
      prisma.transaction.aggregate({
        where: { 
          type: 'PURCHASE',
          createdAt: { gte: startDate }
        },
        _avg: { amount: true }
      })
    ]);

    res.json({
      revenueOverTime,
      revenueByPackage,
      totalRevenue: (totalRevenue._sum.amount || 0) * 0.10, // Convert to dollars
      averagePurchase: averagePurchase._avg.amount || 0,
      averageRevenue: (averagePurchase._avg.amount || 0) * 0.10
    });
  } catch (error) {
    console.error('Revenue analytics error:', error);
    res.status(500).json({ error: 'Failed to fetch revenue analytics' });
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
    'ADMIN_GOOGLE_LOGIN': 'Admin logged in via Google',
    'DOCUMENT_UPLOADED': 'Document uploaded',
    'DOCUMENT_PROCESSED': 'Document processed',
    'CREDITS_ADDED': 'Credits added',
    'CREDITS_DEDUCTED': 'Credits deducted',
    'USER_UPDATED': 'User updated',
    'SESSION_CREATED': 'Processing session created',
    'SESSION_COMPLETED': 'Processing session completed'
  };

  return actions[log.eventType] || log.eventType;
}

export default router;