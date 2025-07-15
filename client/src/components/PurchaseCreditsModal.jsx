import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { Button } from './ui/button';
import { Card, CardContent } from './ui/card';
import { Loader2, Check, CreditCard, Package, ChevronLeft, ChevronRight } from 'lucide-react';
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
  const [currentPage, setCurrentPage] = useState(0);
  
  // Responsive packages per page based on screen size
  const getPackagesPerPage = () => {
    if (typeof window !== 'undefined') {
      if (window.innerWidth < 640) return 1; // mobile
      if (window.innerWidth < 768) return 2; // tablet
      return 3; // desktop
    }
    return 3;
  };
  
  const [packagesPerPage, setPackagesPerPage] = useState(getPackagesPerPage());
  const [touchStart, setTouchStart] = useState(0);
  const [touchEnd, setTouchEnd] = useState(0);
  
  console.log('PurchaseCreditsModal render, isOpen:', isOpen);

  // Fetch available packages
  useEffect(() => {
    if (isOpen) {
      fetchPackages();
    }
  }, [isOpen]);

  // Handle window resize for responsive packages per page
  useEffect(() => {
    const handleResize = () => {
      const newPackagesPerPage = getPackagesPerPage();
      if (newPackagesPerPage !== packagesPerPage) {
        setPackagesPerPage(newPackagesPerPage);
        // Reset to first page to avoid out of bounds
        setCurrentPage(0);
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [packagesPerPage]);

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
      
      // Reset to first page when packages change
      setCurrentPage(0);
      
      // Auto-select the first package on the first page
      if (data.length > 0) {
        setSelectedPackage(data[0].id);
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

  // Calculate pagination
  const totalPages = Math.ceil(packages.length / packagesPerPage);
  const startIndex = currentPage * packagesPerPage;
  const endIndex = startIndex + packagesPerPage;
  const currentPackages = packages.slice(startIndex, endIndex);

  const goToNextPage = () => {
    if (currentPage < totalPages - 1) {
      setCurrentPage(currentPage + 1);
    }
  };

  const goToPreviousPage = () => {
    if (currentPage > 0) {
      setCurrentPage(currentPage - 1);
    }
  };

  // Touch handlers for swipe
  const handleTouchStart = (e) => {
    setTouchStart(e.targetTouches[0].clientX);
  };

  const handleTouchMove = (e) => {
    setTouchEnd(e.targetTouches[0].clientX);
  };

  const handleTouchEnd = () => {
    if (!touchStart || !touchEnd) return;
    
    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > 50;
    const isRightSwipe = distance < -50;

    if (isLeftSwipe && currentPage < totalPages - 1) {
      goToNextPage();
    }
    if (isRightSwipe && currentPage > 0) {
      goToPreviousPage();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl w-[95vw] sm:w-full max-h-[90vh] overflow-hidden">
        
        <DialogHeader className="px-4 sm:px-6">
          <DialogTitle className="text-xl sm:text-2xl text-gray-900 dark:text-gray-100">Purchase Credits</DialogTitle>
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
            <div className="relative">
              {/* Desktop Arrow Buttons */}
              {totalPages > 1 && (
                <>
                  {currentPage > 0 && (
                    <button
                      onClick={goToPreviousPage}
                      className="hidden md:block absolute left-2 top-1/2 -translate-y-1/2 z-10 p-2 rounded-full bg-white/90 dark:bg-gray-800/90 shadow-lg hover:shadow-xl hover:scale-105 transition-all border border-gray-200 dark:border-gray-700 group"
                      aria-label="Previous packages"
                    >
                      <ChevronLeft className="h-5 w-5 text-gray-600 dark:text-gray-400 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors" />
                    </button>
                  )}
                  {currentPage < totalPages - 1 && (
                    <button
                      onClick={goToNextPage}
                      className="hidden md:block absolute right-2 top-1/2 -translate-y-1/2 z-10 p-2 rounded-full bg-white/90 dark:bg-gray-800/90 shadow-lg hover:shadow-xl hover:scale-105 transition-all border border-gray-200 dark:border-gray-700 group"
                      aria-label="Next packages"
                    >
                      <ChevronRight className="h-5 w-5 text-gray-600 dark:text-gray-400 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors" />
                    </button>
                  )}
                </>
              )}
              <div className="overflow-hidden">
                <div 
                  className="flex transition-transform duration-500 ease-in-out"
                  style={{ transform: `translateX(-${currentPage * 100}%)` }}
                  onTouchStart={handleTouchStart}
                  onTouchMove={handleTouchMove}
                  onTouchEnd={handleTouchEnd}
                >
                  {Array.from({ length: totalPages }, (_, pageIndex) => (
                    <div key={pageIndex} className="w-full flex-shrink-0">
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                        {packages.slice(pageIndex * packagesPerPage, (pageIndex + 1) * packagesPerPage).map((pkg) => (
                <Card 
                  key={pkg.id}
                  className={`cursor-pointer transition-all transform hover:scale-105 ${
                    selectedPackage === pkg.id 
                      ? 'ring-2 ring-emerald-600 shadow-lg dark:ring-emerald-500 scale-105' 
                      : 'hover:shadow-md dark:hover:shadow-gray-700'
                  }`}
                  onClick={() => setSelectedPackage(pkg.id)}
                >
                  <CardContent className="p-6 relative">
                    {selectedPackage === pkg.id && (
                      <div className="absolute top-2 right-2">
                        <Check className="h-5 w-5 text-emerald-600 dark:text-emerald-500" />
                      </div>
                    )}
                    <div className="flex justify-center mb-4">
                      <Package className="h-8 w-8 text-emerald-600 dark:text-emerald-500" />
                    </div>
                    
                    <h3 className="font-semibold text-lg mb-2 text-gray-900 dark:text-gray-100 text-center">{pkg.name}</h3>
                    {pkg.description && (
                      <p className="text-sm text-gray-600 dark:text-gray-400 mb-4 text-center">{pkg.description}</p>
                    )}
                    
                    <div className="space-y-2 text-center">
                      <div className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-gray-100">
                        {formatPrice(pkg.price)}
                      </div>
                      <div className="text-base sm:text-lg font-medium text-emerald-600 dark:text-emerald-500">
                        {pkg.credits.toLocaleString()} credits
                      </div>
                      <div className="text-sm text-gray-500 dark:text-gray-400">
                        {getPricePerCredit(pkg.price, pkg.credits)}
                      </div>
                    </div>

                  </CardContent>
                </Card>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Mobile Navigation */}
            {totalPages > 1 && (
              <div className="sm:hidden flex items-center justify-between px-4 py-2 mb-4">
                <button
                  onClick={goToPreviousPage}
                  disabled={currentPage === 0}
                  className={`p-2 rounded-lg ${
                    currentPage === 0 
                      ? 'text-gray-400 dark:text-gray-600' 
                      : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
                  }`}
                  aria-label="Previous packages"
                >
                  <ChevronLeft className="h-5 w-5" />
                </button>
                
                <div className="flex gap-2">
                  {Array.from({ length: totalPages }, (_, i) => (
                    <button
                      key={i}
                      onClick={() => setCurrentPage(i)}
                      className={`h-2 w-2 rounded-full transition-all ${
                        currentPage === i 
                          ? 'bg-emerald-600 dark:bg-emerald-500 w-6' 
                          : 'bg-gray-300 dark:bg-gray-600'
                      }`}
                      aria-label={`Go to page ${i + 1}`}
                    />
                  ))}
                </div>
                
                <button
                  onClick={goToNextPage}
                  disabled={currentPage === totalPages - 1}
                  className={`p-2 rounded-lg ${
                    currentPage === totalPages - 1 
                      ? 'text-gray-400 dark:text-gray-600' 
                      : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
                  }`}
                  aria-label="Next packages"
                >
                  <ChevronRight className="h-5 w-5" />
                </button>
              </div>
            )}

            {/* Page Indicators - Desktop only */}
            {totalPages > 1 && (
              <div className="hidden sm:flex justify-center gap-2 mb-6">
                {Array.from({ length: totalPages }, (_, i) => (
                  <button
                    key={i}
                    onClick={() => setCurrentPage(i)}
                    className={`h-2 w-2 rounded-full transition-all ${
                      currentPage === i 
                        ? 'bg-emerald-600 dark:bg-emerald-500 w-8' 
                        : 'bg-gray-300 dark:bg-gray-600 hover:bg-gray-400 dark:hover:bg-gray-500'
                    }`}
                    aria-label={`Go to page ${i + 1}`}
                  />
                ))}
              </div>
            )}

            <div className="border-t dark:border-gray-700 pt-6">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-4 gap-2 sm:gap-0">
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Selected package</p>
                  <p className="font-semibold text-gray-900 dark:text-gray-100">
                    {packages.find(p => p.id === selectedPackage)?.name}
                  </p>
                </div>
                <div className="sm:text-right">
                  <p className="text-sm text-gray-600 dark:text-gray-400">Total</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                    {formatPrice(packages.find(p => p.id === selectedPackage)?.price || 0)}
                  </p>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-3">
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