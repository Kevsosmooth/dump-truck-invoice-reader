import express from 'express';
import { getTierConfig } from '../services/rate-limiter.js';

const router = express.Router();

// Get current tier information (development only)
router.get('/', async (req, res) => {
  try {
    // Only return tier info in development
    if (process.env.NODE_ENV === 'production') {
      return res.status(404).json({ error: 'Not found' });
    }

    const tierConfig = getTierConfig();
    const tier = process.env.AZURE_TIER || 'FREE';

    res.json({
      tier: tier.toUpperCase(),
      maxConcurrent: tierConfig.maxConcurrent,
      requestsPerSecond: tierConfig.refillRate,
      description: tierConfig.description
    });
  } catch (error) {
    console.error('Error getting tier info:', error);
    res.status(500).json({ error: 'Failed to get tier information' });
  }
});

export default router;