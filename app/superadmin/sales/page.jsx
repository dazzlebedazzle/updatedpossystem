'use client';

import { useState, useEffect, useMemo } from 'react';
import Layout from '@/components/Layout';
import { PageLoader } from '@/components/Loader';
import Pagination from '@/components/Pagination';
import { getTodayIST } from '@/lib/date-utils';

export default function SuperAdminSales() {
  const [sales, setSales] = useState([]);
  const [loading, setLoading] = useState(true);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  useEffect(() => {
    fetchSales();
    // Set default date range to today (IST)
    const today = getTodayIST();
    setStartDate(today);
    setEndDate(today);
  }, []);

  // Filter sales by date range
  const filteredSales = useMemo(() => {
    if (!startDate && !endDate) {
      return sales;
    }

    return sales.filter(sale => {
      const saleDate = new Date(sale.createdAt || sale.date);
      saleDate.setHours(0, 0, 0, 0);

      if (startDate && endDate) {
        const start = new Date(startDate);
        start.setHours(0, 0, 0, 0);
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        return saleDate >= start && saleDate <= end;
      } else if (startDate) {
        const start = new Date(startDate);
        start.setHours(0, 0, 0, 0);
        return saleDate >= start;
      } else if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        return saleDate <= end;
      }
      return true;
    });
  }, [sales, startDate, endDate]);

  // Pagination calculations
  const totalPages = Math.ceil(filteredSales.length / itemsPerPage);
  const paginatedSales = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return filteredSales.slice(startIndex, endIndex);
  }, [filteredSales, currentPage, itemsPerPage]);

  // Reset to page 1 when sales change
  useEffect(() => {
    setCurrentPage(1);
  }, [filteredSales.length]);

  const fetchSales = async () => {
    try {
      const response = await fetch('/api/sales');
      const data = await response.json();
      setSales(data.sales || []);
    } catch (error) {
      console.error('Error fetching sales:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Layout userRole="superadmin">
      <div className="px-2 sm:px-4 py-4 sm:py-6">
        <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-gray-900 mb-4 sm:mb-6">All Sales</h1>

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
          <PageLoader message="Loading sales..." />
        ) : (
          <>
            {/* Desktop Table View */}
            <div className="hidden md:block bg-white shadow overflow-hidden sm:rounded-md mb-4">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 lg:px-6 py-3 text-left text-xs font-medium text-gray-800 uppercase tracking-wider">ID</th>
                      <th className="px-4 lg:px-6 py-3 text-left text-xs font-medium text-gray-800 uppercase tracking-wider">Date</th>
                      <th className="px-4 lg:px-6 py-3 text-left text-xs font-medium text-gray-800 uppercase tracking-wider">Items</th>
                      <th className="px-4 lg:px-6 py-3 text-left text-xs font-medium text-gray-800 uppercase tracking-wider">Total</th>
                      <th className="px-4 lg:px-6 py-3 text-left text-xs font-medium text-gray-800 uppercase tracking-wider">Payment</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {paginatedSales.map((sale) => (
                    <tr key={sale.id}>
                      <td className="px-4 lg:px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{sale.id}</td>
                      <td className="px-4 lg:px-6 py-4 whitespace-nowrap text-sm text-gray-800">
                        {new Date(sale.createdAt).toLocaleDateString()}
                      </td>
                      <td className="px-4 lg:px-6 py-4 whitespace-nowrap text-sm text-gray-800">{sale.items?.length || 0}</td>
                      <td className="px-4 lg:px-6 py-4 whitespace-nowrap text-sm text-gray-800">₹{sale.total?.toFixed(2)}</td>
                      <td className="px-4 lg:px-6 py-4 whitespace-nowrap text-sm text-gray-800">{sale.paymentMethod}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

            {/* Mobile Card View */}
            <div className="md:hidden space-y-3 mb-4">
              {paginatedSales.map((sale) => (
                <div key={sale.id} className="bg-white shadow rounded-lg p-4">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <p className="text-sm font-medium text-gray-800">Sale ID</p>
                      <p className="text-base font-semibold text-gray-900">{sale.id}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium text-gray-800">Total</p>
                      <p className="text-base font-semibold text-indigo-600">₹{sale.total?.toFixed(2)}</p>
                    </div>
                  </div>
                  <div className="space-y-1.5 pt-2 border-t border-gray-100">
                    <div className="flex justify-between">
                      <span className="text-xs text-gray-600">Date:</span>
                      <span className="text-xs text-gray-800">{new Date(sale.createdAt).toLocaleDateString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-xs text-gray-600">Items:</span>
                      <span className="text-xs text-gray-800">{sale.items?.length || 0}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-xs text-gray-600">Payment:</span>
                      <span className="text-xs text-gray-800 capitalize">{sale.paymentMethod}</span>
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
            totalItems={filteredSales.length}
          />
          </>
        )}
      </div>
    </Layout>
  );
}

