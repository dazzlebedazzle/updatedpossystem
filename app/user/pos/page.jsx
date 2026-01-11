'use client';

import { useState, useEffect, useCallback, useMemo, memo, useRef, useTransition, Component } from 'react';
import dynamic from 'next/dynamic';
import Layout from '@/components/Layout';
import { toast } from '@/lib/toast';
import SafeImage from '@/components/SafeImage';
import { categories as predefinedCategories, getCategoryImage } from '@/lib/categories';

// Error Boundary Component for catching errors in Receipt component
class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('Receipt component error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-bold text-red-900 mb-2">Error Loading Receipt</h3>
            <p className="text-red-800 mb-4">There was an error loading the receipt. Please try again.</p>
            <button
              onClick={() => {
                this.setState({ hasError: false, error: null });
                if (this.props.onClose) this.props.onClose();
              }}
              className="w-full bg-red-600 text-white py-2 px-4 rounded-lg hover:bg-red-700"
            >
              Close
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

// Dynamically import Receipt component to avoid webpack module loading issues with jsPDF
// This prevents the "Cannot read properties of undefined (reading 'call')" error
// The component will only be loaded when showReceipt is true, avoiding initial bundle issues
const Receipt = dynamic(
  () => import('@/components/Receipt').catch((error) => {
    console.error('Failed to load Receipt component:', error);
    // Return a fallback component
    return {
      default: ({ onClose }) => (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-bold text-red-900 mb-2">Error Loading Receipt</h3>
            <p className="text-red-800 mb-4">Failed to load receipt component. Please refresh the page.</p>
            <button
              onClick={onClose}
              className="w-full bg-red-600 text-white py-2 px-4 rounded-lg hover:bg-red-700"
            >
              Close
            </button>
          </div>
        </div>
      )
    };
  }),
  {
    ssr: false,
    loading: () => null // Don't show loading indicator, component will appear when ready
  }
);

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

export default function UserPOS() {
  const [products, setProducts] = useState([]);
  const [allProducts, setAllProducts] = useState([]); // Store all products for category calculation
  const [cart, setCart] = useState([]);
  const [loading, setLoading] = useState(true);
  const [initialLoadComplete, setInitialLoadComplete] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [isPending, startTransition] = useTransition(); // For smooth category switching
  const [isMounted, setIsMounted] = useState(false);
  const [error, setError] = useState(null);
  
  // Optimized category change handler
  const handleCategoryChange = useCallback((category) => {
    startTransition(() => {
      setSelectedCategory(category);
    });
  }, []);
  const [showCheckoutPopup, setShowCheckoutPopup] = useState(false);
  const [showReceipt, setShowReceipt] = useState(false);
  const [receiptData, setReceiptData] = useState(null);
  const [isProcessingCheckout, setIsProcessingCheckout] = useState(false);
  const [customerData, setCustomerData] = useState({
    name: '',
    mobile: '',
    address: '',
    paymentType: ''
  });

  const INITIAL_BATCH_SIZE = 30; // Show first 30 products immediately
  const hasFetchedRef = useRef(false); // Prevent multiple fetches
  const isFetchingRef = useRef(false); // Prevent concurrent fetches

  const processProducts = (allProducts) => {
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
    
    return uniqueProducts;
  };

  const fetchProducts = useCallback(async (force = false) => {
    // Prevent multiple concurrent fetches
    if (isFetchingRef.current && !force) {
      console.log('Fetch already in progress, skipping...');
      return;
    }
    
    // Prevent multiple initial fetches (unless forced)
    if (hasFetchedRef.current && !force) {
      console.log('Products already fetched, skipping...');
      return;
    }
    
    isFetchingRef.current = true;
    hasFetchedRef.current = true;
    
    try {
      setError(null);
      const response = await fetch('/api/products');
      
      if (!response.ok) {
        throw new Error(`Failed to fetch products: ${response.status} ${response.statusText}`);
      }
      
      let data;
      try {
        data = await response.json();
      } catch (jsonError) {
        throw new Error('Invalid JSON response from server');
      }
      
      const fetchedProducts = data.products || [];
      
      // Process all products
      const uniqueProducts = processProducts(fetchedProducts);
      
      // Store all products immediately for category calculation and filtering
      setAllProducts(uniqueProducts);
      
      // Load all products immediately to ensure complete categories and product list
      setProducts(uniqueProducts);
      setLoading(false);
      setInitialLoadComplete(true);
    } catch (error) {
      console.error('Error fetching products:', error);
      setError(error.message || 'Failed to load products. Please try again.');
      setLoading(false);
      setInitialLoadComplete(true);
      hasFetchedRef.current = false; // Allow retry on error
      toast.error('Failed to load products. Please refresh the page.');
    } finally {
      isFetchingRef.current = false;
    }
  }, [isMounted]);

  // Set mounted state to ensure client-side only rendering
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    setIsMounted(true);
    
    // Global error handler for unhandled promise rejections
    const handleUnhandledRejection = (event) => {
      console.error('Unhandled promise rejection:', event.reason);
      event.preventDefault(); // Prevent default browser error handling
      setError('An unexpected error occurred. Please refresh the page.');
    };
    
    // Global error handler for unhandled errors
    const handleError = (event) => {
      console.error('Unhandled error:', event.error);
      setError('An unexpected error occurred. Please refresh the page.');
    };
    
    window.addEventListener('unhandledrejection', handleUnhandledRejection);
    window.addEventListener('error', handleError);
    
    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('unhandledrejection', handleUnhandledRejection);
        window.removeEventListener('error', handleError);
      }
    };
  }, []);

  // Fetch products on mount only - use ref to ensure it only runs once
  useEffect(() => {
    if (!hasFetchedRef.current) {
      fetchProducts();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Empty dependency array - only run once on mount

  // Handle cart updates from scanner - separate effect that doesn't depend on products
  useEffect(() => {
    // Only run on client side
    if (typeof window === 'undefined') return;
    
    // Listen for cart updates from scanner
    const handleCartUpdate = (event) => {
      const cartItem = event.detail;
      console.log('Cart item received from scanner:', cartItem);
      
      // Use the cartItem data directly (it already has all needed info)
      setCart(prevCart => {
        const existingItem = prevCart.find(item => item.productId === cartItem.productId);
        if (existingItem) {
          return prevCart.map(item =>
            item.productId === cartItem.productId
              ? { ...item, quantity: item.quantity + cartItem.quantity }
              : item
          );
        } else {
          return [...prevCart, {
            productId: cartItem.productId,
            name: cartItem.name,
            price: cartItem.price,
            quantity: cartItem.quantity,
            unit: cartItem.unit,
            profit: cartItem.profit || 0,
            product_code: cartItem.product_code || '',
            discount: cartItem.discount || 0
          }];
        }
      });
      toast.success(`Product added to cart: ${cartItem.name}`);
    };
    
    window.addEventListener('cartUpdated', handleCartUpdate);
    
    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('cartUpdated', handleCartUpdate);
      }
    };
  }, []); // Empty dependency array - only set up listener once

  // Handle localStorage cart items - only run once after products are loaded
  useEffect(() => {
    // Only run on client side
    if (typeof window === 'undefined') return;
    if (!initialLoadComplete || products.length === 0 || !isMounted) return;
    
    try {
      const storedCart = localStorage.getItem('pos_cart');
      if (storedCart) {
        let cartItems;
        try {
          cartItems = JSON.parse(storedCart);
        } catch (parseError) {
          console.error('Error parsing cart from localStorage:', parseError);
          // Clear corrupted data
          localStorage.removeItem('pos_cart');
          return;
        }
        
        if (!Array.isArray(cartItems)) {
          console.warn('Cart data is not an array, clearing localStorage');
          localStorage.removeItem('pos_cart');
          return;
        }
        
        // Only add items that were added from scanner (have source: 'scanner')
        const scannerItems = cartItems.filter(item => item && item.source === 'scanner');
        if (scannerItems.length > 0) {
          // Process items directly from cartItem data (no need to find in products)
          scannerItems.forEach(cartItem => {
            if (!cartItem || !cartItem.productId) return;
            
            setCart(prevCart => {
              const existingItem = prevCart.find(item => item.productId === cartItem.productId);
              if (existingItem) {
                return prevCart.map(item =>
                  item.productId === cartItem.productId
                    ? { ...item, quantity: item.quantity + (cartItem.quantity || 0) }
                    : item
                );
              } else {
                return [...prevCart, {
                  productId: cartItem.productId,
                  name: cartItem.name || 'Unknown',
                  price: cartItem.price || 0,
                  quantity: cartItem.quantity || 0,
                  unit: cartItem.unit || 'kg',
                  profit: cartItem.profit || 0,
                  product_code: cartItem.product_code || '',
                  discount: cartItem.discount || 0
                }];
              }
            });
          });
          // Clear scanner items from localStorage after adding to cart
          const remainingItems = cartItems.filter(item => item && item.source !== 'scanner');
          try {
            localStorage.setItem('pos_cart', JSON.stringify(remainingItems));
          } catch (storageError) {
            console.error('Error saving to localStorage:', storageError);
          }
        }
      }
    } catch (error) {
      console.error('Error reading cart from localStorage:', error);
      // Don't crash the app, just log the error
    }
  }, [initialLoadComplete, products.length, isMounted]); // Only run when initial load is complete

  // Memoize unique products to avoid recalculating on every render
  // Use allProducts for category calculation, but products for display
  const uniqueProducts = useMemo(() => {
    const seenKeys = new Set();
    return products.filter(product => {
      if (!product) return false;
      const productId = product._id || product.id;
      const productEAN = product.EAN_code;
      const key = productId ? String(productId) : (productEAN ? String(productEAN) : null);
      
      if (!key || seenKeys.has(key)) return false;
      seenKeys.add(key);
      return true;
    });
  }, [products]);

  // Memoize categories calculation - use allProducts to show complete categories
  const categories = useMemo(() => {
    // Use allProducts for category calculation to show all categories
    const productsForCategories = allProducts.length > 0 ? allProducts : uniqueProducts;
    
    if (productsForCategories.length === 0) return [{ name: 'All', count: 0 }];
    
    const categoryMap = {};
    productsForCategories.forEach(product => {
      if (!product) return;
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
    
    const allCategory = { name: 'All', count: productsForCategories.length };
    return [allCategory, ...categoriesWithCount];
  }, [allProducts, uniqueProducts]);

  // Memoize filtered products with debounced search
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
  
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, 150);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Pre-compute category filter for faster filtering
  // Use allProducts for filtering to ensure all products are available
  const categoryFilterMap = useMemo(() => {
    const map = new Map();
    const productsForFiltering = allProducts.length > 0 ? allProducts : uniqueProducts;
    
    productsForFiltering.forEach(product => {
      if (!product) return;
      const category = (product.category || 'general').toLowerCase();
      if (!map.has(category)) {
        map.set(category, []);
      }
      map.get(category).push(product);
    });
    return map;
  }, [allProducts, uniqueProducts]);

  const filteredProducts = useMemo(() => {
    // Use allProducts for filtering to show all products, not just the initial batch
    const productsForFiltering = allProducts.length > 0 ? allProducts : uniqueProducts;
    
    // Fast path: All products, no search
    if (!debouncedSearchTerm && selectedCategory === 'All') {
      return productsForFiltering;
    }
    
    // Fast path: Category filter only (use pre-computed map)
    if (!debouncedSearchTerm && selectedCategory !== 'All') {
      const categoryLower = selectedCategory.toLowerCase();
      return categoryFilterMap.get(categoryLower) || [];
    }
    
    // Full filter: category + search
    const searchLower = debouncedSearchTerm.toLowerCase();
    const categoryLower = selectedCategory.toLowerCase();
    
    // Start with category-filtered products if category is selected
    const categoryProducts = selectedCategory === 'All' 
      ? productsForFiltering 
      : (categoryFilterMap.get(categoryLower) || []);
    
    // Then apply search filter
    if (!debouncedSearchTerm) return categoryProducts;
    
    return categoryProducts.filter(product => {
      if (!product) return false;
      const productName = (product.product_name || product.name || '').toLowerCase();
      const productEAN = (product.EAN_code || '').toString().toLowerCase();
      return productName.includes(searchLower) || productEAN.includes(searchLower);
    });
  }, [allProducts, uniqueProducts, debouncedSearchTerm, selectedCategory, categoryFilterMap]);

  const addToCart = useCallback((product) => {
    const availableStock = (product.qty || 0) - (product.qty_sold || 0);
    if (availableStock <= 0) {
      toast.error('Product out of stock');
      return;
    }

    const productId = product._id || product.id;
    const unit = product.unit || 'kg';
    const defaultQty = unit === 'kg' ? 100 : 1;

    setCart(prevCart => {
      const existingItem = prevCart.find(item => item.productId === productId);
      if (existingItem) {
        // Convert cart quantity to same unit as stock for comparison
        const newQtyInStockUnit = unit === 'kg' ? (existingItem.quantity + defaultQty) / 1000 : existingItem.quantity + defaultQty;
        
        if (newQtyInStockUnit > availableStock) {
          // Defer toast call to avoid state update during render
          setTimeout(() => {
            toast.error(`Insufficient stock. Only ${availableStock} ${unit} available`);
          }, 0);
          return prevCart;
        }
        // Defer toast call to avoid state update during render
        setTimeout(() => {
          toast.success('Quantity updated in cart');
        }, 0);
        return prevCart.map(item =>
          item.productId === productId
            ? { ...item, quantity: item.quantity + defaultQty }
            : item
        );
      } else {
        // Check if initial quantity exceeds stock
        const initialQtyInStockUnit = unit === 'kg' ? defaultQty / 1000 : defaultQty;
        if (initialQtyInStockUnit > availableStock) {
          // Defer toast call to avoid state update during render
          setTimeout(() => {
            toast.error(`Insufficient stock. Only ${availableStock} ${unit} available`);
          }, 0);
          return prevCart;
        }
        
        // Defer toast call to avoid state update during render
        setTimeout(() => {
          toast.success('Product added to cart');
        }, 0);
        return [...prevCart, {
          productId: productId,
          name: product.product_name || product.name,
          price: product.price || 0,
          quantity: defaultQty,
          unit: unit,
          profit: product.profit || 0,
          product_code: product.EAN_code || '',
          discount: product.discount || 0
        }];
      }
    });
  }, []);

  const removeFromCart = useCallback((productId) => {
    setCart(prevCart => prevCart.filter(item => item.productId !== productId));
    // Defer toast call to avoid state update during render
    setTimeout(() => {
      toast.success('Item removed from cart');
    }, 0);
  }, []);

  const updateQuantity = useCallback((productId, quantity) => {
    // Never remove items from cart - allow 0 quantity to stay in cart
    setCart(prevCart => {
      const cartItem = prevCart.find(item => item.productId === productId);
      if (!cartItem) return prevCart;
      
      // Allow 0 quantity - don't remove from cart
      const finalQuantity = quantity < 0 ? 0 : quantity;
      
      // Search in allProducts first, then fallback to uniqueProducts
      const product = (allProducts.length > 0 ? allProducts : uniqueProducts).find(p => (p._id || p.id) === productId);
      if (product && finalQuantity > 0) {
        const availableStock = (product.qty || 0) - (product.qty_sold || 0);
        const unit = cartItem.unit || 'kg';
        
        // Convert quantity to same unit as stock for comparison
        const quantityInStockUnit = unit === 'kg' ? finalQuantity / 1000 : finalQuantity;
        
        if (quantityInStockUnit > availableStock) {
          // Defer toast call to avoid state update during render
          setTimeout(() => {
            toast.error(`Only ${availableStock} ${unit} available in stock`);
          }, 0);
          return prevCart;
        }
      }
      
      return prevCart.map(item =>
        item.productId === productId
          ? { ...item, quantity: finalQuantity }
          : item
      );
    });
  }, [uniqueProducts, allProducts]);

  const getTotal = useMemo(() => {
    return cart.reduce((sum, item) => {
      const qtyInUnit = item.unit === 'kg' ? item.quantity / 1000 : item.quantity;
      return sum + (item.price * qtyInUnit);
    }, 0);
  }, [cart]);

  const handleCheckout = async () => {
    // Prevent multiple submissions
    if (isProcessingCheckout) {
      return;
    }

    if (cart.length === 0) {
      toast.warning('Cart is empty');
      return;
    }

    if (!customerData.name || !customerData.mobile || !customerData.address || !customerData.paymentType) {
      toast.error('Please fill all customer details');
      return;
    }

    setIsProcessingCheckout(true);

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
        
        if (!customerResponse.ok) {
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

      if (!response.ok) {
        let errorMessage = 'Checkout failed';
        try {
          const errorData = await response.json();
          errorMessage = errorData.error || errorMessage;
        } catch (e) {
          errorMessage = `Server error: ${response.status} ${response.statusText}`;
        }
        toast.error(errorMessage);
        return;
      }

      let data;
      try {
        data = await response.json();
      } catch (jsonError) {
        throw new Error('Invalid response from server');
      }

      if (!data || !data.sale) {
        throw new Error('Invalid sale data received');
      }

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
          name: item.name || 'Unknown',
          quantity: item.quantity || 0,
          unit: item.unit || 'kg',
          price: item.price || 0,
          total: ((item.unit === 'kg' ? item.quantity / 1000 : item.quantity) || 0) * (item.price || 0)
        })),
        subtotal: getTotal,
        total: getTotal
      };
      
      setReceiptData(receipt);
      setShowCheckoutPopup(false);
      setShowReceipt(true);
      setCart([]);
      setCustomerData({ name: '', mobile: '', address: '', paymentType: '' });
      
      // Force refresh after checkout
      if (isMounted) {
        fetchProducts(true);
      }
    } catch (error) {
      console.error('Error during checkout:', error);
      toast.error(error.message || 'Checkout failed. Please try again.');
    } finally {
      setIsProcessingCheckout(false);
    }
  };

  const getCategoryIcon = useCallback((categoryName) => {
    return categoryIcons[categoryName.toLowerCase()] || '📦';
  }, []);

  const getProductImage = useCallback((product) => {
    if (product.images) {
      return `/assets/category_images/${product.images}`;
    }
    return null;
  }, []);

  // Show error state if there's a critical error
  if (error && !initialLoadComplete) {
    return (
      <Layout userRole="user">
        <div className="px-4 py-6 sm:px-0">
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <h2 className="text-lg font-semibold text-red-900 mb-2">Error Loading Products</h2>
            <p className="text-red-800 mb-4">{error}</p>
            <button
              onClick={() => {
                setError(null);
                hasFetchedRef.current = false;
                fetchProducts(true);
              }}
              className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700"
            >
              Retry
            </button>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout userRole="user">
      <POSContent 
        products={products}
        cart={cart}
        loading={loading}
        initialLoadComplete={initialLoadComplete}
        searchTerm={searchTerm}
        setSearchTerm={setSearchTerm}
        selectedCategory={selectedCategory}
        setSelectedCategory={handleCategoryChange}
        isPending={isPending}
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
        isProcessingCheckout={isProcessingCheckout}
        getProductImage={getProductImage}
        getCategoryIcon={getCategoryIcon}
        showReceipt={showReceipt}
        setShowReceipt={setShowReceipt}
        receiptData={receiptData}
        isMounted={isMounted}
      />
    </Layout>
  );
}

// Memoized Product Card Component for better performance
const ProductCard = memo(({ product, addToCart, getProductImage }) => {
  const availableStock = (product.qty || 0) - (product.qty_sold || 0);
  const productImage = getProductImage(product);
  
  return (
    <div
      style={{ willChange: 'transform' }}
      className={`bg-white border border-gray-200 rounded-lg p-1.5 sm:p-2 md:p-2.5 shadow-sm transition-all duration-150 touch-manipulation w-full max-w-full overflow-hidden ${
        availableStock > 0
          ? 'hover:shadow-md active:scale-[0.98] cursor-pointer'
          : 'opacity-50 cursor-not-allowed'
      }`}
    >
      {/* Product Image - Clickable */}
      <div 
        onClick={() => availableStock > 0 && addToCart(product)}
        className="mb-1.5 sm:mb-2 cursor-pointer relative w-full bg-gray-50 rounded-md overflow-hidden z-0"
        style={{ 
          aspectRatio: '4/3',
          minHeight: '100px'
        }}
      >
        {productImage ? (
          <SafeImage
            src={productImage}
            alt={product.product_name || product.name}
            fill
            className="object-cover object-center relative z-0"
            sizes="(max-width: 640px) 50vw, (max-width: 768px) 33vw, (max-width: 1024px) 25vw, 20vw"
            fallback={
              <div className="absolute inset-0 w-full h-full bg-gray-50 rounded-md flex items-center justify-center z-0">
                <span className="text-2xl sm:text-3xl md:text-4xl">📦</span>
              </div>
            }
          />
        ) : (
          <div className="absolute inset-0 w-full h-full bg-gray-50 rounded-md flex items-center justify-center z-0">
            <span className="text-2xl sm:text-3xl md:text-4xl">📦</span>
          </div>
        )}
      </div>
      
      <h3 className="font-medium text-[9px] sm:text-[10px] md:text-xs text-gray-900 mb-1 sm:mb-1.5 break-words line-clamp-2 min-h-[2em]" title={product.product_name || product.name}>
        {product.product_name || product.name}
      </h3>
      <p className="text-[10px] sm:text-xs md:text-sm font-bold text-purple-600 mb-1.5 sm:mb-2">
        ₹{product.price || 0} <span className="text-[9px] sm:text-[10px] md:text-xs">{product.unit === 'packets' ? '/pkt' : '/kg'}</span>
      </p>
      <button
        onClick={() => addToCart(product)}
        disabled={availableStock <= 0}
        className="w-full bg-red-600 text-white py-1.5 sm:py-2 md:py-2.5 rounded-lg hover:bg-red-700 active:bg-red-800 disabled:bg-gray-200 disabled:cursor-not-allowed text-[9px] sm:text-[10px] md:text-xs font-medium transition touch-manipulation"
      >
        Add to Cart
      </button>
    </div>
  );
});

ProductCard.displayName = 'ProductCard';

// Quantity Input Component with local state to allow empty values during editing
const QuantityInput = memo(({ productId, quantity, unit, updateQuantity, className }) => {
  const [localValue, setLocalValue] = useState(String(quantity));
  const inputRef = useRef(null);
  
  // Get default minimum quantity based on unit
  const getMinQuantity = () => {
    return unit === 'kg' ? 100 : 1;
  };

  // Sync local value when quantity changes from outside (e.g., +/- buttons)
  useEffect(() => {
    setLocalValue(String(quantity));
  }, [quantity]);

  const handleChange = (e) => {
    const inputValue = e.target.value;
    setLocalValue(inputValue); // Allow empty string in local state
    
    // Only update cart if we have a valid number
    if (inputValue !== '') {
      const value = parseInt(inputValue);
      if (!isNaN(value) && value >= 0) {
        updateQuantity(productId, value);
      }
    }
  };

  const handleBlur = (e) => {
    const inputValue = e.target.value;
    const minQty = getMinQuantity();
    
    // If field is empty or invalid on blur, set to default minimum quantity (keep in cart)
    if (inputValue === '' || isNaN(parseInt(inputValue))) {
      setLocalValue(String(minQty));
      updateQuantity(productId, minQty);
      return;
    }
    
    const value = parseInt(inputValue);
    
    // If value is less than 0, set to minimum quantity (keep in cart)
    if (value < 0) {
      setLocalValue(String(minQty));
      updateQuantity(productId, minQty);
      return;
    }
    
    // Allow 0 quantity - don't remove from cart
    // Update the cart with the value (can be 0 or positive)
    if (value !== quantity) {
      updateQuantity(productId, value);
    }
  };

  return (
    <input
      ref={inputRef}
      type="number"
      value={localValue}
      onChange={handleChange}
      onBlur={handleBlur}
      className={className}
      min="0"
    />
  );
});

QuantityInput.displayName = 'QuantityInput';

function POSContent({ 
  products, 
  cart, 
  loading,
  initialLoadComplete = true,
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
  isProcessingCheckout,
  getProductImage,
  getCategoryIcon,
  showReceipt,
  setShowReceipt,
  receiptData,
  isMounted = false,
  isPending = false
}) {
  const [showCartMobile, setShowCartMobile] = useState(false);

  return (
    <div className="h-[calc(100vh-3.75rem)] sm:h-[calc(100vh-4rem)] md:h-[calc(100vh-5rem)] lg:h-[calc(100vh-0rem)] flex flex-col lg:flex-row bg-white overflow-hidden overflow-x-hidden max-w-full -m-3 sm:-m-4 md:-m-6 relative z-0" style={{ 
      width: '100%',
      maxWidth: '100%',
      marginLeft: '0',
      marginRight: '0'
    }}>
      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden overflow-x-hidden min-w-0 w-full max-w-full lg:w-auto relative z-0">
          {/* Search Bar */}
          <div className="bg-white shadow-sm p-2 sm:p-3 md:p-4 flex-shrink-0 border-b w-full max-w-full overflow-x-hidden relative z-10">
            <form 
              onSubmit={(e) => {
                e.preventDefault();
              }}
              className="flex items-center gap-2 sm:gap-2.5 md:gap-3 w-full max-w-full"
            >
              <input
                type="text"
                placeholder="Search product..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="flex-1 min-w-0 px-2.5 sm:px-3 md:px-4 py-2 sm:py-2.5 text-xs sm:text-sm md:text-base text-gray-800 border border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none placeholder:text-gray-500"
              />
              <button
                type="submit"
                className="bg-purple-600 text-white px-3 sm:px-4 md:px-6 py-2 sm:py-2.5 rounded-lg hover:bg-purple-700 active:bg-purple-800 transition font-medium text-xs sm:text-sm md:text-base whitespace-nowrap touch-manipulation"
              >
                <span className="hidden sm:inline">Search</span>
                <span className="sm:hidden">🔍</span>
              </button>
              {/* Mobile Cart Button */}
              <button
                type="button"
                onClick={() => setShowCartMobile(true)}
                className="lg:hidden relative bg-purple-600 text-white px-3 sm:px-4 py-2 sm:py-2.5 rounded-lg hover:bg-purple-700 active:bg-purple-800 transition font-medium touch-manipulation"
                aria-label="Open cart"
              >
                <span className="text-base sm:text-lg">🛒</span>
                {cart.length > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 bg-red-600 text-white text-[10px] sm:text-xs rounded-full w-4 h-4 sm:w-5 sm:h-5 flex items-center justify-center font-bold">
                    {cart.length}
                  </span>
                )}
              </button>
            </form>
          </div>

          {/* Category Cards - Horizontal Scrollable */}
          <div className="bg-white border-b shadow-sm px-2 sm:px-3 md:px-4 py-2 sm:py-2.5 md:py-3 flex-shrink-0 w-full max-w-full overflow-x-hidden relative z-10">
            <div className="overflow-x-auto scrollbar-hide w-full">
              <div className="flex gap-1.5 sm:gap-2 md:gap-2.5 pb-2" style={{ width: 'max-content' }}>
                {categories.map((category) => {
                  const categoryName = category.name || category;
                  const isSelected = selectedCategory === categoryName;
                  const categoryImage = category.image || getCategoryImage(categoryName);
                  return (
                    <button
                      key={categoryName}
                      onClick={() => setSelectedCategory(categoryName)}
                      style={{ willChange: 'transform' }} // Optimize for animations
                      className={`flex flex-col items-center gap-1 sm:gap-1.5 px-2 sm:px-2.5 md:px-3 py-1.5 sm:py-2 rounded-lg md:rounded-xl whitespace-nowrap transition-all duration-150 min-w-[55px] sm:min-w-[60px] md:min-w-[70px] flex-shrink-0 touch-manipulation ${
                        isSelected
                          ? 'bg-purple-600 text-white shadow-lg scale-105'
                          : 'bg-amber-50 text-gray-800 hover:bg-amber-100 active:bg-amber-200 shadow-sm border border-amber-200'
                      } ${isPending && isSelected ? 'opacity-75' : ''}`}
                    >
                      <div className={`w-7 h-7 sm:w-8 sm:h-8 md:w-10 md:h-10 rounded-lg flex items-center justify-center overflow-hidden relative ${
                        isSelected ? 'bg-white/20' : 'bg-white'
                      }`}>
                        {categoryImage ? (
                          <SafeImage
                            src={categoryImage}
                            alt={categoryName}
                            fill
                            className="object-cover"
                            fallback={
                              <div className="w-full h-full flex items-center justify-center text-base sm:text-lg md:text-xl">
                                {getCategoryIcon(categoryName)}
                              </div>
                            }
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-base sm:text-lg md:text-xl">
                            {getCategoryIcon(categoryName)}
                          </div>
                        )}
                      </div>
                      <span className="capitalize font-medium text-[9px] sm:text-[10px] md:text-xs leading-tight text-center">{categoryName}</span>
                      {category.count !== undefined && category.count > 0 && (
                        <span className={`text-[8px] sm:text-[9px] md:text-[10px] ${isSelected ? 'text-white/90' : 'text-gray-600'}`}>
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
          <div className="flex-1 overflow-y-auto overflow-x-hidden p-2 sm:p-3 md:p-4 w-full max-w-full relative z-10">
            {!initialLoadComplete && loading ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7 gap-2 sm:gap-2.5 md:gap-3 lg:gap-4 w-full max-w-full">
                {[...Array(10)].map((_, index) => (
                  <div key={index} className="bg-white border border-gray-200 rounded-lg p-1.5 sm:p-2 shadow-sm animate-pulse">
                    {/* Image Skeleton */}
                    <div className="w-full h-12 sm:h-14 md:h-16 bg-gray-200 rounded-md mb-1.5 sm:mb-2"></div>
                    {/* Title Skeleton */}
                    <div className="h-3 sm:h-3.5 bg-gray-200 rounded w-3/4 mb-1"></div>
                    <div className="h-3 sm:h-3.5 bg-gray-200 rounded w-1/2 mb-1.5 sm:mb-2"></div>
                    {/* Price Skeleton */}
                    <div className="h-4 sm:h-5 bg-gray-200 rounded w-2/3 mb-1.5 sm:mb-2"></div>
                    {/* Button Skeleton */}
                    <div className="h-7 sm:h-8 bg-gray-200 rounded w-full"></div>
                  </div>
                ))}
              </div>
            ) : filteredProducts.length === 0 ? (
              <div className="text-center py-8 sm:py-12 text-gray-800 text-xs sm:text-sm md:text-base">No products found</div>
            ) : (
              <div 
                className={`grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7 gap-2 sm:gap-2.5 md:gap-3 lg:gap-4 w-full max-w-full ${isPending ? 'opacity-75' : 'opacity-100'} transition-opacity duration-150`}
                style={{ willChange: 'contents' }}
              >
                {filteredProducts.map((product) => (
                  <ProductCard
                    key={product._id || product.id}
                    product={product}
                    addToCart={addToCart}
                    getProductImage={getProductImage}
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Shopping Cart Sidebar - Desktop */}
        <div className="hidden lg:flex bg-white shadow-lg border-l flex-col flex-shrink-0" style={{ width: 'clamp(300px, 25%, 400px)', minWidth: '300px', maxWidth: '400px' }}>
          <div className="p-3 md:p-4 border-b flex-shrink-0">
            <h2 className="text-base md:text-lg font-bold text-gray-900 flex items-center gap-2">
              <span>🛒</span> Cart
            </h2>
          </div>

          <div className="flex-1 overflow-y-auto min-h-0 p-2 md:p-3">
            {cart.length === 0 ? (
              <div className="p-4 md:p-6 text-center text-gray-800">
                <p className="text-sm md:text-base">Cart is empty</p>
              </div>
            ) : (
              <div className="space-y-2 md:space-y-2.5">
                {cart.map((item) => {
                  const product = products.find(p => (p._id || p.id) === item.productId);
                  const availableStock = product ? (product.qty || 0) - (product.qty_sold || 0) : 0;
                  const qtyInUnit = item.unit === 'kg' ? item.quantity / 1000 : item.quantity;
                  const itemTotal = item.price * qtyInUnit;
                  
                  return (
                    <div key={item.productId} className="bg-white rounded-lg p-2 md:p-2.5 border border-gray-200">
                      <div className="flex justify-between items-start mb-1.5 md:mb-2">
                        <div className="flex-1 min-w-0 pr-2">
                          <h4 className="font-medium text-xs md:text-sm text-gray-900 mb-0.5 truncate">{item.name}</h4>
                          <p className="text-[10px] md:text-xs text-gray-600">Available: {availableStock} {item.unit}</p>
                        </div>
                        <button
                          onClick={() => removeFromCart(item.productId)}
                          className="text-red-600 hover:text-red-800 active:text-red-900 text-sm md:text-base font-medium touch-manipulation flex-shrink-0"
                          aria-label="Remove item"
                        >
                          ✕
                        </button>
                      </div>
                      
                      <div className="flex items-center justify-between mt-2">
                        <div className="flex items-center gap-1.5 md:gap-2">
                          <button
                            onClick={() => updateQuantity(item.productId, item.quantity - (item.unit === 'kg' ? 100 : 1))}
                            className="w-6 h-6 md:w-7 md:h-7 rounded bg-gray-200 hover:bg-gray-300 active:bg-gray-400 text-sm font-bold touch-manipulation"
                            aria-label="Decrease quantity"
                          >
                            -
                          </button>
                          <div className="flex items-center">
                            <QuantityInput
                              productId={item.productId}
                              quantity={item.quantity}
                              unit={item.unit}
                              updateQuantity={updateQuantity}
                              className="w-14 md:w-16 text-xs md:text-sm text-center font-medium text-gray-800 border border-gray-200 rounded px-1 py-1 focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none"
                            />
                            <span className="text-[10px] md:text-xs ml-1 text-gray-600">
                              {item.unit === 'kg' ? 'g' : 'pcs'}
                            </span>
                          </div>
                          <button
                            onClick={() => updateQuantity(item.productId, item.quantity + (item.unit === 'kg' ? 100 : 1))}
                            disabled={qtyInUnit >= availableStock}
                            className="w-6 h-6 md:w-7 md:h-7 rounded bg-gray-200 hover:bg-gray-300 active:bg-gray-400 disabled:bg-gray-100 disabled:cursor-not-allowed text-sm font-bold touch-manipulation"
                            aria-label="Increase quantity"
                          >
                            +
                          </button>
                        </div>
                        <span className="text-xs md:text-sm font-bold text-gray-900 ml-2">₹{itemTotal.toFixed(2)}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Cart Footer */}
          <div className="border-t p-3 md:p-4 bg-white flex-shrink-0">
            <div className="mb-2 md:mb-3">
              <div className="flex justify-between items-center">
                <span className="text-sm md:text-base lg:text-lg font-bold text-gray-900">Total:</span>
                <span className="text-lg md:text-xl lg:text-2xl font-bold text-purple-600">₹{getTotal.toFixed(2)}</span>
              </div>
            </div>
            <button
              onClick={() => setShowCheckoutPopup(true)}
              disabled={cart.length === 0}
              className="w-full bg-red-600 text-white py-2.5 md:py-3 px-4 rounded-lg hover:bg-red-700 active:bg-red-800 disabled:opacity-50 disabled:cursor-not-allowed font-medium transition text-sm md:text-base touch-manipulation"
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
            <div className="lg:hidden fixed bottom-0 left-0 right-0 bg-white shadow-2xl rounded-t-2xl flex flex-col z-50" style={{ maxHeight: '85vh', height: 'auto' }}>
              <div className="p-3 sm:p-4 border-b flex-shrink-0 flex items-center justify-between">
                <h2 className="text-base sm:text-lg font-bold text-gray-900 flex items-center gap-2">
                  <span>🛒</span> Cart ({cart.length})
                </h2>
                <button
                  onClick={() => setShowCartMobile(false)}
                  className="text-gray-800 hover:text-gray-900 active:text-gray-700 text-2xl sm:text-3xl touch-manipulation"
                  aria-label="Close cart"
                >
                  ×
                </button>
              </div>

              <div className="flex-1 overflow-y-auto min-h-0 p-3 sm:p-4">
                {cart.length === 0 ? (
                  <div className="p-6 sm:p-8 text-center text-gray-800 text-sm sm:text-base">
                    <p>Cart is empty</p>
                  </div>
                ) : (
                  <div className="space-y-2.5 sm:space-y-3">
                    {cart.map((item) => {
                      const product = products.find(p => (p._id || p.id) === item.productId);
                      const availableStock = product ? (product.qty || 0) - (product.qty_sold || 0) : 0;
                      const qtyInUnit = item.unit === 'kg' ? item.quantity / 1000 : item.quantity;
                      const itemTotal = item.price * qtyInUnit;
                      
                      return (
                        <div key={item.productId} className="bg-white rounded-lg p-3 sm:p-3.5 border border-gray-200">
                          <div className="flex justify-between items-start mb-2 sm:mb-2.5">
                            <div className="flex-1 min-w-0 pr-2">
                              <h4 className="font-medium text-sm sm:text-base text-gray-900 mb-1 truncate">{item.name}</h4>
                              <p className="text-xs text-gray-600">Available: {availableStock} {item.unit}</p>
                            </div>
                            <button
                              onClick={() => removeFromCart(item.productId)}
                              className="text-red-600 hover:text-red-800 active:text-red-900 text-lg sm:text-xl font-medium ml-2 touch-manipulation flex-shrink-0"
                              aria-label="Remove item"
                            >
                              ✕
                            </button>
                          </div>
                          
                          <div className="flex items-center justify-between mt-2.5">
                            <div className="flex items-center gap-2 sm:gap-2.5">
                              <button
                                onClick={() => updateQuantity(item.productId, item.quantity - (item.unit === 'kg' ? 100 : 1))}
                                className="w-8 h-8 sm:w-9 sm:h-9 rounded bg-gray-200 hover:bg-gray-300 active:bg-gray-400 text-base sm:text-lg font-bold touch-manipulation"
                                aria-label="Decrease quantity"
                              >
                                -
                              </button>
                              <div className="flex items-center">
                                <QuantityInput
                                  productId={item.productId}
                                  quantity={item.quantity}
                                  unit={item.unit}
                                  updateQuantity={updateQuantity}
                                  className="w-16 sm:w-20 text-sm sm:text-base text-center font-medium text-gray-800 border border-gray-200 rounded px-1.5 py-1.5 focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none"
                                />
                                <span className="text-xs sm:text-sm ml-1.5 text-gray-600">
                                  {item.unit === 'kg' ? 'g' : 'pcs'}
                                </span>
                              </div>
                              <button
                                onClick={() => updateQuantity(item.productId, item.quantity + (item.unit === 'kg' ? 100 : 1))}
                                disabled={qtyInUnit >= availableStock}
                                className="w-8 h-8 sm:w-9 sm:h-9 rounded bg-gray-200 hover:bg-gray-300 active:bg-gray-400 disabled:bg-gray-100 disabled:cursor-not-allowed text-base sm:text-lg font-bold touch-manipulation"
                                aria-label="Increase quantity"
                              >
                                +
                              </button>
                            </div>
                            <span className="text-sm sm:text-base font-bold text-gray-900 ml-3">₹{itemTotal.toFixed(2)}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="border-t p-3 sm:p-4 bg-white flex-shrink-0 safe-area-bottom">
                <div className="mb-3 sm:mb-4">
                  <div className="flex justify-between items-center">
                    <span className="text-base sm:text-lg font-bold text-gray-900">Total:</span>
                    <span className="text-xl sm:text-2xl font-bold text-purple-600">₹{getTotal.toFixed(2)}</span>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setShowCartMobile(false);
                    setShowCheckoutPopup(true);
                  }}
                  disabled={cart.length === 0}
                  className="w-full bg-red-600 text-white py-3 sm:py-3.5 px-4 rounded-lg hover:bg-red-700 active:bg-red-800 disabled:opacity-50 disabled:cursor-not-allowed font-medium transition text-sm sm:text-base touch-manipulation"
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
            <div className="fixed inset-0 flex items-center justify-center z-50 p-3 sm:p-4 md:p-6">
              <div 
                className="bg-white rounded-lg sm:rounded-xl shadow-xl max-w-md w-full p-4 sm:p-5 md:p-6 max-h-[90vh] overflow-y-auto"
                onClick={(e) => e.stopPropagation()}
              >
                <h3 className="text-lg sm:text-xl font-bold text-gray-900 mb-4 sm:mb-5">Customer Details</h3>
                <form onSubmit={(e) => { e.preventDefault(); handleCheckout(); }}>
                  <div className="space-y-3 sm:space-y-4">
                    <div>
                      <label className="block text-xs sm:text-sm font-medium text-gray-800 mb-1.5">
                        Name <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="Enter customer name"
                        value={customerData.name}
                        onChange={(e) => setCustomerData({ ...customerData, name: e.target.value })}
                        className="w-full px-3 py-2 sm:py-2.5 text-sm sm:text-base text-gray-800 border border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none placeholder:text-gray-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs sm:text-sm font-medium text-gray-800 mb-1.5">
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
                        className="w-full px-3 py-2 sm:py-2.5 text-sm sm:text-base text-gray-800 border border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none placeholder:text-gray-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs sm:text-sm font-medium text-gray-800 mb-1.5">
                        Address <span className="text-red-500">*</span>
                      </label>
                      <textarea
                        required
                        rows={3}
                        placeholder="Enter customer address"
                        value={customerData.address}
                        onChange={(e) => setCustomerData({ ...customerData, address: e.target.value })}
                        className="w-full px-3 py-2 sm:py-2.5 text-sm sm:text-base text-gray-800 border border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none resize-none placeholder:text-gray-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs sm:text-sm font-medium text-gray-800 mb-1.5">
                        Payment Type <span className="text-red-500">*</span>
                      </label>
                      <select
                        required
                        value={customerData.paymentType}
                        onChange={(e) => setCustomerData({ ...customerData, paymentType: e.target.value })}
                        className={`w-full px-3 py-2 sm:py-2.5 text-sm sm:text-base border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none ${
                          customerData.paymentType === '' ? 'text-gray-500 border-gray-200' : 'text-gray-900 border-gray-200'
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
                  <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 mt-5 sm:mt-6">
                    <button
                      type="submit"
                      disabled={isProcessingCheckout}
                      className="flex-1 bg-red-600 text-white py-2.5 sm:py-3 px-4 rounded-lg hover:bg-red-700 active:bg-red-800 disabled:bg-red-400 disabled:cursor-not-allowed font-medium transition text-sm sm:text-base touch-manipulation flex items-center justify-center gap-2"
                    >
                      {isProcessingCheckout ? (
                        <>
                          <svg className="animate-spin h-4 w-4 sm:h-5 sm:w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          <span>Processing...</span>
                        </>
                      ) : (
                        'Save & Print'
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowCheckoutPopup(false)}
                      className="flex-1 bg-white text-gray-800 py-2.5 sm:py-3 px-4 rounded-lg hover:bg-gray-50 active:bg-gray-100 font-medium transition border border-gray-200 text-sm sm:text-base touch-manipulation"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </>
        )}

        {/* Receipt Modal - Only render when mounted and receipt data is available */}
        {isMounted && showReceipt && receiptData && (
          <ErrorBoundary onClose={() => setShowReceipt(false)}>
            <Receipt 
              saleData={receiptData}
              onClose={() => setShowReceipt(false)}
            />
          </ErrorBoundary>
        )}
    </div>
  );
}
