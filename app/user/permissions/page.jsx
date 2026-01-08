'use client';

import { useState, useEffect } from 'react';
import Layout from '@/components/Layout';
import { generatePermission, getAllAvailablePermissions } from '@/lib/permissions';
import { PageLoader } from '@/components/Loader';

export default function UserPermissions() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [userPermissions, setUserPermissions] = useState([]);

  const availablePermissions = getAllAvailablePermissions();

  useEffect(() => {
    fetchUserPermissions();
  }, []);

  const fetchUserPermissions = async () => {
    try {
      const response = await fetch('/api/auth/me');
      const data = await response.json();
      if (data.user) {
        setUser(data.user);
        setUserPermissions(data.user.permissions || []);
      }
    } catch (error) {
      console.error('Error fetching user permissions:', error);
    } finally {
      setLoading(false);
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

  const hasAnyModulePermissions = (module) => {
    const modulePerms = availablePermissions[module];
    return modulePerms.some(({ operation }) => hasPermission(module, operation));
  };

  if (loading) {
    return (
      <Layout userRole="user">
        <div className="px-4 py-6 sm:px-0">
          <PageLoader message="Loading permissions..." />
        </div>
      </Layout>
    );
  }

  const hasAllPerms = userPermissions.includes('all');

  return (
    <Layout userRole="user">
      <div className="px-4 py-6 sm:px-0">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">My Permissions</h1>
          {user && (
            <div className="flex items-center gap-3">
              <p className="text-sm text-gray-800">
                <span className="font-medium">{user.name}</span> ({user.email})
              </p>
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                user.role === 'superadmin' ? 'bg-purple-100 text-purple-800' :
                user.role === 'admin' ? 'bg-blue-100 text-blue-800' :
                'bg-gray-100 text-gray-800'
              }`}>
                {user.role}
              </span>
            </div>
          )}
        </div>

        <div className="bg-white shadow overflow-hidden sm:rounded-md mb-4">
          <div className="px-4 py-5 sm:px-6 border-b border-gray-200">
            <h3 className="text-lg font-medium text-gray-900">Permission Overview</h3>
            <p className="mt-1 text-sm text-gray-800">View your current access permissions</p>
          </div>
          
          <div className="px-4 py-5 sm:px-6">
            {hasAllPerms ? (
              <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
                <div className="flex items-center">
                  <span className="text-2xl mr-3">✅</span>
                  <div>
                    <h4 className="text-sm font-semibold text-green-900">All Permissions</h4>
                    <p className="text-xs text-green-800 mt-1">You have full access to all modules and operations.</p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="mb-4">
                <p className="text-sm text-gray-800 mb-3">
                  You have <span className="font-semibold">{userPermissions.length}</span> specific permission{userPermissions.length !== 1 ? 's' : ''}.
                </p>
                <div className="flex flex-wrap gap-2">
                  {userPermissions.slice(0, 10).map((perm, idx) => (
                    <span
                      key={idx}
                      className="inline-flex items-center px-2.5 py-1 rounded text-xs font-medium bg-indigo-50 text-indigo-800 border border-indigo-200"
                    >
                      {perm}
                    </span>
                  ))}
                  {userPermissions.length > 10 && (
                    <span className="inline-flex items-center px-2.5 py-1 rounded text-xs font-medium bg-gray-50 text-gray-800 border border-gray-200">
                      +{userPermissions.length - 10} more
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="bg-white shadow overflow-hidden sm:rounded-md">
          <div className="px-4 py-5 sm:px-6 border-b border-gray-200">
            <h3 className="text-lg font-medium text-gray-900">Module Permissions</h3>
            <p className="mt-1 text-sm text-gray-800">Detailed breakdown by module</p>
          </div>

          <div className="px-4 py-5 sm:px-6 space-y-6">
            {Object.entries(availablePermissions).map(([module, operations]) => {
              // Only show modules where user has at least one permission (unless they have 'all')
              if (!hasAllPerms && !hasAnyModulePermissions(module)) {
                return null;
              }

              const allModulePerms = hasAllModulePermissions(module);
              
              return (
                <div key={module} className="border rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-sm font-semibold text-gray-800 capitalize flex items-center gap-2">
                      {module}
                      {allModulePerms && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                          Full Access
                        </span>
                      )}
                    </h4>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {operations.map(({ operation, permission }) => {
                      const hasAccess = hasPermission(module, operation);
                      return (
                        <div
                          key={permission}
                          className={`flex items-center space-x-2 p-2 rounded border transition ${
                            hasAccess
                              ? 'bg-indigo-50 border-indigo-300'
                              : 'bg-gray-50 border-gray-200 opacity-50'
                          }`}
                        >
                          <span className={`text-lg ${hasAccess ? 'text-green-600' : 'text-gray-400'}`}>
                            {hasAccess ? '✓' : '✗'}
                          </span>
                          <span className={`text-xs capitalize font-medium ${
                            hasAccess ? 'text-indigo-900' : 'text-gray-500'
                          }`}>
                            {operation}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-start">
            <span className="text-xl mr-3">ℹ️</span>
            <div>
              <h4 className="text-sm font-semibold text-blue-900 mb-1">About Permissions</h4>
              <p className="text-xs text-blue-800">
                Your permissions determine what actions you can perform in the system. 
                If you need additional permissions, please contact your administrator.
              </p>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}

