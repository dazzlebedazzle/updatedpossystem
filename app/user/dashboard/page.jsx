'use client';

import { useState, useEffect, useMemo } from 'react';
import Layout from '@/components/Layout';
import Link from 'next/link';
import { authenticatedFetch } from '@/lib/api-client';
import { PageLoader } from '@/components/Loader';
import LoadingButton from '@/components/LoadingButton';
import { isTodayIST } from '@/lib/date-utils';

export default function UserDashboard() {
  const [stats, setStats] = useState({
    mySales: 0,
    myRevenue: 0,
    myCustomers: 0
  });
  const [allSales, setAllSales] = useState([]);
  const [loading, setLoading] = useState(true);
  const [userInfo, setUserInfo] = useState(null);

  // Calculate daily sales statistics (IST)
  const dailySalesStats = useMemo(() => {
    const todaySales = allSales.filter(sale => isTodayIST(sale.createdAt || sale.date));
    
    const totalBills = todaySales.length;
    const totalCash = todaySales
      .filter(sale => (sale.paymentMethod || '').toLowerCase() === 'cash')
      .reduce((sum, sale) => sum + (sale.total || 0), 0);
    const totalUPI = todaySales
      .filter(sale => (sale.paymentMethod || '').toLowerCase() === 'upi')
      .reduce((sum, sale) => sum + (sale.total || 0), 0);
    const totalCard = todaySales
      .filter(sale => (sale.paymentMethod || '').toLowerCase() === 'card')
      .reduce((sum, sale) => sum + (sale.total || 0), 0);
    
    return {
      totalBills,
      totalCash,
      totalUPI,
      totalCard
    };
  }, [allSales]);

  useEffect(() => {
    fetchUserInfo();
    fetchStats();
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

  const fetchStats = async () => {
    try {
      // Fetch sales using Bearer token authentication
      const salesResponse = await authenticatedFetch('/api/sales');
      const salesData = await salesResponse.json();
      const mySales = salesData.sales || [];
      const revenue = mySales.reduce((sum, sale) => sum + (sale.total || 0), 0);
      
      setAllSales(mySales);

      // Fetch customers using Bearer token authentication
      let customerCount = 0;
      try {
        const customersResponse = await authenticatedFetch('/api/customers');
        const customersData = await customersResponse.json();
        customerCount = customersData.customers?.length || 0;
      } catch (error) {
        console.error('Error fetching customers:', error);
      }

      setStats({
        mySales: mySales.length,
        myRevenue: revenue,
        myCustomers: customerCount
      });
    } catch (error) {
      console.error('Error fetching stats:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Layout userRole="user">
      <div className="px-2 py-4 sm:px-4 sm:py-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4 sm:mb-6">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Dashboard</h1>
            {userInfo && (
              <p className="text-xs sm:text-sm text-gray-800 mt-1">
                Welcome back, <span className="font-semibold">{userInfo.name}</span> ({userInfo.email})
              </p>
            )}
          </div>
          <LoadingButton
            onClick={() => {
              setLoading(true);
              fetchStats();
            }}
            loading={loading}
            loadingText="Refreshing..."
            className="w-full sm:w-auto text-sm sm:text-base"
          >
            Refresh
          </LoadingButton>
        </div>

        {loading ? (
          <PageLoader message="Loading dashboard..." />
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:gap-5 sm:grid-cols-2 lg:grid-cols-3">
            <div className="bg-white overflow-hidden shadow rounded-lg">
              <div className="p-5">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <svg className="h-6 w-6 text-gray-800" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-800 truncate">My Sales</dt>
                      <dd className="text-lg font-medium text-gray-900">{stats.mySales}</dd>
                    </dl>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white overflow-hidden shadow rounded-lg">
              <div className="p-5">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <svg className="h-6 w-6 text-gray-800" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-800 truncate">My Revenue</dt>
                      <dd className="text-lg font-medium text-gray-900">₹{stats.myRevenue.toFixed(2)}</dd>
                    </dl>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white overflow-hidden shadow rounded-lg">
              <div className="p-5">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <svg className="h-6 w-6 text-gray-800" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-800 truncate">My Customers</dt>
                      <dd className="text-lg font-medium text-gray-900">{stats.myCustomers}</dd>
                    </dl>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Daily Sales Statistics (IST) */}
        <div className="mt-6 sm:mt-8">
          <h2 className="text-lg sm:text-xl font-semibold text-gray-900 mb-3 sm:mb-4">Today's Sales (IST)</h2>
          <div className="grid grid-cols-1 gap-4 sm:gap-5 sm:grid-cols-2 lg:grid-cols-4">
            <div className="bg-white overflow-hidden shadow rounded-lg p-4 sm:p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <svg className="h-6 w-6 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <div className="ml-4 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-800 truncate">Total Bills</dt>
                    <dd className="text-lg font-medium text-gray-900">{dailySalesStats.totalBills}</dd>
                  </dl>
                </div>
              </div>
            </div>

            <div className="bg-white overflow-hidden shadow rounded-lg p-4 sm:p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <svg className="h-6 w-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                </div>
                <div className="ml-4 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-800 truncate">Total Cash</dt>
                    <dd className="text-lg font-medium text-gray-900">₹{dailySalesStats.totalCash.toFixed(2)}</dd>
                  </dl>
                </div>
              </div>
            </div>

            <div className="bg-white overflow-hidden shadow rounded-lg p-4 sm:p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <svg className="h-6 w-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                  </svg>
                </div>
                <div className="ml-4 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-800 truncate">Total UPI</dt>
                    <dd className="text-lg font-medium text-gray-900">₹{dailySalesStats.totalUPI.toFixed(2)}</dd>
                  </dl>
                </div>
              </div>
            </div>

            <div className="bg-white overflow-hidden shadow rounded-lg p-4 sm:p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <svg className="h-6 w-6 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                  </svg>
                </div>
                <div className="ml-4 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-800 truncate">Total Card</dt>
                    <dd className="text-lg font-medium text-gray-900">₹{dailySalesStats.totalCard.toFixed(2)}</dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-6 sm:mt-8">
          <Link
            href="/user/pos"
            className="inline-flex items-center justify-center w-full sm:w-auto px-6 py-3 border border-transparent text-sm sm:text-base font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 transition"
          >
            Open POS System
          </Link>
        </div>
      </div>
    </Layout>
  );
}

