import { NavLink, useNavigate } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Users, 
  CreditCard, 
  BarChart3, 
  Settings,
  LogOut,
  Menu,
  X,
  FileText,
  HelpCircle
} from 'lucide-react';
import { useState } from 'react';
import { useAdminAuth } from '@/contexts/AdminAuthContext';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

const navigation = [
  { name: 'Dashboard', href: '/', icon: LayoutDashboard },
  { name: 'Users', href: '/users', icon: Users },
  { name: 'Credits', href: '/credits', icon: CreditCard },
  { name: 'Models', href: '/models', icon: FileText },
  { name: 'Analytics', href: '/analytics', icon: BarChart3 },
  { name: 'Settings', href: '/settings', icon: Settings },
  { name: 'Help', href: '/help', icon: HelpCircle },
];

export default function AdminLayout({ children }) {
  const navigate = useNavigate();
  const { admin, logout } = useAdminAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleLogout = async () => {
    try {
      await logout();
      toast.success('Logged out successfully');
      navigate('/login');
    } catch (error) {
      toast.error('Error logging out');
    }
  };

  return (
    <div className="flex h-screen">
      {/* Mobile sidebar backdrop */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 z-40 bg-black/80 backdrop-blur-sm lg:hidden" 
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-64 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border-r border-gray-200/50 dark:border-gray-700/50 shadow-xl transform transition-all duration-300 ease-in-out lg:translate-x-0 lg:static lg:inset-0",
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex h-full flex-col">
          {/* Logo */}
          <div className="flex h-16 items-center justify-between px-6 border-b border-gray-200/50 dark:border-gray-700/50 bg-gradient-to-r from-indigo-500 to-purple-600">
            <h1 className="text-xl font-bold text-white">Admin Dashboard</h1>
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden text-white hover:bg-white/20"
              onClick={() => setSidebarOpen(false)}
            >
              <X className="h-5 w-5" />
            </Button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 space-y-1 px-3 py-4">
            {navigation.map((item) => (
              <NavLink
                key={item.name}
                to={item.href}
                className={({ isActive }) =>
                  cn(
                    "group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200",
                    isActive
                      ? "bg-gradient-to-r from-indigo-500 to-purple-600 text-white shadow-lg"
                      : "text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700/50 hover:text-gray-900 dark:hover:text-white"
                  )
                }
                onClick={() => setSidebarOpen(false)}
              >
                <item.icon className="h-5 w-5 transition-transform duration-200 group-hover:scale-110" />
                {item.name}
              </NavLink>
            ))}
          </nav>

          {/* User info and logout */}
          <div className="border-t border-gray-200/50 dark:border-gray-700/50 px-3 py-4 bg-gray-50/50 dark:bg-gray-900/50">
            <div className="mb-3 px-3">
              <p className="text-sm font-medium text-gray-900 dark:text-white">{admin?.name || admin?.email}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">Administrator</p>
            </div>
            <Button
              variant="ghost"
              className="w-full justify-start gap-3 hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-600 dark:hover:text-red-400 transition-all duration-200"
              onClick={handleLogout}
            >
              <LogOut className="h-5 w-5" />
              Logout
            </Button>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Mobile header */}
        <header className="flex h-16 items-center gap-4 border-b border-gray-200/50 dark:border-gray-700/50 bg-white/70 dark:bg-gray-900/70 backdrop-blur-md px-6 lg:hidden">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSidebarOpen(true)}
            className="hover:bg-gray-100 dark:hover:bg-gray-800"
          >
            <Menu className="h-5 w-5" />
          </Button>
          <h1 className="text-xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 dark:from-indigo-400 dark:to-purple-400 bg-clip-text text-transparent">Admin Dashboard</h1>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto">
          <div className="container mx-auto px-6 py-8">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}