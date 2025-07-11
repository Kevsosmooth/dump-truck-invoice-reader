import { useQuery } from '@tanstack/react-query';
import { Users, FileText, CreditCard, TrendingUp } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import api from '@/config/api';

function StatsCard({ title, value, description, icon: Icon, trend }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        <p className="text-xs text-muted-foreground">
          {trend && (
            <span className={trend > 0 ? 'text-green-600' : 'text-red-600'}>
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
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Dashboard</h2>
        <p className="text-muted-foreground">
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
      <Card>
        <CardHeader>
          <CardTitle>Recent Activity</CardTitle>
          <CardDescription>
            Latest system events and user activities
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {stats?.recentActivity?.map((activity, index) => (
              <div key={index} className="flex items-center gap-4">
                <div className="h-2 w-2 rounded-full bg-primary" />
                <div className="flex-1">
                  <p className="text-sm font-medium">{activity.description}</p>
                  <p className="text-xs text-muted-foreground">
                    {activity.user} • {new Date(activity.timestamp).toLocaleString()}
                  </p>
                </div>
              </div>
            ))}
            {(!stats?.recentActivity || stats.recentActivity.length === 0) && (
              <p className="text-sm text-muted-foreground">No recent activity</p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* System Health */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>System Health</CardTitle>
            <CardDescription>
              Current system status and performance
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm">API Response Time</span>
                <span className="text-sm font-medium">{stats?.apiResponseTime || '0'}ms</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">Database Status</span>
                <span className="text-sm font-medium text-green-600">Healthy</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">Storage Usage</span>
                <span className="text-sm font-medium">{stats?.storageUsage || '0'}%</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">Azure API Status</span>
                <span className="text-sm font-medium text-green-600">Connected</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
            <CardDescription>
              Common administrative tasks
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <a href="/users" className="block rounded-lg border p-3 hover:bg-accent">
                <p className="font-medium">Manage Users</p>
                <p className="text-sm text-muted-foreground">View and edit user accounts</p>
              </a>
              <a href="/credits" className="block rounded-lg border p-3 hover:bg-accent">
                <p className="font-medium">Credit Management</p>
                <p className="text-sm text-muted-foreground">Add or remove user credits</p>
              </a>
              <a href="/analytics" className="block rounded-lg border p-3 hover:bg-accent">
                <p className="font-medium">View Analytics</p>
                <p className="text-sm text-muted-foreground">Detailed usage statistics</p>
              </a>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}