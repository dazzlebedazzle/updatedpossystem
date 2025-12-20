'use client';

import { useState, useEffect } from 'react';
import Layout from '@/components/Layout';
import { PageLoader } from '@/components/Loader';

export default function AdminSales() {
  const [sales, setSales] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSales();
  }, []);

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
    <Layout userRole="admin">
      <div className="px-2 py-4 sm:px-4 sm:py-6">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-4 sm:mb-6">Sales</h1>

        {loading ? (
          <PageLoader message="Loading sales..." />
        ) : (
          <>
            {/* Desktop Table View */}
            <div className="hidden md:block bg-white shadow overflow-hidden sm:rounded-md">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-800 uppercase tracking-wider">ID</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-800 uppercase tracking-wider">Date</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-800 uppercase tracking-wider">Items</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-800 uppercase tracking-wider">Total</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-800 uppercase tracking-wider">Payment</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {sales.map((sale) => (
                      <tr key={sale.id} className="hover:bg-gray-50">
                        <td className="px-4 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{sale.id}</td>
                        <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                          {new Date(sale.createdAt).toLocaleDateString()}
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">{sale.items?.length || 0}</td>
                        <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">₹{sale.total?.toFixed(2)}</td>
                        <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">{sale.paymentMethod}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Mobile Card View */}
            <div className="md:hidden space-y-4">
              {sales.map((sale) => (
                <div key={sale.id} className="bg-white shadow rounded-lg p-4 border border-gray-200">
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <h3 className="text-base font-semibold text-gray-900">Sale #{sale.id}</h3>
                      <p className="text-sm text-gray-800 mt-1">
                        {new Date(sale.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                    <span className="text-lg font-bold text-indigo-600">₹{sale.total?.toFixed(2)}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <p className="text-gray-800">Items</p>
                      <p className="font-medium text-gray-900">{sale.items?.length || 0}</p>
                    </div>
                    <div>
                      <p className="text-gray-800">Payment</p>
                      <p className="font-medium text-gray-900">{sale.paymentMethod}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </Layout>
  );
}

