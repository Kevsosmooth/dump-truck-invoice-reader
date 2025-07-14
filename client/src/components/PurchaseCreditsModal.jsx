import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { Button } from './ui/button';
import { Card, CardContent } from './ui/card';
import { Loader2, Check, CreditCard, Package } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
// Lazy load Stripe to avoid import errors
let loadStripe = null;
let stripePromise = null;

// Try to import Stripe dynamically
const initStripe = async () => {
  if (!loadStripe) {
    try {
      const stripeModule = await import('@stripe/stripe-js');
      loadStripe = stripeModule.loadStripe;
      stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY);
    } catch (error) {
      console.error('Stripe.js not installed. Run: npm install @stripe/stripe-js');
      throw error;
    }
  }
  return stripePromise;
};

export function PurchaseCreditsModal({ isOpen, onClose, onSuccess }) {
  const { token } = useAuth();
  const [packages, setPackages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedPackage, setSelectedPackage] = useState(null);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState(null);
  
  console.log('PurchaseCreditsModal render, isOpen:', isOpen);

  // Fetch available packages
  useEffect(() => {
    if (isOpen) {
      fetchPackages();
    }
  }, [isOpen]);

  const fetchPackages = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/payments/packages`);
      if (!response.ok) {
        throw new Error('Failed to fetch packages');
      }
      
      const data = await response.json();
      setPackages(data);
      
      // Auto-select the middle package (best value)
      if (data.length > 0) {
        const middleIndex = Math.floor(data.length / 2);
        setSelectedPackage(data[middleIndex].id);
      }
    } catch (err) {
      console.error('Error fetching packages:', err);
      setError('Failed to load credit packages. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handlePurchase = async () => {
    if (!selectedPackage) return;

    try {
      setProcessing(true);
      setError(null);

      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/payments/create-checkout-session`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ packageId: selectedPackage }),
      });

      if (!response.ok) {
        const data = await response.json();
        console.error('Checkout session error:', response.status, data);
        throw new Error(data.error || 'Failed to create checkout session');
      }

      const { sessionId } = await response.json();

      // Redirect to Stripe Checkout
      const stripe = await initStripe();
      const { error } = await stripe.redirectToCheckout({ sessionId });

      if (error) {
        throw error;
      }
    } catch (err) {
      console.error('Error processing purchase:', err);
      setError(err.message || 'Failed to process purchase. Please try again.');
      setProcessing(false);
    }
  };

  const formatPrice = (priceInCents) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(priceInCents / 100);
  };

  const getPricePerCredit = (price, credits) => {
    const pricePerCredit = price / credits;
    return `${formatPrice(pricePerCredit)} per credit`;
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="text-2xl text-gray-900 dark:text-gray-100">Purchase Credits</DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-gray-500 dark:text-gray-400" />
          </div>
        ) : error ? (
          <div className="py-8">
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
              <p className="text-red-800 dark:text-red-200">{error}</p>
            </div>
            <div className="flex justify-end mt-4">
              <Button variant="outline" onClick={onClose}>
                Close
              </Button>
            </div>
          </div>
        ) : (
          <>
            <div className="grid md:grid-cols-3 gap-4 mb-6">
              {packages.map((pkg) => (
                <Card 
                  key={pkg.id}
                  className={`cursor-pointer transition-all ${
                    selectedPackage === pkg.id 
                      ? 'ring-2 ring-emerald-600 shadow-lg dark:ring-emerald-500' 
                      : 'hover:shadow-md dark:hover:shadow-gray-700'
                  }`}
                  onClick={() => setSelectedPackage(pkg.id)}
                >
                  <CardContent className="p-6">
                    <div className="flex justify-between items-start mb-4">
                      <Package className="h-8 w-8 text-emerald-600 dark:text-emerald-500" />
                      {selectedPackage === pkg.id && (
                        <Check className="h-5 w-5 text-emerald-600 dark:text-emerald-500" />
                      )}
                    </div>
                    
                    <h3 className="font-semibold text-lg mb-2 text-gray-900 dark:text-gray-100">{pkg.name}</h3>
                    {pkg.description && (
                      <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">{pkg.description}</p>
                    )}
                    
                    <div className="space-y-2">
                      <div className="text-3xl font-bold text-gray-900 dark:text-gray-100">
                        {formatPrice(pkg.price)}
                      </div>
                      <div className="text-lg font-medium text-emerald-600 dark:text-emerald-500">
                        {pkg.credits.toLocaleString()} credits
                      </div>
                      <div className="text-sm text-gray-500 dark:text-gray-400">
                        {getPricePerCredit(pkg.price, pkg.credits)}
                      </div>
                    </div>

                    {/* Show best value badge for middle package */}
                    {packages.length === 3 && packages[1].id === pkg.id && (
                      <div className="mt-4">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-100 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-300">
                          Best Value
                        </span>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>

            <div className="border-t dark:border-gray-700 pt-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Selected package</p>
                  <p className="font-semibold text-gray-900 dark:text-gray-100">
                    {packages.find(p => p.id === selectedPackage)?.name}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-gray-600 dark:text-gray-400">Total</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                    {formatPrice(packages.find(p => p.id === selectedPackage)?.price || 0)}
                  </p>
                </div>
              </div>

              <div className="flex gap-3">
                <Button
                  variant="outline"
                  onClick={onClose}
                  disabled={processing}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handlePurchase}
                  disabled={!selectedPackage || processing}
                  className="flex-1 bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-600 dark:hover:bg-emerald-700 text-white"
                >
                  {processing ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <CreditCard className="h-4 w-4 mr-2" />
                      Purchase Credits
                    </>
                  )}
                </Button>
              </div>

              <div className="mt-4 text-center">
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Secure payment powered by Stripe. Your payment information is never stored on our servers.
                </p>
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}