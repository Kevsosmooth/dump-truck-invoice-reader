import { useState, useEffect } from 'react';
import { adminAPI } from '@/config/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CreditCard, Mail, User, Calendar, Activity, Shield, History } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

export default function UserProfileModal({ user, isOpen, onClose, onUpdate }) {
  const [loading, setLoading] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [creditAmount, setCreditAmount] = useState('');
  const [creditAction, setCreditAction] = useState('add');
  const [creditReason, setCreditReason] = useState('');
  const [transactions, setTransactions] = useState([]);
  const [transactionsLoading, setTransactionsLoading] = useState(false);
  const [formData, setFormData] = useState({
    role: user.role,
    isActive: user.isActive,
  });

  useEffect(() => {
    if (isOpen && user) {
      fetchUserTransactions();
    }
  }, [isOpen, user]);

  const fetchUserTransactions = async () => {
    try {
      setTransactionsLoading(true);
      const response = await adminAPI.get(`/users/${user.id}/transactions`);
      setTransactions(response.data);
    } catch (error) {
      console.error('Failed to fetch user transactions:', error);
      toast.error('Failed to load transaction history');
    } finally {
      setTransactionsLoading(false);
    }
  };

  const handleUpdateUser = async () => {
    try {
      setLoading(true);
      const updates = {};
      
      // Only include changed fields
      if (formData.role !== user.role) updates.role = formData.role;
      if (formData.isActive !== user.isActive) updates.isActive = formData.isActive;
      
      if (Object.keys(updates).length === 0) {
        toast.info('No changes to save');
        return;
      }

      const response = await adminAPI.patch(`/users/${user.id}`, updates);
      
      toast.success('User updated successfully');
      onUpdate(response.data);
      setEditMode(false);
    } catch (error) {
      toast.error('Failed to update user');
      console.error('Update error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreditUpdate = async () => {
    const amount = parseInt(creditAmount);
    if (!amount || amount <= 0) {
      toast.error('Please enter a valid amount');
      return;
    }

    if (!creditReason.trim()) {
      toast.error('Please provide a reason for the credit adjustment');
      return;
    }

    try {
      setLoading(true);
      
      // Use the new credit adjustment endpoint
      const response = await adminAPI.post(`/users/${user.id}/adjust-credits`, {
        action: creditAction,
        amount,
        reason: creditReason
      });

      toast.success(`Credits ${creditAction === 'add' ? 'added' : 'removed'} successfully`);
      onUpdate(response.data.user);
      setCreditAmount('');
      setCreditReason('');
      
      // Refresh transactions
      fetchUserTransactions();
    } catch (error) {
      toast.error('Failed to update credits');
      console.error('Credit update error:', error);
    } finally {
      setLoading(false);
    }
  };

  const getTransactionTypeColor = (type) => {
    const colors = {
      PURCHASE: 'default',
      USAGE: 'secondary',
      REFUND: 'destructive',
      ADMIN_CREDIT: 'success',
      ADMIN_DEBIT: 'warning',
      BONUS: 'purple',
      MANUAL_ADJUSTMENT: 'outline'
    };
    return colors[type] || 'default';
  };

  const formatCurrency = (cents) => {
    if (!cents) return '-';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(cents / 100);
  };

  const formatDate = (date) => {
    if (!date) return 'Never';
    return new Date(date).toLocaleString();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 dark:from-indigo-400 dark:to-purple-400 bg-clip-text text-transparent">
            User Profile
          </DialogTitle>
          <DialogDescription className="text-gray-600 dark:text-gray-400">
            View and manage user account details
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="profile" className="w-full mt-4">
          <TabsList className="grid w-full grid-cols-2 bg-gray-100 dark:bg-gray-800 p-1 rounded-lg">
            <TabsTrigger value="profile" className="data-[state=active]:bg-white dark:data-[state=active]:bg-gray-700 data-[state=active]:shadow-sm">Profile</TabsTrigger>
            <TabsTrigger value="transactions" className="data-[state=active]:bg-white dark:data-[state=active]:bg-gray-700 data-[state=active]:shadow-sm">Transaction History</TabsTrigger>
          </TabsList>
          
          <TabsContent value="profile" className="space-y-6">
            {/* User Info Section */}
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center">
                  <User className="h-8 w-8" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold">
                    {user.firstName || user.lastName
                      ? `${user.firstName || ''} ${user.lastName || ''}`
                      : 'No Name'}
                  </h3>
                  <p className="text-sm text-muted-foreground flex items-center gap-1">
                    <Mail className="h-3 w-3" />
                    {user.email}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground">Role</Label>
                  {editMode ? (
                    <Select
                      value={formData.role}
                      onValueChange={(value) => setFormData({ ...formData, role: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="USER">User</SelectItem>
                        <SelectItem value="ADMIN">Admin</SelectItem>
                      </SelectContent>
                    </Select>
                  ) : (
                    <div className="flex items-center gap-2 mt-1">
                      <Shield className="h-4 w-4 text-muted-foreground" />
                      <Badge variant={user.role === 'ADMIN' ? 'destructive' : 'default'}>
                        {user.role}
                      </Badge>
                    </div>
                  )}
                </div>

                <div>
                  <Label className="text-muted-foreground">Status</Label>
                  {editMode ? (
                    <Select
                      value={formData.isActive.toString()}
                      onValueChange={(value) => setFormData({ ...formData, isActive: value === 'true' })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="true">Active</SelectItem>
                        <SelectItem value="false">Inactive</SelectItem>
                      </SelectContent>
                    </Select>
                  ) : (
                    <div className="flex items-center gap-2 mt-1">
                      <Activity className="h-4 w-4 text-muted-foreground" />
                      <Badge variant={user.isActive ? 'success' : 'secondary'}>
                        {user.isActive ? 'Active' : 'Inactive'}
                      </Badge>
                    </div>
                  )}
                </div>

                <div>
                  <Label className="text-muted-foreground">Created</Label>
                  <p className="text-sm flex items-center gap-1 mt-1">
                    <Calendar className="h-3 w-3" />
                    {formatDate(user.createdAt)}
                  </p>
                </div>

                <div>
                  <Label className="text-muted-foreground">Last Login</Label>
                  <p className="text-sm flex items-center gap-1 mt-1">
                    <Calendar className="h-3 w-3" />
                    {formatDate(user.lastLoginAt)}
                  </p>
                </div>
              </div>
            </div>

            {/* Credits Section */}
            <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 space-y-4 bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-900/20 dark:to-purple-900/20">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CreditCard className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                  <h4 className="font-semibold text-gray-900 dark:text-white">Credits Management</h4>
                </div>
                <div className="text-2xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 dark:from-indigo-400 dark:to-purple-400 bg-clip-text text-transparent">{user.credits}</div>
              </div>

              <div className="space-y-2">
                <div className="flex items-end gap-2">
                  <div className="flex-1">
                    <Label htmlFor="creditAmount">Amount</Label>
                    <Input
                      id="creditAmount"
                      type="number"
                      min="1"
                      value={creditAmount}
                      onChange={(e) => setCreditAmount(e.target.value)}
                      placeholder="Enter amount"
                    />
                  </div>
                  <Select value={creditAction} onValueChange={setCreditAction}>
                    <SelectTrigger className="w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="add">Add</SelectItem>
                      <SelectItem value="remove">Remove</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="creditReason">Reason (required)</Label>
                  <Input
                    id="creditReason"
                    value={creditReason}
                    onChange={(e) => setCreditReason(e.target.value)}
                    placeholder="Reason for credit adjustment"
                  />
                </div>
                <Button 
                  onClick={handleCreditUpdate}
                  disabled={!creditAmount || !creditReason || loading}
                  className="w-full bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white shadow-lg hover:shadow-xl transition-all duration-300"
                >
                  Apply Credit Adjustment
                </Button>
              </div>

              <p className="text-sm text-muted-foreground">
                Note: All credit adjustments are logged for audit purposes
              </p>
            </div>

            {/* Statistics */}
            <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-900/20 dark:to-teal-900/20">
              <h4 className="font-semibold mb-2 text-gray-900 dark:text-white">Usage Statistics</h4>
              <div className="text-sm space-y-1 text-gray-600 dark:text-gray-300">
                <p>Total Jobs: <span className="font-medium text-gray-900 dark:text-white">{user._count?.jobs || 0}</span></p>
                {user.organization && (
                  <p>Organization: <span className="font-medium text-gray-900 dark:text-white">{user.organization.name}</span></p>
                )}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="transactions" className="space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="font-semibold flex items-center gap-2">
                <History className="h-5 w-5" />
                Transaction History
              </h4>
              <Button
                variant="outline"
                size="sm"
                onClick={() => window.location.href = `#/credits/history?user=${user.email}`}
              >
                View All Transactions
              </Button>
            </div>

            {transactionsLoading ? (
              <div className="text-center py-8">Loading transactions...</div>
            ) : transactions.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No transactions found for this user
              </div>
            ) : (
              <div className="space-y-3">
                {transactions.slice(0, 10).map((transaction) => (
                  <div key={transaction.id} className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 space-y-2">
                    {/* Header with date and status */}
                    <div className="flex items-start justify-between">
                      <div className="text-sm text-gray-600 dark:text-gray-400">
                        {format(new Date(transaction.createdAt), 'MMM dd, yyyy HH:mm')}
                      </div>
                      <Badge variant={
                        transaction.status === 'COMPLETED' ? 'success' :
                        transaction.status === 'PENDING' ? 'warning' :
                        transaction.status === 'FAILED' ? 'destructive' : 'secondary'
                      } className="text-xs">
                        {transaction.status}
                      </Badge>
                    </div>
                    
                    {/* Type and Credits */}
                    <div className="flex items-center justify-between">
                      <Badge variant={getTransactionTypeColor(transaction.type)} className="text-xs">
                        {transaction.type.replace('_', ' ')}
                      </Badge>
                      <div className="flex items-center gap-3">
                        <span className={`font-semibold ${transaction.credits > 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                          {transaction.credits > 0 ? '+' : ''}{transaction.credits} credits
                        </span>
                        {transaction.amount > 0 && (
                          <span className="text-sm text-gray-600 dark:text-gray-400">
                            {formatCurrency(transaction.amount)}
                          </span>
                        )}
                      </div>
                    </div>
                    
                    {/* Description */}
                    {transaction.description && (
                      <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2">
                        {transaction.description}
                      </p>
                    )}
                  </div>
                ))}
                
                {transactions.length > 10 && (
                  <div className="text-center text-sm text-muted-foreground pt-2">
                    Showing 10 most recent transactions
                  </div>
                )}
              </div>
            )}
          </TabsContent>
        </Tabs>

        <DialogFooter>
          {editMode ? (
            <>
              <Button
                variant="outline"
                onClick={() => {
                  setEditMode(false);
                  setFormData({ role: user.role, isActive: user.isActive });
                }}
                disabled={loading}
              >
                Cancel
              </Button>
              <Button onClick={handleUpdateUser} disabled={loading}>
                Save Changes
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={onClose}>
                Close
              </Button>
              <Button onClick={() => setEditMode(true)}>
                Edit User
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}