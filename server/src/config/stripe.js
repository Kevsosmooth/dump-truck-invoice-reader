import Stripe from 'stripe';

// Initialize Stripe with the secret key
export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2023-10-16',
});

// Webhook endpoint secret for verifying signatures
export const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || '';

// Stripe configuration
export const stripeConfig = {
  currency: 'usd',
  successUrl: process.env.STRIPE_SUCCESS_URL || 'http://localhost:5173/checkout/success?session_id={CHECKOUT_SESSION_ID}',
  cancelUrl: process.env.STRIPE_CANCEL_URL || 'http://localhost:5173/checkout/cancel',
  
  // Webhook events we want to handle
  webhookEvents: [
    'checkout.session.completed',
    'payment_intent.succeeded',
    'payment_intent.payment_failed',
    'charge.refunded',
    'customer.created',
    'payment_method.attached',
  ],
  
  // Default metadata to include with all transactions
  defaultMetadata: {
    app: 'dump-truck-invoice-reader',
    version: '1.0.0',
  },
};

// Helper function to format amount for Stripe (convert dollars to cents)
export const formatAmountForStripe = (amount) => {
  return Math.round(amount * 100);
};

// Helper function to format amount from Stripe (convert cents to dollars)
export const formatAmountFromStripe = (amount) => {
  return amount / 100;
};