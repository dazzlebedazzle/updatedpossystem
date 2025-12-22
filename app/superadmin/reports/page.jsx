'use client';

import { useState, useEffect, useMemo } from 'react';
import Layout from '@/components/Layout';
import jsPDF from 'jspdf';
import { PageLoader } from '@/components/Loader';
import Pagination from '@/components/Pagination';
import { getTodayIST, isTodayIST } from '@/lib/date-utils';

export default function SuperAdminReports() {
  const [sales, setSales] = useState([]);
  const [loading, setLoading] = useState(true);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  useEffect(() => {
    fetchReports();
    // Set default date range to today (IST)
    const today = getTodayIST();
    setStartDate(today);
    setEndDate(today);
  }, []);

  // Fetch sales data from database via API (saleModel)
  const fetchReports = async () => {
    try {
      // Fetch all sales from database using saleModel through /api/sales endpoint
      const response = await fetch('/api/sales');
      const data = await response.json();
      // Set sales data from database (saleModel)
      setSales(data.sales || []);
    } catch (error) {
      console.error('Error fetching reports from database:', error);
    } finally {
      setLoading(false);
    }
  };

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

  // Calculate summary statistics
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

  // Calculate daily sales statistics (IST) - for today's sales only
  const dailySalesStats = useMemo(() => {
    const todaySales = sales.filter(sale => isTodayIST(sale.createdAt || sale.date));
    
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
  }, [sales]);

  // Pagination calculations for filtered sales
  const totalPages = Math.ceil(filteredSales.length / itemsPerPage);
  const paginatedSales = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return filteredSales.slice(startIndex, endIndex);
  }, [filteredSales, currentPage, itemsPerPage]);

  // Reset to page 1 when filtered sales change
  useEffect(() => {
    setCurrentPage(1);
  }, [filteredSales.length]);

  // Download CSV
  const downloadCSV = () => {
    const headers = ['Sale ID', 'Date', 'Customer Name', 'Customer Mobile', 'Items', 'Total', 'Payment Method'];
    const rows = filteredSales.map(sale => {
      const date = new Date(sale.createdAt || sale.date).toLocaleDateString();
      const itemsCount = sale.items?.length || 0;
      const itemsList = sale.items?.map(item => `${item.name} (${item.quantity}${item.unit === 'kg' ? 'g' : 'pcs'})`).join('; ') || '';
      
      return [
        sale._id || sale.id || '',
        date,
        sale.customerName || '',
        sale.customerMobile || '',
        itemsList || itemsCount.toString(),
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
    
    const dateRange = startDate && endDate 
      ? `${startDate}_to_${endDate}` 
      : startDate 
        ? `from_${startDate}` 
        : endDate 
          ? `until_${endDate}` 
          : 'all';
    
    link.setAttribute('download', `sales_report_${dateRange}_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Download PDF
  const downloadPDF = () => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    let yPosition = 20;
    const lineHeight = 7;
    const margin = 15;

    // Title
    doc.setFontSize(18);
    doc.text('Sales Report', margin, yPosition);
    yPosition += 10;

    // Date Range
    doc.setFontSize(12);
    if (startDate && endDate) {
      doc.text(`Date Range: ${startDate} to ${endDate}`, margin, yPosition);
    } else if (startDate) {
      doc.text(`From: ${startDate}`, margin, yPosition);
    } else if (endDate) {
      doc.text(`Until: ${endDate}`, margin, yPosition);
    } else {
      doc.text('All Sales', margin, yPosition);
    }
    yPosition += 5;

    // Summary
    doc.setFontSize(10);
    doc.text(`Total Sales: ${summary.totalSales}`, margin, yPosition);
    yPosition += lineHeight;
    doc.text(`Total Revenue: ₹${summary.totalRevenue.toFixed(2)}`, margin, yPosition);
    yPosition += lineHeight;
    doc.text(`Total Items Sold: ${summary.totalItems}`, margin, yPosition);
    yPosition += 10;

    // Table Headers
    doc.setFontSize(9);
    doc.setFont(undefined, 'bold');
    const headers = ['ID', 'Date', 'Customer', 'Items', 'Total', 'Payment'];
    const colWidths = [25, 30, 45, 30, 25, 30];
    let xPosition = margin;
    
    headers.forEach((header, index) => {
      doc.text(header, xPosition, yPosition);
      xPosition += colWidths[index];
    });
    
    yPosition += lineHeight;
    doc.setLineWidth(0.5);
    doc.line(margin, yPosition, pageWidth - margin, yPosition);
    yPosition += 3;

    // Table Rows
    doc.setFont(undefined, 'normal');
    filteredSales.forEach((sale) => {
      // Check if we need a new page
      if (yPosition > pageHeight - 30) {
        doc.addPage();
        yPosition = 20;
      }

      const saleId = (sale._id || sale.id || '').toString().substring(0, 8);
      const date = new Date(sale.createdAt || sale.date).toLocaleDateString();
      const customer = (sale.customerName || 'N/A').substring(0, 20);
      const itemsCount = sale.items?.length || 0;
      const total = `₹${(sale.total || 0).toFixed(2)}`;
      const payment = (sale.paymentMethod || '').substring(0, 10);

      xPosition = margin;
      doc.text(saleId, xPosition, yPosition);
      xPosition += colWidths[0];
      doc.text(date, xPosition, yPosition);
      xPosition += colWidths[1];
      doc.text(customer, xPosition, yPosition);
      xPosition += colWidths[2];
      doc.text(itemsCount.toString(), xPosition, yPosition);
      xPosition += colWidths[3];
      doc.text(total, xPosition, yPosition);
      xPosition += colWidths[4];
      doc.text(payment, xPosition, yPosition);

      yPosition += lineHeight;
    });

    // Footer
    const totalPages = doc.internal.pages.length - 1;
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.text(
        `Page ${i} of ${totalPages} - Generated on ${new Date().toLocaleDateString()}`,
        pageWidth / 2,
        pageHeight - 10,
        { align: 'center' }
      );
    }

    // Save PDF
    const dateRange = startDate && endDate 
      ? `${startDate}_to_${endDate}` 
      : startDate 
        ? `from_${startDate}` 
        : endDate 
          ? `until_${endDate}` 
          : 'all';
    
    doc.save(`sales_report_${dateRange}_${new Date().toISOString().split('T')[0]}.pdf`);
  };


  return (
    <Layout userRole="superadmin">
      <div className="px-2 sm:px-4 py-4 sm:py-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 sm:mb-6 gap-3 sm:gap-4">
          <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-gray-900">Reports</h1>
          <div className="flex flex-wrap gap-2 w-full sm:w-auto">
            <button
              onClick={downloadCSV}
              disabled={filteredSales.length === 0}
              className="flex-1 sm:flex-none bg-green-600 text-white px-3 sm:px-4 py-2 rounded-lg hover:bg-green-700 active:bg-green-800 disabled:opacity-50 disabled:cursor-not-allowed font-medium text-sm sm:text-base touch-manipulation"
            >
              📥 Download CSV
            </button>
            <button
              onClick={downloadPDF}
              disabled={filteredSales.length === 0}
              className="flex-1 sm:flex-none bg-red-600 text-white px-3 sm:px-4 py-2 rounded-lg hover:bg-red-700 active:bg-red-800 disabled:opacity-50 disabled:cursor-not-allowed font-medium text-sm sm:text-base touch-manipulation"
            >
              📄 Download PDF
            </button>
          </div>
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
                  setStartDate('');
                  setEndDate('');
                }}
                className="w-full bg-white text-gray-800 px-4 py-2 rounded-lg hover:bg-white font-medium"
              >
                Clear Filters
              </button>
            </div>
          </div>
        </div>

        {/* Daily Sales Statistics (IST) */}
        <div className="mb-4 sm:mb-6">
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

        {/* Summary Cards */}
        <div className="grid grid-cols-1 gap-4 sm:gap-5 sm:grid-cols-3 mb-4 sm:mb-6">
          <div className="bg-white overflow-hidden shadow rounded-lg p-4 sm:p-6">
            <h3 className="text-xs sm:text-sm font-medium text-gray-800">Total Revenue</h3>
            <p className="mt-2 text-2xl sm:text-3xl font-bold text-gray-900">₹{summary.totalRevenue.toFixed(2)}</p>
          </div>
          <div className="bg-white overflow-hidden shadow rounded-lg p-4 sm:p-6">
            <h3 className="text-xs sm:text-sm font-medium text-gray-800">Total Sales</h3>
            <p className="mt-2 text-2xl sm:text-3xl font-bold text-gray-900">{summary.totalSales}</p>
          </div>
          <div className="bg-white overflow-hidden shadow rounded-lg p-4 sm:p-6">
            <h3 className="text-xs sm:text-sm font-medium text-gray-800">Total Items Sold</h3>
            <p className="mt-2 text-2xl sm:text-3xl font-bold text-gray-900">{summary.totalItems}</p>
          </div>
        </div>

        {/* Sales Table */}
        {loading ? (
          <PageLoader message="Loading reports..." />
        ) : filteredSales.length === 0 ? (
          <div className="bg-white shadow rounded-lg p-8 text-center">
            <div className="text-gray-800">No sales found for the selected date range.</div>
          </div>
        ) : (
          <>
            {/* Desktop Table View */}
            <div className="hidden lg:block bg-white shadow overflow-hidden sm:rounded-md mb-4">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 xl:px-6 py-3 text-left text-xs font-medium text-gray-800 uppercase tracking-wider">Sale ID</th>
                      <th className="px-4 xl:px-6 py-3 text-left text-xs font-medium text-gray-800 uppercase tracking-wider">Date</th>
                      <th className="px-4 xl:px-6 py-3 text-left text-xs font-medium text-gray-800 uppercase tracking-wider">Customer Name</th>
                      <th className="px-4 xl:px-6 py-3 text-left text-xs font-medium text-gray-800 uppercase tracking-wider">Customer Mobile</th>
                      <th className="px-4 xl:px-6 py-3 text-left text-xs font-medium text-gray-800 uppercase tracking-wider">Items</th>
                      <th className="px-4 xl:px-6 py-3 text-left text-xs font-medium text-gray-800 uppercase tracking-wider">Total</th>
                      <th className="px-4 xl:px-6 py-3 text-left text-xs font-medium text-gray-800 uppercase tracking-wider">Payment Method</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {paginatedSales.map((sale) => (
                      <tr key={sale._id || sale.id || `sale-${Math.random()}`}>
                        <td className="px-4 xl:px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {(sale._id || sale.id || '').toString().substring(0, 8)}
                        </td>
                        <td className="px-4 xl:px-6 py-4 whitespace-nowrap text-sm text-gray-800">
                          {new Date(sale.createdAt || sale.date).toLocaleDateString()}
                        </td>
                        <td className="px-4 xl:px-6 py-4 whitespace-nowrap text-sm text-gray-800">
                          {sale.customerName || 'N/A'}
                        </td>
                        <td className="px-4 xl:px-6 py-4 whitespace-nowrap text-sm text-gray-800">
                          {sale.customerMobile || 'N/A'}
                        </td>
                        <td className="px-4 xl:px-6 py-4 text-sm text-gray-800">
                          <div className="max-w-xs">
                            {sale.items?.map((item, index) => (
                              <div key={index} className="text-xs">
                                {item.name} ({item.quantity}{item.unit === 'kg' ? 'g' : 'pcs'})
                              </div>
                            )) || '0 items'}
                          </div>
                        </td>
                        <td className="px-4 xl:px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          ₹{sale.total?.toFixed(2) || '0.00'}
                        </td>
                        <td className="px-4 xl:px-6 py-4 whitespace-nowrap text-sm text-gray-800">
                          {sale.paymentMethod || 'N/A'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Mobile/Tablet Card View */}
            <div className="lg:hidden space-y-3 mb-4">
              {paginatedSales.map((sale) => (
                <div key={sale._id || sale.id || `sale-${Math.random()}`} className="bg-white shadow rounded-lg p-4">
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <p className="text-xs text-gray-600">Sale ID</p>
                      <p className="text-sm font-semibold text-gray-900">{(sale._id || sale.id || '').toString().substring(0, 8)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-gray-600">Total</p>
                      <p className="text-base font-semibold text-indigo-600">₹{sale.total?.toFixed(2) || '0.00'}</p>
                    </div>
                  </div>
                  <div className="space-y-2 pt-2 border-t border-gray-100">
                    <div className="flex justify-between">
                      <span className="text-xs text-gray-600">Date:</span>
                      <span className="text-xs text-gray-800">{new Date(sale.createdAt || sale.date).toLocaleDateString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-xs text-gray-600">Customer:</span>
                      <span className="text-xs text-gray-800">{sale.customerName || 'N/A'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-xs text-gray-600">Mobile:</span>
                      <span className="text-xs text-gray-800">{sale.customerMobile || 'N/A'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-xs text-gray-600">Payment:</span>
                      <span className="text-xs text-gray-800 capitalize">{sale.paymentMethod || 'N/A'}</span>
                    </div>
                    <div>
                      <p className="text-xs text-gray-600 mb-1">Items:</p>
                      <div className="space-y-1">
                        {sale.items?.map((item, index) => (
                          <div key={index} className="text-xs text-gray-800">
                            • {item.name} ({item.quantity}{item.unit === 'kg' ? 'g' : 'pcs'})
                          </div>
                        )) || <span className="text-xs text-gray-800">0 items</span>}
                      </div>
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
