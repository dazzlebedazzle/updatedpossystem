'use client';

import { useState, useEffect } from 'react';
import Layout from '@/components/Layout';
import { authenticatedFetch } from '@/lib/api-client';
import { PageLoader } from '@/components/Loader';

export default function UserSales() {
  const [sales, setSales] = useState([]);
  const [loading, setLoading] = useState(true);
  const [userInfo, setUserInfo] = useState(null);

  useEffect(() => {
    fetchUserInfo();
    fetchSales();
  }, []);

  const fetchUserInfo = async () => {
    try {
      const response = await authenticatedFetch('/api/auth/me');
      if (response.ok) {
        const data = await response.json();
        setUserInfo(data.user);
      }
    } catch (error) {
      console.error('Error fetching user info:', error);
    }
  };

  const fetchSales = async () => {
    try {
      // Use authenticatedFetch which automatically includes Bearer token
      const response = await authenticatedFetch('/api/sales');
      const data = await response.json();
      setSales(data.sales || []);
    } catch (error) {
      console.error('Error fetching sales:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Layout userRole="user">
      <div className="px-4 py-6 sm:px-0">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">My Sales</h1>
            {userInfo && (
              <p className="text-sm text-gray-800 mt-1">
                Showing sales for: <span className="font-semibold">{userInfo.name}</span> ({userInfo.email})
              </p>
            )}
          </div>
          <button
            onClick={() => {
              setLoading(true);
              fetchSales();
            }}
            className="bg-white text-white px-4 py-2 rounded-lg hover:bg-white"
          >
            Refresh
          </button>
        </div>

        {loading ? (
          <PageLoader message="Loading sales..." />
        ) : (
          <div className="bg-white shadow overflow-hidden sm:rounded-md">
            <table className="min-w-full divide-y divide-gray-800">
              <thead className="bg-white">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-800 uppercase tracking-wider">ID</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-800 uppercase tracking-wider">Date</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-800 uppercase tracking-wider">Items</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-800 uppercase tracking-wider">Total</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-800 uppercase tracking-wider">Payment</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-800">
                {sales.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-4 text-center text-sm text-gray-800">
                      No sales found
                    </td>
                  </tr>
                ) : (
                  sales.map((sale) => (
                    <tr key={sale._id || sale.id || `sale-${Math.random()}`}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {(sale._id || sale.id || '').toString().substring(0, 8)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-800">
                        {new Date(sale.createdAt || sale.date).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-800">{sale.items?.length || 0} item(s)</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">₹{parseFloat(sale.total || 0).toFixed(2)}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-800 capitalize">{sale.paymentMethod || 'N/A'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </Layout>
  );
}

