'use client';

import { useState, useEffect, useMemo } from 'react';
import Image from 'next/image';
import Layout from '@/components/Layout';
import { toast } from '@/lib/toast';
import { suppliers } from '@/lib/suppliers';
import LoadingButton from '@/components/LoadingButton';

export default function SuperAdminProducts() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingProductId, setEditingProductId] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [selectedSupplier, setSelectedSupplier] = useState('All');
  const [itemsPerPage, setItemsPerPage] = useState(25);
  const [currentPage, setCurrentPage] = useState(1);
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
    category: 'general'
  });

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    try {
      const response = await fetch('/api/products');
      const data = await response.json();
      const allProducts = data.products || [];
      setProducts(allProducts);
    } catch (error) {
      console.error('Error fetching products:', error);
    } finally {
      setLoading(false);
    }
  };

  // Use useMemo to filter products based on selected supplier
  const filteredProducts = useMemo(() => {
    if (selectedSupplier === 'All') {
      return products;
    }
    return products.filter(product => 
      (product.supplier || '').toLowerCase() === selectedSupplier.toLowerCase()
    );
  }, [products, selectedSupplier]);

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
          category: product.category || 'general'
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
      category: 'general' 
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

      let response;
      if (editingProductId) {
        // Update existing product
        response = await fetch(`/api/products/${editingProductId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(productData),
        });
      } else {
        // Create new product
        response = await fetch('/api/products', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(productData),
        });
      }

      if (response.ok) {
        toast.success(editingProductId ? 'Product updated successfully!' : 'Product created successfully!');
        setShowModal(false);
        resetForm();
        await fetchProducts();
      } else {
        const data = await response.json();
        toast.error(data.error || (editingProductId ? 'Failed to update product' : 'Failed to create product'));
      }
    } catch (error) {
      console.error('Error saving product:', error);
      toast.error(editingProductId ? 'Failed to update product' : 'Failed to create product');
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Are you sure you want to delete this product?')) return;

    try {
      const response = await fetch(`/api/products/${id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        toast.success('Product deleted successfully!');
        fetchProducts();
      } else {
        toast.error('Failed to delete product');
      }
    } catch (error) {
      console.error('Error deleting product:', error);
    }
  };

  return (
    <Layout userRole="superadmin">
      <div className="px-4 py-6 sm:px-0">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
          <h1 className="text-3xl font-bold text-gray-900">Products</h1>
          <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
            {/* Supplier Filter Dropdown */}
            <select
              value={selectedSupplier}
              onChange={(e) => setSelectedSupplier(e.target.value)}
              className="px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none text-sm sm:text-base bg-white"
            >
              <option value="All">All Suppliers</option>
              {suppliers.map((supplier) => (
                <option key={supplier} value={supplier}>
                  {supplier}
                </option>
              ))}
            </select>
            <button
              onClick={() => {
                resetForm();
                setShowModal(true);
              }}
              className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 whitespace-nowrap"
            >
              Add Product
            </button>
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
                {filteredProducts.length === 0 ? (
                  <tr>
                    <td colSpan="9" className="px-6 py-8 text-center text-sm text-gray-800">
                      {selectedSupplier === 'All' ? 'No products found' : `No products found for supplier: ${selectedSupplier}`}
                    </td>
                  </tr>
                ) : (
                  paginatedProducts.map((product) => {
                    const productId = product._id || product.id;
                    return (
                      <tr key={productId}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-800">{product.EAN_code}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{product.product_name}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-800">{product.unit}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-800">₹{parseFloat(product.price || 0).toFixed(2)}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-800">{Math.round((product.qty || 0) - (product.qty_sold || 0))}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-800">{Math.round(product.qty || 0)}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-800">{Math.round(product.qty_sold || 0)}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-800">{product.supplier}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleEdit(productId)}
                              className="text-indigo-600 hover:text-indigo-900"
                            >
                              Edit
                            </button>
                            <span className="text-gray-800">|</span>
                            <button
                              onClick={() => handleDelete(productId)}
                              className="text-red-600 hover:text-red-900"
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
                className="px-3 py-1.5 border border-gray-200 rounded bg-gray-200 hover:bg-gray-300"
              >
                Previous
              </button>
              
              <div className="flex items-center gap-1">
                {getPageNumbers().map((pageNum) => (
                  <button
                    key={pageNum}
                    onClick={() => setCurrentPage(pageNum)}
                    className={`px-3 py-1.5 border rounded-lg text-sm font-medium ${
                      currentPage === pageNum
                        ? 'bg-indigo-600 text-white border-indigo-600'
                        : 'border-gray-200 text-gray-800 bg-white hover:bg-white'
                    }`}
                  >
                    {pageNum}
                  </button>
                ))}
              </div>
              
              <button
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                disabled={currentPage === totalPages}
                className="px-3 py-1.5 border border-gray-200 rounded bg-gray-200 hover:bg-gray-300"
              >
                Next
              </button>
            </div>
          </div>
        )}

        {showModal && (
          <div className="fixed inset-0 bg-white bg-opacity-50 overflow-y-auto h-full w-full z-50 flex items-center justify-center p-4">
            <div className="relative mx-auto p-4 border w-80 shadow-lg rounded-lg bg-white">
              <div className="flex justify-between items-center mb-3">
                <h3 className="text-lg font-bold text-gray-900">
                  {editingProductId ? 'Edit Product' : 'Add New Product'}
                </h3>
                <button
                  onClick={() => {
                    setShowModal(false);
                    resetForm();
                  }}
                  className="text-gray-800 hover:text-gray-800 text-xl"
                >
                  ×
                </button>
              </div>
              <form onSubmit={handleSubmit} className="space-y-3 max-h-[70vh] overflow-y-auto">
                <div>
                  <label className="block text-xs font-medium text-gray-800 mb-1">EAN Code *</label>
                  <input
                    type="number"
                    value={formData.EAN_code}
                    onChange={(e) => setFormData({ ...formData, EAN_code: e.target.value })}
                    required
                    className="block w-full border border-gray-200 rounded-md px-2 py-1.5 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-800 mb-1">Product Name *</label>
                  <input
                    type="text"
                    value={formData.product_name}
                    onChange={(e) => setFormData({ ...formData, product_name: e.target.value })}
                    required
                    className="block w-full border border-gray-200 rounded-md px-2 py-1.5 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-800 mb-1">Unit</label>
                  <input
                    type="text"
                    value={formData.unit}
                    onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                    className="block w-full border border-gray-200 rounded-md px-2 py-1.5 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-800 mb-1">Price</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.price}
                    onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                    className="block w-full border border-gray-200 rounded-md px-2 py-1.5 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-800 mb-1">Quantity (Qty) *</label>
                  <input
                    type="number"
                    step="1"
                    min="0"
                    value={formData.qty}
                    onChange={(e) => setFormData({ ...formData, qty: e.target.value })}
                    required
                    className="block w-full border border-gray-200 rounded-md px-2 py-1.5 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-800 mb-1">Quantity Sold</label>
                  <input
                    type="number"
                    step="1"
                    min="0"
                    value={formData.qty_sold}
                    onChange={(e) => setFormData({ ...formData, qty_sold: e.target.value })}
                    className="block w-full border border-gray-200 rounded-md px-2 py-1.5 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-800 mb-1">Supplier</label>
                  <select
                    value={formData.supplier}
                    onChange={(e) => setFormData({ ...formData, supplier: e.target.value })}
                    className="block w-full border border-gray-200 rounded-md px-2 py-1.5 text-sm"
                  >
                    <option value="">Select Supplier</option>
                    {suppliers.map((supplier) => (
                      <option key={supplier} value={supplier}>
                        {supplier}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-800 mb-1">Images</label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleFileChange}
                    className="block w-full border border-gray-200 rounded-md px-2 py-1.5 text-sm"
                  />
                  {imagePreview && (
                    <div className="mt-2 relative w-20 h-20">
                      <Image 
                        src={imagePreview} 
                        alt="Preview" 
                        fill
                        className="object-cover rounded border border-gray-200"
                        unoptimized
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
                          className="mt-1 text-xs text-red-600 hover:text-red-800"
                        >
                          Remove new image
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
                      className="block w-full border border-gray-200 rounded-md px-2 py-1.5 text-sm mt-2 placeholder:text-gray-800"
                    />
                  )}
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-800 mb-1">Expiry Date</label>
                  <input
                    type="text"
                    value={formData.expiry_date}
                    onChange={(e) => setFormData({ ...formData, expiry_date: e.target.value })}
                    placeholder="MM/DD/YYYY"
                    className="block w-full border border-gray-200 rounded-md px-2 py-1.5 text-sm placeholder:text-gray-800"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-800 mb-1">Date Arrival</label>
                  <input
                    type="text"
                    value={formData.date_arrival}
                    onChange={(e) => setFormData({ ...formData, date_arrival: e.target.value })}
                    placeholder="MM/DD/YYYY"
                    className="block w-full border border-gray-200 rounded-md px-2 py-1.5 text-sm placeholder:text-gray-800"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-800 mb-1">Category</label>
                  <input
                    type="text"
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="block w-full border border-gray-200 rounded-md px-2 py-1.5 text-sm"
                  />
                </div>
                <div className="flex justify-end space-x-2 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setShowModal(false);
                      resetForm();
                    }}
                    className="px-3 py-1.5 bg-white text-gray-800 rounded text-sm hover:bg-white"
                  >
                    Cancel
                  </button>
                  <LoadingButton
                    type="submit"
                    loading={uploading}
                    loadingText="Saving..."
                    className="px-3 py-1.5 text-sm"
                  >
                    {editingProductId ? 'Update' : 'Create'}
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

