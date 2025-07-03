import { DocumentAnalysisClient, AzureKeyCredential } from '@azure/ai-form-recognizer';
import dotenv from 'dotenv';

dotenv.config();

// Initialize the client
const endpoint = process.env.AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT;
const apiKey = process.env.AZURE_DOCUMENT_INTELLIGENCE_KEY;
const customModelId = process.env.AZURE_CUSTOM_MODEL_ID || 'Silvi_Reader_Full_2.0';

if (!endpoint || !apiKey) {
  throw new Error('Azure Document Intelligence credentials not configured');
}

const client = new DocumentAnalysisClient(endpoint, new AzureKeyCredential(apiKey));

export async function processDocument(filePath: string, modelId?: string): Promise<any> {
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
    
    if (!result || result.documents?.length === 0) {
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

// Function to process a buffer instead of file path (for API uploads)
export async function processDocumentBuffer(buffer: Buffer, fileName: string, modelId?: string): Promise<any> {
  try {
    console.log(`Processing buffer for ${fileName} with model: ${modelId || customModelId}`);
    
    const model = modelId || customModelId;
    
    // Analyze the document from buffer
    const poller = await client.beginAnalyzeDocument(model, buffer);
    const result = await poller.pollUntilDone();
    
    if (!result || result.documents?.length === 0) {
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
      // Include model info
      modelUsed: model,
      fileName: fileName
    };
    
  } catch (error) {
    console.error('Error processing document buffer:', error);
    
    // Check if it's a model not found error
    if (error.message?.includes('model') || error.code === 'ModelNotFound') {
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

// List available models (useful for debugging)
export async function listModels() {
  try {
    const models = [];
    for await (const model of client.listDocumentModels()) {
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