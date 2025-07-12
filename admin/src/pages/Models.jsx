import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/config/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Search, 
  RefreshCw, 
  Settings, 
  BarChart3, 
  Users, 
  Eye, 
  EyeOff,
  MoreVertical,
  FileText,
  Check,
  X,
  Globe,
  Lock,
  Zap,
  AlertCircle
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import ModelConfigModal from '@/components/models/ModelConfigModal';
import ModelStatsModal from '@/components/models/ModelStatsModal';
import ModelAccessModal from '@/components/models/ModelAccessModal';
import FieldConfigModal from '@/components/models/FieldConfigModal';

export default function Models() {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [syncing, setSyncing] = useState(false);
  const [selectedModel, setSelectedModel] = useState(null);
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [showStatsModal, setShowStatsModal] = useState(false);
  const [showAccessModal, setShowAccessModal] = useState(false);
  const [showFieldsModal, setShowFieldsModal] = useState(false);
  const queryClient = useQueryClient();

  // Fetch models
  const { data: modelsData, isLoading, refetch } = useQuery({
    queryKey: ['adminModels', search, filter],
    queryFn: async () => {
      const response = await api.get('/admin/models', {
        params: { search, filter }
      });
      return response.data;
    },
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  // Sync models mutation
  const syncModelsMutation = useMutation({
    mutationFn: async () => {
      const response = await api.post('/admin/models/sync');
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['adminModels']);
      setSyncing(false);
    },
    onError: () => {
      setSyncing(false);
    }
  });

  // Update model configuration mutation
  const updateModelMutation = useMutation({
    mutationFn: async ({ configId, data }) => {
      const response = await api.patch(`/admin/models/${configId}`, data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['adminModels']);
    }
  });

  // Configure new model mutation
  const configureModelMutation = useMutation({
    mutationFn: async ({ modelId, data }) => {
      const response = await api.post(`/admin/models/${modelId}/configure`, data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['adminModels']);
    }
  });

  const handleSyncModels = () => {
    setSyncing(true);
    syncModelsMutation.mutate();
  };

  const handleToggleActive = (model) => {
    if (model.isConfigured) {
      updateModelMutation.mutate({
        configId: model.id,
        data: { isActive: !model.isActive }
      });
    }
  };

  const handleTogglePublic = (model) => {
    if (model.isConfigured) {
      updateModelMutation.mutate({
        configId: model.id,
        data: { isPublic: !model.isPublic }
      });
    }
  };

  const getModelStatus = (model) => {
    if (model.isAzureModel && !model.isConfigured) {
      return { label: 'Not Configured', variant: 'secondary' };
    }
    if (!model.isActive) {
      return { label: 'Inactive', variant: 'destructive' };
    }
    if (model.status === 'training') {
      return { label: 'Training', variant: 'warning' };
    }
    return { label: 'Active', variant: 'success' };
  };

  const getAccessBadge = (model) => {
    if (model.isPublic) {
      return { icon: Globe, label: 'Public', className: 'text-green-600 dark:text-green-400' };
    }
    return { icon: Lock, label: 'Private', className: 'text-orange-600 dark:text-orange-400' };
  };

  const models = modelsData?.models || [];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-indigo-600 to-purple-600 dark:from-indigo-400 dark:to-purple-400 bg-clip-text text-transparent">
          Models
        </h2>
        <p className="text-gray-600 dark:text-gray-300 mt-2">
          Manage Azure Document Intelligence models and configurations
        </p>
      </div>

      {/* Actions Bar */}
      <Card className="border-0 shadow-xl bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm">
        <CardHeader className="bg-gradient-to-r from-violet-50 to-purple-50 dark:from-violet-900/20 dark:to-purple-900/20 border-b border-gray-200/50 dark:border-gray-700/50">
          <div className="flex flex-col lg:flex-row gap-4 justify-between">
            <div className="flex-1 flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search models..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-10 border-gray-300 dark:border-gray-600 focus:border-indigo-500 dark:focus:border-indigo-400 transition-colors duration-200"
                />
              </div>
              <Select value={filter} onValueChange={setFilter}>
                <SelectTrigger className="w-full sm:w-[180px]">
                  <SelectValue placeholder="Filter models" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Models</SelectItem>
                  <SelectItem value="active">Active Only</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                  <SelectItem value="public">Public</SelectItem>
                  <SelectItem value="private">Private</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button
              onClick={handleSyncModels}
              disabled={syncing || syncModelsMutation.isLoading}
              className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white shadow-lg"
            >
              <RefreshCw className={`mr-2 h-4 w-4 ${syncing ? 'animate-spin' : ''}`} />
              Sync with Azure
            </Button>
          </div>
        </CardHeader>
      </Card>

      {/* Models List */}
      {isLoading ? (
        <div className="text-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent mx-auto"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-400">Loading models...</p>
        </div>
      ) : models.length === 0 ? (
        <Card className="border-0 shadow-xl bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm">
          <CardContent className="text-center py-12">
            <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500 dark:text-gray-400">No models found</p>
            <Button
              onClick={handleSyncModels}
              className="mt-4 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white"
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              Sync Models from Azure
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
          {models.map((model) => {
            const status = getModelStatus(model);
            const access = getAccessBadge(model);
            const AccessIcon = access.icon;

            return (
              <Card key={model.id || model.azureModelId} className="border-0 shadow-xl bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm hover:shadow-2xl transition-all duration-300 group overflow-hidden">
                {/* Model Header */}
                <CardHeader className="pb-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <CardTitle className="text-lg font-semibold text-gray-900 dark:text-white truncate">
                        {model.customName || model.name || model.azureModelId}
                      </CardTitle>
                      {model.azureModelId && (
                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                          Azure ID: {model.azureModelId}
                        </p>
                      )}
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuLabel>Actions</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => {
                          setSelectedModel(model);
                          setShowConfigModal(true);
                        }}>
                          <Settings className="mr-2 h-4 w-4" />
                          Configure
                        </DropdownMenuItem>
                        {model.isConfigured && (
                          <DropdownMenuItem onClick={() => {
                            setSelectedModel(model);
                            setShowFieldsModal(true);
                          }}>
                            <FileText className="mr-2 h-4 w-4" />
                            Configure Fields
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem onClick={() => {
                          setSelectedModel(model);
                          setShowStatsModal(true);
                        }}>
                          <BarChart3 className="mr-2 h-4 w-4" />
                          View Stats
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => {
                          setSelectedModel(model);
                          setShowAccessModal(true);
                        }}>
                          <Users className="mr-2 h-4 w-4" />
                          Manage Access
                        </DropdownMenuItem>
                        {model.isConfigured && (
                          <>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => handleToggleActive(model)}>
                              {model.isActive ? (
                                <>
                                  <EyeOff className="mr-2 h-4 w-4" />
                                  Deactivate
                                </>
                              ) : (
                                <>
                                  <Eye className="mr-2 h-4 w-4" />
                                  Activate
                                </>
                              )}
                            </DropdownMenuItem>
                          </>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>

                  {/* Badges */}
                  <div className="flex items-center gap-2 mt-3">
                    <Badge variant={status.variant} className="text-xs">
                      {status.label}
                    </Badge>
                    {model.isConfigured && (
                      <Badge variant="outline" className="text-xs flex items-center gap-1">
                        <AccessIcon className={`h-3 w-3 ${access.className}`} />
                        {access.label}
                      </Badge>
                    )}
                    {model.isAzureModel && (
                      <Badge variant="secondary" className="text-xs">
                        Azure
                      </Badge>
                    )}
                  </div>
                </CardHeader>

                {/* Model Description */}
                <CardContent className="pt-0 pb-4">
                  <CardDescription className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2">
                    {model.description || 'No description available'}
                  </CardDescription>

                  {/* Stats */}
                  {model.isConfigured && (
                    <div className="grid grid-cols-2 gap-4 mt-4 pt-4 border-t border-gray-200/50 dark:border-gray-700/50">
                      <div className="flex items-center gap-2">
                        <Users className="h-4 w-4 text-gray-400" />
                        <span className="text-sm text-gray-600 dark:text-gray-300">
                          {model.usageCount || 0} users
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Zap className="h-4 w-4 text-gray-400" />
                        <span className="text-sm text-gray-600 dark:text-gray-300">
                          {model._count?.jobs || 0} jobs
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Quick Actions */}
                  <div className="flex items-center gap-2 mt-4">
                    {!model.isConfigured ? (
                      <Button
                        size="sm"
                        className="flex-1 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white"
                        onClick={() => {
                          setSelectedModel(model);
                          setShowConfigModal(true);
                        }}
                      >
                        <Settings className="mr-2 h-4 w-4" />
                        Configure
                      </Button>
                    ) : (
                      <>
                        <Button
                          size="sm"
                          variant="outline"
                          className="flex-1"
                          onClick={() => handleTogglePublic(model)}
                        >
                          {model.isPublic ? (
                            <>
                              <Lock className="mr-2 h-4 w-4" />
                              Make Private
                            </>
                          ) : (
                            <>
                              <Globe className="mr-2 h-4 w-4" />
                              Make Public
                            </>
                          )}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setSelectedModel(model);
                            setShowStatsModal(true);
                          }}
                        >
                          <BarChart3 className="h-4 w-4" />
                        </Button>
                      </>
                    )}
                  </div>

                  {/* Creator Info */}
                  {model.creator && (
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-3">
                      Created by {model.creator.email}
                    </p>
                  )}
                </CardContent>

                {/* Sync Status Indicator */}
                {model.isAzureModel && !model.isConfigured && (
                  <div className="absolute top-2 right-2">
                    <div className="h-2 w-2 bg-yellow-500 rounded-full animate-pulse" title="Not configured" />
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {/* Sync Status */}
      {syncModelsMutation.isSuccess && (
        <Card className="border-0 shadow-xl bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20">
          <CardContent className="flex items-center gap-3 py-4">
            <Check className="h-5 w-5 text-green-600 dark:text-green-400" />
            <p className="text-sm text-green-700 dark:text-green-300">
              {syncModelsMutation.data?.message || 'Models synced successfully'}
              {syncModelsMutation.data?.newModels?.length > 0 && (
                <span className="font-medium ml-1">
                  ({syncModelsMutation.data.newModels.length} new models found)
                </span>
              )}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Error Message */}
      {(syncModelsMutation.isError || updateModelMutation.isError) && (
        <Card className="border-0 shadow-xl bg-gradient-to-r from-red-50 to-rose-50 dark:from-red-900/20 dark:to-rose-900/20">
          <CardContent className="flex items-center gap-3 py-4">
            <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400" />
            <p className="text-sm text-red-700 dark:text-red-300">
              An error occurred. Please try again.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Model Configuration Modal */}
      {selectedModel && (
        <ModelConfigModal
          model={selectedModel}
          isOpen={showConfigModal}
          onClose={() => {
            setShowConfigModal(false);
            setSelectedModel(null);
          }}
        />
      )}

      {/* Model Statistics Modal */}
      {selectedModel && (
        <ModelStatsModal
          model={selectedModel}
          isOpen={showStatsModal}
          onClose={() => {
            setShowStatsModal(false);
            setSelectedModel(null);
          }}
        />
      )}

      {/* Model Access Modal */}
      {selectedModel && (
        <ModelAccessModal
          model={selectedModel}
          isOpen={showAccessModal}
          onClose={() => {
            setShowAccessModal(false);
            setSelectedModel(null);
          }}
        />
      )}

      {/* Field Configuration Modal */}
      {selectedModel && (
        <FieldConfigModal
          modelConfig={selectedModel}
          isOpen={showFieldsModal}
          onClose={() => {
            setShowFieldsModal(false);
            setSelectedModel(null);
          }}
          onUpdate={(updatedModel) => {
            queryClient.invalidateQueries(['adminModels']);
          }}
        />
      )}
    </div>
  );
}