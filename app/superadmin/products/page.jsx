'use client';

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import Layout from '@/components/Layout';
import { PageLoader } from '@/components/Loader';
import { toast } from '@/lib/toast';
import { suppliers } from '@/lib/suppliers';

export default function SuperAdminProducts() {
  const [products, setProducts] = useState([]);
  const [shops, setShops] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedShop, setSelectedShop] = useState('All');
  const [selectedSupplier, setSelectedSupplier] = useState('All');
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });
  const [itemsPerPage, setItemsPerPage] = useState(25);
  const [currentPage, setCurrentPage] = useState(1);
  const searchInputRef = useRef(null);

  useEffect(() => {
    fetchProducts();
    fetchShops();
  }, []);

  // Debounce search term for better performance
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
      setCurrentPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyPress = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, []);

  const fetchShops = useCallback(async () => {
    try {
      const response = await fetch('/api/shops', { cache: 'default' });
      if (response.ok) {
      const data = await response.json();
        setShops(data.shops || []);
      }
    } catch (error) {
      console.error('Error fetching shops:', error);
    }
  }, []);

  const fetchProducts = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/products', { cache: 'default' });
      const data = await response.json();
      setProducts(data.products || []);
    } catch (error) {
      console.error('Error fetching products:', error);
      toast.error('Failed to load products');
    } finally {
      setLoading(false);
    }
  }, []);

  // Handle column sorting
  const handleSort = useCallback((key) => {
    setSortConfig(prevConfig => {
      if (prevConfig.key === key) {
        return { key, direction: prevConfig.direction === 'asc' ? 'desc' : 'asc' };
      }
      return { key, direction: 'asc' };
    });
  }, []);

  // Filter and sort products
  const filteredProducts = useMemo(() => {
    let filtered = products;

    // Filter by shop
    if (selectedShop !== 'All') {
      filtered = filtered.filter(product => {
        const productShopId = product.shopId?.toString();
        return productShopId === selectedShop;
      });
    }

    // Filter by supplier
    if (selectedSupplier !== 'All') {
      filtered = filtered.filter(product => 
        (product.supplier || '').toLowerCase() === selectedSupplier.toLowerCase()
      );
    }

    // Filter by search term
    if (debouncedSearchTerm) {
      const searchLower = debouncedSearchTerm.toLowerCase();
      filtered = filtered.filter(product => {
        const productName = (product.product_name || '').toLowerCase();
        const eanCode = String(product.EAN_code || '').toLowerCase();
        const supplier = (product.supplier || '').toLowerCase();
        const category = (product.category || '').toLowerCase();
        
        return productName.includes(searchLower) ||
               eanCode.includes(searchLower) ||
               supplier.includes(searchLower) ||
               category.includes(searchLower);
      });
    }

    // Sort products
    if (sortConfig.key) {
      filtered = [...filtered].sort((a, b) => {
        let aValue = a[sortConfig.key];
        let bValue = b[sortConfig.key];

        if (sortConfig.key === 'EAN_code' || sortConfig.key === 'qty' || sortConfig.key === 'qty_sold' || sortConfig.key === 'price') {
          aValue = parseFloat(aValue || 0);
          bValue = parseFloat(bValue || 0);
      } else {
          aValue = String(aValue || '').toLowerCase();
          bValue = String(bValue || '').toLowerCase();
        }

        if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
        if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }
    
    return filtered;
  }, [products, selectedShop, selectedSupplier, debouncedSearchTerm, sortConfig]);
  
  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [selectedShop, selectedSupplier, debouncedSearchTerm]);

  // Pagination
  const totalPages = Math.ceil(filteredProducts.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedProducts = useMemo(() => {
    return filteredProducts.slice(startIndex, endIndex);
  }, [filteredProducts, startIndex, endIndex]);

  // Generate page numbers
  const getPageNumbers = () => {
    const pages = [];
    const maxVisiblePages = 5;
    let startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2));
    let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);
    
    if (endPage - startPage < maxVisiblePages - 1) {
      startPage = Math.max(1, endPage - maxVisiblePages + 1);
    }
    
    for (let i = startPage; i <= endPage; i++) {
      pages.push(i);
    }
    return pages;
  };

  return (
    <Layout userRole="superadmin">
      <div className="px-4 py-6 sm:px-0">
        <div className="flex flex-col gap-4 mb-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <h1 className="text-3xl font-bold text-gray-800">Products</h1>
            <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
              {/* Supplier Filter Dropdown */}
              <select
                value={selectedSupplier}
                onChange={(e) => {
                  setSelectedSupplier(e.target.value);
                  setCurrentPage(1);
                }}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none text-sm sm:text-base bg-white text-gray-800"
              >
                <option value="All" className="text-gray-800">All Suppliers</option>
                {suppliers.map((supplier) => (
                  <option key={supplier} value={supplier} className="text-gray-800">
                    {supplier}
                    </option>
                ))}
              </select>
              {/* Shop Filter Dropdown */}
              <select
                value={selectedShop}
                onChange={(e) => {
                  setSelectedShop(e.target.value);
                  setCurrentPage(1);
                }}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none text-sm sm:text-base bg-white text-gray-800"
              >
                <option value="All" className="text-gray-800">All Shops</option>
                {shops.map((shop) => {
                    const shopObj = shop.toObject ? shop.toObject() : shop;
                  // shopId in products is the userId of the shop
                  const shopUserId = shopObj.userId?._id?.toString() || shopObj.userId?.toString() || shopObj._id?.toString() || shopObj.id?.toString();
                    return (
                    <option key={shopObj._id || shopObj.id} value={shopUserId} className="text-gray-800">
                      {shopObj.name}
                      </option>
                    );
                })}
              </select>
            </div>
              </div>
          
          {/* Search Bar */}
          <div className="relative w-full sm:w-96">
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Search products by name, EAN, supplier, or category... (Ctrl+K)"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-4 py-2 pl-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none text-sm sm:text-base bg-white text-gray-800 placeholder:text-gray-800"
            />
            <svg
              className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            {searchTerm && (
                    <button
                onClick={() => setSearchTerm('')}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-600 hover:text-gray-800"
                aria-label="Clear search"
              >
                ×
                    </button>
                      )}
                    </div>
                    </div>

        {/* Items per page and pagination info */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4">
          <div className="flex items-center gap-3">
            <label className="text-sm text-gray-800">Show:</label>
                <select
              value={itemsPerPage}
                  onChange={(e) => {
                setItemsPerPage(Number(e.target.value));
                setCurrentPage(1);
              }}
              className="px-3 py-1.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none text-sm bg-white text-gray-800"
            >
              <option value="25">25</option>
              <option value="50">50</option>
              <option value="75">75</option>
              <option value="100">100</option>
                </select>
            <span className="text-sm text-gray-800">entries</span>
              </div>
          <div className="text-sm text-gray-800">
            Showing {filteredProducts.length === 0 ? 0 : startIndex + 1} to {Math.min(endIndex, filteredProducts.length)} of {filteredProducts.length} products
            </div>
                    </div>

        {loading ? (
          <PageLoader message="Loading products..." />
        ) : (
          <>
            <div className="bg-white shadow overflow-hidden sm:rounded-md">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-100">
                    <tr>
                      <th 
                        className="px-6 py-3 text-left text-xs font-medium text-gray-800 uppercase tracking-wider cursor-pointer hover:bg-gray-200 select-none transition-colors"
                        onClick={() => handleSort('EAN_code')}
                      >
                        <div className="flex items-center gap-2">
                          EAN Code
                          {sortConfig.key === 'EAN_code' && (
                            <span className="text-indigo-600">{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>
                          )}
                        </div>
                      </th>
                      <th 
                        className="px-6 py-3 text-left text-xs font-medium text-gray-800 uppercase tracking-wider cursor-pointer hover:bg-gray-200 select-none transition-colors"
                        onClick={() => handleSort('product_name')}
                      >
                        <div className="flex items-center gap-2">
                          Product Name
                          {sortConfig.key === 'product_name' && (
                            <span className="text-indigo-600">{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>
                          )}
                        </div>
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-800 uppercase tracking-wider">Unit</th>
                      <th 
                        className="px-6 py-3 text-left text-xs font-medium text-gray-800 uppercase tracking-wider cursor-pointer hover:bg-gray-200 select-none transition-colors"
                        onClick={() => handleSort('price')}
                      >
                        <div className="flex items-center gap-2">
                          Price
                          {sortConfig.key === 'price' && (
                            <span className="text-indigo-600">{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>
                      )}
                    </div>
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-800 uppercase tracking-wider">Available Qty</th>
                      <th 
                        className="px-6 py-3 text-left text-xs font-medium text-gray-800 uppercase tracking-wider cursor-pointer hover:bg-gray-200 select-none transition-colors"
                        onClick={() => handleSort('qty')}
                      >
                        <div className="flex items-center gap-2">
                          Total Qty
                          {sortConfig.key === 'qty' && (
                            <span className="text-indigo-600">{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>
                          )}
                </div>
                      </th>
                      <th 
                        className="px-6 py-3 text-left text-xs font-medium text-gray-800 uppercase tracking-wider cursor-pointer hover:bg-gray-200 select-none transition-colors"
                        onClick={() => handleSort('qty_sold')}
                      >
                        <div className="flex items-center gap-2">
                          Qty Sold
                          {sortConfig.key === 'qty_sold' && (
                            <span className="text-indigo-600">{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>
                          )}
                  </div>
                      </th>
                      <th 
                        className="px-6 py-3 text-left text-xs font-medium text-gray-800 uppercase tracking-wider cursor-pointer hover:bg-gray-200 select-none transition-colors"
                        onClick={() => handleSort('supplier')}
                      >
                        <div className="flex items-center gap-2">
                          Supplier
                          {sortConfig.key === 'supplier' && (
                            <span className="text-indigo-600">{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>
                  )}
                </div>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {filteredProducts.length === 0 ? (
                      <tr>
                        <td colSpan="8" className="px-6 py-8 text-center text-sm text-gray-700">
                          {debouncedSearchTerm 
                            ? `No products found matching "${debouncedSearchTerm}"`
                            : selectedSupplier !== 'All' || selectedShop !== 'All'
                              ? `No products found for selected ${selectedSupplier !== 'All' ? 'supplier' : 'shop'}`
                              : 'No products found'
                          }
                        </td>
                      </tr>
                    ) : (
                      paginatedProducts.map((product) => {
                        const productId = product._id || product.id;
                        const availableQty = Math.round((product.qty || 0) - (product.qty_sold || 0));
                        const isLowStock = availableQty < 10;
                        
                        return (
                          <tr 
                            key={productId}
                            className="hover:bg-gray-50 transition-colors"
                          >
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-800 font-mono">{product.EAN_code}</td>
                            <td className="px-6 py-4 text-sm font-medium text-gray-800">
                              <div className="flex items-center gap-2">
                                {product.images && (
                                  <img 
                                    src={`/assets/category_images/${product.images}`}
                                    alt={product.product_name}
                                    className="w-8 h-8 object-cover rounded"
                                    loading="lazy"
                                    onError={(e) => { e.target.style.display = 'none'; }}
                                  />
                                )}
                                <span className="truncate max-w-xs" title={product.product_name}>
                                  {product.product_name}
                                </span>
                </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-800">{product.unit}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-800">₹{parseFloat(product.price || 0).toFixed(2)}</td>
                            <td className={`px-6 py-4 whitespace-nowrap text-sm font-medium ${isLowStock ? 'text-red-700' : 'text-gray-800'}`}>
                              {availableQty}
                              {isLowStock && <span className="ml-1 text-xs">⚠️</span>}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-800">{Math.round(product.qty || 0)}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-800">{Math.round(product.qty_sold || 0)}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-800">{product.supplier || '-'}</td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
                </div>
                </div>

            {/* Pagination Controls */}
            {!loading && filteredProducts.length > 0 && totalPages > 1 && (
              <div className="mt-4 flex flex-col sm:flex-row justify-between items-center gap-4">
                <div className="text-sm text-gray-800">
                  Page {currentPage} of {totalPages}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                    disabled={currentPage === 1}
                    className="px-3 py-1.5 border border-gray-300 rounded-lg bg-white hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm font-medium text-gray-800"
                  >
                    Previous
                  </button>
                  
                  <div className="flex items-center gap-1">
                    {getPageNumbers().map((pageNum) => (
                  <button
                        key={pageNum}
                        onClick={() => setCurrentPage(pageNum)}
                        className={`px-3 py-1.5 border rounded-lg text-sm font-medium transition-colors ${
                          currentPage === pageNum
                            ? 'bg-indigo-600 text-white border-indigo-600'
                            : 'border-gray-300 text-gray-800 bg-white hover:bg-gray-50'
                        }`}
                      >
                        {pageNum}
                  </button>
                    ))}
                </div>
                  
                  <button
                    onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                    disabled={currentPage === totalPages}
                    className="px-3 py-1.5 border border-gray-300 rounded-lg bg-white hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm font-medium text-gray-800"
                  >
                    Next
                  </button>
            </div>
          </div>
            )}
          </>
        )}
      </div>
    </Layout>
  );
}
