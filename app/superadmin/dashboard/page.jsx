'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import Layout from '@/components/Layout';
import { PageLoader, Loader } from '@/components/Loader';
import { isTodayIST } from '@/lib/date-utils';

export default function SuperAdminDashboard() {
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalProducts: 0,
    totalSales: 0,
    totalRevenue: 0
  });
  const [allSales, setAllSales] = useState([]);
  const [loading, setLoading] = useState(true);
  const [chartLoading, setChartLoading] = useState(true);
  const [period, setPeriod] = useState('daily'); // daily, monthly, yearly
  const [salesData, setSalesData] = useState([]);
  const [revenueData, setRevenueData] = useState([]);
  const [customersData, setCustomersData] = useState([]);
  const [targets, setTargets] = useState([]);

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

  const fetchStats = useCallback(async () => {
    try {
      // Use default cache for bfcache compatibility
      const [usersRes, productsRes, salesRes, targetsRes] = await Promise.all([
        fetch('/api/users', { cache: 'default' }),
        fetch('/api/products', { cache: 'default' }),
        fetch('/api/sales', { cache: 'default' }),
        fetch('/api/targets', { cache: 'no-store' })
      ]);

      const [usersData, productsData, salesData, targetsData] = await Promise.all([
        usersRes.json(),
        productsRes.json(),
        salesRes.json(),
        targetsRes.json()
      ]);

      // Use useMemo for expensive calculations
      const revenue = salesData.sales?.reduce((sum, sale) => sum + (sale.total || 0), 0) || 0;

      setAllSales(salesData.sales || []);
      setTargets(targetsData.targets || []);
      setStats({
        totalUsers: usersData.users?.length || 0,
        totalProducts: productsData.products?.length || 0,
        totalSales: salesData.sales?.length || 0,
        totalRevenue: revenue
      });
    } catch (error) {
      console.error('Error fetching stats:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchChartData = useCallback(async () => {
    try {
      setChartLoading(true);
      // Use default cache for bfcache compatibility
      const response = await fetch(`/api/dashboard/analytics?period=${period}`, {
        cache: 'default'
      });
      const data = await response.json();

      setSalesData(data.sales || []);
      setRevenueData(data.revenue || []);
      setCustomersData(data.customers || []);
    } catch (error) {
      console.error('Error fetching chart data:', error);
    } finally {
      setChartLoading(false);
    }
  }, [period]);

  useEffect(() => {
    fetchStats();
    fetchChartData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    fetchChartData();
  }, [fetchChartData]);

  const formatDateLabel = (date) => {
    if (period === 'daily') {
      const d = new Date(date);
      return `${d.getDate()}/${d.getMonth() + 1}`;
    } else if (period === 'monthly') {
      const [year, month] = date.split('-');
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      return `${monthNames[parseInt(month) - 1]} ${year}`;
    } else {
      return date;
    }
  };

  const targetCompletion = useMemo(() => {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const nextMonthStart = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const monthlySales = allSales.filter((sale) => {
      const saleDate = new Date(sale.createdAt || sale.date);
      return saleDate >= monthStart && saleDate < nextMonthStart;
    });

    const revenueByShop = monthlySales.reduce((map, sale) => {
      const shopName = sale.shopName || 'N/A';
      map[shopName] = (map[shopName] || 0) + (Number(sale.total) || 0);
      return map;
    }, {});

    const buckets = [
      { name: 'Below Minimum', value: 0, color: '#DC2626' },
      { name: 'In Progress', value: 0, color: '#F59E0B' },
      { name: 'Achieved', value: 0, color: '#16A34A' },
    ];

    const storeRows = targets
      .filter((target) => target.isActive !== false)
      .map((target) => {
        const achieved = revenueByShop[target.shopName] || 0;
        const targetAmount = Number(target.targetAmount) || 0;
        const minimumTargetAmount = Number(target.minimumTargetAmount) || targetAmount * 0.6;
        const completion = targetAmount > 0 ? Math.min((achieved / targetAmount) * 100, 999) : 0;
        let status = 'Below Minimum';

        if (targetAmount > 0 && achieved >= targetAmount) {
          status = 'Achieved';
          buckets[2].value += 1;
        } else if (achieved >= minimumTargetAmount) {
          status = 'In Progress';
          buckets[1].value += 1;
        } else {
          buckets[0].value += 1;
        }

        return {
          shopName: target.shopName,
          achieved,
          targetAmount,
          completion,
          status
        };
      })
      .sort((a, b) => a.completion - b.completion)
      .slice(0, 5);

    return {
      chartData: buckets.filter((bucket) => bucket.value > 0),
      storeRows,
      activeTargets: targets.filter((target) => target.isActive !== false).length
    };
  }, [allSales, targets]);

  return (
    <Layout userRole="superadmin">
      <div className="px-2 py-4 sm:px-4 sm:py-6">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-4 sm:mb-6">Super Admin Dashboard</h1>

        {loading ? (
          <PageLoader message="Loading dashboard..." />
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:gap-5 sm:grid-cols-2 lg:grid-cols-4 mb-6 sm:mb-8">
            <div className="bg-white overflow-hidden shadow rounded-lg">
              <div className="p-5">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <svg className="h-6 w-6 text-gray-800" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                    </svg>
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-800 truncate">Total Users</dt>
                      <dd className="text-lg font-medium text-gray-900">{stats.totalUsers}</dd>
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
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                    </svg>
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-800 truncate">Total Products</dt>
                      <dd className="text-lg font-medium text-gray-900">{stats.totalProducts}</dd>
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
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-800 truncate">Total Sales</dt>
                      <dd className="text-lg font-medium text-gray-900">{stats.totalSales}</dd>
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
                      <dt className="text-sm font-medium text-gray-800 truncate">Total Revenue</dt>
                      <dd className="text-lg font-medium text-gray-900">₹{stats.totalRevenue.toFixed(2)}</dd>
                    </dl>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Daily Sales Statistics (IST) */}
        <div className="mb-4 sm:mb-6">
          <h2 className="text-lg sm:text-xl font-semibold text-gray-900 mb-3 sm:mb-4">Today&apos;s Sales (IST)</h2>
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

        <div className="mb-4 sm:mb-6 bg-white shadow rounded-lg p-4 sm:p-6">
          <div className="flex flex-col lg:flex-row gap-6">
            <div className="lg:w-1/2">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-lg sm:text-xl font-semibold text-gray-900">Monthly Target Radar</h2>
                <span className="text-sm text-gray-700">{targetCompletion.activeTargets} active targets</span>
              </div>
              {targetCompletion.chartData.length === 0 ? (
                <div className="h-64 flex items-center justify-center text-gray-800 text-sm">
                  No active targets configured
                </div>
              ) : (
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={targetCompletion.chartData}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        innerRadius={55}
                        outerRadius={90}
                        paddingAngle={3}
                        label={({ name, value }) => `${name}: ${value}`}
                      >
                        {targetCompletion.chartData.map((entry) => (
                          <Cell key={entry.name} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value, name) => [value, name]} />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
            <div className="lg:w-1/2">
              <h3 className="text-base font-semibold text-gray-900 mb-3">Lowest Completion Stores</h3>
              <div className="space-y-3">
                {targetCompletion.storeRows.length === 0 ? (
                  <div className="text-sm text-gray-800">Set store targets to see completion status.</div>
                ) : (
                  targetCompletion.storeRows.map((store) => (
                    <div key={store.shopName} className="border border-gray-200 rounded-lg p-3">
                      <div className="flex items-center justify-between gap-3 mb-2">
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">{store.shopName}</p>
                          <p className="text-xs text-gray-700">Rs {store.achieved.toFixed(2)} / Rs {store.targetAmount.toFixed(2)}</p>
                        </div>
                        <span className={`px-2 py-1 rounded-full text-xs font-medium whitespace-nowrap ${
                          store.status === 'Achieved'
                            ? 'bg-green-100 text-green-800'
                            : store.status === 'In Progress'
                              ? 'bg-orange-100 text-orange-800'
                              : 'bg-red-100 text-red-800'
                        }`}>
                          {store.status}
                        </span>
                      </div>
                      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full ${
                            store.status === 'Achieved'
                              ? 'bg-green-600'
                              : store.status === 'In Progress'
                                ? 'bg-orange-500'
                                : 'bg-red-600'
                          }`}
                          style={{ width: `${Math.min(store.completion, 100)}%` }}
                        ></div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Period Selector */}
        <div className="mb-4 sm:mb-6 bg-white shadow rounded-lg p-3 sm:p-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-0">
            <h2 className="text-base sm:text-lg font-semibold text-gray-900">Chart Period</h2>
            <div className="flex gap-2 w-full sm:w-auto">
              <button
                onClick={() => setPeriod('daily')}
                className={`flex-1 sm:flex-none px-3 sm:px-4 py-2 rounded-lg font-medium transition text-sm sm:text-base ${
                  period === 'daily'
                    ? 'bg-indigo-600 text-white'
                    : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
                }`}
              >
                Daily
              </button>
              <button
                onClick={() => setPeriod('monthly')}
                className={`flex-1 sm:flex-none px-3 sm:px-4 py-2 rounded-lg font-medium transition text-sm sm:text-base ${
                  period === 'monthly'
                    ? 'bg-indigo-600 text-white'
                    : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
                }`}
              >
                Monthly
              </button>
              <button
                onClick={() => setPeriod('yearly')}
                className={`flex-1 sm:flex-none px-3 sm:px-4 py-2 rounded-lg font-medium transition text-sm sm:text-base ${
                  period === 'yearly'
                    ? 'bg-indigo-600 text-white'
                    : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
                }`}
              >
                Yearly
              </button>
            </div>
          </div>
        </div>

        {/* Charts Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
          {/* Sales Chart */}
          <div className="bg-white shadow rounded-lg p-4 sm:p-6">
            <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-3 sm:mb-4">
              Sales ({period.charAt(0).toUpperCase() + period.slice(1)})
            </h3>
            {chartLoading ? (
              <div className="h-48 sm:h-64 flex items-center justify-center">
                <Loader size="lg" />
              </div>
            ) : salesData.length === 0 ? (
              <div className="h-48 sm:h-64 flex items-center justify-center text-gray-800 text-sm sm:text-base">No sales data available</div>
            ) : (
              <div className="w-full h-[250px] sm:h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={salesData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis
                      dataKey="date"
                      tickFormatter={formatDateLabel}
                      angle={-45}
                      textAnchor="end"
                      height={80}
                    />
                    <YAxis />
                    <Tooltip
                      labelFormatter={(label) => `Date: ${formatDateLabel(label)}`}
                      formatter={(value) => [value, 'Sales']}
                    />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="sales"
                      stroke="#4F46E5"
                      strokeWidth={2}
                      name="Number of Sales"
                      dot={{ r: 4 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          {/* Revenue Chart */}
          <div className="bg-white shadow rounded-lg p-4 sm:p-6">
            <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-3 sm:mb-4">
              Revenue ({period.charAt(0).toUpperCase() + period.slice(1)})
            </h3>
            {chartLoading ? (
              <div className="h-48 sm:h-64 flex items-center justify-center">
                <Loader size="lg" />
              </div>
            ) : revenueData.length === 0 ? (
              <div className="h-48 sm:h-64 flex items-center justify-center text-gray-800 text-sm sm:text-base">No revenue data available</div>
            ) : (
              <div className="w-full h-[250px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={revenueData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis
                      dataKey="date"
                      tickFormatter={formatDateLabel}
                      angle={-45}
                      textAnchor="end"
                      height={80}
                    />
                    <YAxis />
                    <Tooltip
                      labelFormatter={(label) => `Date: ${formatDateLabel(label)}`}
                      formatter={(value) => [`₹${value.toFixed(2)}`, 'Revenue']}
                    />
                    <Legend />
                    <Bar dataKey="revenue" fill="#10B981" name="Revenue (₹)" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          {/* Daily Customers Chart */}
          {period === 'daily' && (
            <div className="bg-white shadow rounded-lg p-4 sm:p-6 lg:col-span-2">
              <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-3 sm:mb-4">Daily Total Customers</h3>
              {chartLoading ? (
                <div className="h-48 sm:h-64 flex items-center justify-center">
                  <Loader size="lg" />
                </div>
              ) : customersData.length === 0 ? (
                <div className="h-48 sm:h-64 flex items-center justify-center text-gray-800 text-sm sm:text-base">No customer data available</div>
              ) : (
                <div className="w-full h-[250px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={customersData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis
                        dataKey="date"
                        tickFormatter={formatDateLabel}
                        angle={-45}
                        textAnchor="end"
                        height={80}
                      />
                      <YAxis />
                      <Tooltip
                        labelFormatter={(label) => `Date: ${formatDateLabel(label)}`}
                        formatter={(value) => [value, 'Customers']}
                      />
                      <Legend />
                      <Bar dataKey="customers" fill="#F59E0B" name="Number of Customers" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
