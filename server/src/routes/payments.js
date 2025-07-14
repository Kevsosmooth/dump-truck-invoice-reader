import express from 'express';
import { stripeService } from '../services/stripe-service.js';
import { stripe, webhookSecret } from '../config/stripe.js';
import { PrismaClient } from '@prisma/client';
import { requireAuth } from '../middleware/auth.js';

const router = express.Router();
const prisma = new PrismaClient();

/**
 * GET /api/payments/packages
 * Get available credit packages
 */
router.get('/packages', async (req, res) => {
  try {
    // Try to fetch from database first
    const packages = await prisma.creditPackage.findMany({
      where: { isActive: true },
      orderBy: { displayOrder: 'asc' },
      select: {
        id: true,
        name: true,
        description: true,
        credits: true,
        price: true,
      },
    });

    res.json(packages);
  } catch (error) {
    // Silently fall back to defaults if database table doesn't exist
    console.log('Using default packages (database not available)');
    
    // Fallback to default packages if database is not available
    const defaultPackages = [
      {
        id: 'basic',
        name: 'Basic Package',
        description: 'Perfect for small businesses',
        credits: 100,
        price: 999, // $9.99 in cents
      },
      {
        id: 'pro',
        name: 'Pro Package',
        description: 'Best value for regular users',
        credits: 500,
        price: 3999, // $39.99 in cents
      },
      {
        id: 'enterprise',
        name: 'Enterprise Package',
        description: 'For high-volume processing',
        credits: 2000,
        price: 14999, // $149.99 in cents
      },
    ];
    
    res.json(defaultPackages);
  }
});

/**
 * POST /api/payments/create-checkout-session
 * Create a Stripe checkout session
 */
router.post('/create-checkout-session', requireAuth, async (req, res) => {
  try {
    const { packageId } = req.body;
    const userId = req.user.id;

    if (!packageId) {
      return res.status(400).json({ error: 'Package ID is required' });
    }

    // Create checkout session - let it use the environment URLs
    const session = await stripeService.createCheckoutSession(
      userId,
      packageId
    );

    // Log audit event
    await prisma.auditLog.create({
      data: {
        userId: userId,
        eventType: 'CHECKOUT_SESSION_CREATED',
        eventData: {
          sessionId: session.id,
          packageId: packageId,
          amount: session.amount_total,
        },
        ipAddress: req.ip || req.connection.remoteAddress,
        userAgent: req.headers['user-agent'],
      },
    });

    res.json({ 
      sessionId: session.id,
      url: session.url,
    });
  } catch (error) {
    console.error('Error creating checkout session:', error);
    res.status(500).json({ error: 'Failed to create checkout session' });
  }
});

/**
 * POST /api/payments/webhook
 * Handle Stripe webhook events
 * Note: This endpoint requires raw body parsing which is handled by the express.raw() middleware
 */
router.post('/webhook', async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;

  try {
    // Verify webhook signature
    event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    // Handle the event
    await stripeService.handleWebhookEvent(event);
    
    // Log webhook event
    await prisma.auditLog.create({
      data: {
        eventType: 'STRIPE_WEBHOOK',
        eventData: {
          type: event.type,
          id: event.id,
          livemode: event.livemode,
        },
        ipAddress: req.ip || req.connection.remoteAddress,
        userAgent: req.headers['user-agent'],
      },
    });

    res.json({ received: true });
  } catch (error) {
    console.error('Error handling webhook:', error);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

/**
 * GET /api/payments/methods
 * Get saved payment methods for the user
 */
router.get('/methods', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;

    const paymentMethods = await prisma.paymentMethod.findMany({
      where: { 
        userId: userId,
      },
      orderBy: [
        { isDefault: 'desc' },
        { createdAt: 'desc' },
      ],
      select: {
        id: true,
        type: true,
        last4: true,
        brand: true,
        expiryMonth: true,
        expiryYear: true,
        isDefault: true,
      },
    });

    res.json(paymentMethods);
  } catch (error) {
    console.error('Error fetching payment methods:', error);
    res.status(500).json({ error: 'Failed to fetch payment methods' });
  }
});

/**
 * GET /api/payments/history
 * Get transaction history with optional filters
 */
router.get('/history', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const { 
      page = 1, 
      limit = 10,
      type,
      status,
      startDate,
      endDate,
    } = req.query;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    // Build where clause
    const where = {
      userId: userId,
    };

    if (type) {
      where.type = type;
    }

    if (status) {
      where.status = status;
    }

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) {
        where.createdAt.gte = new Date(startDate);
      }
      if (endDate) {
        where.createdAt.lte = new Date(endDate);
      }
    }

    // Get transactions with pagination
    const [transactions, total] = await Promise.all([
      prisma.transaction.findMany({
        where,
        skip,
        take: parseInt(limit),
        orderBy: { createdAt: 'desc' },
        include: {
          package: {
            select: {
              name: true,
              credits: true,
            },
          },
          paymentMethod: {
            select: {
              type: true,
              last4: true,
              brand: true,
            },
          },
        },
      }),
      prisma.transaction.count({ where }),
    ]);

    res.json({
      transactions,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    console.error('Error fetching transaction history:', error);
    res.status(500).json({ error: 'Failed to fetch transaction history' });
  }
});

/**
 * POST /api/payments/reorder
 * Quick reorder using saved payment method
 */
router.post('/reorder', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const { packageId, paymentMethodId } = req.body;

    if (!packageId || !paymentMethodId) {
      return res.status(400).json({ 
        error: 'Package ID and payment method ID are required' 
      });
    }

    // Process reorder
    const transaction = await stripeService.processReorder(
      userId,
      packageId,
      paymentMethodId,
      req.ip || req.connection.remoteAddress,
      req.headers['user-agent']
    );

    // Log audit event
    await prisma.auditLog.create({
      data: {
        userId: userId,
        eventType: 'REORDER_INITIATED',
        eventData: {
          transactionId: transaction.id,
          packageId: packageId,
          paymentMethodId: paymentMethodId,
          amount: transaction.amount,
          credits: transaction.credits,
        },
        ipAddress: req.ip || req.connection.remoteAddress,
        userAgent: req.headers['user-agent'],
      },
    });

    res.json({ 
      success: true,
      transactionId: transaction.id,
      status: transaction.status,
    });
  } catch (error) {
    console.error('Error processing reorder:', error);
    res.status(500).json({ error: error.message || 'Failed to process reorder' });
  }
});

/**
 * GET /api/payments/success
 * Handle successful payment redirect
 */
router.get('/success', requireAuth, async (req, res) => {
  try {
    const { session_id } = req.query;

    if (!session_id) {
      return res.status(400).json({ error: 'Session ID is required' });
    }

    // Retrieve the session from Stripe
    const session = await stripe.checkout.sessions.retrieve(session_id);

    // Get the transaction
    const transaction = await prisma.transaction.findFirst({
      where: {
        stripePaymentIntentId: session.payment_intent,
        userId: req.user.id,
      },
      include: {
        CreditPackage: true,
      },
    });

    if (!transaction) {
      return res.status(404).json({ error: 'Transaction not found' });
    }

    res.json({
      success: true,
      transaction: {
        id: transaction.id,
        credits: transaction.credits,
        amount: transaction.amount,
        status: transaction.status,
        package: transaction.CreditPackage,
      },
    });
  } catch (error) {
    console.error('Error handling payment success:', error);
    res.status(500).json({ error: 'Failed to verify payment' });
  }
});

export default router;