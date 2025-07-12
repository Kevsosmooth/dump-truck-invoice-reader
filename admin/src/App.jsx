import { Routes, Route, Navigate } from 'react-router-dom';
import { AdminAuthProvider, useAdminAuth } from '@/contexts/AdminAuthContext';
import Login from '@/pages/Login';
import AuthCallback from '@/pages/AuthCallback';
import Dashboard from '@/pages/Dashboard';
import Users from '@/pages/Users';
import Credits from '@/pages/Credits';
import CreditHistory from '@/pages/CreditHistory';
import Analytics from '@/pages/Analytics';
import Settings from '@/pages/Settings';
import Models from '@/pages/Models';
import Help from '@/pages/Help';
import AdminLayout from '@/components/layout/AdminLayout';
import { Loader2 } from 'lucide-react';
import '@/styles/dialog-fixes.css';

function PrivateRoute({ children }) {
  const { admin, loading, initialLoadComplete } = useAdminAuth();

  if (loading || (!initialLoadComplete && admin)) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50 dark:from-gray-900 dark:via-gray-800 dark:to-indigo-950 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-12 w-12 mx-auto mb-4 text-indigo-600 dark:text-indigo-400 animate-spin" />
          <p className="text-lg text-gray-600 dark:text-gray-400">Loading admin dashboard...</p>
        </div>
      </div>
    );
  }

  if (!admin) {
    return <Navigate to="/login" />;
  }

  return children;
}

function LogoutOverlay() {
  return (
    <div className="fixed inset-0 z-50 bg-gradient-to-br from-slate-50 via-white to-indigo-50 dark:from-gray-900 dark:via-gray-800 dark:to-indigo-950 flex items-center justify-center">
      <div className="text-center">
        <Loader2 className="h-12 w-12 mx-auto mb-4 text-indigo-600 dark:text-indigo-400 animate-spin" />
        <p className="text-lg text-gray-600 dark:text-gray-400">Logging out...</p>
      </div>
    </div>
  );
}

function AppRoutes() {
  const { admin, isLoggingOut } = useAdminAuth();

  return (
    <>
      <Routes>
        <Route path="/login" element={admin ? <Navigate to="/" /> : <Login />} />
        <Route path="/auth/callback" element={<AuthCallback />} />
        <Route
          path="/*"
          element={
            <PrivateRoute>
              <AdminLayout>
                <Routes>
                  <Route path="/" element={<Dashboard />} />
                  <Route path="/users" element={<Users />} />
                  <Route path="/credits" element={<Credits />} />
                  <Route path="/credits/history" element={<CreditHistory />} />
                  <Route path="/models" element={<Models />} />
                  <Route path="/analytics" element={<Analytics />} />
                  <Route path="/settings" element={<Settings />} />
                  <Route path="/help" element={<Help />} />
                </Routes>
              </AdminLayout>
            </PrivateRoute>
          }
        />
      </Routes>
      {isLoggingOut && <LogoutOverlay />}
    </>
  );
}

function App() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50 dark:from-gray-900 dark:via-gray-800 dark:to-indigo-950">
      <AdminAuthProvider>
        <AppRoutes />
      </AdminAuthProvider>
    </div>
  );
}

export default App;