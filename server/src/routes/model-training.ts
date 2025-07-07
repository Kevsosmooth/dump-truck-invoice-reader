import express, { Request, Response } from 'express';
import multer from 'multer';
import { AzureTrainingService } from '../services/azure-training-service';
import { v4 as uuidv4 } from 'uuid';
import { DocumentModelBuildMode } from '@azure/ai-form-recognizer';

const router = express.Router();
const trainingService = new AzureTrainingService();

// Configure multer for training document uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit for training documents
  },
  fileFilter: (_req, file, cb) => {
    const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/tiff'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only PDF, JPEG, PNG, and TIFF are allowed.'));
    }
  },
});

// In-memory storage for demo (replace with database in production)
interface TrainingProject {
  id: string;
  userId: string;
  name: string;
  description?: string;
  status: 'setup' | 'uploading' | 'labeling' | 'training' | 'completed' | 'failed';
  modelType: 'template' | 'neural';
  documents: TrainingDocument[];
  modelId?: string;
  operationId?: string;
  containerUrl?: string;
  createdAt: Date;
  updatedAt: Date;
}

interface TrainingDocument {
  id: string;
  fileName: string; // Actual filename with UUID prefix
  originalFileName?: string; // Original filename for display
  fileUrl: string;
  status: 'uploaded' | 'labeled';
  labels?: any[];
  pageCount: number;
  fileSize?: number; // Size in bytes
  buffer?: Buffer; // Temporary storage for demo
  mimeType?: string; // MIME type for serving
}

// Simple in-memory storage
const trainingProjects = new Map<string, TrainingProject>();
const userModels = new Map<string, string[]>(); // userId -> modelIds[]

// Create a new training project
router.post('/projects', async (req: Request, res: Response) => {
  try {
    const { name, description, modelType = 'template' } = req.body;
    const userId = 'demo-user'; // In production, get from auth

    if (!name) {
      res.status(400).json({ error: 'Project name is required' });
      return;
    }

    const projectId = uuidv4();
    const project: TrainingProject = {
      id: projectId,
      userId,
      name,
      description,
      status: 'setup',
      modelType,
      documents: [],
      createdAt: new Date(),
      updatedAt: new Date()
    };

    trainingProjects.set(projectId, project);

    // Create blob container for this project
    try {
      const containerClient = await trainingService.createTrainingContainer(userId, projectId);
      project.containerUrl = containerClient.url;
    } catch (error) {
      console.warn('Blob storage not configured, using local storage');
    }

    res.json({
      success: true,
      project: {
        id: project.id,
        name: project.name,
        description: project.description,
        status: project.status,
        modelType: project.modelType,
        documentsCount: 0
      }
    });
  } catch (error: any) {
    console.error('Failed to create project:', error);
    res.status(500).json({ error: 'Failed to create training project' });
  }
});

// Get project details
router.get('/projects/:projectId', async (req: Request, res: Response) => {
  try {
    const { projectId } = req.params;
    const project = trainingProjects.get(projectId);

    if (!project) {
      res.status(404).json({ error: 'Project not found' });
      return;
    }

    res.json({
      id: project.id,
      name: project.name,
      description: project.description,
      status: project.status,
      modelType: project.modelType,
      documentsCount: project.documents.length,
      documents: project.documents.map(doc => ({
        ...doc,
        fileName: doc.originalFileName || doc.fileName, // Return original name for display
        actualFileName: doc.fileName // Include actual filename if needed
      })),
      createdAt: project.createdAt,
      updatedAt: project.updatedAt
    });
  } catch (error: any) {
    console.error('Get project error:', error);
    res.status(500).json({ error: 'Failed to get project details' });
  }
});

// Upload training documents
router.post('/projects/:projectId/documents', upload.array('documents', 20), async (req: Request, res: Response) => {
  try {
    const { projectId } = req.params;
    const project = trainingProjects.get(projectId);

    if (!project) {
      res.status(404).json({ error: 'Project not found' });
      return;
    }

    if (!req.files || !Array.isArray(req.files)) {
      res.status(400).json({ error: 'No files provided' });
      return;
    }

    const uploadedDocs: TrainingDocument[] = [];

    // Check total size for model type limits
    const existingSize = project.documents.reduce((sum, doc) => sum + (doc.fileSize || 0), 0);
    const newSize = req.files.reduce((sum, file) => sum + file.size, 0);
    const totalSize = existingSize + newSize;
    
    // Size limits: Template (50MB), Neural (1GB)
    const maxSize = project.modelType === 'neural' ? 1024 * 1024 * 1024 : 50 * 1024 * 1024;
    
    if (totalSize > maxSize) {
      res.status(400).json({ 
        error: `Total training data exceeds ${project.modelType} model limit`,
        maxSizeMB: Math.round(maxSize / (1024 * 1024)),
        currentSizeMB: Math.round(existingSize / (1024 * 1024)),
        attemptedSizeMB: Math.round(newSize / (1024 * 1024)),
        totalSizeMB: Math.round(totalSize / (1024 * 1024))
      });
      return;
    }

    // Upload each document to blob storage
    for (const file of req.files) {
      const docId = uuidv4();
      const fileName = `${docId}_${file.originalname}`;
      
      let fileUrl = '';
      
      if (project.containerUrl) {
        // Upload to Azure Blob Storage
        const containerClient = await trainingService.createTrainingContainer(project.userId, project.id);
        // Upload to folder structure: userId/projectId/fileName
        const filePath = `${project.userId}/${project.id}/${fileName}`;
        fileUrl = await trainingService.uploadTrainingDocumentWithOcr(
          containerClient,
          filePath,
          file.buffer,
          file.mimetype
        );
      } else {
        // Fallback to local storage simulation
        fileUrl = `/training-data/${project.id}/${fileName}`;
      }

      const doc: TrainingDocument = {
        id: docId,
        fileName: fileName, // Store the actual filename with UUID prefix
        fileUrl,
        status: 'uploaded',
        pageCount: 1, // Would need to determine actual page count
        fileSize: file.size,
        buffer: file.buffer, // Store buffer for serving
        mimeType: file.mimetype,
        originalFileName: file.originalname // Keep original name for display
      };

      project.documents.push(doc);
      uploadedDocs.push(doc);
    }

    project.status = 'uploading';
    project.updatedAt = new Date();

    res.json({
      success: true,
      projectId: project.id,
      uploadedDocuments: uploadedDocs.map(doc => ({
        id: doc.id,
        fileName: doc.originalFileName || doc.fileName, // Return original name for display
        status: doc.status
      })),
      totalDocuments: project.documents.length
    });
  } catch (error: any) {
    console.error('Document upload error:', error);
    res.status(500).json({ error: 'Failed to upload documents' });
  }
});

// Get document preview/content
router.get('/projects/:projectId/documents/:documentId/preview', async (req: Request, res: Response) => {
  try {
    const { projectId, documentId } = req.params;
    const project = trainingProjects.get(projectId);

    if (!project) {
      res.status(404).json({ error: 'Project not found' });
      return;
    }

    const document = project.documents.find(d => d.id === documentId);
    if (!document) {
      res.status(404).json({ error: 'Document not found' });
      return;
    }

    // Serve the actual document
    if ((document as any).buffer) {
      // Set proper headers for PDF
      res.set({
        'Content-Type': (document as any).mimeType || 'application/pdf',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET',
        'Cache-Control': 'no-cache'
      });
      res.send((document as any).buffer);
    } else {
      res.status(404).json({ error: 'Document content not found' });
    }
  } catch (error: any) {
    console.error('Document preview error:', error);
    res.status(500).json({ error: 'Failed to get document preview' });
  }
});

// Save labels for a document
router.post('/projects/:projectId/documents/:documentId/labels', async (req: Request, res: Response) => {
  try {
    const { projectId, documentId } = req.params;
    const { labels } = req.body;

    const project = trainingProjects.get(projectId);
    if (!project) {
      res.status(404).json({ error: 'Project not found' });
      return;
    }

    const document = project.documents.find(d => d.id === documentId);
    if (!document) {
      res.status(404).json({ error: 'Document not found' });
      return;
    }

    // Validate labels
    if (!Array.isArray(labels)) {
      res.status(400).json({ error: 'Labels must be an array' });
      return;
    }

    // Save labels
    document.labels = labels;
    document.status = 'labeled';

    // If using Azure Blob Storage, upload the labels file
    if (project.containerUrl) {
      const containerClient = await trainingService.createTrainingContainer(project.userId, project.id);
      
      // Labels should be in same location as documents (userId/projectId/)
      // Use the actual filename (with UUID) for the label format - this must match the PDF filename
      const labelData = trainingService.generateLabelFormat(document.fileName, labels);
      
      // Use the full path with actual filename (including UUID) for blob storage
      const filePath = `${project.userId}/${project.id}/${document.fileName}`;
      console.log('Uploading labels for:', filePath);
      await trainingService.uploadLabelData(containerClient, filePath, labelData);
    }

    // Check if all documents are labeled
    const allLabeled = project.documents.every(d => d.status === 'labeled');
    if (allLabeled && project.documents.length >= 5) {
      project.status = 'labeling';
    }

    project.updatedAt = new Date();

    res.json({
      success: true,
      documentId: document.id,
      labelCount: labels.length,
      projectReady: allLabeled && project.documents.length >= 5
    });
  } catch (error: any) {
    console.error('Label save error:', error);
    res.status(500).json({ error: 'Failed to save labels' });
  }
});

// Start model training
router.post('/projects/:projectId/train', async (req: Request, res: Response) => {
  try {
    const { projectId } = req.params;
    const project = trainingProjects.get(projectId);

    if (!project) {
      res.status(404).json({ error: 'Project not found' });
      return;
    }

    // Validate project is ready
    // Both neural and template models require at least 5 labeled documents
    const minDocuments = 5;
    if (project.documents.length < minDocuments) {
      res.status(400).json({ 
        error: `Minimum ${minDocuments} document${minDocuments > 1 ? 's' : ''} required for ${project.modelType} model training`,
        currentCount: project.documents.length,
        modelType: project.modelType
      });
      return;
    }

    // Both neural and template models require labeled documents
    const allLabeled = project.documents.every(d => d.status === 'labeled');
    if (!allLabeled) {
      res.status(400).json({ 
        error: 'All documents must be labeled before training',
        unlabeledCount: project.documents.filter(d => d.status !== 'labeled').length,
        note: 'Both neural and template models require labeled training data'
      });
      return;
    }

    // Generate model ID
    const modelId = `user_${project.userId}_${project.name.replace(/\s+/g, '_')}_${Date.now()}`;
    project.modelId = modelId;

    let operationId = 'mock-operation-' + Date.now();
    
    try {
      // Get SAS URL for training container
      const containerClient = await trainingService.createTrainingContainer(project.userId, project.id);
      const sasUrl = await trainingService.generateTrainingSasUrl(containerClient);

      // Map model type to DocumentModelBuildMode enum
      const buildMode = project.modelType === 'neural' 
        ? DocumentModelBuildMode.Neural 
        : DocumentModelBuildMode.Template;

      // Start training
      const folderPath = `${project.userId}/${project.id}`;
      
      // Log the SAS URL format for debugging
      console.log('Container SAS URL:', sasUrl);
      console.log('Training folder prefix:', folderPath);
      
      // Verify files exist before training
      const files = await trainingService.listTrainingFiles(containerClient, folderPath);
      console.log(`Verified ${files.length} files in training folder`);
      
      if (files.length === 0) {
        throw new Error(`No training files found at prefix: ${folderPath}`);
      }
      
      // Check for minimum required files
      const pdfFiles = files.filter(f => f.endsWith('.pdf'));
      const labelFiles = files.filter(f => f.endsWith('.labels.json'));
      const ocrFiles = files.filter(f => f.endsWith('.ocr.json'));
      
      console.log(`Found ${pdfFiles.length} PDF files, ${labelFiles.length} label files, ${ocrFiles.length} OCR files`);
      
      if (pdfFiles.length < 5) {
        throw new Error(`Insufficient training documents. Found ${pdfFiles.length} PDFs, but need at least 5.`);
      }
      
      if (labelFiles.length !== pdfFiles.length) {
        throw new Error(`Label file mismatch. Found ${pdfFiles.length} PDFs but ${labelFiles.length} label files.`);
      }
      
      // Azure Document Intelligence expects:
      // 1. Container-level SAS URL
      // 2. Prefix without trailing slash to filter documents
      operationId = await trainingService.startModelTraining({
        modelId,
        modelName: project.name,
        description: project.description,
        buildMode,
        trainingDataUrl: sasUrl,
        prefix: folderPath // No trailing slash
      });
    } catch (error: any) {
      console.error('Training start error:', error);
      
      // Only simulate if it's a storage configuration error
      if (error.message?.includes('Azure Storage not configured')) {
        console.log('No storage configured - simulating training...');
      } else {
        // This is a real error - fail properly
        throw error;
      }
    }

    project.status = 'training';
    project.operationId = operationId;
    project.updatedAt = new Date();

    // Track user's models
    const userModelList = userModels.get(project.userId) || [];
    userModelList.push(modelId);
    userModels.set(project.userId, userModelList);

    res.json({
      success: true,
      projectId: project.id,
      modelId,
      operationId,
      status: 'training',
      message: 'Model training started. This typically takes 20-30 minutes.'
    });
  } catch (error: any) {
    console.error('Training start error:', error);
    res.status(500).json({ error: 'Failed to start training' });
  }
});

// Check training status
router.get('/projects/:projectId/status', async (req: Request, res: Response) => {
  try {
    const { projectId } = req.params;
    const project = trainingProjects.get(projectId);

    if (!project) {
      res.status(404).json({ error: 'Project not found' });
      return;
    }

    let trainingProgress = null;
    if (project.modelId && project.status === 'training') {
      try {
        // Use operation ID if available for more accurate status
        if (project.operationId) {
          trainingProgress = await trainingService.checkOperationStatus(project.modelId, project.operationId);
        } else {
          trainingProgress = await trainingService.checkTrainingProgress(project.modelId);
        }
        
        // Update project status based on training progress
        if (trainingProgress.status === 'succeeded') {
          project.status = 'completed';
        } else if (trainingProgress.status === 'failed') {
          project.status = 'failed';
        }
      } catch (error) {
        console.log('Error checking training status:', error);
        console.log('Simulating training progress...');
        // Simulate training progress for simple mode
        const startTime = project.updatedAt.getTime();
        const elapsed = Date.now() - startTime;
        const progress = Math.min(95, (elapsed / (30 * 1000)) * 100); // 30 seconds for demo
        
        if (progress >= 95) {
          project.status = 'completed';
          trainingProgress = { status: 'succeeded', percentCompleted: 100 };
        } else {
          trainingProgress = { status: 'running', percentCompleted: Math.floor(progress) };
        }
      }
      project.updatedAt = new Date();
    }

    res.json({
      projectId: project.id,
      projectName: project.name,
      status: project.status,
      modelId: project.modelId,
      documentsCount: project.documents.length,
      labeledCount: project.documents.filter(d => d.status === 'labeled').length,
      trainingProgress,
      updatedAt: project.updatedAt
    });
  } catch (error: any) {
    console.error('Status check error:', error);
    res.status(500).json({ error: 'Failed to check status' });
  }
});

// List user's custom models
router.get('/models', async (_req: Request, res: Response) => {
  try {
    const userId = 'demo-user'; // In production, get from auth
    
    // Get model details from Azure - first try with prefix, then get all
    let models = await trainingService.listCustomModels(`user_${userId}_`);
    
    // Also get all models to see what's available
    const allModels = await trainingService.listCustomModels();
    
    console.log(`Found ${models.length} models with prefix user_${userId}_`);
    console.log(`Total models in account: ${allModels.length}`);
    
    // Log all model IDs for debugging
    allModels.forEach(model => {
      console.log(`Model ID: ${model.modelId}, Created: ${(model as any).createdOn}`);
    });
    
    res.json({
      models: models.map(model => ({
        id: model.modelId,
        name: (model as any).modelName || model.modelId,
        description: model.description,
        createdAt: (model as any).createdOn || new Date().toISOString(),
        status: 'active'
      })),
      allModels: allModels.map(model => ({
        id: model.modelId,
        name: (model as any).modelName || model.modelId,
        createdAt: (model as any).createdOn || new Date().toISOString()
      })),
      totalCount: models.length,
      totalInAccount: allModels.length
    });
  } catch (error: any) {
    console.error('List models error:', error);
    res.status(500).json({ error: 'Failed to list models' });
  }
});

// Test a model
router.post('/models/:modelId/test', upload.single('document'), async (req: Request, res: Response) => {
  try {
    const { modelId } = req.params;
    
    if (!req.file) {
      res.status(400).json({ error: 'No test document provided' });
      return;
    }

    // Test the model
    const result = await trainingService.testModel(modelId, req.file.buffer);
    
    // Extract results
    const extractedData: any = {};
    if (result.documents && result.documents.length > 0) {
      const doc = result.documents[0];
      if (doc.fields) {
        Object.entries(doc.fields).forEach(([key, field]) => {
          extractedData[key] = {
            value: (field as any).value,
            confidence: (field as any).confidence
          };
        });
      }
    }

    res.json({
      success: true,
      modelId,
      fileName: req.file.originalname,
      confidence: result.documents?.[0]?.confidence || 0,
      extractedFields: extractedData,
      pageCount: result.pages?.length || 0
    });
  } catch (error: any) {
    console.error('Model test error:', error);
    res.status(500).json({ error: 'Failed to test model' });
  }
});

// Delete a model
router.delete('/models/:modelId', async (req: Request, res: Response) => {
  try {
    const { modelId } = req.params;
    const userId = 'demo-user'; // In production, get from auth
    
    // Verify user owns this model
    if (!modelId.startsWith(`user_${userId}_`)) {
      res.status(403).json({ error: 'Unauthorized to delete this model' });
      return;
    }
    
    await trainingService.deleteModel(modelId);
    
    // Remove from user's model list
    const userModelList = userModels.get(userId) || [];
    const updatedList = userModelList.filter(id => id !== modelId);
    userModels.set(userId, updatedList);
    
    res.json({
      success: true,
      message: 'Model deleted successfully'
    });
  } catch (error: any) {
    console.error('Model delete error:', error);
    res.status(500).json({ error: 'Failed to delete model' });
  }
});

// Get account info (model limits, usage, etc.)
router.get('/account-info', async (_req: Request, res: Response) => {
  try {
    const accountInfo = await trainingService.getAccountInfo();
    
    res.json({
      customModelCount: (accountInfo as any).customDocumentModels?.count || 0,
      customModelLimit: (accountInfo as any).customDocumentModels?.limit || 20,
      // Add subscription tier info here based on your business logic
      subscriptionTier: 'professional',
      modelsRemaining: ((accountInfo as any).customDocumentModels?.limit || 20) - ((accountInfo as any).customDocumentModels?.count || 0)
    });
  } catch (error: any) {
    console.error('Account info error:', error);
    res.status(500).json({ error: 'Failed to get account info' });
  }
});

// Direct Azure training status check endpoint
router.get('/training/azure-status', async (req: Request, res: Response) => {
  try {
    const { modelId, operationId } = req.query;
    
    if (!modelId || !operationId) {
      res.status(400).json({ error: 'modelId and operationId are required' });
      return;
    }
    
    try {
      const trainingProgress = await trainingService.checkOperationStatus(
        modelId as string, 
        operationId as string
      );
      
      res.json({
        modelId,
        operationId,
        status: trainingProgress.status,
        percentCompleted: trainingProgress.percentCompleted,
        error: trainingProgress.error,
        trainingProgress
      });
    } catch (error: any) {
      console.error('Azure status check error:', error);
      res.status(500).json({ 
        error: 'Failed to check Azure training status',
        details: error.message 
      });
    }
  } catch (error: any) {
    console.error('Azure status endpoint error:', error);
    res.status(500).json({ error: 'Failed to process request' });
  }
});

export default router;