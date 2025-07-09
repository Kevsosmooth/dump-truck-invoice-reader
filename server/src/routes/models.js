import express from 'express';
import { DocumentModelAdministrationClient, AzureKeyCredential } from '@azure/ai-form-recognizer';
import * as dotenv from 'dotenv';

dotenv.config();

const router = express.Router();

const endpoint = process.env.AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT;
const apiKey = process.env.AZURE_DOCUMENT_INTELLIGENCE_KEY;

if (!endpoint || !apiKey) {
  console.error('Azure Document Intelligence credentials not configured');
}

// Initialize the Document Model Administration client for model management
const adminClient = endpoint && apiKey ? new DocumentModelAdministrationClient(endpoint, new AzureKeyCredential(apiKey)) : null;

// Store last extracted fields in memory (in production, use database)
let lastExtractedFields = {};

// Update last extracted fields (call this from document processing)
router.post('/:modelId/fields', async (req, res) => {
  const { modelId } = req.params;
  const { fields } = req.body;
  
  if (fields) {
    lastExtractedFields[modelId] = Object.keys(fields).map(fieldName => ({
      name: fieldName,
      type: typeof fields[fieldName]?.value === 'number' ? 'number' : 
            fields[fieldName]?.value instanceof Date ? 'date' : 'string',
      description: fieldName.replace(/_/g, ' ')
    }));
  }
  
  res.json({ success: true });
});

// Get model information
router.get('/:modelId/info', async (req, res) => {
  try {
    const { modelId } = req.params;
    
    if (!adminClient) {
      return res.status(500).json({ error: 'Azure Document Intelligence not configured' });
    }

    console.log('Fetching model info for:', modelId);
    
    // Use the SDK's getDocumentModel method from admin client
    const model = await adminClient.getDocumentModel(modelId);
    
    console.log('Model info retrieved:', model.modelId);
    console.log('Model details:', {
      modelId: model.modelId,
      createdOn: model.createdOn,
      description: model.description
    });
    
    // Extract field schema from the model
    const fields = {};
    
    if (model.docTypes) {
      // Get the first document type (usually there's only one for custom models)
      const docTypeName = Object.keys(model.docTypes)[0];
      console.log('Document type:', docTypeName);
      
      if (docTypeName && model.docTypes[docTypeName].fieldSchema) {
        Object.entries(model.docTypes[docTypeName].fieldSchema).forEach(([fieldName, fieldInfo]) => {
          fields[fieldName] = {
            type: fieldInfo.type || 'string',
            description: fieldInfo.description || fieldName.replace(/_/g, ' '),
            required: fieldInfo.required || false
          };
        });
        console.log('Fields found:', Object.keys(fields));
      }
    }

    res.json({
      modelId: model.modelId,
      description: model.description || 'Custom trained model',
      createdDateTime: model.createdOn,
      fields: fields,
      // The SDK handles API versioning internally
      apiVersion: 'Handled by SDK'
    });

  } catch (error) {
    console.error('Error getting model info:', error);
    
    // Check for specific error types
    const errorCode = error.code || error.errorCode;
    const statusCode = error.statusCode;
    
    if (errorCode === 'ModelNotFound' || statusCode === 404) {
      return res.status(404).json({ 
        error: 'Model not found',
        modelId: req.params.modelId 
      });
    }
    
    // For other errors, return a generic error
    res.status(500).json({ 
      error: 'Failed to get model information',
      details: error.message
    });
  }
});

export default router;