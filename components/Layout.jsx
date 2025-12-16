'use client';

import { useState, useEffect, createContext, useContext } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { hasPermission, MODULES, OPERATIONS } from '@/lib/permissions';

// Create a context for sidebar state
const SidebarContext = createContext({
  sidebarCollapsed: false,
  sidebarWidth: 256, // 16rem in pixels
});

export const useSidebar = () => useContext(SidebarContext);

export default function Layout({ children, userRole, userName }) {
  const [user, setUser] = useState(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [sidebarWidth, setSidebarWidth] = useState(256); // 16rem = 256px
  const [showProfileModal, setShowProfileModal] = useState(false);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    // Update sidebar width when collapsed state changes
    setSidebarWidth(sidebarCollapsed ? 64 : 256); // 4rem or 16rem in pixels
  }, [sidebarCollapsed]);

  useEffect(() => {
    // Get user from session
    fetch('/api/auth/me')
      .then(res => {
        if (res.ok) {
          return res.json();
        }
        throw new Error('Not authenticated');
      })
      .then(data => {
        if (data.user) {
          setUser(data.user);
        } else {
          router.push('/login');
        }
      })
      .catch(() => {
        // Only redirect if not already on login/register page
        if (pathname !== '/login' && pathname !== '/register') {
          router.push('/login');
        }
      });
  }, [pathname, router]);

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
  };

  const getNavItems = () => {
    const userPermissions = user?.permissions || [];
    const basePath = userRole === 'superadmin' ? '/superadmin' : userRole === 'admin' ? '/admin' : '/user';
    
    // Define all possible menu items with their required permissions
    const allMenuItems = [
      { href: `${basePath}/dashboard`, label: 'Dashboard', icon: '📊', module: null, alwaysShow: true },
      { href: `${basePath}/users`, label: 'Users', icon: '👥', module: MODULES.USERS },
      { href: `${basePath}/permissions`, label: 'Permissions (CRUD)', icon: '🔐', module: MODULES.USERS },
      { href: `${basePath}/products`, label: 'Products', icon: '📦', module: MODULES.PRODUCTS },
      { href: `${basePath}/pos`, label: 'POS', icon: '🛒', module: MODULES.SALES },
      { href: `${basePath}/sales`, label: userRole === 'user' ? 'My Sales' : 'Sales', icon: '💰', module: MODULES.SALES },
      { href: `${basePath}/customers`, label: 'Customers', icon: '👤', module: MODULES.CUSTOMERS },
      { href: `${basePath}/inventory`, label: 'Inventory', icon: '📋', module: MODULES.INVENTORY },
      { href: `${basePath}/reports`, label: 'Reports', icon: '📈', module: MODULES.REPORTS },
    ];

    // Filter menu items based on permissions only (no role restrictions)
    return allMenuItems.filter(item => {
      // Always show dashboard
      if (item.alwaysShow) return true;
      
      // If no module specified, show it (shouldn't happen, but safety check)
      if (!item.module) return true;
      
      // Check if user has READ permission for this module
      // For POS, check if user has CREATE or READ permission for SALES
      if (item.module === MODULES.SALES && item.href.includes('/pos')) {
        return hasPermission(userPermissions, MODULES.SALES, OPERATIONS.CREATE) || 
               hasPermission(userPermissions, MODULES.SALES, OPERATIONS.READ);
      }
      
      // For Users and Permissions pages, check if user has READ permission for USERS module
      if (item.module === MODULES.USERS) {
        return hasPermission(userPermissions, MODULES.USERS, OPERATIONS.READ);
      }
      
      // For Reports, check if user has READ permission for REPORTS module
      if (item.module === MODULES.REPORTS) {
        return hasPermission(userPermissions, MODULES.REPORTS, OPERATIONS.READ);
      }
      
      // For other modules, check READ permission
      return hasPermission(userPermissions, item.module, OPERATIONS.READ);
    });
  };

  if (!user) {
    return <div>Loading...</div>;
  }

  return (
    <SidebarContext.Provider value={{ sidebarCollapsed, sidebarWidth }}>
      <div className="min-h-screen bg-white flex">
        {/* Sidebar */}
        <aside className={`${sidebarCollapsed ? 'w-16' : 'w-64'} bg-white shadow-lg fixed h-full transition-all duration-300 z-20 flex flex-col overflow-x-hidden`}>
        <div className={`${sidebarCollapsed ? 'p-2' : 'p-3'} border-b flex items-center ${sidebarCollapsed ? 'justify-center' : 'justify-between'}`}>
          {!sidebarCollapsed && (
            <h1 className="text-lg font-bold text-indigo-600">POS System</h1>
          )}
          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="p-1.5 rounded-lg hover:bg-white800 transition text-gray-800 hover:text-gray-800900"
            title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {sidebarCollapsed ? (
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            )}
          </button>
        </div>
        <nav className="p-2 flex-1 overflow-y-auto overflow-x-hidden">
          <ul className="space-y-1">
            {getNavItems().map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={`flex items-center ${sidebarCollapsed ? 'justify-center px-2 py-2.5' : 'px-3 py-2'} rounded-lg text-sm font-medium transition group relative ${
                    pathname === item.href
                      ? 'bg-indigo-100 text-indigo-700 border-l-4 border-indigo-600'
                      : 'text-gray-800 hover:bg-white800'
                  }`}
                  title={sidebarCollapsed ? item.label : ''}
                >
                  {sidebarCollapsed && (
                    <span className="absolute left-full ml-2 px-2 py-1 bg-white text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-50 pointer-events-none">
                      {item.label}
                    </span>
                  )}
                  <span className={sidebarCollapsed ? 'text-xl' : 'mr-2'}>{item.icon}</span>
                  {!sidebarCollapsed && <span className="truncate">{item.label}</span>}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        {/* User Profile at Bottom */}
        <div className={`${sidebarCollapsed ? 'p-2' : 'p-3'} border-t mt-auto overflow-x-hidden`}>
          {/* Profile Button */}
          <button
            onClick={() => setShowProfileModal(true)}
            className={`w-full ${sidebarCollapsed ? 'px-2 py-2' : 'px-3 py-2.5'} rounded-lg hover:bg-white800 transition flex items-center ${sidebarCollapsed ? 'justify-center' : 'gap-3'} group`}
            title={sidebarCollapsed ? 'Profile' : ''}
          >
            {sidebarCollapsed ? (
              <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center text-white font-bold text-sm">
                {(userName || user?.name || 'U').charAt(0).toUpperCase()}
              </div>
            ) : (
              <>
                <div className="w-10 h-10 rounded-full bg-indigo-600 flex items-center justify-center text-white font-bold flex-shrink-0">
                  {(userName || user?.name || 'U').charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 text-left">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {userName || user?.name}
                  </p>
                  <p className="text-xs text-gray-600 capitalize">
                    {userRole}
                  </p>
                </div>
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-gray-800 group-hover:text-gray-800800" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </>
            )}
          </button>
        </div>
      </aside>

      {/* Profile Modal */}
      {showProfileModal && (
        <>
          <div 
            className="fixed inset-0 bg-black/50 z-40"
            onClick={() => setShowProfileModal(false)}
          ></div>
          <div className="fixed inset-0 flex items-center justify-center z-50 p-4">
            <div 
              className="bg-white rounded-lg shadow-xl max-w-md w-full"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Profile Header */}
              <div className="bg-gradient-to-r from-indigo-600 to-purple-600 p-6 rounded-t-lg">
                <div className="flex items-center gap-4">
                  <div className="w-20 h-20 rounded-full bg-white flex items-center justify-center text-indigo-600 font-bold text-3xl shadow-lg">
                    {(userName || user?.name || 'U').charAt(0).toUpperCase()}
                  </div>
                  <div className="text-white">
                    <h2 className="text-2xl font-bold">{userName || user?.name}</h2>
                    <p className="text-indigo-100 capitalize text-sm mt-1">
                      {userRole} Account
                    </p>
                  </div>
                </div>
              </div>

              {/* Profile Details */}
              <div className="p-6">
                <div className="space-y-4">
                  <div className="flex items-center gap-3 p-3 bg-white rounded-lg">
                    <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-xs text-gray-600">Username</p>
                      <p className="text-sm font-medium text-gray-900">{user?.username || 'N/A'}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 p-3 bg-white rounded-lg">
                    <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-xs text-gray-600">Email</p>
                      <p className="text-sm font-medium text-gray-900">{user?.email || 'N/A'}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 p-3 bg-white rounded-lg">
                    <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-xs text-gray-600">Role</p>
                      <p className="text-sm font-medium text-gray-900 capitalize">{userRole}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 p-3 bg-white rounded-lg">
                    <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-xs text-gray-600">Account Status</p>
                      <p className="text-sm font-medium text-green-600 flex items-center gap-1">
                        <span className="w-2 h-2 bg-green-600 rounded-full"></span>
                        Active
                      </p>
                    </div>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-3 mt-6">
                  <button
                    onClick={() => {
                      setShowProfileModal(false);
                      handleLogout();
                    }}
                    className="flex-1 bg-red-600 text-white py-2.5 px-4 rounded-lg hover:bg-red-700 font-medium transition flex items-center justify-center gap-2"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                    </svg>
                    Logout
                  </button>
                  <button
                    onClick={() => setShowProfileModal(false)}
                    className="flex-1 bg-white text-gray-800 py-2.5 px-4 rounded-lg hover:bg-white800 font-medium transition"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Main Content Area */}
        <div className={`flex-1 transition-all duration-300 ${sidebarCollapsed ? 'ml-16' : 'ml-64'}`}>

        {/* Main Content */}
        <main className="p-6">
          {children}
        </main>
      </div>
    </div>
    </SidebarContext.Provider>
  );
}

