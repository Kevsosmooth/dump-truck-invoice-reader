import express from 'express';
import { authenticateAdmin } from '../../middleware/admin-auth.js';
import modelManager from '../../services/model-manager.js';
import prisma from '../../config/prisma.js';

const router = express.Router();

// List all models (Azure + configured)
router.get('/', authenticateAdmin, async (req, res) => {
  try {
    const { search = '', filter = 'all' } = req.query;
    
    // Get Azure models
    const azureModels = await modelManager.listAzureModels();
    
    // Get configured models from database
    const configuredModels = await prisma.modelConfiguration.findMany({
      include: {
        creator: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
        fieldConfigs: {
          select: {
            id: true,
          },
        },
        modelAccess: {
          select: {
            id: true,
            userId: true,
            organizationId: true,
          },
        },
        _count: {
          select: {
            fieldConfigs: true,
            modelAccess: true,
          },
        },
      },
      orderBy: [
        { isPublic: 'desc' },
        { createdAt: 'desc' },
      ],
    });
    
    // Create a map of configured models
    const configuredMap = new Map();
    configuredModels.forEach(model => {
      configuredMap.set(model.azureModelId, model);
    });
    
    // Combine Azure models with configuration data
    const combinedModels = azureModels.map(azureModel => {
      const configured = configuredMap.get(azureModel.modelId);
      const usageCount = configured?.modelAccess?.length || 0;
      const jobCount = 0; // TODO: Get from jobs table
      
      return {
        id: configured?.id || null,
        azureModelId: azureModel.modelId,
        name: azureModel.modelId,
        customName: configured?.customName || azureModel.description || azureModel.modelId,
        description: configured?.description || azureModel.description,
        isActive: configured?.isActive ?? false,
        isPublic: configured?.isPublic ?? false,
        isConfigured: !!configured,
        isAzureModel: true,
        status: azureModel.status || 'ready',
        createdAt: azureModel.createdDateTime,
        updatedAt: configured?.updatedAt || azureModel.createdDateTime,
        creator: configured?.creator,
        fieldConfigCount: configured?._count?.fieldConfigs || 0,
        usageCount,
        _count: {
          jobs: jobCount,
        },
      };
    });
    
    // Filter models based on search and filter
    let filteredModels = combinedModels;
    
    if (search) {
      const searchLower = search.toLowerCase();
      filteredModels = filteredModels.filter(model => 
        model.customName.toLowerCase().includes(searchLower) ||
        model.azureModelId.toLowerCase().includes(searchLower) ||
        model.description?.toLowerCase().includes(searchLower)
      );
    }
    
    if (filter !== 'all') {
      switch (filter) {
        case 'active':
          filteredModels = filteredModels.filter(m => m.isActive);
          break;
        case 'inactive':
          filteredModels = filteredModels.filter(m => !m.isActive);
          break;
        case 'public':
          filteredModels = filteredModels.filter(m => m.isPublic);
          break;
        case 'private':
          filteredModels = filteredModels.filter(m => !m.isPublic);
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
    const azureModels = await modelManager.listAzureModels();
    const newModels = [];
    
    for (const azureModel of azureModels) {
      // Check if already configured
      const existing = await prisma.modelConfiguration.findFirst({
        where: { azureModelId: azureModel.modelId }
      });
      
      if (!existing) {
        newModels.push(azureModel);
      }
    }
    
    res.json({
      success: true,
      message: `Found ${azureModels.length} Azure models, ${newModels.length} are new`,
      newModels: newModels.map(m => ({
        modelId: m.modelId,
        description: m.description,
        createdDateTime: m.createdDateTime,
      })),
    });
  } catch (error) {
    console.error('Error syncing models:', error);
    res.status(500).json({ 
      error: 'Failed to sync models with Azure',
      details: error.message 
    });
  }
});

// Configure a model
router.post('/:modelId/configure', authenticateAdmin, async (req, res) => {
  try {
    const { modelId } = req.params;
    const { displayName, description, isPublic = false } = req.body;
    
    // Check if already configured
    const existing = await prisma.modelConfiguration.findFirst({
      where: { 
        azureModelId: modelId,
        createdBy: req.admin.id
      }
    });
    
    if (existing) {
      return res.status(409).json({ 
        error: 'Model already configured',
        modelId 
      });
    }
    
    // Create configuration
    const config = await prisma.modelConfiguration.create({
      data: {
        azureModelId: modelId,
        customName: displayName || modelId,
        description,
        isActive: true,
        isPublic,
        createdBy: req.admin.id,
      },
      include: {
        creator: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });
    
    // Log the action
    await prisma.auditLog.create({
      data: {
        userId: req.admin.id,
        eventType: 'MODEL_CONFIGURED',
        eventData: {
          modelId,
          configId: config.id,
          displayName: config.customName,
        },
      },
    });
    
    res.status(201).json({
      success: true,
      config: {
        id: config.id,
        azureModelId: config.azureModelId,
        customName: config.customName,
        description: config.description,
        isActive: config.isActive,
        isPublic: config.isPublic,
        creator: config.creator,
        createdAt: config.createdAt,
      },
    });
  } catch (error) {
    console.error('Error configuring model:', error);
    res.status(500).json({ 
      error: 'Failed to configure model',
      details: error.message 
    });
  }
});

// Update model configuration
router.patch('/:configId', authenticateAdmin, async (req, res) => {
  try {
    const { configId } = req.params;
    const { displayName, description, isActive, isPublic } = req.body;
    
    const config = await prisma.modelConfiguration.findUnique({
      where: { id: configId },
    });
    
    if (!config) {
      return res.status(404).json({ error: 'Model configuration not found' });
    }
    
    const updateData = {};
    if (displayName !== undefined) updateData.customName = displayName;
    if (description !== undefined) updateData.description = description;
    if (isActive !== undefined) updateData.isActive = isActive;
    if (isPublic !== undefined) updateData.isPublic = isPublic;
    
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
          orderBy: [
            { fieldOrder: 'asc' },
            { azureFieldName: 'asc' },
          ],
        },
      },
    });
    
    if (!modelConfig) {
      return res.status(404).json({ error: 'Model configuration not found' });
    }
    
    // Get Azure model details to get all available fields
    const azureDetails = await modelManager.getAzureModelDetails(modelConfig.azureModelId);
    const azureFields = azureDetails?.docTypes?.[modelConfig.azureModelId]?.fieldSchema || {};
    
    // Combine database configs with Azure field info
    const fields = Object.entries(azureFields).map(([fieldName, azureField]) => {
      const dbConfig = modelConfig.fieldConfigs.find(fc => fc.azureFieldName === fieldName);
      
      return {
        azureFieldName: fieldName,
        fieldType: azureField.type || 'string',
        azureDescription: azureField.description,
        isRequired: azureField.required || false,
        configured: !!dbConfig,
        ...(dbConfig && {
          id: dbConfig.id,
          customFieldName: dbConfig.customFieldName,
          isEnabled: dbConfig.isEnabled,
          defaultValue: dbConfig.defaultValue,
          defaultValueType: dbConfig.defaultValueType,
          fieldOrder: dbConfig.fieldOrder,
        }),
      };
    });
    
    // Add any database-only fields (shouldn't happen, but just in case)
    const azureFieldNames = new Set(Object.keys(azureFields));
    const dbOnlyFields = modelConfig.fieldConfigs
      .filter(fc => !azureFieldNames.has(fc.azureFieldName))
      .map(fc => ({
        azureFieldName: fc.azureFieldName,
        fieldType: fc.fieldType || 'string',
        azureDescription: null,
        isRequired: fc.isRequired || false,
        configured: true,
        id: fc.id,
        customFieldName: fc.customFieldName,
        isEnabled: fc.isEnabled,
        defaultValue: fc.defaultValue,
        defaultValueType: fc.defaultValueType,
        fieldOrder: fc.fieldOrder,
      }));
    
    fields.push(...dbOnlyFields);
    
    res.json({
      modelConfigId: modelConfig.id,
      azureModelId: modelConfig.azureModelId,
      displayName: modelConfig.customName,
      fields: fields.sort((a, b) => {
        const orderA = a.fieldOrder ?? 999;
        const orderB = b.fieldOrder ?? 999;
        return orderA - orderB;
      }),
      fieldCount: fields.length,
      configuredCount: fields.filter(f => f.configured).length,
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
    
    const modelConfig = await prisma.modelConfiguration.findUnique({
      where: { id: configId },
    });
    
    if (!modelConfig) {
      return res.status(404).json({ error: 'Model configuration not found' });
    }
    
    // Update fields in a transaction
    const results = await prisma.$transaction(async (tx) => {
      const updateResults = [];
      
      for (const fieldConfig of fields) {
        const result = await tx.fieldConfiguration.upsert({
          where: {
            modelConfigId_azureFieldName: {
              modelConfigId: modelConfig.id,
              azureFieldName: fieldConfig.azureFieldName,
            },
          },
          update: {
            customFieldName: fieldConfig.customFieldName,
            fieldType: fieldConfig.fieldType,
            isEnabled: fieldConfig.isEnabled,
            isRequired: fieldConfig.isRequired,
            defaultValue: fieldConfig.defaultValue,
            defaultValueType: fieldConfig.defaultValueType,
            fieldOrder: fieldConfig.fieldOrder,
          },
          create: {
            modelConfigId: modelConfig.id,
            azureFieldName: fieldConfig.azureFieldName,
            customFieldName: fieldConfig.customFieldName,
            fieldType: fieldConfig.fieldType,
            isEnabled: fieldConfig.isEnabled,
            isRequired: fieldConfig.isRequired,
            defaultValue: fieldConfig.defaultValue,
            defaultValueType: fieldConfig.defaultValueType,
            fieldOrder: fieldConfig.fieldOrder,
          },
        });
        updateResults.push(result);
      }
      
      return updateResults;
    });
    
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
      fieldsUpdated: results.length,
      message: `Updated ${results.length} field configurations`,
    });
  } catch (error) {
    console.error('Error updating field configurations:', error);
    res.status(500).json({ 
      error: 'Failed to update field configurations',
      details: error.message 
    });
  }
});

// Get model stats
router.get('/:configId/stats', authenticateAdmin, async (req, res) => {
  try {
    const { configId } = req.params;
    
    const config = await prisma.modelConfiguration.findUnique({
      where: { id: configId },
      include: {
        _count: {
          select: {
            fieldConfigs: true,
            modelAccess: true,
          },
        },
      },
    });
    
    if (!config) {
      return res.status(404).json({ error: 'Model configuration not found' });
    }
    
    // Get job count for this model
    const jobCount = await prisma.job.count({
      where: { modelId: config.azureModelId },
    });
    
    // Get usage by date for the last 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const jobs = await prisma.job.findMany({
      where: {
        modelId: config.azureModelId,
        createdAt: { gte: thirtyDaysAgo },
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
    const currentDate = new Date();
    for (let i = 29; i >= 0; i--) {
      const date = new Date(currentDate);
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      usage.push(usageByDate[dateStr] || {
        date: dateStr,
        count: 0,
        credits: 0,
        successful: 0,
        failed: 0,
      });
    }
    
    res.json({
      configId: config.id,
      azureModelId: config.azureModelId,
      displayName: config.customName,
      stats: {
        totalJobs: jobCount,
        activeUsers: config._count.modelAccess,
        configuredFields: config._count.fieldConfigs,
        isPublic: config.isPublic,
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

// Manage model access
router.get('/:configId/access', authenticateAdmin, async (req, res) => {
  try {
    const { configId } = req.params;
    
    const access = await prisma.modelAccess.findMany({
      where: { modelConfigId: configId },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
        organization: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: { grantedAt: 'desc' },
    });
    
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

// Grant model access
router.post('/:configId/access', authenticateAdmin, async (req, res) => {
  try {
    const { configId } = req.params;
    const { userId, organizationId, canUse = true, canEdit = false, expiresAt } = req.body;
    
    if (!userId && !organizationId) {
      return res.status(400).json({ 
        error: 'Either userId or organizationId must be provided' 
      });
    }
    
    const config = await prisma.modelConfiguration.findUnique({
      where: { id: configId },
    });
    
    if (!config) {
      return res.status(404).json({ error: 'Model configuration not found' });
    }
    
    const access = await prisma.modelAccess.create({
      data: {
        modelConfigId: configId,
        userId: userId || null,
        organizationId: organizationId || null,
        canRead: true,
        canUse,
        canEdit,
        grantedBy: req.admin.id,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
        organization: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });
    
    // Log the action
    await prisma.auditLog.create({
      data: {
        userId: req.admin.id,
        eventType: 'MODEL_ACCESS_GRANTED',
        eventData: {
          configId,
          accessId: access.id,
          userId,
          organizationId,
        },
      },
    });
    
    res.status(201).json({
      success: true,
      access,
    });
  } catch (error) {
    console.error('Error granting model access:', error);
    res.status(500).json({ 
      error: 'Failed to grant model access',
      details: error.message 
    });
  }
});

// Revoke model access
router.delete('/:configId/access/:accessId', authenticateAdmin, async (req, res) => {
  try {
    const { configId, accessId } = req.params;
    
    const access = await prisma.modelAccess.findFirst({
      where: {
        id: accessId,
        modelConfigId: configId,
      },
    });
    
    if (!access) {
      return res.status(404).json({ error: 'Access not found' });
    }
    
    await prisma.modelAccess.delete({
      where: { id: accessId },
    });
    
    // Log the action
    await prisma.auditLog.create({
      data: {
        userId: req.admin.id,
        eventType: 'MODEL_ACCESS_REVOKED',
        eventData: {
          configId,
          accessId,
          userId: access.userId,
          organizationId: access.organizationId,
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

export default router;