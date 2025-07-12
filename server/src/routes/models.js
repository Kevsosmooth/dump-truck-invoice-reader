import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import modelManager from '../services/model-manager.js';

const router = express.Router();

// Get list of models available to current user
router.get('/', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Get models user has access to
    const models = await modelManager.getUserModels(userId);
    
    res.json({
      models,
      count: models.length
    });
  } catch (error) {
    console.error('Error fetching user models:', error);
    res.status(500).json({ 
      error: 'Failed to fetch available models',
      details: error.message 
    });
  }
});

// Get specific model details if user has access
router.get('/:modelId', authenticateToken, async (req, res) => {
  try {
    const { modelId } = req.params;
    const userId = req.user.id;
    
    const model = await modelManager.getUserModel(userId, modelId);
    
    if (!model) {
      return res.status(403).json({ 
        error: 'Access denied or model not found' 
      });
    }
    
    res.json(model);
  } catch (error) {
    console.error('Error fetching model details:', error);
    res.status(500).json({ 
      error: 'Failed to fetch model details',
      details: error.message 
    });
  }
});

// Check if user has access to a specific model
router.get('/:modelId/access', authenticateToken, async (req, res) => {
  try {
    const { modelId } = req.params;
    const userId = req.user.id;
    
    const hasAccess = await modelManager.hasAccess(userId, modelId);
    
    res.json({ hasAccess });
  } catch (error) {
    console.error('Error checking model access:', error);
    res.status(500).json({ 
      error: 'Failed to check model access',
      details: error.message 
    });
  }
});

export default router;