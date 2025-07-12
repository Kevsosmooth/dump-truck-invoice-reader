import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { 
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  AreaChart, Area
} from 'recharts';
import { 
  Calendar, Download, Users, FileText, CreditCard, 
  TrendingUp, AlertCircle, Activity
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import api from '@/config/api';
import { format } from 'date-fns';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8'];

function StatCard({ title, value, icon: Icon, description, trend }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value?.toLocaleString() || 0}</div>
        {description && (
          <p className="text-xs text-muted-foreground">
            {trend !== undefined && (
              <span className={trend > 0 ? 'text-green-600' : trend < 0 ? 'text-red-600' : ''}>
                {trend > 0 ? '+' : ''}{trend}%
              </span>
            )}{' '}
            {description}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

export default function Analytics() {
  const [dateRange, setDateRange] = useState('30');
  const [activeTab, setActiveTab] = useState('overview');

  // Fetch analytics data based on selected date range
  const { data: userAnalytics, isLoading: loadingUsers } = useQuery({
    queryKey: ['userAnalytics', dateRange],
    queryFn: async () => {
      const response = await api.get(`/admin/analytics/users?days=${dateRange}`);
      return response.data;
    },
  });

  const { data: creditAnalytics, isLoading: loadingCredits } = useQuery({
    queryKey: ['creditAnalytics', dateRange],
    queryFn: async () => {
      const response = await api.get(`/admin/analytics/credits?days=${dateRange}`);
      return response.data;
    },
  });

  const { data: documentAnalytics, isLoading: loadingDocuments } = useQuery({
    queryKey: ['documentAnalytics', dateRange],
    queryFn: async () => {
      const response = await api.get(`/admin/analytics/documents?days=${dateRange}`);
      return response.data;
    },
  });

  const { data: errorLogs, isLoading: loadingErrors } = useQuery({
    queryKey: ['errorLogs'],
    queryFn: async () => {
      const response = await api.get('/admin/analytics/errors?limit=50');
      return response.data;
    },
  });

  const { data: revenueAnalytics, isLoading: loadingRevenue } = useQuery({
    queryKey: ['revenueAnalytics', dateRange],
    queryFn: async () => {
      const response = await api.get(`/admin/analytics/revenue?days=${dateRange}`);
      return response.data;
    },
  });

  const isLoading = loadingUsers || loadingCredits || loadingDocuments || loadingErrors || loadingRevenue;

  // Export data function
  const exportData = async (type) => {
    try {
      const data = {
        users: userAnalytics,
        credits: creditAnalytics,
        documents: documentAnalytics,
        revenue: revenueAnalytics,
        errors: errorLogs,
        exportDate: new Date().toISOString(),
        dateRange: `${dateRange} days`
      };

      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `analytics-export-${format(new Date(), 'yyyy-MM-dd')}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Export failed:', error);
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Analytics</h2>
          <p className="text-muted-foreground">
            System usage statistics and insights
          </p>
        </div>
        <div className="flex gap-2">
          <Select value={dateRange} onValueChange={setDateRange}>
            <SelectTrigger className="w-[150px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">Last 7 days</SelectItem>
              <SelectItem value="30">Last 30 days</SelectItem>
              <SelectItem value="90">Last 90 days</SelectItem>
              <SelectItem value="365">Last year</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={() => exportData('all')} variant="outline">
            <Download className="mr-2 h-4 w-4" />
            Export
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="users">Users</TabsTrigger>
          <TabsTrigger value="documents">Documents</TabsTrigger>
          <TabsTrigger value="credits">Credits</TabsTrigger>
          <TabsTrigger value="revenue">Revenue</TabsTrigger>
          <TabsTrigger value="errors">Errors</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <StatCard
              title="Active Users"
              value={userAnalytics?.activeUsers}
              icon={Users}
              description={`in last ${dateRange} days`}
            />
            <StatCard
              title="Documents Processed"
              value={documentAnalytics?.documentsByStatus?.find(s => s.status === 'completed')?.count || 0}
              icon={FileText}
              description="completed successfully"
            />
            <StatCard
              title="Credits Used"
              value={creditAnalytics?.transactionsByType?.find(t => t.type === 'DEDUCT')?.total || 0}
              icon={CreditCard}
              description="total credits consumed"
            />
            <StatCard
              title="Error Rate"
              value={`${(documentAnalytics?.errorRate?.[0]?.error_rate || 0).toFixed(2)}%`}
              icon={AlertCircle}
              description="document processing"
            />
          </div>

          {/* Combined Chart */}
          <Card>
            <CardHeader>
              <CardTitle>System Activity Overview</CardTitle>
              <CardDescription>
                User registrations and document processing trends
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={userAnalytics?.userGrowth || []}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis 
                    dataKey="date" 
                    tickFormatter={(date) => format(new Date(date), 'MMM d')}
                  />
                  <YAxis />
                  <Tooltip 
                    labelFormatter={(date) => format(new Date(date), 'MMM d, yyyy')}
                  />
                  <Legend />
                  <Line 
                    type="monotone" 
                    dataKey="count" 
                    stroke="#8884d8" 
                    name="New Users"
                    strokeWidth={2}
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Users Tab */}
        <TabsContent value="users" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            {/* User Growth Chart */}
            <Card>
              <CardHeader>
                <CardTitle>User Growth</CardTitle>
                <CardDescription>New user registrations over time</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <AreaChart data={userAnalytics?.userGrowth || []}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis 
                      dataKey="date" 
                      tickFormatter={(date) => format(new Date(date), 'MMM d')}
                    />
                    <YAxis />
                    <Tooltip 
                      labelFormatter={(date) => format(new Date(date), 'MMM d, yyyy')}
                    />
                    <Area 
                      type="monotone" 
                      dataKey="count" 
                      stroke="#8884d8" 
                      fill="#8884d8" 
                      fillOpacity={0.6}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Users by Role */}
            <Card>
              <CardHeader>
                <CardTitle>Users by Role</CardTitle>
                <CardDescription>Distribution of user roles</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={userAnalytics?.usersByRole || []}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ role, count }) => `${role}: ${count}`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="count"
                    >
                      {(userAnalytics?.usersByRole || []).map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          {/* Top Users Table */}
          <Card>
            <CardHeader>
              <CardTitle>Top Users by Activity</CardTitle>
              <CardDescription>Most active users by credits used</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {userAnalytics?.topUsers?.map((user, index) => (
                  <div key={user.id} className="flex items-center justify-between p-2 rounded-lg hover:bg-accent">
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-medium">{index + 1}.</span>
                      <div>
                        <p className="text-sm font-medium">{user.name || user.email}</p>
                        <p className="text-xs text-muted-foreground">{user.email}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium">{Number(user.credits_used).toLocaleString()} credits</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Documents Tab */}
        <TabsContent value="documents" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            {/* Processing Stats */}
            <Card>
              <CardHeader>
                <CardTitle>Document Processing</CardTitle>
                <CardDescription>Daily processing statistics</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={documentAnalytics?.processingStats || []}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis 
                      dataKey="date" 
                      tickFormatter={(date) => format(new Date(date), 'MMM d')}
                    />
                    <YAxis />
                    <Tooltip 
                      labelFormatter={(date) => format(new Date(date), 'MMM d, yyyy')}
                    />
                    <Legend />
                    <Line type="monotone" dataKey="completed" stroke="#00C49F" name="Completed" strokeWidth={2} />
                    <Line type="monotone" dataKey="failed" stroke="#FF8042" name="Failed" strokeWidth={2} />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Document Status Distribution */}
            <Card>
              <CardHeader>
                <CardTitle>Document Status</CardTitle>
                <CardDescription>Current distribution by status</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={documentAnalytics?.documentsByStatus || []}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="status" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="count" fill="#8884d8">
                      {(documentAnalytics?.documentsByStatus || []).map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          {/* Performance Metrics */}
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Avg Processing Time</CardTitle>
                <Activity className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {(documentAnalytics?.averageProcessingTime || 0).toFixed(2)}s
                </div>
                <p className="text-xs text-muted-foreground">per document</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Success Rate</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {documentAnalytics?.documentsByStatus ? 
                    (
                      (documentAnalytics.documentsByStatus.find(s => s.status === 'completed')?.count || 0) / 
                      documentAnalytics.documentsByStatus.reduce((acc, s) => acc + s.count, 0) * 100
                    ).toFixed(1) : '0'
                  }%
                </div>
                <p className="text-xs text-muted-foreground">completion rate</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Processed</CardTitle>
                <FileText className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {documentAnalytics?.documentsByStatus?.reduce((acc, s) => acc + s.count, 0) || 0}
                </div>
                <p className="text-xs text-muted-foreground">all time</p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Credits Tab */}
        <TabsContent value="credits" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            {/* Credit Usage Over Time */}
            <Card>
              <CardHeader>
                <CardTitle>Credit Flow</CardTitle>
                <CardDescription>Credits added vs used over time</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={creditAnalytics?.creditUsage || []}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis 
                      dataKey="date" 
                      tickFormatter={(date) => format(new Date(date), 'MMM d')}
                    />
                    <YAxis />
                    <Tooltip 
                      labelFormatter={(date) => format(new Date(date), 'MMM d, yyyy')}
                    />
                    <Legend />
                    <Line type="monotone" dataKey="used" stroke="#FF8042" name="Used" strokeWidth={2} />
                    <Line type="monotone" dataKey="added" stroke="#00C49F" name="Added" strokeWidth={2} />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Credit Distribution */}
            <Card>
              <CardHeader>
                <CardTitle>Credit Distribution</CardTitle>
                <CardDescription>Users grouped by credit balance</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={creditAnalytics?.creditDistribution || []}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="range" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="count" fill="#8884d8">
                      {(creditAnalytics?.creditDistribution || []).map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          {/* Transaction Summary */}
          <Card>
            <CardHeader>
              <CardTitle>Transaction Summary</CardTitle>
              <CardDescription>Breakdown by transaction type</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {creditAnalytics?.transactionsByType?.map((transaction) => (
                  <div key={transaction.type} className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">{transaction.type}</p>
                      <p className="text-sm text-muted-foreground">
                        {transaction.count} transactions
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-medium">{transaction.total.toLocaleString()} credits</p>
                      <p className="text-sm text-muted-foreground">
                        avg: {(transaction.total / transaction.count).toFixed(1)} per transaction
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Revenue Tab */}
        <TabsContent value="revenue" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
                <CreditCard className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  ${(revenueAnalytics?.totalRevenue || 0).toFixed(2)}
                </div>
                <p className="text-xs text-muted-foreground">last {dateRange} days</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Avg Purchase</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {revenueAnalytics?.averagePurchase?.toFixed(0) || 0} credits
                </div>
                <p className="text-xs text-muted-foreground">
                  ${(revenueAnalytics?.averageRevenue || 0).toFixed(2)} per purchase
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Purchases</CardTitle>
                <Activity className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {revenueAnalytics?.revenueOverTime?.reduce((acc, day) => acc + Number(day.purchases), 0) || 0}
                </div>
                <p className="text-xs text-muted-foreground">credit purchases</p>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {/* Revenue Over Time */}
            <Card>
              <CardHeader>
                <CardTitle>Revenue Trend</CardTitle>
                <CardDescription>Daily revenue from credit purchases</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <AreaChart data={revenueAnalytics?.revenueOverTime || []}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis 
                      dataKey="date" 
                      tickFormatter={(date) => format(new Date(date), 'MMM d')}
                    />
                    <YAxis tickFormatter={(value) => `$${value}`} />
                    <Tooltip 
                      labelFormatter={(date) => format(new Date(date), 'MMM d, yyyy')}
                      formatter={(value) => [`$${Number(value).toFixed(2)}`, 'Revenue']}
                    />
                    <Area 
                      type="monotone" 
                      dataKey="revenue" 
                      stroke="#00C49F" 
                      fill="#00C49F" 
                      fillOpacity={0.6}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Revenue by Package Size */}
            <Card>
              <CardHeader>
                <CardTitle>Package Distribution</CardTitle>
                <CardDescription>Revenue by credit package size</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={revenueAnalytics?.revenueByPackage || []}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ package_size, revenue }) => `${package_size}: $${Number(revenue).toFixed(2)}`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="revenue"
                    >
                      {(revenueAnalytics?.revenueByPackage || []).map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value) => `$${Number(value).toFixed(2)}`} />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          {/* Package Details */}
          <Card>
            <CardHeader>
              <CardTitle>Package Sales</CardTitle>
              <CardDescription>Breakdown by package size</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {revenueAnalytics?.revenueByPackage?.map((pkg) => (
                  <div key={pkg.package_size} className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">{pkg.package_size} credits</p>
                      <p className="text-sm text-muted-foreground">
                        {pkg.count} purchases
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-medium">${Number(pkg.revenue).toFixed(2)}</p>
                      <p className="text-sm text-muted-foreground">
                        ${(Number(pkg.revenue) / pkg.count).toFixed(2)} avg
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Errors Tab */}
        <TabsContent value="errors" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Recent Errors</CardTitle>
              <CardDescription>Failed document processing attempts</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {errorLogs?.map((error) => (
                  <div key={error.id} className="rounded-lg border p-3">
                    <div className="flex items-start justify-between">
                      <div className="space-y-1">
                        <p className="text-sm font-medium">{error.fileName}</p>
                        <p className="text-sm text-red-600">{error.error}</p>
                        <p className="text-xs text-muted-foreground">
                          {error.user?.email || 'Unknown user'} • {format(new Date(error.createdAt), 'MMM d, yyyy HH:mm')}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
                {(!errorLogs || errorLogs.length === 0) && (
                  <p className="text-center text-muted-foreground">No errors found</p>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}