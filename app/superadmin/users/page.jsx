'use client';

import { useState, useEffect, useMemo } from 'react';
import Layout from '@/components/Layout';
import { getDefaultPermissions } from '@/lib/permissions';
import { PageLoader } from '@/components/Loader';
import { toast } from '@/lib/toast';
import { suppliers } from '@/lib/suppliers';

export default function SuperAdminUsers() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  const [showModal, setShowModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [, setSelectedRole] = useState('agent'); // Track which role button was clicked
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    role: 'agent',
    supplier: '',
    permissions: []
  });
  const [editFormData, setEditFormData] = useState({
    name: '',
    email: '',
    password: '',
    newPassword: '',
    role: 'agent',
    supplier: '',
    permissions: []
  });
  
  // Update permissions when role changes (default permissions set automatically)
  useEffect(() => {
    if (formData.role) {
      const defaultPerms = getDefaultPermissions(formData.role);
      setFormData(prev => ({ ...prev, permissions: defaultPerms }));
    }
  }, [formData.role]);

  useEffect(() => {
    fetchUsers();
  }, []);

  // Pagination calculations
  const totalPages = Math.ceil(users.length / itemsPerPage);
  const paginatedUsers = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return users.slice(startIndex, endIndex);
  }, [users, currentPage, itemsPerPage]);

  // Reset to page 1 when users change
  useEffect(() => {
    setCurrentPage(1);
  }, [users.length]);

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


  const handleCreateUser = async (e) => {
    e.preventDefault();
    try {
      const response = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        toast.success('User created successfully!');
        setShowModal(false);
        const defaultPerms = getDefaultPermissions('agent');
        setFormData({ name: '', email: '', password: '', role: 'agent', supplier: '', permissions: defaultPerms });
        setSelectedRole('agent');
        fetchUsers();
      } else {
        const errorData = await response.json();
        toast.error(errorData.error || 'Failed to create user');
      }
    } catch (error) {
      console.error('Error creating user:', error);
    }
  };

  const handleEdit = async (user) => {
    setEditingUser(user);
    setEditFormData({
      name: user.name || '',
      email: user.email || '',
      password: '',
      newPassword: '',
      role: user.role || 'agent',
      supplier: user.supplier || '',
      permissions: user.permissions || []
    });
    setShowEditModal(true);
  };

  const handleUpdateUser = async (e) => {
    e.preventDefault();
    if (!editingUser) return;

    try {
      const userId = editingUser._id || editingUser.id;
      const updateData = {
        name: editFormData.name,
        email: editFormData.email,
        role: editFormData.role,
        supplier: editFormData.role === 'agent' ? editFormData.supplier : '',
        permissions: editFormData.permissions
      };

      // Only include password if new password is provided
      if (editFormData.newPassword && editFormData.newPassword.trim() !== '') {
        if (editFormData.newPassword.length < 6) {
          toast.error('Password must be at least 6 characters');
          return;
        }
        updateData.password = editFormData.newPassword;
      }

      const response = await fetch(`/api/users/${userId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateData),
      });

      if (response.ok) {
        toast.success('User updated successfully!');
        setShowEditModal(false);
        setEditingUser(null);
        setEditFormData({
          name: '',
          email: '',
          password: '',
          newPassword: '',
          role: 'agent',
          supplier: '',
          permissions: []
        });
        fetchUsers();
      } else {
        const errorData = await response.json();
        toast.error(errorData.error || 'Failed to update user');
      }
    } catch (error) {
      console.error('Error updating user:', error);
      toast.error('Failed to update user');
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Are you sure you want to delete this user?')) return;

    try {
      const response = await fetch(`/api/users/${id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        toast.success('User deleted successfully!');
        fetchUsers();
      } else {
        toast.error('Failed to delete user');
      }
    } catch (error) {
      console.error('Error deleting user:', error);
    }
  };

  return (
    <Layout userRole="superadmin">
      <div className="px-4 py-6 sm:px-0">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-0 mb-4 sm:mb-6">
          <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-gray-900">User Management</h1>
          <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 w-full sm:w-auto">
            <button
              onClick={() => {
                setSelectedRole('admin');
                const defaultPerms = getDefaultPermissions('admin');
                setFormData({ name: '', email: '', password: '', role: 'admin', supplier: '', permissions: defaultPerms });
                setShowModal(true);
              }}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 active:bg-blue-800 transition flex items-center justify-center gap-2 text-sm sm:text-base touch-manipulation"
            >
              <span>+</span> Create Admin
            </button>
            <button
              onClick={() => {
                setSelectedRole('agent');
                const defaultPerms = getDefaultPermissions('agent');
                setFormData({ name: '', email: '', password: '', role: 'agent', supplier: '', permissions: defaultPerms });
                setShowModal(true);
              }}
              className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 active:bg-indigo-800 transition flex items-center justify-center gap-2 text-sm sm:text-base touch-manipulation"
            >
              <span>+</span> Create Agent
            </button>
          </div>
        </div>

        {loading ? (
          <PageLoader message="Loading users..." />
        ) : (
          <>
            <div className="bg-white shadow overflow-hidden sm:rounded-md mb-4">
              <ul className="divide-y divide-gray-200">
                {paginatedUsers.map((user) => {
                const userId = user._id || user.id;
                return (
                  <li key={userId}>
                    <div className="px-3 sm:px-4 py-3 sm:py-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-0">
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm font-medium text-indigo-600 truncate">{user.name}</p>
                          <span className={`inline-flex items-center px-2 sm:px-2.5 py-0.5 rounded-full text-xs font-medium flex-shrink-0 ${
                            user.role === 'superadmin' ? 'bg-purple-100 text-purple-800' :
                            user.role === 'admin' ? 'bg-blue-100 text-blue-800' :
                            'bg-white text-gray-800'
                          }`}>
                            {user.role}
                          </span>
                        </div>
                        <p className="mt-1 text-sm text-gray-800 truncate">{user.email}</p>
                        {user.supplier && (
                          <p className="mt-1 text-xs text-gray-800 truncate">Supplier: {user.supplier}</p>
                        )}
                      </div>
                      <div className="flex gap-2 w-full sm:w-auto">
                        <button
                          onClick={() => handleEdit(user)}
                          className="flex-1 sm:flex-none bg-blue-600 text-white px-3 sm:px-4 py-2 rounded hover:bg-blue-700 active:bg-blue-800 text-sm touch-manipulation"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDelete(userId)}
                          className="flex-1 sm:flex-none bg-red-600 text-white px-3 sm:px-4 py-2 rounded hover:bg-red-700 active:bg-red-800 text-sm touch-manipulation"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="bg-white shadow rounded-md px-4 py-3 flex items-center justify-between border-t border-gray-200 sm:px-6">
              <div className="flex-1 flex justify-between sm:hidden">
                <button
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                  className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-800 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Previous
                </button>
                <button
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  disabled={currentPage === totalPages}
                  className="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-800 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              </div>
              <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm text-gray-800">
                    Showing <span className="font-medium">{(currentPage - 1) * itemsPerPage + 1}</span> to{' '}
                    <span className="font-medium">{Math.min(currentPage * itemsPerPage, users.length)}</span> of{' '}
                    <span className="font-medium">{users.length}</span> results
                  </p>
                </div>
                <div>
                  <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px" aria-label="Pagination">
                    <button
                      onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                      disabled={currentPage === 1}
                      className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-800 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <span className="sr-only">Previous</span>
                      <svg className="h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                        <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    </button>
                    
                    {/* Page Numbers */}
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => {
                      if (
                        page === 1 ||
                        page === totalPages ||
                        (page >= currentPage - 1 && page <= currentPage + 1)
                      ) {
                        return (
                          <button
                            key={page}
                            onClick={() => setCurrentPage(page)}
                            className={`relative inline-flex items-center px-4 py-2 border text-sm font-medium ${
                              currentPage === page
                                ? 'z-10 bg-indigo-50 border-indigo-500 text-indigo-600'
                                : 'bg-white border-gray-300 text-gray-800 hover:bg-gray-50'
                            }`}
                          >
                            {page}
                          </button>
                        );
                      } else if (page === currentPage - 2 || page === currentPage + 2) {
                        return (
                          <span key={page} className="relative inline-flex items-center px-4 py-2 border border-gray-300 bg-white text-sm font-medium text-gray-800">
                            ...
                          </span>
                        );
                      }
                      return null;
                    })}
                    
                    <button
                      onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                      disabled={currentPage === totalPages}
                      className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-800 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <span className="sr-only">Next</span>
                      <svg className="h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                        <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                      </svg>
                    </button>
                  </nav>
                </div>
              </div>
            </div>
          )}
          </>
        )}

        {showModal && (
          <div className="fixed inset-0 bg-black/50 overflow-y-auto h-full w-full z-50 flex items-center justify-center p-3 sm:p-4">
            <div className="relative mx-auto p-4 sm:p-6 border w-full max-w-md shadow-lg rounded-lg bg-white my-auto">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg sm:text-xl font-bold text-gray-900">
                  Create New {formData.role === 'admin' ? 'Admin' : 'Agent'}
                </h3>
                <button
                  onClick={() => {
                    setShowModal(false);
                    const defaultPerms = getDefaultPermissions('agent');
                    setFormData({ name: '', email: '', password: '', role: 'agent', supplier: '', permissions: defaultPerms });
                  }}
                  className="text-gray-800 hover:text-gray-900 text-2xl sm:text-3xl leading-none touch-manipulation"
                >
                  ×
                </button>
              </div>
              <form onSubmit={handleCreateUser} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-800 mb-1">Name</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                    placeholder="Enter full name"
                    className="block w-full border border-gray-200 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 placeholder:text-gray-800"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-800 mb-1">Email</label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    required
                    placeholder="Enter email address"
                    className="block w-full border border-gray-200 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 placeholder:text-gray-800"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-800 mb-1">Password</label>
                  <input
                    type="password"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    required
                    placeholder="Enter password"
                    minLength={6}
                    className="block w-full border border-gray-200 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 placeholder:text-gray-800"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-800 mb-1">Role</label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, role: 'admin' })}
                      className={`flex-1 px-4 py-2 rounded-md border-2 transition ${
                        formData.role === 'admin'
                          ? 'border-blue-500 bg-blue-50 text-blue-700 font-medium'
                          : 'border-gray-200 bg-white text-gray-800 hover:bg-white'
                      }`}
                    >
                      Admin
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, role: 'agent' })}
                      className={`flex-1 px-4 py-2 rounded-md border-2 transition ${
                        formData.role === 'agent'
                          ? 'border-indigo-500 bg-indigo-50 text-indigo-700 font-medium'
                          : 'border-gray-200 bg-white text-gray-800 hover:bg-white'
                      }`}
                    >
                      Agent
                    </button>
                  </div>
                  <p className="mt-2 text-xs text-gray-800">
                    {formData.role === 'admin' 
                      ? 'Admin can manage products, sales, customers, and inventory'
                      : 'Agent can access POS interface and view personal sales'}
                  </p>
                </div>
                {formData.role === 'agent' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-800 mb-1">
                      Supplier Name <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={formData.supplier}
                      onChange={(e) => setFormData({ ...formData, supplier: e.target.value })}
                      required
                      className="block w-full border border-gray-200 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                      <option value="">Select Supplier</option>
                      {suppliers.map((supplier) => (
                        <option key={supplier} value={supplier}>
                          {supplier}
                        </option>
                      ))}
                    </select>
                    <p className="mt-1 text-xs text-gray-800">
                      Each supplier name must be unique. Select from the predefined list.
                    </p>
                  </div>
                )}
                <div className="flex justify-end space-x-3 pt-4">
                  <button
                    type="button"
                    onClick={() => {
                      setShowModal(false);
                      const defaultPerms = getDefaultPermissions('agent');
                      setFormData({ name: '', email: '', password: '', role: 'agent', supplier: '', permissions: defaultPerms });
                    }}
                    className="px-4 py-2 bg-white text-gray-800 rounded-lg hover:bg-white transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className={`px-4 py-2 text-white rounded-lg transition ${
                      formData.role === 'admin'
                        ? 'bg-blue-600 hover:bg-blue-700'
                        : 'bg-indigo-600 hover:bg-indigo-700'
                    }`}
                  >
                    Create {formData.role === 'admin' ? 'Admin' : 'Agent'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Edit User Modal */}
        {showEditModal && editingUser && (
          <div className="fixed inset-0 bg-white bg-opacity-50 overflow-y-auto h-full w-full z-50 flex items-center justify-center p-4">
            <div className="relative mx-auto p-6 border w-96 shadow-lg rounded-lg bg-white max-h-[90vh] overflow-y-auto">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg sm:text-xl font-bold text-gray-900">
                  Edit User
                </h3>
                <button
                  onClick={() => {
                    setShowEditModal(false);
                    setEditingUser(null);
                    setEditFormData({
                      name: '',
                      email: '',
                      password: '',
                      newPassword: '',
                      role: 'agent',
                      supplier: '',
                      permissions: []
                    });
                  }}
                  className="text-gray-800 hover:text-gray-900 text-2xl sm:text-3xl leading-none touch-manipulation"
                >
                  ×
                </button>
              </div>
              <form onSubmit={handleUpdateUser} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-800 mb-1">Name</label>
                  <input
                    type="text"
                    value={editFormData.name}
                    onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
                    required
                    placeholder="Enter full name"
                    className="block w-full border border-gray-200 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 placeholder:text-gray-800"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-800 mb-1">Email</label>
                  <input
                    type="email"
                    value={editFormData.email}
                    onChange={(e) => setEditFormData({ ...editFormData, email: e.target.value })}
                    required
                    placeholder="Enter email address"
                    className="block w-full border border-gray-200 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 placeholder:text-gray-800"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-800 mb-1">New Password</label>
                  <input
                    type="password"
                    value={editFormData.newPassword}
                    onChange={(e) => setEditFormData({ ...editFormData, newPassword: e.target.value })}
                    placeholder="Leave blank to keep current password"
                    minLength={6}
                    className="block w-full border border-gray-200 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 placeholder:text-gray-800"
                  />
                  <p className="mt-1 text-xs text-gray-800">
                    Leave blank to keep current password. Minimum 6 characters if changing.
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-800 mb-1">Role</label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        const defaultPerms = getDefaultPermissions('admin');
                        setEditFormData({ ...editFormData, role: 'admin', permissions: defaultPerms });
                      }}
                      className={`flex-1 px-4 py-2 rounded-md border-2 transition ${
                        editFormData.role === 'admin'
                          ? 'border-blue-500 bg-blue-50 text-blue-700 font-medium'
                          : 'border-gray-200 bg-white text-gray-800 hover:bg-white'
                      }`}
                    >
                      Admin
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const defaultPerms = getDefaultPermissions('agent');
                        setEditFormData({ ...editFormData, role: 'agent', permissions: defaultPerms });
                      }}
                      className={`flex-1 px-4 py-2 rounded-md border-2 transition ${
                        editFormData.role === 'agent'
                          ? 'border-indigo-500 bg-indigo-50 text-indigo-700 font-medium'
                          : 'border-gray-200 bg-white text-gray-800 hover:bg-white'
                      }`}
                    >
                      Agent
                    </button>
                  </div>
                  <p className="mt-2 text-xs text-gray-800">
                    {editFormData.role === 'admin' 
                      ? 'Admin can manage products, sales, customers, and inventory'
                      : 'Agent can access POS interface and view personal sales'}
                  </p>
                </div>
                {editFormData.role === 'agent' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-800 mb-1">
                      Supplier Name <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={editFormData.supplier}
                      onChange={(e) => setEditFormData({ ...editFormData, supplier: e.target.value })}
                      required
                      className="block w-full border border-gray-200 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                      <option value="">Select Supplier</option>
                      {suppliers.map((supplier) => (
                        <option key={supplier} value={supplier}>
                          {supplier}
                        </option>
                      ))}
                    </select>
                    <p className="mt-1 text-xs text-gray-800">
                      Each supplier name must be unique. Select from the predefined list.
                    </p>
                  </div>
                )}
                <div className="flex justify-end space-x-3 pt-4">
                  <button
                    type="button"
                    onClick={() => {
                      setShowEditModal(false);
                      setEditingUser(null);
                      setEditFormData({
                        name: '',
                        email: '',
                        password: '',
                        newPassword: '',
                        role: 'agent',
                        supplier: '',
                        permissions: []
                      });
                    }}
                    className="px-4 py-2 bg-white text-gray-800 rounded-lg hover:bg-white transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition"
                  >
                    Update User
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}

