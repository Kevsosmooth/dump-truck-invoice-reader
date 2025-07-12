import express from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateAdmin } from '../middleware/admin-auth.js';

const router = express.Router();
const prisma = new PrismaClient();

// Apply admin authentication to all routes
router.use(authenticateAdmin);

// Get recent activity with pagination
router.get('/recent', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const [recentActivity, totalCount] = await Promise.all([
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
      prisma.auditLog.count()
    ]);

    // Format activity
    const formattedActivity = recentActivity.map(log => ({
      id: log.id,
      description: formatActivityDescription(log),
      user: log.user ? `${log.user.firstName || ''} ${log.user.lastName || ''}`.trim() || log.user.email : 'System',
      timestamp: log.createdAt,
      action: log.eventType,
      entityType: log.eventType
    }));

    res.json({
      recentActivity: formattedActivity,
      pagination: {
        page,
        limit,
        total: totalCount,
        totalPages: Math.ceil(totalCount / limit)
      }
    });
  } catch (error) {
    console.error('Recent activity error:', error);
    res.status(500).json({ error: 'Failed to fetch recent activity' });
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
    'CREDIT_ADJUSTMENT': 'Credits adjusted',
    'BULK_CREDIT_ADJUSTMENT': 'Bulk credits adjusted',
    'USER_UPDATED': 'User updated',
    'SESSION_CREATED': 'Processing session created',
    'SESSION_COMPLETED': 'Processing session completed',
    'MODELS_SYNCED': 'Models synchronized',
    'MODEL_CONFIGURED': 'Model configured',
    'MODEL_UPDATED': 'Model updated',
    'MODEL_ACCESS_GRANTED': 'Model access granted',
    'MODEL_CREATED': 'Model created',
    'MODEL_DELETED': 'Model deleted',
    'MODEL_ACCESS_UPDATED': 'Model access updated',
    'MODEL_FIELD_UPDATED': 'Model field updated'
  };

  return actions[log.eventType] || log.eventType;
}

export default router;