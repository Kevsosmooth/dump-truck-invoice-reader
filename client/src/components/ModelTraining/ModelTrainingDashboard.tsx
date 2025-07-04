import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Brain,
  Plus,
  FileText,
  Clock,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  Upload,
  Tag,
  TestTube,
  Trash2,
  Info
} from 'lucide-react';

interface CustomModel {
  id: string;
  name: string;
  description?: string;
  createdAt: string;
  status: 'active' | 'training' | 'failed';
}

interface ModelQuota {
  used: number;
  limit: number;
  subscriptionTier: string;
}

interface ModelTrainingDashboardProps {
  onCreateNew: () => void;
}

export function ModelTrainingDashboard({ onCreateNew }: ModelTrainingDashboardProps) {
  const [models, setModels] = useState<CustomModel[]>([]);
  const [quota, setQuota] = useState<ModelQuota>({ used: 0, limit: 2, subscriptionTier: 'professional' });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchModels();
    fetchQuota();
  }, []);

  const fetchModels = async () => {
    try {
      const response = await fetch('http://localhost:3003/api/models');
      if (response.ok) {
        const data = await response.json();
        setModels(data.models);
      }
    } catch (error) {
      console.error('Failed to fetch models:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchQuota = async () => {
    try {
      const response = await fetch('http://localhost:3003/api/models/account-info');
      if (response.ok) {
        const data = await response.json();
        setQuota({
          used: data.customModelCount,
          limit: data.customModelLimit,
          subscriptionTier: data.subscriptionTier
        });
      }
    } catch (error) {
      console.error('Failed to fetch quota:', error);
    }
  };

  const handleDeleteModel = async (modelId: string) => {
    if (!confirm('Are you sure you want to delete this model? This action cannot be undone.')) {
      return;
    }

    try {
      const response = await fetch(`http://localhost:3003/api/models/${modelId}`, {
        method: 'DELETE'
      });
      
      if (response.ok) {
        setModels(models.filter(m => m.id !== modelId));
        setQuota(prev => ({ ...prev, used: prev.used - 1 }));
      }
    } catch (error) {
      console.error('Failed to delete model:', error);
      alert('Failed to delete model');
    }
  };

  const canCreateMore = quota.used < quota.limit;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Custom AI Models</h2>
        <p className="text-gray-600 mt-1">
          Train custom models to extract data from your specific document types
        </p>
      </div>

      {/* Quota Card */}
      <Card className="border-0 shadow-lg bg-gradient-to-br from-indigo-500 to-purple-600 text-white">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-indigo-100 text-sm">Model Quota</p>
              <p className="text-3xl font-bold mt-1">{quota.used} / {quota.limit}</p>
              <div className="flex items-center gap-2 mt-2">
                <Badge variant="secondary" className="bg-white/20 text-white border-0">
                  {quota.subscriptionTier} plan
                </Badge>
              </div>
            </div>
            <div className="text-right">
              <Progress 
                value={(quota.used / quota.limit) * 100} 
                className="w-32 h-2 bg-white/20"
              />
              <p className="text-xs text-indigo-100 mt-1">
                {quota.limit - quota.used} models remaining
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Create New Button */}
      {canCreateMore ? (
        <Button 
          size="lg" 
          onClick={onCreateNew}
          className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700"
        >
          <Plus className="h-5 w-5 mr-2" />
          Create New Custom Model
        </Button>
      ) : (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            You've reached your model limit. Upgrade your plan to create more custom models.
          </AlertDescription>
        </Alert>
      )}

      {/* Models Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => (
            <Card key={i} className="animate-pulse">
              <CardHeader>
                <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                <div className="h-3 bg-gray-200 rounded w-1/2 mt-2"></div>
              </CardHeader>
            </Card>
          ))}
        </div>
      ) : models.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Brain className="h-12 w-12 text-gray-400 mb-4" />
            <h3 className="text-lg font-medium text-gray-900">No custom models yet</h3>
            <p className="text-sm text-gray-500 mt-1 text-center max-w-sm">
              Create your first custom model to extract data from your specific document types
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {models.map(model => (
            <ModelCard 
              key={model.id}
              model={model}
              onDelete={() => handleDeleteModel(model.id)}
            />
          ))}
        </div>
      )}

      {/* Info Section */}
      <Card className="bg-blue-50 border-blue-200">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Info className="h-5 w-5 text-blue-600" />
            How Custom Models Work
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-3">
            <div className="flex-shrink-0 w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
              <Upload className="h-4 w-4 text-blue-600" />
            </div>
            <div>
              <p className="font-medium text-sm">1. Upload Training Documents</p>
              <p className="text-sm text-gray-600">Upload at least 5 similar documents</p>
            </div>
          </div>
          <div className="flex gap-3">
            <div className="flex-shrink-0 w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
              <Tag className="h-4 w-4 text-blue-600" />
            </div>
            <div>
              <p className="font-medium text-sm">2. Label Your Fields</p>
              <p className="text-sm text-gray-600">Draw boxes and name the fields to extract</p>
            </div>
          </div>
          <div className="flex gap-3">
            <div className="flex-shrink-0 w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
              <Brain className="h-4 w-4 text-blue-600" />
            </div>
            <div>
              <p className="font-medium text-sm">3. Train Your Model</p>
              <p className="text-sm text-gray-600">AI learns from your labels (20-30 min)</p>
            </div>
          </div>
          <div className="flex gap-3">
            <div className="flex-shrink-0 w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
              <Sparkles className="h-4 w-4 text-blue-600" />
            </div>
            <div>
              <p className="font-medium text-sm">4. Use Your Model</p>
              <p className="text-sm text-gray-600">Process new documents with your custom AI</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

interface ModelCardProps {
  model: CustomModel;
  onDelete: () => void;
}

function ModelCard({ model, onDelete }: ModelCardProps) {
  const [showTest, setShowTest] = useState(false);

  const statusConfig = {
    active: {
      color: 'text-emerald-600 bg-emerald-50 border-emerald-200',
      icon: <CheckCircle2 className="h-4 w-4" />
    },
    training: {
      color: 'text-blue-600 bg-blue-50 border-blue-200',
      icon: <Clock className="h-4 w-4" />
    },
    failed: {
      color: 'text-red-600 bg-red-50 border-red-200',
      icon: <AlertCircle className="h-4 w-4" />
    }
  };

  const config = statusConfig[model.status];

  return (
    <Card className="hover:shadow-lg transition-shadow">
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <CardTitle className="text-lg">{model.name}</CardTitle>
            {model.description && (
              <CardDescription className="mt-1">{model.description}</CardDescription>
            )}
          </div>
          <Badge 
            variant="outline" 
            className={`${config.color} flex items-center gap-1`}
          >
            {config.icon}
            {model.status}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          <div className="flex items-center text-sm text-gray-600">
            <Clock className="h-4 w-4 mr-2" />
            Created {new Date(model.createdAt).toLocaleDateString()}
          </div>
          
          {model.status === 'active' && (
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setShowTest(!showTest)}
                className="flex-1"
              >
                <TestTube className="h-4 w-4 mr-1" />
                Test
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={onDelete}
                className="text-red-600 hover:bg-red-50"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>

        {showTest && (
          <div className="mt-4 p-3 bg-gray-50 rounded-lg">
            <p className="text-sm text-gray-600">
              Test interface coming soon...
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}