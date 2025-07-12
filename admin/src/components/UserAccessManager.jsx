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
    <div className="bg-white rounded-lg shadow">
      <div className="p-6 border-b">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Users className="w-5 h-5 text-gray-600" />
            <h3 className="text-lg font-semibold">User Access</h3>
            <span className="px-2 py-1 text-xs bg-gray-100 rounded-full">
              {users.length} users
            </span>
          </div>
          <button
            onClick={() => setShowAddUsers(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <UserPlus className="w-4 h-4" />
            Grant Access
          </button>
        </div>
      </div>

      {error && (
        <div className="mx-6 mt-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-700">
          <AlertCircle className="w-4 h-4" />
          {error}
        </div>
      )}

      {showAddUsers && (
        <div className="p-6 bg-gray-50 border-b">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Search Users
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={handleSearchChange}
                  placeholder="Search by name or email..."
                  className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              
              {searchResults.length > 0 && (
                <div className="absolute z-10 mt-1 w-full bg-white border rounded-lg shadow-lg max-h-60 overflow-auto">
                  {searchResults.map(user => (
                    <button
                      key={user.id}
                      onClick={() => handleUserSelect(user)}
                      className="w-full px-4 py-2 text-left hover:bg-gray-50 flex items-center justify-between"
                    >
                      <div>
                        <div className="font-medium">
                          {user.firstName} {user.lastName}
                        </div>
                        <div className="text-sm text-gray-600">{user.email}</div>
                        {user.organization && (
                          <div className="text-xs text-gray-500">
                            {user.organization.name}
                          </div>
                        )}
                      </div>
                      <UserPlus className="w-4 h-4 text-gray-400" />
                    </button>
                  ))}
                </div>
              )}
            </div>

            {selectedUsers.length > 0 && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Selected Users
                </label>
                <div className="space-y-2">
                  {selectedUsers.map(user => (
                    <div key={user.id} className="flex items-center justify-between p-2 bg-white rounded border">
                      <div>
                        <span className="font-medium">{user.firstName} {user.lastName}</span>
                        <span className="text-gray-600 ml-2">({user.email})</span>
                      </div>
                      <button
                        onClick={() => handleRemoveSelectedUser(user.id)}
                        className="text-red-600 hover:text-red-800"
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
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Custom Display Name (Optional)
                </label>
                <input
                  type="text"
                  value={customName}
                  onChange={(e) => setCustomName(e.target.value)}
                  placeholder={modelName}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                />
                <p className="mt-1 text-xs text-gray-500">
                  Override how this model appears to selected users
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Access Expires (Optional)
                </label>
                <input
                  type="date"
                  value={expiresAt}
                  onChange={(e) => setExpiresAt(e.target.value)}
                  min={new Date().toISOString().split('T')[0]}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                />
                <p className="mt-1 text-xs text-gray-500">
                  Leave empty for permanent access
                </p>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleGrantAccess}
                disabled={loading || selectedUsers.length === 0}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
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
                className="px-4 py-2 text-gray-700 bg-white border rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="divide-y">
        {loading && !users.length ? (
          <div className="p-8 text-center text-gray-500">Loading users...</div>
        ) : users.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            No users have access to this model yet.
          </div>
        ) : (
          users.map(access => (
            <div key={access.id} className="p-4 hover:bg-gray-50">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3">
                    <div>
                      <h4 className="font-medium">
                        {access.user.firstName} {access.user.lastName}
                      </h4>
                      <div className="flex items-center gap-4 mt-1 text-sm text-gray-600">
                        <span className="flex items-center gap-1">
                          <Mail className="w-3 h-3" />
                          {access.user.email}
                        </span>
                        {access.user.organization && (
                          <span className="flex items-center gap-1">
                            <Building className="w-3 h-3" />
                            {access.user.organization.name}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {editingUser === access.id ? (
                    <div className="mt-3 space-y-3">
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-medium text-gray-700 mb-1">
                            Custom Name
                          </label>
                          <input
                            type="text"
                            defaultValue={access.customName || ''}
                            placeholder={modelName}
                            id={`customName-${access.id}`}
                            className="w-full px-2 py-1 text-sm border rounded"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-700 mb-1">
                            Expires
                          </label>
                          <input
                            type="date"
                            defaultValue={access.expiresAt ? access.expiresAt.split('T')[0] : ''}
                            id={`expiresAt-${access.id}`}
                            className="w-full px-2 py-1 text-sm border rounded"
                          />
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => {
                            const customName = document.getElementById(`customName-${access.id}`).value;
                            const expiresAt = document.getElementById(`expiresAt-${access.id}`).value;
                            handleUpdateAccess(access.user.id, { customName, expiresAt });
                          }}
                          className="px-3 py-1 text-sm bg-green-600 text-white rounded hover:bg-green-700"
                        >
                          <Check className="w-3 h-3" />
                        </button>
                        <button
                          onClick={() => setEditingUser(null)}
                          className="px-3 py-1 text-sm bg-gray-300 text-gray-700 rounded hover:bg-gray-400"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="mt-2 flex items-center gap-4 text-sm">
                      {access.customName && (
                        <span className="text-gray-600">
                          Displays as: <span className="font-medium">{access.customName}</span>
                        </span>
                      )}
                      <span className="flex items-center gap-1 text-gray-500">
                        <Calendar className="w-3 h-3" />
                        Granted {formatDate(access.grantedAt)}
                      </span>
                      {access.expiresAt && (
                        <span className="flex items-center gap-1 text-amber-600">
                          <AlertCircle className="w-3 h-3" />
                          Expires {formatDate(access.expiresAt)}
                        </span>
                      )}
                      {access.grantedByUser && (
                        <span className="flex items-center gap-1 text-gray-500">
                          <Shield className="w-3 h-3" />
                          by {access.grantedByUser.firstName} {access.grantedByUser.lastName}
                        </span>
                      )}
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  {editingUser !== access.id && (
                    <>
                      <button
                        onClick={() => setEditingUser(access.id)}
                        className="p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded"
                        title="Edit access"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleRevokeAccess(access.user.id)}
                        className="p-2 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded"
                        title="Revoke access"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default UserAccessManager;