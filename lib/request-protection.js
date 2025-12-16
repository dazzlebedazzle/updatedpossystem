/**
 * Request Protection Utilities
 * Provides request size limits, timeout protection, and other security measures
 */

import { NextResponse } from 'next/server';

// Maximum request body size (in bytes)
// 10MB for most endpoints, 50MB for upload endpoints
const MAX_REQUEST_SIZE = {
  default: 10 * 1024 * 1024, // 10MB
  upload: 50 * 1024 * 1024, // 50MB
};

// Request timeout (in milliseconds)
const REQUEST_TIMEOUT = 30 * 1000; // 30 seconds

/**
 * Get maximum request size for an endpoint
 */
function getMaxRequestSize(pathname) {
  if (pathname.includes('/upload')) {
    return MAX_REQUEST_SIZE.upload;
  }
  return MAX_REQUEST_SIZE.default;
}

/**
 * Check request size limit
 */
export function checkRequestSize(request, pathname) {
  const contentLength = request.headers.get('content-length');
  
  if (!contentLength) {
    return { valid: true };
  }
  
  const size = parseInt(contentLength, 10);
  const maxSize = getMaxRequestSize(pathname);
  
  if (size > maxSize) {
    return {
      valid: false,
      error: `Request body too large. Maximum size is ${maxSize / (1024 * 1024)}MB`,
      maxSize,
      actualSize: size,
    };
  }
  
  return { valid: true, size };
}

/**
 * Create a timeout promise
 */
function createTimeoutPromise(timeoutMs) {
  return new Promise((_, reject) => {
    setTimeout(() => {
      reject(new Error(`Request timeout after ${timeoutMs}ms`));
    }, timeoutMs);
  });
}

/**
 * Wrap a handler with timeout protection
 */
export function withTimeout(handler, timeoutMs = REQUEST_TIMEOUT) {
  return async (request, context) => {
    try {
      const handlerPromise = handler(request, context);
      const timeoutPromise = createTimeoutPromise(timeoutMs);
      
      const result = await Promise.race([handlerPromise, timeoutPromise]);
      return result;
    } catch (error) {
      if (error.message.includes('timeout')) {
        console.error(`[TIMEOUT] Request to ${request.url} timed out after ${timeoutMs}ms`);
        return NextResponse.json(
          {
            error: 'Request timeout',
            message: 'The request took too long to process. Please try again.',
          },
          { status: 408 }
        );
      }
      throw error;
    }
  };
}

/**
 * Middleware to validate request size
 */
export function validateRequestSize(request, pathname) {
  const sizeCheck = checkRequestSize(request, pathname);
  
  if (!sizeCheck.valid) {
    return NextResponse.json(
      {
        error: 'Request too large',
        message: sizeCheck.error,
        maxSize: sizeCheck.maxSize,
        actualSize: sizeCheck.actualSize,
      },
      { status: 413 }
    );
  }
  
  return null;
}

/**
 * Get request protection headers
 */
export function getProtectionHeaders() {
  return {
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'X-XSS-Protection': '1; mode=block',
    'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
  };
}

/**
 * Add security headers to response
 */
export function addSecurityHeaders(response) {
  const headers = getProtectionHeaders();
  
  for (const [key, value] of Object.entries(headers)) {
    response.headers.set(key, value);
  }
  
  return response;
}

