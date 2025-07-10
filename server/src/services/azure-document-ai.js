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
    
    // Extract the data - just return whatever fields the model found
    const extractedData = {
      status: 'succeeded',
      confidence: document.confidence || 0,
      fields: fields, // Return ALL fields as-is from the model
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

// Function to process a document from URL (for blob storage)
export async function processDocumentFromUrl(documentUrl, fileName, modelId) {
  try {
    console.log(`Processing document from URL for ${fileName} with model: ${modelId || customModelId}`);
    
    const model = modelId || customModelId;
    
    // Use the SDK properly with beginAnalyzeDocumentFromUrl
    const poller = await client.beginAnalyzeDocumentFromUrl(model, documentUrl, {
      onProgress: (state) => {
        console.log(`Analysis progress: ${state.status}`);
      }
    });
    
    console.log('Analysis started, polling for results...');
    const result = await poller.pollUntilDone();
    
    if (!result || !result.documents || result.documents.length === 0) {
      throw new Error('No documents found in the result');
    }
    
    const document = result.documents[0];
    const fields = document.fields || {};
    
    
    // Extract the data - just return whatever fields the model found
    const extractedData = {
      confidence: document.confidence || 0,
      modelUsed: model,
      fields: fields, // Return ALL fields as-is from the model
      pages: result.pages || [],
      tables: result.tables || [],
    };
    
    console.log('Document processed successfully from URL:', {
      confidence: extractedData.confidence,
      fieldsExtracted: Object.keys(fields).length
    });
    
    return extractedData;
    
  } catch (error) {
    console.error('Error processing document from URL:', error);
    
    // If SDK fails, try REST API as fallback
    if (error.message?.includes('Could not download the file')) {
      console.log('SDK failed to download file, trying REST API...');
      return processDocumentFromUrlREST(documentUrl, fileName, modelId);
    }
    
    throw error;
  }
}

// Fallback function using REST API
async function processDocumentFromUrlREST(documentUrl, fileName, modelId) {
  try {
    const model = modelId || customModelId;
    const analyzeUrl = `${endpoint}/formrecognizer/documentModels/${model}:analyze?api-version=2023-07-31`;
    
    const response = await fetch(analyzeUrl, {
      method: 'POST',
      headers: {
        'Ocp-Apim-Subscription-Key': apiKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        urlSource: documentUrl
      })
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('REST API error:', errorText);
      throw new Error(`Failed to analyze document: ${response.status} ${response.statusText}`);
    }
    
    const operationLocation = response.headers.get('operation-location');
    if (!operationLocation) {
      throw new Error('No operation location returned');
    }
    
    console.log('REST API: Analysis started, polling for results...');
    
    // Poll for results
    let result = null;
    let attempts = 0;
    const maxAttempts = 60; // 60 attempts * 2 seconds = 2 minutes max
    
    while (attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds
      
      const pollResponse = await fetch(operationLocation, {
        headers: {
          'Ocp-Apim-Subscription-Key': apiKey
        }
      });
      
      if (!pollResponse.ok) {
        throw new Error(`Failed to poll results: ${pollResponse.status}`);
      }
      
      const pollData = await pollResponse.json();
      
      if (pollData.status === 'succeeded') {
        result = pollData.analyzeResult;
        break;
      } else if (pollData.status === 'failed') {
        throw new Error(`Analysis failed: ${JSON.stringify(pollData.error)}`);
      }
      
      attempts++;
    }
    
    if (!result) {
      throw new Error('Analysis timed out');
    }
    
    if (!result.documents || result.documents.length === 0) {
      throw new Error('No documents found in the result');
    }
    
    const document = result.documents[0];
    const fields = document.fields || {};
    
    
    // Extract the data - just return whatever fields the model found
    const extractedData = {
      confidence: document.confidence || 0,
      modelUsed: model,
      fields: fields, // Return ALL fields as-is from the model
      pages: result.pages || [],
      tables: result.tables || [],
    };
    
    console.log('REST API: Document processed successfully from URL:', {
      confidence: extractedData.confidence,
      fieldsExtracted: Object.keys(fields).length
    });
    
    return extractedData;
    
  } catch (error) {
    console.error('REST API: Error processing document from URL:', error);
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
      throw new Error(`Model '${model}' not found. Please check your Azure Form Recognizer configuration.`);
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
      throw new Error(`Model '${model}' not found. Please check your Azure Form Recognizer configuration.`);
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