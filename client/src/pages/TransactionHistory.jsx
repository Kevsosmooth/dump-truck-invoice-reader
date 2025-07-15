import React, { useState, useEffect } from 'react';
import { fetchWithAuth, API_URL } from '../config/api';
import { Layout } from '../components/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { 
  ChevronLeft, 
  ChevronRight, 
  Calendar, 
  CreditCard,
  Download,
  Filter,
  Loader2,
  Receipt,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle
} from 'lucide-react';

const TransactionHistory = () => {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [dateRange, setDateRange] = useState({
    startDate: '',
    endDate: ''
  });

  const transactionsPerPage = 10;

  useEffect(() => {
    fetchTransactions();
  }, [currentPage, dateRange]);

  const fetchTransactions = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const params = new URLSearchParams({
        page: currentPage,
        limit: transactionsPerPage,
        ...(dateRange.startDate && { startDate: dateRange.startDate }),
        ...(dateRange.endDate && { endDate: dateRange.endDate })
      });

      const response = await fetchWithAuth(`${API_URL}/api/transactions/history?${params}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch transactions');
      }

      const data = await response.json();
      setTransactions(data.data?.transactions || []);
      setTotalPages(data.data?.pagination?.totalPages || 1);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format((amount || 0) / 100); // Convert from cents to dollars
  };

  const getTransactionTypeColor = (type) => {
    const colors = {
      'purchase': 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
      'usage': 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300',
      'refund': 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
      'adjustment': 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
      'credit': 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
      'debit': 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'
    };
    return colors[type?.toLowerCase()] || 'bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-300';
  };

  const getTransactionIcon = (type) => {
    const icons = {
      'purchase': <TrendingUp className="h-4 w-4" />,
      'usage': <TrendingDown className="h-4 w-4" />,
      'refund': <DollarSign className="h-4 w-4" />,
      'adjustment': <AlertCircle className="h-4 w-4" />,
      'credit': <TrendingUp className="h-4 w-4" />,
      'debit': <TrendingDown className="h-4 w-4" />
    };
    return icons[type?.toLowerCase()] || <CreditCard className="h-4 w-4" />;
  };

  const getStatusColor = (status) => {
    const colors = {
      'completed': 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
      'pending': 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300',
      'failed': 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
      'cancelled': 'bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-300'
    };
    return colors[status?.toLowerCase()] || 'bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-300';
  };

  const getStatusIcon = (status) => {
    const icons = {
      'completed': <CheckCircle2 className="h-3 w-3" />,
      'pending': <Clock className="h-3 w-3" />,
      'failed': <XCircle className="h-3 w-3" />,
      'cancelled': <XCircle className="h-3 w-3" />
    };
    return icons[status?.toLowerCase()] || <AlertCircle className="h-3 w-3" />;
  };

  const handleDateChange = (field, value) => {
    setDateRange(prev => ({
      ...prev,
      [field]: value
    }));
    setCurrentPage(1); // Reset to first page when filters change
  };

  const SkeletonRow = () => (
    <tr className="animate-pulse">
      <td className="px-4 py-4">
        <div className="h-4 bg-gray-300 dark:bg-gray-700 rounded w-32"></div>
      </td>
      <td className="px-4 py-4">
        <div className="h-4 bg-gray-300 dark:bg-gray-700 rounded w-48"></div>
      </td>
      <td className="px-4 py-4">
        <div className="h-4 bg-gray-300 dark:bg-gray-700 rounded w-20"></div>
      </td>
      <td className="px-4 py-4">
        <div className="h-4 bg-gray-300 dark:bg-gray-700 rounded w-16"></div>
      </td>
      <td className="px-4 py-4">
        <div className="h-4 bg-gray-300 dark:bg-gray-700 rounded w-24"></div>
      </td>
      <td className="px-4 py-4">
        <div className="h-4 bg-gray-300 dark:bg-gray-700 rounded w-20"></div>
      </td>
    </tr>
  );

  return (
    <Layout>
      <div className="w-full px-4 sm:px-6 lg:px-8 py-4 sm:py-8">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="mb-6 sm:mb-8">
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <Receipt className="h-6 w-6 sm:h-8 sm:w-8 text-indigo-600 dark:text-indigo-400" />
              Transaction History
            </h1>
            <p className="mt-2 text-gray-600 dark:text-gray-400">View all your credit transactions and usage history</p>
          </div>

          {/* Date Filter Card */}
          <Card className="mb-6 border-0 shadow-xl bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Filter className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                Filters
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="flex-1">
                  <Label htmlFor="startDate" className="flex items-center gap-1 mb-2">
                    <Calendar className="h-4 w-4" />
                    Start Date
                  </Label>
                  <Input
                    type="date"
                    id="startDate"
                    value={dateRange.startDate}
                    onChange={(e) => handleDateChange('startDate', e.target.value)}
                    className="bg-white dark:bg-gray-700"
                  />
                </div>
                <div className="flex-1">
                  <Label htmlFor="endDate" className="flex items-center gap-1 mb-2">
                    <Calendar className="h-4 w-4" />
                    End Date
                  </Label>
                  <Input
                    type="date"
                    id="endDate"
                    value={dateRange.endDate}
                    onChange={(e) => handleDateChange('endDate', e.target.value)}
                    className="bg-white dark:bg-gray-700"
                  />
                </div>
                <div className="flex items-end">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setDateRange({ startDate: '', endDate: '' });
                      setCurrentPage(1);
                    }}
                    className="h-10"
                  >
                    Clear Filters
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Transactions Table */}
          <Card className="border-0 shadow-xl bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-gray-900/50 border-b border-gray-200 dark:border-gray-700">
                  <tr>
                    <th className="px-4 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-gray-100">Date</th>
                    <th className="px-4 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-gray-100">Description</th>
                    <th className="px-4 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-gray-100">Type</th>
                    <th className="px-4 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-gray-100">Credits</th>
                    <th className="px-4 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-gray-100">Amount</th>
                    <th className="px-4 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-gray-100">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {loading ? (
                    <>
                      <SkeletonRow />
                      <SkeletonRow />
                      <SkeletonRow />
                      <SkeletonRow />
                      <SkeletonRow />
                    </>
                  ) : error ? (
                    <tr>
                      <td colSpan="6" className="px-4 py-8 text-center">
                        <div className="text-red-600 dark:text-red-400">
                          <XCircle className="mx-auto h-12 w-12 mb-2" />
                          <p className="text-sm font-medium">Error loading transactions</p>
                          <p className="text-sm mt-1">{error}</p>
                        </div>
                      </td>
                    </tr>
                  ) : transactions.length === 0 ? (
                    <tr>
                      <td colSpan="6" className="px-4 py-8 text-center">
                        <div className="text-gray-500 dark:text-gray-400">
                          <CreditCard className="mx-auto h-12 w-12 mb-2" />
                          <p className="mt-2 text-sm font-medium">No transactions found</p>
                          <p className="text-sm mt-1">Your transaction history will appear here</p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    transactions.map((transaction) => (
                      <tr key={transaction.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                        <td className="whitespace-nowrap px-4 py-4 text-sm text-gray-900 dark:text-gray-100">
                          {formatDate(transaction.createdAt)}
                        </td>
                        <td className="px-4 py-4 text-sm text-gray-900 dark:text-gray-100">
                          {transaction.description}
                        </td>
                        <td className="whitespace-nowrap px-4 py-4 text-sm">
                          <Badge className={`${getTransactionTypeColor(transaction.type)} flex items-center gap-1 w-fit`}>
                            {getTransactionIcon(transaction.type)}
                            {transaction.type}
                          </Badge>
                        </td>
                        <td className="whitespace-nowrap px-4 py-4 text-sm">
                          <span className={`font-medium ${
                            transaction.credits > 0 
                              ? 'text-emerald-600 dark:text-emerald-400' 
                              : 'text-red-600 dark:text-red-400'
                          }`}>
                            {transaction.credits > 0 ? '+' : ''}{transaction.credits}
                          </span>
                        </td>
                        <td className="whitespace-nowrap px-4 py-4 text-sm text-gray-900 dark:text-gray-100 font-medium">
                          {formatCurrency(transaction.amount)}
                        </td>
                        <td className="whitespace-nowrap px-4 py-4 text-sm">
                          <Badge className={`${getStatusColor(transaction.status)} flex items-center gap-1 w-fit`}>
                            {getStatusIcon(transaction.status)}
                            {transaction.status}
                          </Badge>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            
            {/* Pagination */}
            {!loading && !error && transactions.length > 0 && (
              <div className="px-4 py-3 border-t border-gray-200 dark:border-gray-700">
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div className="text-sm text-gray-700 dark:text-gray-300">
                    Page {currentPage} of {totalPages}
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                      disabled={currentPage === 1}
                      className="flex items-center gap-1"
                    >
                      <ChevronLeft className="h-4 w-4" />
                      Previous
                    </Button>
                    
                    {/* Page numbers */}
                    <div className="hidden sm:flex items-center gap-1">
                      {[...Array(Math.min(5, totalPages))].map((_, i) => {
                        const pageNum = i + 1;
                        if (pageNum > totalPages) return null;
                        
                        return (
                          <Button
                            key={pageNum}
                            variant={currentPage === pageNum ? "default" : "outline"}
                            size="sm"
                            onClick={() => setCurrentPage(pageNum)}
                            className="w-8 h-8 p-0"
                          >
                            {pageNum}
                          </Button>
                        );
                      })}
                      {totalPages > 5 && (
                        <>
                          <span className="text-gray-500 dark:text-gray-400 px-2">...</span>
                          <Button
                            variant={currentPage === totalPages ? "default" : "outline"}
                            size="sm"
                            onClick={() => setCurrentPage(totalPages)}
                            className="w-8 h-8 p-0"
                          >
                            {totalPages}
                          </Button>
                        </>
                      )}
                    </div>
                    
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                      disabled={currentPage === totalPages}
                      className="flex items-center gap-1"
                    >
                      Next
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </Card>
        </div>
      </div>
    </Layout>
  );
};

export default TransactionHistory;