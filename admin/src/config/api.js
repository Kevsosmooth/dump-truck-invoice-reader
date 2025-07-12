import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
});

// Request interceptor (cookies are sent automatically with withCredentials: true)
api.interceptors.request.use(
  (config) => {
    // No need to add token manually, cookie is sent automatically
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor to handle auth errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Only redirect to login if not already on login page or auth callback
      const currentPath = window.location.pathname;
      if (!currentPath.includes('/login') && !currentPath.includes('/auth/callback')) {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export default api;