import express from 'express';
import prisma from '../config/prisma.js';
import { authenticateAdmin } from '../middleware/admin-auth.js';
import { stripe } from '../config/stripe.js';
import AuditLogger from '../services/audit-logger.js';

const router = express.Router();

// Get all credit packages
router.get('/', authenticateAdmin, async (req, res) => {
  try {
    const packages = await prisma.creditPackage.findMany({
      orderBy: [
        { displayOrder: 'asc' },
        { price: 'asc' }
      ],
      include: {
        _count: {
          select: {
            Transaction: true
          }
        }
      }
    });

    res.json(packages);
  } catch (error) {
    console.error('Error fetching packages:', error);
    res.status(500).json({ error: 'Failed to fetch packages' });
  }
});

// Get single package
router.get('/:id', authenticateAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    
    const creditPackage = await prisma.creditPackage.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            Transaction: true
          }
        }
      }
    });

    if (!creditPackage) {
      return res.status(404).json({ error: 'Package not found' });
    }

    res.json(creditPackage);
  } catch (error) {
    console.error('Error fetching package:', error);
    res.status(500).json({ error: 'Failed to fetch package' });
  }
});

// Create new package
router.post('/', authenticateAdmin, async (req, res) => {
  try {
    const { name, description, credits, price, isActive, displayOrder } = req.body;

    // Validate input
    if (!name || !credits || price === undefined) {
      return res.status(400).json({ error: 'Name, credits, and price are required' });
    }

    if (credits <= 0 || price < 0) {
      return res.status(400).json({ error: 'Credits must be positive and price cannot be negative' });
    }

    // Create package in database first
    const creditPackage = await prisma.creditPackage.create({
      data: {
        name,
        description: description || `${credits} credits package`,
        credits: parseInt(credits),
        price: Math.round(price * 100), // Convert to cents
        isActive: isActive !== false,
        displayOrder: displayOrder || 0
      }
    });

    // Create corresponding Stripe product and price
    try {
      // Create Stripe product
      const stripeProduct = await stripe.products.create({
        name: name,
        description: description || `${credits} credits for document processing`,
        metadata: {
          credits: credits.toString(),
          packageId: creditPackage.id
        }
      });

      // Create Stripe price
      const stripePrice = await stripe.prices.create({
        product: stripeProduct.id,
        unit_amount: Math.round(price * 100), // Stripe expects amount in cents
        currency: 'usd',
        metadata: {
          credits: credits.toString(),
          packageId: creditPackage.id
        }
      });

      // Update package with Stripe IDs
      const updatedPackage = await prisma.creditPackage.update({
        where: { id: creditPackage.id },
        data: {
          stripeProductId: stripeProduct.id,
          stripePriceId: stripePrice.id
        }
      });

      // Log the action
      await AuditLogger.log({
        action: 'CREATE_CREDIT_PACKAGE',
        userId: req.admin.id,
        targetType: 'CreditPackage',
        targetId: updatedPackage.id,
        details: {
          name,
          credits,
          price: price,
          stripeProductId: stripeProduct.id,
          stripePriceId: stripePrice.id
        },
        ipAddress: req.ip
      });

      res.status(201).json(updatedPackage);
    } catch (stripeError) {
      // If Stripe creation fails, delete the database entry
      await prisma.creditPackage.delete({
        where: { id: creditPackage.id }
      });
      
      console.error('Stripe error:', stripeError);
      throw new Error('Failed to create Stripe product/price');
    }
  } catch (error) {
    console.error('Error creating package:', error);
    res.status(500).json({ error: error.message || 'Failed to create package' });
  }
});

// Update package
router.put('/:id', authenticateAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, credits, price, isActive, displayOrder } = req.body;

    // Get existing package
    const existingPackage = await prisma.creditPackage.findUnique({
      where: { id }
    });

    if (!existingPackage) {
      return res.status(404).json({ error: 'Package not found' });
    }

    // Validate input
    if (credits && credits <= 0) {
      return res.status(400).json({ error: 'Credits must be positive' });
    }

    if (price !== undefined && price < 0) {
      return res.status(400).json({ error: 'Price cannot be negative' });
    }

    // Prepare update data
    const updateData = {};
    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (credits !== undefined) updateData.credits = parseInt(credits);
    if (price !== undefined) updateData.price = Math.round(price * 100); // Convert to cents
    if (isActive !== undefined) updateData.isActive = isActive;
    if (displayOrder !== undefined) updateData.displayOrder = displayOrder;

    // Update package
    const updatedPackage = await prisma.creditPackage.update({
      where: { id },
      data: updateData
    });

    // Update Stripe product if name or description changed
    if (existingPackage.stripeProductId && (name || description)) {
      try {
        await stripe.products.update(existingPackage.stripeProductId, {
          ...(name && { name }),
          ...(description && { description })
        });
      } catch (stripeError) {
        console.error('Failed to update Stripe product:', stripeError);
        // Continue even if Stripe update fails
      }
    }

    // If price changed, create a new Stripe price (prices are immutable in Stripe)
    if (price !== undefined && price !== existingPackage.price / 100 && existingPackage.stripeProductId) {
      try {
        const newStripePrice = await stripe.prices.create({
          product: existingPackage.stripeProductId,
          unit_amount: Math.round(price * 100),
          currency: 'usd',
          metadata: {
            credits: (credits || existingPackage.credits).toString(),
            packageId: id
          }
        });

        // Archive old price
        if (existingPackage.stripePriceId) {
          await stripe.prices.update(existingPackage.stripePriceId, {
            active: false
          });
        }

        // Update package with new price ID
        await prisma.creditPackage.update({
          where: { id },
          data: { stripePriceId: newStripePrice.id }
        });

        updatedPackage.stripePriceId = newStripePrice.id;
      } catch (stripeError) {
        console.error('Failed to update Stripe price:', stripeError);
        // Continue even if Stripe update fails
      }
    }

    // Log the action
    await AuditLogger.log({
      action: 'UPDATE_CREDIT_PACKAGE',
      userId: req.admin.id,
      targetType: 'CreditPackage',
      targetId: id,
      details: {
        changes: updateData,
        previousValues: {
          name: existingPackage.name,
          credits: existingPackage.credits,
          price: existingPackage.price / 100,
          isActive: existingPackage.isActive
        }
      },
      ipAddress: req.ip
    });

    res.json(updatedPackage);
  } catch (error) {
    console.error('Error updating package:', error);
    res.status(500).json({ error: error.message || 'Failed to update package' });
  }
});

// Delete package (soft delete by deactivating)
router.delete('/:id', authenticateAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    // Check if package exists
    const existingPackage = await prisma.creditPackage.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            Transaction: true
          }
        }
      }
    });

    if (!existingPackage) {
      return res.status(404).json({ error: 'Package not found' });
    }

    // Don't allow deletion if there are transactions
    if (existingPackage._count.Transaction > 0) {
      return res.status(400).json({ 
        error: 'Cannot delete package with transaction history. Deactivate it instead.' 
      });
    }

    // Deactivate in Stripe
    if (existingPackage.stripePriceId) {
      try {
        await stripe.prices.update(existingPackage.stripePriceId, {
          active: false
        });
      } catch (stripeError) {
        console.error('Failed to deactivate Stripe price:', stripeError);
      }
    }

    if (existingPackage.stripeProductId) {
      try {
        await stripe.products.update(existingPackage.stripeProductId, {
          active: false
        });
      } catch (stripeError) {
        console.error('Failed to deactivate Stripe product:', stripeError);
      }
    }

    // Delete from database
    await prisma.creditPackage.delete({
      where: { id }
    });

    // Log the action
    await AuditLogger.log({
      action: 'DELETE_CREDIT_PACKAGE',
      userId: req.admin.id,
      targetType: 'CreditPackage',
      targetId: id,
      details: {
        name: existingPackage.name,
        credits: existingPackage.credits,
        price: existingPackage.price / 100
      },
      ipAddress: req.ip
    });

    res.json({ message: 'Package deleted successfully' });
  } catch (error) {
    console.error('Error deleting package:', error);
    res.status(500).json({ error: 'Failed to delete package' });
  }
});

// Reorder packages
router.post('/reorder', authenticateAdmin, async (req, res) => {
  try {
    const { packages } = req.body;

    if (!Array.isArray(packages)) {
      return res.status(400).json({ error: 'Packages array is required' });
    }

    // Update display order for each package
    const updates = packages.map((pkg, index) => 
      prisma.creditPackage.update({
        where: { id: pkg.id },
        data: { displayOrder: index }
      })
    );

    await Promise.all(updates);

    // Log the action
    await AuditLogger.log({
      action: 'REORDER_CREDIT_PACKAGES',
      userId: req.admin.id,
      targetType: 'CreditPackage',
      details: {
        packageOrder: packages.map(p => ({ id: p.id, order: p.displayOrder }))
      },
      ipAddress: req.ip
    });

    res.json({ message: 'Packages reordered successfully' });
  } catch (error) {
    console.error('Error reordering packages:', error);
    res.status(500).json({ error: 'Failed to reorder packages' });
  }
});

export default router;