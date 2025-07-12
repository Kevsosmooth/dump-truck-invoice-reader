import { useQuery } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { BarChart3, Users, FileText, CheckCircle, XCircle, Clock, TrendingUp } from 'lucide-react';
import api from '@/config/api';

export default function ModelStatsModal({ model, isOpen, onClose }) {
  // Fetch model statistics
  const { data: stats, isLoading } = useQuery({
    queryKey: ['modelStats', model?.id],
    queryFn: async () => {
      if (!model?.id || !model?.isConfigured) return null;
      const response = await api.get(`/admin/models/${model.id}/stats`);
      return response.data.stats;
    },
    enabled: isOpen && model?.isConfigured,
  });

  const getStatusColor = (status) => {
    switch (status) {
      case 'COMPLETED': return 'text-green-600 dark:text-green-400';
      case 'FAILED': return 'text-red-600 dark:text-red-400';
      case 'PROCESSING': return 'text-blue-600 dark:text-blue-400';
      default: return 'text-gray-600 dark:text-gray-400';
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'COMPLETED': return CheckCircle;
      case 'FAILED': return XCircle;
      case 'PROCESSING': return Clock;
      default: return FileText;
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px] bg-white/95 dark:bg-gray-800/95 backdrop-blur-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
            Model Statistics
          </DialogTitle>
          <DialogDescription>
            Performance and usage statistics for {model?.customName || model?.name}
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex justify-center py-8">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent"></div>
          </div>
        ) : !stats ? (
          <div className="text-center py-8 text-gray-500 dark:text-gray-400">
            No statistics available for this model
          </div>
        ) : (
          <div className="space-y-6">
            {/* Overview Cards */}
            <div className="grid grid-cols-2 gap-4">
              <Card className="border-0 shadow-lg bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-300">Total Users</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-2">
                    <Users className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                    <span className="text-2xl font-bold text-gray-900 dark:text-white">{stats.totalUsers || 0}</span>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-0 shadow-lg bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-300">Total Jobs</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-2">
                    <FileText className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                    <span className="text-2xl font-bold text-gray-900 dark:text-white">{stats.totalJobs || 0}</span>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Success Rate */}
            {stats.totalJobs > 0 && (
              <Card className="border-0 shadow-lg">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-300">Success Rate</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-4">
                    <TrendingUp className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                    <div className="flex-1">
                      <div className="flex items-baseline gap-2">
                        <span className="text-2xl font-bold text-gray-900 dark:text-white">
                          {Math.round((stats.successRate / stats.totalJobs) * 100)}%
                        </span>
                        <span className="text-sm text-gray-500 dark:text-gray-400">
                          ({stats.successRate} successful)
                        </span>
                      </div>
                      <div className="mt-2 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-gradient-to-r from-emerald-500 to-teal-600 transition-all duration-500"
                          style={{ width: `${Math.round((stats.successRate / stats.totalJobs) * 100)}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Jobs by Status */}
            {stats.jobsByStatus && Object.keys(stats.jobsByStatus).length > 0 && (
              <Card className="border-0 shadow-lg">
                <CardHeader>
                  <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-300">Jobs by Status</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {Object.entries(stats.jobsByStatus).map(([status, count]) => {
                      const Icon = getStatusIcon(status);
                      return (
                        <div key={status} className="flex items-center justify-between p-3 rounded-lg bg-gray-50 dark:bg-gray-900/50">
                          <div className="flex items-center gap-3">
                            <Icon className={`h-5 w-5 ${getStatusColor(status)}`} />
                            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                              {status}
                            </span>
                          </div>
                          <Badge variant="secondary" className="font-semibold">
                            {count}
                          </Badge>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Model Info */}
            <div className="text-sm text-gray-500 dark:text-gray-400 space-y-1">
              <p>Model ID: {model?.azureModelId}</p>
              {model?.creator && <p>Created by: {model.creator.email}</p>}
              {model?.createdAt && <p>Created: {new Date(model.createdAt).toLocaleDateString()}</p>}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}