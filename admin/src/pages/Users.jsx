import { useState, useEffect } from 'react';
import api from '@/config/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Search, Eye, UserCheck, UserX, CreditCard } from 'lucide-react';
import UserProfileModal from '@/components/users/UserProfileModal';

export default function Users() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedUser, setSelectedUser] = useState(null);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 10,
    total: 0,
    pages: 0
  });

  useEffect(() => {
    fetchUsers();
  }, [pagination.page, search]);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const response = await api.get('/admin/users', {
        params: {
          page: pagination.page,
          limit: pagination.limit,
          search
        }
      });
      setUsers(response.data.users);
      setPagination(response.data.pagination);
    } catch (error) {
      console.error('Failed to fetch users:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleUserStatus = async (userId, currentStatus) => {
    try {
      await api.patch(`/admin/users/${userId}`, {
        isActive: !currentStatus
      });
      fetchUsers(); // Refresh the list
    } catch (error) {
      console.error('Failed to update user status:', error);
    }
  };

  const handleViewUser = (user) => {
    setSelectedUser(user);
    setShowProfileModal(true);
  };

  const handleUserUpdate = (updatedUser) => {
    // Update the user in the local state
    setUsers(users.map(u => u.id === updatedUser.id ? updatedUser : u));
    setShowProfileModal(false);
  };

  const formatDate = (date) => {
    if (!date) return 'Never';
    return new Date(date).toLocaleDateString();
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-indigo-600 to-purple-600 dark:from-indigo-400 dark:to-purple-400 bg-clip-text text-transparent">Users</h2>
        <p className="text-gray-600 dark:text-gray-300 mt-2">Manage user accounts and permissions</p>
      </div>

      <Card className="border-0 shadow-xl bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm">
        <CardHeader className="bg-gradient-to-r from-blue-50 to-cyan-50 dark:from-blue-900/20 dark:to-cyan-900/20 border-b border-gray-200/50 dark:border-gray-700/50">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg text-gray-900 dark:text-white">User List</CardTitle>
            <div className="flex items-center space-x-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search users..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-10 w-[300px] border-gray-300 dark:border-gray-600 focus:border-indigo-500 dark:focus:border-indigo-400 transition-colors duration-200"
                />
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          {loading ? (
            <div className="text-center py-12">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent mx-auto"></div>
              <p className="mt-4 text-gray-600 dark:text-gray-400">Loading users...</p>
            </div>
          ) : users.length === 0 ? (
            <div className="text-center py-12 text-gray-500 dark:text-gray-400">
              No users found
            </div>
          ) : (
            <>
              {/* Desktop view - simplified table */}
              <div className="hidden lg:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>User</TableHead>
                      <TableHead>Role/Status</TableHead>
                      <TableHead>Credits/Jobs</TableHead>
                      <TableHead>Activity</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {users.map((user) => (
                      <TableRow key={user.id}>
                        <TableCell>
                          <div>
                            <p className="font-medium text-gray-900 dark:text-white">{user.email}</p>
                            <p className="text-sm text-gray-500 dark:text-gray-400">
                              {user.firstName || user.lastName
                                ? `${user.firstName || ''} ${user.lastName || ''}`
                                : 'No name'}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            <Badge variant={user.role === 'ADMIN' ? 'destructive' : 'default'}>
                              {user.role}
                            </Badge>
                            <Badge variant={user.isActive ? 'success' : 'secondary'} className="block w-fit">
                              {user.isActive ? 'Active' : 'Inactive'}
                            </Badge>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            <div className="flex items-center gap-1">
                              <CreditCard className="h-4 w-4 text-muted-foreground" />
                              <span className="font-medium">{user.credits} credits</span>
                            </div>
                            <p className="text-sm text-gray-500 dark:text-gray-400">{user._count.jobs} jobs</p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">
                            <p className="text-gray-600 dark:text-gray-300">Joined {formatDate(user.createdAt)}</p>
                            <p className="text-gray-500 dark:text-gray-400">Last login {formatDate(user.lastLoginAt)}</p>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center gap-2 justify-end">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleViewUser(user)}
                              title="View Profile"
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => toggleUserStatus(user.id, user.isActive)}
                              title={user.isActive ? 'Deactivate User' : 'Activate User'}
                            >
                              {user.isActive ? (
                                <UserX className="h-4 w-4" />
                              ) : (
                                <UserCheck className="h-4 w-4" />
                              )}
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Mobile view - card layout */}
              <div className="lg:hidden space-y-4">
                {users.map((user) => (
                  <div key={user.id} className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 space-y-3">
                    {/* Header with email and actions */}
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-900 dark:text-white truncate">{user.email}</p>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          {user.firstName || user.lastName
                            ? `${user.firstName || ''} ${user.lastName || ''}`
                            : 'No name'}
                        </p>
                      </div>
                      <div className="flex items-center gap-1 ml-2">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleViewUser(user)}
                          className="h-8 w-8 p-0"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => toggleUserStatus(user.id, user.isActive)}
                          className="h-8 w-8 p-0"
                        >
                          {user.isActive ? (
                            <UserX className="h-4 w-4" />
                          ) : (
                            <UserCheck className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                    </div>

                    {/* Badges */}
                    <div className="flex items-center gap-2">
                      <Badge variant={user.role === 'ADMIN' ? 'destructive' : 'default'}>
                        {user.role}
                      </Badge>
                      <Badge variant={user.isActive ? 'success' : 'secondary'}>
                        {user.isActive ? 'Active' : 'Inactive'}
                      </Badge>
                    </div>

                    {/* Stats */}
                    <div className="flex items-center gap-4 text-sm">
                      <div className="flex items-center gap-1">
                        <CreditCard className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">{user.credits} credits</span>
                      </div>
                      <span className="text-gray-500 dark:text-gray-400">•</span>
                      <span className="text-gray-600 dark:text-gray-300">{user._count.jobs} jobs</span>
                    </div>

                    {/* Dates */}
                    <div className="text-xs text-gray-500 dark:text-gray-400 space-y-1">
                      <p>Joined {formatDate(user.createdAt)}</p>
                      <p>Last login {formatDate(user.lastLoginAt)}</p>
                    </div>
                  </div>
                ))}
              </div>

              {pagination.pages > 1 && (
                <div className="flex items-center justify-between px-2 py-4">
                  <div className="text-sm text-muted-foreground">
                    Showing {(pagination.page - 1) * pagination.limit + 1} to{' '}
                    {Math.min(pagination.page * pagination.limit, pagination.total)} of{' '}
                    {pagination.total} users
                  </div>
                  <div className="flex items-center space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPagination(prev => ({ ...prev, page: prev.page - 1 }))}
                      disabled={pagination.page === 1}
                    >
                      Previous
                    </Button>
                    <div className="text-sm">
                      Page {pagination.page} of {pagination.pages}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPagination(prev => ({ ...prev, page: prev.page + 1 }))}
                      disabled={pagination.page === pagination.pages}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* User Profile Modal */}
      {selectedUser && (
        <UserProfileModal
          user={selectedUser}
          isOpen={showProfileModal}
          onClose={() => setShowProfileModal(false)}
          onUpdate={handleUserUpdate}
        />
      )}
    </div>
  );
}