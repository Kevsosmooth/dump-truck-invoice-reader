import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { AlertCircle, Settings } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/config/api';
import { toast } from 'sonner';

export default function ModelConfigModal({ model, isOpen, onClose }) {
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({
    customName: model?.customName || model?.name || '',
    description: model?.description || '',
    isActive: model?.isActive ?? true,
    isPublic: model?.isPublic ?? false,
  });
  const [errors, setErrors] = useState({});

  // Configure or update model mutation
  const configMutation = useMutation({
    mutationFn: async (data) => {
      if (model?.isConfigured) {
        // Update existing configuration
        const response = await api.patch(`/admin/models/${model.id}`, data);
        return response.data;
      } else {
        // Configure new model
        const response = await api.post(`/admin/models/${model.id || model.azureModelId}/configure`, data);
        return response.data;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['adminModels']);
      toast.success(model?.isConfigured ? 'Model updated successfully' : 'Model configured successfully');
      onClose();
    },
    onError: (error) => {
      const errorMessage = error.response?.data?.error || 'Failed to save model configuration';
      toast.error(errorMessage);
    }
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    
    // Validate form
    const newErrors = {};
    if (!formData.customName.trim()) {
      newErrors.customName = 'Custom name is required';
    }
    
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    configMutation.mutate(formData);
  };

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: undefined }));
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px] bg-white/95 dark:bg-gray-800/95 backdrop-blur-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
            {model?.isConfigured ? 'Update Model Configuration' : 'Configure Model'}
          </DialogTitle>
          <DialogDescription>
            {model?.isConfigured 
              ? 'Update the configuration for this model.'
              : 'Configure this Azure model to make it available for users.'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Azure Model Info */}
          {model?.azureModelId && (
            <div className="rounded-lg bg-gray-50 dark:bg-gray-900/50 p-3 text-sm">
              <p className="text-gray-600 dark:text-gray-400">
                Azure Model ID: <span className="font-medium text-gray-900 dark:text-white">{model.azureModelId}</span>
              </p>
            </div>
          )}

          {/* Custom Name */}
          <div className="space-y-2">
            <Label htmlFor="customName">Display Name *</Label>
            <Input
              id="customName"
              value={formData.customName}
              onChange={(e) => handleChange('customName', e.target.value)}
              placeholder="Enter a user-friendly name"
              className={errors.customName ? 'border-red-500' : ''}
            />
            {errors.customName && (
              <p className="text-sm text-red-600 dark:text-red-400 flex items-center gap-1">
                <AlertCircle className="h-3 w-3" />
                {errors.customName}
              </p>
            )}
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => handleChange('description', e.target.value)}
              placeholder="Describe what this model does..."
              rows={3}
              className="resize-none"
            />
          </div>

          {/* Settings */}
          <div className="space-y-4 border-t pt-4">
            {/* Active Toggle */}
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="isActive" className="text-base">Active</Label>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Enable this model for processing
                </p>
              </div>
              <Switch
                id="isActive"
                checked={formData.isActive}
                onCheckedChange={(checked) => handleChange('isActive', checked)}
              />
            </div>

            {/* Public Toggle */}
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="isPublic" className="text-base">Public Access</Label>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Allow all users to use this model
                </p>
              </div>
              <Switch
                id="isPublic"
                checked={formData.isPublic}
                onCheckedChange={(checked) => handleChange('isPublic', checked)}
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button 
              type="submit" 
              disabled={configMutation.isLoading}
              className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white"
            >
              {configMutation.isLoading ? 'Saving...' : (model?.isConfigured ? 'Update' : 'Configure')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}