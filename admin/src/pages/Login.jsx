import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { useAdminAuth } from '@/contexts/AdminAuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';

export default function Login() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { login } = useAdminAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Check for error messages from OAuth
  useEffect(() => {
    const error = searchParams.get('error');
    if (error) {
      switch (error) {
        case 'not_admin':
          toast.error('Access denied. You need admin privileges to access this dashboard.');
          break;
        case 'account_disabled':
          toast.error('Your account has been disabled. Please contact support.');
          break;
        case 'auth_failed':
          toast.error('Authentication failed. Please try again.');
          break;
        case 'auth_error':
          toast.error('An error occurred during authentication. Please try again.');
          break;
        default:
          toast.error('Login failed. Please try again.');
      }
    }
  }, [searchParams]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!email || !password) {
      toast.error('Please enter both email and password');
      return;
    }

    setIsLoading(true);
    
    try {
      const result = await login(email, password);
      
      if (result.success) {
        toast.success('Login successful');
        navigate('/');
      } else {
        toast.error(result.error || 'Login failed');
      }
    } catch (error) {
      toast.error('An unexpected error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleLogin = () => {
    window.location.href = `${import.meta.env.VITE_API_URL || 'http://localhost:3003'}/admin/auth/google`;
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <Card className="w-full max-w-md border-0 shadow-xl bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm">
        <CardHeader className="space-y-1 bg-gradient-to-r from-indigo-500 to-purple-600 text-white pb-8 pt-8 rounded-t-lg">
          <CardTitle className="text-2xl text-center">Admin Dashboard</CardTitle>
          <CardDescription className="text-center text-indigo-100">
            Enter your admin credentials to access the dashboard
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-gray-700 dark:text-gray-200">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="admin@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={isLoading}
                required
                className="border-gray-300 dark:border-gray-600 focus:border-indigo-500 dark:focus:border-indigo-400"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password" className="text-gray-700 dark:text-gray-200">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isLoading}
                required
                className="border-gray-300 dark:border-gray-600 focus:border-indigo-500 dark:focus:border-indigo-400"
              />
            </div>
            <Button
              type="submit"
              className="w-full bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white shadow-lg hover:shadow-xl transition-all duration-300"
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Logging in...
                </>
              ) : (
                'Login'
              )}
            </Button>
          </form>

          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <Separator className="bg-gray-200 dark:bg-gray-700" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-white dark:bg-gray-800 px-2 text-gray-500 dark:text-gray-400">Or continue with</span>
            </div>
          </div>

          <Button
            type="button"
            variant="outline"
            className="w-full border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-all duration-200"
            onClick={handleGoogleLogin}
          >
            <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
              <path
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                fill="#4285F4"
              />
              <path
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                fill="#34A853"
              />
              <path
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                fill="#FBBC05"
              />
              <path
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                fill="#EA4335"
              />
            </svg>
            Continue with Google
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}