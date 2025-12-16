'use client';

import { useState, useEffect, useMemo } from 'react';
import Layout from '@/components/Layout';
import { hasPermission, MODULES, OPERATIONS } from '@/lib/permissions';
import { authenticatedFetch } from '@/lib/api-client';
import jsPDF from 'jspdf';

export default function UserReports() {
  const [sales, setSales] = useState([]);
  const [loading, setLoading] = useState(true);
  const [userPermissions, setUserPermissions] = useState([]);
  const [userInfo, setUserInfo] = useState(null);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [permissionsLoading, setPermissionsLoading] = useState(true);

  useEffect(() => {
    fetchUserPermissions();
    fetchReports();
  }, []);

  const fetchUserPermissions = async () => {
    try {
      setPermissionsLoading(true);
      // Use authenticatedFetch which automatically includes Bearer token
      // This will now fetch fresh permissions from the database
      const response = await authenticatedFetch('/api/auth/me');
      if (!response.ok) {
        console.error('Failed to fetch user permissions:', response.status);
        setPermissionsLoading(false);
        return;
      }
      const data = await response.json();
      const permissions = data.user?.permissions || [];
      setUserPermissions(permissions);
      setUserInfo(data.user);
      
      // Log permissions for debugging
      console.log('Fetched permissions:', permissions);
    } catch (error) {
      console.error('Error fetching user permissions:', error);
    } finally {
      setPermissionsLoading(false);
    }
  };

  const fetchReports = async () => {
    try {
      setLoading(true);
      // Use authenticatedFetch which automatically includes Bearer token
      // The API will filter sales based on the agent's token (agentToken)
      const response = await authenticatedFetch('/api/sales');
      
      if (!response.ok) {
        const errorData = await response.json();
        console.error('Error fetching reports:', errorData.error);
        setSales([]);
        return;
      }
      
      const data = await response.json();
      // Only show sales for the logged-in agent (filtered by backend)
      setSales(data.sales || []);
    } catch (error) {
      console.error('Error fetching reports:', error);
      setSales([]);
    } finally {
      setLoading(false);
    }
  };

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

  const summary = useMemo(() => {
    const totalRevenue = filteredSales.reduce((sum, sale) => sum + (sale.total || 0), 0);
    const totalSales = filteredSales.length;
    const totalItems = filteredSales.reduce((sum, sale) => sum + (sale.items?.length || 0), 0);
    
    return {
      totalRevenue,
      totalSales,
      totalItems
    };
  }, [filteredSales]);

  const downloadCSV = () => {
    const headers = ['Sale ID', 'Date', 'Customer Name', 'Customer Mobile', 'Items', 'Total', 'Payment Method'];
    const rows = filteredSales.map(sale => {
      const date = new Date(sale.createdAt || sale.date).toLocaleDateString();
      const itemsList = sale.items?.map(item => `${item.name} (${item.quantity}${item.unit === 'kg' ? 'g' : 'pcs'})`).join('; ') || '';
      
      return [
        sale._id || sale.id || '',
        date,
        sale.customerName || '',
        sale.customerMobile || '',
        itemsList || (sale.items?.length || 0).toString(),
        sale.total?.toFixed(2) || '0.00',
        sale.paymentMethod || ''
      ];
    });

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `reports_${startDate || 'all'}_${endDate || 'all'}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const downloadPDF = () => {
    const doc = new jsPDF();
    let yPos = 20;

    doc.setFontSize(18);
    doc.text('Sales Reports', 14, yPos);
    yPos += 10;

    if (startDate || endDate) {
      doc.setFontSize(12);
      doc.text(`Date Range: ${startDate || 'All'} to ${endDate || 'All'}`, 14, yPos);
      yPos += 10;
    }

    doc.setFontSize(12);
    doc.text(`Total Revenue: ₹${summary.totalRevenue.toFixed(2)}`, 14, yPos);
    yPos += 7;
    doc.text(`Total Sales: ${summary.totalSales}`, 14, yPos);
    yPos += 7;
    doc.text(`Total Items Sold: ${summary.totalItems}`, 14, yPos);
    yPos += 15;

    doc.setFontSize(10);
    const headers = [['Date', 'Customer', 'Items', 'Total', 'Payment']];
    const tableData = filteredSales.slice(0, 20).map(sale => {
      const date = new Date(sale.createdAt || sale.date).toLocaleDateString();
      const itemsCount = sale.items?.length || 0;
      return [
        date,
        (sale.customerName || '').substring(0, 15),
        itemsCount.toString(),
        `₹${(sale.total || 0).toFixed(2)}`,
        (sale.paymentMethod || '').substring(0, 10)
      ];
    });

    doc.autoTable({
      head: headers,
      body: tableData,
      startY: yPos,
      styles: { fontSize: 8 },
      headStyles: { fillColor: [79, 70, 229] }
    });

    doc.save(`reports_${startDate || 'all'}_${endDate || 'all'}.pdf`);
  };

  const canRead = hasPermission(userPermissions, MODULES.REPORTS, OPERATIONS.READ);

  // Wait for permissions to load before showing error
  if (permissionsLoading) {
    return (
      <Layout userRole="user">
        <div className="px-4 py-6 sm:px-0">
          <div className="flex items-center justify-center py-12">
            <div className="text-gray-600">Loading permissions...</div>
          </div>
        </div>
      </Layout>
    );
  }

  if (!canRead) {
    return (
      <Layout userRole="user">
        <div className="px-4 py-6 sm:px-0">
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-red-800">You do not have permission to view reports.</p>
            <p className="text-sm text-red-600 mt-2">
              If you just received permissions, please click the refresh button or log out and log back in.
            </p>
            <button
              onClick={() => {
                fetchUserPermissions();
              }}
              className="mt-3 bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700"
            >
              Refresh Permissions
            </button>
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
            <h1 className="text-3xl font-bold text-gray-900">Reports</h1>
            {userInfo && (
              <p className="text-sm text-gray-800 mt-1">
                Showing reports for: <span className="font-semibold">{userInfo.name}</span> ({userInfo.email})
              </p>
            )}
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => {
                fetchUserPermissions();
                setLoading(true);
                fetchReports();
              }}
              className="bg-white text-white px-4 py-2 rounded-lg hover:bg-white"
            >
              Refresh
            </button>
          </div>
        </div>

        {/* Date Range Filter */}
        <div className="bg-white p-4 rounded-lg shadow mb-6">
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
                  setStartDate('');
                  setEndDate('');
                }}
                className="px-4 py-2 bg-white text-gray-800 rounded hover:bg-white"
              >
                Clear
              </button>
            </div>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="text-sm font-medium text-gray-600 mb-2">Total Revenue</h3>
            <p className="text-3xl font-bold text-indigo-600">₹{summary.totalRevenue.toFixed(2)}</p>
          </div>
          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="text-sm font-medium text-gray-600 mb-2">Total Sales</h3>
            <p className="text-3xl font-bold text-green-600">{summary.totalSales}</p>
          </div>
          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="text-sm font-medium text-gray-600 mb-2">Total Items Sold</h3>
            <p className="text-3xl font-bold text-blue-600">{summary.totalItems}</p>
          </div>
        </div>

        {/* Download Buttons */}
        <div className="flex gap-4 mb-6">
          <button
            onClick={downloadCSV}
            className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700"
          >
            Download CSV
          </button>
          <button
            onClick={downloadPDF}
            className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700"
          >
            Download PDF
          </button>
        </div>

        {/* Sales Table */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-gray-600">Loading...</div>
          </div>
        ) : (
          <div className="bg-white shadow overflow-hidden sm:rounded-md">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-800">
                <thead className="bg-white">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Date</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Customer Name</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Customer Mobile</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Items</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Total</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Payment Method</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-800">
                  {filteredSales.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-6 py-4 text-center text-sm text-gray-600">
                        No sales found
                      </td>
                    </tr>
                  ) : (
                    filteredSales.map((sale) => (
                      <tr key={sale._id || sale.id || `sale-${Math.random()}`}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                          {new Date(sale.createdAt || sale.date).toLocaleDateString()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{sale.customerName || 'N/A'}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{sale.customerMobile || 'N/A'}</td>
                        <td className="px-6 py-4 text-sm text-gray-600">
                          {sale.items?.length || 0} item(s)
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">₹{parseFloat(sale.total || 0).toFixed(2)}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{sale.paymentMethod || 'N/A'}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}

