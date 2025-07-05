import express, { Request, Response } from 'express';
import multer from 'multer';
import { AzureTrainingService } from '../services/azure-training-service';
import { v4 as uuidv4 } from 'uuid';

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
  containerUrl?: string;
  createdAt: Date;
  updatedAt: Date;
}

interface TrainingDocument {
  id: string;
  fileName: string;
  fileUrl: string;
  status: 'uploaded' | 'labeled';
  labels?: any[];
  pageCount: number;
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
      documents: project.documents,
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

    // Upload each document to blob storage
    for (const file of req.files) {
      const docId = uuidv4();
      const fileName = `${docId}_${file.originalname}`;
      
      let fileUrl = '';
      
      if (project.containerUrl) {
        // Upload to Azure Blob Storage
        const containerClient = await trainingService.createTrainingContainer(project.userId, project.id);
        // Organize files in folders: userId/projectId/filename
        const blobPath = `${project.userId}/${project.id}/${fileName}`;
        fileUrl = await trainingService.uploadTrainingDocument(
          containerClient,
          blobPath,
          file.buffer,
          file.mimetype
        );
      } else {
        // Fallback to local storage simulation
        fileUrl = `/training-data/${project.id}/${fileName}`;
      }

      const doc: TrainingDocument = {
        id: docId,
        fileName: file.originalname,
        fileUrl,
        status: 'uploaded',
        pageCount: 1, // Would need to determine actual page count
        buffer: file.buffer, // Store buffer for serving
        mimeType: file.mimetype
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
        fileName: doc.fileName,
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
      
      // Use the same path structure as the document
      const documentPath = `${project.userId}/${project.id}/${document.fileName}`;
      const labelData = trainingService.generateLabelFormat(document.fileName, labels);
      
      console.log('Uploading labels for:', documentPath);
      await trainingService.uploadLabelData(containerClient, documentPath, labelData);
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
    if (project.documents.length < 5) {
      res.status(400).json({ 
        error: 'Minimum 5 documents required for training',
        currentCount: project.documents.length
      });
      return;
    }

    const allLabeled = project.documents.every(d => d.status === 'labeled');
    if (!allLabeled) {
      res.status(400).json({ 
        error: 'All documents must be labeled before training',
        unlabeledCount: project.documents.filter(d => d.status !== 'labeled').length
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

      // Start training
      console.log('Starting training with SAS URL:', sasUrl);
      console.log('Training folder path:', `${project.userId}/${project.id}/`);
      
      operationId = await trainingService.startModelTraining({
        modelId,
        modelName: project.name,
        description: project.description,
        buildMode: project.modelType,
        trainingDataUrl: sasUrl,
        prefix: `${project.userId}/${project.id}/` // Specify the folder prefix
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
        trainingProgress = await trainingService.checkTrainingProgress(project.modelId);
        
        // Update project status based on training progress
        if (trainingProgress.status === 'succeeded') {
          project.status = 'completed';
        } else if (trainingProgress.status === 'failed') {
          project.status = 'failed';
        }
      } catch (error) {
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
    
    // Get model details from Azure
    const models = await trainingService.listCustomModels(`user_${userId}_`);
    
    res.json({
      models: models.map(model => ({
        id: model.modelId,
        name: (model as any).modelName || model.modelId,
        description: model.description,
        createdAt: (model as any).createdOn || new Date().toISOString(),
        status: 'active'
      })),
      totalCount: models.length
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

export default router;