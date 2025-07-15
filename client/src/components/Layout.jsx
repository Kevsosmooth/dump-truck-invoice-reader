import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Home,
  Receipt,
  LogOut,
  FileCheck,
  CreditCard
} from 'lucide-react';

export function Layout({ children }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50 dark:from-gray-900 dark:via-gray-900 dark:to-gray-800">
      {/* Background Blobs */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-purple-300 dark:bg-purple-600 rounded-full mix-blend-multiply dark:mix-blend-screen filter blur-xl opacity-20 dark:opacity-10 animate-blob"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-yellow-300 dark:bg-yellow-600 rounded-full mix-blend-multiply dark:mix-blend-screen filter blur-xl opacity-20 dark:opacity-10 animate-blob animation-delay-2000"></div>
        <div className="absolute top-40 left-40 w-80 h-80 bg-pink-300 dark:bg-pink-600 rounded-full mix-blend-multiply dark:mix-blend-screen filter blur-xl opacity-20 dark:opacity-10 animate-blob animation-delay-4000"></div>
      </div>

      {/* Header */}
      <header className="relative bg-white/70 dark:bg-gray-900/70 backdrop-blur-md shadow-sm border-b border-gray-100 dark:border-gray-800">
        <div className="w-full px-4 tablet:px-6 lg:px-8">
          <div className="flex justify-between items-center h-14 tablet:h-16">
            <div className="flex items-center gap-2 tablet:gap-3 min-w-0 flex-1">
              <div className="p-1.5 tablet:p-2 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg flex-shrink-0">
                <FileCheck className="h-5 w-5 tablet:h-6 tablet:w-6 text-white" />
              </div>
              <div className="min-w-0">
                <h1 className="text-base tablet:text-lg font-semibold text-gray-900 dark:text-white truncate">
                  Invoice Processor
                </h1>
                <p className="text-xs text-gray-500 dark:text-gray-400 hidden tablet:block">Automated Document Processing</p>
              </div>
            </div>
            
            {/* Navigation */}
            <nav className="flex items-center gap-1 tablet:gap-2 mx-4">
              <Button
                variant={location.pathname === '/' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => navigate('/')}
                className={`flex items-center gap-2 ${
                  location.pathname === '/' 
                    ? '' 
                    : 'text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800'
                }`}
              >
                <Home className="h-4 w-4" />
                <span className="hidden sm:inline">Home</span>
              </Button>
              <Button
                variant={location.pathname === '/history' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => navigate('/history')}
                className={`flex items-center gap-2 ${
                  location.pathname === '/history' 
                    ? '' 
                    : 'text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800'
                }`}
              >
                <Receipt className="h-4 w-4" />
                <span className="hidden sm:inline">History</span>
              </Button>
            </nav>

            {/* User Info */}
            <div className="flex items-center gap-2 tablet:gap-3">
              <div className="hidden sm:flex items-center gap-2 bg-emerald-50 dark:bg-emerald-900/20 px-3 py-1.5 rounded-lg">
                <CreditCard className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                <span className="text-sm font-medium text-emerald-700 dark:text-emerald-300">
                  {user?.credits || 0} credits
                </span>
              </div>
              <Badge className="sm:hidden bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
                {user?.credits || 0}
              </Badge>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleLogout}
                className="text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800"
              >
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="relative">
        {children}
      </main>
    </div>
  );
}