import { createContext, useContext, useState, useEffect } from 'react';
import { API_ENDPOINTS, fetchWithAuth } from '../config/api';

const AuthContext = createContext(undefined);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [token, setToken] = useState(localStorage.getItem('token'));

  const checkAuth = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        setUser(null);
        setIsLoading(false);
        return;
      }

      const response = await fetchWithAuth(API_ENDPOINTS.AUTH.ME);

      if (response.ok) {
        const data = await response.json();
        setUser(data.user);
      } else {
        setUser(null);
        setToken(null);
        localStorage.removeItem('token');
      }
    } catch (error) {
      console.error('Auth check failed:', error);
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (email, password) => {
    const response = await fetchWithAuth(API_ENDPOINTS.AUTH.LOGIN, {
      method: 'POST',
      body: JSON.stringify({ email, password })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Login failed');
    }

    const data = await response.json();
    if (data.token) {
      localStorage.setItem('token', data.token);
      setToken(data.token);
    }
    setUser(data.user);
  };

  const logout = async () => {
    setIsLoggingOut(true);
    
    // Add a small delay to ensure loading screen is visible
    await new Promise(resolve => setTimeout(resolve, 500));
    
    try {
      await fetchWithAuth(API_ENDPOINTS.AUTH.LOGOUT, {
        method: 'POST'
      });
    } finally {
      setUser(null);
      setToken(null);
      localStorage.removeItem('token');
      // Additional delay before redirect
      await new Promise(resolve => setTimeout(resolve, 300));
      window.location.href = '/login';
    }
  };

  useEffect(() => {
    checkAuth();
  }, []);

  return (
    <AuthContext.Provider value={{ user, isLoading, isLoggingOut, login, logout, checkAuth, token }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}