import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import modelManager from '../services/model-manager.js';
import { processDocumentFromUrl } from '../services/azure-document-ai.js';
import * as dotenv from 'dotenv';

dotenv.config();

const router = express.Router();

// Get list of models available to current user
router.get('/', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const organizationId = req.user.organizationId;
    
    const models = await modelManager.getUserAvailableModels(userId, organizationId);
    
    // Transform models for client
    const clientModels = models.map(model => ({
      id: model.modelId,
      displayName: model.displayName,
      description: model.description,
      isPublic: model.isPublic,
      isActive: model.isActive,
      fieldCount: model.fieldConfigurations?.length || 0,
      owner: model.owner ? {
        name: model.owner.name,
        email: model.owner.email
      } : null,
      organization: model.organization ? {
        name: model.organization.name
      } : null
    }));
    
    res.json({
      models: clientModels,
      count: clientModels.length
    });
  } catch (error) {
    console.error('Error fetching user models:', error);
    res.status(500).json({ 
      error: 'Failed to fetch available models',
      details: error.message 
    });
  }
});

// Get model with field configurations
router.get('/:modelId/config', authenticateToken, async (req, res) => {
  try {
    const { modelId } = req.params;
    const userId = req.user.id;
    
    const model = await modelManager.getModelWithFieldConfigs(modelId, userId);
    
    // Transform for client
    const clientModel = {
      id: model.modelId,
      displayName: model.displayName,
      description: model.description,
      isPublic: model.isPublic,
      fields: model.fieldConfigurations.map(field => ({
        name: field.fieldName,
        displayName: field.customDisplayName || field.fieldName,
        type: field.azureType || 'string',
        isEnabled: field.isEnabled,
        isRequired: field.isRequired,
        hasDefault: !!field.defaultValue,
        defaultType: field.defaultValueType,
        displayOrder: field.displayOrder
      })),
      azureDetails: {
        createdOn: model.azureDetails?.createdDateTime,
        docTypes: Object.keys(model.azureDetails?.docTypes || {})
      }
    };
    
    res.json(clientModel);
  } catch (error) {
    console.error('Error fetching model config:', error);
    
    if (error.message === 'Model not found') {
      return res.status(404).json({ error: 'Model not found' });
    }
    
    if (error.message === 'Access denied to this model') {
      return res.status(403).json({ error: 'Access denied to this model' });
    }
    
    res.status(500).json({ 
      error: 'Failed to fetch model configuration',
      details: error.message 
    });
  }
});

// Process document with model (applies field filtering and defaults)
router.post('/:modelId/extract', authenticateToken, async (req, res) => {
  try {
    const { modelId } = req.params;
    const { documentUrl, rawExtractedData } = req.body;
    const userId = req.user.id;
    
    if (!documentUrl && !rawExtractedData) {
      return res.status(400).json({ 
        error: 'Either documentUrl or rawExtractedData is required' 
      });
    }
    
    let extractedData = rawExtractedData;
    
    // If documentUrl is provided, perform extraction
    if (documentUrl) {
      const result = await processDocumentFromUrl(documentUrl, 'document.pdf', modelId);
      extractedData = result.fields;
    }
    
    // Process extracted data with field configurations
    const processedResult = await modelManager.processExtractedData(
      modelId, 
      extractedData, 
      userId
    );
    
    res.json({
      success: true,
      modelId: processedResult.modelId,
      modelName: processedResult.modelName,
      data: processedResult.processedData,
      fieldConfigurations: processedResult.fieldConfigurations.map(field => ({
        name: field.fieldName,
        displayName: field.customDisplayName || field.fieldName,
        type: field.azureType || 'string',
        hadDefault: !extractedData[field.fieldName] && !!processedResult.processedData[field.customDisplayName || field.fieldName]
      })),
      timestamp: processedResult.timestamp
    });
  } catch (error) {
    console.error('Error processing document:', error);
    
    if (error.message === 'Model not found') {
      return res.status(404).json({ error: 'Model not found' });
    }
    
    if (error.message === 'Access denied to this model') {
      return res.status(403).json({ error: 'Access denied to this model' });
    }
    
    res.status(500).json({ 
      error: 'Failed to process document',
      details: error.message 
    });
  }
});

export default router;