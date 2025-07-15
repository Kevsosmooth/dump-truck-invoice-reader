import express from 'express';
import { prisma } from '../index.js';
import { authenticateToken } from '../middleware/auth.js';
import { getDashboardAnalytics } from '../services/analytics.js';

const router = express.Router();

// Get current user's credit balance
router.get('/credits', async (req, res) => {
  try {
    // Mock user ID for now - replace with actual auth later
    const userId = 1;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        credits: true,
        _count: {
          select: {
            jobs: {
              where: {
                createdAt: {
                  gte: new Date(new Date().setDate(new Date().getDate() - 30)) // Last 30 days
                }
              }
            }
          }
        }
      }
    });

    if (!user) {
      // Create a mock user if doesn't exist
      const newUser = await prisma.user.create({
        data: {
          azureId: 'mock-user-1',
          email: 'test@example.com',
          firstName: 'Test',
          lastName: 'User',
          credits: 100, // Start with 100 free credits
        },
      });

      return res.json({
        balance: newUser.credits,
        usage: {
          today: 0,
          thisWeek: 0,
          thisMonth: 0,
        },
      });
    }

    // Calculate usage
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    
    const monthAgo = new Date();
    monthAgo.setMonth(monthAgo.getMonth() - 1);

    const jobs = await prisma.job.findMany({
      where: {
        userId,
        status: 'COMPLETED',
        createdAt: {
          gte: monthAgo,
        },
      },
      select: {
        creditsUsed: true,
        createdAt: true,
      },
    });

    const usage = {
      today: jobs
        .filter(job => job.createdAt >= today)
        .reduce((sum, job) => sum + (job.creditsUsed || 0), 0),
      thisWeek: jobs
        .filter(job => job.createdAt >= weekAgo)
        .reduce((sum, job) => sum + (job.creditsUsed || 0), 0),
      thisMonth: jobs
        .reduce((sum, job) => sum + (job.creditsUsed || 0), 0),
    };

    return res.json({
      balance: user.credits,
      usage,
    });
  } catch (error) {
    console.error('Error fetching credits:', error);
    return res.status(500).json({ error: 'Failed to fetch credit balance' });
  }
});

// Add credits (for testing)
router.post('/credits/add', async (req, res) => {
  try {
    const { amount = 50 } = req.body;
    const userId = 1; // Mock user ID

    const user = await prisma.user.update({
      where: { id: userId },
      data: {
        credits: {
          increment: amount,
        },
      },
    });

    await prisma.transaction.create({
      data: {
        userId,
        type: 'BONUS',
        amount: 0,
        credits: amount,
        status: 'COMPLETED',
        description: 'Test credits added',
      },
    });

    return res.json({
      success: true,
      newBalance: user.credits,
    });
  } catch (error) {
    console.error('Error adding credits:', error);
    return res.status(500).json({ error: 'Failed to add credits' });
  }
});

// Get dashboard analytics for the current user
router.get('/dashboard/analytics', authenticateToken, async (req, res) => {
  try {
    const analytics = await getDashboardAnalytics(req.user.id);
    res.json(analytics);
  } catch (error) {
    console.error('Error fetching dashboard analytics:', error);
    res.status(500).json({ error: 'Failed to fetch analytics' });
  }
});

export default router;