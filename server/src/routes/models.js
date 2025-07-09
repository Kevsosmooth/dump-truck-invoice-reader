import express from 'express';
import axios from 'axios';
import * as dotenv from 'dotenv';

dotenv.config();

const router = express.Router();

const endpoint = process.env.AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT;
const apiKey = process.env.AZURE_DOCUMENT_INTELLIGENCE_KEY;

if (!endpoint || !apiKey) {
  console.error('Azure Document Intelligence credentials not configured');
}

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
    
    if (!endpoint || !apiKey) {
      return res.status(500).json({ error: 'Azure Document Intelligence not configured' });
    }

    // Clean the endpoint URL
    const baseUrl = endpoint.replace(/\/$/, ''); // Remove trailing slash
    
    // Use the Azure Form Recognizer REST API directly
    const apiUrl = `${baseUrl}/formrecognizer/documentModels/${modelId}?api-version=2023-07-31`;
    
    console.log('Fetching model info from:', apiUrl);
    
    const response = await axios.get(apiUrl, {
      headers: {
        'Ocp-Apim-Subscription-Key': apiKey
      }
    });

    const model = response.data;
    console.log('Model info retrieved:', model.modelId);
    
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
      createdDateTime: model.createdDateTime,
      fields: fields,
      apiVersion: model.apiVersion || '2023-07-31'
    });

  } catch (error) {
    console.error('Error getting model info:', error.response?.data || error.message);
    
    // If it's a 404, the model doesn't exist
    if (error.response?.status === 404) {
      return res.status(404).json({ 
        error: 'Model not found',
        modelId: req.params.modelId 
      });
    }
    
    // For other errors, return a generic error
    res.status(500).json({ 
      error: 'Failed to get model information',
      details: error.response?.data?.error?.message || error.message
    });
  }
});

export default router;