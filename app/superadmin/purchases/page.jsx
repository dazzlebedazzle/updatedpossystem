'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Layout from '@/components/Layout';
import { PageLoader } from '@/components/Loader';
import LoadingButton from '@/components/LoadingButton';
import { toast } from '@/lib/toast';
import { suppliers } from '@/lib/suppliers';

const initialFormData = {
  supplier: '',
  invoiceNumber: '',
  purchaseDate: '',
  destinationType: 'main',
  destinationId: '',
  productId: '',
  quantity: '',
  costPrice: '',
  sellingPrice: '',
  paymentMethod: 'cash',
  paymentStatus: 'paid',
  notes: ''
};

function getId(value) {
  if (!value) return '';
  if (typeof value === 'object') {
    return (value._id || value.id || '').toString();
  }
  return value.toString();
}

function formatDate(value) {
  if (!value) return '-';
  return new Date(value).toLocaleDateString();
}

export default function SuperAdminPurchases() {
  const [purchases, setPurchases] = useState([]);
  const [products, setProducts] = useState([]);
  const [subWarehouses, setSubWarehouses] = useState([]);
  const [shops, setShops] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [formData, setFormData] = useState(initialFormData);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [purchasesRes, productsRes, subWarehousesRes, shopsRes] = await Promise.all([
        fetch('/api/purchases', { cache: 'no-store' }),
        fetch('/api/products', { cache: 'default' }),
        fetch('/api/sub-warehouses', { cache: 'default' }),
        fetch('/api/shops', { cache: 'default' })
      ]);

      const [purchasesData, productsData, subWarehousesData, shopsData] = await Promise.all([
        purchasesRes.json(),
        productsRes.json(),
        subWarehousesRes.json(),
        shopsRes.json()
      ]);

      setPurchases(purchasesData.purchases || []);
      setProducts(productsData.products || []);
      setSubWarehouses(subWarehousesData.subWarehouses || []);
      setShops(shopsData.shops || []);
    } catch (error) {
      console.error('Error loading purchases:', error);
      toast.error('Failed to load purchases');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const filteredPurchases = useMemo(() => {
    const search = searchTerm.trim().toLowerCase();
    if (!search) return purchases;

    return purchases.filter((purchase) => {
      const itemNames = (purchase.items || []).map((item) => item.productName).join(' ');
      return (
        (purchase.supplier || '').toLowerCase().includes(search) ||
        (purchase.invoiceNumber || '').toLowerCase().includes(search) ||
        (purchase.destinationName || '').toLowerCase().includes(search) ||
        itemNames.toLowerCase().includes(search)
      );
    });
  }, [purchases, searchTerm]);

  const totals = useMemo(() => {
    return filteredPurchases.reduce(
      (sum, purchase) => ({
        count: sum.count + 1,
        totalCost: sum.totalCost + (Number(purchase.totalCost) || 0),
        totalQty: sum.totalQty + (purchase.items || []).reduce((itemSum, item) => itemSum + (Number(item.quantity) || 0), 0)
      }),
      { count: 0, totalCost: 0, totalQty: 0 }
    );
  }, [filteredPurchases]);

  const selectedProduct = useMemo(() => {
    return products.find((product) => getId(product._id || product.id) === formData.productId);
  }, [formData.productId, products]);

  const destinationOptions = useMemo(() => {
    if (formData.destinationType === 'sub') {
      return subWarehouses.map((warehouse) => ({
        id: getId(warehouse._id || warehouse.id),
        name: `${warehouse.name}${warehouse.location ? ` - ${warehouse.location}` : ''}`
      }));
    }

    if (formData.destinationType === 'shop') {
      return shops.map((shop) => ({
        id: getId(shop._id || shop.id),
        name: `${shop.name}${shop.location ? ` - ${shop.location}` : ''}`
      }));
    }

    return [];
  }, [formData.destinationType, shops, subWarehouses]);

  const resetForm = () => {
    setFormData(initialFormData);
  };

  const handleProductChange = (productId) => {
    const product = products.find((item) => getId(item._id || item.id) === productId);
    setFormData((current) => ({
      ...current,
      productId,
      supplier: product?.supplier || current.supplier,
      sellingPrice: product?.price || current.sellingPrice
    }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (formData.destinationType !== 'main' && !formData.destinationId) {
      toast.error('Please select a destination');
      return;
    }

    setSubmitting(true);

    try {
      const payload = {
        supplier: formData.supplier,
        invoiceNumber: formData.invoiceNumber,
        purchaseDate: formData.purchaseDate,
        destinationType: formData.destinationType,
        destinationId: formData.destinationType === 'main' ? undefined : formData.destinationId,
        paymentMethod: formData.paymentMethod,
        paymentStatus: formData.paymentStatus,
        notes: formData.notes,
        items: [
          {
            productId: formData.productId,
            quantity: Number(formData.quantity),
            unit: selectedProduct?.unit || 'kg',
            costPrice: Number(formData.costPrice),
            sellingPrice: Number(formData.sellingPrice || 0)
          }
        ]
      };

      const response = await fetch('/api/purchases', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await response.json();

      if (response.ok) {
        toast.success('Purchase added successfully');
        setShowModal(false);
        resetForm();
        await fetchData();
      } else {
        toast.error(data.error || 'Failed to add purchase');
      }
    } catch (error) {
      console.error('Error adding purchase:', error);
      toast.error('Failed to add purchase');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <Layout userRole="superadmin">
        <PageLoader message="Loading purchases..." />
      </Layout>
    );
  }

  return (
    <Layout userRole="superadmin">
      <div className="px-4 py-6 sm:px-0">
        <div className="flex flex-col gap-4 mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Purchases</h1>
              <p className="text-sm text-gray-700 mt-1">Record incoming stock and purchase cost for analysis.</p>
            </div>
            <button
              onClick={() => {
                resetForm();
                setShowModal(true);
              }}
              className="w-full sm:w-auto px-4 py-2 rounded-lg bg-indigo-600 text-white font-medium hover:bg-indigo-700 transition"
            >
              Add Purchase
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <SummaryCard label="Purchases" value={totals.count} />
            <SummaryCard label="Purchased Qty" value={totals.totalQty.toFixed(0)} />
            <SummaryCard label="Purchase Cost" value={`Rs ${totals.totalCost.toFixed(2)}`} />
          </div>

          <div className="relative w-full sm:w-96">
            <input
              type="text"
              placeholder="Search purchases..."
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none text-sm sm:text-base bg-white text-gray-800 placeholder:text-gray-500"
            />
          </div>
        </div>

        <div className="bg-white shadow overflow-hidden sm:rounded-md">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-800 uppercase tracking-wider">Date</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-800 uppercase tracking-wider">Invoice</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-800 uppercase tracking-wider">Supplier</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-800 uppercase tracking-wider">Destination</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-800 uppercase tracking-wider">Items</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-800 uppercase tracking-wider">Total Cost</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-800 uppercase tracking-wider">Payment</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredPurchases.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="px-6 py-8 text-center text-sm text-gray-700">
                      No purchases found
                    </td>
                  </tr>
                ) : (
                  filteredPurchases.map((purchase) => (
                    <tr key={purchase._id || purchase.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-800">{formatDate(purchase.purchaseDate)}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-800">{purchase.invoiceNumber || '-'}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-800">{purchase.supplier}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-800">{purchase.destinationName || purchase.destinationType}</td>
                      <td className="px-6 py-4 text-sm text-gray-800">
                        {(purchase.items || []).map((item) => (
                          <div key={getId(item.productId) || item.productName}>
                            <span className="font-medium text-gray-900">{item.productName}</span>
                            <span className="text-gray-700"> - {item.quantity} {item.unit}</span>
                          </div>
                        ))}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900">Rs {Number(purchase.totalCost || 0).toFixed(2)}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-800 capitalize">
                        {purchase.paymentStatus} / {purchase.paymentMethod?.replace('_', ' ')}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {showModal && (
          <div
            className="fixed inset-0 bg-black bg-opacity-50 overflow-y-auto h-full w-full z-50 flex items-center justify-center p-4"
            onClick={(event) => {
              if (event.target === event.currentTarget) {
                setShowModal(false);
              }
            }}
          >
            <div className="relative mx-auto p-6 border w-full max-w-2xl shadow-xl rounded-lg bg-white max-h-[90vh] overflow-y-auto">
              <div className="flex justify-between items-center mb-4 pb-4 border-b">
                <h3 className="text-xl font-bold text-gray-900">Add Purchase</h3>
                <button
                  onClick={() => setShowModal(false)}
                  className="text-gray-500 hover:text-gray-700 text-2xl font-light transition-colors"
                  aria-label="Close modal"
                >
                  x
                </button>
              </div>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-800 mb-1.5">Supplier *</label>
                    <select
                      value={formData.supplier}
                      onChange={(event) => setFormData({ ...formData, supplier: event.target.value })}
                      required
                      className="block w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-800 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
                    >
                      <option value="">Select Supplier</option>
                      {suppliers.map((supplier) => (
                        <option key={supplier} value={supplier}>{supplier}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-800 mb-1.5">Invoice Number</label>
                    <input
                      type="text"
                      value={formData.invoiceNumber}
                      onChange={(event) => setFormData({ ...formData, invoiceNumber: event.target.value })}
                      className="block w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-800 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-800 mb-1.5">Purchase Date</label>
                    <input
                      type="date"
                      value={formData.purchaseDate}
                      onChange={(event) => setFormData({ ...formData, purchaseDate: event.target.value })}
                      className="block w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-800 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-800 mb-1.5">Destination *</label>
                    <select
                      value={formData.destinationType}
                      onChange={(event) => setFormData({ ...formData, destinationType: event.target.value, destinationId: '' })}
                      className="block w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-800 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
                    >
                      <option value="main">Main Warehouse</option>
                      <option value="sub">Sub-Warehouse</option>
                      <option value="shop">Store</option>
                    </select>
                  </div>
                  {formData.destinationType !== 'main' && (
                    <div className="sm:col-span-2">
                      <label className="block text-sm font-medium text-gray-800 mb-1.5">Select Destination *</label>
                      <select
                        value={formData.destinationId}
                        onChange={(event) => setFormData({ ...formData, destinationId: event.target.value })}
                        required
                        className="block w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-800 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
                      >
                        <option value="">Select destination</option>
                        {destinationOptions.map((destination) => (
                          <option key={destination.id} value={destination.id}>{destination.name}</option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>

                <div className="border-t pt-4">
                  <h4 className="text-sm font-semibold text-gray-900 mb-3">Purchase Item</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="sm:col-span-2">
                      <label className="block text-sm font-medium text-gray-800 mb-1.5">Product *</label>
                      <select
                        value={formData.productId}
                        onChange={(event) => handleProductChange(event.target.value)}
                        required
                        className="block w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-800 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
                      >
                        <option value="">Select Product</option>
                        {products.map((product) => (
                          <option key={product._id || product.id} value={product._id || product.id}>
                            {product.product_name} - {product.EAN_code}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-800 mb-1.5">Quantity *</label>
                      <input
                        type="number"
                        step="1"
                        min="1"
                        value={formData.quantity}
                        onChange={(event) => setFormData({ ...formData, quantity: event.target.value })}
                        required
                        className="block w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-800 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-800 mb-1.5">Cost Price *</label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={formData.costPrice}
                        onChange={(event) => setFormData({ ...formData, costPrice: event.target.value })}
                        required
                        className="block w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-800 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-800 mb-1.5">Selling Price</label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={formData.sellingPrice}
                        onChange={(event) => setFormData({ ...formData, sellingPrice: event.target.value })}
                        className="block w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-800 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-800 mb-1.5">Line Total</label>
                      <input
                        type="text"
                        value={`Rs ${(Number(formData.quantity || 0) * Number(formData.costPrice || 0)).toFixed(2)}`}
                        disabled
                        className="block w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-600 bg-gray-50"
                      />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 border-t pt-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-800 mb-1.5">Payment Method</label>
                    <select
                      value={formData.paymentMethod}
                      onChange={(event) => setFormData({ ...formData, paymentMethod: event.target.value })}
                      className="block w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-800 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
                    >
                      <option value="cash">Cash</option>
                      <option value="card">Card</option>
                      <option value="upi">UPI</option>
                      <option value="bank_transfer">Bank Transfer</option>
                      <option value="credit">Credit</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-800 mb-1.5">Payment Status</label>
                    <select
                      value={formData.paymentStatus}
                      onChange={(event) => setFormData({ ...formData, paymentStatus: event.target.value })}
                      className="block w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-800 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
                    >
                      <option value="paid">Paid</option>
                      <option value="partial">Partial</option>
                      <option value="unpaid">Unpaid</option>
                    </select>
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-sm font-medium text-gray-800 mb-1.5">Notes</label>
                    <textarea
                      rows={3}
                      value={formData.notes}
                      onChange={(event) => setFormData({ ...formData, notes: event.target.value })}
                      className="block w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-800 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t">
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="px-4 py-2 bg-gray-100 text-gray-800 rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors"
                  >
                    Cancel
                  </button>
                  <LoadingButton
                    type="submit"
                    loading={submitting}
                    loadingText="Saving..."
                    className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors"
                  >
                    Save Purchase
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

function SummaryCard({ label, value }) {
  return (
    <div className="bg-white shadow rounded-lg p-4 border border-gray-100">
      <p className="text-sm font-medium text-gray-700">{label}</p>
      <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
    </div>
  );
}
