'use client';

import { useState, useEffect } from 'react';
import Layout from '@/components/Layout';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';

export default function SuperAdminDashboard() {
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalProducts: 0,
    totalSales: 0,
    totalRevenue: 0
  });
  const [loading, setLoading] = useState(true);
  const [chartLoading, setChartLoading] = useState(true);
  const [period, setPeriod] = useState('daily'); // daily, monthly, yearly
  const [salesData, setSalesData] = useState([]);
  const [revenueData, setRevenueData] = useState([]);
  const [customersData, setCustomersData] = useState([]);

  useEffect(() => {
    fetchStats();
    fetchChartData();
  }, []);

  useEffect(() => {
    fetchChartData();
  }, [period]);

  const fetchStats = async () => {
    try {
      const [usersRes, productsRes, salesRes] = await Promise.all([
        fetch('/api/users'),
        fetch('/api/products'),
        fetch('/api/sales')
      ]);

      const usersData = await usersRes.json();
      const productsData = await productsRes.json();
      const salesData = await salesRes.json();

      const revenue = salesData.sales.reduce((sum, sale) => sum + (sale.total || 0), 0);

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
  };

  const fetchChartData = async () => {
    try {
      setChartLoading(true);
      const response = await fetch(`/api/dashboard/analytics?period=${period}`);
      const data = await response.json();

      setSalesData(data.sales || []);
      setRevenueData(data.revenue || []);
      setCustomersData(data.customers || []);
    } catch (error) {
      console.error('Error fetching chart data:', error);
    } finally {
      setChartLoading(false);
    }
  };

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

  return (
    <Layout userRole="superadmin">
      <div className="px-4 py-6 sm:px-0">
        <h1 className="text-3xl font-bold text-gray-900 mb-6">Super Admin Dashboard</h1>

        {loading ? (
          <div>Loading...</div>
        ) : (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4 mb-8">
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
                      <dt className="text-sm font-medium text-gray-600 truncate">Total Users</dt>
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
                      <dt className="text-sm font-medium text-gray-600 truncate">Total Products</dt>
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
                      <dt className="text-sm font-medium text-gray-600 truncate">Total Sales</dt>
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
                      <dt className="text-sm font-medium text-gray-600 truncate">Total Revenue</dt>
                      <dd className="text-lg font-medium text-gray-900">₹{stats.totalRevenue.toFixed(2)}</dd>
                    </dl>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Period Selector */}
        <div className="mb-6 bg-white shadow rounded-lg p-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">Chart Period</h2>
            <div className="flex gap-2">
              <button
                onClick={() => setPeriod('daily')}
                className={`px-4 py-2 rounded-lg font-medium transition ${
                  period === 'daily'
                    ? 'bg-indigo-600 text-white'
                    : 'bg-white text-gray-800 hover:bg-white'
                }`}
              >
                Daily
              </button>
              <button
                onClick={() => setPeriod('monthly')}
                className={`px-4 py-2 rounded-lg font-medium transition ${
                  period === 'monthly'
                    ? 'bg-indigo-600 text-white'
                    : 'bg-white text-gray-800 hover:bg-white'
                }`}
              >
                Monthly
              </button>
              <button
                onClick={() => setPeriod('yearly')}
                className={`px-4 py-2 rounded-lg font-medium transition ${
                  period === 'yearly'
                    ? 'bg-indigo-600 text-white'
                    : 'bg-white text-gray-800 hover:bg-white'
                }`}
              >
                Yearly
              </button>
            </div>
          </div>
        </div>

        {/* Charts Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Sales Chart */}
          <div className="bg-white shadow rounded-lg p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Sales ({period.charAt(0).toUpperCase() + period.slice(1)})
            </h3>
            {chartLoading ? (
              <div className="h-64 flex items-center justify-center text-gray-600">Loading chart data...</div>
            ) : salesData.length === 0 ? (
              <div className="h-64 flex items-center justify-center text-gray-600">No sales data available</div>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
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
            )}
          </div>

          {/* Revenue Chart */}
          <div className="bg-white shadow rounded-lg p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Revenue ({period.charAt(0).toUpperCase() + period.slice(1)})
            </h3>
            {chartLoading ? (
              <div className="h-64 flex items-center justify-center text-gray-600">Loading chart data...</div>
            ) : revenueData.length === 0 ? (
              <div className="h-64 flex items-center justify-center text-gray-600">No revenue data available</div>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
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
            )}
          </div>

          {/* Daily Customers Chart */}
          {period === 'daily' && (
            <div className="bg-white shadow rounded-lg p-6 lg:col-span-2">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Daily Total Customers</h3>
              {chartLoading ? (
                <div className="h-64 flex items-center justify-center text-gray-600">Loading chart data...</div>
              ) : customersData.length === 0 ? (
                <div className="h-64 flex items-center justify-center text-gray-600">No customer data available</div>
              ) : (
                <ResponsiveContainer width="100%" height={300}>
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
              )}
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
