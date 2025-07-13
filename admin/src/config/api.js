import axios from 'axios';

// In production, VITE_API_URL should be the backend URL (e.g., https://dump-truck-invoice-reader.onrender.com)
// In development, it defaults to the local backend
const BACKEND_URL = import.meta.env.VITE_API_URL || 'http://localhost:3003';

const api = axios.create({
  baseURL: `${BACKEND_URL}/api`,
  withCredentials: true,
});

// Create a separate instance for admin API calls
const adminAPI = axios.create({
  baseURL: `${BACKEND_URL}/api/admin`,
  withCredentials: true,
});

// Request interceptor - add token from localStorage
const requestInterceptor = (config) => {
  const token = localStorage.getItem('adminToken');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
};

const errorInterceptor = (error) => {
  return Promise.reject(error);
};

// Response interceptor to handle auth errors
const responseInterceptor = (response) => response;

const responseErrorInterceptor = (error) => {
  if (error.response?.status === 401) {
    // Only redirect to login if not already on login page or auth callback
    const currentPath = window.location.pathname;
    if (!currentPath.includes('/login') && !currentPath.includes('/auth/callback')) {
      window.location.href = '/login';
    }
  }
  return Promise.reject(error);
};

// Apply interceptors to both instances
api.interceptors.request.use(requestInterceptor, errorInterceptor);
api.interceptors.response.use(responseInterceptor, responseErrorInterceptor);

adminAPI.interceptors.request.use(requestInterceptor, errorInterceptor);
adminAPI.interceptors.response.use(responseInterceptor, responseErrorInterceptor);

export default api;
export { adminAPI };