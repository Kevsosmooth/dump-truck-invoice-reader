import express from 'express';
import { PrismaClient } from '@prisma/client';
import { requireAuth } from '../middleware/auth.js';

const router = express.Router();
const prisma = new PrismaClient();

// GET /api/transactions/history
router.get('/history', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Parse query parameters
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    
    // Parse date filters
    const startDate = req.query.startDate ? new Date(req.query.startDate) : undefined;
    const endDate = req.query.endDate ? new Date(req.query.endDate) : undefined;
    
    // Parse transaction type filter
    const transactionType = req.query.type; // 'PURCHASE', 'USAGE', 'REFUND', 'ADJUSTMENT'
    
    // Build where clause
    const where = {
      userId,
      ...(transactionType && { type: transactionType }),
      ...(startDate || endDate) && {
        createdAt: {
          ...(startDate && { gte: startDate }),
          ...(endDate && { lte: endDate })
        }
      }
    };
    
    // Get total count for pagination
    const totalCount = await prisma.transaction.count({ where });
    
    // Get transactions with CreditPackage details
    const transactions = await prisma.transaction.findMany({
      where,
      include: {
        CreditPackage: {
          select: {
            id: true,
            name: true,
            credits: true,
            price: true,
            stripeProductId: true,
            stripePriceId: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      },
      skip,
      take: limit
    });
    
    // Calculate pagination metadata
    const totalPages = Math.ceil(totalCount / limit);
    const hasNextPage = page < totalPages;
    const hasPreviousPage = page > 1;
    
    res.json({
      success: true,
      data: {
        transactions,
        pagination: {
          currentPage: page,
          totalPages,
          totalCount,
          limit,
          hasNextPage,
          hasPreviousPage
        }
      }
    });
  } catch (error) {
    console.error('Error fetching transaction history:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch transaction history',
      message: error.message
    });
  }
});

// GET /api/transactions/summary
// Optional endpoint for transaction summary/statistics
router.get('/summary', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Parse date filters
    const startDate = req.query.startDate ? new Date(req.query.startDate) : undefined;
    const endDate = req.query.endDate ? new Date(req.query.endDate) : undefined;
    
    // Build where clause
    const where = {
      userId,
      ...(startDate || endDate) && {
        createdAt: {
          ...(startDate && { gte: startDate }),
          ...(endDate && { lte: endDate })
        }
      }
    };
    
    // Get transaction summary grouped by type
    const summary = await prisma.transaction.groupBy({
      by: ['type'],
      where,
      _sum: {
        amount: true,
        credits: true
      },
      _count: {
        _all: true
      }
    });
    
    // Get total credits purchased vs used
    const creditsPurchased = await prisma.transaction.aggregate({
      where: {
        ...where,
        type: 'PURCHASE',
        credits: { gt: 0 }
      },
      _sum: {
        credits: true
      }
    });
    
    const creditsUsed = await prisma.transaction.aggregate({
      where: {
        ...where,
        type: 'USAGE',
        credits: { lt: 0 }
      },
      _sum: {
        credits: true
      }
    });
    
    res.json({
      success: true,
      data: {
        summary: summary.map(item => ({
          type: item.type,
          count: item._count._all,
          totalAmount: item._sum.amount || 0,
          totalCredits: item._sum.credits || 0
        })),
        creditStats: {
          purchased: creditsPurchased._sum.credits || 0,
          used: Math.abs(creditsUsed._sum.credits || 0)
        }
      }
    });
  } catch (error) {
    console.error('Error fetching transaction summary:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch transaction summary',
      message: error.message
    });
  }
});

// GET /api/transactions/:id
// Get single transaction details
router.get('/:id', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const transactionId = req.params.id;
    
    const transaction = await prisma.transaction.findFirst({
      where: {
        id: transactionId,
        userId
      },
      include: {
        CreditPackage: true,
        processingSession: {
          select: {
            id: true,
            status: true,
            totalFiles: true,
            totalPages: true,
            completedPages: true,
            failedPages: true
          }
        }
      }
    });
    
    if (!transaction) {
      return res.status(404).json({
        success: false,
        error: 'Transaction not found'
      });
    }
    
    res.json({
      success: true,
      data: transaction
    });
  } catch (error) {
    console.error('Error fetching transaction:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch transaction',
      message: error.message
    });
  }
});

export default router;