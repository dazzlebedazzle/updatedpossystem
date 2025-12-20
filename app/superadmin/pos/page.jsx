'use client';

import { useState, useEffect, useCallback } from 'react';
import Image from 'next/image';
import Layout, { useSidebar } from '@/components/Layout';
import { toast } from '@/lib/toast';
import Receipt from '@/components/Receipt';
import { categories as predefinedCategories, getCategoryImage } from '@/lib/categories';

// Image component with error handling
const SafeImage = ({ src, alt, fill, className, fallback }) => {
  const [hasError, setHasError] = useState(false);
  
  if (hasError || !src) {
    return fallback;
  }
  
  return (
    <Image 
      src={src} 
      alt={alt}
      fill={fill}
      className={className}
      onError={() => setHasError(true)}
    />
  );
};

export default function SuperAdminPOS() {
  const [products, setProducts] = useState([]);
  const [cart, setCart] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [categories, setCategories] = useState([]);
  const [showCheckoutPopup, setShowCheckoutPopup] = useState(false);
  const [showReceipt, setShowReceipt] = useState(false);
  const [receiptData, setReceiptData] = useState(null);
  const [customerData, setCustomerData] = useState({
    name: '',
    mobile: '',
    address: '',
    paymentType: ''
  });

  useEffect(() => {
    fetchProducts();
    fetchCategories();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchProducts = async () => {
    try {
      const response = await fetch('/api/products');
      const data = await response.json();
      const allProducts = data.products || [];
      
      // Remove duplicates using Set-based approach - more reliable
      const seenIds = new Set();
      const seenEANs = new Set();
      const uniqueProducts = [];
      
      for (const product of allProducts) {
        if (!product) continue;
        
        const productId = product._id || product.id;
        const productEAN = product.EAN_code;
        
        // Create a unique key for this product
        const idKey = productId ? String(productId) : null;
        const eanKey = productEAN ? String(productEAN) : null;
        
        // Skip if we've seen this ID or EAN before
        if ((idKey && seenIds.has(idKey)) || (eanKey && seenEANs.has(eanKey))) {
          continue;
        }
        
        // Mark as seen and add to unique products
        if (idKey) seenIds.add(idKey);
        if (eanKey) seenEANs.add(eanKey);
        uniqueProducts.push(product);
      }
      
      setProducts(uniqueProducts);
    } catch (error) {
      console.error('Error fetching products:', error);
} finally {
      setLoading(false);
    }
  };

  const fetchCategories = useCallback(async () => {
    try {
      const allProducts = products.length > 0 ? products : (await fetch('/api/products').then(r => r.json())).products || [];
      
      // Get unique category names from products (as they appear in database)
      const categoryMap = {};
      allProducts.forEach(product => {
        const categoryName = product.category || 'general';
        if (!categoryMap[categoryName]) {
          categoryMap[categoryName] = {
            name: categoryName,
            count: 0
          };
        }
        categoryMap[categoryName].count++;
      });
      
      // Match with predefined categories to get images
      const categoriesWithCount = Object.values(categoryMap).map(dbCategory => {
        // Find matching predefined category (case-insensitive)
        const predefinedCat = predefinedCategories.find(
          cat => cat.name.toLowerCase() === dbCategory.name.toLowerCase()
        );
        
        return {
          name: dbCategory.name, // Use database category name for display
          image: predefinedCat ? predefinedCat.image : getCategoryImage(dbCategory.name),
          count: dbCategory.count
        };
      });
      
      // Add "All" category with total count
      const allCategory = { name: 'All', count: allProducts.length };
      setCategories([allCategory, ...categoriesWithCount]);
    } catch (error) {
      console.error('Error fetching categories:', error);
      const allProducts = products.length > 0 ? products : [];
      const categoryMap = {};
      allProducts.forEach(product => {
        const categoryName = product.category || 'general';
        if (!categoryMap[categoryName]) {
          categoryMap[categoryName] = {
            name: categoryName,
            count: 0
          };
        }
        categoryMap[categoryName].count++;
      });
      
      const categoriesWithCount = Object.values(categoryMap).map(dbCategory => {
        const predefinedCat = predefinedCategories.find(
          cat => cat.name.toLowerCase() === dbCategory.name.toLowerCase()
        );
        
        return {
          name: dbCategory.name,
          image: predefinedCat ? predefinedCat.image : getCategoryImage(dbCategory.name),
          count: dbCategory.count
        };
      });
      
      const allCategory = { name: 'All', count: allProducts.length };
      setCategories([allCategory, ...categoriesWithCount]);
    }
  }, [products]);

  useEffect(() => {
    if (products.length > 0) {
      fetchCategories();
    }
  }, [products.length, fetchCategories]);

  // Additional deduplication check (products should already be unique from fetchProducts, but this is a safety measure)
  const seenKeys = new Set();
  const uniqueProducts = products.filter(product => {
    if (!product) return false;
    const productId = product._id || product.id;
    const productEAN = product.EAN_code;
    const key = productId ? String(productId) : (productEAN ? String(productEAN) : null);
    
    if (!key || seenKeys.has(key)) return false;
    seenKeys.add(key);
    return true;
  });

  const filteredProducts = uniqueProducts.filter(product => {
    if (!product) return false;
    const productName = (product.product_name || product.name || '').toLowerCase();
    const productEAN = (product.EAN_code || '').toString().toLowerCase();
    const searchLower = searchTerm.toLowerCase();
    const matchesSearch = productName.includes(searchLower) || productEAN.includes(searchLower);
    const matchesCategory = selectedCategory === 'All' || (product.category || 'general').toLowerCase() === selectedCategory.toLowerCase();
    return matchesSearch && matchesCategory;
  });

  const addToCart = (product) => {
    const availableStock = (product.qty || 0) - (product.qty_sold || 0);
    if (availableStock <= 0) {
      toast.error('Product out of stock');
      return;
    }

    const productId = product._id || product.id;
    const unit = product.unit || 'kg';
    const defaultQty = unit === 'kg' ? 100 : 1;

    const existingItem = cart.find(item => item.productId === productId);
    if (existingItem) {
      // Convert cart quantity to same unit as stock for comparison
      const newQtyInStockUnit = unit === 'kg' ? (existingItem.quantity + defaultQty) / 1000 : existingItem.quantity + defaultQty;
      
      if (newQtyInStockUnit > availableStock) {
        toast.error(`Insufficient stock. Only ${availableStock} ${unit} available`);
        return;
      }
      setCart(cart.map(item =>
        item.productId === productId
          ? { ...item, quantity: item.quantity + defaultQty }
          : item
      ));
      toast.success('Quantity updated in cart');
    } else {
      // Check if initial quantity exceeds stock
      const initialQtyInStockUnit = unit === 'kg' ? defaultQty / 1000 : defaultQty;
      if (initialQtyInStockUnit > availableStock) {
        toast.error(`Insufficient stock. Only ${availableStock} ${unit} available`);
        return;
      }
      
      setCart([...cart, {
        productId: productId,
        name: product.product_name || product.name,
        price: product.price || 0,
        quantity: defaultQty,
        unit: unit,
        profit: product.profit || 0,
        product_code: product.EAN_code || '',
        discount: product.discount || 0
      }]);
      toast.success('Product added to cart');
    }
  };

  const removeFromCart = (productId) => {
    setCart(cart.filter(item => item.productId !== productId));
    toast.success('Item removed from cart');
  };

  const updateQuantity = (productId, quantity) => {
    if (quantity <= 0) {
      removeFromCart(productId);
      return;
    }
    
    const product = products.find(p => (p._id || p.id) === productId);
    const cartItem = cart.find(item => item.productId === productId);
    
    if (product && cartItem) {
      const availableStock = (product.qty || 0) - (product.qty_sold || 0);
      const unit = cartItem.unit || 'kg';
      
      // Convert quantity to same unit as stock for comparison
      const quantityInStockUnit = unit === 'kg' ? quantity / 1000 : quantity;
      
      if (quantityInStockUnit > availableStock) {
        toast.error(`Only ${availableStock} ${unit} available in stock`);
        return;
      }
    }
    
    setCart(cart.map(item =>
      item.productId === productId
        ? { ...item, quantity }
        : item
    ));
  };

  const getTotal = () => {
    return cart.reduce((sum, item) => {
      const qtyInUnit = item.unit === 'kg' ? item.quantity / 1000 : item.quantity;
      return sum + (item.price * qtyInUnit);
    }, 0);
  };

  const handleCheckout = async () => {
    if (cart.length === 0) {
      toast.warning('Cart is empty');
      return;
    }

    if (!customerData.name || !customerData.mobile || !customerData.address || !customerData.paymentType) {
      toast.error('Please fill all customer details');
      return;
    }

    try {
      // Save customer first
      try {
        const customerResponse = await fetch('/api/customers', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: customerData.name,
            phone: customerData.mobile,
            address: customerData.address,
            email: '' // Email not collected in POS form
          }),
        });
        
        if (customerResponse.ok) {
          // Customer saved successfully (or already exists)
        } else {
          // Customer save failed, but continue with sale anyway
          console.warn('Failed to save customer, continuing with sale');
        }
      } catch (customerError) {
        // Customer save error, but continue with sale anyway
        console.warn('Error saving customer:', customerError);
      }

      // Process the sale
      const response = await fetch('/api/sales', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: cart.map(item => ({
            productId: item.productId,
            quantity: item.quantity,
            unit: item.unit,
            price: item.price,
            profit: item.profit || 0
          })),
          customerName: customerData.name,
          customerMobile: customerData.mobile,
          customerAddress: customerData.address,
          paymentMethod: customerData.paymentType
        }),
      });

      if (response.ok) {
        const data = await response.json();
        toast.success('Sale completed successfully!');
        
        // Prepare receipt data
        const receipt = {
          receiptNumber: data.sale._id || 'RS-' + Date.now(),
          date: new Date(),
          customerName: customerData.name,
          customerMobile: customerData.mobile,
          customerAddress: customerData.address,
          paymentMethod: customerData.paymentType,
          items: cart.map(item => ({
            name: item.name,
            quantity: item.quantity,
            unit: item.unit,
            price: item.price,
            total: (item.unit === 'kg' ? item.quantity / 1000 : item.quantity) * item.price
          })),
          subtotal: getTotal(),
          total: getTotal()
        };
        
        setReceiptData(receipt);
        setShowCheckoutPopup(false);
        setShowReceipt(true);
        setCart([]);
        setCustomerData({ name: '', mobile: '', address: '', paymentType: '' });
        fetchProducts();
      } else {
        const data = await response.json();
        toast.error(data.error || 'Checkout failed');
      }
    } catch (error) {
      console.error('Error during checkout:', error);
      toast.error('Checkout failed');
    }
  };

  const categoryIcons = {
    'all': '🏪',
    'almonds': '🥜',
    'apricots': '📦',
    'berries': '🫐',
    'cashews': '📦',
    'dates': '🍇',
    'figs': '🍑',
    'fruits': '📦',
    'mixtures': '📦',
    'cashew': '🥜',
    'pistachio': '🥜',
    'raisins': '🍇',
    'seeds': '🌰',
    'mixes': '🥗',
    'general': '📦'
  };

  const getCategoryIcon = (categoryName) => {
    return categoryIcons[categoryName.toLowerCase()] || '📦';
  };

  const getProductImage = (product) => {
    if (product.images) {
      return `/assets/category_images/${product.images}`;
    }
    return null;
  };

  return (
    <Layout userRole="superadmin">
      <POSContent 
        products={products}
        cart={cart}
        loading={loading}
        searchTerm={searchTerm}
        setSearchTerm={setSearchTerm}
        selectedCategory={selectedCategory}
        setSelectedCategory={setSelectedCategory}
        categories={categories}
        showCheckoutPopup={showCheckoutPopup}
        setShowCheckoutPopup={setShowCheckoutPopup}
        customerData={customerData}
        setCustomerData={setCustomerData}
        filteredProducts={filteredProducts}
        addToCart={addToCart}
        removeFromCart={removeFromCart}
        updateQuantity={updateQuantity}
        getTotal={getTotal}
        handleCheckout={handleCheckout}
        getProductImage={getProductImage}
        getCategoryIcon={getCategoryIcon}
        showReceipt={showReceipt}
        setShowReceipt={setShowReceipt}
        receiptData={receiptData}
      />
    </Layout>
  );
}

function POSContent({ 
  products, 
  cart, 
  loading, 
  searchTerm, 
  setSearchTerm, 
  selectedCategory, 
  setSelectedCategory, 
  categories, 
  showCheckoutPopup, 
  setShowCheckoutPopup, 
  customerData, 
  setCustomerData, 
  filteredProducts, 
  addToCart, 
  removeFromCart, 
  updateQuantity, 
  getTotal, 
  handleCheckout,
  getProductImage,
  getCategoryIcon,
  showReceipt,
  setShowReceipt,
  receiptData
}) {
  const { sidebarWidth } = useSidebar();
  const [showCartMobile, setShowCartMobile] = useState(false);

  return (
    <div className="h-screen flex flex-col lg:flex-row bg-white overflow-hidden -m-6" style={{ width: `calc(100vw - ${sidebarWidth}px)`, marginLeft: '-1.5rem', transition: 'width 0.3s ease' }}>
      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
          {/* Search Bar */}
          <div className="bg-white shadow-sm p-2 sm:p-4 flex-shrink-0">
            <form 
              onSubmit={(e) => {
                e.preventDefault();
              }}
              className="flex items-center gap-2 sm:gap-3"
            >
              <input
                type="text"
                placeholder="Search product..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="flex-1 px-3 sm:px-4 py-2 sm:py-2.5 text-sm sm:text-base border border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none"
              />
              <button
                type="submit"
                className="bg-purple-600 text-white px-4 sm:px-6 py-2 sm:py-2.5 rounded-lg hover:bg-purple-700 transition font-medium text-sm sm:text-base whitespace-nowrap"
              >
                <span className="hidden sm:inline">Search</span>
                <span className="sm:hidden">🔍</span>
              </button>
              {/* Mobile Cart Button */}
              <button
                type="button"
                onClick={() => setShowCartMobile(true)}
                className="lg:hidden relative bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition font-medium"
              >
                🛒
                {cart.length > 0 && (
                  <span className="absolute -top-2 -right-2 bg-red-600 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                    {cart.length}
                  </span>
                )}
              </button>
            </form>
          </div>

          {/* Category Cards - Horizontal Scrollable */}
          <div className="bg-white border-b shadow-sm px-2 sm:px-4 py-2 sm:py-3 flex-shrink-0">
            <div className="overflow-x-auto scrollbar-hide -mx-2 sm:mx-0">
              <div className="flex gap-1.5 sm:gap-2 pb-2 px-2 sm:px-0" style={{ width: 'max-content' }}>
                {categories.map((category) => {
                  const categoryName = category.name || category;
                  const isSelected = selectedCategory === categoryName;
                  const categoryImage = category.image || getCategoryImage(categoryName);
                  return (
                    <button
                      key={categoryName}
                      onClick={() => setSelectedCategory(categoryName)}
                      className={`flex flex-col items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-1.5 sm:py-2 rounded-lg sm:rounded-xl whitespace-nowrap transition-all min-w-[60px] sm:min-w-[66px] flex-shrink-0 touch-manipulation ${
                        isSelected
                          ? 'bg-purple-600 text-white shadow-lg'
                          : 'bg-amber-50 text-gray-800 hover:bg-amber-100 active:bg-amber-200 shadow-sm border border-amber-200'
                      }`}
                    >
                      <div className={`w-8 h-8 sm:w-10 sm:h-10 rounded-lg flex items-center justify-center overflow-hidden relative ${
                        isSelected ? 'bg-white/20' : 'bg-white'
                      }`}>
                        {categoryImage ? (
                          <SafeImage
                            src={categoryImage}
                            alt={categoryName}
                            fill
                            className="object-cover"
                            fallback={
                              <div className="w-full h-full flex items-center justify-center text-lg sm:text-xl">
                                {getCategoryIcon(categoryName)}
                              </div>
                            }
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-lg sm:text-xl">
                            {getCategoryIcon(categoryName)}
                          </div>
                        )}
                      </div>
                      <span className="capitalize font-medium text-[10px] sm:text-xs leading-tight">{categoryName}</span>
                      {category.count !== undefined && category.count > 0 && (
                        <span className={`text-[9px] sm:text-[10px] ${isSelected ? 'text-white/90' : 'text-gray-800'}`}>
                          {category.count}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Products Grid */}
          <div className="flex-1 overflow-y-auto p-2 sm:p-4">
            {loading ? (
              <div className="grid grid-cols-2 xs:grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2 sm:gap-3 md:gap-4">
                {[...Array(10)].map((_, index) => (
                  <div key={index} className="bg-white border border-gray-200 rounded-lg p-1.5 sm:p-2 shadow-sm animate-pulse">
                    {/* Image Skeleton */}
                    <div className="w-full h-12 sm:h-16 bg-white rounded-md mb-1.5 sm:mb-2"></div>
                    {/* Title Skeleton */}
                    <div className="h-3 sm:h-4 bg-white rounded w-3/4 mb-1 sm:mb-2"></div>
                    <div className="h-3 sm:h-4 bg-white rounded w-1/2 mb-1 sm:mb-2"></div>
                    {/* Price Skeleton */}
                    <div className="h-4 sm:h-5 bg-white rounded w-2/3 mb-1.5 sm:mb-2"></div>
                    {/* Button Skeleton */}
                    <div className="h-7 sm:h-8 bg-white rounded w-full"></div>
                  </div>
                ))}
              </div>
            ) : filteredProducts.length === 0 ? (
              <div className="text-center py-8 sm:py-12 text-gray-600 text-sm sm:text-base">No products found</div>
            ) : (
              <div className="grid grid-cols-2 xs:grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2 sm:gap-3 md:gap-4">
                {filteredProducts.map((product) => {
                  const productId = product._id || product.id;
                  const availableStock = (product.qty || 0) - (product.qty_sold || 0);
                  const productImage = getProductImage(product);
                  
                  return (
                    <div
                      key={productId}
                      className={`bg-white border border-gray-200 rounded-lg p-1.5 sm:p-2 shadow-sm transition touch-manipulation ${
                        availableStock > 0
                          ? 'hover:shadow-md active:scale-95 cursor-pointer'
                          : 'opacity-50 cursor-not-allowed'
                      }`}
                    >
                      {/* Product Image - Clickable */}
                      <div 
                        onClick={() => availableStock > 0 && addToCart(product)}
                        className="mb-1.5 sm:mb-2 cursor-pointer relative w-full h-12 sm:h-16"
                      >
                        {productImage ? (
                          <SafeImage
                            src={productImage}
                            alt={product.product_name || product.name}
                            fill
                            className="object-cover rounded-md"
                            fallback={
                              <div className="w-full h-12 sm:h-16 bg-white rounded-md flex items-center justify-center">
                                <span className="text-xl sm:text-2xl">📦</span>
                              </div>
                            }
                          />
                        ) : (
                          <div className="w-full h-12 sm:h-16 bg-white rounded-md flex items-center justify-center">
                            <span className="text-xl sm:text-2xl">📦</span>
                          </div>
                        )}
                      </div>
                      
                      <h3 className="font-medium text-[10px] sm:text-xs text-gray-900 mb-1 break-words" title={product.product_name || product.name}>
                        {product.product_name || product.name}
                      </h3>
                      <p className="text-xs sm:text-sm font-bold text-purple-600 mb-1.5 sm:mb-2">
                        ₹{product.price || 0} <span className="text-[10px] sm:text-xs">{product.unit === 'packets' ? '/pkt' : '/kg'}</span>
                      </p>
                      <button
                        onClick={() => addToCart(product)}
                        disabled={availableStock <= 0}
                        className="w-full bg-red-600 text-white py-1.5 sm:py-2 rounded-lg hover:bg-red-700 active:bg-red-800 disabled:bg-gray-200 disabled:cursor-not-allowed text-[10px] sm:text-xs font-medium transition touch-manipulation"
                      >
                        Add to Cart
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Shopping Cart Sidebar - Desktop */}
        <div className="hidden lg:flex bg-white shadow-lg border-l flex-col flex-shrink-0" style={{ width: 'clamp(280px, 20%, 380px)', minWidth: '280px' }}>
          <div className="p-3 border-b flex-shrink-0">
            <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <span>🛒</span> Cart
            </h2>
          </div>

          <div className="flex-1 overflow-y-auto min-h-0 p-2">
            {cart.length === 0 ? (
              <div className="p-4 text-center text-gray-600">
                <p>Cart is empty</p>
              </div>
            ) : (
              <div className="space-y-2">
                {cart.map((item) => {
                  const product = products.find(p => (p._id || p.id) === item.productId);
                  const availableStock = product ? (product.qty || 0) - (product.qty_sold || 0) : 0;
                  const qtyInUnit = item.unit === 'kg' ? item.quantity / 1000 : item.quantity;
                  const itemTotal = item.price * qtyInUnit;
                  
                  return (
                    <div key={item.productId} className="bg-white rounded-lg p-2 border border-gray-200">
                      <div className="flex justify-between items-start mb-1.5">
                        <div className="flex-1">
                          <h4 className="font-medium text-sm text-gray-900 mb-0.5">{item.name}</h4>
                          <p className="text-xs text-gray-600">Available: {availableStock} {item.unit}</p>
                        </div>
                        <button
                          onClick={() => removeFromCart(item.productId)}
                          className="text-red-600 hover:text-red-800 text-sm font-medium"
                        >
                          ✕
                        </button>
                      </div>
                      
                      <div className="flex items-center justify-between mt-2">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => updateQuantity(item.productId, item.quantity - (item.unit === 'kg' ? 100 : 1))}
                            className="w-7 h-7 rounded bg-gray-200 hover:bg-gray-300 text-sm font-bold"
                          >
                            -
                          </button>
                          <div className="flex items-center">
                            <input
                              type="number"
                              value={item.unit === 'kg' ? item.quantity : item.quantity}
                              onChange={(e) => {
                                const value = parseInt(e.target.value) || 0;
                                if (value >= 0) {
                                  updateQuantity(item.productId, value);
                                }
                              }}
                              className="w-16 text-sm text-center font-medium border border-gray-200 rounded px-1 py-1 focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none"
                              min="0"
                            />
                            <span className="text-xs ml-1 text-gray-800">
                              {item.unit === 'kg' ? 'g' : 'pcs'}
                            </span>
                          </div>
                          <button
                            onClick={() => updateQuantity(item.productId, item.quantity + (item.unit === 'kg' ? 100 : 1))}
                            disabled={item.quantity >= availableStock}
                            className="w-7 h-7 rounded bg-gray-200 hover:bg-gray-300 disabled:bg-gray-200 disabled:cursor-not-allowed text-sm font-bold"
                          >
                            +
                          </button>
                        </div>
                        <span className="text-sm font-bold text-gray-900">₹{itemTotal.toFixed(2)}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Cart Footer */}
          <div className="border-t p-3 bg-white flex-shrink-0">
            <div className="mb-2">
              <div className="flex justify-between items-center mb-2">
                <span className="text-base sm:text-lg font-bold text-gray-900">Total:</span>
                <span className="text-xl sm:text-2xl font-bold text-purple-600">₹{getTotal().toFixed(2)}</span>
              </div>
            </div>
            <button
              onClick={() => setShowCheckoutPopup(true)}
              disabled={cart.length === 0}
              className="w-full bg-red-600 text-white py-2.5 sm:py-3 px-4 rounded-lg hover:bg-red-700 active:bg-red-800 disabled:opacity-50 disabled:cursor-not-allowed font-medium transition text-sm sm:text-base touch-manipulation"
            >
              Proceed to Checkout
            </button>
          </div>
        </div>

        {/* Mobile Cart Drawer */}
        {showCartMobile && (
          <>
            <div 
              className="lg:hidden fixed inset-0 bg-black/50 z-40"
              onClick={() => setShowCartMobile(false)}
            ></div>
            <div className="lg:hidden fixed bottom-0 left-0 right-0 bg-white shadow-2xl rounded-t-2xl flex flex-col z-50" style={{ maxHeight: '80vh' }}>
              <div className="p-4 border-b flex-shrink-0 flex items-center justify-between">
                <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                  <span>🛒</span> Cart ({cart.length})
                </h2>
                <button
                  onClick={() => setShowCartMobile(false)}
                  className="text-gray-600 hover:text-gray-800 text-2xl"
                >
                  ×
                </button>
              </div>

              <div className="flex-1 overflow-y-auto min-h-0 p-3">
                {cart.length === 0 ? (
                  <div className="p-4 text-center text-gray-600 text-sm">
                    <p>Cart is empty</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {cart.map((item) => {
                      const product = products.find(p => (p._id || p.id) === item.productId);
                      const availableStock = product ? (product.qty || 0) - (product.qty_sold || 0) : 0;
                      const qtyInUnit = item.unit === 'kg' ? item.quantity / 1000 : item.quantity;
                      const itemTotal = item.price * qtyInUnit;
                      
                      return (
                        <div key={item.productId} className="bg-white rounded-lg p-2.5 border border-gray-200">
                          <div className="flex justify-between items-start mb-2">
                            <div className="flex-1 min-w-0">
                              <h4 className="font-medium text-sm text-gray-900 mb-0.5 truncate">{item.name}</h4>
                              <p className="text-xs text-gray-600">Available: {availableStock} {item.unit}</p>
                            </div>
                            <button
                              onClick={() => removeFromCart(item.productId)}
                              className="text-red-600 hover:text-red-800 text-lg font-medium ml-2 touch-manipulation"
                            >
                              ✕
                            </button>
                          </div>
                          
                          <div className="flex items-center justify-between mt-2">
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => updateQuantity(item.productId, item.quantity - (item.unit === 'kg' ? 100 : 1))}
                                className="w-8 h-8 rounded bg-gray-200 hover:bg-gray-300 active:bg-white text-sm font-bold touch-manipulation"
                              >
                                -
                              </button>
                              <div className="flex items-center">
                                <input
                                  type="number"
                                  value={item.unit === 'kg' ? item.quantity : item.quantity}
                                  onChange={(e) => {
                                    const value = parseInt(e.target.value) || 0;
                                    if (value >= 0) {
                                      updateQuantity(item.productId, value);
                                    }
                                  }}
                                  className="w-16 text-sm text-center font-medium border border-gray-200 rounded px-1 py-1 focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none"
                                  min="0"
                                />
                                <span className="text-xs ml-1 text-gray-800">
                                  {item.unit === 'kg' ? 'g' : 'pcs'}
                                </span>
                              </div>
                              <button
                                onClick={() => updateQuantity(item.productId, item.quantity + (item.unit === 'kg' ? 100 : 1))}
                                disabled={item.quantity >= availableStock}
                                className="w-8 h-8 rounded bg-gray-200 disabled:bg-gray-100 disabled:cursor-not-allowed text-sm font-bold touch-manipulation"
                              >
                                +
                              </button>
                            </div>
                            <span className="text-sm font-bold text-gray-900">₹{itemTotal.toFixed(2)}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="border-t p-4 bg-white flex-shrink-0">
                <div className="mb-3">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-lg font-bold text-gray-900">Total:</span>
                    <span className="text-2xl font-bold text-purple-600">₹{getTotal().toFixed(2)}</span>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setShowCartMobile(false);
                    setShowCheckoutPopup(true);
                  }}
                  disabled={cart.length === 0}
                  className="w-full bg-red-600 text-white py-3 px-4 rounded-lg hover:bg-red-700 active:bg-red-800 disabled:opacity-50 disabled:cursor-not-allowed font-medium transition text-base touch-manipulation"
                >
                  Proceed to Checkout
                </button>
              </div>
            </div>
          </>
        )}

        {/* Checkout Popup Overlay */}
        {showCheckoutPopup && (
          <>
            <div 
              className="fixed inset-0 bg-black/50 z-40"
              onClick={() => setShowCheckoutPopup(false)}
            ></div>
            <div className="fixed inset-0 flex items-center justify-center z-50 p-2 sm:p-4">
              <div 
                className="bg-white rounded-lg sm:rounded-xl shadow-xl max-w-md w-full p-4 sm:p-6 max-h-[90vh] overflow-y-auto"
                onClick={(e) => e.stopPropagation()}
              >
                <h3 className="text-xl font-bold text-gray-900 mb-4">Customer Details</h3>
                <form onSubmit={(e) => { e.preventDefault(); handleCheckout(); }}>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-800 mb-1">
                        Name <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="Enter customer name"
                        value={customerData.name}
                        onChange={(e) => setCustomerData({ ...customerData, name: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-800 mb-1">
                        Mobile No <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="tel"
                        required
                        placeholder="Enter mobile number"
                        pattern="[0-9]{10}"
                        maxLength="10"
                        value={customerData.mobile}
                        onChange={(e) => setCustomerData({ ...customerData, mobile: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-800 mb-1">
                        Address <span className="text-red-500">*</span>
                      </label>
                      <textarea
                        required
                        rows={2}
                        placeholder="Enter customer address"
                        value={customerData.address}
                        onChange={(e) => setCustomerData({ ...customerData, address: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none resize-none"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-800 mb-1">
                        Payment Type <span className="text-red-500">*</span>
                      </label>
                      <select
                        required
                        value={customerData.paymentType}
                        onChange={(e) => setCustomerData({ ...customerData, paymentType: e.target.value })}
                        className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none ${
                          customerData.paymentType === '' ? 'text-gray-800 border-gray-200' : 'text-gray-900 border-gray-200'
                        }`}
                      >
                        <option value="" disabled>Select Payment Type</option>
                        <option value="Cash">💵 Cash</option>
                        <option value="UPI">📱 UPI</option>
                        <option value="Card">💳 Card</option>
                      </select>
                      {customerData.paymentType === '' && (
                        <p className="mt-1 text-xs text-gray-600">Please select a payment method</p>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-3 mt-6">
                    <button
                      type="submit"
                      className="flex-1 bg-red-600 text-white py-2.5 px-4 rounded-lg hover:bg-red-700 font-medium transition"
                    >
                      Save & Print
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowCheckoutPopup(false)}
                      className="flex-1 bg-white text-gray-800 py-2.5 px-4 rounded-lg hover:bg-white font-medium transition"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </>
        )}

        {/* Receipt Modal */}
        {showReceipt && receiptData && (
          <Receipt 
            saleData={receiptData}
            onClose={() => setShowReceipt(false)}
          />
        )}
    </div>
  );
}
