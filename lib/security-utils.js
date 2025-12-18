/**
 * Security Utilities
 * Provides secure operations for parsing, validation, and sanitization
 */

/**
 * Validate IP address format (IPv4 or IPv6)
 */
export function isValidIP(ip) {
  if (!ip || typeof ip !== 'string') return false;
  
  // IPv4 validation
  const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/;
  if (ipv4Regex.test(ip)) {
    const parts = ip.split('.');
    return parts.every(part => {
      const num = parseInt(part, 10);
      return num >= 0 && num <= 255;
    });
  }
  
  // IPv6 validation (simplified)
  const ipv6Regex = /^([0-9a-fA-F]{0,4}:){2,7}[0-9a-fA-F]{0,4}$/;
  if (ipv6Regex.test(ip)) {
    return true;
  }
  
  return false;
}

/**
 * Safe JSON parsing with size limits and error handling
 * @param {string} str - JSON string to parse
 * @param {number} maxSize - Maximum size in bytes (default: 10KB)
 * @returns {Object|null} - Parsed object or null on error
 */
export function safeJsonParse(str, maxSize = 10 * 1024) {
  if (!str || typeof str !== 'string') {
    return null;
  }
  
  // Check size limit
  const sizeInBytes = new TextEncoder().encode(str).length;
  if (sizeInBytes > maxSize) {
    console.warn(`[SECURITY] JSON size ${sizeInBytes} exceeds limit ${maxSize}`);
    return null;
  }
  
  // Check for deeply nested structures (DoS protection)
  const depth = (str.match(/\{/g) || []).length;
  if (depth > 100) {
    console.warn(`[SECURITY] JSON depth ${depth} exceeds limit`);
    return null;
  }
  
  try {
    return JSON.parse(str);
  } catch (e) {
    console.warn(`[SECURITY] JSON parse error: ${e.message}`);
    return null;
  }
}

/**
 * Sanitize and validate session cookie data
 */
export function sanitizeSession(session) {
  if (!session || typeof session !== 'object') {
    return null;
  }
  
  // Only allow expected fields
  const allowedFields = ['userId', 'email', 'role', 'token', 'permissions'];
  const sanitized = {};
  
  for (const field of allowedFields) {
    if (session[field] !== undefined) {
      // Validate field types
      if (field === 'userId' && typeof session[field] === 'string') {
        sanitized[field] = session[field].substring(0, 100); // Limit length
      } else if (field === 'email' && typeof session[field] === 'string') {
        const email = session[field].substring(0, 255);
        if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
          sanitized[field] = email;
        }
      } else if (field === 'role' && typeof session[field] === 'string') {
        const role = session[field].substring(0, 50);
        if (['superadmin', 'admin', 'agent'].includes(role)) {
          sanitized[field] = role;
        }
      } else if (field === 'token' && typeof session[field] === 'string') {
        sanitized[field] = session[field].substring(0, 100);
      } else if (field === 'permissions' && Array.isArray(session[field])) {
        sanitized[field] = session[field].slice(0, 100); // Limit array size
      }
    }
  }
  
  return Object.keys(sanitized).length > 0 ? sanitized : null;
}

/**
 * Normalize and validate pathname
 */
export function normalizePathname(pathname) {
  if (!pathname || typeof pathname !== 'string') {
    return '/';
  }
  
  try {
    // Decode URL encoding
    const decoded = decodeURIComponent(pathname);
    
    // Remove null bytes and control characters
    const cleaned = decoded.replace(/[\x00-\x1F\x7F]/g, '');
    
    // Normalize path separators
    return cleaned.replace(/\\/g, '/');
  } catch {
    return '/';
  }
}

/**
 * Validate Content-Length header
 */
export function validateContentLength(contentLength, maxSize) {
  if (!contentLength) {
    return { valid: true, size: 0 };
  }
  
  const size = parseInt(contentLength, 10);
  
  if (isNaN(size) || size < 0) {
    return { valid: false, error: 'Invalid Content-Length header' };
  }
  
  if (size > maxSize) {
    return {
      valid: false,
      error: `Content-Length ${size} exceeds maximum ${maxSize}`,
      size,
      maxSize,
    };
  }
  
  return { valid: true, size };
}

