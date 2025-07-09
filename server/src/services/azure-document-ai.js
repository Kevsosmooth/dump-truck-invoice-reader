import { DocumentAnalysisClient, AzureKeyCredential } from '@azure/ai-form-recognizer';
import * as dotenv from 'dotenv';

dotenv.config();

// Initialize the client
const endpoint = process.env.AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT;
const apiKey = process.env.AZURE_DOCUMENT_INTELLIGENCE_KEY;
const customModelId = process.env.AZURE_CUSTOM_MODEL_ID || 'Silvi_Reader_Full_2.0';

if (!endpoint || !apiKey) {
  throw new Error('Azure Document Intelligence credentials not configured');
}

const client = new DocumentAnalysisClient(endpoint, new AzureKeyCredential(apiKey));

export async function processDocument(filePath, modelId) {
  try {
    console.log(`Processing document with model: ${modelId || customModelId}`);
    
    // For now, we'll need to modify this to accept a buffer instead of file path
    // since we'll be uploading files via the API
    const fs = require('fs');
    const fileStream = fs.createReadStream(filePath);
    
    // Use the custom model or fallback to prebuilt invoice
    const model = modelId || customModelId;
    
    // Analyze the document
    const poller = await client.beginAnalyzeDocument(model, fileStream);
    const result = await poller.pollUntilDone();
    
    if (!result || !result.documents || result.documents.length === 0) {
      throw new Error('No documents found in the result');
    }
    
    const document = result.documents[0];
    const fields = document.fields || {};
    
    // Extract relevant fields based on your custom model
    // You'll need to adjust these field names based on what your Silvi_Reader_Full_2.0 model returns
    const extractedData = {
      status: 'succeeded',
      confidence: document.confidence || 0,
      fields: {
        // Common invoice fields - adjust based on your model's output
        InvoiceId: fields.InvoiceId || fields.InvoiceNumber || { value: null },
        VendorName: fields.VendorName || fields.Vendor || { value: null },
        CustomerName: fields.CustomerName || fields.Customer || { value: null },
        InvoiceDate: fields.InvoiceDate || fields.Date || { value: null },
        DueDate: fields.DueDate || { value: null },
        InvoiceTotal: fields.InvoiceTotal || fields.Total || fields.Amount || { value: null },
        SubTotal: fields.SubTotal || { value: null },
        TaxAmount: fields.TotalTax || fields.Tax || { value: null },
        Items: fields.Items || { value: [] },
        
        // Add any custom fields your Silvi model extracts
        // For example, if it's for dump truck tickets:
        TruckNumber: fields.TruckNumber || { value: null },
        LoadWeight: fields.LoadWeight || { value: null },
        Material: fields.Material || { value: null },
        JobSite: fields.JobSite || { value: null },
        
        // Store all fields for debugging
        _allFields: fields
      },
      pages: result.pages || [],
      tables: result.tables || [],
    };
    
    console.log('Document processed successfully:', {
      confidence: extractedData.confidence,
      fieldsExtracted: Object.keys(fields).length
    });
    
    return extractedData;
    
  } catch (error) {
    console.error('Error processing document:', error);
    throw error;
  }
}

// Function to process a buffer instead of file path (for API uploads) - SYNCHRONOUS VERSION
export async function processDocumentBuffer(buffer, fileName, modelId) {
  try {
    console.log(`Processing buffer for ${fileName} with model: ${modelId || customModelId}`);
    
    const model = modelId || customModelId;
    
    // Analyze the document from buffer
    const poller = await client.beginAnalyzeDocument(model, buffer);
    const result = await poller.pollUntilDone();
    
    if (!result || !result.documents || result.documents.length === 0) {
      throw new Error('No documents found in the result');
    }
    
    const document = result.documents[0];
    const fields = document.fields || {};
    
    // Log the actual field names for debugging
    console.log(`Fields extracted by ${model}:`, Object.keys(fields));
    console.log('Field details:', Object.entries(fields).map(([key, value]) => ({
      fieldName: key,
      value: value?.value,
      confidence: value?.confidence
    })));
    
    return {
      status: 'succeeded',
      confidence: document.confidence || 0,
      fields: fields,
      pages: result.pages || [],
      tables: result.tables || [],
      // Include model info
      modelUsed: model,
      fileName: fileName
    };
    
  } catch (error) {
    console.error('Error processing document buffer:', error);
    
    // Check if it's a model not found error
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorCode = error?.code;
    
    if (errorMessage.includes('model') || errorCode === 'ModelNotFound') {
      console.log('Custom model not found, falling back to prebuilt-invoice model');
      
      // Retry with prebuilt invoice model
      try {
        const poller = await client.beginAnalyzeDocument('prebuilt-invoice', buffer);
        const result = await poller.pollUntilDone();
        
        return {
          status: 'succeeded',
          confidence: result.documents?.[0]?.confidence || 0,
          fields: result.documents?.[0]?.fields || {},
          pages: result.pages || [],
          tables: result.tables || [],
          modelUsed: 'prebuilt-invoice',
          fileName: fileName,
          fallbackUsed: true
        };
      } catch (fallbackError) {
        throw fallbackError;
      }
    }
    
    throw error;
  }
}

// NEW: Async function to start document processing without blocking
export async function startDocumentAnalysis(buffer, fileName, modelId) {
  try {
    console.log(`Starting async analysis for ${fileName} with model: ${modelId || customModelId}`);
    
    const model = modelId || customModelId;
    
    // Start the document analysis
    const poller = await client.beginAnalyzeDocument(model, buffer);
    
    // Get operation details
    const operationState = poller.getOperationState();
    const operationLocation = operationState.operationLocation;
    
    // Extract operation ID from the location URL
    // Format: https://{endpoint}/formrecognizer/documentModels/{modelId}/analyzeResults/{resultId}
    const operationId = operationLocation?.split('/').pop();
    
    console.log(`Started operation ${operationId} for ${fileName}`);
    
    return {
      operationId,
      operationLocation,
      modelId: model,
      fileName,
      poller // We'll store this for later polling
    };
  } catch (error) {
    console.error('Error starting document analysis:', error);
    
    // Check if it's a model not found error
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorCode = error?.code;
    
    if (errorMessage.includes('model') || errorCode === 'ModelNotFound') {
      console.log('Custom model not found, falling back to prebuilt-invoice model');
      
      // Retry with prebuilt invoice model
      try {
        const poller = await client.beginAnalyzeDocument('prebuilt-invoice', buffer);
        const operationState = poller.getOperationState();
        const operationLocation = operationState.operationLocation;
        const operationId = operationLocation?.split('/').pop();
        
        return {
          operationId,
          operationLocation,
          modelId: 'prebuilt-invoice',
          fileName,
          fallbackUsed: true,
          poller
        };
      } catch (fallbackError) {
        throw fallbackError;
      }
    }
    
    throw error;
  }
}

// NEW: Check the status of an ongoing operation
export async function checkAnalysisStatus(operationId) {
  try {
    // Note: The Azure SDK doesn't provide a direct way to recreate a poller from operation ID
    // In a real implementation, we'd need to store the poller object or use the REST API directly
    // For now, this is a placeholder that shows the concept
    
    // In production, you'd use the REST API directly:
    // GET {endpoint}/formrecognizer/documentModels/{modelId}/analyzeResults/{resultId}
    
    return {
      status: 'running',
      percentCompleted: 0,
      error: null
    };
  } catch (error) {
    console.error('Error checking analysis status:', error);
    throw error;
  }
}

// NEW: Get the results of a completed analysis
export async function getAnalysisResults(poller) {
  try {
    const result = await poller.pollUntilDone();
    
    if (!result || !result.documents || result.documents.length === 0) {
      throw new Error('No documents found in the result');
    }
    
    const document = result.documents[0];
    const fields = document.fields || {};
    
    return {
      status: 'succeeded',
      confidence: document.confidence || 0,
      fields: fields,
      pages: result.pages || [],
      tables: result.tables || [],
    };
  } catch (error) {
    console.error('Error getting analysis results:', error);
    throw error;
  }
}

// List available models (useful for debugging)
export async function listModels() {
  try {
    const models = [];
    // The listDocumentModels method might be named differently or not available in this version
    // Using type assertion to handle potential method availability
    const modelsList = client.listDocumentModels?.();
    if (!modelsList) {
      console.warn('listDocumentModels method not available in this SDK version');
      return [];
    }
    
    for await (const model of modelsList) {
      models.push({
        modelId: model.modelId,
        createdOn: model.createdOn,
        description: model.description
      });
    }
    return models;
  } catch (error) {
    console.error('Error listing models:', error);
    return [];
  }
}