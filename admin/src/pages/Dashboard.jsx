import { useQuery } from '@tanstack/react-query';
import { Users, FileText, CreditCard, TrendingUp } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import api from '@/config/api';

function StatsCard({ title, value, description, icon: Icon, trend }) {
  const gradientMap = {
    Users: 'from-blue-500 to-cyan-600',
    FileText: 'from-indigo-500 to-purple-600',
    CreditCard: 'from-emerald-500 to-teal-600',
    TrendingUp: 'from-orange-500 to-pink-600'
  };
  
  const gradient = gradientMap[Icon.name] || 'from-indigo-500 to-purple-600';
  
  return (
    <Card className="border-0 shadow-xl bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm hover:shadow-2xl transition-all duration-300 group">
      <div className={`absolute inset-0 bg-gradient-to-r ${gradient} opacity-5 rounded-lg group-hover:opacity-10 transition-opacity duration-300`} />
      <CardHeader className="relative flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-300">{title}</CardTitle>
        <div className={`p-2 bg-gradient-to-r ${gradient} rounded-lg shadow-lg`}>
          <Icon className="h-4 w-4 text-white" />
        </div>
      </CardHeader>
      <CardContent className="relative">
        <div className="text-2xl font-bold text-gray-900 dark:text-white">{value}</div>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
          {trend && (
            <span className={`font-semibold ${trend > 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
              {trend > 0 ? '+' : ''}{trend}%
            </span>
          )}{' '}
          {description}
        </p>
      </CardContent>
    </Card>
  );
}

export default function Dashboard() {
  const { data: stats, isLoading } = useQuery({
    queryKey: ['adminStats'],
    queryFn: async () => {
      const response = await api.get('/admin/analytics/overview');
      return response.data;
    },
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent"></div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-indigo-600 to-purple-600 dark:from-indigo-400 dark:to-purple-400 bg-clip-text text-transparent">Dashboard</h2>
        <p className="text-gray-600 dark:text-gray-300 mt-2">
          Welcome to your admin dashboard. Here's an overview of your system.
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatsCard
          title="Total Users"
          value={stats?.totalUsers || 0}
          description="from last month"
          icon={Users}
          trend={stats?.usersTrend}
        />
        <StatsCard
          title="Documents Processed"
          value={stats?.totalDocuments || 0}
          description="from last month"
          icon={FileText}
          trend={stats?.documentsTrend}
        />
        <StatsCard
          title="Credits Used"
          value={stats?.creditsUsed || 0}
          description="from last month"
          icon={CreditCard}
          trend={stats?.creditsTrend}
        />
        <StatsCard
          title="Active Sessions"
          value={stats?.activeSessions || 0}
          description="currently processing"
          icon={TrendingUp}
        />
      </div>

      {/* Recent Activity */}
      <Card className="border-0 shadow-xl bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm">
        <CardHeader className="bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-900/20 dark:to-purple-900/20 border-b border-gray-200/50 dark:border-gray-700/50">
          <CardTitle className="text-lg text-gray-900 dark:text-white">Recent Activity</CardTitle>
          <CardDescription className="text-gray-600 dark:text-gray-400">
            Latest system events and user activities
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="space-y-4">
            {stats?.recentActivity?.map((activity, index) => (
              <div key={index} className="flex items-center gap-4 p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors duration-200">
                <div className="h-2 w-2 rounded-full bg-gradient-to-r from-indigo-500 to-purple-600 shadow-lg" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-900 dark:text-white">{activity.description}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {activity.user} • {new Date(activity.timestamp).toLocaleString()}
                  </p>
                </div>
              </div>
            ))}
            {(!stats?.recentActivity || stats.recentActivity.length === 0) && (
              <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-8">No recent activity</p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* System Health */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card className="border-0 shadow-xl bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm">
          <CardHeader className="bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-900/20 dark:to-teal-900/20 border-b border-gray-200/50 dark:border-gray-700/50">
            <CardTitle className="text-lg text-gray-900 dark:text-white">System Health</CardTitle>
            <CardDescription className="text-gray-600 dark:text-gray-400">
              Current system status and performance
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors duration-200">
                <span className="text-sm text-gray-600 dark:text-gray-300">API Response Time</span>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-gray-900 dark:text-white">
                    {stats?.apiResponseTime || '0'}ms
                  </span>
                  <span className={`inline-block h-2 w-2 rounded-full shadow-sm ${
                    stats?.apiResponseTime < 100 ? 'bg-green-500' : 
                    stats?.apiResponseTime < 500 ? 'bg-yellow-500' : 'bg-red-500'
                  }`} />
                </div>
              </div>
              <div className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors duration-200">
                <span className="text-sm text-gray-600 dark:text-gray-300">Database Status</span>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-green-600 dark:text-green-400">
                    Healthy
                  </span>
                  <span className="inline-block h-2 w-2 rounded-full bg-green-500 shadow-sm animate-pulse" />
                </div>
              </div>
              <div className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors duration-200">
                <span className="text-sm text-gray-600 dark:text-gray-300">Storage Usage</span>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-gray-900 dark:text-white">
                    {stats?.storageUsage || '0'}%
                  </span>
                  <span className={`inline-block h-2 w-2 rounded-full shadow-sm ${
                    stats?.storageUsage < 60 ? 'bg-green-500' : 
                    stats?.storageUsage < 80 ? 'bg-yellow-500' : 'bg-red-500'
                  }`} />
                </div>
              </div>
              <div className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors duration-200">
                <span className="text-sm text-gray-600 dark:text-gray-300">Azure API Status</span>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-green-600 dark:text-green-400">
                    Connected
                  </span>
                  <span className="inline-block h-2 w-2 rounded-full bg-green-500 shadow-sm animate-pulse" />
                </div>
              </div>
              <div className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors duration-200">
                <span className="text-sm text-gray-600 dark:text-gray-300">Active Sessions</span>
                <span className="text-sm font-medium text-gray-900 dark:text-white">
                  {stats?.activeSessions || 0} processing
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-xl bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm">
          <CardHeader className="bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 border-b border-gray-200/50 dark:border-gray-700/50">
            <CardTitle className="text-lg text-gray-900 dark:text-white">Quick Actions</CardTitle>
            <CardDescription className="text-gray-600 dark:text-gray-400">
              Common administrative tasks
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="space-y-3">
              <a href="/users" className="block rounded-lg border border-gray-200 dark:border-gray-700 p-4 hover:bg-gradient-to-r hover:from-indigo-50 hover:to-purple-50 dark:hover:from-indigo-900/20 dark:hover:to-purple-900/20 hover:border-indigo-300 dark:hover:border-indigo-700 transition-all duration-200 group">
                <p className="font-medium text-gray-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">Manage Users</p>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">View and edit user accounts</p>
              </a>
              <a href="/credits" className="block rounded-lg border border-gray-200 dark:border-gray-700 p-4 hover:bg-gradient-to-r hover:from-emerald-50 hover:to-teal-50 dark:hover:from-emerald-900/20 dark:hover:to-teal-900/20 hover:border-emerald-300 dark:hover:border-emerald-700 transition-all duration-200 group">
                <p className="font-medium text-gray-900 dark:text-white group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">Credit Management</p>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">Add or remove user credits</p>
              </a>
              <a href="/analytics" className="block rounded-lg border border-gray-200 dark:border-gray-700 p-4 hover:bg-gradient-to-r hover:from-orange-50 hover:to-pink-50 dark:hover:from-orange-900/20 dark:hover:to-pink-900/20 hover:border-orange-300 dark:hover:border-orange-700 transition-all duration-200 group">
                <p className="font-medium text-gray-900 dark:text-white group-hover:text-orange-600 dark:group-hover:text-orange-400 transition-colors">View Analytics</p>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">Detailed usage statistics</p>
              </a>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}