'use client';

import { useState, useRef, useEffect } from 'react';
import dynamic from 'next/dynamic';
import Image from 'next/image';
import Layout from '@/components/Layout';
import { toast } from '@/lib/toast';
import { authenticatedFetch } from '@/lib/api-client';
import { useRouter } from 'next/navigation';

// Lazy load heavy libraries - only load when needed
let Html5QrcodeClass = null;
const loadHtml5Qrcode = async () => {
  if (!Html5QrcodeClass) {
    const html5qrcode = await import('html5-qrcode');
    Html5QrcodeClass = html5qrcode.Html5Qrcode;
  }
  return Html5QrcodeClass;
};

// Lazy load tesseract - HUGE library (several MB)
let createWorker = null;
const loadTesseract = async () => {
  if (!createWorker) {
    const tesseract = await import('tesseract.js');
    createWorker = tesseract.createWorker;
  }
  return createWorker;
};

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
  const [ocrScanning, setOcrScanning] = useState(false);
  const [lastScannedCode, setLastScannedCode] = useState('');
  const html5QrCodeRef = useRef(null);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const ocrWorkerRef = useRef(null);
  const ocrIntervalRef = useRef(null);

  useEffect(() => {
    fetchSavedScans();
    checkCameraPermission();
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
    const userAgent = navigator.userAgent.toLowerCase();
    if (userAgent.includes('chrome') || userAgent.includes('edg')) {
      try {
        window.open('chrome://settings/content/camera', '_blank');
        toast.info('Camera settings opened. Look for "localhost:3000" in the "Customized behaviors" section and set it to "Allow"', { duration: 6000 });
      } catch (e) {
        const instructions = [
          '1. Click the lock icon (🔒) or camera icon (📷) in your browser address bar',
          '2. Click "Camera" in the dropdown menu',
          '3. Select "Allow" instead of "Block" or "Ask"',
          '4. Refresh this page and try again'
        ];
        alert('HOW TO ENABLE CAMERA ACCESS:\n\n' + instructions.join('\n\n'));
      }
    } else if (userAgent.includes('firefox')) {
      window.open('about:preferences#privacy', '_blank');
      toast.info('Go to Permissions → Camera → Settings, find "localhost:3000" and set to "Allow"', { duration: 6000 });
    } else {
      const instructions = [
        '1. Look for a lock or camera icon in your browser address bar',
        '2. Click it and find "Camera" settings',
        '3. Change it to "Allow"',
        '4. Refresh this page'
      ];
      alert('HOW TO ENABLE CAMERA ACCESS:\n\n' + instructions.join('\n\n'));
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
      
      // Lazy load and create new html5-qrcode instance
      const Html5QrcodeClass = await loadHtml5Qrcode();
      const html5QrCode = new Html5QrcodeClass("reader");
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
          (decodedText) => {
            handleBarcodeScanned(decodedText);
            stopCamera();
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
        toast.success('Camera started successfully! Auto-scanning enabled.', { duration: 3000 });
        
        // Start OCR scanning for automatic text detection
        setTimeout(() => {
          // Get video element from html5-qrcode
          const videoElement = document.querySelector('#reader video');
          if (videoElement) {
            videoRef.current = videoElement;
            // Create canvas if it doesn't exist
            if (!canvasRef.current) {
              const canvas = document.createElement('canvas');
              canvas.style.display = 'none';
              document.body.appendChild(canvas);
              canvasRef.current = canvas;
            }
            startOCRScanning();
          } else {
            // Retry after a bit more time if video element not found
            setTimeout(() => {
              const videoElement = document.querySelector('#reader video');
              if (videoElement) {
                videoRef.current = videoElement;
                if (!canvasRef.current) {
                  const canvas = document.createElement('canvas');
                  canvas.style.display = 'none';
                  document.body.appendChild(canvas);
                  canvasRef.current = canvas;
                }
                startOCRScanning();
              }
            }, 1000);
          }
        }, 1500);
        
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
            (decodedText) => {
              handleBarcodeScanned(decodedText);
              stopCamera();
            },
            (errorMessage) => {
              if (!errorMessage.includes('NotFoundException') && !errorMessage.includes('No MultiFormat')) {
                console.log('Scanning:', errorMessage);
              }
            }
          );
          
          setCameraPermissionStatus('granted');
          toast.success('Camera started successfully! Auto-scanning enabled.', { duration: 3000 });
          
          // Start OCR scanning for automatic text detection
          setTimeout(() => {
            // Get video element from html5-qrcode
            const videoElement = document.querySelector('#reader video');
            if (videoElement) {
              videoRef.current = videoElement;
              // Create canvas if it doesn't exist
              if (!canvasRef.current) {
                const canvas = document.createElement('canvas');
                canvas.style.display = 'none';
                document.body.appendChild(canvas);
                canvasRef.current = canvas;
              }
              startOCRScanning();
            } else {
              // Retry after a bit more time if video element not found
              setTimeout(() => {
                const videoElement = document.querySelector('#reader video');
                if (videoElement) {
                  videoRef.current = videoElement;
                  if (!canvasRef.current) {
                    const canvas = document.createElement('canvas');
                    canvas.style.display = 'none';
                    document.body.appendChild(canvas);
                    canvasRef.current = canvas;
                  }
                  startOCRScanning();
                }
              }, 1000);
            }
          }, 1500);
          
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
    // Stop OCR scanning first
    stopOCRScanning();
    
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

  const handleBarcodeScanned = async (barcode) => {
    setScannedData(prev => ({ ...prev, barcode }));
    toast.success(`Barcode scanned: ${barcode}`);
    // Try to find product and add to cart (pass barcode as text for weight extraction)
    await searchProductByCodeAndAddToCart(barcode, barcode);
  };

  // Extract EAN code from text
  // Pattern: Remove prefix "2110000" and suffix "00250" from codes like "211000060002004700250"
  // Result: "600020047" (the middle EAN code)
  const extractEANCode = (text) => {
    if (!text) return null;
    
    console.log('Extracting EAN code from text:', text);
    
    // Look for long barcode numbers (20+ digits) that match the pattern
    // Pattern: 2110000 + EAN_CODE + 00250
    const longBarcodePattern = /2110000(\d{8,13})00250/g;
    let match = longBarcodePattern.exec(text);
    
    if (match && match[1]) {
      const eanCode = match[1];
      console.log(`✅ Extracted EAN code using pattern: ${eanCode} (from ${match[0]})`);
      return eanCode;
    }
    
    // Also try to find the pattern in any long number sequence
    const longNumberPattern = /\d{20,}/g;
    const longNumbers = text.match(longNumberPattern);
    
    if (longNumbers && longNumbers.length > 0) {
      console.log('Found long numbers:', longNumbers);
      
      for (const longNum of longNumbers) {
        // Check if it starts with "2110000" and ends with "00250"
        if (longNum.startsWith('2110000') && longNum.endsWith('00250')) {
          // Extract the middle part (EAN code)
          const eanCode = longNum.substring(7, longNum.length - 5);
          if (eanCode.length >= 8 && eanCode.length <= 13) {
            console.log(`✅ Extracted EAN code: ${eanCode} (from ${longNum})`);
            return eanCode;
          }
        }
        
        // Also try to find pattern anywhere in the number
        const patternIndex = longNum.indexOf('2110000');
        if (patternIndex !== -1) {
          const afterPrefix = longNum.substring(patternIndex + 7);
          const suffixIndex = afterPrefix.indexOf('00250');
          if (suffixIndex !== -1 && suffixIndex >= 8 && suffixIndex <= 13) {
            const eanCode = afterPrefix.substring(0, suffixIndex);
            console.log(`✅ Extracted EAN code from pattern: ${eanCode} (from ${longNum})`);
            return eanCode;
          }
        }
      }
    }
    
    // Fallback: try to find standalone 8-13 digit codes
    const codePattern = /\b\d{8,13}\b/g;
    let matches = text.match(codePattern);
    
    if (matches && matches.length > 0) {
      console.log('Found standalone codes:', matches);
      // Prefer codes that don't start with 0
      const validCodes = matches.filter(code => !code.startsWith('0'));
      if (validCodes.length > 0) {
        return validCodes[0];
      }
      return matches[0];
    }
    
    console.log('No EAN code found in text');
    return null;
  };

  // Extract weight from text and convert to grams
  const extractWeight = (text) => {
    if (!text) return null;
    
    console.log('Extracting weight from text:', text);
    
    // Look for weight patterns like "0.25kg", "0.250kg", "Weight: 0.25kg", etc.
    const weightPatterns = [
      /Weight[:\s]*([\d.]+)\s*kg/i,
      /([\d.]+)\s*kg/i,
      /Weight[:\s]*([\d.]+)/i,
      /([\d.]+)\s*Kg/i,
    ];
    
    for (const pattern of weightPatterns) {
      const match = text.match(pattern);
      if (match && match[1]) {
        const weightKg = parseFloat(match[1]);
        if (!isNaN(weightKg) && weightKg > 0) {
          // Convert kg to grams
          const weightGrams = Math.round(weightKg * 1000);
          console.log(`✅ Extracted weight: ${weightKg}kg = ${weightGrams}g`);
          return weightGrams;
        }
      }
    }
    
    console.log('No weight found in text');
    return null;
  };

  // Search product by EAN code
  const searchProductByCode = async (code) => {
    if (!code || code.trim().length === 0) return null;
    
    try {
      const response = await authenticatedFetch('/api/products');
      if (response.ok) {
        const data = await response.json();
        const products = data.products || [];
        
        // Try to match code with EAN_code (convert to number if possible)
        const codeNum = parseInt(code);
        const matchedProduct = products.find(product => {
          const productObj = product.toObject ? product.toObject() : product;
          const eanCode = productObj.EAN_code;
          // Match as number or string
          return eanCode === codeNum || eanCode?.toString() === code.toString();
        });
        
        if (matchedProduct) {
          const productObj = matchedProduct.toObject ? matchedProduct.toObject() : matchedProduct;
          return productObj;
        }
      }
    } catch (error) {
      console.error('Error searching product by code:', error);
    }
    return null;
  };

  // Add product to cart automatically
  const addProductToCart = async (product, weightInGrams = null) => {
    try {
      const unit = product.unit || 'kg';
      
      // Use extracted weight if provided, otherwise use default
      let quantity;
      if (weightInGrams !== null && weightInGrams > 0) {
        if (unit === 'kg') {
          quantity = weightInGrams; // Quantity in grams for kg products
        } else {
          quantity = Math.round(weightInGrams / 1000); // Convert to units for piece products
        }
        console.log(`Using extracted weight: ${weightInGrams}g = ${quantity} ${unit === 'kg' ? 'grams' : 'units'}`);
      } else {
        quantity = unit === 'kg' ? 100 : 1; // Default: 100g for kg, 1 for pieces
        console.log(`Using default quantity: ${quantity}`);
      }
      
      // Store cart item in localStorage so POS page can read it
      const cartItem = {
        productId: product._id || product.id,
        name: product.product_name || product.name,
        price: product.price || 0,
        quantity: quantity,
        unit: unit,
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
        toast.success(`Product quantity updated in cart: ${cartItem.name}`);
      } else {
        // Add new item
        existingCart.push(cartItem);
        toast.success(`Product added to cart: ${cartItem.name}`);
      }

      // Save to localStorage
      localStorage.setItem('pos_cart', JSON.stringify(existingCart));
      
      // Also trigger a custom event so POS page can listen and update
      window.dispatchEvent(new CustomEvent('cartUpdated', { detail: cartItem }));
      
      console.log('✅ Product added to cart:', cartItem);
      console.log('📊 Cart item details:', {
        name: cartItem.name,
        quantity: cartItem.quantity,
        unit: cartItem.unit,
        price: cartItem.price
      });
      
      // Don't redirect here - let the calling function handle redirect after all logs
      return true;
    } catch (error) {
      console.error('Error adding product to cart:', error);
      toast.error('Failed to add product to cart');
      return false;
    }
  };

  // Search product by code and automatically add to cart
  const searchProductByCodeAndAddToCart = async (code, text = null) => {
    const eanCode = extractEANCode(code || text || '');
    const searchCode = eanCode || code;
    
    if (!searchCode) {
      console.log('No EAN code found to search');
      return false;
    }
    
    // Extract weight from text if provided (convert kg to grams)
    const weightInGrams = text ? extractWeight(text) : null;
    if (weightInGrams) {
      console.log(`✅ Weight extracted: ${weightInGrams}g (will be used as quantity)`);
    }
    
    const product = await searchProductByCode(searchCode);
    if (product) {
      await addProductToCart(product, weightInGrams);
      return true;
    } else {
      toast.info(`Product with code ${searchCode} not found in database`);
      return false;
    }
  };

  // Continuous OCR scanning from camera
  const startOCRScanning = async () => {
    if (!videoRef.current || !canvasRef.current) return;
    
    try {
      // Initialize Tesseract worker
      if (!ocrWorkerRef.current) {
        const createWorkerFn = await loadTesseract();
        ocrWorkerRef.current = await createWorkerFn('eng');
        await ocrWorkerRef.current.setParameters({
          tessedit_char_whitelist: '0123456789',
        });
      }
      
      setOcrScanning(true);
      
      // Capture frame every 2 seconds and process
      ocrIntervalRef.current = setInterval(async () => {
        if (!videoRef.current || !canvasRef.current || !ocrWorkerRef.current) return;
        
        const video = videoRef.current;
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        
        if (video.readyState !== video.HAVE_ENOUGH_DATA) return;
        
        // Set canvas size to match video
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        
        // Draw video frame to canvas
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        
        try {
          let text = '';
          
          // Try OCR.space API first (convert canvas to blob)
          try {
            const blob = await new Promise((resolve) => {
              canvas.toBlob(resolve, 'image/jpeg', 0.8);
            });
            
            if (blob) {
              console.log('=== CAMERA FRAME OCR API CALL ===');
              console.log('Blob size:', blob.size, 'bytes');
              console.log('API Endpoint: /api/ocr');
              
              const formData = new FormData();
              formData.append('image', blob, 'frame.jpg');
              
              const startTime = Date.now();
              const response = await authenticatedFetch('/api/ocr', {
                method: 'POST',
                body: formData,
              });
              const endTime = Date.now();
              
              console.log(`Camera OCR API call completed in ${endTime - startTime}ms`);
              console.log('Response status:', response.status);
              
              const data = await response.json();
              console.log('Camera OCR API Response:', data);
              
              if (data.success && data.text) {
                text = data.text;
                console.log('✅ OCR.space API success for camera frame');
              } else {
                throw new Error('API failed');
              }
            }
          } catch (apiError) {
            // Fallback to Tesseract if API fails
            console.log('OCR.space API failed, using Tesseract fallback for camera');
            if (ocrWorkerRef.current) {
              const { data: { text: tesseractText } } = await ocrWorkerRef.current.recognize(canvas);
              text = tesseractText;
            }
          }
          
          // Log extracted text to console
          if (text && text.trim().length > 0) {
            console.log('=== EXTRACTED TEXT FROM CAMERA ===');
            console.log('Full text:', text);
            console.log('Text length:', text.length);
            console.log('==================================');
            
            const eanCode = extractEANCode(text);
            const weightInGrams = extractWeight(text);
            console.log('Extracted EAN code:', eanCode);
            console.log('Extracted weight:', weightInGrams ? `${weightInGrams}g` : 'not found');
            
            if (eanCode && eanCode !== lastScannedCode) {
              console.log('✅ New code detected:', eanCode);
              setLastScannedCode(eanCode);
              
              // Search and add to cart with weight
              const product = await searchProductByCode(eanCode);
              if (product) {
                console.log('✅ Product found:', product.product_name);
                await addProductToCart(product, weightInGrams);
                // Stop scanning after successful add
                stopOCRScanning();
                stopCamera();
              } else {
                console.log('❌ Product not found for code:', eanCode);
              }
            }
          } else {
            console.log('No text detected in camera frame');
          }
        } catch (ocrError) {
          // Log OCR errors
          console.log('OCR error:', ocrError);
        }
      }, 2000); // Scan every 2 seconds
      
    } catch (error) {
      console.error('Error starting OCR scanning:', error);
      toast.error('Failed to start OCR scanning');
      setOcrScanning(false);
    }
  };

  const stopOCRScanning = () => {
    if (ocrIntervalRef.current) {
      clearInterval(ocrIntervalRef.current);
      ocrIntervalRef.current = null;
    }
    setOcrScanning(false);
    setLastScannedCode('');
    
    // Clean up worker
    if (ocrWorkerRef.current) {
      ocrWorkerRef.current.terminate().catch(() => {});
      ocrWorkerRef.current = null;
    }
  };

  const scanBarcodeFromImage = async () => {
    if (!imageFile) {
      toast.error('Please upload an image first');
      return;
    }

    setProcessing(true);
    try {
      // Lazy load html5-qrcode
      const Html5QrcodeClass = await loadHtml5Qrcode();
      const html5QrCode = new Html5QrcodeClass("reader");
      
      // Try to scan barcode from image
      try {
        const result = await html5QrCode.scanFile(imageFile, false);
        console.log('✅ Barcode found:', result);
        handleBarcodeScanned(result);
        // Don't proceed to OCR if barcode was found
        return;
      } catch (barcodeError) {
        console.log('❌ No barcode found in image, will try OCR');
        console.log('Barcode scan error:', barcodeError);
      }

      // Now try OCR for text extraction
      console.log('🔄 Starting OCR text extraction...');
      await extractTextFromImage();
    } catch (error) {
      console.error('Error scanning barcode:', error);
      // Continue with OCR even if barcode scan fails
      await extractTextFromImage();
    } finally {
      setProcessing(false);
    }
  };

  const extractTextFromImage = async () => {
    if (!imageFile) return;

    setProcessing(true);
    let text = '';
    
    try {
      // First, try OCR.space API (faster and more accurate)
      console.log('=== STARTING OCR API CALL ===');
      console.log('Image file:', imageFile.name, 'Size:', imageFile.size, 'bytes', 'Type:', imageFile.type);
      console.log('API Endpoint: /api/ocr');
      console.log('Method: POST');
      
      const formData = new FormData();
      formData.append('image', imageFile);
      
      console.log('Sending request to /api/ocr...');
      const startTime = Date.now();
      
      const response = await authenticatedFetch('/api/ocr', {
        method: 'POST',
        body: formData,
      });
      
      const endTime = Date.now();
      console.log(`API call completed in ${endTime - startTime}ms`);
      console.log('Response status:', response.status, response.statusText);
      console.log('Response headers:', Object.fromEntries(response.headers.entries()));
      
      const data = await response.json();
      
      console.log('=== OCR API RESPONSE ===');
      console.log('Full response data:', data);
      console.log('Response success:', data.success);
      console.log('Extracted text:', data.text);
      console.log('Text length:', data.text?.length || 0);
      
      if (!response.ok) {
        console.error('❌ OCR API Error Response:', data);
        throw new Error(data.error || `API returned status ${response.status}`);
      }
      
      if (data.success && data.text) {
        text = data.text;
        console.log('✅ OCR.space API success - Text extracted');
        console.log('📄 Extracted text preview:', text.substring(0, 200));
      } else {
        console.log('❌ OCR.space API failed:', data.error || 'Unknown error');
        console.log('Full response:', data);
        throw new Error(data.error || data.details || 'OCR.space API failed');
      }
    } catch (apiError) {
      console.error('OCR.space API error, using Tesseract.js fallback:', apiError);
      console.error('Error details:', {
        message: apiError.message,
        stack: apiError.stack,
        name: apiError.name
      });
      
      // Show user-friendly error message
      if (apiError.message && !apiError.message.includes('fallback')) {
        toast.error(`OCR API Error: ${apiError.message}. Trying fallback...`);
      }
      
      // Fallback to Tesseract.js if API fails
      let worker = null;
      try {
        console.log('Initializing Tesseract.js fallback...');
        const createWorkerFn = await loadTesseract();
        worker = await createWorkerFn('eng');
        console.log('Tesseract worker created, recognizing text...');
        const { data: { text: tesseractText } } = await worker.recognize(imageFile);
        text = tesseractText;
        
        // Clean up worker
        await worker.terminate();
        worker = null;
        console.log('✅ Tesseract.js fallback success');
        toast.info('Used offline OCR (Tesseract.js)');
      } catch (tesseractError) {
        // Ensure worker is terminated even on error
        if (worker) {
          try {
            await worker.terminate();
          } catch (terminateError) {
            console.log('Error terminating worker:', terminateError);
          }
        }
        
        console.error('Both OCR methods failed:', {
          apiError: apiError.message,
          tesseractError: tesseractError.message
        });
        
        toast.error(`Failed to extract text: ${apiError.message || tesseractError.message}`);
        setProcessing(false);
        return;
      }
    }

    // Log extracted text to console
    console.log('=== EXTRACTED TEXT FROM IMAGE ===');
    console.log('Full text:', text);
    console.log('Text length:', text?.length || 0);
    console.log('================================');

    // Check if text was extracted
    if (!text || text.trim().length === 0) {
      console.log('No text found in image');
      toast.info('No text found in image');
      setProcessing(false);
      return;
    }

    // Parse the extracted text
    parseExtractedText(text);
    
    // Extract weight from text (convert kg to grams)
    const weightInGrams = extractWeight(text);
    console.log('⚖️ Weight extracted from image:', weightInGrams ? `${weightInGrams}g` : 'not found');
    
    // Try to extract EAN code and add to cart with weight
    const eanCode = extractEANCode(text);
    console.log('🔍 EAN code extracted:', eanCode || 'not found');
    
    if (eanCode) {
      console.log('🔎 Searching for product with EAN code:', eanCode);
      console.log('📦 Will add to cart with weight:', weightInGrams ? `${weightInGrams}g` : 'default quantity');
      
      const added = await searchProductByCodeAndAddToCart(eanCode, text);
      
      if (added) {
        console.log('✅ Product added to cart successfully, redirecting to POS...');
        toast.success('Product added to cart!');
        // Small delay to show logs before redirect
        setTimeout(() => {
          router.push('/superadmin/pos');
        }, 1000);
      }
    } else {
      console.log('⚠️ No EAN code found in extracted text');
      toast.info('Text extracted but no product code found');
    }
    
    toast.success('Text extracted from image');
    setProcessing(false);
  };

  const parseExtractedText = (text) => {
    const lines = text.split('\n').map(line => line.trim()).filter(line => line);
    
    let productName = '';
    let weight = '';
    let pricePerKg = '';
    let totalPrice = '';

    // Try to find product name (usually first line or contains product keywords)
    for (const line of lines) {
      if (line.length > 3 && !line.match(/^\d+/) && !line.includes('Rs') && !line.includes('Weight')) {
        productName = line;
        break;
      }
    }

    // Extract weight (look for "Weight: X.XXkg" or similar)
    const weightMatch = text.match(/Weight[:\s]*([\d.]+)\s*kg/i);
    if (weightMatch) {
      weight = weightMatch[1] + ' kg';
    }

    // Extract price per kg (look for "Rs. Kg: XXX" or "Rs/Kg: XXX")
    const pricePerKgMatch = text.match(/Rs[.\s/]*Kg[:\s]*([\d.]+)/i);
    if (pricePerKgMatch) {
      pricePerKg = 'Rs. ' + pricePerKgMatch[1] + ' /kg';
    }

    // Extract total price (look for "Total Rs:- XXXX.XX" or "Total: Rs XXXX.XX")
    const totalPriceMatch = text.match(/Total[:\s]*Rs[:\s-]*([\d.]+)/i);
    if (totalPriceMatch) {
      totalPrice = 'Rs. ' + totalPriceMatch[1];
    }

    setScannedData({
      barcode: scannedData.barcode || '',
      productName: productName || scannedData.productName,
      weight: weight || scannedData.weight,
      pricePerKg: pricePerKg || scannedData.pricePerKg,
      totalPrice: totalPrice || scannedData.totalPrice
    });
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
      stopOCRScanning();
      if (html5QrCodeRef.current) {
        stopCamera();
      }
    };
  }, []);

  return (
    <Layout userRole="superadmin">
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
              
              {ocrScanning && (
                <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <div className="flex items-center gap-2">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                    <p className="text-sm text-blue-800">
                      <strong>Auto-scanning enabled:</strong> Camera is automatically reading codes. Point at product codes to add to cart.
                    </p>
                  </div>
                  {lastScannedCode && (
                    <p className="text-xs text-blue-600 mt-1 ml-6">
                      Last detected code: {lastScannedCode}
                    </p>
                  )}
                </div>
              )}
              
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
              
              <div className="flex gap-2 mb-4">
                {!scanning ? (
                  <button
                    onClick={startCamera}
                    className="flex-1 bg-indigo-600 text-white py-2 px-4 rounded-lg hover:bg-indigo-700 transition font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    📷 {cameraPermissionStatus === 'denied' ? 'Try Starting Camera (Check Settings First)' : 'Start Camera'}
                  </button>
                ) : (
                  <button
                    onClick={stopCamera}
                    className="flex-1 bg-red-600 text-white py-2 px-4 rounded-lg hover:bg-red-700 transition font-medium"
                  >
                    ⏹ Stop Camera
                  </button>
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

