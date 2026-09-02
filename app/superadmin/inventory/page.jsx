'use client';

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import Layout from '@/components/Layout';
import { toast } from '@/lib/toast';
import { suppliers } from '@/lib/suppliers';
import LoadingButton from '@/components/LoadingButton';

export default function SuperAdminInventory() {
  const [products, setProducts] = useState([]);
  const [shops, setShops] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingProductId, setEditingProductId] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [selectedSupplier, setSelectedSupplier] = useState('All');
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });
  const [itemsPerPage, setItemsPerPage] = useState(25);
  const [currentPage, setCurrentPage] = useState(1);
  const searchInputRef = useRef(null);
  const [formData, setFormData] = useState({
    EAN_code: '',
    product_name: '',
    images: '',
    unit: 'kg',
    supplier: '',
    qty: '',
    qty_sold: '0',
    expiry_date: '',
    date_arrival: '',
    price: '',
    category: 'general',
    shopId: ''
  });

  useEffect(() => {
    fetchProducts();
    fetchShops();
  }, []);

  // Debounce search term for better performance
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
      setCurrentPage(1); // Reset to first page on search
    }, 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyPress = (e) => {
      // Ctrl/Cmd + K to focus search
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
      // Escape to close modal
      if (e.key === 'Escape' && showModal) {
        setShowModal(false);
        resetForm();
      }
      // Ctrl/Cmd + N to add new product
      if ((e.ctrlKey || e.metaKey) && e.key === 'n' && !showModal) {
        e.preventDefault();
        resetForm();
        setShowModal(true);
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [showModal]);

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
      const allProducts = data.products || [];
      setProducts(allProducts);
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
        // Toggle direction if same column
        return { key, direction: prevConfig.direction === 'asc' ? 'desc' : 'asc' };
      }
      // New column, default to ascending
      return { key, direction: 'asc' };
    });
  }, []);

  // Use useMemo to filter and sort products
  const filteredProducts = useMemo(() => {
    let filtered = products;

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

        // Handle numeric values
        if (sortConfig.key === 'EAN_code' || sortConfig.key === 'qty' || sortConfig.key === 'qty_sold' || sortConfig.key === 'price') {
          aValue = parseFloat(aValue || 0);
          bValue = parseFloat(bValue || 0);
      } else {
          // Handle string values
          aValue = String(aValue || '').toLowerCase();
          bValue = String(bValue || '').toLowerCase();
        }

        if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
        if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }
    
    return filtered;
  }, [products, selectedSupplier, debouncedSearchTerm, sortConfig]);
  
  // Reset to page 1 when supplier filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [selectedSupplier]);

  // Calculate pagination
  const totalPages = Math.ceil(filteredProducts.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedProducts = useMemo(() => {
    return filteredProducts.slice(startIndex, endIndex);
  }, [filteredProducts, startIndex, endIndex]);

  // Generate page numbers for pagination
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

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setSelectedFile(file);
      // Create preview
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const uploadImage = async (file) => {
    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch('/api/upload', {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Upload failed');
    }

    const data = await response.json();
    return data.filename;
  };

  const handleEdit = async (productId) => {
    try {
      const response = await fetch(`/api/products/${productId}`);
      const data = await response.json();
      
      if (response.ok && data.product) {
        const product = data.product;
        setEditingProductId(productId);
        setFormData({
          EAN_code: product.EAN_code || '',
          product_name: product.product_name || '',
          images: product.images || '',
          unit: product.unit || 'kg',
          supplier: product.supplier || '',
          qty: product.qty || '',
          qty_sold: product.qty_sold || '0',
          expiry_date: product.expiry_date || '',
          date_arrival: product.date_arrival || '',
          price: product.price || '',
          category: product.category || 'general',
          shopId: product.shopId || ''
        });
        
        // Set image preview if image exists
        if (product.images) {
          setImagePreview(`/assets/category_images/${product.images}`);
        }
        
        setShowModal(true);
      } else {
        toast.error('Failed to load product data');
      }
    } catch (error) {
      console.error('Error loading product:', error);
      toast.error('Failed to load product data');
    }
  };

  const resetForm = () => {
    setFormData({ 
      EAN_code: '', 
      product_name: '', 
      images: '', 
      unit: 'kg', 
      supplier: '', 
      qty: '', 
      qty_sold: '0', 
      expiry_date: '', 
      date_arrival: '', 
      price: '', 
      category: 'general',
      shopId: ''
    });
    setSelectedFile(null);
    setImagePreview(null);
    setEditingProductId(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setUploading(true);
    
    try {
      let imageFilename = formData.images;

      // Upload file if selected
      if (selectedFile) {
        try {
          imageFilename = await uploadImage(selectedFile);
        } catch (error) {
          toast.error(error.message || 'Failed to upload image');
          setUploading(false);
          return;
        }
      }

      const productData = {
        ...formData,
        images: imageFilename,
        EAN_code: parseInt(formData.EAN_code),
        qty: parseInt(formData.qty || 0),
        qty_sold: parseInt(formData.qty_sold || 0),
        price: parseFloat(formData.price || 0)
      };

      // Optimistic update for edit
      if (editingProductId) {
        const originalProducts = [...products];
        setProducts(prev => prev.map(p => {
          if ((p._id || p.id) === editingProductId) {
            return { ...p, ...productData };
          }
          return p;
        }));

        try {
          const response = await fetch(`/api/products/${editingProductId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(productData),
          });

          if (response.ok) {
            toast.success('Product updated successfully!');
            setShowModal(false);
            resetForm();
            await fetchProducts(); // Refresh to get server data
          } else {
            // Revert on error
            setProducts(originalProducts);
            const data = await response.json();
            toast.error(data.error || 'Failed to update product');
          }
        } catch (error) {
          // Revert on error
          setProducts(originalProducts);
          console.error('Error updating product:', error);
          toast.error('Failed to update product');
        }
      } else {
        // Create new product
        const response = await fetch('/api/products', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(productData),
        });

        if (response.ok) {
          const data = await response.json();
          // Optimistically add new product
          if (data.product) {
            setProducts(prev => [data.product, ...prev]);
          }
          toast.success('Product created successfully!');
          setShowModal(false);
          resetForm();
        } else {
          const data = await response.json();
          toast.error(data.error || 'Failed to create product');
        }
      }
    } catch (error) {
      console.error('Error saving product:', error);
      toast.error(editingProductId ? 'Failed to update product' : 'Failed to create product');
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = useCallback(async (id) => {
    if (!confirm('Are you sure you want to delete this product?')) return;

    // Optimistic update - remove from UI immediately
    const productToDelete = products.find(p => (p._id || p.id) === id);
    setProducts(prev => prev.filter(p => (p._id || p.id) !== id));

    try {
      const response = await fetch(`/api/products/${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        // Revert on error
        if (productToDelete) {
          setProducts(prev => [...prev, productToDelete]);
        }
        toast.error('Failed to delete product');
      } else {
        toast.success('Product deleted successfully!');
      }
    } catch (error) {
      console.error('Error deleting product:', error);
      // Revert on error
      if (productToDelete) {
        setProducts(prev => [...prev, productToDelete]);
      }
      toast.error('Failed to delete product');
    }
  }, [products]);

  return (
    <Layout userRole="superadmin">
      <div className="px-4 py-6 sm:px-0">
        <div className="flex flex-col gap-4 mb-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <h1 className="text-3xl font-bold text-gray-900">Inventory</h1>
            <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
              {/* Supplier Filter Dropdown */}
              <select
                value={selectedSupplier}
                onChange={(e) => {
                  setSelectedSupplier(e.target.value);
                  setCurrentPage(1);
                }}
                className="px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none text-sm sm:text-base bg-white text-gray-800"
              >
                <option value="All" className="text-gray-800">All Suppliers</option>
                {suppliers.map((supplier) => (
                  <option key={supplier} value={supplier} className="text-gray-800">
                    {supplier}
                    </option>
                ))}
              </select>
              <button
                onClick={() => {
                  resetForm();
                  setShowModal(true);
                }}
                className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 active:bg-indigo-800 transition-colors whitespace-nowrap font-medium"
              >
                Add Product
              </button>
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
              className="w-full px-4 py-2 pl-10 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none text-sm sm:text-base bg-white text-gray-800 placeholder:text-gray-500"
            />
            <svg
              className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            {searchTerm && (
                    <button
                onClick={() => setSearchTerm('')}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
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
              className="px-3 py-1.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none text-sm bg-white"
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
          <div className="bg-white shadow overflow-hidden sm:rounded-md">
            <table className="min-w-full divide-y divide-gray-800">
              <thead className="bg-white">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-800 uppercase tracking-wider">EAN Code</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-800 uppercase tracking-wider">Product Name</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-800 uppercase tracking-wider">Unit</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-800 uppercase tracking-wider">Price</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-800 uppercase tracking-wider">Available Qty</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-800 uppercase tracking-wider">Total Qty</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-800 uppercase tracking-wider">Qty Sold</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-800 uppercase tracking-wider">Supplier</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-800 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-800">
                {[...Array(10)].map((_, index) => (
                  <tr key={index} className="animate-pulse">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="h-4 bg-white rounded w-20"></div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="h-4 bg-white rounded w-32"></div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="h-4 bg-white rounded w-12"></div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="h-4 bg-white rounded w-16"></div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="h-4 bg-white rounded w-12"></div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="h-4 bg-white rounded w-12"></div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="h-4 bg-white rounded w-12"></div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="h-4 bg-white rounded w-24"></div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="h-4 bg-white rounded w-16"></div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
            <div className="bg-white shadow overflow-hidden sm:rounded-md">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                    <tr>
                      <th 
                      className="px-6 py-3 text-left text-xs font-medium text-gray-800 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none transition-colors"
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
                      className="px-6 py-3 text-left text-xs font-medium text-gray-800 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none transition-colors"
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
                      className="px-6 py-3 text-left text-xs font-medium text-gray-800 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none transition-colors"
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
                      className="px-6 py-3 text-left text-xs font-medium text-gray-800 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none transition-colors"
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
                      className="px-6 py-3 text-left text-xs font-medium text-gray-800 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none transition-colors"
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
                      className="px-6 py-3 text-left text-xs font-medium text-gray-800 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none transition-colors"
                        onClick={() => handleSort('supplier')}
                      >
                        <div className="flex items-center gap-2">
                          Supplier
                          {sortConfig.key === 'supplier' && (
                            <span className="text-indigo-600">{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>
                  )}
                </div>
                      </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-800 uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {filteredProducts.length === 0 ? (
                      <tr>
                    <td colSpan="9" className="px-6 py-8 text-center text-sm text-gray-800">
                          {debouncedSearchTerm 
                            ? `No products found matching "${debouncedSearchTerm}"`
                        : selectedSupplier === 'All' 
                          ? 'No products found' 
                          : `No products found for supplier: ${selectedSupplier}`
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
                        className="hover:bg-gray-50 transition-colors cursor-pointer"
                        onClick={(e) => {
                          // Only open edit if clicking on row, not on buttons
                          if (e.target.tagName !== 'BUTTON' && e.target.tagName !== 'SPAN') {
                            handleEdit(productId);
                          }
                        }}
                          >
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-800 font-mono">{product.EAN_code}</td>
                        <td className="px-6 py-4 text-sm font-medium text-gray-900">
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
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900">₹{parseFloat(product.price || 0).toFixed(2)}</td>
                        <td className={`px-6 py-4 whitespace-nowrap text-sm font-medium ${isLowStock ? 'text-red-600' : 'text-gray-800'}`}>
                              {availableQty}
                              {isLowStock && <span className="ml-1 text-xs">⚠️</span>}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-800">{Math.round(product.qty || 0)}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-800">{Math.round(product.qty_sold || 0)}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-800">{product.supplier || '-'}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium" onClick={(e) => e.stopPropagation()}>
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleEdit(productId)}
                              className="text-indigo-600 hover:text-indigo-900 hover:underline transition-colors"
                              title="Edit product"
                            >
                              Edit
                            </button>
                            <span className="text-gray-300">|</span>
                            <button
                              onClick={() => handleDelete(productId)}
                              className="text-red-600 hover:text-red-900 hover:underline transition-colors"
                              title="Delete product"
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
                </div>
                </div>
        )}

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
                className="px-3 py-1.5 border border-gray-300 rounded-lg bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm font-medium"
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
                className="px-3 py-1.5 border border-gray-300 rounded-lg bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm font-medium"
                  >
                    Next
                  </button>
            </div>
          </div>
            )}

        {showModal && (
          <div 
            className="fixed inset-0 bg-black bg-opacity-50 overflow-y-auto h-full w-full z-50 flex items-center justify-center p-4"
            onClick={(e) => {
              if (e.target === e.currentTarget) {
                setShowModal(false);
                resetForm();
              }
            }}
          >
            <div className="relative mx-auto p-6 border w-full max-w-2xl shadow-xl rounded-lg bg-white max-h-[90vh] overflow-hidden flex flex-col">
              <div className="flex justify-between items-center mb-4 pb-4 border-b">
                <h3 className="text-xl font-bold text-gray-900">
                  {editingProductId ? 'Edit Product' : 'Add New Product'}
                </h3>
                <button
                  onClick={() => {
                    setShowModal(false);
                    resetForm();
                  }}
                  className="text-gray-500 hover:text-gray-700 text-2xl font-light transition-colors"
                  aria-label="Close modal"
                >
                  ×
                </button>
              </div>
              <form onSubmit={handleSubmit} className="space-y-4 overflow-y-auto flex-1 pr-2">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-800 mb-1.5">Article *</label>
                    <input
                      type="number"
                      value={formData.EAN_code}
                      onChange={(e) => setFormData({ ...formData, EAN_code: e.target.value })}
                      required
                      className="block w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-800 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-colors"
                      autoFocus
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-800 mb-1.5">Product Name *</label>
                    <input
                      type="text"
                      value={formData.product_name}
                      onChange={(e) => setFormData({ ...formData, product_name: e.target.value })}
                      required
                      className="block w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-800 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-colors"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-800 mb-1.5">Unit</label>
                    <select
                      value={formData.unit}
                      onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                      className="block w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-800 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-colors"
                    >
                      <option value="kg">kg</option>
                      <option value="packets">packets</option>
                      <option value="pieces">pieces</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-800 mb-1.5">Price (₹)</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={formData.price}
                      onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                      className="block w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-800 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-colors"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-800 mb-1.5">Quantity (Qty) *</label>
                    <input
                      type="number"
                      step="1"
                      min="0"
                      value={formData.qty}
                      onChange={(e) => setFormData({ ...formData, qty: e.target.value })}
                      required
                      className="block w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-800 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-colors"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-800 mb-1.5">Quantity Sold</label>
                    <input
                      type="number"
                      step="1"
                      min="0"
                      value={formData.qty_sold}
                      onChange={(e) => setFormData({ ...formData, qty_sold: e.target.value })}
                      className="block w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-800 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-colors"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-800 mb-1.5">Supplier</label>
                    <select
                      value={formData.supplier}
                      onChange={(e) => setFormData({ ...formData, supplier: e.target.value })}
                      className="block w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-800 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-colors"
                    >
                      <option value="" className="text-gray-800">Select Supplier</option>
                      {suppliers.map((supplier) => (
                        <option key={supplier} value={supplier} className="text-gray-800">
                          {supplier}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-800 mb-1.5">Assign to Shop (Optional)</label>
                    <select
                      value={formData.shopId}
                      onChange={(e) => setFormData({ ...formData, shopId: e.target.value })}
                      className="block w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-800 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-colors"
                    >
                      <option value="" className="text-gray-800">No Shop Assignment</option>
                      {shops.map((shop) => {
                        const shopObj = shop.toObject ? shop.toObject() : shop;
                        return (
                          <option key={shopObj._id || shopObj.id} value={shopObj.userId?._id || shopObj.userId || shopObj._id || shopObj.id} className="text-gray-800">
                            {shopObj.name}
                          </option>
                        );
                      })}
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-800 mb-1.5">Expiry Date</label>
                    <input
                      type="text"
                      value={formData.expiry_date}
                      onChange={(e) => setFormData({ ...formData, expiry_date: e.target.value })}
                      placeholder="MM/DD/YYYY"
                      className="block w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-800 placeholder:text-gray-500 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-colors"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-800 mb-1.5">Date Arrival</label>
                    <input
                      type="text"
                      value={formData.date_arrival}
                      onChange={(e) => setFormData({ ...formData, date_arrival: e.target.value })}
                      placeholder="MM/DD/YYYY"
                      className="block w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-800 placeholder:text-gray-500 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-colors"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-800 mb-1.5">Category</label>
                    <input
                      type="text"
                      value={formData.category}
                      onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                      className="block w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-800 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-colors"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-800 mb-1.5">Product Image</label>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleFileChange}
                      className="block w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-800 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-colors"
                    />
                    {imagePreview && (
                      <div className="mt-2 relative inline-block">
                        <img 
                          src={imagePreview} 
                          alt="Preview" 
                          className="object-cover rounded-lg border-2 border-gray-300 w-24 h-24"
                          loading="lazy"
                          decoding="async"
                        />
                        {selectedFile && (
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedFile(null);
                              if (formData.images) {
                                setImagePreview(`/assets/category_images/${formData.images}`);
                              } else {
                                setImagePreview(null);
                              }
                            }}
                            className="absolute -top-2 -right-2 bg-red-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs hover:bg-red-700 transition-colors"
                            aria-label="Remove image"
                          >
                            ×
                          </button>
                        )}
                      </div>
                    )}
                    {!selectedFile && (
                      <input
                        type="text"
                        value={formData.images}
                        onChange={(e) => setFormData({ ...formData, images: e.target.value })}
                        placeholder="Or enter image filename"
                        className="block w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mt-2 text-gray-800 placeholder:text-gray-500 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-colors"
                      />
                    )}
                  </div>
                </div>
                <div className="flex justify-end gap-3 pt-4 border-t mt-4">
                  <button
                    type="button"
                    onClick={() => {
                      setShowModal(false);
                      resetForm();
                    }}
                    className="px-4 py-2 bg-gray-100 text-gray-800 rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors"
                  >
                    Cancel
                  </button>
                  <LoadingButton
                    type="submit"
                    loading={uploading}
                    loadingText="Saving..."
                    className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors"
                  >
                    {editingProductId ? 'Update Product' : 'Create Product'}
                  </LoadingButton>
                </div>
              </form>
            </div>
          </div>
        )}


      </div>
    </Layout>
  );
}
