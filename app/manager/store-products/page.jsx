'use client';

import { useEffect, useMemo, useState } from 'react';
import Layout from '@/components/Layout';
import { PageLoader } from '@/components/Loader';
import { toast } from '@/lib/toast';

const emptyDraft = {
  product_name: '',
  price: '',
  qty: ''
};

export default function ManagerStoreProducts() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState('');
  const [search, setSearch] = useState('');
  const [drafts, setDrafts] = useState({});

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    try {
      const response = await fetch('/api/manager/store-products', { cache: 'no-store' });
      const data = await response.json();

      if (!response.ok) {
        toast.error(data.error || 'Failed to load store products');
        return;
      }

      setProducts(data.products || []);
      setDrafts(
        (data.products || []).reduce((acc, product) => {
          const productId = product._id || product.id;
          acc[productId] = {
            product_name: product.product_name || '',
            price: product.price ?? 0,
            qty: product.qty ?? 0
          };
          return acc;
        }, {})
      );
    } catch (error) {
      console.error('Error fetching manager store products:', error);
      toast.error('Failed to load store products');
    } finally {
      setLoading(false);
    }
  };

  const filteredProducts = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return products;

    return products.filter((product) => (
      (product.product_name || '').toLowerCase().includes(term) ||
      (product.EAN_code || '').toString().includes(term) ||
      (product.managedShop?.name || '').toLowerCase().includes(term)
    ));
  }, [products, search]);

  const totals = useMemo(() => (
    products.reduce(
      (sum, product) => ({
        products: sum.products + 1,
        qty: sum.qty + Number(product.qty || 0),
        value: sum.value + (Number(product.qty || 0) * Number(product.price || 0))
      }),
      { products: 0, qty: 0, value: 0 }
    )
  ), [products]);

  const updateDraft = (productId, field, value) => {
    setDrafts((prev) => ({
      ...prev,
      [productId]: {
        ...(prev[productId] || emptyDraft),
        [field]: value
      }
    }));
  };

  const saveProduct = async (product) => {
    const productId = product._id || product.id;
    const draft = drafts[productId] || emptyDraft;

    setSavingId(productId);
    try {
      const response = await fetch(`/api/manager/store-products/${productId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          product_name: draft.product_name,
          price: draft.price,
          qty: Number(draft.qty)
        })
      });
      const data = await response.json();

      if (!response.ok) {
        toast.error(data.error || 'Failed to update product');
        return;
      }

      toast.success('Product updated');
      await fetchProducts();
    } catch (error) {
      console.error('Error saving manager product:', error);
      toast.error('Failed to update product');
    } finally {
      setSavingId('');
    }
  };

  return (
    <Layout userRole="manager">
      <div className="px-4 py-6 sm:px-0">
        <div className="flex flex-col gap-4 mb-6 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Store Products</h1>
            <p className="text-sm text-gray-700 mt-1">Manage assigned store product name, price, and quantity.</p>
          </div>
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search product, EAN, or store"
            className="w-full lg:w-80 border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 placeholder:text-gray-500"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
          <SummaryCard label="Products" value={totals.products} />
          <SummaryCard label="Total Qty" value={Math.round(totals.qty)} />
          <SummaryCard label="Stock Value" value={`Rs ${totals.value.toFixed(2)}`} />
        </div>

        {loading ? (
          <PageLoader message="Loading assigned store products..." />
        ) : (
          <div className="bg-white border border-gray-200 rounded-md overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-800 uppercase">EAN</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-800 uppercase">Store</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-800 uppercase">Product Name</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-800 uppercase">Price</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-800 uppercase">Qty</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-800 uppercase">Sold</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-800 uppercase">Action</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredProducts.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-6 text-center text-sm text-gray-700">
                        No assigned store products found.
                      </td>
                    </tr>
                  ) : (
                    filteredProducts.map((product) => {
                      const productId = product._id || product.id;
                      const draft = drafts[productId] || emptyDraft;

                      return (
                        <tr key={productId} className="hover:bg-gray-50">
                          <td className="px-4 py-3 text-sm text-gray-800 whitespace-nowrap">{product.EAN_code}</td>
                          <td className="px-4 py-3 text-sm text-gray-800 whitespace-nowrap">
                            {product.managedShop?.name || 'Assigned Store'}
                          </td>
                          <td className="px-4 py-3 min-w-64">
                            <input
                              type="text"
                              value={draft.product_name}
                              onChange={(event) => updateDraft(productId, 'product_name', event.target.value)}
                              className="w-full border border-gray-300 rounded-md px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                            />
                          </td>
                          <td className="px-4 py-3 w-32">
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={draft.price}
                              onChange={(event) => updateDraft(productId, 'price', event.target.value)}
                              className="w-full border border-gray-300 rounded-md px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                            />
                          </td>
                          <td className="px-4 py-3 w-28">
                            <input
                              type="number"
                              min="0"
                              step="1"
                              value={draft.qty}
                              onChange={(event) => updateDraft(productId, 'qty', event.target.value)}
                              className="w-full border border-gray-300 rounded-md px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                            />
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-800 whitespace-nowrap">{Math.round(product.qty_sold || 0)}</td>
                          <td className="px-4 py-3">
                            <button
                              type="button"
                              onClick={() => saveProduct(product)}
                              disabled={savingId === productId}
                              className="px-3 py-1.5 bg-emerald-600 text-white rounded-md text-sm hover:bg-emerald-700 disabled:opacity-60 disabled:cursor-not-allowed"
                            >
                              {savingId === productId ? 'Saving...' : 'Save'}
                            </button>
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
      </div>
    </Layout>
  );
}

function SummaryCard({ label, value }) {
  return (
    <div className="bg-white border border-gray-200 rounded-md p-4">
      <p className="text-sm text-gray-700">{label}</p>
      <p className="text-xl font-semibold text-gray-900 mt-1">{value}</p>
    </div>
  );
}
