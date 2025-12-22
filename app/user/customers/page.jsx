'use client';

import { useState, useEffect, useMemo } from 'react';
import Layout from '@/components/Layout';
import { hasPermission, MODULES, OPERATIONS } from '@/lib/permissions';
import { authenticatedFetch } from '@/lib/api-client';
import { PageLoader } from '@/components/Loader';
import { getTodayIST } from '@/lib/date-utils';

export default function UserCustomers() {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [userPermissions, setUserPermissions] = useState([]);
  const [agentInfo, setAgentInfo] = useState(null);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    address: ''
  });

  useEffect(() => {
    fetchUserPermissions();
    fetchAgentDetails();
    // Set default date range to today (IST)
    const today = getTodayIST();
    setStartDate(today);
    setEndDate(today);
  }, []);

  useEffect(() => {
    if (userPermissions.length > 0) {
      fetchCustomers();
    }
  }, [userPermissions]);

  // Filter customers by date range
  const filteredCustomers = useMemo(() => {
    if (!startDate && !endDate) {
      return customers;
    }

    return customers.filter(customer => {
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
  }, [customers, startDate, endDate]);

  const fetchUserPermissions = async () => {
    try {
      const response = await fetch('/api/auth/me');
      const data = await response.json();
      setUserPermissions(data.user?.permissions || []);
    } catch (error) {
      console.error('Error fetching user permissions:', error);
    }
  };

  const fetchAgentDetails = async () => {
    try {
      // First, try to get current user from session
      const meResponse = await fetch('/api/auth/me');
      if (meResponse.ok) {
        const meData = await meResponse.json();
        const userToken = meData.user?.token;
        
        // If user has agentToken, use it
        if (userToken === 'agentToken') {
          setAgentInfo(meData.user);
          return;
        }
      }
      
      // If not in session, try to get agentToken from cookie
      const cookies = document.cookie.split(';');
      const agentTokenCookie = cookies.find(c => c.trim().startsWith('agentToken='));
      if (agentTokenCookie) {
        const agentToken = agentTokenCookie.split('=')[1];
        // Fetch user details by token
        const response = await fetch(`/api/auth/user-by-token?token=${encodeURIComponent(agentToken)}`);
        if (response.ok) {
          const data = await response.json();
          setAgentInfo(data.user);
        }
      }
    } catch (error) {
      console.error('Error fetching agent details:', error);
    }
  };

  const fetchCustomers = async () => {
    try {
      // Use authenticatedFetch which automatically includes Bearer token
      const response = await authenticatedFetch('/api/customers');
      const data = await response.json();
      setCustomers(data.customers || []);
    } catch (error) {
      console.error('Error fetching customers:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateCustomer = async (e) => {
    e.preventDefault();
    if (!hasPermission(userPermissions, MODULES.CUSTOMERS, OPERATIONS.CREATE)) {
      alert('You do not have permission to create customers');
      return;
    }

    try {
      const response = await authenticatedFetch('/api/customers', {
        method: 'POST',
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        setShowModal(false);
        setFormData({ name: '', email: '', phone: '', address: '' });
        // Refresh customers list
        setLoading(true);
        fetchCustomers();
      } else {
        const errorData = await response.json();
        alert(errorData.error || 'Failed to create customer');
      }
    } catch (error) {
      console.error('Error creating customer:', error);
      alert('Failed to create customer');
    }
  };

  const canCreate = hasPermission(userPermissions, MODULES.CUSTOMERS, OPERATIONS.CREATE);
  const canRead = hasPermission(userPermissions, MODULES.CUSTOMERS, OPERATIONS.READ);

  if (!canRead) {
    return (
      <Layout userRole="user">
        <div className="px-4 py-6 sm:px-0">
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-red-800">You do not have permission to view customers.</p>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout userRole="user">
      <div className="px-4 py-6 sm:px-0">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Customers</h1>
            {agentInfo && (
              <p className="text-sm text-gray-800 mt-1">
                Showing customers for: <span className="font-semibold">{agentInfo.name}</span> ({agentInfo.email})
              </p>
            )}
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => {
                setLoading(true);
                fetchCustomers();
              }}
              className="bg-white text-white px-4 py-2 rounded-lg hover:bg-white"
            >
              Refresh
            </button>
            {canCreate && (
              <button
                onClick={() => setShowModal(true)}
                className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700"
              >
                Add Customer
              </button>
            )}
          </div>
        </div>

        {/* Date Filters */}
        <div className="bg-white shadow rounded-lg p-4 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-800 mb-1">Start Date</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="block w-full border border-gray-200 rounded-md px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-800 mb-1">End Date</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="block w-full border border-gray-200 rounded-md px-3 py-2"
              />
            </div>
            <div className="flex items-end gap-2">
              <button
                onClick={() => {
                  const today = getTodayIST();
                  setStartDate(today);
                  setEndDate(today);
                }}
                className="px-4 py-2 bg-white text-gray-800 rounded hover:bg-white"
              >
                Clear
              </button>
            </div>
          </div>
        </div>

        {loading ? (
          <PageLoader message="Loading customers..." />
        ) : (
          <div className="bg-white shadow overflow-hidden sm:rounded-md">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-800">
                <thead className="bg-white">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-800 uppercase tracking-wider">Name</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-800 uppercase tracking-wider">Email</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-800 uppercase tracking-wider">Phone</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-800 uppercase tracking-wider">Address</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-800">
                  {filteredCustomers.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-6 py-4 text-center text-sm text-gray-800">
                        No customers found for the selected date range
                      </td>
                    </tr>
                  ) : (
                    filteredCustomers.map((customer) => (
                      <tr key={customer._id || customer.id || `customer-${Math.random()}`}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{customer.name}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-800">{customer.email}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-800">{customer.phone}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-800">{customer.address}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {showModal && canCreate && (
          <div className="fixed inset-0 bg-white bg-opacity-50 overflow-y-auto h-full w-full z-50 flex items-center justify-center p-4">
            <div className="relative mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-bold text-gray-900">Add New Customer</h3>
                <button
                  onClick={() => setShowModal(false)}
                  className="text-gray-800 hover:text-gray-800 text-xl"
                >
                  ×
                </button>
              </div>
              <form onSubmit={handleCreateCustomer} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-800">Name</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                    className="mt-1 block w-full border border-gray-200 rounded-md px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-800">Email</label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="mt-1 block w-full border border-gray-200 rounded-md px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-800">Phone</label>
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="mt-1 block w-full border border-gray-200 rounded-md px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-800">Address</label>
                  <textarea
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    className="mt-1 block w-full border border-gray-200 rounded-md px-3 py-2"
                  />
                </div>
                <div className="flex justify-end space-x-3">
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="px-4 py-2 bg-white text-gray-800 rounded hover:bg-white"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700"
                  >
                    Create
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

