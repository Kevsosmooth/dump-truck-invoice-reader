import { useEffect } from 'react';
import { Loader2 } from 'lucide-react';

export function AuthCallback() {
  useEffect(() => {
    // Get token from URL
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');

    if (token) {
      // Store token in localStorage for now (could also use cookies)
      localStorage.setItem('token', token);
      // Redirect to home
      window.location.href = '/';
    } else {
      // Error - redirect to login
      window.location.href = '/login?error=auth_failed';
    }
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-indigo-600" />
        <p className="text-gray-600">Completing sign in...</p>
      </div>
    </div>
  );
}