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

// Models management endpoints

// Get all models (Azure + configured)
router.get('/models', async (req, res) => {
  try {
    const { search = '', filter = 'all' } = req.query;

    // Get configured models from database
    const configuredModels = await prisma.modelConfiguration.findMany({
      where: {
        OR: [
          { customName: { contains: search, mode: 'insensitive' } },
          { azureModelId: { contains: search, mode: 'insensitive' } },
          { description: { contains: search, mode: 'insensitive' } }
        ],
        ...(filter === 'active' && { isActive: true }),
        ...(filter === 'inactive' && { isActive: false }),
        ...(filter === 'public' && { isPublic: true }),
        ...(filter === 'private' && { isPublic: false })
      },
      include: {
        creator: {
          select: { email: true, firstName: true, lastName: true }
        },
        _count: {
          select: { modelAccess: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    // TODO: Fetch Azure models from Azure API
    // For now, return a mock list
    const azureModels = [
      {
        id: 'prebuilt-invoice',
        name: 'Prebuilt Invoice',
        description: 'Extract key information from invoices',
        isAzureModel: true,
        status: 'available'
      },
      {
        id: 'prebuilt-receipt',
        name: 'Prebuilt Receipt',
        description: 'Extract data from receipts',
        isAzureModel: true,
        status: 'available'
      }
    ];

    // Merge configured models with Azure models
    const allModels = [
      ...configuredModels.map(model => ({
        ...model,
        isConfigured: true,
        usageCount: model._count.modelAccess
      })),
      ...azureModels.filter(azureModel => 
        !configuredModels.some(config => config.azureModelId === azureModel.id)
      )
    ];

    return res.json({ models: allModels });
  } catch (error) {
    console.error('Get models error:', error);
    return res.status(500).json({ error: 'Failed to fetch models' });
  }
});

// Sync with Azure to discover new models
router.post('/models/sync', async (req, res) => {
  try {
    // TODO: Implement Azure API call to fetch available models
    // For now, return mock data
    const newModels = [
      {
        id: 'custom-model-1',
        name: 'Custom Model 1',
        description: 'A custom trained model',
        status: 'succeeded'
      }
    ];

    // Log the sync action
    await prisma.auditLog.create({
      data: {
        userId: req.admin.id,
        eventType: 'MODELS_SYNCED',
        eventData: {
          action: 'SYNC_MODELS',
          newModelsCount: newModels.length
        }
      }
    });

    return res.json({ 
      message: 'Models synced successfully',
      newModels 
    });
  } catch (error) {
    console.error('Sync models error:', error);
    return res.status(500).json({ error: 'Failed to sync models' });
  }
});

// Configure a model
router.post('/models/:modelId/configure', async (req, res) => {
  try {
    const { modelId } = req.params;
    const { customName, description, isActive, isPublic } = req.body;

    if (!customName) {
      return res.status(400).json({ error: 'Custom name is required' });
    }

    const modelConfig = await prisma.modelConfiguration.upsert({
      where: {
        azureModelId_createdBy: {
          azureModelId: modelId,
          createdBy: req.admin.id
        }
      },
      update: {
        customName,
        description,
        isActive: isActive ?? true,
        isPublic: isPublic ?? false
      },
      create: {
        azureModelId: modelId,
        customName,
        description,
        isActive: isActive ?? true,
        isPublic: isPublic ?? false,
        createdBy: req.admin.id
      },
      include: {
        creator: {
          select: { email: true, firstName: true, lastName: true }
        }
      }
    });

    // Log the action
    await prisma.auditLog.create({
      data: {
        userId: req.admin.id,
        eventType: 'MODEL_CONFIGURED',
        eventData: {
          action: 'CONFIGURE_MODEL',
          modelId: modelConfig.id,
          azureModelId: modelId,
          changes: req.body
        }
      }
    });

    return res.json({ model: modelConfig });
  } catch (error) {
    console.error('Configure model error:', error);
    return res.status(500).json({ error: 'Failed to configure model' });
  }
});

// Update model configuration
router.patch('/models/:configId', async (req, res) => {
  try {
    const { configId } = req.params;
    const { customName, description, isActive, isPublic } = req.body;

    const modelConfig = await prisma.modelConfiguration.update({
      where: { id: configId },
      data: {
        ...(customName && { customName }),
        ...(description !== undefined && { description }),
        ...(isActive !== undefined && { isActive }),
        ...(isPublic !== undefined && { isPublic })
      },
      include: {
        creator: {
          select: { email: true, firstName: true, lastName: true }
        },
        _count: {
          select: { modelAccess: true }
        }
      }
    });

    // Log the action
    await prisma.auditLog.create({
      data: {
        userId: req.admin.id,
        eventType: 'MODEL_UPDATED',
        eventData: {
          action: 'UPDATE_MODEL',
          modelId: modelConfig.id,
          changes: req.body
        }
      }
    });

    return res.json({ model: modelConfig });
  } catch (error) {
    console.error('Update model error:', error);
    return res.status(500).json({ error: 'Failed to update model' });
  }
});

// Get model statistics
router.get('/models/:configId/stats', async (req, res) => {
  try {
    const { configId } = req.params;

    const [config, usageStats] = await Promise.all([
      prisma.modelConfiguration.findUnique({
        where: { id: configId },
        include: {
          _count: {
            select: { modelAccess: true }
          }
        }
      }),
      prisma.job.groupBy({
        by: ['status'],
        where: {
          modelId: configId
        },
        _count: {
          _all: true
        }
      })
    ]);

    if (!config) {
      return res.status(404).json({ error: 'Model configuration not found' });
    }

    const stats = {
      totalUsers: config._count.modelAccess,
      totalJobs: usageStats.reduce((sum, stat) => sum + stat._count._all, 0),
      jobsByStatus: usageStats.reduce((acc, stat) => {
        acc[stat.status] = stat._count._all;
        return acc;
      }, {}),
      successRate: usageStats.find(s => s.status === 'COMPLETED')?._count._all || 0
    };

    return res.json({ stats });
  } catch (error) {
    console.error('Get model stats error:', error);
    return res.status(500).json({ error: 'Failed to fetch model statistics' });
  }
});

// Manage model access
router.post('/models/:configId/access', async (req, res) => {
  try {
    const { configId } = req.params;
    const { userId, organizationId, canRead, canUse, canEdit, expiresAt } = req.body;

    if (!userId && !organizationId) {
      return res.status(400).json({ error: 'Either userId or organizationId is required' });
    }

    const access = await prisma.modelAccess.create({
      data: {
        modelConfigId: configId,
        userId,
        organizationId,
        canRead: canRead ?? true,
        canUse: canUse ?? true,
        canEdit: canEdit ?? false,
        grantedBy: req.admin.id,
        expiresAt: expiresAt ? new Date(expiresAt) : null
      },
      include: {
        user: {
          select: { email: true, firstName: true, lastName: true }
        },
        organization: {
          select: { name: true }
        }
      }
    });

    // Log the action
    await prisma.auditLog.create({
      data: {
        userId: req.admin.id,
        eventType: 'MODEL_ACCESS_GRANTED',
        eventData: {
          action: 'GRANT_MODEL_ACCESS',
          modelConfigId: configId,
          targetUserId: userId,
          targetOrgId: organizationId,
          permissions: { canRead, canUse, canEdit }
        }
      }
    });

    return res.json({ access });
  } catch (error) {
    console.error('Grant model access error:', error);
    return res.status(500).json({ error: 'Failed to grant model access' });
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