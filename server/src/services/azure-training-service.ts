import { 
  DocumentAnalysisClient, 
  DocumentModelAdministrationClient,
  AzureKeyCredential,
  DocumentModelBuildMode,
  DocumentModelDetails,
  AnalyzeResult
} from '@azure/ai-form-recognizer';
import { BlobServiceClient, ContainerClient, ContainerSASPermissions, generateBlobSASQueryParameters, StorageSharedKeyCredential } from '@azure/storage-blob';
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
  private containerPrefix = process.env.AZURE_STORAGE_CONTAINER_NAME || 'training-documents';

  /**
   * Create a blob container for storing training documents
   */
  async createTrainingContainer(userId: string, projectId: string): Promise<ContainerClient> {
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
   * Upload training document with OCR processing
   */
  async uploadTrainingDocumentWithOcr(
    containerClient: ContainerClient,
    fileName: string,
    fileBuffer: Buffer,
    contentType: string
  ): Promise<string> {
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
  async generateOcrData(documentBuffer: Buffer): Promise<any> {
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
    } catch (error: any) {
      console.error('Failed to generate OCR data:', error);
      console.error('Error stack:', error.stack);
      throw new Error(`OCR generation failed: ${error.message}`);
    }
  }

  /**
   * Upload label data for a document
   */
  async uploadLabelData(
    containerClient: ContainerClient,
    documentPath: string,
    labels: any
  ): Promise<void> {
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

    // OCR files are now generated during document upload
    // No need to generate them here anymore
    console.log(`OCR file should already exist for ${documentPath}`);
  }

  /**
   * Generate a SAS URL for the training container
   */
  async generateTrainingSasUrl(containerClient: ContainerClient, folderPrefix?: string): Promise<string> {
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
    
    // Start time should be slightly in the past to avoid clock skew issues
    const startsOn = new Date();
    startsOn.setMinutes(startsOn.getMinutes() - 5);
    
    const sasOptions = {
      containerName: containerClient.containerName,
      permissions: ContainerSASPermissions.parse("rl"), // read and list permissions only for training
      startsOn: startsOn,
      expiresOn: new Date(new Date().valueOf() + 3600 * 1000 * 24), // 24 hours
    };

    const sasToken = generateBlobSASQueryParameters(sasOptions, sharedKeyCredential).toString();
    const sasUrl = `${containerClient.url}?${sasToken}`;
    
    // Always return container-level SAS URL
    // The prefix is passed separately to the training API
    console.log('Generated SAS URL:', {
      containerUrl: containerClient.url,
      hasPrefix: !!folderPrefix,
      prefix: folderPrefix,
      finalUrl: sasUrl
    });
    
    return sasUrl;
  }

  /**
   * List files in a specific folder within the container
   */
  async listTrainingFiles(containerClient: ContainerClient, prefix: string): Promise<string[]> {
    const files: string[] = [];
    
    try {
      // List all blobs with the given prefix
      for await (const blob of containerClient.listBlobsFlat({ prefix })) {
        files.push(blob.name);
      }
      
      console.log(`Found ${files.length} files with prefix "${prefix}":`, files);
    } catch (error) {
      console.error('Error listing blobs:', error);
    }
    
    return files;
  }

  /**
   * Validate training data structure for Azure Document Intelligence
   */
  async validateTrainingData(containerClient: ContainerClient, prefix: string, buildMode: DocumentModelBuildMode): Promise<{
    isValid: boolean;
    pdfCount: number;
    labelCount: number;
    ocrCount: number;
    errors: string[];
  }> {
    const files = await this.listTrainingFiles(containerClient, prefix);
    const errors: string[] = [];
    
    const pdfFiles = files.filter(f => f.endsWith('.pdf'));
    const labelFiles = files.filter(f => f.endsWith('.labels.json'));
    const ocrFiles = files.filter(f => f.endsWith('.ocr.json'));
    
    console.log('Training data validation:', {
      prefix,
      buildMode,
      totalFiles: files.length,
      pdfCount: pdfFiles.length,
      labelCount: labelFiles.length,
      ocrCount: ocrFiles.length
    });
    
    // Minimum requirements
    if (pdfFiles.length < 5) {
      errors.push(`Insufficient PDF files. Found ${pdfFiles.length}, but need at least 5.`);
    }
    
    // For labeled training, check label files
    if (buildMode === 'template') {
      if (labelFiles.length !== pdfFiles.length) {
        errors.push(`Label file mismatch. Found ${pdfFiles.length} PDFs but ${labelFiles.length} label files.`);
      }
      
      if (ocrFiles.length !== pdfFiles.length) {
        errors.push(`OCR file mismatch. Found ${pdfFiles.length} PDFs but ${ocrFiles.length} OCR files.`);
      }
      
      // Check file naming convention
      for (const pdfFile of pdfFiles) {
        const baseName = pdfFile.replace('.pdf', '');
        const expectedLabel = `${baseName}.labels.json`;
        const expectedOcr = `${baseName}.ocr.json`;
        
        if (!files.includes(expectedLabel)) {
          errors.push(`Missing label file for ${pdfFile}. Expected: ${expectedLabel}`);
        }
        
        if (!files.includes(expectedOcr)) {
          errors.push(`Missing OCR file for ${pdfFile}. Expected: ${expectedOcr}`);
        }
      }
    }
    
    return {
      isValid: errors.length === 0,
      pdfCount: pdfFiles.length,
      labelCount: labelFiles.length,
      ocrCount: ocrFiles.length,
      errors
    };
  }

  /**
   * Start training a custom model
   */
  async startModelTraining(options: TrainingOptions): Promise<string> {
    const { modelId, modelName, description, buildMode, trainingDataUrl, prefix } = options;

    try {
      console.log('Starting model training with parameters:', {
        modelId,
        modelName,
        buildMode,
        trainingDataUrl,
        prefix
      });

      // Use container URL with prefix parameter
      // Azure expects the container path in the URL with a separate prefix parameter
      let finalTrainingUrl = trainingDataUrl;
      let usePrefix = prefix;
      
      // Ensure prefix has a trailing slash for Azure
      if (usePrefix && !usePrefix.endsWith('/')) {
        usePrefix = usePrefix + '/';
      }
      
      console.log('Using container URL with prefix parameter approach');

      console.log('Final training parameters:', {
        modelId,
        buildMode,
        trainingUrl: finalTrainingUrl,
        prefix: usePrefix
      });

      // Start the training operation
      const poller = await adminClient.beginBuildDocumentModel(
        modelId,
        finalTrainingUrl,
        buildMode,
        {
          modelName,
          description,
          prefix: usePrefix, // Only use prefix for neural models or when not using folder URL
          onProgress: (state) => {
            console.log(`Training progress: ${state.status}`);
            if (state.error) {
              console.error('Training error details:', {
                error: state.error,
                code: state.error.code,
                message: state.error.message,
                details: state.error.details
              });
            }
          }
        }
      );

      // Log initial operation state
      const initialState = poller.getOperationState();
      console.log('Initial operation state:', {
        operationId: initialState.operationId,
        status: initialState.status,
        isStarted: initialState.isStarted,
        isCompleted: initialState.isCompleted,
        error: initialState.error
      });

      // Don't wait for completion - return operation ID
      const operationId = initialState.operationId || modelId;
      console.log('Training operation started with ID:', operationId);
      return operationId;
    } catch (error: any) {
      console.error('Failed to start model training:', error);
      console.error('Error details:', {
        code: error.code,
        message: error.message,
        details: error.details,
        innerError: error.innerError,
        stack: error.stack
      });
      
      // Provide more specific error messages
      if (error.code === 'TrainingContentMissing') {
        throw new Error(`Training failed: No training documents found at the specified location. Ensure your documents are properly uploaded and the folder structure is correct.`);
      } else if (error.code === 'InvalidArgument') {
        throw new Error(`Training failed: Invalid training configuration. ${error.message}`);
      }
      
      throw new Error(`Training failed: ${error.message}`);
    }
  }

  /**
   * Check training progress by operation ID
   */
  async checkOperationStatus(modelId: string, operationId: string): Promise<TrainingProgress> {
    try {
      // First try to get the operation status
      const response = await fetch(
        `${endpoint}/formrecognizer/operations/${operationId}?api-version=2023-07-31`,
        {
          headers: {
            'Ocp-Apim-Subscription-Key': apiKey!
          }
        }
      );

      if (response.ok) {
        const operation = await response.json();
        console.log('Operation status:', operation);

        if (operation.status === 'succeeded') {
          return {
            status: 'succeeded',
            percentCompleted: 100
          };
        } else if (operation.status === 'failed') {
          return {
            status: 'failed',
            error: operation.error?.message || 'Training failed',
            percentCompleted: 0
          };
        } else if (operation.status === 'running') {
          return {
            status: 'running',
            percentCompleted: operation.percentCompleted || 50
          };
        } else {
          return {
            status: 'notStarted',
            percentCompleted: 0
          };
        }
      }
    } catch (error) {
      console.error('Failed to check operation status:', error);
    }

    // Fallback to checking model directly
    return this.checkTrainingProgress(modelId);
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
      boundingBoxes: number[]; // [x1, y1, x2, y2] from frontend (already normalized 0-1)
      value: string;
      pageNumber: number;
      pageWidth?: number;
      pageHeight?: number;
    }>
  ) {
    const labelData = {
      document: documentName,
      labels: labels.map(label => {
        // Frontend sends normalized coordinates [x1, y1, x2, y2] in 0-1 range
        // Azure expects 8 points representing 4 corners in clockwise order starting from top-left
        const [x1, y1, x2, y2] = label.boundingBoxes;
        
        // Convert 4-point format to 8-point format (4 corners, clockwise from top-left)
        // Format: [top-left-x, top-left-y, top-right-x, top-right-y, bottom-right-x, bottom-right-y, bottom-left-x, bottom-left-y]
        const boundingBox = [
          x1, y1,  // top-left corner
          x2, y1,  // top-right corner
          x2, y2,  // bottom-right corner
          x1, y2   // bottom-left corner
        ];
        
        return {
          label: label.fieldName,
          key: null,
          value: [
            {
              page: label.pageNumber,
              text: label.value || "", // Azure expects empty string if no value
              boundingBoxes: [boundingBox]
            }
          ]
        };
      })
    };

    return labelData;
  }
}