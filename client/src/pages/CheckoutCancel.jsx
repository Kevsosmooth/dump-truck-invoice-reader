import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { XCircle, ShoppingCart, ArrowLeft } from 'lucide-react';

export function CheckoutCancel() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <Card className="w-full max-w-md">
        <CardContent className="pt-6">
          <div className="flex flex-col items-center text-center">
            <XCircle className="h-12 w-12 text-gray-400 mb-4" />
            <h2 className="text-2xl font-semibold mb-2">Purchase Cancelled</h2>
            <p className="text-gray-600 mb-6">
              Your purchase was cancelled and you were not charged.
              You can return to purchase credits at any time.
            </p>

            <div className="flex gap-3 w-full">
              <Button 
                variant="outline"
                onClick={() => navigate('/')}
                className="flex-1"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Return to Dashboard
              </Button>
              <Button 
                onClick={() => navigate('/?purchase=true')}
                className="flex-1 bg-emerald-600 hover:bg-emerald-700"
              >
                <ShoppingCart className="h-4 w-4 mr-2" />
                Try Again
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}