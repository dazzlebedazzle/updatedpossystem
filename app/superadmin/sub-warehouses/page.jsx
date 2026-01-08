'use client';

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import Layout from '@/components/Layout';
import { toast } from '@/lib/toast';
import { suppliers } from '@/lib/suppliers';
import LoadingButton from '@/components/LoadingButton';

export default function SuperAdminSubWarehouses() {
  const [subWarehouses, setSubWarehouses] = useState([]);
  const [warehouseInventory, setWarehouseInventory] = useState([]);
  const [users, setUsers] = useState([]);
  const [shops, setShops] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showStockModal, setShowStockModal] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [selectedWarehouse, setSelectedWarehouse] = useState(null);
  const [selectedStockItem, setSelectedStockItem] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [assigningStock, setAssigningStock] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });
  const [itemsPerPage, setItemsPerPage] = useState(25);
  const [currentPage, setCurrentPage] = useState(1);
  const searchInputRef = useRef(null);
  const [formData, setFormData] = useState({
    name: '',
    userId: '',
    location: '',
    contactPerson: '',
    contactPhone: '',
    isActive: true
  });
  const [selectedSupplierValue, setSelectedSupplierValue] = useState('');
  const [assignFormData, setAssignFormData] = useState({
    quantity: ''
  });

  useEffect(() => {
    fetchSubWarehouses();
    fetchUsers();
    fetchShops();
    fetchWarehouseInventory();
  }, []);

  // Debounce search term
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
      if (e.key === 'Escape' && showModal) {
        setShowModal(false);
        resetForm();
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'n' && !showModal) {
        e.preventDefault();
        resetForm();
        setShowModal(true);
      }
    };
    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [showModal]);

  const fetchUsers = useCallback(async () => {
    try {
      const response = await fetch('/api/users', { cache: 'default' });
      if (response.ok) {
        const data = await response.json();
        setUsers(data.users || []);
      } else {
        console.error('Failed to fetch users:', response.status);
        setUsers([]);
      }
    } catch (error) {
      console.error('Error fetching users:', error);
      setUsers([]);
    }
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

  const fetchSubWarehouses = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/sub-warehouses', { cache: 'default' });
      if (response.ok) {
        const data = await response.json();
        setSubWarehouses(data.subWarehouses || []);
      } else {
        toast.error('Failed to fetch sub-warehouses');
      }
    } catch (error) {
      console.error('Error fetching sub-warehouses:', error);
      toast.error('Error loading sub-warehouses');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchWarehouseInventory = useCallback(async () => {
    try {
      const response = await fetch('/api/warehouse-inventory', { cache: 'no-store' });
      if (response.ok) {
        const data = await response.json();
        // Create a new array reference to ensure React detects the change
        const inventory = Array.isArray(data.warehouseInventory) ? [...data.warehouseInventory] : [];
        console.log('Fetched warehouse inventory:', inventory.length, 'items');
        setWarehouseInventory(inventory);
      }
    } catch (error) {
      console.error('Error fetching warehouse inventory:', error);
    }
  }, []);

  const resetForm = () => {
    setFormData({
      name: '',
      userId: '',
      location: '',
      contactPerson: '',
      contactPhone: '',
      isActive: true
    });
    setSelectedSupplierValue('');
    setEditingId(null);
  };

  const handleEdit = (warehouse) => {
    const warehouseObj = warehouse.toObject ? warehouse.toObject() : warehouse;
    const userId = warehouseObj.userId?._id?.toString() || 
                   warehouseObj.userId?.toString() || 
                   (warehouseObj.userId ? String(warehouseObj.userId) : '');
    
    setFormData({
      name: warehouseObj.name || '',
      userId: userId,
      location: warehouseObj.location || '',
      contactPerson: warehouseObj.contactPerson || '',
      contactPhone: warehouseObj.contactPhone || '',
      isActive: warehouseObj.isActive !== undefined ? warehouseObj.isActive : true
    });
    setSelectedSupplierValue(userId || '');
    setEditingId(warehouseObj._id || warehouseObj.id);
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      const url = editingId 
        ? `/api/sub-warehouses/${editingId}`
        : '/api/sub-warehouses';
      
      const method = editingId ? 'PUT' : 'POST';
      
      // Ensure userId is properly formatted
      let userIdValue = formData.userId;
      if (!userIdValue || userIdValue === '' || userIdValue === null || userIdValue === undefined) {
        userIdValue = null;
      } else {
        userIdValue = userIdValue.toString().trim();
        if (userIdValue === '' || userIdValue === 'null' || userIdValue === 'undefined') {
          userIdValue = null;
        }
      }
      
      const payload = {
        name: formData.name,
        userId: userIdValue,
        location: formData.location || '',
        contactPerson: formData.contactPerson || '',
        contactPhone: formData.contactPhone || '',
        isActive: formData.isActive !== undefined ? formData.isActive : true
      };

      console.log('Submitting payload:', payload); // Debug log

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await response.json();

      if (response.ok) {
        toast.success(editingId ? 'Sub-warehouse updated successfully' : 'Sub-warehouse created successfully');
        setShowModal(false);
        resetForm();
        setSelectedSupplierValue('');
        fetchSubWarehouses();
      } else {
        console.error('Error response:', data); // Debug log
        toast.error(data.error || 'Failed to save sub-warehouse');
      }
    } catch (error) {
      console.error('Error saving sub-warehouse:', error);
      toast.error('Error saving sub-warehouse');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Are you sure you want to delete this sub-warehouse?')) {
      return;
    }

    try {
      const response = await fetch(`/api/sub-warehouses/${id}`, {
        method: 'DELETE'
      });

      const data = await response.json();

      if (response.ok && data.success) {
        toast.success('Sub-warehouse deleted successfully');
        fetchSubWarehouses();
      } else {
        toast.error(data.error || 'Failed to delete sub-warehouse');
      }
    } catch (error) {
      console.error('Error deleting sub-warehouse:', error);
      toast.error('Error deleting sub-warehouse');
    }
  };

  // Get shops for a warehouse
  const getShopsForWarehouse = useCallback((warehouseId) => {
    if (!warehouseId || !shops.length) return [];
    const warehouseIdStr = warehouseId.toString();
    return shops.filter(shop => {
      const shopObj = shop.toObject ? shop.toObject() : shop;
      const shopWarehouseId = shopObj.subWarehouseId?._id?.toString() || 
                              shopObj.subWarehouseId?.toString() || 
                              shopObj.subWarehouseId;
      return shopWarehouseId === warehouseIdStr;
    });
  }, [shops]);

  // Get suppliers (users) connected through shops
  const getSuppliersForWarehouse = useCallback((warehouseId) => {
    const warehouseShops = getShopsForWarehouse(warehouseId);
    const supplierIds = new Set();
    const suppliersList = [];

    warehouseShops.forEach(shop => {
      const shopObj = shop.toObject ? shop.toObject() : shop;
      const shopUserId = shopObj.userId?._id?.toString() || 
                        shopObj.userId?.toString() || 
                        shopObj.userId;
      if (shopUserId && !supplierIds.has(shopUserId)) {
        supplierIds.add(shopUserId);
        const user = users.find(u => {
          const userObj = u.toObject ? u.toObject() : u;
          return (userObj._id?.toString() || userObj.id?.toString()) === shopUserId;
        });
        if (user) {
          suppliersList.push(user);
        }
      }
    });

    return suppliersList;
  }, [getShopsForWarehouse, users]);

  // Get stock for a specific sub-warehouse
  const getStockForWarehouse = useCallback((warehouseId) => {
    if (!warehouseId || !warehouseInventory.length) return [];
    
    const warehouseIdStr = warehouseId.toString();
    const stockItems = [];
    
    warehouseInventory.forEach(inv => {
      const invObj = inv.toObject ? inv.toObject() : inv;
      const subWarehouseStock = invObj.subWarehouseStock || [];
      
      // Find stock item for this warehouse
      const stockItem = subWarehouseStock.find(s => {
        const stockWarehouseId = s.subWarehouseId?._id?.toString() || 
                                 s.subWarehouseId?.toString() || 
                                 s.subWarehouseId;
        return stockWarehouseId === warehouseIdStr;
      });
      
      if (stockItem && stockItem.quantity > 0) {
        // Extract productId properly (handle both populated and non-populated cases)
        let extractedProductId = invObj.productId;
        if (extractedProductId && typeof extractedProductId === 'object') {
          extractedProductId = extractedProductId._id || extractedProductId.id || extractedProductId;
        }
        
        stockItems.push({
          ...invObj,
          stockQuantity: stockItem.quantity,
          product: invObj.productId || invObj.productDetails,
          productId: extractedProductId
        });
      }
    });
    
    return stockItems;
  }, [warehouseInventory]);

  // Handle view stock
  const handleViewStock = (warehouse) => {
    setSelectedWarehouse(warehouse);
    setShowStockModal(true);
  };

  // Handle assign stock to supplier
  const handleAssignStock = (stockItem, warehouse) => {
    setSelectedStockItem(stockItem);
    setSelectedWarehouse(warehouse);
    setAssignFormData({ quantity: '' });
    setShowAssignModal(true);
  };

  // Handle stock assignment to supplier
  const handleAssignToSupplier = async (e) => {
    e.preventDefault();
    
    if (!selectedStockItem || !selectedWarehouse) return;
    
    const warehouseObj = selectedWarehouse.toObject ? selectedWarehouse.toObject() : selectedWarehouse;
    const associatedSupplier = warehouseObj.userId;
    
    if (!associatedSupplier) {
      toast.error('This warehouse has no associated supplier');
      return;
    }
    
    const supplierName = associatedSupplier.supplier || associatedSupplier.name;
    if (!supplierName) {
      toast.error('Supplier name not found');
      return;
    }
    
    // Get productId from various possible locations
    let productId = null;
    if (selectedStockItem.productId) {
      const pid = selectedStockItem.productId.toObject ? selectedStockItem.productId.toObject() : selectedStockItem.productId;
      productId = pid?._id || pid?.id || pid;
    }
    if (!productId && selectedStockItem.product) {
      const p = selectedStockItem.product.toObject ? selectedStockItem.product.toObject() : selectedStockItem.product;
      productId = p?._id || p?.id;
    }
    if (!productId && selectedStockItem._id) {
      // If productId is not found, try using the warehouse inventory _id
      // But we need the actual productId, so let's check the warehouse inventory structure
      productId = selectedStockItem.productId;
    }
    
    // Ensure productId is a string
    if (productId) {
      productId = productId.toString();
    }
    
    if (!productId) {
      toast.error('Product ID not found');
      console.error('Selected stock item:', selectedStockItem);
      return;
    }
    
    const subWarehouseId = (warehouseObj._id || warehouseObj.id)?.toString();
    const quantity = parseFloat(assignFormData.quantity);
    
    if (!quantity || quantity <= 0) {
      toast.error('Please enter a valid quantity');
      return;
    }
    
    if (quantity > selectedStockItem.stockQuantity) {
      toast.error('Quantity cannot exceed available stock');
      return;
    }
    
    if (!subWarehouseId) {
      toast.error('Sub-warehouse ID not found');
      return;
    }
    
    console.log('Sending assign request:', { productId, subWarehouseId, supplierName, quantity });
    
    setAssigningStock(true);
    
    try {
      const response = await fetch('/api/warehouse-inventory/assign-to-supplier', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId,
          subWarehouseId,
          supplierName,
          quantity
        }),
      });
      
      const data = await response.json();
      
      if (response.ok) {
        toast.success(`Stock assigned to supplier ${supplierName} successfully!`);
        setShowAssignModal(false);
        setSelectedStockItem(null);
        setAssignFormData({ quantity: '' });
        // Refresh warehouse inventory - this will automatically update the stock modal
        await fetchWarehouseInventory();
        // The stock modal will automatically re-render when warehouseInventory updates
        // since getStockForWarehouse depends on warehouseInventory state
      } else {
        toast.error(data.error || 'Failed to assign stock to supplier');
      }
    } catch (error) {
      console.error('Error assigning stock to supplier:', error);
      toast.error('Failed to assign stock to supplier');
    } finally {
      setAssigningStock(false);
    }
  };

  // Filter and sort warehouses
  const filteredWarehouses = useMemo(() => {
    let filtered = subWarehouses;

    // Filter by search term
    if (debouncedSearchTerm) {
      const searchLower = debouncedSearchTerm.toLowerCase();
      filtered = filtered.filter(warehouse => {
        const warehouseObj = warehouse.toObject ? warehouse.toObject() : warehouse;
        const name = (warehouseObj.name || '').toLowerCase();
        const location = (warehouseObj.location || '').toLowerCase();
        const contactPerson = (warehouseObj.contactPerson || '').toLowerCase();
        const userName = (warehouseObj.userId?.name || '').toLowerCase();
        const userEmail = (warehouseObj.userId?.email || '').toLowerCase();
        
        return name.includes(searchLower) ||
               location.includes(searchLower) ||
               contactPerson.includes(searchLower) ||
               userName.includes(searchLower) ||
               userEmail.includes(searchLower);
      });
    }

    // Sort
    if (sortConfig.key) {
      filtered = [...filtered].sort((a, b) => {
        const aObj = a.toObject ? a.toObject() : a;
        const bObj = b.toObject ? b.toObject() : b;
        
        let aValue = aObj[sortConfig.key];
        let bValue = bObj[sortConfig.key];
        
        if (sortConfig.key === 'userId') {
          aValue = aObj.userId?.name || '';
          bValue = bObj.userId?.name || '';
        }
        
        if (typeof aValue === 'string') {
          aValue = aValue.toLowerCase();
          bValue = (bValue || '').toLowerCase();
        }
        
        if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
        if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }

    return filtered;
  }, [subWarehouses, debouncedSearchTerm, sortConfig]);

  // Pagination
  const paginatedWarehouses = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredWarehouses.slice(start, start + itemsPerPage);
  }, [filteredWarehouses, currentPage, itemsPerPage]);

  const totalPages = Math.ceil(filteredWarehouses.length / itemsPerPage);

  const handleSort = (key) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  // Get all suppliers from static list and match with users
  const supplierOptions = useMemo(() => {
    // Always return all suppliers from static list
    if (!suppliers || suppliers.length === 0) {
      return [];
    }
    
    return suppliers.map((supplierName, index) => {
      // Find user that matches this supplier name (case-insensitive, trimmed)
      const matchingUser = users && users.length > 0 ? users.find(user => {
        const userObj = user.toObject ? user.toObject() : user;
        const userSupplier = (userObj.supplier || '').toLowerCase().trim();
        const staticSupplier = supplierName.toLowerCase().trim();
        // Try exact match first
        if (userSupplier === staticSupplier) {
          return true;
        }
        // Try partial match (in case of extra spaces or slight variations)
        if (userSupplier.includes(staticSupplier) || staticSupplier.includes(userSupplier)) {
          return true;
        }
        return false;
      }) : null;
      
      const userId = matchingUser ? (matchingUser.toObject ? matchingUser.toObject() : matchingUser)._id || (matchingUser.toObject ? matchingUser.toObject() : matchingUser).id : null;
      
      return {
        name: supplierName,
        userId: userId ? userId.toString() : null,
        user: matchingUser,
        index: index
      };
    }); // Show all suppliers, even if they don't have a matching user
  }, [users]);

  if (loading) {
    return (
      <Layout userRole="superadmin">
        <div className="px-4 py-6 sm:px-0">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-gray-200 rounded w-1/4"></div>
            <div className="h-64 bg-gray-200 rounded"></div>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout userRole="superadmin">
      <div className="px-4 py-6 sm:px-0">
        <div className="mb-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <h1 className="text-3xl font-bold text-gray-900">Sub-Warehouses</h1>
            <button
              onClick={() => {
                resetForm();
                setShowModal(true);
              }}
              className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 active:bg-indigo-800 transition-colors whitespace-nowrap font-medium"
            >
              Add Sub-Warehouse
            </button>
          </div>
          
          {/* Search Bar */}
          <div className="relative w-full sm:w-96 mt-4">
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Search warehouses... (Ctrl+K)"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-4 py-2 pl-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
            />
            <div className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400">
              🔍
            </div>
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            )}
          </div>
        </div>

        {/* Items per page and pagination info */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4">
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-600">Show:</label>
            <select
              value={itemsPerPage}
              onChange={(e) => {
                setItemsPerPage(Number(e.target.value));
                setCurrentPage(1);
              }}
              className="px-3 py-1 border border-gray-300 rounded focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
            >
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
            <span className="text-sm text-gray-600">entries</span>
          </div>
          <div className="text-sm text-gray-600">
            Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, filteredWarehouses.length)} of {filteredWarehouses.length} warehouses
          </div>
        </div>

        {/* Table */}
        <div className="bg-white shadow rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th
                    onClick={() => handleSort('name')}
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  >
                    Name {sortConfig.key === 'name' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                  </th>
                  <th
                    onClick={() => handleSort('userId')}
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  >
                    Associated Supplier {sortConfig.key === 'userId' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Location
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Contact
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {paginatedWarehouses.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="px-6 py-8 text-center text-sm text-gray-500">
                      {debouncedSearchTerm 
                        ? `No warehouses found matching "${debouncedSearchTerm}"`
                        : 'No warehouses found'
                      }
                    </td>
                  </tr>
                ) : (
                  paginatedWarehouses.map((warehouse) => {
                    const warehouseObj = warehouse.toObject ? warehouse.toObject() : warehouse;
                    const warehouseId = warehouseObj._id?.toString() || warehouseObj.id?.toString();
                    
                    return (
                      <tr key={warehouseId} className="hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900">{warehouseObj.name}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {warehouseObj.userId ? (
                            <div className="text-sm text-gray-900">
                              <div className="font-medium">{warehouseObj.userId.name || 'N/A'}</div>
                              <div className="text-xs text-gray-500">{warehouseObj.userId.email || ''}</div>
                            </div>
                          ) : (
                            <span className="text-sm text-gray-400">No supplier</span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900">{warehouseObj.location || 'N/A'}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900">
                            {warehouseObj.contactPerson && (
                              <div>{warehouseObj.contactPerson}</div>
                            )}
                            {warehouseObj.contactPhone && (
                              <div className="text-xs text-gray-500">{warehouseObj.contactPhone}</div>
                            )}
                            {!warehouseObj.contactPerson && !warehouseObj.contactPhone && 'N/A'}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            warehouseObj.isActive 
                              ? 'bg-green-100 text-green-800' 
                              : 'bg-red-100 text-red-800'
                          }`}>
                            {warehouseObj.isActive ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          <div className="flex flex-col gap-1 items-end">
                            <div className="flex gap-2">
                              <button
                                onClick={() => handleEdit(warehouse)}
                                className="text-indigo-600 hover:text-indigo-900"
                              >
                                Edit
                              </button>
                              <span className="text-gray-300">|</span>
                              <button
                                onClick={() => handleDelete(warehouseId)}
                                className="text-red-600 hover:text-red-900"
                              >
                                Delete
                              </button>
                            </div>
                            <button
                              onClick={() => handleViewStock(warehouse)}
                              className="text-green-600 hover:text-green-900 text-xs"
                            >
                              View Stock
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

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between mt-4">
            <button
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
              className="px-4 py-2 border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
            >
              Previous
            </button>
            <span className="text-sm text-gray-600">
              Page {currentPage} of {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
              disabled={currentPage === totalPages}
              className="px-4 py-2 border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
            >
              Next
            </button>
          </div>
        )}

        {/* Stock View Modal */}
        {showStockModal && selectedWarehouse && (
          <div 
            className="fixed inset-0 bg-black bg-opacity-50 overflow-y-auto h-full w-full z-50 flex items-center justify-center p-4"
            onClick={(e) => {
              if (e.target === e.currentTarget) {
                setShowStockModal(false);
                setSelectedWarehouse(null);
              }
            }}
          >
            <div className="relative mx-auto p-6 border w-full max-w-4xl shadow-xl rounded-lg bg-white max-h-[90vh] overflow-hidden flex flex-col">
              <div className="flex justify-between items-center mb-4 pb-4 border-b">
                <h3 className="text-xl font-bold text-gray-900">
                  Stock for {selectedWarehouse.toObject ? selectedWarehouse.toObject().name : selectedWarehouse.name}
                </h3>
                <button
                  onClick={() => {
                    setShowStockModal(false);
                    setSelectedWarehouse(null);
                  }}
                  className="text-gray-500 hover:text-gray-700 text-2xl font-light transition-colors"
                  aria-label="Close modal"
                >
                  ×
                </button>
              </div>
              <div className="overflow-y-auto flex-1">
                {(() => {
                  const warehouseObj = selectedWarehouse.toObject ? selectedWarehouse.toObject() : selectedWarehouse;
                  const stockItems = getStockForWarehouse(warehouseObj._id || warehouseObj.id);
                  
                  if (stockItems.length === 0) {
                    return (
                      <div className="text-center py-8 text-gray-500">
                        No stock available in this warehouse
                      </div>
                    );
                  }
                  
                  return (
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-800 uppercase tracking-wider">EAN Code</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-800 uppercase tracking-wider">Product Name</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-800 uppercase tracking-wider">Unit</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-800 uppercase tracking-wider">Price</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-800 uppercase tracking-wider">Available Qty</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-800 uppercase tracking-wider">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {stockItems.map((item, idx) => {
                          // Get product information from various possible locations
                          const product = item.product || item.productId || item.productDetails;
                          const productObj = product?.toObject ? product.toObject() : product;
                          
                          // Get productId from various possible locations
                          let productId = null;
                          if (item.productId) {
                            const pid = item.productId.toObject ? item.productId.toObject() : item.productId;
                            productId = pid?._id || pid?.id || pid;
                          }
                          if (!productId && productObj) {
                            productId = productObj._id || productObj.id;
                          }
                          if (!productId && item.productDetails) {
                            productId = item.productDetails._id || item.productDetails.id;
                          }
                          
                          // Get product details - try productDetails first, then product/productId
                          const productDetails = item.productDetails || productObj || {};
                          const eanCode = productDetails.EAN_code || productObj?.EAN_code || '-';
                          const productName = productDetails.product_name || productObj?.product_name || '-';
                          const unit = productDetails.unit || productObj?.unit || '-';
                          const price = productDetails.price || productObj?.price || 0;
                          
                          return (
                            <tr key={productId || idx} className="hover:bg-gray-50">
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-800 font-mono">
                                {eanCode}
                              </td>
                              <td className="px-6 py-4 text-sm font-medium text-gray-900">
                                {productName}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-800">
                                {unit}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900">
                                ₹{parseFloat(price).toFixed(2)}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-800">
                                {item.stockQuantity || 0}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                                {warehouseObj.userId && (
                                  <button
                                    onClick={() => handleAssignStock(item, selectedWarehouse)}
                                    className="text-green-600 hover:text-green-900 hover:underline transition-colors"
                                  >
                                    Assign to Supplier
                                  </button>
                                )}
                                {!warehouseObj.userId && (
                                  <span className="text-gray-400 text-xs">No supplier assigned</span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  );
                })()}
              </div>
            </div>
          </div>
        )}

        {/* Assign Stock to Supplier Modal */}
        {showAssignModal && selectedStockItem && selectedWarehouse && (
          <div 
            className="fixed inset-0 bg-black bg-opacity-50 overflow-y-auto h-full w-full z-50 flex items-center justify-center p-4"
            onClick={(e) => {
              if (e.target === e.currentTarget) {
                setShowAssignModal(false);
                setSelectedStockItem(null);
                setSelectedWarehouse(null);
                setAssignFormData({ quantity: '' });
              }
            }}
          >
            <div className="relative mx-auto p-6 border w-full max-w-md shadow-xl rounded-lg bg-white">
              <div className="flex justify-between items-center mb-4 pb-4 border-b">
                <h3 className="text-xl font-bold text-gray-900">
                  Assign Stock to Supplier
                </h3>
                <button
                  onClick={() => {
                    setShowAssignModal(false);
                    setSelectedStockItem(null);
                    setSelectedWarehouse(null);
                    setAssignFormData({ quantity: '' });
                  }}
                  className="text-gray-500 hover:text-gray-700 text-2xl font-light transition-colors"
                  aria-label="Close modal"
                >
                  ×
                </button>
              </div>
              <form onSubmit={handleAssignToSupplier} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-800 mb-1.5">Product</label>
                  <input
                    type="text"
                    value={(() => {
                      const product = selectedStockItem.product || selectedStockItem.productId || selectedStockItem.productDetails;
                      const productObj = product?.toObject ? product.toObject() : product;
                      return productObj?.product_name || '-';
                    })()}
                    disabled
                    className="block w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-600 bg-gray-50"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-800 mb-1.5">Available Quantity</label>
                  <input
                    type="text"
                    value={selectedStockItem.stockQuantity || 0}
                    disabled
                    className="block w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-600 bg-gray-50"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-800 mb-1.5">Supplier</label>
                  <input
                    type="text"
                    value={(() => {
                      const warehouseObj = selectedWarehouse.toObject ? selectedWarehouse.toObject() : selectedWarehouse;
                      const supplier = warehouseObj.userId;
                      return supplier?.supplier || supplier?.name || '-';
                    })()}
                    disabled
                    className="block w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-600 bg-gray-50"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-800 mb-1.5">Quantity to Assign *</label>
                  <input
                    type="number"
                    step="1"
                    min="1"
                    max={selectedStockItem.stockQuantity || 0}
                    value={assignFormData.quantity}
                    onChange={(e) => setAssignFormData({ quantity: e.target.value })}
                    required
                    className="block w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-800 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-colors"
                    placeholder="Enter quantity"
                  />
                </div>
                <div className="flex justify-end gap-3 pt-4 border-t mt-4">
                  <button
                    type="button"
                    onClick={() => {
                      setShowAssignModal(false);
                      setSelectedStockItem(null);
                      setSelectedWarehouse(null);
                      setAssignFormData({ quantity: '' });
                    }}
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

        {/* Modal */}
        {showModal && (
          <div 
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
            onClick={(e) => {
              if (e.target === e.currentTarget) {
                setShowModal(false);
                resetForm();
              }
            }}
          >
            <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              <div className="p-6">
                <h2 className="text-2xl font-bold text-gray-900 mb-4">
                  {editingId ? 'Edit Sub-Warehouse' : 'Add Sub-Warehouse'}
                </h2>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Name <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none text-gray-800 placeholder:text-gray-800"
                        placeholder="Warehouse name"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Associated Supplier
                      </label>
                      <select
                        value={selectedSupplierValue}
                        onChange={(e) => {
                          const selectedValue = e.target.value;
                          setSelectedSupplierValue(selectedValue);
                          
                          // If value starts with "supplier:", it's a supplier name without user
                          // Otherwise, it's a userId
                          if (selectedValue.startsWith('supplier:')) {
                            const supplierName = selectedValue.replace('supplier:', '');
                            // Try to find user for this supplier (case-insensitive, with partial matching)
                            const matchingUser = users && users.length > 0 ? users.find(user => {
                              const userObj = user.toObject ? user.toObject() : user;
                              const userSupplier = (userObj.supplier || '').toLowerCase().trim();
                              const staticSupplier = supplierName.toLowerCase().trim();
                              // Try exact match first
                              if (userSupplier === staticSupplier) {
                                return true;
                              }
                              // Try partial match
                              if (userSupplier.includes(staticSupplier) || staticSupplier.includes(userSupplier)) {
                                return true;
                              }
                              return false;
                            }) : null;
                            
                            if (matchingUser) {
                              const userObj = matchingUser.toObject ? matchingUser.toObject() : matchingUser;
                              const userId = userObj._id || userObj.id;
                              console.log('Found matching user:', userId, 'for supplier:', supplierName);
                              setFormData(prev => ({ ...prev, userId: userId ? userId.toString() : '' }));
                            } else {
                              // No matching user found
                              console.log('No matching user found for supplier:', supplierName);
                              console.log('Available users with suppliers:', users?.map(u => {
                                const uObj = u.toObject ? u.toObject() : u;
                                return { name: uObj.name, supplier: uObj.supplier };
                              }) || []);
                              toast.warning(`No user found for supplier: ${supplierName}. Please create a user for this supplier first.`);
                              setFormData(prev => ({ ...prev, userId: '' }));
                            }
                          } else if (selectedValue) {
                            // Direct userId selection
                            console.log('Direct userId selection:', selectedValue);
                            setFormData(prev => ({ ...prev, userId: selectedValue }));
                          } else {
                            // Empty selection
                            setFormData(prev => ({ ...prev, userId: '' }));
                          }
                        }}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none text-gray-800 placeholder:text-gray-800"
                      >
                        <option value="" className="text-gray-800">Select Supplier</option>
                        {supplierOptions && supplierOptions.length > 0 ? (
                          supplierOptions.map((supplier, idx) => (
                            <option 
                              key={`supplier-option-${idx}-${supplier.name}`} 
                              value={supplier.userId || `supplier:${supplier.name}`}
                              className="text-gray-800"
                            >
                              {supplier.name}
                            </option>
                          ))
                        ) : (
                          <option value="" disabled className="text-gray-800">Loading suppliers...</option>
                        )}
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Location
                      </label>
                      <input
                        type="text"
                        value={formData.location}
                        onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none text-gray-800 placeholder:text-gray-800"
                        placeholder="Location"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Contact Person
                      </label>
                      <input
                        type="text"
                        value={formData.contactPerson}
                        onChange={(e) => setFormData({ ...formData, contactPerson: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none text-gray-800 placeholder:text-gray-800"
                        placeholder="Contact person name"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Contact Phone
                      </label>
                      <input
                        type="tel"
                        value={formData.contactPhone}
                        onChange={(e) => setFormData({ ...formData, contactPhone: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none text-gray-800 placeholder:text-gray-800"
                        placeholder="Phone number"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Status
                      </label>
                      <select
                        value={formData.isActive ? 'active' : 'inactive'}
                        onChange={(e) => setFormData({ ...formData, isActive: e.target.value === 'active' })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none text-gray-800"
                      >
                        <option value="active" className="text-gray-800">Active</option>
                        <option value="inactive" className="text-gray-800">Inactive</option>
                      </select>
                    </div>
                  </div>

                  <div className="flex justify-end gap-3 pt-4">
                    <button
                      type="button"
                      onClick={() => {
                        setShowModal(false);
                        resetForm();
                      }}
                      className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                    >
                      Cancel
                    </button>
                    <LoadingButton
                      type="submit"
                      loading={submitting}
                      className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700"
                    >
                      {editingId ? 'Update' : 'Create'}
                    </LoadingButton>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
