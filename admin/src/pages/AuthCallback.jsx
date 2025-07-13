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
        // After Google OAuth, we're redirected here
        // The server has already set the adminToken cookie
        // We need to verify the auth and get the token for localStorage
        
        // Call the /me endpoint to verify authentication
        const response = await adminAPI.get('/auth/me');
        
        if (response.data) {
          // Get the token from the response headers or generate one
          // For now, we'll just verify the cookie is working
          toast.success('Login successful!');
          
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