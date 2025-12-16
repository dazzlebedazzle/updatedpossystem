/**
 * API Protection Wrapper
 * Provides a convenient wrapper for API route handlers with DDoS protection
 */

import { NextResponse } from 'next/server';
import { withTimeout, validateRequestSize, addSecurityHeaders } from './request-protection';

/**
 * Wrap an API route handler with protection
 * @param {Function} handler - The API route handler function
 * @param {Object} options - Protection options
 * @param {number} options.timeout - Request timeout in milliseconds (default: 30000)
 * @param {boolean} options.validateSize - Whether to validate request size (default: true)
 */
export function withProtection(handler, options = {}) {
  const {
    timeout = 30000,
    validateSize = true,
  } = options;

  return async (request, context) => {
    try {
      const pathname = new URL(request.url).pathname;

      // Validate request size
      if (validateSize && request.method !== 'GET' && request.method !== 'HEAD') {
        const sizeValidation = validateRequestSize(request, pathname);
        if (sizeValidation) {
          return addSecurityHeaders(sizeValidation);
        }
      }

      // Wrap handler with timeout
      const protectedHandler = withTimeout(handler, timeout);
      const response = await protectedHandler(request, context);

      // Add security headers
      return addSecurityHeaders(response);
    } catch (error) {
      console.error('[API Protection] Error:', error);
      
      // Handle timeout errors
      if (error.message && error.message.includes('timeout')) {
        return addSecurityHeaders(
          NextResponse.json(
            {
              error: 'Request timeout',
              message: 'The request took too long to process. Please try again.',
            },
            { status: 408 }
          )
        );
      }

      // Handle other errors
      return addSecurityHeaders(
        NextResponse.json(
          {
            error: 'Internal server error',
            message: 'An unexpected error occurred.',
          },
          { status: 500 }
        )
      );
    }
  };
}

