import React, { useState, useEffect } from 'react';
import { fetchWithAuth, API_URL } from '../config/api';
import { ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/20/solid';
import { CalendarIcon, CreditCardIcon } from '@heroicons/react/24/outline';

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
    }).format(amount || 0);
  };

  const getTransactionTypeColor = (type) => {
    const colors = {
      'purchase': 'text-green-400 bg-green-400/10',
      'usage': 'text-orange-400 bg-orange-400/10',
      'refund': 'text-blue-400 bg-blue-400/10',
      'adjustment': 'text-purple-400 bg-purple-400/10',
      'credit': 'text-green-400 bg-green-400/10',
      'debit': 'text-red-400 bg-red-400/10'
    };
    return colors[type?.toLowerCase()] || 'text-gray-400 bg-gray-400/10';
  };

  const getStatusColor = (status) => {
    const colors = {
      'completed': 'text-green-400 bg-green-400/10',
      'pending': 'text-yellow-400 bg-yellow-400/10',
      'failed': 'text-red-400 bg-red-400/10',
      'cancelled': 'text-gray-400 bg-gray-400/10'
    };
    return colors[status?.toLowerCase()] || 'text-gray-400 bg-gray-400/10';
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
      <td className="px-3 py-4 text-sm">
        <div className="h-4 bg-gray-700 rounded w-32"></div>
      </td>
      <td className="px-3 py-4 text-sm">
        <div className="h-4 bg-gray-700 rounded w-48"></div>
      </td>
      <td className="px-3 py-4 text-sm">
        <div className="h-4 bg-gray-700 rounded w-20"></div>
      </td>
      <td className="px-3 py-4 text-sm">
        <div className="h-4 bg-gray-700 rounded w-16"></div>
      </td>
      <td className="px-3 py-4 text-sm">
        <div className="h-4 bg-gray-700 rounded w-24"></div>
      </td>
      <td className="px-3 py-4 text-sm">
        <div className="h-4 bg-gray-700 rounded w-20"></div>
      </td>
    </tr>
  );

  const Pagination = () => (
    <div className="flex items-center justify-between px-4 py-3 sm:px-6">
      <div className="flex flex-1 justify-between sm:hidden">
        <button
          onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
          disabled={currentPage === 1}
          className="relative inline-flex items-center px-4 py-2 text-sm font-medium rounded-md text-gray-300 bg-gray-800 hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Previous
        </button>
        <button
          onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
          disabled={currentPage === totalPages}
          className="relative ml-3 inline-flex items-center px-4 py-2 text-sm font-medium rounded-md text-gray-300 bg-gray-800 hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Next
        </button>
      </div>
      <div className="hidden sm:flex sm:flex-1 sm:items-center sm:justify-between">
        <div>
          <p className="text-sm text-gray-400">
            Showing page <span className="font-medium text-gray-200">{currentPage}</span> of{' '}
            <span className="font-medium text-gray-200">{totalPages}</span>
          </p>
        </div>
        <div>
          <nav className="isolate inline-flex -space-x-px rounded-md shadow-sm" aria-label="Pagination">
            <button
              onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
              disabled={currentPage === 1}
              className="relative inline-flex items-center rounded-l-md px-2 py-2 text-gray-400 bg-gray-800 hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <span className="sr-only">Previous</span>
              <ChevronLeftIcon className="h-5 w-5" aria-hidden="true" />
            </button>
            
            {/* Page numbers */}
            {[...Array(Math.min(5, totalPages))].map((_, idx) => {
              let pageNum;
              if (totalPages <= 5) {
                pageNum = idx + 1;
              } else if (currentPage <= 3) {
                pageNum = idx + 1;
              } else if (currentPage >= totalPages - 2) {
                pageNum = totalPages - 4 + idx;
              } else {
                pageNum = currentPage - 2 + idx;
              }
              
              if (pageNum < 1 || pageNum > totalPages) return null;
              
              return (
                <button
                  key={pageNum}
                  onClick={() => setCurrentPage(pageNum)}
                  className={`relative inline-flex items-center px-4 py-2 text-sm font-medium ${
                    currentPage === pageNum
                      ? 'z-10 bg-indigo-600 text-white'
                      : 'text-gray-400 bg-gray-800 hover:bg-gray-700'
                  }`}
                >
                  {pageNum}
                </button>
              );
            })}
            
            <button
              onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
              disabled={currentPage === totalPages}
              className="relative inline-flex items-center rounded-r-md px-2 py-2 text-gray-400 bg-gray-800 hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <span className="sr-only">Next</span>
              <ChevronRightIcon className="h-5 w-5" aria-hidden="true" />
            </button>
          </nav>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-900 py-8">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-100">Transaction History</h1>
          <p className="mt-2 text-gray-400">View all your credit transactions and usage history</p>
        </div>

        {/* Date Filter */}
        <div className="mb-6 bg-gray-800 rounded-lg p-4">
          <div className="flex flex-col sm:flex-row gap-4 items-end">
            <div className="flex-1">
              <label htmlFor="startDate" className="block text-sm font-medium text-gray-300 mb-1">
                <CalendarIcon className="inline h-4 w-4 mr-1" />
                From Date
              </label>
              <input
                type="date"
                id="startDate"
                value={dateRange.startDate}
                onChange={(e) => handleDateChange('startDate', e.target.value)}
                className="block w-full rounded-md bg-gray-700 border-gray-600 text-gray-100 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
              />
            </div>
            <div className="flex-1">
              <label htmlFor="endDate" className="block text-sm font-medium text-gray-300 mb-1">
                <CalendarIcon className="inline h-4 w-4 mr-1" />
                To Date
              </label>
              <input
                type="date"
                id="endDate"
                value={dateRange.endDate}
                onChange={(e) => handleDateChange('endDate', e.target.value)}
                className="block w-full rounded-md bg-gray-700 border-gray-600 text-gray-100 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
              />
            </div>
            <button
              onClick={() => {
                setDateRange({ startDate: '', endDate: '' });
                setCurrentPage(1);
              }}
              className="px-4 py-2 text-sm font-medium text-gray-300 bg-gray-700 rounded-md hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-indigo-500"
            >
              Clear Filters
            </button>
          </div>
        </div>

        {/* Transactions Table */}
        <div className="bg-gray-800 shadow-sm rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-700">
              <thead className="bg-gray-800">
                <tr>
                  <th className="px-3 py-3.5 text-left text-sm font-semibold text-gray-200">Date</th>
                  <th className="px-3 py-3.5 text-left text-sm font-semibold text-gray-200">Description</th>
                  <th className="px-3 py-3.5 text-left text-sm font-semibold text-gray-200">Type</th>
                  <th className="px-3 py-3.5 text-left text-sm font-semibold text-gray-200">Credits</th>
                  <th className="px-3 py-3.5 text-left text-sm font-semibold text-gray-200">Amount</th>
                  <th className="px-3 py-3.5 text-left text-sm font-semibold text-gray-200">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-700 bg-gray-800">
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
                    <td colSpan="6" className="px-3 py-8 text-center">
                      <div className="text-red-400">
                        <p className="text-sm font-medium">Error loading transactions</p>
                        <p className="text-sm mt-1">{error}</p>
                      </div>
                    </td>
                  </tr>
                ) : transactions.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="px-3 py-8 text-center">
                      <div className="text-gray-400">
                        <CreditCardIcon className="mx-auto h-12 w-12 text-gray-600" />
                        <p className="mt-2 text-sm font-medium">No transactions found</p>
                        <p className="text-sm mt-1">Your transaction history will appear here</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  transactions.map((transaction) => (
                    <tr key={transaction.id} className="hover:bg-gray-700/50 transition-colors">
                      <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-300">
                        {formatDate(transaction.createdAt)}
                      </td>
                      <td className="px-3 py-4 text-sm text-gray-100">
                        {transaction.description}
                      </td>
                      <td className="whitespace-nowrap px-3 py-4 text-sm">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getTransactionTypeColor(transaction.type)}`}>
                          {transaction.type}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-3 py-4 text-sm">
                        <span className={`font-medium ${transaction.credits > 0 ? 'text-green-400' : 'text-red-400'}`}>
                          {transaction.credits > 0 ? '+' : ''}{transaction.credits}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-100">
                        {formatCurrency(transaction.amount)}
                      </td>
                      <td className="whitespace-nowrap px-3 py-4 text-sm">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(transaction.status)}`}>
                          {transaction.status}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          
          {/* Pagination */}
          {!loading && !error && transactions.length > 0 && (
            <Pagination />
          )}
        </div>
      </div>
    </div>
  );
};

export default TransactionHistory;