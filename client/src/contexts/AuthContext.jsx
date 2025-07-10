import { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext(undefined);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  
  // Get token from localStorage, but filter out invalid values
  const getStoredToken = () => {
    const storedToken = localStorage.getItem('token');
    if (!storedToken || storedToken === 'null' || storedToken === 'undefined') {
      return null;
    }
    return storedToken;
  };
  
  const [token, setToken] = useState(getStoredToken());

  const checkAuth = async () => {
    try {
      const storedToken = getStoredToken();
      if (!storedToken) {
        setUser(null);
        setToken(null);
        setIsLoading(false);
        return;
      }

      // Update token state
      setToken(storedToken);

      const response = await fetch('http://localhost:3003/auth/me', {
        headers: {
          'Authorization': `Bearer ${storedToken}`
        },
        credentials: 'include'
      });

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
      setToken(null);
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (email, password) => {
    const response = await fetch('http://localhost:3003/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
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
      const token = getStoredToken();
      if (token) {
        await fetch('http://localhost:3003/auth/logout', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}` },
          credentials: 'include'
        });
      }
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
    // Clean up invalid tokens on mount
    const storedToken = localStorage.getItem('token');
    if (storedToken === 'null' || storedToken === 'undefined' || storedToken === '') {
      localStorage.removeItem('token');
    }
    
    checkAuth();
  }, []);

  // Update only credits without full auth check
  const updateCredits = (newCredits) => {
    if (user && typeof newCredits === 'number') {
      setUser(prevUser => ({
        ...prevUser,
        credits: newCredits
      }));
    }
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, isLoggingOut, login, logout, checkAuth, token, updateCredits }}>
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