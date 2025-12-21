'use client';

import { useState, useEffect, useMemo } from 'react';
import Layout from '@/components/Layout';
import { PageLoader } from '@/components/Loader';
import Pagination from '@/components/Pagination';

export default function SuperAdminSales() {
  const [sales, setSales] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  useEffect(() => {
    fetchSales();
  }, []);

  // Pagination calculations
  const totalPages = Math.ceil(sales.length / itemsPerPage);
  const paginatedSales = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return sales.slice(startIndex, endIndex);
  }, [sales, currentPage, itemsPerPage]);

  // Reset to page 1 when sales change
  useEffect(() => {
    setCurrentPage(1);
  }, [sales.length]);

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
            totalItems={sales.length}
          />
          </>
        )}
      </div>
    </Layout>
  );
}

