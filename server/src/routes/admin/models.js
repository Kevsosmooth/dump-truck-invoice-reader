import express from 'express';
import { authenticateAdmin } from '../../middleware/admin-auth.js';
import modelManager from '../../services/model-manager.js';
import prisma from '../../config/prisma.js';

const router = express.Router();

// List all models (admin view)
router.get('/', authenticateAdmin, async (req, res) => {
  try {
    const { search = '', filter = 'all' } = req.query;
    
    // Get all configured models with user counts
    const models = await modelManager.getAllModels();
    
    // Filter models based on search
    let filteredModels = models;
    
    if (search) {
      const searchLower = search.toLowerCase();
      filteredModels = filteredModels.filter(model => 
        model.displayName.toLowerCase().includes(searchLower) ||
        model.azureModelId.toLowerCase().includes(searchLower) ||
        model.description?.toLowerCase().includes(searchLower)
      );
    }
    
    // Apply status filter
    if (filter !== 'all') {
      switch (filter) {
        case 'active':
          filteredModels = filteredModels.filter(m => m.isActive);
          break;
        case 'inactive':
          filteredModels = filteredModels.filter(m => !m.isActive);
          break;
      }
    }
    
    res.json({
      models: filteredModels,
      count: filteredModels.length,
    });
  } catch (error) {
    console.error('Error listing models:', error);
    res.status(500).json({ 
      error: 'Failed to list models',
      details: error.message 
    });
  }
});

// Sync models with Azure
router.post('/sync', authenticateAdmin, async (req, res) => {
  try {
    const syncResults = await modelManager.syncModelsWithDatabase(req.admin.id);
    
    res.json({
      success: true,
      message: `Synced models with Azure`,
      results: syncResults
    });
  } catch (error) {
    console.error('Error syncing models:', error);
    res.status(500).json({ 
      error: 'Failed to sync models with Azure',
      details: error.message 
    });
  }
});

// Create a new model configuration
router.post('/', authenticateAdmin, async (req, res) => {
  try {
    const { azureModelId, displayName, description } = req.body;
    
    if (!azureModelId || !displayName) {
      return res.status(400).json({ 
        error: 'Azure model ID and display name are required' 
      });
    }
    
    // Check if already configured
    const existing = await prisma.modelConfiguration.findUnique({
      where: { azureModelId }
    });
    
    if (existing) {
      return res.status(409).json({ 
        error: 'Model already configured',
        modelId: azureModelId 
      });
    }
    
    // Create configuration
    const config = await modelManager.createModelConfiguration(
      azureModelId,
      displayName,
      req.admin.id,
      { description }
    );
    
    // Log the action
    await prisma.auditLog.create({
      data: {
        userId: req.admin.id,
        eventType: 'MODEL_CONFIGURED',
        eventData: {
          modelId: azureModelId,
          configId: config.id,
          displayName
        },
      },
    });
    
    res.status(201).json({
      success: true,
      config
    });
  } catch (error) {
    console.error('Error creating model configuration:', error);
    res.status(500).json({ 
      error: 'Failed to create model configuration',
      details: error.message 
    });
  }
});

// Get model details
router.get('/:configId', authenticateAdmin, async (req, res) => {
  try {
    const { configId } = req.params;
    
    const model = await modelManager.getModelDetails(configId);
    
    if (!model) {
      return res.status(404).json({ error: 'Model configuration not found' });
    }
    
    res.json(model);
  } catch (error) {
    console.error('Error getting model details:', error);
    res.status(500).json({ 
      error: 'Failed to get model details',
      details: error.message 
    });
  }
});

// Update model configuration
router.patch('/:configId', authenticateAdmin, async (req, res) => {
  try {
    const { configId } = req.params;
    const { displayName, description, isActive } = req.body;
    
    const config = await prisma.modelConfiguration.findUnique({
      where: { id: configId },
    });
    
    if (!config) {
      return res.status(404).json({ error: 'Model configuration not found' });
    }
    
    const updateData = {};
    if (displayName !== undefined) updateData.displayName = displayName;
    if (description !== undefined) updateData.description = description;
    if (isActive !== undefined) updateData.isActive = isActive;
    
    const updated = await prisma.modelConfiguration.update({
      where: { id: configId },
      data: updateData,
      include: {
        creator: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
        _count: {
          select: {
            fieldConfigs: true,
            modelAccess: true,
          },
        },
      },
    });
    
    // Log the action
    await prisma.auditLog.create({
      data: {
        userId: req.admin.id,
        eventType: 'MODEL_UPDATED',
        eventData: {
          configId,
          changes: updateData,
        },
      },
    });
    
    res.json({
      success: true,
      config: updated,
    });
  } catch (error) {
    console.error('Error updating model:', error);
    res.status(500).json({ 
      error: 'Failed to update model',
      details: error.message 
    });
  }
});

// Get field configurations for a model
router.get('/:configId/fields', authenticateAdmin, async (req, res) => {
  try {
    const { configId } = req.params;
    
    const modelConfig = await prisma.modelConfiguration.findUnique({
      where: { id: configId },
      include: {
        fieldConfigs: {
          orderBy: { fieldOrder: 'asc' }
        },
      },
    });
    
    if (!modelConfig) {
      return res.status(404).json({ error: 'Model configuration not found' });
    }
    
    // Get Azure model details to get all available fields
    const azureDetails = await modelManager.getAzureModelDetails(modelConfig.azureModelId);
    const azureFields = modelManager.extractFieldsFromAzureModel(azureDetails);
    
    // Merge with database configurations
    const fields = modelManager.mergeFieldConfigurations(azureFields, modelConfig.fieldConfigs);
    
    res.json({
      modelConfigId: modelConfig.id,
      azureModelId: modelConfig.azureModelId,
      displayName: modelConfig.displayName,
      fields,
      fieldCount: fields.length,
      configuredCount: modelConfig.fieldConfigs.length,
    });
  } catch (error) {
    console.error('Error getting field configurations:', error);
    res.status(500).json({ 
      error: 'Failed to get field configurations',
      details: error.message 
    });
  }
});

// Update field configurations for a model
router.put('/:configId/fields', authenticateAdmin, async (req, res) => {
  try {
    const { configId } = req.params;
    const { fields } = req.body;
    
    if (!Array.isArray(fields)) {
      return res.status(400).json({ error: 'Fields must be an array' });
    }
    
    const modelConfig = await prisma.modelConfiguration.findUnique({
      where: { id: configId },
    });
    
    if (!modelConfig) {
      return res.status(404).json({ error: 'Model configuration not found' });
    }
    
    // Update fields
    const updatedFields = await modelManager.updateFieldConfigurations(configId, fields);
    
    // Log the action
    await prisma.auditLog.create({
      data: {
        userId: req.admin.id,
        eventType: 'FIELDS_UPDATED',
        eventData: {
          configId: modelConfig.id,
          modelId: modelConfig.azureModelId,
          fieldsUpdated: fields.length,
        },
      },
    });
    
    res.json({
      success: true,
      fieldsUpdated: updatedFields.length,
      fields: updatedFields,
    });
  } catch (error) {
    console.error('Error updating field configurations:', error);
    res.status(500).json({ 
      error: 'Failed to update field configurations',
      details: error.message 
    });
  }
});

// Get users with access to a model
router.get('/:configId/access', authenticateAdmin, async (req, res) => {
  try {
    const { configId } = req.params;
    
    const access = await modelManager.getModelUsers(configId);
    
    res.json({
      configId,
      access,
      count: access.length,
    });
  } catch (error) {
    console.error('Error getting model access:', error);
    res.status(500).json({ 
      error: 'Failed to get model access',
      details: error.message 
    });
  }
});

// Grant model access to users
router.post('/:configId/access', authenticateAdmin, async (req, res) => {
  try {
    const { configId } = req.params;
    const { userIds, customName, expiresAt } = req.body;
    
    if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
      return res.status(400).json({ 
        error: 'User IDs array is required' 
      });
    }
    
    const config = await prisma.modelConfiguration.findUnique({
      where: { id: configId },
    });
    
    if (!config) {
      return res.status(404).json({ error: 'Model configuration not found' });
    }
    
    // Grant access to all users
    const results = await modelManager.grantAccess(
      configId,
      userIds,
      req.admin.id,
      { customName, expiresAt: expiresAt ? new Date(expiresAt) : null }
    );
    
    // Log the action
    await prisma.auditLog.create({
      data: {
        userId: req.admin.id,
        eventType: 'MODEL_ACCESS_GRANTED',
        eventData: {
          configId,
          userIds,
          customName,
          expiresAt
        },
      },
    });
    
    res.status(201).json({
      success: true,
      accessGranted: results.length,
      results
    });
  } catch (error) {
    console.error('Error granting model access:', error);
    res.status(500).json({ 
      error: 'Failed to grant model access',
      details: error.message 
    });
  }
});

// Update user's model access
router.patch('/:configId/access/:userId', authenticateAdmin, async (req, res) => {
  try {
    const { configId, userId } = req.params;
    const { customName, expiresAt } = req.body;
    
    const access = await prisma.modelAccess.findUnique({
      where: {
        modelConfigId_userId: {
          modelConfigId: configId,
          userId: parseInt(userId)
        }
      }
    });
    
    if (!access) {
      return res.status(404).json({ error: 'Access not found' });
    }
    
    const updateData = {};
    if (customName !== undefined) updateData.customName = customName;
    if (expiresAt !== undefined) updateData.expiresAt = expiresAt ? new Date(expiresAt) : null;
    
    const updated = await prisma.modelAccess.update({
      where: {
        modelConfigId_userId: {
          modelConfigId: configId,
          userId: parseInt(userId)
        }
      },
      data: updateData,
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          }
        }
      }
    });
    
    res.json({
      success: true,
      access: updated
    });
  } catch (error) {
    console.error('Error updating model access:', error);
    res.status(500).json({ 
      error: 'Failed to update model access',
      details: error.message 
    });
  }
});

// Revoke model access for a user
router.delete('/:configId/access/:userId', authenticateAdmin, async (req, res) => {
  try {
    const { configId, userId } = req.params;
    
    await modelManager.revokeAccess(configId, parseInt(userId));
    
    // Log the action
    await prisma.auditLog.create({
      data: {
        userId: req.admin.id,
        eventType: 'MODEL_ACCESS_REVOKED',
        eventData: {
          configId,
          userId: parseInt(userId)
        },
      },
    });
    
    res.json({
      success: true,
      message: 'Access revoked',
    });
  } catch (error) {
    console.error('Error revoking model access:', error);
    res.status(500).json({ 
      error: 'Failed to revoke model access',
      details: error.message 
    });
  }
});

// Get available Azure models
router.get('/azure/available', authenticateAdmin, async (req, res) => {
  try {
    const azureModels = await modelManager.listAzureModels();
    
    // Get already configured models
    const configured = await prisma.modelConfiguration.findMany({
      select: { azureModelId: true }
    });
    const configuredIds = new Set(configured.map(c => c.azureModelId));
    
    // Filter out already configured models
    const availableModels = azureModels.filter(m => !configuredIds.has(m.modelId));
    
    res.json({
      models: availableModels,
      count: availableModels.length
    });
  } catch (error) {
    console.error('Error getting available Azure models:', error);
    res.status(500).json({ 
      error: 'Failed to get available Azure models',
      details: error.message 
    });
  }
});

// Get model usage statistics
router.get('/:configId/stats', authenticateAdmin, async (req, res) => {
  try {
    const { configId } = req.params;
    const { startDate, endDate } = req.query;
    
    const config = await prisma.modelConfiguration.findUnique({
      where: { id: configId },
      include: {
        _count: {
          select: {
            fieldConfigs: true,
            modelAccess: {
              where: { isActive: true }
            },
            jobs: true
          },
        },
      },
    });
    
    if (!config) {
      return res.status(404).json({ error: 'Model configuration not found' });
    }
    
    // Get usage by date for the specified period (default last 30 days)
    const end = endDate ? new Date(endDate) : new Date();
    const start = startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    
    const jobs = await prisma.job.findMany({
      where: {
        modelConfigId: configId,
        createdAt: {
          gte: start,
          lte: end
        }
      },
      select: {
        createdAt: true,
        creditsUsed: true,
        status: true,
      },
    });
    
    // Group by date
    const usageByDate = {};
    jobs.forEach(job => {
      const date = job.createdAt.toISOString().split('T')[0];
      if (!usageByDate[date]) {
        usageByDate[date] = {
          date,
          count: 0,
          credits: 0,
          successful: 0,
          failed: 0,
        };
      }
      usageByDate[date].count++;
      usageByDate[date].credits += job.creditsUsed || 0;
      if (job.status === 'COMPLETED') {
        usageByDate[date].successful++;
      } else if (job.status === 'FAILED') {
        usageByDate[date].failed++;
      }
    });
    
    // Convert to array and fill gaps
    const usage = [];
    const currentDate = new Date(start);
    while (currentDate <= end) {
      const dateStr = currentDate.toISOString().split('T')[0];
      usage.push(usageByDate[dateStr] || {
        date: dateStr,
        count: 0,
        credits: 0,
        successful: 0,
        failed: 0,
      });
      currentDate.setDate(currentDate.getDate() + 1);
    }
    
    res.json({
      configId: config.id,
      azureModelId: config.azureModelId,
      displayName: config.displayName,
      stats: {
        totalJobs: config._count.jobs,
        activeUsers: config._count.modelAccess,
        configuredFields: config._count.fieldConfigs,
        isActive: config.isActive,
      },
      usage,
    });
  } catch (error) {
    console.error('Error getting model stats:', error);
    res.status(500).json({ 
      error: 'Failed to get model statistics',
      details: error.message 
    });
  }
});

// Search users for model access assignment
router.get('/users/search', authenticateAdmin, async (req, res) => {
  try {
    const { q = '', excludeModel } = req.query;
    
    const whereClause = {
      AND: [
        {
          OR: [
            { email: { contains: q, mode: 'insensitive' } },
            { firstName: { contains: q, mode: 'insensitive' } },
            { lastName: { contains: q, mode: 'insensitive' } }
          ]
        }
      ]
    };
    
    // Exclude users who already have access to the model
    if (excludeModel) {
      const existingAccess = await prisma.modelAccess.findMany({
        where: {
          modelConfigId: excludeModel,
          isActive: true
        },
        select: { userId: true }
      });
      const excludeUserIds = existingAccess.map(a => a.userId);
      
      if (excludeUserIds.length > 0) {
        whereClause.AND.push({
          NOT: {
            id: { in: excludeUserIds }
          }
        });
      }
    }
    
    const users = await prisma.user.findMany({
      where: whereClause,
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        credits: true,
        organization: {
          select: {
            id: true,
            name: true
          }
        }
      },
      take: 20,
      orderBy: [
        { firstName: 'asc' },
        { lastName: 'asc' }
      ]
    });
    
    res.json(users);
  } catch (error) {
    console.error('Error searching users:', error);
    res.status(500).json({ 
      error: 'Failed to search users',
      details: error.message 
    });
  }
});

export default router;