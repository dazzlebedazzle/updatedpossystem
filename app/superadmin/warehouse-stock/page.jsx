'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Layout from '@/components/Layout';
import { PageLoader } from '@/components/Loader';
import LoadingButton from '@/components/LoadingButton';
import { toast } from '@/lib/toast';

function getId(value) {
  if (!value) return '';
  if (typeof value === 'object') {
    return (value._id || value.id || '').toString();
  }
  return value.toString();
}

export default function WarehouseStockPage() {
  const [products, setProducts] = useState([]);
  const [subWarehouses, setSubWarehouses] = useState([]);
  const [warehouseInventory, setWarehouseInventory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [assigningStock, setAssigningStock] = useState(false);
  const [warehouseFormData, setWarehouseFormData] = useState({
    warehouseType: 'main',
    warehouseId: '',
    quantity: ''
  });

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [productsRes, subWarehousesRes, warehouseInventoryRes] = await Promise.all([
        fetch('/api/products', { cache: 'default' }),
        fetch('/api/sub-warehouses', { cache: 'default' }),
        fetch('/api/warehouse-inventory', { cache: 'no-store' })
      ]);

      const [productsData, subWarehousesData, warehouseInventoryData] = await Promise.all([
        productsRes.json(),
        subWarehousesRes.json(),
        warehouseInventoryRes.json()
      ]);

      setProducts(productsData.products || []);
      setSubWarehouses(subWarehousesData.subWarehouses || []);
      setWarehouseInventory(warehouseInventoryData.warehouseInventory || []);
    } catch (error) {
      console.error('Error loading warehouse stock:', error);
      toast.error('Failed to load warehouse stock');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const inventoryByProductId = useMemo(() => {
    const map = new Map();
    warehouseInventory.forEach((item) => {
      const productId = getId(item.productId);
      if (productId) {
        map.set(productId, item);
      }
    });
    return map;
  }, [warehouseInventory]);

  const rows = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();

    return products
      .map((product) => {
        const productId = getId(product._id || product.id);
        const warehouse = inventoryByProductId.get(productId);
        const subWarehouseQty = (warehouse?.subWarehouseStock || []).reduce(
          (sum, stock) => sum + (Number(stock.quantity) || 0),
          0
        );
        const shopQty = (warehouse?.shopStock || []).reduce(
          (sum, stock) => sum + (Number(stock.quantity) || 0),
          0
        );
        const mainWarehouseQty = Number(warehouse?.mainWarehouseQty) || 0;
        const productAvailableQty = Number(product.qty || 0) - Number(product.qty_sold || 0);

        return {
          product,
          productId,
          productName: product.product_name || product.name || '',
          eanCode: product.EAN_code || '',
          supplier: product.supplier || '-',
          unit: product.unit || '-',
          productAvailableQty,
          mainWarehouseQty,
          subWarehouseQty,
          shopQty,
          totalWarehouseQty: mainWarehouseQty + subWarehouseQty + shopQty
        };
      })
      .filter((row) => {
        if (!normalizedSearch) return true;

        return (
          row.productName.toLowerCase().includes(normalizedSearch) ||
          row.eanCode.toString().toLowerCase().includes(normalizedSearch) ||
          row.supplier.toLowerCase().includes(normalizedSearch)
        );
      });
  }, [inventoryByProductId, products, searchTerm]);

  const totals = useMemo(() => {
    return rows.reduce(
      (sum, row) => ({
        main: sum.main + row.mainWarehouseQty,
        sub: sum.sub + row.subWarehouseQty,
        shop: sum.shop + row.shopQty,
        total: sum.total + row.totalWarehouseQty
      }),
      { main: 0, sub: 0, shop: 0, total: 0 }
    );
  }, [rows]);

  const openAssignModal = (product) => {
    setSelectedProduct(product);
    setWarehouseFormData({
      warehouseType: 'main',
      warehouseId: '',
      quantity: ''
    });
    setShowAssignModal(true);
  };

  const closeAssignModal = () => {
    setShowAssignModal(false);
    setSelectedProduct(null);
    setWarehouseFormData({
      warehouseType: 'main',
      warehouseId: '',
      quantity: ''
    });
  };

  const handleWarehouseAssignment = async (event) => {
    event.preventDefault();

    if (!selectedProduct) return;

    const productId = selectedProduct._id || selectedProduct.id;
    const { warehouseType, warehouseId, quantity } = warehouseFormData;

    if (warehouseType === 'sub' && !warehouseId) {
      toast.error('Please select a sub-warehouse');
      return;
    }

    if (!quantity || Number(quantity) <= 0) {
      toast.error('Please enter a valid quantity');
      return;
    }

    setAssigningStock(true);

    try {
      const response = await fetch('/api/warehouse-inventory', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId,
          warehouseType,
          warehouseId: warehouseType === 'sub' ? warehouseId : undefined,
          quantity: Number(quantity)
        })
      });

      const data = await response.json();

      if (response.ok) {
        toast.success('Warehouse stock updated successfully');
        closeAssignModal();
        await fetchData();
      } else {
        toast.error(data.error || 'Failed to update warehouse stock');
      }
    } catch (error) {
      console.error('Error assigning warehouse stock:', error);
      toast.error('Failed to update warehouse stock');
    } finally {
      setAssigningStock(false);
    }
  };

  if (loading) {
    return (
      <Layout userRole="superadmin">
        <PageLoader message="Loading warehouse stock..." />
      </Layout>
    );
  }

  return (
    <Layout userRole="superadmin">
      <div className="px-4 py-6 sm:px-0">
        <div className="flex flex-col gap-4 mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Warehouse Stock</h1>
              <p className="text-sm text-gray-700 mt-1">Manage main warehouse and sub-warehouse quantities separately from product details.</p>
            </div>
            <button
              onClick={fetchData}
              className="w-full sm:w-auto px-4 py-2 rounded-lg bg-indigo-600 text-white font-medium hover:bg-indigo-700 transition"
            >
              Refresh
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <SummaryCard label="Main Warehouse" value={totals.main} />
            <SummaryCard label="Sub-Warehouses" value={totals.sub} />
            <SummaryCard label="Stores" value={totals.shop} />
            <SummaryCard label="Managed Stock" value={totals.total} />
          </div>

          <div className="relative w-full sm:w-96">
            <input
              type="text"
              placeholder="Search by product, EAN, or supplier..."
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
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-800 uppercase tracking-wider">EAN Code</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-800 uppercase tracking-wider">Product</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-800 uppercase tracking-wider">Supplier</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-800 uppercase tracking-wider">Available Product Qty</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-800 uppercase tracking-wider">Main Warehouse</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-800 uppercase tracking-wider">Sub-Warehouses</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-800 uppercase tracking-wider">Stores</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-800 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan="8" className="px-6 py-8 text-center text-sm text-gray-700">
                      No warehouse stock records found
                    </td>
                  </tr>
                ) : (
                  rows.map((row) => (
                    <tr key={row.productId} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-800 font-mono">{row.eanCode}</td>
                      <td className="px-6 py-4 text-sm font-medium text-gray-900">{row.productName}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-800">{row.supplier}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-800">{Math.round(row.productAvailableQty)} {row.unit}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900">{row.mainWarehouseQty}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900">{row.subWarehouseQty}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900">{row.shopQty}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <button
                          onClick={() => openAssignModal(row.product)}
                          className="text-indigo-600 hover:text-indigo-900 hover:underline transition-colors"
                        >
                          Assign Stock
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {showAssignModal && selectedProduct && (
          <div
            className="fixed inset-0 bg-black bg-opacity-50 overflow-y-auto h-full w-full z-50 flex items-center justify-center p-4"
            onClick={(event) => {
              if (event.target === event.currentTarget) {
                closeAssignModal();
              }
            }}
          >
            <div className="relative mx-auto p-6 border w-full max-w-md shadow-xl rounded-lg bg-white">
              <div className="flex justify-between items-center mb-4 pb-4 border-b">
                <h3 className="text-xl font-bold text-gray-900">Assign Stock</h3>
                <button
                  onClick={closeAssignModal}
                  className="text-gray-500 hover:text-gray-700 text-2xl font-light transition-colors"
                  aria-label="Close modal"
                >
                  x
                </button>
              </div>
              <form onSubmit={handleWarehouseAssignment} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-800 mb-1.5">Product</label>
                  <input
                    type="text"
                    value={selectedProduct.product_name || ''}
                    disabled
                    className="block w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-600 bg-gray-50"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-800 mb-1.5">Available Product Quantity</label>
                  <input
                    type="text"
                    value={Math.round((selectedProduct.qty || 0) - (selectedProduct.qty_sold || 0))}
                    disabled
                    className="block w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-600 bg-gray-50"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-800 mb-1.5">Warehouse Type *</label>
                  <select
                    value={warehouseFormData.warehouseType}
                    onChange={(event) => setWarehouseFormData({ ...warehouseFormData, warehouseType: event.target.value, warehouseId: '' })}
                    required
                    className="block w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-800 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-colors"
                  >
                    <option value="main">Main Warehouse</option>
                    <option value="sub">Sub-Warehouse</option>
                  </select>
                </div>
                {warehouseFormData.warehouseType === 'sub' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-800 mb-1.5">Select Sub-Warehouse *</label>
                    <select
                      value={warehouseFormData.warehouseId}
                      onChange={(event) => setWarehouseFormData({ ...warehouseFormData, warehouseId: event.target.value })}
                      required
                      className="block w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-800 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-colors"
                    >
                      <option value="">Select Sub-Warehouse</option>
                      {subWarehouses.map((warehouse) => (
                        <option key={warehouse._id || warehouse.id} value={warehouse._id || warehouse.id}>
                          {warehouse.name} {warehouse.location ? `- ${warehouse.location}` : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
                <div>
                  <label className="block text-sm font-medium text-gray-800 mb-1.5">Quantity to Assign *</label>
                  <input
                    type="number"
                    step="1"
                    min="1"
                    max={Math.round((selectedProduct.qty || 0) - (selectedProduct.qty_sold || 0))}
                    value={warehouseFormData.quantity}
                    onChange={(event) => setWarehouseFormData({ ...warehouseFormData, quantity: event.target.value })}
                    required
                    className="block w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-800 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-colors"
                    placeholder="Enter quantity"
                  />
                </div>
                <div className="flex justify-end gap-3 pt-4 border-t mt-4">
                  <button
                    type="button"
                    onClick={closeAssignModal}
                    className="px-4 py-2 bg-gray-100 text-gray-800 rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors"
                  >
                    Cancel
                  </button>
                  <LoadingButton
                    type="submit"
                    loading={assigningStock}
                    loadingText="Assigning..."
                    className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 transition-colors"
                  >
                    Assign Stock
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
      <p className="text-2xl font-bold text-gray-900 mt-1">{Number(value || 0).toFixed(0)}</p>
    </div>
  );
}
