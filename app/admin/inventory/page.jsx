'use client';

import { useState, useEffect } from 'react';
import Layout from '@/components/Layout';
import { PageLoader } from '@/components/Loader';

export default function AdminInventory() {
  const [inventory, setInventory] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({
    productId: '',
    quantity: '',
    type: 'add',
    notes: ''
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [inventoryRes, productsRes] = await Promise.all([
        fetch('/api/inventory'),
        fetch('/api/products')
      ]);
      const inventoryData = await inventoryRes.json();
      const productsData = await productsRes.json();
      setInventory(inventoryData.inventory || []);
      setProducts(productsData.products || []);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateInventory = async (e) => {
    e.preventDefault();
    try {
      const response = await fetch('/api/inventory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        setShowModal(false);
        setFormData({ productId: '', quantity: '', type: 'add', notes: '' });
        fetchData();
      }
    } catch (error) {
      console.error('Error updating inventory:', error);
    }
  };

  return (
    <Layout userRole="admin">
      <div className="px-2 py-4 sm:px-4 sm:py-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4 sm:mb-6">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Inventory Management</h1>
          <button
            onClick={() => setShowModal(true)}
            className="w-full sm:w-auto bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition text-sm sm:text-base"
          >
            Update Inventory
          </button>
        </div>

        {loading ? (
          <PageLoader message="Loading inventory..." />
        ) : (
          <>
            {/* Desktop Table View */}
            <div className="hidden md:block bg-white shadow overflow-hidden sm:rounded-md">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-800 uppercase tracking-wider">Product</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-800 uppercase tracking-wider">Type</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-800 uppercase tracking-wider">Quantity</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-800 uppercase tracking-wider">Date</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-800 uppercase tracking-wider">Notes</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {inventory.map((item) => (
                      <tr key={item.id} className="hover:bg-gray-50">
                        <td className="px-4 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {item.product?.name || 'N/A'}
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                          <span className={`px-2 py-1 rounded-full text-xs ${
                            item.type === 'add' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                          }`}>
                            {item.type}
                          </span>
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">{item.quantity}</td>
                        <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                          {new Date(item.createdAt).toLocaleDateString()}
                        </td>
                        <td className="px-4 py-4 text-sm text-gray-900">{item.notes}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Mobile Card View */}
            <div className="md:hidden space-y-4">
              {inventory.map((item) => (
                <div key={item.id} className="bg-white shadow rounded-lg p-4 border border-gray-200">
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex-1">
                      <h3 className="text-base font-semibold text-gray-900 mb-1">
                        {item.product?.name || 'N/A'}
                      </h3>
                      <span className={`inline-block px-2 py-1 rounded-full text-xs ${
                        item.type === 'add' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                      }`}>
                        {item.type}
                      </span>
                    </div>
                    <span className="text-lg font-bold text-gray-900">{item.quantity}</span>
                  </div>
                  <div className="space-y-2 text-sm">
                    <div>
                      <p className="text-gray-800">Date</p>
                      <p className="font-medium text-gray-900">
                        {new Date(item.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                    {item.notes && (
                      <div>
                        <p className="text-gray-800">Notes</p>
                        <p className="font-medium text-gray-900">{item.notes}</p>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {showModal && (
          <>
            <div 
              className="fixed inset-0 bg-black/50 z-50"
              onClick={() => setShowModal(false)}
            ></div>
            <div className="fixed inset-0 flex items-center justify-center z-50 p-4 overflow-y-auto">
              <div className="relative w-full max-w-md bg-white rounded-lg shadow-xl p-4 sm:p-6 max-h-[90vh] overflow-y-auto">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg sm:text-xl font-bold text-gray-900">Update Inventory</h3>
                  <button
                    onClick={() => setShowModal(false)}
                    className="text-gray-800 hover:text-gray-900 text-2xl leading-none"
                    aria-label="Close"
                  >
                    ×
                  </button>
                </div>
                <form onSubmit={handleUpdateInventory} className="space-y-4" onClick={(e) => e.stopPropagation()}>
                <div>
                  <label className="block text-sm font-medium text-gray-900">Product</label>
                  <select
                    value={formData.productId}
                    onChange={(e) => setFormData({ ...formData, productId: e.target.value })}
                    required
                    className="mt-1 block w-full border border-gray-200 rounded-md px-3 py-2"
                  >
                    <option value="">Select Product</option>
                    {products.map((product) => (
                      <option key={product._id || product.id} value={product._id || product.id}>
                        {product.product_name || product.name} (Stock: {(product.qty || 0) - (product.qty_sold || 0)})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-900">Type</label>
                  <select
                    value={formData.type}
                    onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                    className="mt-1 block w-full border border-gray-200 rounded-md px-3 py-2"
                  >
                    <option value="add">Add Stock</option>
                    <option value="remove">Remove Stock</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-900">Quantity</label>
                  <input
                    type="number"
                    value={formData.quantity}
                    onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                    required
                    className="mt-1 block w-full border border-gray-200 rounded-md px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-900">Notes</label>
                  <textarea
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    className="mt-1 block w-full border border-gray-200 rounded-md px-3 py-2"
                  />
                </div>
                  <div className="flex flex-col sm:flex-row justify-end gap-3 pt-4 border-t">
                    <button
                      type="button"
                      onClick={() => setShowModal(false)}
                      className="w-full sm:w-auto px-4 py-2 bg-gray-100 text-gray-900 rounded-lg hover:bg-gray-200 transition"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="w-full sm:w-auto px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition"
                    >
                      Update
                    </button>
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

