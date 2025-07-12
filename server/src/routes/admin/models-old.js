import express from 'express';
import { authenticateAdmin } from '../../middleware/admin-auth.js';
import modelManager from '../../services/model-manager.js';
import prisma from '../../config/prisma.js';
import { z } from 'zod';

const router = express.Router();

// Validation schemas
const configureModelSchema = z.object({
  modelId: z.string().min(1),
  displayName: z.string().min(1),
  description: z.string().optional(),
  isPublic: z.boolean().default(false),
  organizationId: z.string().optional(),
});

const updateModelSchema = z.object({
  displayName: z.string().min(1).optional(),
  description: z.string().optional(),
  isActive: z.boolean().optional(),
  isPublic: z.boolean().optional(),
  organizationId: z.string().nullable().optional(),
});

const fieldConfigurationSchema = z.object({
  fields: z.array(z.object({
    fieldName: z.string().min(1),
    customDisplayName: z.string().optional(),
    isEnabled: z.boolean().default(true),
    isRequired: z.boolean().default(false),
    defaultValue: z.string().nullable().optional(),
    defaultValueType: z.enum(['STATIC', 'CURRENT_DATE', 'CURRENT_DATETIME', 'FUNCTION']).default('STATIC'),
    displayOrder: z.number().int().min(0).default(999),
    validationRules: z.record(z.any()).optional(),
  })),
});

const modelAccessSchema = z.object({
  userIds: z.array(z.string()).optional(),
  organizationId: z.string().nullable().optional(),
  isPublic: z.boolean().optional(),
});

// List all Azure models
router.get('/', authenticateAdmin, async (req, res) => {
  try {
    const azureModels = await modelManager.listAzureModels();
    
    res.json({
      models: azureModels,
      count: azureModels.length,
    });
  } catch (error) {
    console.error('Error listing Azure models:', error);
    res.status(500).json({ 
      error: 'Failed to list Azure models',
      details: error.message 
    });
  }
});

// List configured models (from database)
router.get('/configured', authenticateAdmin, async (req, res) => {
  try {
    const { includeInactive = false } = req.query;
    
    const where = includeInactive ? {} : { isActive: true };
    
    const models = await prisma.customModel.findMany({
      where,
      include: {
        owner: {
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
        fieldConfigurations: {
          select: {
            id: true,
          },
        },
        _count: {
          select: {
            jobs: true,
          },
        },
      },
      orderBy: [
        { isPublic: 'desc' },
        { createdAt: 'desc' },
      ],
    });
    
    const configuredModels = models.map(model => ({
      id: model.id,
      modelId: model.modelId,
      displayName: model.displayName,
      description: model.description,
      isActive: model.isActive,
      isPublic: model.isPublic,
      owner: model.owner,
      organization: model.organization,
      fieldConfigCount: model.fieldConfigurations.length,
      jobCount: model._count.jobs,
      createdAt: model.createdAt,
      updatedAt: model.updatedAt,
    }));
    
    res.json({
      models: configuredModels,
      count: configuredModels.length,
    });
  } catch (error) {
    console.error('Error listing configured models:', error);
    res.status(500).json({ 
      error: 'Failed to list configured models',
      details: error.message 
    });
  }
});

// Sync models with Azure
router.post('/sync', authenticateAdmin, async (req, res) => {
  try {
    const syncResults = await modelManager.syncModelsWithDatabase();
    
    res.json({
      success: true,
      results: syncResults,
      message: `Synced ${syncResults.created} new models, updated ${syncResults.updated} existing models`,
    });
  } catch (error) {
    console.error('Error syncing models:', error);
    res.status(500).json({ 
      error: 'Failed to sync models with Azure',
      details: error.message 
    });
  }
});

// Configure a new model
router.post('/configure', authenticateAdmin, async (req, res) => {
  try {
    const validatedData = configureModelSchema.parse(req.body);
    
    // Check if model already exists
    const existingModel = await prisma.customModel.findUnique({
      where: { modelId: validatedData.modelId },
    });
    
    if (existingModel) {
      return res.status(409).json({ 
        error: 'Model already configured',
        modelId: validatedData.modelId 
      });
    }
    
    // Get model details from Azure
    const azureDetails = await modelManager.getAzureModelDetails(validatedData.modelId);
    
    // Create model configuration
    const model = await prisma.customModel.create({
      data: {
        ...validatedData,
        ownerId: req.admin.id,
        azureDetails,
        isActive: true,
      },
      include: {
        owner: {
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
        action: 'MODEL_CONFIGURED',
        entityType: 'CustomModel',
        entityId: model.id,
        userId: req.admin.id,
        details: {
          modelId: model.modelId,
          displayName: model.displayName,
        },
      },
    });
    
    res.status(201).json({
      success: true,
      model: {
        id: model.id,
        modelId: model.modelId,
        displayName: model.displayName,
        description: model.description,
        isActive: model.isActive,
        isPublic: model.isPublic,
        owner: model.owner,
        organization: model.organization,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ 
        error: 'Validation error',
        details: error.errors 
      });
    }
    
    console.error('Error configuring model:', error);
    res.status(500).json({ 
      error: 'Failed to configure model',
      details: error.message 
    });
  }
});

// Update model configuration
router.put('/:modelId', authenticateAdmin, async (req, res) => {
  try {
    const { modelId } = req.params;
    const validatedData = updateModelSchema.parse(req.body);
    
    const model = await prisma.customModel.findUnique({
      where: { modelId },
    });
    
    if (!model) {
      return res.status(404).json({ error: 'Model not found' });
    }
    
    const updatedModel = await prisma.customModel.update({
      where: { id: model.id },
      data: validatedData,
      include: {
        owner: {
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
        _count: {
          select: {
            fieldConfigurations: true,
            jobs: true,
          },
        },
      },
    });
    
    // Log the action
    await prisma.auditLog.create({
      data: {
        action: 'MODEL_UPDATED',
        entityType: 'CustomModel',
        entityId: model.id,
        userId: req.admin.id,
        details: validatedData,
      },
    });
    
    res.json({
      success: true,
      model: {
        id: updatedModel.id,
        modelId: updatedModel.modelId,
        displayName: updatedModel.displayName,
        description: updatedModel.description,
        isActive: updatedModel.isActive,
        isPublic: updatedModel.isPublic,
        owner: updatedModel.owner,
        organization: updatedModel.organization,
        fieldConfigCount: updatedModel._count.fieldConfigurations,
        jobCount: updatedModel._count.jobs,
        updatedAt: updatedModel.updatedAt,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ 
        error: 'Validation error',
        details: error.errors 
      });
    }
    
    console.error('Error updating model:', error);
    res.status(500).json({ 
      error: 'Failed to update model',
      details: error.message 
    });
  }
});

// Delete model configuration
router.delete('/:modelId', authenticateAdmin, async (req, res) => {
  try {
    const { modelId } = req.params;
    
    const model = await prisma.customModel.findUnique({
      where: { modelId },
      include: {
        _count: {
          select: {
            jobs: true,
          },
        },
      },
    });
    
    if (!model) {
      return res.status(404).json({ error: 'Model not found' });
    }
    
    // Check if model has been used
    if (model._count.jobs > 0) {
      return res.status(400).json({ 
        error: 'Cannot delete model with processing history',
        jobCount: model._count.jobs,
        hint: 'Deactivate the model instead of deleting it',
      });
    }
    
    // Delete model (cascades to field configurations)
    await prisma.customModel.delete({
      where: { id: model.id },
    });
    
    // Log the action
    await prisma.auditLog.create({
      data: {
        action: 'MODEL_DELETED',
        entityType: 'CustomModel',
        entityId: model.id,
        userId: req.admin.id,
        details: {
          modelId: model.modelId,
          displayName: model.displayName,
        },
      },
    });
    
    res.json({
      success: true,
      message: 'Model configuration deleted',
    });
  } catch (error) {
    console.error('Error deleting model:', error);
    res.status(500).json({ 
      error: 'Failed to delete model',
      details: error.message 
    });
  }
});

// Get field configurations for a model
router.get('/:modelId/fields', authenticateAdmin, async (req, res) => {
  try {
    const { modelId } = req.params;
    
    const model = await prisma.customModel.findUnique({
      where: { modelId },
      include: {
        fieldConfigurations: {
          orderBy: [
            { displayOrder: 'asc' },
            { fieldName: 'asc' },
          ],
        },
      },
    });
    
    if (!model) {
      return res.status(404).json({ error: 'Model not found' });
    }
    
    // Get Azure model details
    const azureDetails = await modelManager.getAzureModelDetails(modelId);
    const azureFields = azureDetails?.docTypes?.[modelId]?.fieldSchema || {};
    
    // Combine database configs with Azure field info
    const fields = Object.entries(azureFields).map(([fieldName, azureField]) => {
      const dbConfig = model.fieldConfigurations.find(fc => fc.fieldName === fieldName);
      
      return {
        fieldName,
        azureType: azureField.type || 'string',
        azureDescription: azureField.description,
        azureRequired: azureField.required || false,
        configured: !!dbConfig,
        ...(dbConfig && {
          id: dbConfig.id,
          customDisplayName: dbConfig.customDisplayName,
          isEnabled: dbConfig.isEnabled,
          isRequired: dbConfig.isRequired,
          defaultValue: dbConfig.defaultValue,
          defaultValueType: dbConfig.defaultValueType,
          displayOrder: dbConfig.displayOrder,
          validationRules: dbConfig.validationRules,
        }),
      };
    });
    
    // Add any database-only fields (shouldn't happen, but just in case)
    const azureFieldNames = new Set(Object.keys(azureFields));
    const dbOnlyFields = model.fieldConfigurations
      .filter(fc => !azureFieldNames.has(fc.fieldName))
      .map(fc => ({
        fieldName: fc.fieldName,
        azureType: 'string',
        azureDescription: null,
        azureRequired: false,
        configured: true,
        id: fc.id,
        customDisplayName: fc.customDisplayName,
        isEnabled: fc.isEnabled,
        isRequired: fc.isRequired,
        defaultValue: fc.defaultValue,
        defaultValueType: fc.defaultValueType,
        displayOrder: fc.displayOrder,
        validationRules: fc.validationRules,
      }));
    
    fields.push(...dbOnlyFields);
    
    res.json({
      modelId: model.modelId,
      displayName: model.displayName,
      fields: fields.sort((a, b) => (a.displayOrder || 999) - (b.displayOrder || 999)),
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
router.put('/:modelId/fields', authenticateAdmin, async (req, res) => {
  try {
    const { modelId } = req.params;
    const validatedData = fieldConfigurationSchema.parse(req.body);
    
    const model = await prisma.customModel.findUnique({
      where: { modelId },
    });
    
    if (!model) {
      return res.status(404).json({ error: 'Model not found' });
    }
    
    // Update fields in a transaction
    const results = await prisma.$transaction(async (tx) => {
      const updateResults = [];
      
      for (const fieldConfig of validatedData.fields) {
        const result = await tx.fieldConfiguration.upsert({
          where: {
            customModelId_fieldName: {
              customModelId: model.id,
              fieldName: fieldConfig.fieldName,
            },
          },
          update: {
            customDisplayName: fieldConfig.customDisplayName,
            isEnabled: fieldConfig.isEnabled,
            isRequired: fieldConfig.isRequired,
            defaultValue: fieldConfig.defaultValue,
            defaultValueType: fieldConfig.defaultValueType,
            displayOrder: fieldConfig.displayOrder,
            validationRules: fieldConfig.validationRules || {},
          },
          create: {
            customModelId: model.id,
            fieldName: fieldConfig.fieldName,
            customDisplayName: fieldConfig.customDisplayName,
            isEnabled: fieldConfig.isEnabled,
            isRequired: fieldConfig.isRequired,
            defaultValue: fieldConfig.defaultValue,
            defaultValueType: fieldConfig.defaultValueType,
            displayOrder: fieldConfig.displayOrder,
            validationRules: fieldConfig.validationRules || {},
          },
        });
        updateResults.push(result);
      }
      
      return updateResults;
    });
    
    // Log the action
    await prisma.auditLog.create({
      data: {
        action: 'FIELDS_UPDATED',
        entityType: 'CustomModel',
        entityId: model.id,
        userId: req.admin.id,
        details: {
          modelId: model.modelId,
          fieldsUpdated: validatedData.fields.length,
        },
      },
    });
    
    res.json({
      success: true,
      fieldsUpdated: results.length,
      message: `Updated ${results.length} field configurations`,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ 
        error: 'Validation error',
        details: error.errors 
      });
    }
    
    console.error('Error updating field configurations:', error);
    res.status(500).json({ 
      error: 'Failed to update field configurations',
      details: error.message 
    });
  }
});

// Manage model access
router.post('/:modelId/access', authenticateAdmin, async (req, res) => {
  try {
    const { modelId } = req.params;
    const validatedData = modelAccessSchema.parse(req.body);
    
    const model = await prisma.customModel.findUnique({
      where: { modelId },
    });
    
    if (!model) {
      return res.status(404).json({ error: 'Model not found' });
    }
    
    const updateData = {};
    
    if (validatedData.isPublic !== undefined) {
      updateData.isPublic = validatedData.isPublic;
    }
    
    if (validatedData.organizationId !== undefined) {
      updateData.organizationId = validatedData.organizationId;
    }
    
    const updatedModel = await prisma.customModel.update({
      where: { id: model.id },
      data: updateData,
      include: {
        owner: {
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
        action: 'MODEL_ACCESS_UPDATED',
        entityType: 'CustomModel',
        entityId: model.id,
        userId: req.admin.id,
        details: validatedData,
      },
    });
    
    res.json({
      success: true,
      model: {
        id: updatedModel.id,
        modelId: updatedModel.modelId,
        displayName: updatedModel.displayName,
        isPublic: updatedModel.isPublic,
        owner: updatedModel.owner,
        organization: updatedModel.organization,
      },
      message: 'Model access updated',
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ 
        error: 'Validation error',
        details: error.errors 
      });
    }
    
    console.error('Error updating model access:', error);
    res.status(500).json({ 
      error: 'Failed to update model access',
      details: error.message 
    });
  }
});

// Get model usage statistics
router.get('/:modelId/stats', authenticateAdmin, async (req, res) => {
  try {
    const { modelId } = req.params;
    const { startDate, endDate } = req.query;
    
    const stats = await modelManager.getModelUsageStats(modelId, startDate, endDate);
    
    res.json(stats);
  } catch (error) {
    console.error('Error getting model stats:', error);
    
    if (error.message === 'Model not found') {
      return res.status(404).json({ error: 'Model not found' });
    }
    
    res.status(500).json({ 
      error: 'Failed to get model statistics',
      details: error.message 
    });
  }
});

export default router;