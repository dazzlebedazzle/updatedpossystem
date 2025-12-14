'use client';

import { useState, useEffect } from 'react';
import Layout from '@/components/Layout';
import { MODULES, OPERATIONS, generatePermission, getAllAvailablePermissions } from '@/lib/permissions';
import { toast } from '@/lib/toast';

export default function SuperAdminPermissions() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState(null);
  const [userPermissions, setUserPermissions] = useState([]);
  const [showModal, setShowModal] = useState(false);

  const availablePermissions = getAllAvailablePermissions();

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      const response = await fetch('/api/users');
      const data = await response.json();
      setUsers(data.users || []);
    } catch (error) {
      console.error('Error fetching users:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleEditPermissions = (user) => {
    setSelectedUser(user);
    setUserPermissions(user.permissions || []);
    setShowModal(true);
  };

  const handlePermissionToggle = (module, operation) => {
    const permission = generatePermission(module, operation);
    if (userPermissions.includes(permission)) {
      setUserPermissions(prev => prev.filter(p => p !== permission));
    } else {
      setUserPermissions(prev => [...prev, permission]);
    }
  };

  const handleSelectAllModule = (module) => {
    const modulePerms = availablePermissions[module].map(p => p.permission);
    const hasAll = modulePerms.every(p => userPermissions.includes(p));
    
    if (hasAll) {
      setUserPermissions(prev => prev.filter(p => !modulePerms.includes(p)));
    } else {
      const newPerms = [...userPermissions];
      modulePerms.forEach(perm => {
        if (!newPerms.includes(perm)) {
          newPerms.push(perm);
        }
      });
      setUserPermissions(newPerms);
    }
  };

  const handleSelectAll = () => {
    if (userPermissions.includes('all')) {
      setUserPermissions([]);
    } else {
      setUserPermissions(['all']);
    }
  };

  const hasPermission = (module, operation) => {
    if (userPermissions.includes('all')) return true;
    const permission = generatePermission(module, operation);
    return userPermissions.includes(permission);
  };

  const hasAllModulePermissions = (module) => {
    const modulePerms = availablePermissions[module];
    return modulePerms.every(({ operation }) => hasPermission(module, operation));
  };

  const handleSavePermissions = async () => {
    try {
      const response = await fetch(`/api/users/${selectedUser._id || selectedUser.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ permissions: userPermissions }),
      });

      if (response.ok) {
        toast.success('Permissions updated successfully! The user may need to log out and log back in to see the changes.');
        setShowModal(false);
        setSelectedUser(null);
        setUserPermissions([]);
        fetchUsers();
      } else {
        const errorData = await response.json();
        toast.error(errorData.error || 'Failed to update permissions');
      }
    } catch (error) {
      console.error('Error updating permissions:', error);
      toast.error('Error updating permissions');
    }
  };

  return (
    <Layout userRole="superadmin">
      <div className="px-4 py-6 sm:px-0">
        <h1 className="text-3xl font-bold text-gray-900 mb-6">Permissions Management (CRUD Operations)</h1>

        {loading ? (
          <div>Loading...</div>
        ) : (
          <div className="bg-white shadow overflow-hidden sm:rounded-md">
            <div className="px-4 py-5 sm:px-6 border-b border-gray-200">
              <h3 className="text-lg font-medium text-gray-900">Users & Their Permissions</h3>
              <p className="mt-1 text-sm text-gray-500">Manage CRUD permissions for each user</p>
            </div>
            <ul className="divide-y divide-gray-200">
              {users.map((user) => {
                const userId = user._id || user.id;
                const permissions = user.permissions || [];
                const hasAllPerms = permissions.includes('all');
                
                return (
                  <li key={userId}>
                    <div className="px-4 py-4 sm:px-6">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center">
                            <p className="text-sm font-medium text-indigo-600">{user.name}</p>
                            <span className={`ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                              user.role === 'superadmin' ? 'bg-purple-100 text-purple-800' :
                              user.role === 'admin' ? 'bg-blue-100 text-blue-800' :
                              'bg-gray-100 text-gray-800'
                            }`}>
                              {user.role}
                            </span>
                          </div>
                          <p className="mt-1 text-sm text-gray-500">{user.email}</p>
                          <div className="mt-2">
                            {hasAllPerms ? (
                              <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-green-100 text-green-800">
                                All Permissions
                              </span>
                            ) : (
                              <div className="flex flex-wrap gap-1">
                                {permissions.slice(0, 5).map((perm, idx) => (
                                  <span
                                    key={idx}
                                    className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-gray-100 text-gray-800"
                                  >
                                    {perm}
                                  </span>
                                ))}
                                {permissions.length > 5 && (
                                  <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-gray-100 text-gray-800">
                                    +{permissions.length - 5} more
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                        <button
                          onClick={() => handleEditPermissions(user)}
                          className="ml-4 bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 text-sm transition"
                        >
                          Edit Permissions
                        </button>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        {/* Permissions Modal */}
        {showModal && selectedUser && (
          <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50 flex items-center justify-center p-4">
            <div className="relative mx-auto p-6 border w-full max-w-3xl shadow-lg rounded-lg bg-white max-h-[90vh] overflow-y-auto">
              <div className="flex justify-between items-center mb-4">
                <div>
                  <h3 className="text-xl font-bold text-gray-900">
                    Edit Permissions - {selectedUser.name}
                  </h3>
                  <p className="text-sm text-gray-500 mt-1">{selectedUser.email} ({selectedUser.role})</p>
                </div>
                <button
                  onClick={() => {
                    setShowModal(false);
                    setSelectedUser(null);
                    setUserPermissions([]);
                  }}
                  className="text-gray-400 hover:text-gray-600 text-2xl"
                >
                  ×
                </button>
              </div>

              <div className="space-y-4">
                {/* Select All Option */}
                <div className="border rounded-lg p-3 bg-gray-50">
                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={userPermissions.includes('all')}
                      onChange={handleSelectAll}
                      className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 w-5 h-5"
                    />
                    <span className="text-sm font-semibold text-gray-900">All Permissions (Superadmin Access)</span>
                  </label>
                </div>

                {/* Module Permissions */}
                {Object.entries(availablePermissions).map(([module, operations]) => {
                  // Show all modules - superadmin can assign any permissions to any user
                  return (
                    <div key={module} className="border rounded-lg p-4">
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="text-sm font-semibold text-gray-800 capitalize">{module}</h4>
                        <button
                          type="button"
                          onClick={() => handleSelectAllModule(module)}
                          className="text-xs text-indigo-600 hover:text-indigo-800 font-medium"
                        >
                          {hasAllModulePermissions(module) ? 'Deselect All' : 'Select All'}
                        </button>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        {operations.map(({ operation, permission, label }) => (
                          <label
                            key={permission}
                            className={`flex items-center space-x-2 cursor-pointer p-2 rounded border transition ${
                              hasPermission(module, operation)
                                ? 'bg-indigo-50 border-indigo-300'
                                : 'bg-white border-gray-200 hover:bg-gray-50'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={hasPermission(module, operation)}
                              onChange={() => handlePermissionToggle(module, operation)}
                              disabled={userPermissions.includes('all')}
                              className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                            />
                            <span className="text-xs text-gray-700 capitalize font-medium">{operation}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="flex justify-end space-x-3 pt-6 mt-6 border-t">
                <button
                  type="button"
                  onClick={() => {
                    setShowModal(false);
                    setSelectedUser(null);
                    setUserPermissions([]);
                  }}
                  className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSavePermissions}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition"
                >
                  Save Permissions
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}

