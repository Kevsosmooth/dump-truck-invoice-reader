import express from 'express';
import { PrismaClient } from '@prisma/client';
import { DocumentAnalysisClient, AzureKeyCredential } from '@azure/ai-form-recognizer';
import { authenticateAdmin } from '../middleware/admin-auth.js';

const router = express.Router();
const prisma = new PrismaClient();

// Apply admin authentication to all routes
router.use(authenticateAdmin);

// Get real-time system health metrics
router.get('/status', async (req, res) => {
  try {
    const healthChecks = await Promise.allSettled([
      // Database health check
      checkDatabaseHealth(),
      
      // Azure API health check
      checkAzureHealth(),
      
      // Get active jobs count
      prisma.job.count({
        where: {
          status: { in: ['PROCESSING', 'QUEUED'] }
        }
      }),
      
      // Get recent error count (last hour)
      prisma.job.count({
        where: {
          status: 'FAILED',
          createdAt: { gte: new Date(Date.now() - 60 * 60 * 1000) }
        }
      })
    ]);

    const [dbHealth, azureHealth, activeJobs, recentErrors] = healthChecks;

    res.json({
      database: {
        status: dbHealth.status === 'fulfilled' ? 'healthy' : 'unhealthy',
        responseTime: dbHealth.status === 'fulfilled' ? dbHealth.value.responseTime : null,
        error: dbHealth.status === 'rejected' ? dbHealth.reason.message : null
      },
      azure: {
        status: azureHealth.status === 'fulfilled' ? 'healthy' : 'unhealthy',
        responseTime: azureHealth.status === 'fulfilled' ? azureHealth.value.responseTime : null,
        error: azureHealth.status === 'rejected' ? azureHealth.reason.message : null
      },
      processing: {
        activeJobs: activeJobs.status === 'fulfilled' ? activeJobs.value : 0,
        queueStatus: getQueueStatus(activeJobs.value || 0)
      },
      errors: {
        recentCount: recentErrors.status === 'fulfilled' ? recentErrors.value : 0,
        status: getErrorStatus(recentErrors.value || 0)
      }
    });
  } catch (error) {
    console.error('Health check error:', error);
    res.status(500).json({ error: 'Failed to perform health check' });
  }
});

// Check database health with actual connection test
async function checkDatabaseHealth() {
  const startTime = Date.now();
  
  try {
    // Execute a simple query to test connection
    await prisma.$queryRaw`SELECT 1`;
    
    return {
      status: 'healthy',
      responseTime: Date.now() - startTime
    };
  } catch (error) {
    throw new Error(`Database connection failed: ${error.message}`);
  }
}

// Check Azure Document Intelligence API health
async function checkAzureHealth() {
  const startTime = Date.now();
  
  try {
    const endpoint = process.env.AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT;
    const apiKey = process.env.AZURE_DOCUMENT_INTELLIGENCE_KEY;
    
    if (!endpoint || !apiKey) {
      throw new Error('Azure credentials not configured');
    }

    const client = new DocumentAnalysisClient(
      endpoint,
      new AzureKeyCredential(apiKey)
    );
    
    // List models to test API connectivity
    const modelsIterator = await client.listDocumentModels();
    await modelsIterator.next(); // Try to get at least one model
    
    return {
      status: 'healthy',
      responseTime: Date.now() - startTime
    };
  } catch (error) {
    throw new Error(`Azure API check failed: ${error.message}`);
  }
}

function getQueueStatus(activeJobs) {
  if (activeJobs > 50) return 'busy';
  if (activeJobs > 20) return 'moderate';
  return 'normal';
}

function getErrorStatus(errorCount) {
  if (errorCount > 10) return 'high';
  if (errorCount > 5) return 'moderate';
  return 'low';
}

export default router;