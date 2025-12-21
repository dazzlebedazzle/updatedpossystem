'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import Layout from '@/components/Layout';
import { PageLoader } from '@/components/Loader';
import LoadingButton from '@/components/LoadingButton';

export default function AdminProducts() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [uploading, setUploading] = useState(false);
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
      setProducts(data.products || []);
    } catch (error) {
      console.error('Error fetching products:', error);
    } finally {
      setLoading(false);
    }
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

  const handleCreateProduct = async (e) => {
    e.preventDefault();
    setUploading(true);
    
    try {
      let imageFilename = formData.images;

      // Upload file if selected
      if (selectedFile) {
        try {
          imageFilename = await uploadImage(selectedFile);
        } catch (error) {
          alert(error.message || 'Failed to upload image');
          setUploading(false);
          return;
        }
      }

      const response = await fetch('/api/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          images: imageFilename
        }),
      });

      if (response.ok) {
        setShowModal(false);
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
        fetchProducts();
      }
    } catch (error) {
      console.error('Error creating product:', error);
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
        fetchProducts();
      }
    } catch (error) {
      console.error('Error deleting product:', error);
    }
  };

  return (
    <Layout userRole="admin">
      <div className="px-2 py-4 sm:px-4 sm:py-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4 sm:mb-6">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Products</h1>
          <button
            onClick={() => setShowModal(true)}
            className="w-full sm:w-auto bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition text-sm sm:text-base"
          >
            Add Product
          </button>
        </div>

        {loading ? (
          <PageLoader message="Loading products..." />
        ) : (
          <>
            {/* Desktop Table View */}
            <div className="hidden md:block bg-white shadow overflow-hidden sm:rounded-md">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-800 uppercase tracking-wider">EAN Code</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-800 uppercase tracking-wider">Product Name</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-800 uppercase tracking-wider">Unit</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-800 uppercase tracking-wider">Price</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-800 uppercase tracking-wider">Available Qty</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-800 uppercase tracking-wider">Total Qty</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-800 uppercase tracking-wider">Qty Sold</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-800 uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {products.map((product) => {
                      const productId = product._id || product.id;
                      return (
                        <tr key={productId} className="hover:bg-gray-50">
                          <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">{product.EAN_code}</td>
                          <td className="px-4 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{product.product_name}</td>
                          <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">{product.unit}</td>
                          <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">₹{parseFloat(product.price || 0).toFixed(2)}</td>
                          <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">{Math.round((product.qty || 0) - (product.qty_sold || 0))}</td>
                          <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">{Math.round(product.qty || 0)}</td>
                          <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">{Math.round(product.qty_sold || 0)}</td>
                          <td className="px-4 py-4 whitespace-nowrap text-sm font-medium">
                            <button
                              onClick={() => handleDelete(productId)}
                              className="text-red-600 hover:text-red-900 transition"
                            >
                              Delete
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Mobile Card View */}
            <div className="md:hidden space-y-4">
              {products.map((product) => {
                const productId = product._id || product.id;
                return (
                  <div key={productId} className="bg-white shadow rounded-lg p-4 border border-gray-200">
                    <div className="flex justify-between items-start mb-3">
                      <div className="flex-1">
                        <h3 className="text-base font-semibold text-gray-900 mb-1">{product.product_name}</h3>
                        <p className="text-sm text-gray-800">EAN: {product.EAN_code}</p>
                      </div>
                      <button
                        onClick={() => handleDelete(productId)}
                        className="text-red-600 hover:text-red-900 text-sm font-medium ml-2"
                      >
                        Delete
                      </button>
                    </div>
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <p className="text-gray-800">Unit</p>
                        <p className="font-medium text-gray-900">{product.unit}</p>
                      </div>
                      <div>
                        <p className="text-gray-800">Price</p>
                        <p className="font-medium text-gray-900">₹{parseFloat(product.price || 0).toFixed(2)}</p>
                      </div>
                      <div>
                        <p className="text-gray-800">Available</p>
                        <p className="font-medium text-gray-900">{Math.round((product.qty || 0) - (product.qty_sold || 0))}</p>
                      </div>
                      <div>
                        <p className="text-gray-800">Total Qty</p>
                        <p className="font-medium text-gray-900">{Math.round(product.qty || 0)}</p>
                      </div>
                      <div>
                        <p className="text-gray-800">Qty Sold</p>
                        <p className="font-medium text-gray-900">{Math.round(product.qty_sold || 0)}</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {showModal && (
          <>
            <div 
              className="fixed inset-0 bg-black/50 z-50"
              onClick={() => {
                setShowModal(false);
                setSelectedFile(null);
                setImagePreview(null);
              }}
            ></div>
            <div className="fixed inset-0 flex items-center justify-center z-50 p-4 overflow-y-auto">
              <div className="relative w-full max-w-md bg-white rounded-lg shadow-xl p-4 sm:p-6 max-h-[90vh] overflow-y-auto">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg sm:text-xl font-bold text-gray-900">Add New Product</h3>
                  <button
                    onClick={() => {
                      setShowModal(false);
                      setSelectedFile(null);
                      setImagePreview(null);
                    }}
                    className="text-gray-800 hover:text-gray-900 text-2xl leading-none"
                    aria-label="Close"
                  >
                    ×
                  </button>
                </div>
                <form onSubmit={handleCreateProduct} className="space-y-4" onClick={(e) => e.stopPropagation()}>
                <div>
                  <label className="block text-xs font-medium text-gray-900 mb-1">EAN Code *</label>
                  <input
                    type="number"
                    value={formData.EAN_code}
                    onChange={(e) => setFormData({ ...formData, EAN_code: e.target.value })}
                    required
                    className="block w-full border border-gray-200 rounded-md px-2 py-1.5 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-900 mb-1">Product Name *</label>
                  <input
                    type="text"
                    value={formData.product_name}
                    onChange={(e) => setFormData({ ...formData, product_name: e.target.value })}
                    required
                    className="block w-full border border-gray-200 rounded-md px-2 py-1.5 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-900 mb-1">Unit</label>
                  <input
                    type="text"
                    value={formData.unit}
                    onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                    className="block w-full border border-gray-200 rounded-md px-2 py-1.5 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-900 mb-1">Price</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.price}
                    onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                    className="block w-full border border-gray-200 rounded-md px-2 py-1.5 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-900 mb-1">Quantity (Qty) *</label>
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
                  <label className="block text-xs font-medium text-gray-900 mb-1">Quantity Sold</label>
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
                  <label className="block text-xs font-medium text-gray-900 mb-1">Supplier</label>
                  <input
                    type="text"
                    value={formData.supplier}
                    onChange={(e) => setFormData({ ...formData, supplier: e.target.value })}
                    className="block w-full border border-gray-200 rounded-md px-2 py-1.5 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-900 mb-1">Images</label>
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
                  <label className="block text-xs font-medium text-gray-900 mb-1">Expiry Date</label>
                  <input
                    type="text"
                    value={formData.expiry_date}
                    onChange={(e) => setFormData({ ...formData, expiry_date: e.target.value })}
                    placeholder="MM/DD/YYYY"
                    className="block w-full border border-gray-200 rounded-md px-2 py-1.5 text-sm placeholder:text-gray-800"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-900 mb-1">Date Arrival</label>
                  <input
                    type="text"
                    value={formData.date_arrival}
                    onChange={(e) => setFormData({ ...formData, date_arrival: e.target.value })}
                    placeholder="MM/DD/YYYY"
                    className="block w-full border border-gray-200 rounded-md px-2 py-1.5 text-sm placeholder:text-gray-800"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-900 mb-1">Category</label>
                  <input
                    type="text"
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="block w-full border border-gray-200 rounded-md px-2 py-1.5 text-sm"
                  />
                </div>
                  <div className="flex flex-col sm:flex-row justify-end gap-3 pt-4 border-t">
                    <button
                      type="button"
                      onClick={() => {
                        setShowModal(false);
                        setSelectedFile(null);
                        setImagePreview(null);
                      }}
                      className="w-full sm:w-auto px-4 py-2 bg-gray-100 text-gray-900 rounded-lg hover:bg-gray-200 transition"
                    >
                      Cancel
                    </button>
                    <LoadingButton
                      type="submit"
                      loading={uploading}
                      loadingText="Uploading..."
                      className="w-full sm:w-auto"
                    >
                      Create
                    </LoadingButton>
                  </div>
                </form>
              </div>
            </div>
          </>
        )}
      </div>
    </Layout>
  );
}

