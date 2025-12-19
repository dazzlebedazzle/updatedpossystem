'use client';

import { useRef, useEffect, useState, useCallback } from 'react';
import jsPDF from 'jspdf';

export default function Receipt({ saleData, onClose }) {
  const receiptRef = useRef();
  const [isMobile, setIsMobile] = useState(false);

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

  // Auto-trigger print dialog only on desktop
  useEffect(() => {
    if (!isMobile) {
      const timer = setTimeout(() => {
        handlePrint();
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [isMobile, handlePrint]);


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
    
    // Remove event handlers from all elements
    const allElements = clonedContent.querySelectorAll('*');
    allElements.forEach(el => {
      // Remove all event handlers
      const attrs = el.attributes;
      for (let i = attrs.length - 1; i >= 0; i--) {
        const attr = attrs[i];
        if (attr.name.startsWith('on')) {
          el.removeAttribute(attr.name);
        }
      }
    });
    
    // Get sanitized HTML
    const sanitizedHTML = clonedContent.innerHTML;
    
    const windowPrint = window.open('', '', 'width=800,height=600');
    
    // Escape all user data before inserting
    const safeReceiptNumber = escapeHTML(saleData.receiptNumber || '');
    
    windowPrint.document.write(`
      <html>
        <head>
          <title>Receipt - ${safeReceiptNumber}</title>
          <style>
            * {
              margin: 0;
              padding: 0;
              box-sizing: border-box;
            }
            body {
              font-family: 'Courier New', monospace;
              padding: 20px;
              background: white;
            }
            .receipt {
              max-width: 300px;
              margin: 0 auto;
              background: white;
            }
            .header {
              text-align: center;
              border-bottom: 2px dashed #000;
              padding-bottom: 10px;
              margin-bottom: 10px;
            }
            .logo {
              margin-bottom: 5px;
              display: flex;
              justify-content: center;
              align-items: center;
            }
            .logo img {
              max-width: 120px;
              max-height: 60px;
              object-fit: contain;
              display: block;
            }
            .company-name {
              font-size: 18px;
              font-weight: bold;
              margin-bottom: 5px;
            }
            .company-details {
              font-size: 10px;
              line-height: 1.4;
            }
            .section {
              margin: 10px 0;
              padding: 5px 0;
            }
            .section-title {
              font-weight: bold;
              font-size: 11px;
              margin-bottom: 5px;
            }
            .info-row {
              display: flex;
              justify-content: space-between;
              font-size: 10px;
              margin: 3px 0;
            }
            .items-header {
              display: flex;
              justify-content: space-between;
              font-weight: bold;
              font-size: 10px;
              border-bottom: 1px solid #000;
              padding: 5px 0;
              margin-top: 10px;
            }
            .item-row {
              display: flex;
              justify-content: space-between;
              font-size: 10px;
              padding: 5px 0;
              border-bottom: 1px dashed #ccc;
            }
            .item-details {
              flex: 1;
            }
            .item-name {
              font-weight: bold;
            }
            .item-qty {
              font-size: 9px;
              color: #666;
            }
            .item-price {
              text-align: right;
              min-width: 60px;
            }
            .totals {
              margin-top: 10px;
              border-top: 2px solid #000;
              padding-top: 10px;
            }
            .total-row {
              display: flex;
              justify-content: space-between;
              font-size: 11px;
              margin: 5px 0;
            }
            .grand-total {
              font-size: 14px;
              font-weight: bold;
              border-top: 2px solid #000;
              padding-top: 8px;
              margin-top: 8px;
            }
            .footer {
              text-align: center;
              margin-top: 15px;
              padding-top: 10px;
              border-top: 2px dashed #000;
              font-size: 10px;
            }
            .thank-you {
              font-weight: bold;
              font-size: 12px;
              margin-bottom: 5px;
            }
            @media print {
              body {
                padding: 0;
              }
              .no-print {
                display: none;
              }
            }
          </style>
        </head>
        <body>
          ${sanitizedHTML}
        </body>
      </html>
    `);
    
    windowPrint.document.close();
    windowPrint.focus();
    
    setTimeout(() => {
      windowPrint.print();
      windowPrint.close();
    }, 250);
  }, [saleData]);

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
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 10;
    let yPosition = 10;
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
        const logoWidth = 50;
        const logoHeight = (logoImg.naturalHeight / logoImg.naturalWidth) * logoWidth;
        doc.addImage(logoImg, 'PNG', (pageWidth - logoWidth) / 2, yPosition, logoWidth, logoHeight);
        yPosition += logoHeight + 5;
      } else {
        // Fallback to text if image not loaded
        doc.setFontSize(20);
        doc.text('TAJALLI', pageWidth / 2, yPosition, { align: 'center' });
        yPosition += 8;
      }
    } catch (error) {
      console.error('Error adding logo to PDF:', error);
      // Fallback to text if image fails
      doc.setFontSize(20);
      doc.text('TAJALLI', pageWidth / 2, yPosition, { align: 'center' });
      yPosition += 8;
    }

    doc.setFontSize(8);
    doc.text('GSTIN: 07AAXCS0618K1ZT', pageWidth / 2, yPosition, { align: 'center' });
    yPosition += 4;
    doc.text('FASSAI: 13323999001107', pageWidth / 2, yPosition, { align: 'center' });
    yPosition += 4;
    doc.text('16-B Jangpura Road, Bhogal, Jangpura, New Delhi', pageWidth / 2, yPosition, { align: 'center' });
    yPosition += 4;
    doc.text('📞 +91-XXXXXXXXXX', pageWidth / 2, yPosition, { align: 'center' });
    yPosition += 6;

    // Line separator
    doc.setLineWidth(0.5);
    doc.line(margin, yPosition, pageWidth - margin, yPosition);
    yPosition += 5;

    // Receipt Info
    doc.setFontSize(9);
    doc.text(`Receipt: ${saleData.receiptNumber}`, margin, yPosition);
    yPosition += 5;
    doc.text(`Date: ${formatDate(saleData.date)}`, margin, yPosition);
    yPosition += 6;

    // Customer Details
    doc.setFontSize(10);
    doc.setFont(undefined, 'bold');
    doc.text('Customer Details:', margin, yPosition);
    yPosition += 5;
    doc.setFont(undefined, 'normal');
    doc.setFontSize(9);
    doc.text(`Name: ${saleData.customerName}`, margin, yPosition);
    yPosition += 5;
    doc.text(`Mobile: ${saleData.customerMobile}`, margin, yPosition);
    yPosition += 5;
    const addressLines = doc.splitTextToSize(`Address: ${saleData.customerAddress}`, maxWidth);
    doc.text(addressLines, margin, yPosition);
    yPosition += addressLines.length * 5 + 3;

    // Line separator
    doc.line(margin, yPosition, pageWidth - margin, yPosition);
    yPosition += 5;

    // Items Header
    doc.setFontSize(9);
    doc.setFont(undefined, 'bold');
    doc.text('Item', margin, yPosition);
    doc.text('Price', pageWidth - margin, yPosition, { align: 'right' });
    yPosition += 5;
    doc.line(margin, yPosition, pageWidth - margin, yPosition);
    yPosition += 3;

    // Items
    doc.setFont(undefined, 'normal');
    saleData.items.forEach((item) => {
      // Check if we need a new page
      if (yPosition > doc.internal.pageSize.getHeight() - 30) {
        doc.addPage();
        yPosition = 10;
      }

      doc.setFontSize(9);
      doc.setFont(undefined, 'bold');
      const itemNameLines = doc.splitTextToSize(item.name, maxWidth - 50);
      doc.text(itemNameLines, margin, yPosition);
      
      const qtyText = item.unit === 'kg' 
        ? `${item.quantity / 1000} kg × ${formatCurrency(item.price)}`
        : `${item.quantity} pcs × ${formatCurrency(item.price)}`;
      doc.setFont(undefined, 'normal');
      doc.setFontSize(8);
      doc.text(qtyText, margin, yPosition + (itemNameLines.length * 4));
      
      doc.setFontSize(9);
      doc.text(formatCurrency(item.total), pageWidth - margin, yPosition, { align: 'right' });
      
      yPosition += Math.max(itemNameLines.length * 4 + 4, 8) + 2;
    });

    yPosition += 3;
    doc.line(margin, yPosition, pageWidth - margin, yPosition);
    yPosition += 5;

    // Totals
    doc.setFontSize(9);
    doc.text(`Subtotal: ${formatCurrency(saleData.subtotal)}`, pageWidth - margin, yPosition, { align: 'right' });
    yPosition += 6;
    
    doc.setFontSize(11);
    doc.setFont(undefined, 'bold');
    doc.line(margin, yPosition, pageWidth - margin, yPosition);
    yPosition += 5;
    doc.text(`Total: ${formatCurrency(saleData.total)}`, pageWidth - margin, yPosition, { align: 'right' });
    yPosition += 6;
    
    doc.setFont(undefined, 'normal');
    doc.setFontSize(9);
    doc.text(`Payment Mode: ${saleData.paymentMethod}`, margin, yPosition);
    yPosition += 8;

    // Footer
    doc.line(margin, yPosition, pageWidth - margin, yPosition);
    yPosition += 5;
    doc.setFontSize(10);
    doc.setFont(undefined, 'bold');
    doc.text('Thank You!', pageWidth / 2, yPosition, { align: 'center' });
    yPosition += 5;
    doc.setFont(undefined, 'normal');
    doc.setFontSize(9);
    doc.text('Visit Again 😊', pageWidth / 2, yPosition, { align: 'center' });
    yPosition += 5;
    doc.setFontSize(8);
    doc.text('www.tajalli.com', pageWidth / 2, yPosition, { align: 'center' });

    // Save PDF
    const fileName = `Receipt_${saleData.receiptNumber}_${new Date().toISOString().split('T')[0]}.pdf`;
    doc.save(fileName);
  };

  return (
    <>
      <div 
        className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
        onClick={onClose}
      >
        <div 
          className="bg-white rounded-lg shadow-2xl max-w-md w-full"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Preview */}
          <div className="p-6 max-h-[80vh] overflow-y-auto">
            <div ref={receiptRef}>
              <div className="receipt" style={{ maxWidth: '300px', margin: '0 auto', fontFamily: '"Courier New", monospace' }}>
                {/* Header */}
                <div className="header" style={{ textAlign: 'center', borderBottom: '2px dashed #000', paddingBottom: '10px', marginBottom: '10px' }}>
                  <div className="logo" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', marginBottom: '5px' }}>
                    <img src="/assets/category_images/logoo.png" alt="Tajalli Logo" style={{ maxWidth: '120px', maxHeight: '60px', objectFit: 'contain' }} />
                  </div>
                  <div className="company-name" style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '5px' }}>TAJALLI</div>
                  <div className="company-details" style={{ fontSize: '10px', lineHeight: '1.4' }}>
                    <div>GSTIN: 07AAXCS0618K1ZT</div>
                    <div>FASSAI: 13323999001107</div>
                    <div style={{ marginTop: '5px' }}>16-B Jangpura Road</div>
                    <div>Bhogal, Jangpura, New Delhi</div>
                    <div>📞 +91-XXXXXXXXXX</div>
                  </div>
                </div>

                {/* Receipt Info */}
                <div className="section">
                  <div className="info-row" style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', margin: '3px 0' }}>
                    <span>Receipt:</span>
                    <span style={{ fontWeight: 'bold' }}>{saleData.receiptNumber}</span>
                  </div>
                  <div className="info-row" style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', margin: '3px 0' }}>
                    <span>Date:</span>
                    <span>{formatDate(saleData.date)}</span>
                  </div>
                </div>

                {/* Customer Details */}
                <div className="section" style={{ borderTop: '1px dashed #ccc', paddingTop: '8px', marginTop: '8px' }}>
                  <div className="section-title" style={{ fontWeight: 'bold', fontSize: '11px', marginBottom: '5px' }}>Customer Details:</div>
                  <div className="info-row" style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', margin: '3px 0' }}>
                    <span>Name:</span>
                    <span>{saleData.customerName}</span>
                  </div>
                  <div className="info-row" style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', margin: '3px 0' }}>
                    <span>Mobile:</span>
                    <span>{saleData.customerMobile}</span>
                  </div>
                  <div className="info-row" style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', margin: '3px 0' }}>
                    <span>Address:</span>
                    <span style={{ textAlign: 'right', maxWidth: '60%' }}>{saleData.customerAddress}</span>
                  </div>
                </div>

                {/* Items */}
                <div className="section" style={{ marginTop: '10px' }}>
                  <div className="items-header" style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', fontSize: '10px', borderBottom: '1px solid #000', padding: '5px 0' }}>
                    <span>Item</span>
                    <span>Price</span>
                  </div>
                  {saleData.items.map((item, index) => (
                    <div key={index} className="item-row" style={{ padding: '5px 0', borderBottom: '1px dashed #ccc' }}>
                      <div className="item-details" style={{ flex: 1 }}>
                        <div className="item-name" style={{ fontWeight: 'bold', fontSize: '10px' }}>{item.name}</div>
                        <div className="item-qty" style={{ fontSize: '9px', color: '#666' }}>
                          {item.unit === 'kg' ? `${item.quantity / 1000} kg` : `${item.quantity} pcs`} × {formatCurrency(item.price)}
                        </div>
                      </div>
                      <div className="item-price" style={{ textAlign: 'right', minWidth: '60px', fontSize: '10px' }}>
                        {formatCurrency(item.total)}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Totals */}
                <div className="totals" style={{ marginTop: '10px', borderTop: '2px solid #000', paddingTop: '10px' }}>
                  <div className="total-row" style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', margin: '5px 0' }}>
                    <span>Subtotal:</span>
                    <span>{formatCurrency(saleData.subtotal)}</span>
                  </div>
                  <div className="grand-total" style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', fontWeight: 'bold', borderTop: '2px solid #000', paddingTop: '8px', marginTop: '8px' }}>
                    <span>Total:</span>
                    <span>{formatCurrency(saleData.total)}</span>
                  </div>
                  <div className="total-row" style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', margin: '8px 0 0 0' }}>
                    <span>Payment Mode:</span>
                    <span style={{ fontWeight: 'bold' }}>{saleData.paymentMethod}</span>
                  </div>
                </div>

                {/* Footer */}
                <div className="footer" style={{ textAlign: 'center', marginTop: '15px', paddingTop: '10px', borderTop: '2px dashed #000', fontSize: '10px' }}>
                  <div className="thank-you" style={{ fontWeight: 'bold', fontSize: '12px', marginBottom: '5px' }}>Thank You!</div>
                  <div>Visit Again 😊</div>
                  <div style={{ marginTop: '8px', fontSize: '9px' }}>www.tajalli.com</div>
                </div>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 p-4 bg-white border-t">
            {!isMobile ? (
              <button
                onClick={handlePrint}
                className="flex-1 bg-green-600 text-white py-2.5 px-4 rounded-lg hover:bg-green-700 font-medium transition flex items-center justify-center gap-2"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                </svg>
                Print Receipt
              </button>
            ) : (
              <button
                onClick={handleSavePDF}
                className="flex-1 bg-blue-600 text-white py-2.5 px-4 rounded-lg hover:bg-blue-700 font-medium transition flex items-center justify-center gap-2"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Save as PDF
              </button>
            )}
            <button
              onClick={handleSavePDF}
              className={`flex-1 bg-indigo-600 text-white py-2.5 px-4 rounded-lg hover:bg-indigo-700 font-medium transition flex items-center justify-center gap-2 ${!isMobile ? '' : 'hidden'}`}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Save as PDF
            </button>
            <button
              onClick={onClose}
              className="flex-1 bg-white text-gray-800 py-2.5 px-4 rounded-lg hover:bg-white font-medium transition"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

