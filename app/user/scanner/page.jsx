'use client';

import { useState, useRef, useEffect } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import Layout from '@/components/Layout';
import { Html5Qrcode } from 'html5-qrcode';
import { createWorker } from 'tesseract.js';
import { toast } from '@/lib/toast';
import { authenticatedFetch } from '@/lib/api-client';

export default function ScannerPage() {
  const router = useRouter();
  const [scanning, setScanning] = useState(false);
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [scannedData, setScannedData] = useState({
    barcode: '',
    productName: '',
    weight: '',
    pricePerKg: '',
    totalPrice: ''
  });
  const [processing, setProcessing] = useState(false);
  const [savedScans, setSavedScans] = useState([]);
  const [cameraPermissionStatus, setCameraPermissionStatus] = useState('prompt'); // 'prompt', 'granted', 'denied'
  const html5QrCodeRef = useRef(null);
  const videoRef = useRef(null);
  const [autoScanMode, setAutoScanMode] = useState(false); // Auto-scan mode for OCR
  const [userRole, setUserRole] = useState('user'); // Default to user

  useEffect(() => {
    fetchSavedScans();
    checkCameraPermission();
    
    // Get user role for navigation
    fetch('/api/auth/me')
      .then(res => res.json())
      .then(data => {
        if (data.user && data.user.role) {
          setUserRole(data.user.role);
        }
      })
      .catch(err => console.error('Error fetching user role:', err));
  }, []);

  const checkCameraPermission = async () => {
    // Check permission status using Permissions API if available (non-intrusive check)
    if (navigator.permissions && navigator.permissions.query) {
      try {
        const result = await navigator.permissions.query({ name: 'camera' });
        setCameraPermissionStatus(result.state);
        
        // Listen for permission changes
        result.onchange = () => {
          setCameraPermissionStatus(result.state);
        };
      } catch (e) {
        // Permissions API might not support 'camera' in all browsers
        // Don't try to access camera here - wait for user action
        console.log('Permission API check not available:', e);
      }
    }
    // Don't try to access camera on page load - wait for user to click button
  };

  const openCameraSettings = () => {
    // Try to open browser's camera settings page
    const userAgent = navigator.userAgent.toLowerCase();
    if (userAgent.includes('chrome') || userAgent.includes('edg')) {
      // Chrome/Edge settings URL
      window.open('chrome://settings/content/camera', '_blank');
      toast.info('Camera settings opened. Look for "localhost:3000" in the "Customized behaviors" section and set it to "Allow"', { duration: 6000 });
    } else if (userAgent.includes('firefox')) {
      // Firefox settings
      window.open('about:preferences#privacy', '_blank');
    } else {
      toast.info('Please go to your browser settings → Privacy → Camera');
    }
  };

  const resetPermissionAndRetry = async () => {
    // This function helps guide users to reset blocked permissions
    const userAgent = navigator.userAgent.toLowerCase();
    
    if (userAgent.includes('chrome') || userAgent.includes('edg')) {
      toast.info(
        'To reset blocked permissions: Open camera settings, find "localhost:3000", click the X to remove it, then refresh this page and try again.',
        { duration: 8000 }
      );
      openCameraSettings();
    } else {
      toast.info('Please go to browser settings and remove the blocked permission for this site, then refresh the page.');
    }
  };

  const getBrowserInstructions = () => {
    const userAgent = navigator.userAgent.toLowerCase();
    if (userAgent.includes('chrome') || userAgent.includes('edg')) {
      return {
        title: 'Chrome/Edge Instructions',
        steps: [
          'Go to Settings → Privacy and security → Site settings → Camera (or use the address bar: chrome://settings/content/camera)',
          'Check the "Customized behaviors" section at the bottom',
          'Look for "localhost:3000" or "127.0.0.1:3000" in the list',
          'If you see it listed as "Not allowed", click on it and change to "Allow"',
          'If the site is NOT in the list, go back to the scanner page and click "Start Camera" - this will add it to the list',
          'After making changes, refresh the scanner page'
        ],
        detailed: [
          {
            title: 'Method 1: Via Address Bar Icon',
            steps: [
              'Click the lock/camera icon in the address bar (left side of the URL)',
              'Click "Camera" in the dropdown',
              'Change from "Block" to "Allow"',
              'Refresh the page'
            ]
          },
          {
            title: 'Method 2: Via Settings Page',
            steps: [
              'Click the three dots menu (⋮) in the top right',
              'Go to Settings → Privacy and security → Site settings → Camera',
              'Scroll down to "Customized behaviors" section',
              'Find "localhost:3000" or "127.0.0.1:3000"',
              'If it shows "Not allowed", click it and select "Allow"',
              'If it\'s not listed, go back to the scanner page, click "Start Camera", then return here to set it to "Allow"',
              'Refresh the scanner page'
            ]
          }
        ]
      };
    } else if (userAgent.includes('firefox')) {
      return {
        title: 'Firefox Instructions',
        steps: [
          'Click the lock/camera icon in the address bar',
          'Or go to Menu (☰) → Settings → Privacy & Security → Permissions → Camera → Settings',
          'Find "localhost:3000" and set it to "Allow"',
          'Refresh this page'
        ]
      };
    } else if (userAgent.includes('safari')) {
      return {
        title: 'Safari Instructions',
        steps: [
          'Go to Safari → Settings → Websites → Camera',
          'Find "localhost:3000" and set it to "Allow"',
          'Refresh this page'
        ]
      };
    }
    return {
      title: 'General Instructions',
      steps: [
        'Look for a camera/lock icon in your browser\'s address bar',
        'Click it and select "Allow" for camera access',
        'If no icon appears, go to your browser settings → Privacy → Camera',
        'Find this site and enable camera access',
        'Refresh this page'
      ]
    };
  };

  const fetchSavedScans = async () => {
    try {
      const response = await authenticatedFetch('/api/scanner');
      if (response.ok) {
        const data = await response.json();
        setSavedScans(data.scannedData || []);
      }
    } catch (error) {
      console.error('Error fetching saved scans:', error);
    }
  };

  const startCamera = async () => {
    // Check if camera API is available
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      toast.error('Camera access is not supported in this browser. Please use a modern browser like Chrome, Firefox, or Edge.');
      return;
    }

    // Stop any existing camera instance
    if (html5QrCodeRef.current) {
      try {
        await html5QrCodeRef.current.stop();
        html5QrCodeRef.current.clear();
        html5QrCodeRef.current = null;
      } catch (e) {
        console.log('Error stopping existing camera:', e);
      }
    }

    try {
      setScanning(true);
      
      // First, directly request camera permission to ensure it's granted
      // This helps when permission is set to "Allow" but browser hasn't recognized it yet
      let testStream = null;
      try {
        console.log('Requesting camera permission directly...');
        testStream = await navigator.mediaDevices.getUserMedia({ 
          video: { facingMode: "environment" } 
        });
        console.log('Camera permission granted directly');
        // Stop the test stream immediately - we just needed permission
        testStream.getTracks().forEach(track => track.stop());
        setCameraPermissionStatus('granted');
      } catch (permErr) {
        // If direct permission fails, try user camera
        if (permErr.name === 'NotAllowedError' || permErr.name === 'PermissionDeniedError') {
          console.log('Environment camera permission denied, trying user camera...');
          try {
            testStream = await navigator.mediaDevices.getUserMedia({ 
              video: { facingMode: "user" } 
            });
            console.log('User camera permission granted directly');
            testStream.getTracks().forEach(track => track.stop());
            setCameraPermissionStatus('granted');
          } catch (userPermErr) {
            // Both failed - permission is truly denied
            throw permErr; // Throw the original error
          }
        } else {
          throw permErr;
        }
      }
      
      // Small delay to ensure permission state is updated
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Create new html5-qrcode instance
      const html5QrCode = new Html5Qrcode("reader");
      html5QrCodeRef.current = html5QrCode;

      // Try to start with environment camera (back camera)
      try {
        await html5QrCode.start(
          { facingMode: "environment" },
          {
            fps: 10,
            qrbox: { width: 250, height: 250 },
            aspectRatio: 1.0
          },
          async (decodedText) => {
            // If auto-scan mode is on, also capture image and process with OCR
            if (autoScanMode && html5QrCodeRef.current) {
              try {
                // Capture image from camera
                const canvas = document.createElement('canvas');
                const videoElement = document.getElementById('reader');
                if (videoElement && videoElement.querySelector('video')) {
                  const video = videoElement.querySelector('video');
                  canvas.width = video.videoWidth;
                  canvas.height = video.videoHeight;
                  const ctx = canvas.getContext('2d');
                  ctx.drawImage(video, 0, 0);
                  
                  // Convert to blob and process
                  canvas.toBlob(async (blob) => {
                    if (blob) {
                      const file = new File([blob], 'camera-capture.jpg', { type: 'image/jpeg' });
                      setImageFile(file);
                      setImagePreview(URL.createObjectURL(blob));
                      
                      // Automatically process with OCR
                      await extractTextFromImage();
                    }
                  }, 'image/jpeg');
                }
              } catch (err) {
                console.log('Error capturing image from camera:', err);
              }
            }
            
            handleBarcodeScanned(decodedText);
            if (!autoScanMode) {
              stopCamera();
            }
          },
          (errorMessage) => {
            // Ignore scanning errors (these are normal during scanning)
            // Only log if it's not a common scanning error
            if (!errorMessage.includes('NotFoundException') && !errorMessage.includes('No MultiFormat')) {
              console.log('Scanning:', errorMessage);
            }
          }
        );
        
        // Successfully started
        setCameraPermissionStatus('granted');
        toast.success('Camera started successfully!', { duration: 2000 });
        
      } catch (envErr) {
        // If environment camera fails, try user camera (front camera)
        console.log('Environment camera failed, trying user camera:', envErr);
        
        try {
          await html5QrCode.start(
            { facingMode: "user" },
            {
              fps: 10,
              qrbox: { width: 250, height: 250 },
              aspectRatio: 1.0
            },
            async (decodedText) => {
              // If auto-scan mode is on, also capture image and process with OCR
              if (autoScanMode && html5QrCodeRef.current) {
                try {
                  // Capture image from camera
                  const canvas = document.createElement('canvas');
                  const videoElement = document.getElementById('reader');
                  if (videoElement && videoElement.querySelector('video')) {
                    const video = videoElement.querySelector('video');
                    canvas.width = video.videoWidth;
                    canvas.height = video.videoHeight;
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(video, 0, 0);
                    
                    // Convert to blob and process
                    canvas.toBlob(async (blob) => {
                      if (blob) {
                        const file = new File([blob], 'camera-capture.jpg', { type: 'image/jpeg' });
                        setImageFile(file);
                        setImagePreview(URL.createObjectURL(blob));
                        
                        // Automatically process with OCR
                        await extractTextFromImage();
                      }
                    }, 'image/jpeg');
                  }
                } catch (err) {
                  console.log('Error capturing image from camera:', err);
                }
              }
              
              handleBarcodeScanned(decodedText);
              if (!autoScanMode) {
                stopCamera();
              }
            },
            (errorMessage) => {
              if (!errorMessage.includes('NotFoundException') && !errorMessage.includes('No MultiFormat')) {
                console.log('Scanning:', errorMessage);
              }
            }
          );
          
          setCameraPermissionStatus('granted');
          toast.success('Camera started successfully!', { duration: 2000 });
          
        } catch (userErr) {
          // Both failed, throw the error
          throw userErr;
        }
      }
      
    } catch (err) {
      console.error('Error starting camera:', err);
      setScanning(false);
      
      // Clean up
      if (html5QrCodeRef.current) {
        try {
          await html5QrCodeRef.current.stop().catch(() => {});
          html5QrCodeRef.current.clear();
          html5QrCodeRef.current = null;
        } catch (e) {
          // Ignore cleanup errors
        }
      }
      
      // Parse the error message to determine the issue
      const errorMessage = err.message || err.toString() || '';
      const errorName = err.name || '';
      const errString = JSON.stringify(err).toLowerCase();
      
      // Check for permission denied errors - be very thorough
      if (errorName === 'NotAllowedError' || 
          errorName === 'PermissionDeniedError' ||
          errorMessage.includes('Permission denied') ||
          errorMessage.includes('NotAllowedError') ||
          errorMessage.includes('Permission') ||
          errString.includes('notallowederror') ||
          errString.includes('permission denied') ||
          (errorMessage.includes('permission') && errorMessage.toLowerCase().includes('denied'))) {
        
        setCameraPermissionStatus('denied');
        
        // Show a detailed alert with instructions
        const userAgent = navigator.userAgent.toLowerCase();
        let instructions = '';
        
        if (userAgent.includes('chrome') || userAgent.includes('edg')) {
          instructions = `🔴 CAMERA ACCESS BLOCKED 🔴

Your browser has BLOCKED camera access. Here's how to enable it:

METHOD 1 (Easiest):
1. Look at your browser address bar (where it says "localhost:3000")
2. Click the lock icon (🔒) or camera icon (📷) on the LEFT side
3. Find "Camera" in the dropdown
4. Change it from "Block" to "Allow"
5. Refresh this page (F5)

METHOD 2 (If icon doesn't show):
1. Copy this: chrome://settings/content/camera
2. Paste it in a new tab and press Enter
3. Scroll down to "Customized behaviors"
4. Find "localhost:3000" or "127.0.0.1:3000"
5. If it says "Not allowed", click it and select "Allow"
6. If it's NOT listed, refresh this page, click "Start Camera", then go back to settings
7. Refresh this page

After enabling, refresh this page and try again!`;
        } else {
          instructions = `🔴 CAMERA ACCESS BLOCKED 🔴

Your browser has BLOCKED camera access. Here's how to enable it:

1. Look for a lock or camera icon in your browser address bar
2. Click it and find "Camera" or "Permissions"
3. Change camera access from "Block" to "Allow"
4. Refresh this page (F5)
5. Click "Start Camera" again

If you can't find it:
- Go to your browser Settings
- Search for "Camera" or "Permissions"
- Find "localhost:3000" and set camera to "Allow"
- Refresh this page`;
        }
        
        alert(instructions);
        
        toast.error(
          `Camera permission is BLOCKED. Please check the alert instructions above, enable camera access, and refresh the page.`,
          { duration: 12000 }
        );
        
      } else if (errorName === 'NotFoundError' || 
                 errorName === 'DevicesNotFoundError' ||
                 errorMessage.includes('No camera') ||
                 errorMessage.includes('device not found') ||
                 errorMessage.includes('NotFoundError')) {
        toast.error('No camera found. Please connect a camera device and try again.');
        
      } else if (errorName === 'NotReadableError' || 
                 errorName === 'TrackStartError' ||
                 errorMessage.includes('already in use') ||
                 errorMessage.includes('NotReadableError')) {
        toast.error('Camera is already in use by another application. Please close other apps using the camera.');
        
      } else {
        console.error('Unknown camera error:', err);
        toast.error('Failed to start camera. Please check your browser settings and camera permissions.');
      }
    }
  };

  const stopCamera = () => {
    if (html5QrCodeRef.current) {
      html5QrCodeRef.current.stop().then(() => {
        html5QrCodeRef.current.clear();
        html5QrCodeRef.current = null;
        setScanning(false);
      }).catch((err) => {
        console.error('Error stopping camera:', err);
        setScanning(false);
      });
    }
  };

  // Capture image from camera and automatically process with OCR
  const captureImageFromCamera = async () => {
    if (!scanning || !html5QrCodeRef.current) {
      toast.error('Please start camera first');
      return;
    }

    try {
      // Get video element from html5-qrcode
      const readerElement = document.getElementById('reader');
      if (!readerElement) {
        toast.error('Camera not ready');
        return;
      }

      const video = readerElement.querySelector('video');
      if (!video || video.readyState !== video.HAVE_ENOUGH_DATA) {
        toast.error('Camera not ready. Please wait a moment.');
        return;
      }

      // Create canvas and capture frame
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(video, 0, 0);

      // Convert to blob
      canvas.toBlob(async (blob) => {
        if (blob) {
          const file = new File([blob], 'camera-capture.jpg', { type: 'image/jpeg' });
          setImageFile(file);
          setImagePreview(URL.createObjectURL(blob));
          
          toast.info('Image captured! Processing with OCR...', { duration: 2000 });
          
          // Automatically process with OCR
          setProcessing(true);
          try {
            // Try barcode scan first
            const html5QrCode = new Html5Qrcode("reader");
            try {
              const result = await html5QrCode.scanFile(file, false);
              console.log('Barcode scanned from captured image:', result);
              await handleBarcodeScanned(result);
            } catch {
              console.log('No barcode found in captured image, will try OCR');
            }

            // Then try OCR for text extraction
            await extractTextFromImage();
          } catch (error) {
            console.error('Error processing captured image:', error);
            toast.error('Failed to process captured image');
          } finally {
            setProcessing(false);
          }
        } else {
          toast.error('Failed to capture image');
        }
      }, 'image/jpeg', 0.95);
    } catch (error) {
      console.error('Error capturing image:', error);
      toast.error('Failed to capture image from camera');
    }
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      setImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  // Extract EAN code from long barcode pattern
  // Example: 211000060002004700250 -> remove 2110000 from start and 00250 from end -> 600020047
  const extractEANFromBarcode = (barcode) => {
    if (!barcode || typeof barcode !== 'string') return null;
    
    // Pattern: 2110000 + EAN_CODE + 00250 (or similar suffix)
    // Remove 2110000 from start if present
    let ean = barcode;
    if (ean.startsWith('2110000')) {
      ean = ean.substring(7); // Remove first 7 characters
    }
    
    // Remove suffix pattern (usually 5 digits like 00250, but could vary)
    // Try to remove common patterns: 00250, 00025, etc.
    if (ean.length > 5) {
      // Remove last 5 digits if they match a pattern like 00250, 00025, etc.
      const last5 = ean.substring(ean.length - 5);
      if (/^0{2,}\d{1,3}$/.test(last5)) {
        ean = ean.substring(0, ean.length - 5);
      } else if (ean.length > 3) {
        // Try removing last 3 digits if they're zeros
        const last3 = ean.substring(ean.length - 3);
        if (/^0{2,}\d?$/.test(last3)) {
          ean = ean.substring(0, ean.length - 3);
        }
      }
    }
    
    // Ensure it's a valid number and has reasonable length (EAN codes are usually 8-13 digits)
    const eanNum = parseInt(ean);
    if (isNaN(eanNum) || eanNum <= 0 || ean.length < 6) {
      // If extraction failed, try the original barcode
      const originalNum = parseInt(barcode);
      if (!isNaN(originalNum) && originalNum > 0) {
        return originalNum;
      }
      return null;
    }
    
    return eanNum;
  };

  const handleBarcodeScanned = async (barcode) => {
    setScannedData(prev => ({ ...prev, barcode }));
    toast.success(`Barcode scanned: ${barcode}`);
    
    // Extract EAN code from barcode
    const eanCode = extractEANFromBarcode(barcode);
    console.log('Extracted EAN code:', eanCode, 'from barcode:', barcode);
    
    if (eanCode) {
      // Try to find product by EAN code and add to cart
      await searchProductByBarcodeAndAddToCart(eanCode.toString());
    } else {
      // Fallback: try original barcode
      await searchProductByBarcode(barcode);
    }
  };

  const searchProductByBarcode = async (barcode) => {
    if (!barcode || barcode.trim().length === 0) return null;
    
    try {
      const response = await authenticatedFetch('/api/products');
      if (response.ok) {
        const data = await response.json();
        const products = data.products || [];
        
        // Try to match barcode with EAN_code (convert to number if possible)
        const barcodeNum = parseInt(barcode);
        const matchedProduct = products.find(product => {
          const productObj = product.toObject ? product.toObject() : product;
          const eanCode = productObj.EAN_code;
          // Match as number or string
          return eanCode === barcodeNum || eanCode?.toString() === barcode.toString();
        });
        
        if (matchedProduct) {
          const productObj = matchedProduct.toObject ? matchedProduct.toObject() : matchedProduct;
          toast.success(`Product found: ${productObj.product_name}`);
          
          // Pre-fill scanned data with product information
          setScannedData(prev => ({
            ...prev,
            productName: productObj.product_name || prev.productName,
            barcode: barcode
          }));
          
          return productObj;
        } else {
          toast.info('Product not found in database. You can still save the scanned data.');
          return null;
        }
      }
    } catch (error) {
      console.error('Error searching product by barcode:', error);
      // Don't show error toast - it's okay if product lookup fails
      return null;
    }
    return null;
  };

  // Add product to cart automatically
  const addProductToCart = async (product, quantity, price) => {
    try {
      // Store cart item in localStorage so POS page can read it
      const cartItem = {
        productId: product._id || product.id,
        name: product.product_name || product.name,
        price: price || product.price || 0,
        quantity: quantity, // in grams for kg products, or units for piece products
        unit: product.unit || 'kg',
        profit: product.profit || 0,
        product_code: product.EAN_code || '',
        discount: product.discount || 0,
        addedAt: new Date().toISOString(),
        source: 'scanner'
      };

      // Get existing cart items from localStorage
      const existingCart = JSON.parse(localStorage.getItem('pos_cart') || '[]');
      
      // Check if product already exists in cart
      const existingItemIndex = existingCart.findIndex(item => item.productId === cartItem.productId);
      
      if (existingItemIndex >= 0) {
        // Update quantity if exists
        existingCart[existingItemIndex].quantity += cartItem.quantity;
        toast.success(`Product quantity updated in cart`);
      } else {
        // Add new item
        existingCart.push(cartItem);
        toast.success(`Product added to cart: ${cartItem.name}`);
      }

      // Save to localStorage
      localStorage.setItem('pos_cart', JSON.stringify(existingCart));
      
      // Also trigger a custom event so POS page can listen and update
      window.dispatchEvent(new CustomEvent('cartUpdated', { detail: cartItem }));
      
      console.log('Product added to cart:', cartItem);
      
      // Redirect to POS page after a short delay
      setTimeout(() => {
        const basePath = userRole === 'superadmin' ? '/superadmin' : userRole === 'admin' ? '/admin' : '/user';
        router.push(`${basePath}/pos`);
      }, 1000); // 1 second delay to show the success message
      
      return true;
    } catch (error) {
      console.error('Error adding product to cart:', error);
      toast.error('Failed to add product to cart');
      return false;
    }
  };

  // Search product by barcode and automatically add to cart
  const searchProductByBarcodeAndAddToCart = async (eanCode, weight = null, price = null) => {
    const product = await searchProductByBarcode(eanCode);
    
    if (product) {
      // Extract weight and price from scanned data if available
      let quantity = 100; // Default: 100g
      let finalPrice = product.price || 0;
      
      if (weight) {
        // Parse weight (e.g., "0.25kg" -> 0.25 -> 250g)
        const weightMatch = weight.match(/(\d+\.?\d*)\s*kg/i);
        if (weightMatch) {
          const weightKg = parseFloat(weightMatch[1]);
          quantity = Math.round(weightKg * 1000); // Convert to grams
        }
      }
      
      if (price) {
        // Parse price (e.g., "Rs. 300.00" or "300.00" -> 300.00)
        const priceMatch = price.match(/(\d+\.?\d*)/);
        if (priceMatch) {
          finalPrice = parseFloat(priceMatch[1]);
        }
      }
      
      // Add to cart
      await addProductToCart(product, quantity, finalPrice);
    }
  };

  const scanBarcodeFromImage = async () => {
    if (!imageFile) {
      toast.error('Please upload an image first');
      return;
    }

    setProcessing(true);
    try {
      const html5QrCode = new Html5Qrcode("reader");
      
      // Try to scan barcode from image
      try {
        const result = await html5QrCode.scanFile(imageFile, false);
        console.log('Barcode scanned from image:', result);
        await handleBarcodeScanned(result);
      } catch {
        console.log('No barcode found in image, will try OCR');
      }

      // Now try OCR for text extraction
      await extractTextFromImage();
    } catch (error) {
      console.error('Error scanning barcode:', error);
      // Continue with OCR even if barcode scan fails
      await extractTextFromImage();
    } finally {
      setProcessing(false);
    }
  };

  const preprocessImage = (file, mode = 'grayscale') => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      
      img.onload = () => {
        // Scale up image if it's too small (helps OCR)
        const scale = img.width < 800 ? 2 : 1;
        canvas.width = img.width * scale;
        canvas.height = img.height * scale;
        
        // Use better image smoothing
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        
        // Draw scaled image
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        
        // Get image data for processing
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;
        
        if (mode === 'grayscale') {
          // Convert to grayscale with better luminance calculation
          for (let i = 0; i < data.length; i += 4) {
            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];
            const gray = 0.299 * r + 0.587 * g + 0.114 * b;
            
            // Enhanced contrast adjustment
            let enhanced = ((gray / 255) - 0.5) * 2; // Normalize to -1 to 1
            enhanced = Math.pow(enhanced * 1.2, 1.2); // Apply gamma correction
            enhanced = ((enhanced + 1) / 2) * 255; // Denormalize
            enhanced = Math.max(0, Math.min(255, enhanced));
            
            data[i] = enhanced;
            data[i + 1] = enhanced;
            data[i + 2] = enhanced;
          }
        } else if (mode === 'binary') {
          // Binary threshold mode
          for (let i = 0; i < data.length; i += 4) {
            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];
            const gray = 0.299 * r + 0.587 * g + 0.114 * b;
            
            // Adaptive threshold (Otsu-like)
            const threshold = 128;
            const binary = gray > threshold ? 255 : 0;
            
            data[i] = binary;
            data[i + 1] = binary;
            data[i + 2] = binary;
          }
        }
        
        // Put processed image data back
        ctx.putImageData(imageData, 0, 0);
        
        // Convert canvas to blob
        canvas.toBlob((blob) => {
          if (blob) {
            resolve(blob);
          } else {
            reject(new Error('Failed to process image'));
          }
        }, 'image/png');
      };
      
      img.onerror = () => reject(new Error('Failed to load image'));
      img.src = URL.createObjectURL(file);
    });
  };

  const extractTextUsingOCRAPI = async () => {
    if (!imageFile) return;

    setProcessing(true);
    try {
      // Use OCR.space API for better quality
      const formData = new FormData();
      formData.append('image', imageFile);

      const response = await authenticatedFetch('/api/ocr', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      // Show full response in console as object
      console.log('=== OCR API FULL RESPONSE ===');
      console.log(JSON.stringify(data, null, 2));
      console.log('=== EXTRACTED TEXT ===');
      console.log(data.text || data.extractedText || 'No text found');
      console.log('============================');

      if (data.success && data.text) {
        // Parse the extracted text (now async)
        await parseExtractedText(data.text);
        toast.success('Text extracted successfully using OCR API');
      } else {
        console.error('OCR API Error:', data);
        toast.error(data.error || 'Failed to extract text');
      }
    } catch (error) {
      console.error('OCR API Error:', error);
      toast.error('Failed to extract text using OCR API');
      throw error; // Re-throw to allow fallback
    } finally {
      setProcessing(false);
    }
  };

  const extractTextFromImage = async () => {
    if (!imageFile) return;

    // Try OCR API first (better quality, free API)
    try {
      await extractTextUsingOCRAPI();
      return; // If API works, don't use Tesseract
    } catch (error) {
      console.log('OCR API failed, falling back to Tesseract:', error);
      toast.info('OCR API failed, trying Tesseract fallback...');
      // Continue to Tesseract fallback
    }

    setProcessing(true);
    let worker = null;
    try {
      worker = await createWorker('eng');
      
      // Try multiple strategies with different image preprocessing
      let bestResult = null;
      let bestText = '';
      
      // Strategy 1: Try original image first (sometimes original is better)
      try {
        await worker.setParameters({
          tessedit_pageseg_mode: '3', // Auto page segmentation
        });
        const result1 = await worker.recognize(imageFile);
        if (result1.data.text && result1.data.text.trim().length > bestText.length) {
          bestResult = result1;
          bestText = result1.data.text.trim();
        }
      } catch (e) {
        console.log('Strategy 1 failed:', e);
      }
      
      // Strategy 2: Try with grayscale preprocessed image
      try {
        toast.info('Trying enhanced image processing...', { duration: 1500 });
        const processedGrayscale = await preprocessImage(imageFile, 'grayscale');
        await worker.setParameters({
          tessedit_pageseg_mode: '3',
        });
        const result2 = await worker.recognize(processedGrayscale);
        if (result2.data.text && result2.data.text.trim().length > bestText.length) {
          bestResult = result2;
          bestText = result2.data.text.trim();
        }
      } catch (e) {
        console.log('Strategy 2 failed:', e);
      }
      
      // Strategy 3: Try with binary threshold preprocessed image
      try {
        const processedBinary = await preprocessImage(imageFile, 'binary');
        await worker.setParameters({
          tessedit_pageseg_mode: '6', // Single uniform block
        });
        const result3 = await worker.recognize(processedBinary);
        if (result3.data.text && result3.data.text.trim().length > bestText.length) {
          bestResult = result3;
          bestText = result3.data.text.trim();
        }
      } catch (e) {
        console.log('Strategy 3 failed:', e);
      }
      
      // Clean up worker
      await worker.terminate();
      worker = null;
      
      // Use the best result
      const { data: { text } } = bestResult || { data: { text: '' } };

      // Check if text was extracted
      if (!text || text.trim().length === 0) {
        toast.info('No text found in image');
        return;
      }

      // Clean and normalize the extracted text
      const cleanedText = cleanExtractedText(text);
      
      // Show extracted text in console for debugging
      console.log('Raw extracted text:', text);
      console.log('Cleaned extracted text:', cleanedText);
      
      // Parse the extracted text (now async)
      await parseExtractedText(cleanedText);
      toast.success('Text extracted and parsed from image');
    } catch (error) {
      // Ensure worker is terminated even on error
      if (worker) {
        try {
          await worker.terminate();
        } catch (terminateError) {
          console.log('Error terminating worker:', terminateError);
        }
      }
      
      // Log detailed error information
      const errorMessage = error?.message || error?.toString() || 'Unknown error occurred';
      const errorName = error?.name || 'Error';
      console.error('Error extracting text:', {
        name: errorName,
        message: errorMessage,
        error: error
      });
      
      toast.error(`Failed to extract text: ${errorMessage}`);
    } finally {
      setProcessing(false);
    }
  };

  const cleanExtractedText = (text) => {
    if (!text) return '';
    
    // Split into lines first to preserve structure
    const lines = text.split(/\n/).map(line => line.trim()).filter(line => line.length > 0);
    
    // Clean each line more carefully
    const cleanedLines = lines.map(line => {
      return line
        // Remove garbage characters but keep alphanumeric, spaces, and common punctuation
        .replace(/[^\w\s\d.,:/-₹Rs$₹\u20B9kgKG]/gi, '')
        // Fix common OCR errors
        .replace(/\|/g, 'I')
        .replace(/[`'´]/g, "'")
        // Clean up excessive spaces but preserve word boundaries
        .replace(/\s+/g, ' ')
        .trim();
    }).filter(line => {
      // Filter out lines that are mostly garbage (too many single characters or too short)
      if (line.length < 2) return false;
      const wordCount = line.split(/\s+/).length;
      // Keep lines that have reasonable word structure
      return wordCount > 0;
    });
    
    // Join lines back together with newlines to preserve structure
    return cleanedLines.join('\n');
  };

  const parseExtractedText = async (text) => {
    console.log('Extracted text:', text); // Log for debugging
    
    const lines = text.split('\n').map(line => line.trim()).filter(line => line);
    
    let productName = '';
    let weight = '';
    let pricePerKg = '';
    let totalPrice = '';
    let barcode = scannedData.barcode || '';

    // Try to find product name - look for lines that don't start with numbers and aren't common label text
    const skipKeywords = ['rs', 'weight', 'total', 'includes', 'non', 'pcr', 'label', 'kg', 'reliance', 'smart', 'point'];
    for (const line of lines) {
      const lowerLine = line.toLowerCase();
      const isSkipLine = skipKeywords.some(keyword => lowerLine.includes(keyword));
      const isNumberOnly = /^\d+$/.test(line);
      const isLongNumber = line.length > 15 && /^\d+$/.test(line);
      
      if (!isSkipLine && !isNumberOnly && line.length > 3 && !isLongNumber) {
        // Check if it looks like a product name (not all caps with special chars, not just numbers)
        if (!/^[A-Z\s]+$/.test(line) || line.length > 5) {
          productName = line;
          break;
        }
      }
    }

    // Extract barcode - long numeric sequences (usually 12+ digits, like 211000060002004700250)
    const barcodeMatch = text.match(/\b(\d{15,})\b/);
    if (barcodeMatch) {
      barcode = barcodeMatch[1];
    }

    // Extract weight (look for "Weight: X.XXkg" or "0.25kg" or "0.25kg-" patterns)
    const weightMatch = text.match(/Weight[:\s]*([\d.]+)\s*kg/i) || 
                       text.match(/(\d+\.\d+)\s*kg/i) ||
                       text.match(/weight[:\s]*([\d.]+)\s*kg/i);
    if (weightMatch) {
      weight = weightMatch[1] + ' kg';
    }

    // Extract price per kg (look for "Rs. /Kg: ₹1200" or "Rs/Kg: 1200" or "Rs./K3: 21200" or "₹1200" patterns)
    const pricePerKgMatch = text.match(/Rs[.\s/]*\/?\s*K[g3][:\s]*[₹]?([\d,]+\.?\d*)/i) || 
                            text.match(/[₹](\d+\.?\d*)\s*\/?\s*kg/i);
    if (pricePerKgMatch) {
      pricePerKg = 'Rs. ' + pricePerKgMatch[1].replace(/,/g, '') + ' /kg';
    }

    // Extract total price (look for "Total Rs:- 300.00" or "Total: Rs 300" or "₹300.00" or "Total Rs:- 300.00")
    const totalPriceMatch = text.match(/Total[:\s]*Rs[:\s-]*[₹]?([\d,]+\.?\d*)/i) || 
                           text.match(/[₹](\d+\.?\d*)\s*$/i) ||
                           text.match(/Total[:\s]*Rs[:\s-]*([\d,]+\.?\d*)/i);
    if (totalPriceMatch) {
      totalPrice = 'Rs. ' + totalPriceMatch[1].replace(/,/g, '');
    }

    setScannedData(prev => {
      const newData = {
        barcode: barcode || prev.barcode,
        productName: productName || prev.productName,
        weight: weight || prev.weight,
        pricePerKg: pricePerKg || prev.pricePerKg,
        totalPrice: totalPrice || prev.totalPrice
      };
      
      return newData;
    });

    // If barcode was found, extract EAN and automatically add to cart
    if (barcode && barcode !== scannedData.barcode) {
      const eanCode = extractEANFromBarcode(barcode);
      console.log('Extracted EAN code:', eanCode, 'from barcode:', barcode);
      
      if (eanCode) {
        // Automatically search product and add to cart
        await searchProductByBarcodeAndAddToCart(
          eanCode.toString(),
          weight || scannedData.weight,
          totalPrice || scannedData.totalPrice
        );
      } else {
        // Fallback: try original barcode
        await searchProductByBarcode(barcode);
      }
    }
  };

  const saveScannedData = async () => {
    if (!scannedData.barcode && !scannedData.productName) {
      toast.error('Please scan a barcode or upload an image first');
      return;
    }

    try {
      const response = await authenticatedFetch('/api/scanner', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          barcode: scannedData.barcode,
          productName: scannedData.productName,
          weight: scannedData.weight,
          pricePerKg: scannedData.pricePerKg,
          totalPrice: scannedData.totalPrice,
          scannedAt: new Date().toISOString()
        })
      });

      if (response.ok) {
        toast.success('Scanned data saved successfully');
        setScannedData({ barcode: '', productName: '', weight: '', pricePerKg: '', totalPrice: '' });
        setImageFile(null);
        setImagePreview(null);
        fetchSavedScans();
      } else {
        toast.error('Failed to save scanned data');
      }
    } catch (error) {
      console.error('Error saving scanned data:', error);
      toast.error('Failed to save scanned data');
    }
  };

  const clearAllScans = async () => {
    if (!confirm('Are you sure you want to clear all scanned data?')) {
      return;
    }

    try {
      const response = await authenticatedFetch('/api/scanner', {
        method: 'DELETE'
      });

      if (response.ok) {
        toast.success('All scanned data cleared');
        setSavedScans([]);
      } else {
        toast.error('Failed to clear scanned data');
      }
    } catch (error) {
      console.error('Error clearing scanned data:', error);
      toast.error('Failed to clear scanned data');
    }
  };

  useEffect(() => {
    return () => {
      if (html5QrCodeRef.current) {
        stopCamera();
      }
    };
  }, []);

  return (
    <Layout userRole="user">
      <div className="px-2 py-4 sm:px-4 sm:py-6">
        {cameraPermissionStatus === 'denied' && (
          <div className="mb-4 p-4 bg-red-100 border-2 border-red-500 rounded-lg shadow-lg">
            <div className="flex items-center gap-3">
              <span className="text-2xl">🚫</span>
              <div className="flex-1">
                <p className="font-bold text-red-900 text-sm mb-1">
                  Camera Access is Blocked
                </p>
                <p className="text-xs text-red-800">
                  Your browser has blocked camera access for this site. Click the button below to open camera settings and enable access for <strong>localhost:3000</strong>.
                </p>
              </div>
              <button
                onClick={openCameraSettings}
                className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition whitespace-nowrap"
              >
                ⚙️ Open Settings
              </button>
            </div>
          </div>
        )}
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-4 sm:mb-6">Barcode Scanner</h1>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
          {/* Scanner Section */}
          <div className="bg-white rounded-lg shadow-md p-4 sm:p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Scan Barcode</h2>

            {/* Camera Scanner */}
            <div className="mb-4">
              <div id="reader" className="w-full mb-4" style={{ display: scanning ? 'block' : 'none' }}></div>
              
              {cameraPermissionStatus === 'denied' && (
                <div className="mb-4 p-4 bg-yellow-50 border-2 border-yellow-400 rounded-lg">
                  <div className="flex items-start gap-2 mb-3">
                    <span className="text-xl">⚠️</span>
                    <div className="flex-1">
                      <p className="text-sm font-bold text-yellow-900 mb-1">
                        Camera Permission is Blocked
                      </p>
                      <p className="text-xs text-yellow-800">
                        Your browser has blocked camera access. You need to manually enable it in your browser settings.
                      </p>
                    </div>
                  </div>
                  
                  <div className="bg-white p-3 rounded border border-yellow-200 mb-3">
                    <p className="text-xs font-semibold text-yellow-900 mb-2">
                      📋 {getBrowserInstructions().title}:
                    </p>
                    {getBrowserInstructions().detailed ? (
                      <div className="space-y-3">
                        {getBrowserInstructions().detailed.map((method, methodIdx) => (
                          <div key={methodIdx} className="bg-gray-50 p-2 rounded">
                            <p className="text-xs font-semibold text-yellow-900 mb-1">
                              {method.title}:
                            </p>
                            <ol className="text-xs text-yellow-800 space-y-1 ml-4">
                              {method.steps.map((step, idx) => (
                                <li key={idx} className="list-decimal">
                                  {step}
                                </li>
                              ))}
                            </ol>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <ol className="text-xs text-yellow-800 space-y-2 ml-4">
                        {getBrowserInstructions().steps.map((step, idx) => (
                          <li key={idx} className="list-decimal">
                            <span className="font-medium">Step {idx + 1}:</span> {step}
                          </li>
                        ))}
                      </ol>
                    )}
                  </div>
                  
                  <div className="bg-blue-50 p-3 rounded border border-blue-200 mb-3">
                    <p className="text-xs font-semibold text-blue-900 mb-1">
                      💡 Important Notes:
                    </p>
                    <ul className="text-xs text-blue-800 space-y-1 ml-4 list-disc">
                      <li>After enabling camera in settings, you <strong>must refresh this page</strong> for changes to take effect</li>
                      <li>Look for &quot;localhost:3000&quot; or &quot;127.0.0.1:3000&quot; in the <strong>&quot;Customized behaviors&quot;</strong> section</li>
                      <li>If the site shows as <strong>&quot;Not allowed&quot;</strong>, click on it and change to <strong>&quot;Allow&quot;</strong></li>
                      <li>If the site is NOT listed, click &quot;Start Camera&quot; button first - this will add it to the list</li>
                      <li>If permission is permanently blocked, you may need to <strong>remove the site from the list</strong> (click the X icon), refresh this page, then try again</li>
                    </ul>
                  </div>
                  
                  <div className="bg-red-50 p-3 rounded border border-red-200 mb-3">
                    <p className="text-xs font-semibold text-red-900 mb-1">
                      🔴 If Permission is Permanently Blocked:
                    </p>
                    <ol className="text-xs text-red-800 space-y-1 ml-4 list-decimal">
                      <li>Open Camera Settings (click button above)</li>
                      <li>Find &quot;localhost:3000&quot; in &quot;Customized behaviors&quot;</li>
                      <li>Click the <strong>X icon</strong> next to it to remove the blocked entry</li>
                      <li>Refresh this page</li>
                      <li>Click &quot;Start Camera&quot; - the browser will ask for permission again</li>
                    </ol>
                  </div>
                  
                  <div className="flex flex-col gap-2">
                    <div className="flex gap-2">
                      <button
                        onClick={openCameraSettings}
                        className="flex-1 text-xs bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-2 rounded transition font-medium"
                      >
                        ⚙️ Open Camera Settings
                      </button>
                      <button
                        onClick={() => {
                          window.location.reload();
                        }}
                        className="flex-1 text-xs bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded transition font-medium"
                      >
                        🔄 Refresh Page
                      </button>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={async () => {
                          // Try to start camera again - this will trigger permission request
                          await startCamera();
                        }}
                        className="flex-1 text-xs bg-yellow-600 hover:bg-yellow-700 text-white px-3 py-2 rounded transition font-medium"
                      >
                        📷 Try Starting Camera
                      </button>
                      <button
                        onClick={resetPermissionAndRetry}
                        className="flex-1 text-xs bg-red-600 hover:bg-red-700 text-white px-3 py-2 rounded transition font-medium"
                      >
                        🔄 Reset & Retry
                      </button>
                    </div>
                    <p className="text-xs text-yellow-700 text-center mt-1">
                      <strong>Tip:</strong> If permission is blocked, remove the site from settings, refresh, then try again.
                    </p>
                  </div>
                </div>
              )}
              
              <div className="flex flex-col gap-2 mb-4">
                {!scanning ? (
                  <button
                    onClick={startCamera}
                    className="w-full bg-indigo-600 text-white py-2 px-4 rounded-lg hover:bg-indigo-700 transition font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    📷 {cameraPermissionStatus === 'denied' ? 'Try Starting Camera (Check Settings First)' : 'Start Camera'}
                  </button>
                ) : (
                  <>
                    <button
                      onClick={stopCamera}
                      className="w-full bg-red-600 text-white py-2 px-4 rounded-lg hover:bg-red-700 transition font-medium"
                    >
                      ⏹ Stop Camera
                    </button>
                    
                    <button
                      onClick={captureImageFromCamera}
                      disabled={processing}
                      className="w-full bg-green-600 hover:bg-green-700 text-white py-2 px-4 rounded-lg transition font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      📸 {processing ? 'Processing...' : 'Capture & Scan Text'}
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* Image Upload */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-800 mb-2">
                Or Upload Image
              </label>
              <input
                type="file"
                accept="image/*"
                onChange={handleFileUpload}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
              
              {imagePreview && (
                <div className="mt-4">
                  <Image
                    src={imagePreview}
                    alt="Preview"
                    width={500}
                    height={500}
                    className="max-w-full h-auto rounded-lg border border-gray-300"
                  />
                  <button
                    onClick={scanBarcodeFromImage}
                    disabled={processing}
                    className="mt-2 w-full bg-indigo-600 text-white py-2 px-4 rounded-lg hover:bg-indigo-700 transition font-medium disabled:opacity-50"
                  >
                    {processing ? 'Processing...' : '📷 Scan Image'}
                  </button>
                </div>
              )}
            </div>

            {/* Scanned Data Display */}
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-800 mb-1">Barcode</label>
                <input
                  type="text"
                  value={scannedData.barcode}
                  onChange={(e) => setScannedData({ ...scannedData, barcode: e.target.value })}
                  placeholder="Barcode will appear here"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-800 mb-1">Product Name</label>
                <input
                  type="text"
                  value={scannedData.productName}
                  onChange={(e) => setScannedData({ ...scannedData, productName: e.target.value })}
                  placeholder="Product name will appear here"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-800 mb-1">Weight</label>
                <input
                  type="text"
                  value={scannedData.weight}
                  onChange={(e) => setScannedData({ ...scannedData, weight: e.target.value })}
                  placeholder="Weight will appear here"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-800 mb-1">Price per Kg</label>
                <input
                  type="text"
                  value={scannedData.pricePerKg}
                  onChange={(e) => setScannedData({ ...scannedData, pricePerKg: e.target.value })}
                  placeholder="Price per kg will appear here"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-800 mb-1">Total Price</label>
                <input
                  type="text"
                  value={scannedData.totalPrice}
                  onChange={(e) => setScannedData({ ...scannedData, totalPrice: e.target.value })}
                  placeholder="Total price will appear here"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
              </div>

              <button
                onClick={saveScannedData}
                className="w-full bg-green-600 text-white py-2 px-4 rounded-lg hover:bg-green-700 transition font-medium"
              >
                💾 Save Scanned Data
              </button>
            </div>
          </div>

          {/* Saved Scans Section */}
          <div className="bg-white rounded-lg shadow-md p-4 sm:p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-gray-900">Saved Scans</h2>
              {savedScans.length > 0 && (
                <button
                  onClick={clearAllScans}
                  className="text-red-600 hover:text-red-800 text-sm font-medium"
                >
                  Clear All
                </button>
              )}
            </div>

            <div className="space-y-3 max-h-[600px] overflow-y-auto">
              {savedScans.length === 0 ? (
                <p className="text-gray-600 text-center py-8">No scanned data yet</p>
              ) : (
                savedScans.map((scan) => (
                  <div key={scan.id} className="border border-gray-200 rounded-lg p-3">
                    <div className="space-y-1 text-sm">
                      {scan.barcode && (
                        <p><span className="font-medium">Barcode:</span> {scan.barcode}</p>
                      )}
                      {scan.productName && (
                        <p><span className="font-medium">Product:</span> {scan.productName}</p>
                      )}
                      {scan.weight && (
                        <p><span className="font-medium">Weight:</span> {scan.weight}</p>
                      )}
                      {scan.pricePerKg && (
                        <p><span className="font-medium">Price/Kg:</span> {scan.pricePerKg}</p>
                      )}
                      {scan.totalPrice && (
                        <p><span className="font-medium">Total:</span> {scan.totalPrice}</p>
                      )}
                      <p className="text-xs text-gray-500 mt-2">
                        {new Date(scan.scannedAt).toLocaleString()}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}

