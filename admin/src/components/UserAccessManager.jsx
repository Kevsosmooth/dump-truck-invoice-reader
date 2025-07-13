import React, { useState, useEffect } from 'react';
import { adminAPI } from '../config/api';
import { 
  Users, 
  Search, 
  UserPlus, 
  X, 
  Calendar,
  Building,
  Mail,
  Shield,
  Trash2,
  Edit2,
  Check,
  AlertCircle
} from 'lucide-react';

const UserAccessManager = ({ modelId, modelName }) => {
  const [users, setUsers] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showAddUsers, setShowAddUsers] = useState(false);
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [customName, setCustomName] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [editingUser, setEditingUser] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (modelId) {
      fetchModelUsers();
    }
  }, [modelId]);

  const fetchModelUsers = async () => {
    try {
      setLoading(true);
      const response = await adminAPI.get(`/models/${modelId}/access`);
      setUsers(response.data.access || []);
    } catch (error) {
      console.error('Error fetching model users:', error);
      setError('Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  const searchUsers = async (query) => {
    if (!query || query.length < 2) {
      setSearchResults([]);
      return;
    }

    try {
      const response = await adminAPI.get('/models/users/search', {
        params: { q: query, excludeModel: modelId }
      });
      setSearchResults(response.data || []);
    } catch (error) {
      console.error('Error searching users:', error);
    }
  };

  const handleSearchChange = (e) => {
    const value = e.target.value;
    setSearchTerm(value);
    searchUsers(value);
  };

  const handleUserSelect = (user) => {
    if (!selectedUsers.find(u => u.id === user.id)) {
      setSelectedUsers([...selectedUsers, user]);
    }
    setSearchTerm('');
    setSearchResults([]);
  };

  const handleRemoveSelectedUser = (userId) => {
    setSelectedUsers(selectedUsers.filter(u => u.id !== userId));
  };

  const handleGrantAccess = async () => {
    if (selectedUsers.length === 0) {
      setError('Please select at least one user');
      return;
    }

    try {
      setLoading(true);
      const response = await adminAPI.post(`/models/${modelId}/access`, {
        userIds: selectedUsers.map(u => u.id),
        customName: customName || null,
        expiresAt: expiresAt || null
      });

      if (response.data.success) {
        await fetchModelUsers();
        setSelectedUsers([]);
        setCustomName('');
        setExpiresAt('');
        setShowAddUsers(false);
        setError('');
      }
    } catch (error) {
      console.error('Error granting access:', error);
      setError(error.response?.data?.error || 'Failed to grant access');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateAccess = async (userId, updates) => {
    try {
      const response = await adminAPI.patch(`/models/${modelId}/access/${userId}`, updates);
      if (response.data.success) {
        await fetchModelUsers();
        setEditingUser(null);
      }
    } catch (error) {
      console.error('Error updating access:', error);
      setError('Failed to update access');
    }
  };

  const handleRevokeAccess = async (userId) => {
    if (!window.confirm('Are you sure you want to revoke access for this user?')) {
      return;
    }

    try {
      await adminAPI.delete(`/models/${modelId}/access/${userId}`);
      await fetchModelUsers();
    } catch (error) {
      console.error('Error revoking access:', error);
      setError('Failed to revoke access');
    }
  };

  const formatDate = (date) => {
    if (!date) return 'Never';
    return new Date(date).toLocaleDateString();
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl">
      <div className="p-6 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Users className="w-5 h-5 text-gray-600 dark:text-gray-400" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">User Access</h3>
            <span className="px-2 py-1 text-xs bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-full">
              {users.length} users
            </span>
          </div>
          <button
            onClick={() => setShowAddUsers(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 dark:bg-blue-500 text-white rounded-lg hover:bg-blue-700 dark:hover:bg-blue-600 transition-colors"
          >
            <UserPlus className="w-4 h-4" />
            Grant Access
          </button>
        </div>
      </div>

      {error && (
        <div className="mx-6 mt-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-center gap-2 text-red-700 dark:text-red-400">
          <AlertCircle className="w-4 h-4" />
          {error}
        </div>
      )}

      {showAddUsers && (
        <div className="p-6 bg-gray-50 dark:bg-gray-900/50 border-b border-gray-200 dark:border-gray-700">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Search Users
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-gray-500" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={handleSearchChange}
                  placeholder="Search by name or email..."
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 rounded-lg focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-blue-500 dark:focus:border-blue-400"
                />
              </div>
              
              {searchResults.length > 0 && (
                <div className="absolute z-10 mt-1 w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg max-h-60 overflow-auto">
                  {searchResults.map(user => (
                    <button
                      key={user.id}
                      onClick={() => handleUserSelect(user)}
                      className="w-full px-4 py-2 text-left hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center justify-between transition-colors"
                    >
                      <div>
                        <div className="font-medium text-gray-900 dark:text-white">
                          {user.firstName} {user.lastName}
                        </div>
                        <div className="text-sm text-gray-600 dark:text-gray-400">{user.email}</div>
                        {user.organization && (
                          <div className="text-xs text-gray-500 dark:text-gray-500">
                            {user.organization.name}
                          </div>
                        )}
                      </div>
                      <UserPlus className="w-4 h-4 text-gray-400 dark:text-gray-500" />
                    </button>
                  ))}
                </div>
              )}
            </div>

            {selectedUsers.length > 0 && (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Selected Users
                </label>
                <div className="space-y-2">
                  {selectedUsers.map(user => (
                    <div key={user.id} className="flex items-center justify-between p-2 bg-white dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-700">
                      <div>
                        <span className="font-medium text-gray-900 dark:text-white">{user.firstName} {user.lastName}</span>
                        <span className="text-gray-600 dark:text-gray-400 ml-2">({user.email})</span>
                      </div>
                      <button
                        onClick={() => handleRemoveSelectedUser(user.id)}
                        className="text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 transition-colors"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Custom Display Name (Optional)
                </label>
                <input
                  type="text"
                  value={customName}
                  onChange={(e) => setCustomName(e.target.value)}
                  placeholder={modelName}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 rounded-lg focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
                />
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  Override how this model appears to selected users
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Access Expires (Optional)
                </label>
                <input
                  type="date"
                  value={expiresAt}
                  onChange={(e) => setExpiresAt(e.target.value)}
                  min={new Date().toISOString().split('T')[0]}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white rounded-lg focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
                />
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  Leave empty for permanent access
                </p>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleGrantAccess}
                disabled={loading || selectedUsers.length === 0}
                className="px-4 py-2 bg-blue-600 dark:bg-blue-500 text-white rounded-lg hover:bg-blue-700 dark:hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Grant Access to {selectedUsers.length} User{selectedUsers.length !== 1 ? 's' : ''}
              </button>
              <button
                onClick={() => {
                  setShowAddUsers(false);
                  setSelectedUsers([]);
                  setCustomName('');
                  setExpiresAt('');
                  setSearchTerm('');
                  setSearchResults([]);
                }}
                className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Users List */}
      <div className="p-6">
        {loading && !showAddUsers ? (
          <div className="text-center py-8">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 dark:border-blue-400"></div>
            <p className="mt-2 text-gray-600 dark:text-gray-400">Loading users...</p>
          </div>
        ) : users.length === 0 ? (
          <div className="text-center py-8 text-gray-500 dark:text-gray-400">
            <Users className="w-12 h-12 mx-auto mb-3 text-gray-300 dark:text-gray-600" />
            <p>No users have access to this model yet.</p>
            <p className="text-sm mt-1">Click "Grant Access" to add users.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {users.map((access) => (
              <div key={access.id} className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-900/50 rounded-lg">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-gray-200 dark:bg-gray-700 rounded-full flex items-center justify-center">
                    <span className="text-sm font-medium text-gray-600 dark:text-gray-300">
                      {access.user.firstName?.[0]}{access.user.lastName?.[0]}
                    </span>
                  </div>
                  <div>
                    <div className="font-medium text-gray-900 dark:text-white">
                      {access.user.firstName} {access.user.lastName}
                    </div>
                    <div className="text-sm text-gray-600 dark:text-gray-400 flex items-center gap-2">
                      <Mail className="w-3 h-3" />
                      {access.user.email}
                    </div>
                    {access.user.organization && (
                      <div className="text-xs text-gray-500 dark:text-gray-500 flex items-center gap-2 mt-1">
                        <Building className="w-3 h-3" />
                        {access.user.organization.name}
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <div className="text-right">
                    {access.customName && (
                      <div className="text-sm text-gray-600 dark:text-gray-400">
                        Shows as: <span className="font-medium text-gray-900 dark:text-white">{access.customName}</span>
                      </div>
                    )}
                    <div className="text-xs text-gray-500 dark:text-gray-500">
                      Granted {formatDate(access.grantedAt)}
                    </div>
                    {access.expiresAt && (
                      <div className="text-xs text-red-600 dark:text-red-400 flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        Expires {formatDate(access.expiresAt)}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setEditingUser(access)}
                      className="p-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
                      title="Edit access"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleRevokeAccess(access.userId)}
                      className="p-2 text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                      title="Revoke access"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default UserAccessManager;