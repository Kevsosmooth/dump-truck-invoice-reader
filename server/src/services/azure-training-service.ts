import { 
  DocumentAnalysisClient, 
  DocumentModelAdministrationClient,
  AzureKeyCredential,
  DocumentModelBuildMode,
  DocumentModelDetails,
  AnalyzeResult
} from '@azure/ai-form-recognizer';
import { BlobServiceClient, ContainerClient, BlobSASPermissions, generateBlobSASQueryParameters, StorageSharedKeyCredential } from '@azure/storage-blob';
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
let blobServiceClient: BlobServiceClient | null = null;
if (storageConnectionString) {
  blobServiceClient = BlobServiceClient.fromConnectionString(storageConnectionString);
}

export interface TrainingProgress {
  status: 'notStarted' | 'running' | 'succeeded' | 'failed';
  percentCompleted?: number;
  error?: string;
}

export interface ModelField {
  name: string;
  type: string; // 'string' | 'number' | 'date' | 'time' | 'phoneNumber' | 'address' | 'currency' | 'selectionMark'
  required: boolean;
  description?: string;
}

export interface TrainingOptions {
  modelId: string;
  modelName: string;
  description?: string;
  buildMode: DocumentModelBuildMode;
  trainingDataUrl: string; // SAS URL to blob container
  prefix?: string; // Optional prefix for filtering training documents
}

export class AzureTrainingService {
  private containerPrefix = 'training-data';

  /**
   * Create a blob container for storing training documents
   */
  async createTrainingContainer(userId: string, projectId: string): Promise<ContainerClient> {
    if (!blobServiceClient) {
      throw new Error('Azure Storage not configured');
    }

    const containerName = `${this.containerPrefix}-${userId}-${projectId}`.toLowerCase();
    const containerClient = blobServiceClient.getContainerClient(containerName);
    
    await containerClient.createIfNotExists({
      access: 'blob'
    });

    return containerClient;
  }

  /**
   * Upload a training document to blob storage
   */
  async uploadTrainingDocument(
    containerClient: ContainerClient,
    fileName: string,
    fileBuffer: Buffer,
    contentType: string
  ): Promise<string> {
    const blockBlobClient = containerClient.getBlockBlobClient(fileName);
    
    await blockBlobClient.upload(fileBuffer, fileBuffer.length, {
      blobHTTPHeaders: {
        blobContentType: contentType
      }
    });

    return blockBlobClient.url;
  }

  /**
   * Upload label data for a document
   */
  async uploadLabelData(
    containerClient: ContainerClient,
    documentName: string,
    labels: any
  ): Promise<void> {
    const labelFileName = `${documentName}.labels.json`;
    const labelData = JSON.stringify(labels, null, 2);
    const blockBlobClient = containerClient.getBlockBlobClient(labelFileName);
    
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
   * Generate a SAS URL for the training container
   */
  async generateTrainingSasUrl(containerClient: ContainerClient): Promise<string> {
    if (!blobServiceClient) {
      throw new Error('Azure Storage not configured');
    }

    // Parse connection string to get account name and key
    const connectionStringParts = storageConnectionString!.split(';');
    let accountName = '';
    let accountKey = '';
    
    connectionStringParts.forEach(part => {
      const [key, value] = part.split('=');
      if (key === 'AccountName') accountName = value;
      if (key === 'AccountKey') accountKey = value;
    });

    const sharedKeyCredential = new StorageSharedKeyCredential(accountName, accountKey);
    
    const sasOptions = {
      containerName: containerClient.containerName,
      permissions: BlobSASPermissions.parse("racwdl"), // read, add, create, write, delete, list
      startsOn: new Date(),
      expiresOn: new Date(new Date().valueOf() + 3600 * 1000 * 24), // 24 hours
    };

    const sasToken = generateBlobSASQueryParameters(sasOptions, sharedKeyCredential).toString();
    return `${containerClient.url}?${sasToken}`;
  }

  /**
   * Start training a custom model
   */
  async startModelTraining(options: TrainingOptions): Promise<string> {
    const { modelId, modelName, description, buildMode, trainingDataUrl, prefix } = options;

    try {
      // Start the training operation
      const poller = await adminClient.beginBuildDocumentModel(
        modelId,
        trainingDataUrl,
        buildMode,
        {
          modelName,
          description,
          prefix, // Optional: filter training documents by prefix
          onProgress: (state) => {
            console.log(`Training progress: ${state.status}`);
          }
        }
      );

      // Don't wait for completion - return operation ID
      return poller.getOperationState().operationId || modelId;
    } catch (error: any) {
      console.error('Failed to start model training:', error);
      throw new Error(`Training failed: ${error.message}`);
    }
  }

  /**
   * Check training progress
   */
  async checkTrainingProgress(modelId: string): Promise<TrainingProgress> {
    try {
      const model = await adminClient.getDocumentModel(modelId);
      
      if (!model) {
        return { status: 'notStarted' };
      }

      // Map model status to our status
      if (model.createdOn && model.docTypes) {
        return { 
          status: 'succeeded',
          percentCompleted: 100 
        };
      }

      return { status: 'running', percentCompleted: 50 };
    } catch (error: any) {
      if (error.code === 'ModelNotFound') {
        return { status: 'notStarted' };
      }
      return { 
        status: 'failed',
        error: error.message 
      };
    }
  }

  /**
   * Get model details
   */
  async getModelDetails(modelId: string): Promise<DocumentModelDetails | null> {
    try {
      return await adminClient.getDocumentModel(modelId);
    } catch (error: any) {
      if (error.code === 'ModelNotFound') {
        return null;
      }
      throw error;
    }
  }

  /**
   * List all custom models for an organization
   */
  async listCustomModels(prefix?: string): Promise<DocumentModelDetails[]> {
    const models: DocumentModelDetails[] = [];
    
    try {
      // List all models
      for await (const model of adminClient.listDocumentModels()) {
        // Filter by prefix if provided (e.g., 'org_123_')
        if (!prefix || model.modelId.startsWith(prefix)) {
          models.push(model);
        }
      }
    } catch (error) {
      console.error('Failed to list models:', error);
    }

    return models;
  }

  /**
   * Delete a custom model
   */
  async deleteModel(modelId: string): Promise<void> {
    try {
      await adminClient.deleteDocumentModel(modelId);
    } catch (error: any) {
      if (error.code !== 'ModelNotFound') {
        throw error;
      }
    }
  }

  /**
   * Test a model with a document
   */
  async testModel(modelId: string, documentBuffer: Buffer): Promise<AnalyzeResult> {
    const poller = await analysisClient.beginAnalyzeDocument(
      modelId,
      documentBuffer
    );
    
    return await poller.pollUntilDone();
  }

  /**
   * Copy a model (useful for creating backups or versions)
   */
  async copyModel(sourceModelId: string, targetModelId: string, targetModelName?: string): Promise<void> {
    const sourceModel = await this.getModelDetails(sourceModelId);
    if (!sourceModel) {
      throw new Error('Source model not found');
    }

    // Get authorization to copy
    const targetAuth = await adminClient.getCopyAuthorization(targetModelId, {
      modelName: targetModelName || sourceModel.modelName
    });

    // Copy the model
    const poller = await adminClient.beginCopyDocumentModelTo(
      sourceModelId,
      targetAuth
    );

    await poller.pollUntilDone();
  }

  /**
   * Compose multiple models into one (useful for handling variations)
   */
  async composeModels(
    componentModelIds: string[],
    composedModelId: string,
    modelName: string,
    description?: string
  ): Promise<void> {
    const poller = await adminClient.beginComposeDocumentModel(
      componentModelIds,
      composedModelId,
      {
        modelName,
        description
      }
    );

    await poller.pollUntilDone();
  }

  /**
   * Get account information (models count, limit, etc.)
   */
  async getAccountInfo() {
    return await adminClient.getResourceDetails();
  }

  /**
   * Generate label format for Document Intelligence
   * This creates the .labels.json file format expected by Azure
   */
  generateLabelFormat(
    documentName: string,
    labels: Array<{
      fieldName: string;
      fieldType: string;
      boundingBoxes: number[][]; // Array of [x, y] coordinates
      value: string;
      pageNumber: number;
    }>
  ) {
    const labelData = {
      document: documentName,
      labels: labels.map(label => ({
        label: label.fieldName,
        key: null,
        value: [
          {
            page: label.pageNumber,
            text: label.value,
            boundingBoxes: [label.boundingBoxes] // Azure expects array of bounding boxes
          }
        ]
      }))
    };

    return labelData;
  }
}