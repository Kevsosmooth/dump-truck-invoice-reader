import { useState, useEffect } from 'react';
import { adminAPI } from '@/config/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { CreditCard, TrendingUp, Package, Users, AlertCircle, Plus, Minus } from 'lucide-react';
import { toast } from 'sonner';

export default function Credits() {
  const [creditStats, setCreditStats] = useState({
    totalCreditsInSystem: 0,
    totalCreditsUsed: 0,
    totalRevenue: 0,
    averageCreditsPerUser: 0
  });
  const [creditPackages, setCreditPackages] = useState([]);
  const [bulkUsers, setBulkUsers] = useState('');
  const [bulkAction, setBulkAction] = useState('add');
  const [bulkAmount, setBulkAmount] = useState('');
  const [bulkReason, setBulkReason] = useState('');
  const [showBulkDialog, setShowBulkDialog] = useState(false);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    fetchCreditData();
  }, []);

  const fetchCreditData = async () => {
    try {
      setLoading(true);
      const [statsResponse, packagesResponse] = await Promise.all([
        adminAPI.get('/credits/stats'),
        adminAPI.get('/credits/packages')
      ]);

      setCreditStats(statsResponse.data);
      setCreditPackages(packagesResponse.data);
    } catch (error) {
      console.error('Failed to fetch credit data:', error);
      toast.error('Failed to load credit information');
    } finally {
      setLoading(false);
    }
  };

  const handleBulkOperation = async () => {
    if (!bulkUsers.trim() || !bulkAmount || !bulkReason.trim()) {
      toast.error('Please fill in all fields');
      return;
    }

    // Parse user emails
    const emails = bulkUsers.split('\n').map(email => email.trim()).filter(email => email);
    
    if (emails.length === 0) {
      toast.error('Please enter at least one email address');
      return;
    }

    const amount = parseInt(bulkAmount);
    if (isNaN(amount) || amount <= 0) {
      toast.error('Please enter a valid credit amount');
      return;
    }

    try {
      setProcessing(true);
      const response = await adminAPI.post('/credits/bulk-operation', {
        emails,
        action: bulkAction,
        amount,
        reason: bulkReason
      });

      toast.success(`Successfully processed ${response.data.processed} users`);
      
      if (response.data.errors && response.data.errors.length > 0) {
        toast.warning(`${response.data.errors.length} users could not be processed`);
      }

      // Reset form
      setBulkUsers('');
      setBulkAmount('');
      setBulkReason('');
      setShowBulkDialog(false);
      
      // Refresh stats
      fetchCreditData();
    } catch (error) {
      console.error('Bulk operation failed:', error);
      toast.error('Failed to process bulk operation');
    } finally {
      setProcessing(false);
    }
  };

  const updatePackage = async (packageId, updates) => {
    try {
      await adminAPI.patch(`/credits/packages/${packageId}`, updates);
      toast.success('Package updated successfully');
      fetchCreditData();
    } catch (error) {
      console.error('Failed to update package:', error);
      toast.error('Failed to update package');
    }
  };

  const formatCurrency = (cents) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(cents / 100);
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Credit Management</h2>
          <p className="text-muted-foreground">Manage credit packages and bulk operations</p>
        </div>
        <Button onClick={() => window.location.href = '#/credits/history'}>
          View Transaction History
        </Button>
      </div>

      {/* Credit Statistics */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Credits</CardTitle>
            <CreditCard className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{creditStats.totalCreditsInSystem.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">In circulation</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Credits Used</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{creditStats.totalCreditsUsed.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">All time usage</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(creditStats.totalRevenue)}</div>
            <p className="text-xs text-muted-foreground">From purchases</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg per User</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{Math.round(creditStats.averageCreditsPerUser)}</div>
            <p className="text-xs text-muted-foreground">Credits per user</p>
          </CardContent>
        </Card>
      </div>

      {/* Credit Packages */}
      <Card>
        <CardHeader>
          <CardTitle>Credit Packages</CardTitle>
          <CardDescription>Configure available credit packages for purchase</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            {creditPackages.map((pkg) => (
              <Card key={pkg.id}>
                <CardHeader>
                  <CardTitle className="text-lg">{pkg.name}</CardTitle>
                  <CardDescription>{pkg.description}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Credits</span>
                    <span className="font-semibold">{pkg.credits}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Price</span>
                    <span className="font-semibold">{formatCurrency(pkg.price)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Per Credit</span>
                    <span className="text-sm">{formatCurrency(pkg.price / pkg.credits)}</span>
                  </div>
                  <div className="pt-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full"
                      onClick={() => {
                        // In a real app, this would open an edit dialog
                        toast.info('Package editing coming soon');
                      }}
                    >
                      Edit Package
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Bulk Operations */}
      <Card>
        <CardHeader>
          <CardTitle>Bulk Credit Operations</CardTitle>
          <CardDescription>Add or remove credits for multiple users at once</CardDescription>
        </CardHeader>
        <CardContent>
          <Dialog open={showBulkDialog} onOpenChange={setShowBulkDialog}>
            <DialogTrigger asChild>
              <Button>
                <CreditCard className="mr-2 h-4 w-4" />
                Bulk Credit Operation
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Bulk Credit Operation</DialogTitle>
                <DialogDescription>
                  Add or remove credits for multiple users. All operations are logged for audit purposes.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 flex items-start gap-2">
                  <AlertCircle className="h-5 w-5 text-yellow-600 mt-0.5" />
                  <div className="text-sm">
                    <p className="font-medium text-yellow-900">Important</p>
                    <p className="text-yellow-800">This operation cannot be undone. All changes will be logged in the audit system.</p>
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="bulkUsers">User Emails (one per line)</Label>
                  <Textarea
                    id="bulkUsers"
                    placeholder="user1@example.com&#10;user2@example.com&#10;user3@example.com"
                    value={bulkUsers}
                    onChange={(e) => setBulkUsers(e.target.value)}
                    rows={5}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="bulkAction">Action</Label>
                    <Select value={bulkAction} onValueChange={setBulkAction}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="add">
                          <div className="flex items-center">
                            <Plus className="mr-2 h-4 w-4 text-green-600" />
                            Add Credits
                          </div>
                        </SelectItem>
                        <SelectItem value="remove">
                          <div className="flex items-center">
                            <Minus className="mr-2 h-4 w-4 text-red-600" />
                            Remove Credits
                          </div>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="bulkAmount">Amount</Label>
                    <Input
                      id="bulkAmount"
                      type="number"
                      min="1"
                      placeholder="100"
                      value={bulkAmount}
                      onChange={(e) => setBulkAmount(e.target.value)}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="bulkReason">Reason (required for audit)</Label>
                  <Textarea
                    id="bulkReason"
                    placeholder="Describe the reason for this credit adjustment..."
                    value={bulkReason}
                    onChange={(e) => setBulkReason(e.target.value)}
                    rows={3}
                  />
                </div>

                {bulkUsers && bulkAmount && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <p className="text-sm font-medium text-blue-900 mb-1">Summary</p>
                    <p className="text-sm text-blue-800">
                      {bulkAction === 'add' ? 'Add' : 'Remove'} {bulkAmount} credits {bulkAction === 'add' ? 'to' : 'from'} {bulkUsers.split('\n').filter(e => e.trim()).length} user(s)
                    </p>
                  </div>
                )}
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setShowBulkDialog(false)}>
                  Cancel
                </Button>
                <Button 
                  onClick={handleBulkOperation}
                  disabled={processing || !bulkUsers || !bulkAmount || !bulkReason}
                >
                  {processing ? 'Processing...' : 'Execute Operation'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </CardContent>
      </Card>
    </div>
  );
}