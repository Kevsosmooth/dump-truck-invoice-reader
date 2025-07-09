import { 
  DocumentAnalysisClient, 
  DocumentModelAdministrationClient,
  AzureKeyCredential,
  DocumentModelBuildMode
} from '@azure/ai-form-recognizer';
import { BlobServiceClient, ContainerSASPermissions, generateBlobSASQueryParameters, StorageSharedKeyCredential } from '@azure/storage-blob';
import * as dotenv from 'dotenv';

dotenv.config();

// Initialize clients
const endpoint = process.env.AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT;
const apiKey = process.env.AZURE_DOCUMENT_INTELLIGENCE_KEY;
const storageConnectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;

if (!endpoint || !apiKey) {
  throw new Error('Azure Document Intelligence credentials not configured');
}

// Document Analysis client for testing models
const analysisClient = new DocumentAnalysisClient(endpoint, new AzureKeyCredential(apiKey));

// Administration client for model management
const adminClient = new DocumentModelAdministrationClient(endpoint, new AzureKeyCredential(apiKey));

// Blob storage client for training documents
let blobServiceClient = null;
if (storageConnectionString) {
  blobServiceClient = BlobServiceClient.fromConnectionString(storageConnectionString);
}

export class AzureTrainingService {
  constructor() {
    this.containerPrefix = process.env.AZURE_STORAGE_CONTAINER_NAME || 'documents';
  }

  /**
   * Create a blob container for storing training documents
   */
  async createTrainingContainer(userId, projectId) {
    if (!blobServiceClient) {
      throw new Error('Azure Storage not configured');
    }

    // Use a single container with organized folders for each project
    const containerClient = blobServiceClient.getContainerClient(this.containerPrefix);
    
    // Note: Files will be organized in folders like: userId/projectId/filename
    
    // Create private container (no public access)
    await containerClient.createIfNotExists();

    return containerClient;
  }

  /**
   * Upload a training document to blob storage
   */
  async uploadTrainingDocument(containerClient, fileName, fileBuffer, contentType) {
    const blockBlobClient = containerClient.getBlockBlobClient(fileName);
    
    await blockBlobClient.upload(fileBuffer, fileBuffer.length, {
      blobHTTPHeaders: {
        blobContentType: contentType
      }
    });

    return blockBlobClient.url;
  }

  /**
   * Upload training document with OCR processing
   */
  async uploadTrainingDocumentWithOcr(containerClient, fileName, fileBuffer, contentType) {
    // Upload the document
    const documentUrl = await this.uploadTrainingDocument(containerClient, fileName, fileBuffer, contentType);
    
    // Generate and upload OCR file if it's a PDF
    if (contentType === 'application/pdf') {
      try {
        console.log(`Generating OCR for ${fileName}...`);
        const ocrData = await this.generateOcrData(fileBuffer);
        
        const ocrFileName = `${fileName}.ocr.json`;
        const ocrDataString = JSON.stringify(ocrData, null, 2);
        const ocrBlockBlobClient = containerClient.getBlockBlobClient(ocrFileName);
        
        await ocrBlockBlobClient.upload(
          Buffer.from(ocrDataString),
          ocrDataString.length,
          {
            blobHTTPHeaders: {
              blobContentType: 'application/json'
            }
          }
        );
        
        console.log(`OCR file uploaded: ${ocrFileName}`);
      } catch (error) {
        console.error(`Failed to generate OCR for ${fileName}:`, error);
        // Continue without OCR - training might fail but at least document is uploaded
      }
    }
    
    return documentUrl;
  }

  /**
   * Generate OCR data for a document using Azure Layout API
   */
  async generateOcrData(documentBuffer) {
    try {
      console.log('Generating OCR data using Layout API...');
      
      // Use the prebuilt-layout model to analyze the document
      const poller = await analysisClient.beginAnalyzeDocument(
        'prebuilt-layout',
        documentBuffer
      );
      
      const result = await poller.pollUntilDone();
      
      if (!result.pages || result.pages.length === 0) {
        throw new Error('No pages found in document');
      }
      
      // Convert to OCR format expected by training (v2.1 format for labeled training)
      const ocrData = {
        status: "succeeded",
        createdDateTime: new Date().toISOString(),
        lastUpdatedDateTime: new Date().toISOString(),
        analyzeResult: {
          version: "2.1.0",
          readResults: result.pages.map(page => ({
            page: page.pageNumber || 1,
            angle: page.angle || 0,
            width: page.width || 8.5,
            height: page.height || 11,
            unit: page.unit || "inch",
            lines: page.lines?.map(line => {
              // Convert polygon to bounding box format [x1,y1,x2,y2,x3,y3,x4,y4]
              const boundingBox = line.polygon ? [
                line.polygon[0], line.polygon[1],
                line.polygon[2], line.polygon[3],
                line.polygon[4], line.polygon[5],
                line.polygon[6], line.polygon[7]
              ] : [];
              
              // Handle words - check if exists and is an array
              let words = [];
              if (line.words && Array.isArray(line.words)) {
                words = line.words.map(word => {
                  const wordBoundingBox = word.polygon ? [
                    word.polygon[0], word.polygon[1],
                    word.polygon[2], word.polygon[3],
                    word.polygon[4], word.polygon[5],
                    word.polygon[6], word.polygon[7]
                  ] : [];
                  
                  return {
                    boundingBox: wordBoundingBox,
                    text: word.content || '',
                    confidence: word.confidence || 0.99
                  };
                });
              }
              
              return {
                boundingBox,
                text: line.content || '',
                words
              };
            }) || []
          }))
        }
      };
      
      const totalLines = ocrData.analyzeResult.readResults.reduce((sum, page) => sum + page.lines.length, 0);
      console.log(`Generated OCR data with ${totalLines} total lines across ${ocrData.analyzeResult.readResults.length} pages`);
      return ocrData;
    } catch (error) {
      console.error('Failed to generate OCR data:', error);
      console.error('Error stack:', error.stack);
      throw new Error(`OCR generation failed: ${error.message}`);
    }
  }

  /**
   * Upload label data for a document
   */
  async uploadLabelData(containerClient, documentPath, labels) {
    // documentPath includes folder structure: userId/projectId/fileName
    // For labeled training, Azure expects the document name in labels to be just the filename
    const pathParts = documentPath.split('/');
    const documentName = pathParts[pathParts.length - 1];
    
    // Keep the full path for blob storage
    const labelFileName = `${documentPath}.labels.json`;
    
    // Ensure the labels object has the correct document name (just filename, not full path)
    if (labels.document && labels.document !== documentName) {
      console.log(`Adjusting document name in labels from '${labels.document}' to '${documentName}'`);
      labels.document = documentName;
    }
    
    const labelData = JSON.stringify(labels, null, 2);
    const blockBlobClient = containerClient.getBlockBlobClient(labelFileName);
    
    console.log(`Uploading label file: ${labelFileName}`);
    console.log(`Label document reference: ${documentName}`);
    
    await blockBlobClient.upload(
      Buffer.from(labelData),
      labelData.length,
      {
        blobHTTPHeaders: {
          blobContentType: 'application/json'
        }
      }
    );
  }

  /**
   * Upload fields.json file required for labeled training
   */
  async uploadFieldsDefinition(containerClient, fields) {
    const fieldsFileName = 'fields.json';
    const fieldsData = JSON.stringify(fields, null, 2);
    const blockBlobClient = containerClient.getBlockBlobClient(fieldsFileName);
    
    await blockBlobClient.upload(
      Buffer.from(fieldsData),
      fieldsData.length,
      {
        blobHTTPHeaders: {
          blobContentType: 'application/json'
        }
      }
    );
    
    console.log(`Uploaded fields.json with ${Object.keys(fields.fields).length} field definitions`);
  }

  /**
   * Generate SAS URL for a container
   */
  async generateContainerSasUrl(containerClient, permissions = 'rl', expiryHours = 24) {
    if (!blobServiceClient) {
      throw new Error('Azure Storage not configured');
    }

    const containerName = containerClient.containerName;
    const expiryDate = new Date();
    expiryDate.setHours(expiryDate.getHours() + expiryHours);

    // Get account name and key from connection string
    const accountName = blobServiceClient.accountName;
    
    // Extract key from connection string
    const connectionStringParts = storageConnectionString.split(';');
    const accountKeyPart = connectionStringParts.find(part => part.startsWith('AccountKey='));
    if (!accountKeyPart) {
      throw new Error('Could not extract account key from connection string');
    }
    const accountKey = accountKeyPart.split('=')[1];

    const sharedKeyCredential = new StorageSharedKeyCredential(accountName, accountKey);

    const sasToken = generateBlobSASQueryParameters({
      containerName,
      permissions: ContainerSASPermissions.parse(permissions),
      expiresOn: expiryDate,
    }, sharedKeyCredential).toString();

    return `${containerClient.url}?${sasToken}`;
  }

  /**
   * Start model training
   */
  async startTraining(modelId, description, trainingDataUrl, buildMode = DocumentModelBuildMode.Template) {
    console.log(`Starting training for model: ${modelId}`);
    console.log(`Training data URL: ${trainingDataUrl}`);
    console.log(`Build mode: ${buildMode}`);

    try {
      const poller = await adminClient.beginBuildDocumentModel(
        modelId,
        trainingDataUrl,
        buildMode,
        {
          description: description,
          modelName: modelId,
        }
      );

      // Don't wait for completion, return the operation
      return {
        operationLocation: poller.getOperationState().operationLocation,
        modelId: modelId
      };
    } catch (error) {
      console.error('Training error:', error);
      throw error;
    }
  }

  /**
   * Check training status
   */
  async checkTrainingStatus(operationLocation) {
    try {
      // The operation location is usually in format: https://<endpoint>/formrecognizer/operations/<operationId>
      // Extract the operation ID
      const parts = operationLocation.split('/');
      const operationId = parts[parts.length - 1];

      // Get operation details
      const operation = await adminClient.getOperation(operationId);

      return {
        status: operation.status,
        percentCompleted: operation.percentCompleted,
        error: operation.error
      };
    } catch (error) {
      console.error('Error checking training status:', error);
      throw error;
    }
  }

  /**
   * Get model details
   */
  async getModel(modelId) {
    try {
      const model = await adminClient.getDocumentModel(modelId);
      return {
        modelId: model.modelId,
        description: model.description,
        createdOn: model.createdOn,
        apiVersion: model.apiVersion,
        docTypes: model.docTypes
      };
    } catch (error) {
      console.error('Error getting model:', error);
      throw error;
    }
  }

  /**
   * Delete a model
   */
  async deleteModel(modelId) {
    await adminClient.deleteDocumentModel(modelId);
  }

  /**
   * List all models
   */
  async listModels() {
    const models = [];
    for await (const model of adminClient.listDocumentModels()) {
      models.push({
        modelId: model.modelId,
        description: model.description,
        createdOn: model.createdOn
      });
    }
    return models;
  }

  /**
   * Test a model with a document
   */
  async testModel(modelId, documentBuffer) {
    const poller = await analysisClient.beginAnalyzeDocument(modelId, documentBuffer);
    const result = await poller.pollUntilDone();
    return result;
  }
}