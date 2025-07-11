import express from 'express';
import axios from 'axios';
import { authenticateToken } from '../middleware/auth.js';
import { PrismaClient } from '@prisma/client';

const router = express.Router();
const prisma = new PrismaClient();

// Get processed pages metrics for the current month
router.get('/processed-pages', authenticateToken, async (req, res) => {
  try {
    // For now, return a mock response since we don't have Azure Monitor API credentials
    // In production, you would:
    // 1. Get an access token using Azure AD
    // 2. Call the Azure Monitor API
    // 3. Return the actual metrics
    
    const currentDate = new Date();
    const firstDayOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
    
    // Mock response matching Azure Monitor format
    const mockData = {
      timespan: `${firstDayOfMonth.toISOString()}/${currentDate.toISOString()}`,
      interval: 'P1D',
      value: {
        start: firstDayOfMonth.toISOString(),
        end: currentDate.toISOString(),
        interval: 'P1D',
        data: [
          {
            timeStamp: currentDate.toISOString(),
            total: 154 // This would be the actual total from Azure
          }
        ]
      },
      namespace: 'Microsoft.CognitiveServices/accounts',
      resourceregion: 'eastus',
      metricName: 'ProcessedPages',
      aggregation: 'Total',
      unit: 'Count'
    };

    // In production, you would make this API call:
    /*
    const subscriptionId = process.env.AZURE_SUBSCRIPTION_ID;
    const resourceGroup = process.env.AZURE_RESOURCE_GROUP;
    const resourceName = 'silvi';
    const metricName = 'ProcessedPages';
    
    const apiUrl = `https://management.azure.com/subscriptions/${subscriptionId}/resourceGroups/${resourceGroup}/providers/Microsoft.CognitiveServices/accounts/${resourceName}/providers/microsoft.insights/metrics?api-version=2024-02-01&metricnames=${metricName}&timespan=${firstDayOfMonth.toISOString()}/${currentDate.toISOString()}&aggregation=Total`;
    
    const response = await axios.get(apiUrl, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    });
    
    const metrics = response.data;
    */

    res.json({
      success: true,
      metrics: mockData,
      summary: {
        totalProcessedPages: 154,
        period: {
          start: firstDayOfMonth.toISOString(),
          end: currentDate.toISOString()
        },
        dailyAverage: Math.round(154 / currentDate.getDate())
      }
    });

  } catch (error) {
    console.error('Error fetching metrics:', error);
    res.status(500).json({ 
      error: 'Failed to fetch metrics',
      message: error.message 
    });
  }
});

// Get processed pages count from database (as alternative)
router.get('/processed-pages/local', authenticateToken, async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    // Default to current month if no dates provided
    const currentDate = new Date();
    const start = startDate ? new Date(startDate) : new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
    const end = endDate ? new Date(endDate) : currentDate;

    // Query your database for processed pages
    const processedCount = await prisma.job.count({
      where: {
        userId: req.user.id,
        status: 'COMPLETED',
        completedAt: {
          gte: start,
          lte: end
        }
      }
    });

    res.json({
      success: true,
      count: processedCount,
      period: {
        start: start.toISOString(),
        end: end.toISOString()
      },
      source: 'database'
    });

  } catch (error) {
    console.error('Error fetching local metrics:', error);
    res.status(500).json({ 
      error: 'Failed to fetch metrics',
      message: error.message 
    });
  }
});

export default router;