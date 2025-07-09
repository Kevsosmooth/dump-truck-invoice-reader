import express from 'express';
import multer from 'multer';
import { AzureTrainingService } from '../services/azure-training-service.js';
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

// Simple in-memory storage
const trainingProjects = new Map();
const userModels = new Map(); // userId -> modelIds[]

// Create a new training project
router.post('/projects', async (req, res) => {
  try {
    const { name, description, modelType = 'template' } = req.body;
    const userId = 'demo-user'; // In production, get from auth

    if (!name) {
      return res.status(400).json({ error: 'Project name is required' });
    }

    const projectId = uuidv4();
    const project = {
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

    return res.json({
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
  } catch (error) {
    console.error('Failed to create project:', error);
    return res.status(500).json({ error: 'Failed to create training project' });
  }
});

// Get project details
router.get('/projects/:projectId', async (req, res) => {
  try {
    const { projectId } = req.params;
    const project = trainingProjects.get(projectId);

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    return res.json({
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
  } catch (error) {
    console.error('Get project error:', error);
    return res.status(500).json({ error: 'Failed to get project details' });
  }
});

// Upload training documents
router.post('/projects/:projectId/documents', upload.array('documents', 20), async (req, res) => {
  try {
    const { projectId } = req.params;
    const project = trainingProjects.get(projectId);

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    if (!req.files || !Array.isArray(req.files)) {
      return res.status(400).json({ error: 'No files provided' });
    }

    const uploadedDocs = [];

    // Check total size for model type limits
    const existingSize = project.documents.reduce((sum, doc) => sum + (doc.fileSize || 0), 0);
    const newSize = req.files.reduce((sum, file) => sum + file.size, 0);
    const totalSize = existingSize + newSize;
    
    // Size limits: Template (50MB), Neural (1GB)
    const maxSize = project.modelType === 'neural' ? 1024 * 1024 * 1024 : 50 * 1024 * 1024;
    
    if (totalSize > maxSize) {
      return res.status(400).json({ 
        error: `Total training data exceeds ${project.modelType} model limit`,
        maxSizeMB: Math.round(maxSize / (1024 * 1024)),
        currentSizeMB: Math.round(existingSize / (1024 * 1024)),
        attemptedSizeMB: Math.round(newSize / (1024 * 1024)),
        totalSizeMB: Math.round(totalSize / (1024 * 1024))
      });
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

      const doc = {
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

    return res.json({
      success: true,
      projectId: project.id,
      uploadedDocuments: uploadedDocs.map(doc => ({
        id: doc.id,
        fileName: doc.originalFileName || doc.fileName, // Return original name for display
        status: doc.status
      })),
      totalDocuments: project.documents.length
    });
  } catch (error) {
    console.error('Document upload error:', error);
    return res.status(500).json({ error: 'Failed to upload documents' });
  }
});

// Get document preview/content
router.get('/projects/:projectId/documents/:documentId/preview', async (req, res) => {
  try {
    const { projectId, documentId } = req.params;
    const project = trainingProjects.get(projectId);

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const document = project.documents.find(d => d.id === documentId);
    if (!document) {
      return res.status(404).json({ error: 'Document not found' });
    }

    // Serve the actual document
    if (document.buffer) {
      // Set proper headers for PDF
      res.set({
        'Content-Type': document.mimeType || 'application/pdf',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET',
        'Cache-Control': 'no-cache'
      });
      return res.send(document.buffer);
    } else {
      return res.status(404).json({ error: 'Document content not found' });
    }
  } catch (error) {
    console.error('Document preview error:', error);
    return res.status(500).json({ error: 'Failed to get document preview' });
  }
});

// Save labels for a document
router.post('/projects/:projectId/documents/:documentId/labels', async (req, res) => {
  try {
    const { projectId, documentId } = req.params;
    const { labels } = req.body;

    const project = trainingProjects.get(projectId);
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const document = project.documents.find(d => d.id === documentId);
    if (!document) {
      return res.status(404).json({ error: 'Document not found' });
    }

    // Validate labels
    if (!Array.isArray(labels)) {
      return res.status(400).json({ error: 'Labels must be an array' });
    }

    // Save labels
    document.labels = labels;
    document.status = 'labeled';
    project.updatedAt = new Date();

    // Check if all documents are labeled
    const allLabeled = project.documents.every(d => d.status === 'labeled');
    if (allLabeled && project.status === 'uploading') {
      project.status = 'labeling';
    }

    return res.json({
      success: true,
      documentId,
      labelsCount: labels.length,
      projectStatus: project.status
    });
  } catch (error) {
    console.error('Save labels error:', error);
    return res.status(500).json({ error: 'Failed to save labels' });
  }
});

// Start model training
router.post('/projects/:projectId/train', async (req, res) => {
  try {
    const { projectId } = req.params;
    const { modelId, description } = req.body;
    
    const project = trainingProjects.get(projectId);
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    // Check if all documents are labeled
    const allLabeled = project.documents.every(d => d.status === 'labeled');
    if (!allLabeled) {
      return res.status(400).json({ 
        error: 'All documents must be labeled before training',
        labeledCount: project.documents.filter(d => d.status === 'labeled').length,
        totalCount: project.documents.length
      });
    }

    if (!modelId) {
      return res.status(400).json({ error: 'Model ID is required' });
    }

    // Check that storage is configured
    if (!project.containerUrl) {
      return res.status(500).json({ 
        error: 'Azure Blob Storage not configured',
        suggestion: 'Please configure AZURE_STORAGE_CONNECTION_STRING'
      });
    }

    project.status = 'training';
    project.modelId = modelId;
    project.updatedAt = new Date();

    // Start training
    try {
      const buildMode = project.modelType === 'neural' 
        ? DocumentModelBuildMode.Neural 
        : DocumentModelBuildMode.Template;

      const operation = await trainingService.startTraining(
        modelId,
        description || `Custom model for ${project.name}`,
        project.containerUrl,
        buildMode
      );

      project.operationId = operation.operationLocation;

      // Save model association
      const userModelList = userModels.get(project.userId) || [];
      userModelList.push(modelId);
      userModels.set(project.userId, userModelList);

      return res.json({
        success: true,
        modelId,
        operationId: operation.operationLocation,
        status: 'training',
        message: 'Model training started successfully'
      });
    } catch (error) {
      project.status = 'failed';
      throw error;
    }
  } catch (error) {
    console.error('Training error:', error);
    return res.status(500).json({ 
      error: 'Failed to start training',
      details: error.message
    });
  }
});

// Check training status
router.get('/projects/:projectId/status', async (req, res) => {
  try {
    const { projectId } = req.params;
    const project = trainingProjects.get(projectId);

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    if (project.status !== 'training' || !project.operationId) {
      return res.json({
        status: project.status,
        modelId: project.modelId
      });
    }

    // Check training status
    try {
      const status = await trainingService.checkTrainingStatus(project.operationId);
      
      if (status.status === 'succeeded') {
        project.status = 'completed';
        project.updatedAt = new Date();
      } else if (status.status === 'failed') {
        project.status = 'failed';
        project.updatedAt = new Date();
      }

      return res.json({
        status: project.status,
        trainingStatus: status.status,
        percentCompleted: status.percentCompleted,
        modelId: project.modelId,
        error: status.error
      });
    } catch (error) {
      console.error('Status check error:', error);
      return res.json({
        status: project.status,
        modelId: project.modelId,
        error: 'Failed to check training status'
      });
    }
  } catch (error) {
    console.error('Get status error:', error);
    return res.status(500).json({ error: 'Failed to get project status' });
  }
});

// Get user's models
router.get('/models', async (req, res) => {
  try {
    const userId = 'demo-user'; // In production, get from auth
    const modelIds = userModels.get(userId) || [];
    
    // Get model details from Azure
    const models = [];
    for (const modelId of modelIds) {
      try {
        const model = await trainingService.getModel(modelId);
        if (model) {
          models.push(model);
        }
      } catch (error) {
        console.warn(`Failed to get model ${modelId}:`, error);
      }
    }

    return res.json({ models });
  } catch (error) {
    console.error('Get models error:', error);
    return res.status(500).json({ error: 'Failed to get models' });
  }
});

// Delete a model
router.delete('/models/:modelId', async (req, res) => {
  try {
    const { modelId } = req.params;
    const userId = 'demo-user'; // In production, get from auth

    await trainingService.deleteModel(modelId);

    // Remove from user's models
    const userModelList = userModels.get(userId) || [];
    const index = userModelList.indexOf(modelId);
    if (index > -1) {
      userModelList.splice(index, 1);
      userModels.set(userId, userModelList);
    }

    return res.json({ 
      success: true,
      message: `Model ${modelId} deleted successfully`
    });
  } catch (error) {
    console.error('Delete model error:', error);
    return res.status(500).json({ error: 'Failed to delete model' });
  }
});

export default router;