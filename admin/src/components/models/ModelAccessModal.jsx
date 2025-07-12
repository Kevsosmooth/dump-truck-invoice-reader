import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent } from '@/components/ui/card';
import { Users, Search, UserPlus, Shield, Eye, Edit, Calendar } from 'lucide-react';
import api from '@/config/api';
import { toast } from 'sonner';

export default function ModelAccessModal({ model, isOpen, onClose }) {
  const queryClient = useQueryClient();
  const [searchEmail, setSearchEmail] = useState('');
  const [selectedUser, setSelectedUser] = useState(null);
  const [permissions, setPermissions] = useState({
    canRead: true,
    canUse: true,
    canEdit: false,
  });

  // Fetch users with access
  const { data: accessList, isLoading: isLoadingAccess } = useQuery({
    queryKey: ['modelAccess', model?.id],
    queryFn: async () => {
      if (!model?.id || !model?.isConfigured) return [];
      // TODO: Implement endpoint to fetch model access list
      return [];
    },
    enabled: isOpen && model?.isConfigured,
  });

  // Search users
  const { data: searchResults, isLoading: isSearching } = useQuery({
    queryKey: ['userSearch', searchEmail],
    queryFn: async () => {
      if (!searchEmail || searchEmail.length < 3) return [];
      const response = await api.get('/admin/users', {
        params: { search: searchEmail, limit: 5 }
      });
      return response.data.users;
    },
    enabled: searchEmail.length >= 3,
  });

  // Grant access mutation
  const grantAccessMutation = useMutation({
    mutationFn: async (data) => {
      const response = await api.post(`/admin/models/${model.id}/access`, data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['modelAccess', model.id]);
      toast.success('Access granted successfully');
      setSelectedUser(null);
      setSearchEmail('');
      setPermissions({ canRead: true, canUse: true, canEdit: false });
    },
    onError: (error) => {
      toast.error(error.response?.data?.error || 'Failed to grant access');
    }
  });

  const handleGrantAccess = () => {
    if (!selectedUser) return;
    
    grantAccessMutation.mutate({
      userId: selectedUser.id,
      ...permissions
    });
  };

  const getPermissionBadges = (access) => {
    const badges = [];
    if (access.canRead) badges.push({ label: 'Read', icon: Eye });
    if (access.canUse) badges.push({ label: 'Use', icon: Shield });
    if (access.canEdit) badges.push({ label: 'Edit', icon: Edit });
    return badges;
  };

  if (!model?.isConfigured) {
    return null;
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px] bg-white/95 dark:bg-gray-800/95 backdrop-blur-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
            Manage Model Access
          </DialogTitle>
          <DialogDescription>
            Control who can access and use the "{model.customName}" model.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Grant New Access */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium text-gray-900 dark:text-white">Grant Access</h3>
            
            {/* User Search */}
            <div className="space-y-2">
              <Label htmlFor="userSearch">Search User by Email</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  id="userSearch"
                  value={searchEmail}
                  onChange={(e) => setSearchEmail(e.target.value)}
                  placeholder="Enter email address..."
                  className="pl-10"
                />
              </div>
            </div>

            {/* Search Results */}
            {isSearching ? (
              <div className="text-center py-4">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent mx-auto"></div>
              </div>
            ) : searchResults && searchResults.length > 0 ? (
              <div className="space-y-2">
                {searchResults.map((user) => (
                  <Card 
                    key={user.id} 
                    className={`cursor-pointer transition-all ${
                      selectedUser?.id === user.id 
                        ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20' 
                        : 'hover:border-gray-300 dark:hover:border-gray-600'
                    }`}
                    onClick={() => setSelectedUser(user)}
                  >
                    <CardContent className="p-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium text-gray-900 dark:text-white">{user.email}</p>
                          <p className="text-sm text-gray-500 dark:text-gray-400">
                            {user.firstName} {user.lastName} • {user.credits} credits
                          </p>
                        </div>
                        {selectedUser?.id === user.id && (
                          <Badge variant="secondary">Selected</Badge>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : searchEmail.length >= 3 ? (
              <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">
                No users found
              </p>
            ) : null}

            {/* Permissions */}
            {selectedUser && (
              <div className="space-y-3 p-4 rounded-lg bg-gray-50 dark:bg-gray-900/50">
                <h4 className="text-sm font-medium text-gray-900 dark:text-white">Permissions</h4>
                
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label htmlFor="canRead" className="text-sm">Read Access</Label>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        View model information
                      </p>
                    </div>
                    <Switch
                      id="canRead"
                      checked={permissions.canRead}
                      onCheckedChange={(checked) => 
                        setPermissions(prev => ({ ...prev, canRead: checked }))
                      }
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label htmlFor="canUse" className="text-sm">Use Access</Label>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        Process documents with this model
                      </p>
                    </div>
                    <Switch
                      id="canUse"
                      checked={permissions.canUse}
                      onCheckedChange={(checked) => 
                        setPermissions(prev => ({ ...prev, canUse: checked }))
                      }
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label htmlFor="canEdit" className="text-sm">Edit Access</Label>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        Modify model configuration
                      </p>
                    </div>
                    <Switch
                      id="canEdit"
                      checked={permissions.canEdit}
                      onCheckedChange={(checked) => 
                        setPermissions(prev => ({ ...prev, canEdit: checked }))
                      }
                    />
                  </div>
                </div>

                <Button
                  onClick={handleGrantAccess}
                  disabled={grantAccessMutation.isLoading}
                  className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white"
                >
                  <UserPlus className="mr-2 h-4 w-4" />
                  {grantAccessMutation.isLoading ? 'Granting Access...' : 'Grant Access'}
                </Button>
              </div>
            )}
          </div>

          {/* Current Access List */}
          <div className="space-y-3">
            <h3 className="text-sm font-medium text-gray-900 dark:text-white">Current Access</h3>
            
            {isLoadingAccess ? (
              <div className="text-center py-4">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent mx-auto"></div>
              </div>
            ) : !accessList || accessList.length === 0 ? (
              <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">
                No users have access to this model yet
              </p>
            ) : (
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {accessList.map((access) => (
                  <Card key={access.id} className="border-0 shadow-sm">
                    <CardContent className="p-3">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <p className="font-medium text-gray-900 dark:text-white">
                            {access.user?.email || access.organization?.name}
                          </p>
                          <div className="flex items-center gap-2 mt-1">
                            {getPermissionBadges(access).map((badge, idx) => {
                              const Icon = badge.icon;
                              return (
                                <Badge key={idx} variant="secondary" className="text-xs">
                                  <Icon className="h-3 w-3 mr-1" />
                                  {badge.label}
                                </Badge>
                              );
                            })}
                          </div>
                          {access.expiresAt && (
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              Expires: {new Date(access.expiresAt).toLocaleDateString()}
                            </p>
                          )}
                        </div>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20"
                        >
                          Revoke
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}