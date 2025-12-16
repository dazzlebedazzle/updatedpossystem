'use client';

import { useState, useEffect } from 'react';
import Layout from '@/components/Layout';
import { hasPermission, MODULES, OPERATIONS } from '@/lib/permissions';

export default function UserProducts() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [userPermissions, setUserPermissions] = useState([]);
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
    fetchUserPermissions();
    fetchProducts();
  }, []);

  const fetchUserPermissions = async () => {
    try {
      const response = await fetch('/api/auth/me');
      const data = await response.json();
      setUserPermissions(data.user?.permissions || []);
    } catch (error) {
      console.error('Error fetching user permissions:', error);
    }
  };

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
    if (!hasPermission(userPermissions, MODULES.PRODUCTS, OPERATIONS.CREATE)) {
      alert('You do not have permission to create products');
      return;
    }

    setUploading(true);
    
    try {
      let imageFilename = formData.images;

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
      } else {
        const errorData = await response.json();
        alert(errorData.error || 'Failed to create product');
      }
    } catch (error) {
      console.error('Error creating product:', error);
      alert('Failed to create product');
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!hasPermission(userPermissions, MODULES.PRODUCTS, OPERATIONS.DELETE)) {
      alert('You do not have permission to delete products');
      return;
    }

    if (!confirm('Are you sure you want to delete this product?')) return;

    try {
      const response = await fetch(`/api/products/${id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        fetchProducts();
      } else {
        const errorData = await response.json();
        alert(errorData.error || 'Failed to delete product');
      }
    } catch (error) {
      console.error('Error deleting product:', error);
      alert('Failed to delete product');
    }
  };

  const canCreate = hasPermission(userPermissions, MODULES.PRODUCTS, OPERATIONS.CREATE);
  const canDelete = hasPermission(userPermissions, MODULES.PRODUCTS, OPERATIONS.DELETE);
  const canRead = hasPermission(userPermissions, MODULES.PRODUCTS, OPERATIONS.READ);

  if (!canRead) {
    return (
      <Layout userRole="user">
        <div className="px-4 py-6 sm:px-0">
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-red-800">You do not have permission to view products.</p>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout userRole="user">
      <div className="px-4 py-6 sm:px-0">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold text-gray-900">Products</h1>
          {canCreate && (
            <button
              onClick={() => setShowModal(true)}
              className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700"
            >
              Add Product
            </button>
          )}
        </div>

        {loading ? (
          <div>Loading...</div>
        ) : (
          <div className="bg-white shadow overflow-hidden sm:rounded-md">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-800">
                <thead className="bg-white">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">EAN Code</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Product Name</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Unit</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Price</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Available Qty</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Total Qty</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Qty Sold</th>
                    {canDelete && (
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Actions</th>
                    )}
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-800">
                  {products.length === 0 ? (
                    <tr>
                      <td colSpan={canDelete ? 8 : 7} className="px-6 py-4 text-center text-sm text-gray-600">
                        No products found
                      </td>
                    </tr>
                  ) : (
                    products.map((product) => {
                      const productId = product._id || product.id;
                      return (
                        <tr key={productId}>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{product.EAN_code}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{product.product_name}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{product.unit}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">₹{parseFloat(product.price || 0).toFixed(2)}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{Math.round((product.qty || 0) - (product.qty_sold || 0))}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{Math.round(product.qty || 0)}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{Math.round(product.qty_sold || 0)}</td>
                          {canDelete && (
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                              <button
                                onClick={() => handleDelete(productId)}
                                className="text-red-600 hover:text-red-900"
                              >
                                Delete
                              </button>
                            </td>
                          )}
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {showModal && canCreate && (
          <div className="fixed inset-0 bg-white bg-opacity-50 overflow-y-auto h-full w-full z-50 flex items-center justify-center p-4">
            <div className="relative mx-auto p-5 border w-full max-w-md shadow-lg rounded-md bg-white max-h-[90vh] overflow-y-auto">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-bold text-gray-900">Add New Product</h3>
                <button
                  onClick={() => {
                    setShowModal(false);
                    setSelectedFile(null);
                    setImagePreview(null);
                  }}
                  className="text-gray-800 hover:text-gray-800 text-xl"
                >
                  ×
                </button>
              </div>
              <form onSubmit={handleCreateProduct} className="space-y-3">
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
                  <input
                    type="text"
                    value={formData.supplier}
                    onChange={(e) => setFormData({ ...formData, supplier: e.target.value })}
                    className="block w-full border border-gray-200 rounded-md px-2 py-1.5 text-sm"
                  />
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
                    <div className="mt-2">
                      <img 
                        src={imagePreview} 
                        alt="Preview" 
                        className="w-20 h-20 object-cover rounded border border-gray-200"
                      />
                    </div>
                  )}
                  {!selectedFile && (
                    <input
                      type="text"
                      value={formData.images}
                      onChange={(e) => setFormData({ ...formData, images: e.target.value })}
                      placeholder="Or enter image filename"
                      className="block w-full border border-gray-200 rounded-md px-2 py-1.5 text-sm mt-2"
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
                    className="block w-full border border-gray-200 rounded-md px-2 py-1.5 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-800 mb-1">Date Arrival</label>
                  <input
                    type="text"
                    value={formData.date_arrival}
                    onChange={(e) => setFormData({ ...formData, date_arrival: e.target.value })}
                    placeholder="MM/DD/YYYY"
                    className="block w-full border border-gray-200 rounded-md px-2 py-1.5 text-sm"
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
                <div className="flex justify-end space-x-3 pt-3">
                  <button
                    type="button"
                    onClick={() => {
                      setShowModal(false);
                      setSelectedFile(null);
                      setImagePreview(null);
                    }}
                    className="px-4 py-2 bg-white text-gray-800 rounded hover:bg-white"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={uploading}
                    className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {uploading ? 'Uploading...' : 'Create'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}

