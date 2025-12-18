/**
 * Request Protection Utilities
 * Provides request size limits, timeout protection, and other security measures
 */

import { NextResponse } from 'next/server';
import { validateContentLength, normalizePathname } from './security-utils';

// Maximum request body size (in bytes)
// 10MB for most endpoints, 50MB for upload endpoints
const MAX_REQUEST_SIZE = {
  default: 10 * 1024 * 1024, // 10MB
  upload: 50 * 1024 * 1024, // 50MB
};

// Request timeout (in milliseconds)
const REQUEST_TIMEOUT = 30 * 1000; // 30 seconds

// Maximum chunk size for streaming validation (1MB)
const MAX_CHUNK_SIZE = 1 * 1024 * 1024;

/**
 * Get maximum request size for an endpoint
 */
function getMaxRequestSize(pathname) {
  const normalized = normalizePathname(pathname);
  if (normalized.includes('/upload')) {
    return MAX_REQUEST_SIZE.upload;
  }
  return MAX_REQUEST_SIZE.default;
}

/**
 * Check request size limit (validates Content-Length header)
 * Note: This is a preliminary check. Actual body size should be validated
 * when reading the body to prevent Content-Length spoofing.
 */
export function checkRequestSize(request, pathname) {
  const contentLength = request.headers.get('content-length');
  const maxSize = getMaxRequestSize(pathname);
  
  // If no Content-Length, we'll validate during body reading
  if (!contentLength) {
    return { valid: true, needsBodyValidation: true };
  }
  
  // Validate Content-Length header
  const validation = validateContentLength(contentLength, maxSize);
  
  if (!validation.valid) {
    return {
      valid: false,
      error: validation.error || `Request body too large. Maximum size is ${maxSize / (1024 * 1024)}MB`,
      maxSize,
      actualSize: validation.size,
    };
  }
  
  return { valid: true, size: validation.size, needsBodyValidation: false };
}

/**
 * Validate actual request body size (prevents Content-Length spoofing)
 * This should be called when reading the request body
 */
export async function validateRequestBodySize(reader, maxSize, pathname) {
  // Preserve API shape (call sites may pass pathname), but avoid unused-param lint warnings.
  void pathname;

  let totalSize = 0;
  const chunks = [];
  
  try {
    while (true) {
      const { done, value } = await reader.read();
      
      if (done) break;
      
      if (value) {
        totalSize += value.length;
        
        // Check size incrementally
        if (totalSize > maxSize) {
          return {
            valid: false,
            error: `Request body too large. Maximum size is ${maxSize / (1024 * 1024)}MB`,
            maxSize,
            actualSize: totalSize,
          };
        }
        
        // Prevent memory exhaustion by limiting chunk size
        if (value.length > MAX_CHUNK_SIZE) {
          return {
            valid: false,
            error: 'Chunk size too large',
            maxSize,
            actualSize: totalSize,
          };
        }
        
        chunks.push(value);
      }
    }
    
    return {
      valid: true,
      size: totalSize,
      chunks, // Return chunks for further processing
    };
  } catch (error) {
    return {
      valid: false,
      error: `Error reading request body: ${error.message}`,
      maxSize,
      actualSize: totalSize,
    };
  }
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
 * This is a preliminary check. For POST/PUT requests, actual body
 * size should be validated when reading the body.
 */
export function validateRequestSize(request, pathname) {
  // Only validate size for requests with bodies
  const method = request.method;
  if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') {
    return null;
  }
  
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
  
  // Note: If needsBodyValidation is true, the actual body size
  // should be validated when reading the request body in the route handler
  
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

