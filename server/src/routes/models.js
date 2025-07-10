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

// Get raw model info directly from Azure API (for debugging)
router.get('/:modelId/raw', async (req, res) => {
  try {
    const { modelId } = req.params;
    
    console.log('Fetching RAW model info for:', modelId);
    
    // Call Azure API directly
    const apiUrl = `${endpoint}/formrecognizer/documentModels/${modelId}?api-version=2023-07-31`;
    
    const response = await fetch(apiUrl, {
      headers: {
        'Ocp-Apim-Subscription-Key': apiKey
      }
    });
    
    if (!response.ok) {
      throw new Error(`Azure API error: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    res.json(data);
    
  } catch (error) {
    console.error('Error getting raw model info:', error);
    res.status(500).json({ 
      error: 'Failed to get raw model information',
      details: error.message
    });
  }
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
      // For composed models, merge fields from all document types
      const docTypeNames = Object.keys(model.docTypes);
      console.log('Document types found:', docTypeNames);
      
      // Iterate through all document types and merge their fields
      docTypeNames.forEach(docTypeName => {
        if (model.docTypes[docTypeName].fieldSchema) {
          Object.entries(model.docTypes[docTypeName].fieldSchema).forEach(([fieldName, fieldInfo]) => {
            // If field doesn't exist yet, or if this docType has more info about it, update it
            if (!fields[fieldName]) {
              fields[fieldName] = {
                type: fieldInfo.type || 'string',
                description: fieldInfo.description || fieldName.replace(/_/g, ' '),
                required: fieldInfo.required || false,
                availableIn: [docTypeName] // Track which doc types have this field
              };
            } else {
              // Field exists, just add this docType to the list
              fields[fieldName].availableIn.push(docTypeName);
            }
          });
        }
      });
      
      // console.log('Total unique fields found:', Object.keys(fields).length);
      // console.log('Fields:', Object.keys(fields).sort());
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