'use client';

import { useState, useEffect, useMemo } from 'react';
import Layout from '@/components/Layout';
import { PageLoader } from '@/components/Loader';
import Pagination from '@/components/Pagination';
import { getTodayIST } from '@/lib/date-utils';

export default function SuperAdminCustomers() {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  useEffect(() => {
    fetchCustomers();
    // Set default date range to today (IST)
    const today = getTodayIST();
    setStartDate(today);
    setEndDate(today);
  }, []);

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

  // Pagination calculations
  const totalPages = Math.ceil(filteredCustomers.length / itemsPerPage);
  const paginatedCustomers = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return filteredCustomers.slice(startIndex, endIndex);
  }, [filteredCustomers, currentPage, itemsPerPage]);

  // Reset to page 1 when customers change
  useEffect(() => {
    setCurrentPage(1);
  }, [filteredCustomers.length]);

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

        {/* Date Filters */}
        <div className="bg-white shadow rounded-lg p-3 sm:p-4 mb-4 sm:mb-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-800 mb-1">
                From Date
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none"
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
                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none"
              />
            </div>
            <div className="flex items-end">
              <button
                onClick={() => {
                  const today = getTodayIST();
                  setStartDate(today);
                  setEndDate(today);
                }}
                className="w-full bg-white text-gray-800 px-4 py-2 rounded-lg hover:bg-gray-50 font-medium border border-gray-200"
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
                      <th className="px-4 lg:px-6 py-3 text-left text-xs font-medium text-gray-800 uppercase tracking-wider">Address</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {paginatedCustomers.map((customer, index) => (
                    <tr key={customer._id || customer.id || `customer-${index}`}>
                      <td className="px-4 lg:px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{customer.name}</td>
                      <td className="px-4 lg:px-6 py-4 whitespace-nowrap text-sm text-gray-800">{customer.email}</td>
                      <td className="px-4 lg:px-6 py-4 whitespace-nowrap text-sm text-gray-800">{customer.phone}</td>
                      <td className="px-4 lg:px-6 py-4 whitespace-nowrap text-sm text-gray-800">{customer.address}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

            {/* Mobile Card View */}
            <div className="md:hidden space-y-3 mb-4">
              {paginatedCustomers.map((customer, index) => (
                <div key={customer._id || customer.id || `customer-${index}`} className="bg-white shadow rounded-lg p-4">
                  <div className="space-y-2">
                    <div>
                      <p className="text-xs text-gray-600">Name</p>
                      <p className="text-sm font-semibold text-gray-900">{customer.name}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-600">Email</p>
                      <p className="text-sm text-gray-800 truncate">{customer.email}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-600">Phone</p>
                      <p className="text-sm text-gray-800">{customer.phone}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-600">Address</p>
                      <p className="text-sm text-gray-800">{customer.address}</p>
                    </div>
                  </div>
                </div>
              ))}
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

