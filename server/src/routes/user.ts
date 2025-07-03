import express, { Request, Response } from 'express';
import { prisma } from '../index';

const router = express.Router();

// Get current user's credit balance
router.get('/credits', async (req: Request, res: Response) => {
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

    res.json({
      balance: user.credits,
      usage,
    });
  } catch (error: any) {
    console.error('Error fetching credits:', error);
    res.status(500).json({ error: 'Failed to fetch credit balance' });
  }
});

// Add credits (for testing)
router.post('/credits/add', async (req: Request, res: Response) => {
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

    res.json({
      success: true,
      newBalance: user.credits,
    });
  } catch (error: any) {
    console.error('Error adding credits:', error);
    res.status(500).json({ error: 'Failed to add credits' });
  }
});

export default router;