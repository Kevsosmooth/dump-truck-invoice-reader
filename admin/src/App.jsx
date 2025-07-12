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
import AdminLayout from '@/components/layout/AdminLayout';
import '@/styles/dialog-fixes.css';

function PrivateRoute({ children }) {
  const { admin, loading } = useAdminAuth();

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
      </div>
    );
  }

  if (!admin) {
    return <Navigate to="/login" />;
  }

  return children;
}

function AppRoutes() {
  const { admin } = useAdminAuth();

  return (
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
                <Route path="/analytics" element={<Analytics />} />
                <Route path="/settings" element={<Settings />} />
              </Routes>
            </AdminLayout>
          </PrivateRoute>
        }
      />
    </Routes>
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