import express from 'express';
import { authenticateAdmin } from '../../middleware/admin-auth.js';
import modelManager from '../../services/model-manager.js';
import prisma from '../../config/prisma.js';

const router = express.Router();

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
          entityType: 'ModelConfiguration',
          entityId: modelConfig.id,
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

export default router;