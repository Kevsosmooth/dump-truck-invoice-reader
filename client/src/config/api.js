// API Configuration
// This file centralizes all API endpoints and configuration

// Get API URL from environment variable or use localhost for development
export const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3003';

// API endpoints
export const API_ENDPOINTS = {
  // Auth endpoints
  AUTH: {
    LOGIN: `${API_URL}/auth/login`,
    REGISTER: `${API_URL}/auth/register`,
    LOGOUT: `${API_URL}/auth/logout`,
    ME: `${API_URL}/auth/me`,
    GOOGLE: `${API_URL}/auth/google`,
    GOOGLE_CALLBACK: `${API_URL}/auth/google/callback`,
  },
  
  // User endpoints
  USER: {
    PROFILE: `${API_URL}/api/user/profile`,
    CREDITS: `${API_URL}/api/user/credits`,
  },
  
  // Job endpoints
  JOBS: {
    LIST: `${API_URL}/api/jobs`,
    CREATE: `${API_URL}/api/jobs`,
    UPLOAD: `${API_URL}/api/jobs/upload`,
    STATUS: (jobId) => `${API_URL}/api/jobs/${jobId}/status`,
    DOWNLOAD: (jobId) => `${API_URL}/api/jobs/${jobId}/download`,
  },
  
  // Session endpoints
  SESSIONS: {
    CREATE: `${API_URL}/api/sessions`,
    GET: (sessionId) => `${API_URL}/api/sessions/${sessionId}`,
    UPLOAD: (sessionId) => `${API_URL}/api/sessions/${sessionId}/upload`,
    PROCESS: (sessionId) => `${API_URL}/api/sessions/${sessionId}/process`,
    DOWNLOAD: (sessionId) => `${API_URL}/api/sessions/${sessionId}/download`,
    DELETE: (sessionId) => `${API_URL}/api/sessions/${sessionId}`,
  },
  
  // Model endpoints
  MODELS: {
    LIST: `${API_URL}/api/models`,
    INFO: (modelId) => `${API_URL}/api/models/${modelId}/info`,
  },
  
  // Admin endpoints
  ADMIN: {
    USERS: `${API_URL}/api/admin/users`,
    JOBS: `${API_URL}/api/admin/jobs`,
  },
  
  // Health check
  HEALTH: `${API_URL}/api/health`,
};

// Fetch configuration with auth
export const fetchWithAuth = async (url, options = {}) => {
  const token = localStorage.getItem('token');
  
  const defaultOptions = {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    credentials: 'include', // Still include for backward compatibility
  };
  
  // Add Authorization header if token exists
  if (token) {
    defaultOptions.headers['Authorization'] = `Bearer ${token}`;
  }
  
  return fetch(url, { ...defaultOptions, ...options });
};

// Helper to check if we're in production
export const isProduction = () => {
  return import.meta.env.PROD || window.location.hostname !== 'localhost';
};