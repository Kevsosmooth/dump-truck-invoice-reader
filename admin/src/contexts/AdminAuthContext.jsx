import React, { createContext, useContext, useState, useEffect } from 'react';
import api from '@/config/api';

const AdminAuthContext = createContext({});

export const useAdminAuth = () => {
  const context = useContext(AdminAuthContext);
  if (!context) {
    throw new Error('useAdminAuth must be used within AdminAuthProvider');
  }
  return context;
};

export const AdminAuthProvider = ({ children }) => {
  const [admin, setAdmin] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      // Try to get user data from the /me endpoint
      // The cookie will be sent automatically with the request
      const response = await api.get('/admin/auth/me');
      setAdmin(response.data);
    } catch (error) {
      // If error, user is not authenticated
      // Only log if not a 401 error (which is expected when not logged in)
      if (error.response?.status !== 401) {
        console.error('Auth check failed:', error);
      }
      setAdmin(null);
    } finally {
      setLoading(false);
    }
  };

  const login = async (email, password) => {
    try {
      const response = await api.post('/admin/auth/login', { email, password });
      const { token, user } = response.data;
      localStorage.setItem('adminToken', token);
      setAdmin(user);
      return { success: true };
    } catch (error) {
      return { 
        success: false, 
        error: error.response?.data?.error || 'Login failed' 
      };
    }
  };

  const logout = async () => {
    try {
      await api.post('/admin/auth/logout');
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      setAdmin(null);
      // Redirect to login after logout
      window.location.href = '/login';
    }
  };

  const value = {
    admin,
    loading,
    login,
    logout,
    checkAuth,
  };

  return (
    <AdminAuthContext.Provider value={value}>
      {children}
    </AdminAuthContext.Provider>
  );
};