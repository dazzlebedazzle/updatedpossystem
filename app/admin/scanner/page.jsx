'use client';

import { useState, useRef, useEffect } from 'react';
import Image from 'next/image';
import Layout from '@/components/Layout';
import { Html5Qrcode } from 'html5-qrcode';
import { createWorker } from 'tesseract.js';
import { toast } from '@/lib/toast';
import { authenticatedFetch } from '@/lib/api-client';

export default function ScannerPage() {
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

  const requestCameraPermissionDirectly = async () => {
    // First, try to request permission directly - this will add the site to permissions list
    try {
      // Try with environment camera first (back camera)
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: "environment" } 
      });
      // Stop the stream immediately - we just needed permission
      stream.getTracks().forEach(track => track.stop());
      return { success: true, deviceId: null };
    } catch (err) {
      // If environment camera fails, try any camera
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        throw err; // Re-throw permission errors
      }
      
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        stream.getTracks().forEach(track => track.stop());
        return { success: true, deviceId: null };
      } catch (e) {
        throw e;
      }
    }
  };

  const startCamera = async () => {
    // Check if camera API is available
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      toast.error('Camera access is not supported in this browser. Please use a modern browser like Chrome, Firefox, or Edge.');
      return;
    }

    try {
      setScanning(true);
      
      // First, try to request permission directly
      // This will trigger the browser's permission prompt and add the site to the permissions list
      try {
        await requestCameraPermissionDirectly();
        setCameraPermissionStatus('granted');
        toast.success('Camera permission granted! Starting scanner...', { duration: 2000 });
      } catch (permErr) {
        // Permission was denied - stop here and show instructions
        setScanning(false);
        setCameraPermissionStatus('denied');
        
        console.error('Camera permission denied. Error details:', {
          name: permErr.name,
          message: permErr.message,
          fullError: permErr
        });
        
        toast.error(
          `Camera permission denied. Please click "Open Camera Settings" below and enable camera access for localhost:3000`,
          { duration: 8000 }
        );
        return;
      }

      // If we get here, permission was granted - now start html5-qrcode
      const html5QrCode = new Html5Qrcode("reader");
      html5QrCodeRef.current = html5QrCode;

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
        () => {
          // Ignore scanning errors (these are normal during scanning)
        }
      );
      
    } catch (err) {
      console.error('Error starting camera:', err);
      setScanning(false);
      
      // Parse the error message to determine the issue
      const errorMessage = err.message || err.toString() || '';
      const errorName = err.name || '';
      
      // Check for permission denied errors
      if (errorName === 'NotAllowedError' || 
          errorName === 'PermissionDeniedError' ||
          errorMessage.includes('Permission denied') ||
          errorMessage.includes('NotAllowedError') ||
          (errorMessage.includes('permission') && errorMessage.toLowerCase().includes('denied'))) {
        
        setCameraPermissionStatus('denied');
        
        toast.error(
          `Camera permission denied. Click "Open Camera Settings" button below to enable camera access for this site.`,
          { duration: 8000 }
        );
        
      } else if (errorName === 'NotFoundError' || 
                 errorName === 'DevicesNotFoundError' ||
                 errorMessage.includes('No camera') ||
                 errorMessage.includes('device not found')) {
        toast.error('No camera found. Please connect a camera device and try again.');
        
      } else if (errorName === 'NotReadableError' || 
                 errorName === 'TrackStartError' ||
                 errorMessage.includes('already in use') ||
                 errorMessage.includes('NotReadableError')) {
        toast.error('Camera is already in use by another application. Please close other apps using the camera.');
        
      } else {
        console.error('Unknown camera error:', err);
        toast.error('Failed to start camera. Please check your browser settings and try again.');
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

  const handleBarcodeScanned = (barcode) => {
    setScannedData(prev => ({ ...prev, barcode }));
    toast.success(`Barcode scanned: ${barcode}`);
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
        handleBarcodeScanned(result);
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

  const extractTextFromImage = async () => {
    if (!imageFile) return;

    setProcessing(true);
    try {
      const worker = await createWorker('eng');
      const { data: { text } } = await worker.recognize(imageFile);
      await worker.terminate();

      // Parse the extracted text
      parseExtractedText(text);
      toast.success('Text extracted from image');
    } catch (error) {
      console.error('Error extracting text:', error);
      toast.error('Failed to extract text from image');
    } finally {
      setProcessing(false);
    }
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
      if (html5QrCodeRef.current) {
        stopCamera();
      }
    };
  }, []);

  return (
    <Layout userRole="admin">
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

