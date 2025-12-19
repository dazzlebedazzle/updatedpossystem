'use client';

import { useState, useEffect } from 'react';
import Layout from '@/components/Layout';
import { getDefaultPermissions } from '@/lib/permissions';
import { toast } from '@/lib/toast';
import { suppliers } from '@/lib/suppliers';

export default function SuperAdminUsers() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
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
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold text-gray-900">User Management</h1>
          <div className="flex gap-3">
            <button
              onClick={() => {
                setSelectedRole('admin');
                const defaultPerms = getDefaultPermissions('admin');
                setFormData({ name: '', email: '', password: '', role: 'admin', supplier: '', permissions: defaultPerms });
                setShowModal(true);
              }}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition flex items-center gap-2"
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
              className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition flex items-center gap-2"
            >
              <span>+</span> Create Agent
            </button>
          </div>
        </div>

        {loading ? (
          <div>Loading...</div>
        ) : (
          <div className="bg-white shadow overflow-hidden sm:rounded-md">
            <ul className="divide-y divide-gray-800">
              {users.map((user) => {
                const userId = user._id || user.id;
                return (
                  <li key={userId}>
                    <div className="px-4 py-4 sm:px-6 flex justify-between items-center">
                      <div>
                        <div className="flex items-center">
                          <p className="text-sm font-medium text-indigo-600 truncate">{user.name}</p>
                          <span className={`ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            user.role === 'superadmin' ? 'bg-purple-100 text-purple-800' :
                            user.role === 'admin' ? 'bg-blue-100 text-blue-800' :
                            'bg-white text-gray-800'
                          }`}>
                            {user.role}
                          </span>
                        </div>
                        <p className="mt-1 text-sm text-gray-600">{user.email}</p>
                        {user.supplier && (
                          <p className="mt-1 text-xs text-gray-800">Supplier: {user.supplier}</p>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleEdit(user)}
                          className="bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700 text-sm"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDelete(userId)}
                          className="bg-red-600 text-white px-3 py-1 rounded hover:bg-red-700 text-sm"
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
        )}

        {showModal && (
          <div className="fixed inset-0 bg-white bg-opacity-50 overflow-y-auto h-full w-full z-50 flex items-center justify-center p-4">
            <div className="relative mx-auto p-6 border w-96 shadow-lg rounded-lg bg-white">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-bold text-gray-900">
                  Create New {formData.role === 'admin' ? 'Admin' : 'Agent'}
                </h3>
                <button
                  onClick={() => {
                    setShowModal(false);
                    const defaultPerms = getDefaultPermissions('agent');
                    setFormData({ name: '', email: '', password: '', role: 'agent', supplier: '', permissions: defaultPerms });
                  }}
                  className="text-gray-800 hover:text-gray-800 text-2xl"
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
                    className="block w-full border border-gray-200 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
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
                    className="block w-full border border-gray-200 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
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
                    className="block w-full border border-gray-200 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
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
                  <p className="mt-2 text-xs text-gray-600">
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
                    <p className="mt-1 text-xs text-gray-600">
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
                <h3 className="text-xl font-bold text-gray-900">
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
                  className="text-gray-800 hover:text-gray-800 text-2xl"
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
                    className="block w-full border border-gray-200 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
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
                    className="block w-full border border-gray-200 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
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
                    className="block w-full border border-gray-200 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <p className="mt-1 text-xs text-gray-600">
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
                  <p className="mt-2 text-xs text-gray-600">
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
                    <p className="mt-1 text-xs text-gray-600">
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

