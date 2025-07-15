import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { adminAPI } from '@/config/api';

export default function AuthCallback() {
  const navigate = useNavigate();

  useEffect(() => {
    const handleCallback = async () => {
      try {
        // Get token from URL params
        const urlParams = new URLSearchParams(window.location.search);
        let token = urlParams.get('token');
        
        if (!token) {
          // Check if we already have a token in localStorage (might have been set by cookie)
          token = localStorage.getItem('adminToken');
          if (!token) {
            throw new Error('No authentication token received');
          }
          // If we have a token in localStorage, we're already authenticated
          console.log('Using existing token from localStorage');
        } else {
          // Store token in localStorage
          localStorage.setItem('adminToken', token);
          
          // IMPORTANT: Remove token from URL to prevent exposure in browser history
          window.history.replaceState({}, document.title, '/auth/callback');
        }
        
        // Set up axios to use the token
        adminAPI.defaults.headers.common['Authorization'] = `Bearer ${token}`;
        
        // Call the /me endpoint to verify authentication
        const response = await adminAPI.get('/auth/me');
        
        if (response.data) {
          // The AdminAuthContext will handle loading the user data
          navigate('/');
        }
      } catch (error) {
        console.error('Auth callback error:', error);
        toast.error('Authentication failed');
        navigate('/login?error=auth_failed');
      }
    };

    handleCallback();
  }, [navigate]);

  return (
    <div className="flex h-screen items-center justify-center bg-background">
      <div className="text-center">
        <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-primary" />
        <p className="text-muted-foreground">Completing sign in...</p>
      </div>
    </div>
  );
}