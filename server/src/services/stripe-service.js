import { PrismaClient } from '@prisma/client';
import { stripe, stripeConfig } from '../config/stripe.js';

const prisma = new PrismaClient();

export class StripeService {
  /**
   * Sync credit packages with Stripe products and prices
   */
  async syncPackages() {
    try {
      const packages = await prisma.creditPackage.findMany({
        where: { isActive: true },
        orderBy: { displayOrder: 'asc' }
      });

      for (const pkg of packages) {
        // Create or update Stripe product if not exists
        if (!pkg.stripeProductId) {
          const product = await stripe.products.create({
            name: pkg.name,
            description: pkg.description,
            metadata: {
              packageId: pkg.id,
              credits: pkg.credits.toString(),
            },
          });

          // Create price for the product
          const price = await stripe.prices.create({
            product: product.id,
            unit_amount: pkg.price,
            currency: stripeConfig.currency,
            metadata: {
              packageId: pkg.id,
            },
          });

          // Update package with Stripe IDs
          await prisma.creditPackage.update({
            where: { id: pkg.id },
            data: {
              stripeProductId: product.id,
              stripePriceId: price.id,
            },
          });
        }
      }

      return packages;
    } catch (error) {
      console.error('Error syncing packages with Stripe:', error);
      throw error;
    }
  }

  /**
   * Create a Stripe checkout session
   */
  async createCheckoutSession(userId, packageId, urls = {}) {
    try {
      // Get the package
      const creditPackage = await prisma.creditPackage.findUnique({
        where: { id: packageId },
      });

      if (!creditPackage || !creditPackage.isActive) {
        throw new Error('Invalid or inactive package');
      }

      // Get user
      const user = await prisma.user.findUnique({
        where: { id: userId },
      });

      if (!user) {
        throw new Error('User not found');
      }

      // Ensure package has Stripe IDs
      if (!creditPackage.stripePriceId) {
        await this.syncPackages();
        const updatedPackage = await prisma.creditPackage.findUnique({
          where: { id: packageId },
        });
        creditPackage.stripePriceId = updatedPackage.stripePriceId;
      }

      // Create checkout session
      const successUrl = urls.successUrl || stripeConfig.successUrl;
      const cancelUrl = urls.cancelUrl || stripeConfig.cancelUrl;
      
      console.log('Creating checkout session with URLs:', {
        successUrl,
        cancelUrl,
        envSuccessUrl: process.env.STRIPE_SUCCESS_URL,
        configSuccessUrl: stripeConfig.successUrl
      });
      
      const session = await stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        mode: 'payment',
        customer_email: user.email,
        client_reference_id: userId.toString(),
        line_items: [
          {
            price: creditPackage.stripePriceId,
            quantity: 1,
          },
        ],
        success_url: successUrl,
        cancel_url: cancelUrl,
        metadata: {
          ...stripeConfig.defaultMetadata,
          userId: userId.toString(),
          packageId: packageId,
          credits: creditPackage.credits.toString(),
        },
        payment_intent_data: {
          metadata: {
            ...stripeConfig.defaultMetadata,
            userId: userId.toString(),
            packageId: packageId,
          },
        },
      });

      // Create pending transaction
      await prisma.transaction.create({
        data: {
          userId: userId,
          type: 'PURCHASE',
          amount: creditPackage.price,
          credits: creditPackage.credits,
          status: 'PENDING',
          packageId: packageId,
          stripePaymentIntentId: session.payment_intent || null,
          description: `Purchase of ${creditPackage.name}`,
          metadata: {
            checkoutSessionId: session.id,
            packageName: creditPackage.name,
          },
        },
      });

      return session;
    } catch (error) {
      console.error('Error creating checkout session:', error);
      throw error;
    }
  }

  /**
   * Handle successful payment from webhook
   */
  async handlePaymentSuccess(session) {
    try {
      const { 
        payment_intent: paymentIntentId,
        client_reference_id: userId,
        metadata,
        customer_details,
        payment_method_types,
        amount_total,
      } = session;

      // Find the pending transaction - try by payment intent first, then by session ID
      let transaction = await prisma.transaction.findFirst({
        where: {
          stripePaymentIntentId: paymentIntentId,
          status: 'PENDING',
        },
      });

      // If not found by payment intent, try finding by session ID in metadata
      if (!transaction) {
        transaction = await prisma.transaction.findFirst({
          where: {
            status: 'PENDING',
            metadata: {
              path: ['checkoutSessionId'],
              equals: session.id,
            },
          },
        });
      }

      if (!transaction) {
        console.error('Transaction not found for session:', session.id, 'payment intent:', paymentIntentId);
        return;
      }

      // Start a transaction to update credits and transaction status
      const result = await prisma.$transaction(async (tx) => {
        // Update user credits
        const updatedUser = await tx.user.update({
          where: { id: transaction.userId },
          data: {
            credits: {
              increment: transaction.credits,
            },
          },
        });

        // Update transaction status
        const updatedTransaction = await tx.transaction.update({
          where: { id: transaction.id },
          data: {
            status: 'COMPLETED',
            stripePaymentIntentId: paymentIntentId, // Update payment intent ID
            metadata: {
              ...transaction.metadata,
              customerEmail: customer_details?.email,
              paymentMethod: payment_method_types?.[0],
              completedAt: new Date().toISOString(),
            },
          },
        });

        // Create audit log entry
        await tx.auditLog.create({
          data: {
            userId: transaction.userId,
            eventType: 'CREDIT_PURCHASE',
            eventData: {
              transactionId: transaction.id,
              credits: transaction.credits,
              amount: amount_total,
              packageId: metadata?.packageId,
              paymentIntentId: paymentIntentId,
            },
          },
        });

        return { user: updatedUser, transaction: updatedTransaction };
      });

      console.log(`Successfully processed payment for user ${result.user.id}, added ${transaction.credits} credits`);
      return result;
    } catch (error) {
      console.error('Error handling payment success:', error);
      throw error;
    }
  }

  /**
   * Save payment method for quick reorders
   */
  async savePaymentMethod(userId, paymentMethodId) {
    try {
      // Retrieve payment method from Stripe
      const paymentMethod = await stripe.paymentMethods.retrieve(paymentMethodId);

      // Check if this payment method already exists
      const existingMethod = await prisma.paymentMethod.findUnique({
        where: { stripePaymentMethodId: paymentMethodId },
      });

      if (existingMethod) {
        return existingMethod;
      }

      // If this is the first payment method, make it default
      const userPaymentMethods = await prisma.paymentMethod.count({
        where: { userId: userId },
      });

      const isDefault = userPaymentMethods === 0;

      // Save payment method
      const savedMethod = await prisma.paymentMethod.create({
        data: {
          userId: userId,
          stripePaymentMethodId: paymentMethodId,
          type: paymentMethod.type,
          last4: paymentMethod.card?.last4 || '****',
          brand: paymentMethod.card?.brand,
          expiryMonth: paymentMethod.card?.exp_month,
          expiryYear: paymentMethod.card?.exp_year,
          isDefault: isDefault,
        },
      });

      return savedMethod;
    } catch (error) {
      console.error('Error saving payment method:', error);
      throw error;
    }
  }

  /**
   * Process a quick reorder using saved payment method
   */
  async processReorder(userId, packageId, paymentMethodId, ipAddress, userAgent) {
    try {
      // Validate package
      const creditPackage = await prisma.creditPackage.findUnique({
        where: { id: packageId },
      });

      if (!creditPackage || !creditPackage.isActive) {
        throw new Error('Invalid or inactive package');
      }

      // Validate payment method belongs to user
      const paymentMethod = await prisma.paymentMethod.findFirst({
        where: {
          id: paymentMethodId,
          userId: userId,
        },
      });

      if (!paymentMethod) {
        throw new Error('Invalid payment method');
      }

      // Get user
      const user = await prisma.user.findUnique({
        where: { id: userId },
      });

      // Create payment intent
      const paymentIntent = await stripe.paymentIntents.create({
        amount: creditPackage.price,
        currency: stripeConfig.currency,
        customer: user.email,
        payment_method: paymentMethod.stripePaymentMethodId,
        confirm: true,
        metadata: {
          ...stripeConfig.defaultMetadata,
          userId: userId.toString(),
          packageId: packageId,
          credits: creditPackage.credits.toString(),
        },
      });

      // Create transaction
      const transaction = await prisma.transaction.create({
        data: {
          userId: userId,
          type: 'PURCHASE',
          amount: creditPackage.price,
          credits: creditPackage.credits,
          status: paymentIntent.status === 'succeeded' ? 'COMPLETED' : 'PENDING',
          packageId: packageId,
          paymentMethodId: paymentMethodId,
          stripePaymentIntentId: paymentIntent.id,
          ipAddress: ipAddress,
          userAgent: userAgent,
          description: `Reorder of ${creditPackage.name}`,
          metadata: {
            reorder: true,
            packageName: creditPackage.name,
          },
        },
      });

      // If payment succeeded immediately, add credits
      if (paymentIntent.status === 'succeeded') {
        await prisma.$transaction(async (tx) => {
          // Update user credits
          await tx.user.update({
            where: { id: userId },
            data: {
              credits: {
                increment: creditPackage.credits,
              },
            },
          });

          // Create audit log
          await tx.auditLog.create({
            data: {
              userId: userId,
              eventType: 'CREDIT_PURCHASE',
              eventData: {
                transactionId: transaction.id,
                credits: creditPackage.credits,
                amount: creditPackage.price,
                packageId: packageId,
                paymentIntentId: paymentIntent.id,
                reorder: true,
              },
              ipAddress: ipAddress,
              userAgent: userAgent,
            },
          });
        });
      }

      return transaction;
    } catch (error) {
      console.error('Error processing reorder:', error);
      throw error;
    }
  }

  /**
   * Handle webhook events
   */
  async handleWebhookEvent(event) {
    try {
      switch (event.type) {
        case 'checkout.session.completed':
          await this.handlePaymentSuccess(event.data.object);
          break;

        case 'payment_intent.succeeded':
          // Handle reorder payment success
          const paymentIntent = event.data.object;
          const transaction = await prisma.transaction.findFirst({
            where: {
              stripePaymentIntentId: paymentIntent.id,
              status: 'PENDING',
            },
          });

          if (transaction) {
            await prisma.$transaction(async (tx) => {
              // Update transaction status
              await tx.transaction.update({
                where: { id: transaction.id },
                data: { status: 'COMPLETED' },
              });

              // Update user credits
              await tx.user.update({
                where: { id: transaction.userId },
                data: {
                  credits: {
                    increment: transaction.credits,
                  },
                },
              });

              // Create audit log
              await tx.auditLog.create({
                data: {
                  userId: transaction.userId,
                  eventType: 'CREDIT_PURCHASE',
                  eventData: {
                    transactionId: transaction.id,
                    credits: transaction.credits,
                    amount: paymentIntent.amount,
                    paymentIntentId: paymentIntent.id,
                  },
                  ipAddress: transaction.ipAddress,
                  userAgent: transaction.userAgent,
                },
              });
            });
          }
          break;

        case 'payment_intent.payment_failed':
          // Handle payment failure
          const failedIntent = event.data.object;
          await prisma.transaction.updateMany({
            where: {
              stripePaymentIntentId: failedIntent.id,
              status: 'PENDING',
            },
            data: {
              status: 'FAILED',
              metadata: {
                failureReason: failedIntent.last_payment_error?.message,
                failedAt: new Date().toISOString(),
              },
            },
          });
          break;

        case 'charge.refunded':
          // Handle refunds
          const charge = event.data.object;
          const refundTransaction = await prisma.transaction.findFirst({
            where: {
              stripePaymentIntentId: charge.payment_intent,
              status: 'COMPLETED',
            },
          });

          if (refundTransaction) {
            // Create refund transaction
            await prisma.transaction.create({
              data: {
                userId: refundTransaction.userId,
                type: 'REFUND',
                amount: -charge.amount_refunded,
                credits: -refundTransaction.credits,
                status: 'COMPLETED',
                stripePaymentIntentId: charge.payment_intent,
                description: `Refund for ${refundTransaction.description}`,
                metadata: {
                  originalTransactionId: refundTransaction.id,
                  refundId: charge.refunds.data[0]?.id,
                },
              },
            });

            // Deduct credits from user
            await prisma.user.update({
              where: { id: refundTransaction.userId },
              data: {
                credits: {
                  decrement: refundTransaction.credits,
                },
              },
            });
          }
          break;

        case 'payment_method.attached':
          // Save payment method when attached to customer
          const attachedMethod = event.data.object;
          if (attachedMethod.customer) {
            // Find user by customer email
            const customer = await stripe.customers.retrieve(attachedMethod.customer);
            const user = await prisma.user.findUnique({
              where: { email: customer.email },
            });
            
            if (user) {
              await this.savePaymentMethod(user.id, attachedMethod.id);
            }
          }
          break;

        default:
          // Only log unhandled events we might want to handle in the future
          const importantEvents = [
            'invoice.payment_succeeded',
            'customer.subscription.created',
            'customer.subscription.deleted'
          ];
          
          if (importantEvents.includes(event.type)) {
            console.log(`Unhandled webhook event type: ${event.type}`);
          }
          // Silently ignore common events we don't need to handle:
          // - charge.succeeded (we handle checkout.session.completed instead)
          // - payment_intent.created (just informational)
          // - payment_intent.succeeded (we handle checkout.session.completed instead)
      }
    } catch (error) {
      console.error(`Error handling webhook event ${event.type}:`, error);
      throw error;
    }
  }
}

// Export singleton instance
export const stripeService = new StripeService();