import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Card, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { CheckCircle, Loader2, XCircle, Receipt, CreditCard } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

export function CheckoutSuccess() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { token, refreshUser } = useAuth();
  const [loading, setLoading] = useState(true);
  const [success, setSuccess] = useState(false);
  const [transaction, setTransaction] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    const sessionId = searchParams.get('session_id');
    if (sessionId) {
      verifyPayment(sessionId);
    } else {
      setError('No session ID provided');
      setLoading(false);
    }
  }, [searchParams]);

  const verifyPayment = async (sessionId) => {
    try {
      const response = await fetch(
        `${import.meta.env.VITE_API_URL}/api/payments/success?session_id=${sessionId}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error('Failed to verify payment');
      }

      const data = await response.json();
      
      if (data.success) {
        setSuccess(true);
        setTransaction(data.transaction);
        
        // Refresh user data to update credits
        if (refreshUser) {
          await refreshUser();
        }
      } else {
        throw new Error('Payment verification failed');
      }
    } catch (err) {
      console.error('Error verifying payment:', err);
      setError(err.message || 'Failed to verify payment');
    } finally {
      setLoading(false);
    }
  };

  const formatPrice = (priceInCents) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(priceInCents / 100);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="flex flex-col items-center text-center">
              <Loader2 className="h-12 w-12 animate-spin text-emerald-600 mb-4" />
              <h2 className="text-xl font-semibold mb-2 text-gray-900 dark:text-gray-100">Verifying your payment...</h2>
              <p className="text-gray-600 dark:text-gray-400">Please wait while we confirm your purchase.</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="flex flex-col items-center text-center">
              <XCircle className="h-12 w-12 text-red-500 mb-4" />
              <h2 className="text-xl font-semibold mb-2 text-gray-900 dark:text-gray-100">Payment Error</h2>
              <p className="text-gray-600 dark:text-gray-400 mb-6">{error}</p>
              <Button 
                type="button"
                onClick={() => navigate('/')}
                className="bg-emerald-600 hover:bg-emerald-700"
              >
                Return to Dashboard
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (success && transaction) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="flex flex-col items-center text-center">
              <CheckCircle className="h-12 w-12 text-emerald-600 mb-4" />
              <h2 className="text-2xl font-semibold mb-2 text-gray-900 dark:text-gray-100">Payment Successful!</h2>
              <p className="text-gray-600 dark:text-gray-400 mb-6">
                Your credits have been added to your account.
              </p>

              <div className="w-full bg-gray-50 dark:bg-gray-800 rounded-lg p-4 mb-6">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Package</span>
                    <span className="font-medium text-gray-900 dark:text-gray-100">{transaction.package?.name}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Credits Added</span>
                    <span className="font-medium text-emerald-600 dark:text-emerald-400">
                      +{transaction.credits.toLocaleString()} credits
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Amount Paid</span>
                    <span className="font-medium text-gray-900 dark:text-gray-100">{formatPrice(transaction.amount)}</span>
                  </div>
                  <div className="flex items-center justify-between pt-3 border-t border-gray-200 dark:border-gray-700">
                    <span className="text-gray-600 dark:text-gray-400">Transaction ID</span>
                    <span className="font-mono text-sm text-gray-900 dark:text-gray-100">{transaction.id.slice(0, 8)}</span>
                  </div>
                </div>
              </div>

              <div className="flex gap-3 w-full">
                <Button 
                  type="button"
                  variant="outline"
                  onClick={() => navigate('/history')}
                  className="flex-1"
                >
                  <Receipt className="h-4 w-4 mr-2" />
                  View History
                </Button>
                <Button 
                  type="button"
                  onClick={() => navigate('/')}
                  className="flex-1 bg-emerald-600 hover:bg-emerald-700"
                >
                  <CreditCard className="h-4 w-4 mr-2" />
                  Start Processing
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return null;
}