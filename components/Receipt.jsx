'use client';

import { useRef, useEffect, useState, useCallback } from 'react';
import Image from 'next/image';

export default function Receipt({ saleData, onClose }) {
  const receiptRef = useRef();
  const [isMobile, setIsMobile] = useState(false);

  // Escape HTML entities
  const escapeHTML = (str) => {
    if (typeof str !== 'string') return str;
    const map = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;'
    };
    return str.replace(/[&<>"']/g, m => map[m]);
  };

  const handlePrint = useCallback(() => {
    const printContent = receiptRef.current;
    if (!printContent) return;
    
    // Clone the content and sanitize it
    const clonedContent = printContent.cloneNode(true);
    
    // Remove any script tags and event handlers
    const scripts = clonedContent.querySelectorAll('script');
    scripts.forEach(script => script.remove());
    
    // Remove event handlers from all elements and force 5.5cm width for receipt root
    const allElements = clonedContent.querySelectorAll('*');
    allElements.forEach(el => {
      const attrs = el.attributes;
      for (let i = attrs.length - 1; i >= 0; i--) {
        const attr = attrs[i];
        if (attr.name.startsWith('on')) {
          el.removeAttribute(attr.name);
        }
      }
    });
    
    // Remove inline width from receipt so print CSS (5.5cm) applies
    const receiptEl = clonedContent.querySelector('.receipt');
    if (receiptEl && receiptEl.getAttribute('style')) {
      const s = receiptEl.getAttribute('style')
        .replace(/\bwidth\s*:[^;]+;?/gi, '')
        .replace(/\bmax-width\s*:[^;]+;?/gi, '')
        .trim();
      receiptEl.setAttribute('style', s || '');
    }
    
    // Get sanitized HTML
    const sanitizedHTML = clonedContent.innerHTML;
    
    // Escape all user data before inserting
    const safeReceiptNumber = escapeHTML(saleData.receiptNumber || '');
    
    // Use the same approach for both Windows and Android - direct print
    const windowPrint = window.open('', '_blank', 'width=800,height=600');
    
    // If popup is blocked, use current window
    if (!windowPrint) {
      // Fallback: print from current window
      const printStyles = document.createElement('style');
      printStyles.innerHTML = `
        @media print {
          body * {
            visibility: hidden;
          }
          .print-content, .print-content * {
            visibility: visible;
          }
          .print-content {
            position: absolute;
            left: 50%;
            top: 0;
            transform: translateX(-50%);
            width: 5.5cm !important;
            max-width: 5.5cm !important;
            font-size: 7px;
          }
          @page {
            size: 5.5cm auto;
            margin: 2mm;
          }
        }
      `;
      document.head.appendChild(printStyles);
      
      const tempDiv = document.createElement('div');
      tempDiv.className = 'print-content';
      tempDiv.innerHTML = sanitizedHTML;
      document.body.appendChild(tempDiv);
      
      window.print();
      
      setTimeout(() => {
        if (document.body.contains(tempDiv)) {
          document.body.removeChild(tempDiv);
        }
        if (document.head.contains(printStyles)) {
          document.head.removeChild(printStyles);
        }
      }, 1000);
      return;
    }
    
    windowPrint.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Receipt - ${safeReceiptNumber}</title>
          <style>
            * {
              margin: 0;
              padding: 0;
              box-sizing: border-box;
            }
            body {
              font-family: 'Courier New', monospace;
              padding: 0;
              background: white;
              color: #1f2937;
              width: 100%;
              min-height: 100vh;
              display: flex;
              justify-content: center;
              align-items: flex-start;
              margin: 0;
            }
            .receipt {
              width: 5.5cm;
              max-width: 5.5cm;
              margin: 0 auto;
              background: white;
              font-size: 7px;
              line-height: 1.2;
              word-wrap: break-word;
              overflow-wrap: break-word;
            }
            .header {
              text-align: center;
              border-bottom: 1px dashed #000;
              padding-bottom: 3px;
              margin-bottom: 3px;
            }
            .logo {
              margin-bottom: 2px;
              display: flex;
              justify-content: center;
              align-items: center;
            }
            .logo img {
              max-width: 3.2cm;
              max-height: 1.2cm;
              width: auto;
              height: auto;
              object-fit: contain;
              display: block;
            }
            .company-name {
              font-size: 9px;
              font-weight: bold;
              margin-bottom: 2px;
              color: #1f2937;
            }
            .company-details {
              font-size: 6px;
              line-height: 1.25;
              color: #1f2937;
            }
            .section {
              margin: 3px 0;
              padding: 2px 0;
            }
            .section-title {
              font-weight: bold;
              font-size: 7px;
              margin-bottom: 2px;
            }
            .info-row {
              display: flex;
              justify-content: space-between;
              font-size: 6px;
              margin: 1px 0;
              color: #1f2937;
            }
            .items-header {
              display: flex;
              justify-content: space-between;
              font-weight: bold;
              font-size: 6px;
              border-bottom: 1px solid #000;
              padding: 2px 0;
              margin-top: 3px;
            }
            .item-row {
              display: flex;
              justify-content: space-between;
              align-items: flex-start;
              gap: 2px;
              font-size: 6px;
              padding: 2px 0;
              border-bottom: 1px dashed #ccc;
            }
            .item-details {
              flex: 1;
              min-width: 0;
              overflow: hidden;
            }
            .item-name {
              font-weight: bold;
              font-size: 6px;
              word-wrap: break-word;
              overflow-wrap: break-word;
            }
            .item-qty {
              font-size: 5px;
              color: #1f2937;
            }
            .item-price {
              text-align: right;
              min-width: 1.4cm;
              flex-shrink: 0;
              font-size: 6px;
            }
            .totals {
              margin-top: 3px;
              border-top: 1px solid #000;
              padding-top: 3px;
            }
            .total-row {
              display: flex;
              justify-content: space-between;
              font-size: 6px;
              margin: 2px 0;
            }
            .grand-total {
              font-size: 8px;
              font-weight: bold;
              border-top: 1px solid #000;
              padding-top: 3px;
              margin-top: 3px;
            }
            .footer {
              text-align: center;
              margin-top: 5px;
              padding-top: 3px;
              border-top: 1px dashed #000;
              font-size: 6px;
              color: #1f2937;
            }
            .thank-you {
              font-weight: bold;
              font-size: 7px;
              margin-bottom: 2px;
            }
            @media print {
              html, body {
                width: 100% !important;
                min-height: 100vh;
                padding: 0 !important;
                margin: 0 !important;
                background: white;
                display: flex !important;
                justify-content: center !important;
                align-items: flex-start !important;
              }
              .receipt {
                width: 5.5cm !important;
                max-width: 5.5cm !important;
                margin: 0 auto !important;
              }
              .no-print {
                display: none;
              }
              @page {
                size: 5.5cm auto;
                margin: 2mm;
              }
            }
            @media screen {
              body {
                padding: 10px;
              }
            }
          </style>
        </head>
        <body>
          ${sanitizedHTML}
          <script>
            // Auto-trigger print dialog immediately (works on both Windows and Android)
            window.onload = function() {
              setTimeout(function() {
                window.print();
                // Close window after print dialog is shown
                // Note: window.close() may not work if user cancels print
                window.addEventListener('afterprint', function() {
                  setTimeout(function() {
                    window.close();
                  }, 100);
                });
              }, 300);
            };
          </script>
        </body>
      </html>
    `);
    
    windowPrint.document.close();
  }, [saleData]);

  // Detect mobile device
  useEffect(() => {
    const checkMobile = () => {
      const userAgent = navigator.userAgent || navigator.vendor || window.opera;
      const isAndroid = /android/i.test(userAgent);
      const isIOS = /iPad|iPhone|iPod/.test(userAgent) && !window.MSStream;
      setIsMobile(isAndroid || isIOS || window.innerWidth < 768);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Auto-trigger print dialog only on desktop (not mobile)
  useEffect(() => {
    if (!isMobile) {
      const timer = setTimeout(() => {
        handlePrint();
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [isMobile, handlePrint]);

  const formatDate = (date) => {
    return new Date(date).toLocaleString('en-IN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    });
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR'
    }).format(amount);
  };

  const handleSavePDF = async () => {
    try {
      // Dynamically import jsPDF only when needed to avoid webpack module loading issues
      const { default: jsPDF } = await import('jspdf');
      
      // Create PDF with 5.5cm (55mm) width for receipt
      const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: [55, 200] // 5.5cm wide, height auto-adjusts as content grows
      });
      
      const pageWidth = doc.internal.pageSize.getWidth(); // 55mm
      const margin = 2; // 2mm margin for 5.5cm receipt
      let yPosition = 8;
      const maxWidth = pageWidth - (margin * 2);

      // Header with Logo
      try {
        // Load logo image
        const logoImg = new Image();
        logoImg.crossOrigin = 'anonymous';
        logoImg.src = '/assets/category_images/logoo.png';
        
        // Wait for image to load
        await new Promise((resolve) => {
          if (logoImg.complete) {
            resolve();
          } else {
            logoImg.onload = resolve;
            logoImg.onerror = () => {
              console.warn('Logo image failed to load, using text fallback');
              resolve(); // Resolve anyway to continue with fallback
            };
          }
        });
        
        // Add logo to PDF if loaded successfully
        if (logoImg.naturalWidth > 0) {
          const logoWidth = Math.min(28, pageWidth - margin * 2); // Max 28mm for 5.5cm receipt
          const logoHeight = (logoImg.naturalHeight / logoImg.naturalWidth) * logoWidth;
          doc.addImage(logoImg, 'PNG', (pageWidth - logoWidth) / 2, yPosition, logoWidth, logoHeight);
          yPosition += logoHeight + 2; // Reduced spacing from 5 to 2
        } else {
          // Fallback to text if image not loaded
          doc.setTextColor(0, 0, 0); // Pure black for better visibility
          doc.setFontSize(18); // Increased from 16 to 18 for visibility
          doc.text('TAJALLI', pageWidth / 2, yPosition, { align: 'center' });
          yPosition += 6; // Increased from 5 to 6
        }
      } catch (error) {
        console.error('Error adding logo to PDF:', error);
        // Fallback to text if image fails
        doc.setTextColor(0, 0, 0); // Pure black for better visibility
        doc.setFontSize(18); // Increased from 16 to 18 for visibility
        doc.text('TAJALLI', pageWidth / 2, yPosition, { align: 'center' });
        yPosition += 6; // Increased from 5 to 6
      }

      doc.setTextColor(0, 0, 0); // Pure black for better visibility
      doc.setFontSize(9); // Increased from 7 to 9
      doc.text('GSTIN: 07AAXCS0618K1ZT', pageWidth / 2, yPosition, { align: 'center' });
      yPosition += 4; // Increased from 3 to 4
      doc.text('FASSAI: 13323999001107', pageWidth / 2, yPosition, { align: 'center' });
      yPosition += 4; // Increased from 3 to 4
      doc.text('MBD Neopolis Mall, Ferozepur Road', pageWidth / 2, yPosition, { align: 'center' });
      yPosition += 4; // Increased from 3 to 4
      doc.text('Rajguru Nagar Extension, Ludhiana, Punjab 141012', pageWidth / 2, yPosition, { align: 'center' });
      yPosition += 4; // Increased from 3 to 4
      doc.text('📞 0161-430-5000', pageWidth / 2, yPosition, { align: 'center' });
      yPosition += 5; // Increased from 4 to 5

      // Line separator
      doc.setLineWidth(1); // Increased from 0.5 to 1 for visibility
      doc.line(margin, yPosition, pageWidth - margin, yPosition);
      yPosition += 4; // Increased from 3 to 4

      // Receipt Info
      doc.setTextColor(0, 0, 0); // Pure black for better visibility
      doc.setFontSize(9); // Increased from 8 to 9
      doc.text(`Receipt: ${saleData.receiptNumber}`, margin, yPosition);
      yPosition += 4; // Increased from 3 to 4
      doc.text(`Date: ${formatDate(saleData.date)}`, margin, yPosition);
      yPosition += 4; // Increased from 4 to 4

      // Line separator
      doc.line(margin, yPosition, pageWidth - margin, yPosition);
      yPosition += 4; // Increased from 3 to 4

      // Items Header
      doc.setTextColor(0, 0, 0); // Pure black for better visibility
      doc.setFontSize(9); // Increased from 8 to 9
      doc.setFont(undefined, 'bold');
      doc.text('Item', margin, yPosition);
      doc.text('Price', pageWidth - margin, yPosition, { align: 'right' });
      yPosition += 4; // Increased from 3 to 4
      doc.line(margin, yPosition, pageWidth - margin, yPosition);
      yPosition += 3; // Increased from 2 to 3

      // Items
      doc.setFont(undefined, 'normal');
      saleData.items.forEach((item) => {
        // Check if we need a new page
        if (yPosition > doc.internal.pageSize.getHeight() - 30) {
          doc.addPage();
          yPosition = 10;
        }

        doc.setTextColor(0, 0, 0); // Pure black for better visibility
        doc.setFontSize(9); // Increased from 8 to 9
        doc.setFont(undefined, 'bold');
        const itemNameLines = doc.splitTextToSize(item.name, maxWidth - 18); // Leave ~18mm for price column
        doc.text(itemNameLines, margin, yPosition);
        
        const qtyText = item.unit === 'kg' 
          ? `${item.quantity / 1000} kg × ${formatCurrency(item.price)}`
          : `${item.quantity} pcs × ${formatCurrency(item.price)}`;
        doc.setFont(undefined, 'normal');
        doc.setFontSize(8); // Increased from 7 to 8
        doc.text(qtyText, margin, yPosition + (itemNameLines.length * 4)); // Increased from 3 to 4
        
        doc.setFontSize(9); // Increased from 8 to 9
        doc.text(formatCurrency(item.total), pageWidth - margin, yPosition, { align: 'right' });
        
        yPosition += Math.max(itemNameLines.length * 4 + 2, 7) + 2; // Increased spacing
      });

      yPosition += 3; // Increased from 2 to 3
      doc.line(margin, yPosition, pageWidth - margin, yPosition);
      yPosition += 4; // Increased from 3 to 4

      // Totals
      doc.setTextColor(0, 0, 0); // Pure black for better visibility
      doc.setFontSize(9); // Increased from 8 to 9
      doc.text(`Subtotal: ${formatCurrency(saleData.subtotal)}`, pageWidth - margin, yPosition, { align: 'right' });
      yPosition += 4; // Increased from 3 to 4
      
      doc.setFontSize(11); // Increased from 10 to 11
      doc.setFont(undefined, 'bold');
      doc.line(margin, yPosition, pageWidth - margin, yPosition);
      yPosition += 3; // Increased from 2 to 3
      doc.text(`Total: ${formatCurrency(saleData.total)}`, pageWidth - margin, yPosition, { align: 'right' });
      yPosition += 5; // Increased from 4 to 5
      
      doc.setFont(undefined, 'normal');
      doc.setFontSize(9); // Increased from 8 to 9
      doc.text(`Payment Mode: ${saleData.paymentMethod}`, margin, yPosition);
      yPosition += 5; // Increased from 4 to 5

      // Footer
      doc.setTextColor(0, 0, 0); // Pure black for better visibility
      doc.line(margin, yPosition, pageWidth - margin, yPosition);
      yPosition += 4; // Increased from 3 to 4
      doc.setFontSize(10); // Increased from 9 to 10
      doc.setFont(undefined, 'bold');
      doc.text('Thank You!', pageWidth / 2, yPosition, { align: 'center' });
      yPosition += 4; // Increased from 3 to 4
      doc.setFont(undefined, 'normal');
      doc.setFontSize(9); // Increased from 8 to 9
      doc.text('Visit Again 😊', pageWidth / 2, yPosition, { align: 'center' });
      yPosition += 4; // Increased from 3 to 4
      doc.setFontSize(8); // Increased from 7 to 8
      doc.text('www.tajalli.com', pageWidth / 2, yPosition, { align: 'center' });

      // Save PDF
      const fileName = `Receipt_${saleData.receiptNumber}_${new Date().toISOString().split('T')[0]}.pdf`;
      doc.save(fileName);
    } catch (error) {
      console.error('Error generating PDF:', error);
      alert('Failed to generate PDF. Please try using the Print option instead.');
    }
  };

  return (
    <>
      <div 
        className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-2"
        onClick={onClose}
      >
        <div 
          className="bg-white rounded-lg shadow-2xl"
          style={{ width: '300px', maxHeight: '95vh', overflowY: 'auto' }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Preview */}
          <div className="p-2">
            <div ref={receiptRef}>
              <div className="receipt text-gray-800" style={{ width: '270px', margin: '0 auto', fontFamily: '"Courier New", monospace', color: '#1f2937', fontSize: '11px' }}>
                {/* Header */}
                <div className="header" style={{ textAlign: 'center', borderBottom: '2px dashed #000', paddingBottom: '8px', marginBottom: '8px' }}>
                  <div className="logo" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', position: 'relative', width: '80px', height: '40px', margin: '0 auto 3px' }}>
                    <Image src="/assets/category_images/logoo.png" alt="Tajalli Logo" width={80} height={40} style={{ objectFit: 'contain' }} />
                  </div>
                  <div className="company-name text-gray-800" style={{ fontSize: '16px', fontWeight: 'bold', marginBottom: '3px', color: '#1f2937' }}>TAJALLI</div>
                  <div className="company-details text-gray-800" style={{ fontSize: '9px', lineHeight: '1.3', color: '#1f2937' }}>
                    <div>GSTIN: 07AAXCS0618K1ZT</div>
                    <div>FASSAI: 13323999001107</div>
                    <div style={{ marginTop: '3px' }}>16-B Jangpura Road</div>
                    <div>Bhogal, Jangpura, New Delhi</div>
                    <div>📞 +91-XXXXXXXXXX</div>
                  </div>
                </div>

                {/* Receipt Info */}
                <div className="section">
                  <div className="info-row text-gray-800" style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', margin: '3px 0', color: '#1f2937' }}>
                    <span>Receipt:</span>
                    <span style={{ fontWeight: 'bold' }}>{saleData.receiptNumber}</span>
                  </div>
                  <div className="info-row text-gray-800" style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', margin: '3px 0', color: '#1f2937' }}>
                    <span>Date:</span>
                    <span>{formatDate(saleData.date)}</span>
                  </div>
                </div>

                {/* Items */}
                <div className="section" style={{ marginTop: '10px' }}>
                  <div className="items-header text-gray-800" style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', fontSize: '10px', borderBottom: '1px solid #000', padding: '5px 0', color: '#1f2937' }}>
                    <span>Item</span>
                    <span>Price</span>
                  </div>
                  {saleData.items.map((item, index) => (
                    <div key={index} className="item-row text-gray-800" style={{ padding: '5px 0', borderBottom: '1px dashed #ccc', color: '#1f2937' }}>
                      <div className="item-details" style={{ flex: 1 }}>
                        <div className="item-name" style={{ fontWeight: 'bold', fontSize: '10px', color: '#1f2937' }}>{item.name}</div>
                        <div className="item-qty" style={{ fontSize: '9px', color: '#1f2937' }}>
                          {item.unit === 'kg' ? `${item.quantity / 1000} kg` : `${item.quantity} pcs`} × {formatCurrency(item.price)}
                        </div>
                      </div>
                      <div className="item-price" style={{ textAlign: 'right', minWidth: '60px', fontSize: '10px', color: '#1f2937' }}>
                        {formatCurrency(item.total)}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Totals */}
                <div className="totals" style={{ marginTop: '10px', borderTop: '2px solid #000', paddingTop: '10px' }}>
                  <div className="total-row text-gray-800" style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', margin: '5px 0', color: '#1f2937' }}>
                    <span>Subtotal:</span>
                    <span>{formatCurrency(saleData.subtotal)}</span>
                  </div>
                  <div className="grand-total text-gray-800" style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', fontWeight: 'bold', borderTop: '2px solid #000', paddingTop: '8px', marginTop: '8px', color: '#1f2937' }}>
                    <span>Total:</span>
                    <span>{formatCurrency(saleData.total)}</span>
                  </div>
                  <div className="total-row text-gray-800" style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', margin: '8px 0 0 0', color: '#1f2937' }}>
                    <span>Payment Mode:</span>
                    <span style={{ fontWeight: 'bold' }}>{saleData.paymentMethod}</span>
                  </div>
                </div>

                {/* Footer */}
                <div className="footer text-gray-800" style={{ textAlign: 'center', marginTop: '15px', paddingTop: '10px', borderTop: '2px dashed #000', fontSize: '10px', color: '#1f2937' }}>
                  <div className="thank-you" style={{ fontWeight: 'bold', fontSize: '12px', marginBottom: '5px', color: '#1f2937' }}>Thank You!</div>
                  <div style={{ color: '#1f2937' }}>Visit Again 😊</div>
                  <div style={{ marginTop: '8px', fontSize: '9px', color: '#1f2937' }}>www.tajalli.com</div>
                </div>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-2 p-2 bg-white border-t">
            <button
              onClick={handlePrint}
              className="flex-1 bg-green-600 text-white py-2 px-3 rounded-lg hover:bg-green-700 font-medium transition flex items-center justify-center gap-2 text-sm"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
              </svg>
              Print
            </button>
            <button
              onClick={handleSavePDF}
              className="flex-1 bg-indigo-600 text-white py-2 px-3 rounded-lg hover:bg-indigo-700 font-medium transition flex items-center justify-center gap-2 text-sm"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              PDF
            </button>
            <button
              onClick={onClose}
              className="flex-1 bg-gray-100 text-gray-800 py-2 px-3 rounded-lg hover:bg-gray-200 font-medium transition border border-gray-200 text-sm"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

