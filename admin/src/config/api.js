import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
});

// Create a separate instance for admin API calls
const adminAPI = axios.create({
  baseURL: `${API_BASE_URL}/api/admin`,
  withCredentials: true,
});

// Request interceptor (cookies are sent automatically with withCredentials: true)
const requestInterceptor = (config) => {
  // No need to add token manually, cookie is sent automatically
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