'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import Layout from '@/components/Layout';
import { PageLoader } from '@/components/Loader';
import Pagination from '@/components/Pagination';
import { getTodayIST } from '@/lib/date-utils';

export default function SuperAdminCustomers() {
  const [customers, setCustomers] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedUserId, setSelectedUserId] = useState('All');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  useEffect(() => {
    fetchCustomers();
    fetchUsers();
    // Set default date range to today (IST)
    const today = getTodayIST();
    setStartDate(today);
    setEndDate(today);
  }, []);

  const fetchUsers = useCallback(async () => {
    try {
      const response = await fetch('/api/users');
      if (response.ok) {
        const data = await response.json();
        setUsers(data.users || []);
      }
    } catch (error) {
      console.error('Error fetching users:', error);
    }
  }, []);

  // Filter customers by date range and user
  const filteredCustomers = useMemo(() => {
    let filtered = customers;

    // Filter by user
    if (selectedUserId !== 'All') {
      filtered = filtered.filter(customer => {
        const customerUserId = customer.userId?.toString();
        return customerUserId === selectedUserId;
      });
    }

    // Filter by date range
    if (startDate || endDate) {
      filtered = filtered.filter(customer => {
        if (!customer.createdAt) return false;
        const customerDate = new Date(customer.createdAt);
        customerDate.setHours(0, 0, 0, 0);

        if (startDate && endDate) {
          const start = new Date(startDate);
          start.setHours(0, 0, 0, 0);
          const end = new Date(endDate);
          end.setHours(23, 59, 59, 999);
          return customerDate >= start && customerDate <= end;
        } else if (startDate) {
          const start = new Date(startDate);
          start.setHours(0, 0, 0, 0);
          return customerDate >= start;
        } else if (endDate) {
          const end = new Date(endDate);
          end.setHours(23, 59, 59, 999);
          return customerDate <= end;
        }
        return true;
      });
    }

    return filtered;
  }, [customers, startDate, endDate, selectedUserId]);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [selectedUserId, startDate, endDate]);

  // Pagination calculations
  const totalPages = Math.ceil(filteredCustomers.length / itemsPerPage);
  const paginatedCustomers = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return filteredCustomers.slice(startIndex, endIndex);
  }, [filteredCustomers, currentPage, itemsPerPage]);


  const fetchCustomers = async () => {
    try {
      const response = await fetch('/api/customers');
      const data = await response.json();
      setCustomers(data.customers || []);
    } catch (error) {
      console.error('Error fetching customers:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Layout userRole="superadmin">
      <div className="px-2 sm:px-4 py-4 sm:py-6">
        <div className="mb-4 sm:mb-6">
          <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-gray-900">Customers</h1>
        </div>

        {/* Filters */}
        <div className="bg-white shadow rounded-lg p-3 sm:p-4 mb-4 sm:mb-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-800 mb-1">
                From Date
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-800 mb-1">
                To Date
              </label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-800 mb-1">
                Filter by User
              </label>
              <select
                value={selectedUserId}
                onChange={(e) => setSelectedUserId(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none text-sm bg-white text-gray-800"
              >
                <option value="All">All Users</option>
                {users.map((user) => {
                  const userObj = user.toObject ? user.toObject() : user;
                  return (
                    <option key={userObj._id || userObj.id} value={userObj._id || userObj.id} className="text-gray-800">
                      {userObj.name || userObj.email || 'Unknown User'}
                    </option>
                  );
                })}
              </select>
            </div>
            <div className="flex items-end">
              <button
                onClick={() => {
                  const today = getTodayIST();
                  setStartDate(today);
                  setEndDate(today);
                  setSelectedUserId('All');
                }}
                className="w-full bg-gray-100 text-gray-800 px-4 py-2 rounded-lg hover:bg-gray-200 font-medium border border-gray-200 transition-colors text-sm"
              >
                Clear Filters
              </button>
            </div>
          </div>
        </div>

        {loading ? (
          <PageLoader message="Loading customers..." />
        ) : (
          <>
            {/* Desktop Table View */}
            <div className="hidden md:block bg-white shadow overflow-hidden sm:rounded-md mb-4">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 lg:px-6 py-3 text-left text-xs font-medium text-gray-800 uppercase tracking-wider">Name</th>
                      <th className="px-4 lg:px-6 py-3 text-left text-xs font-medium text-gray-800 uppercase tracking-wider">Email</th>
                      <th className="px-4 lg:px-6 py-3 text-left text-xs font-medium text-gray-800 uppercase tracking-wider">Phone</th>
                      <th className="px-4 lg:px-6 py-3 text-left text-xs font-medium text-gray-800 uppercase tracking-wider">Shop Name</th>
                      <th className="px-4 lg:px-6 py-3 text-left text-xs font-medium text-gray-800 uppercase tracking-wider">User</th>
                      <th className="px-4 lg:px-6 py-3 text-left text-xs font-medium text-gray-800 uppercase tracking-wider">Address</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {paginatedCustomers.length === 0 ? (
                      <tr>
                        <td colSpan="6" className="px-4 lg:px-6 py-8 text-center text-sm text-gray-500">
                          No customers found for the selected filters
                        </td>
                      </tr>
                    ) : (
                      paginatedCustomers.map((customer, index) => (
                        <tr key={customer._id || customer.id || `customer-${index}`} className="hover:bg-gray-50 transition-colors">
                          <td className="px-4 lg:px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{customer.name}</td>
                          <td className="px-4 lg:px-6 py-4 whitespace-nowrap text-sm text-gray-800">{customer.email || '-'}</td>
                          <td className="px-4 lg:px-6 py-4 whitespace-nowrap text-sm text-gray-800">{customer.phone || '-'}</td>
                          <td className="px-4 lg:px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                            {customer.shopName || 'N/A'}
                          </td>
                          <td className="px-4 lg:px-6 py-4 whitespace-nowrap text-sm text-gray-800">
                            {customer.userName || customer.userEmail || 'N/A'}
                          </td>
                          <td className="px-4 lg:px-6 py-4 text-sm text-gray-800 max-w-xs truncate" title={customer.address}>
                            {customer.address || '-'}
                          </td>
                        </tr>
                      ))
                    )}
                </tbody>
              </table>
            </div>
          </div>

            {/* Mobile Card View */}
            <div className="md:hidden space-y-3 mb-4">
              {paginatedCustomers.length === 0 ? (
                <div className="bg-white shadow rounded-lg p-4 text-center">
                  <p className="text-sm text-gray-500">No customers found for the selected filters</p>
                </div>
              ) : (
                paginatedCustomers.map((customer, index) => (
                  <div key={customer._id || customer.id || `customer-${index}`} className="bg-white shadow rounded-lg p-4">
                    <div className="space-y-2">
                      <div>
                        <p className="text-xs text-gray-600">Name</p>
                        <p className="text-sm font-semibold text-gray-900">{customer.name}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-600">Email</p>
                        <p className="text-sm text-gray-800 truncate">{customer.email || '-'}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-600">Phone</p>
                        <p className="text-sm text-gray-800">{customer.phone || '-'}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-600">Shop</p>
                        <p className="text-sm font-medium text-gray-900">{customer.shopName || 'N/A'}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-600">User</p>
                        <p className="text-sm text-gray-800">{customer.userName || customer.userEmail || 'N/A'}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-600">Address</p>
                        <p className="text-sm text-gray-800">{customer.address || '-'}</p>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={setCurrentPage}
            itemsPerPage={itemsPerPage}
            totalItems={filteredCustomers.length}
          />
          </>
        )}
      </div>
    </Layout>
  );
}

