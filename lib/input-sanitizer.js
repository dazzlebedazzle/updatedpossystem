/**
 * Input Sanitization Utilities
 * Prevents XSS and injection attacks
 */

/**
 * Escape HTML entities to prevent XSS
 */
export function escapeHTML(str) {
  if (typeof str !== 'string') {
    return String(str);
  }
  
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
    '/': '&#x2F;',
    '`': '&#x60;',
    '=': '&#x3D;'
  };
  
  return str.replace(/[&<>"'`=\/]/g, (s) => map[s]);
}

/**
 * Sanitize string input - remove dangerous characters
 */
export function sanitizeString(input, maxLength = 1000) {
  if (typeof input !== 'string') {
    return String(input);
  }
  
  // Limit length
  let sanitized = input.substring(0, maxLength);
  
  // Remove null bytes
  sanitized = sanitized.replace(/\0/g, '');
  
  // Remove control characters except newlines and tabs
  sanitized = sanitized.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
  
  return sanitized.trim();
}

/**
 * Sanitize object recursively
 */
export function sanitizeObject(obj, maxDepth = 10, currentDepth = 0) {
  if (currentDepth > maxDepth) {
    return '[Max depth exceeded]';
  }
  
  if (obj === null || obj === undefined) {
    return obj;
  }
  
  if (typeof obj === 'string') {
    return sanitizeString(obj);
  }
  
  if (typeof obj === 'number' || typeof obj === 'boolean') {
    return obj;
  }
  
  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeObject(item, maxDepth, currentDepth + 1));
  }
  
  if (typeof obj === 'object') {
    const sanitized = {};
    for (const [key, value] of Object.entries(obj)) {
      // Sanitize key
      const safeKey = sanitizeString(key, 100);
      sanitized[safeKey] = sanitizeObject(value, maxDepth, currentDepth + 1);
    }
    return sanitized;
  }
  
  return String(obj);
}

/**
 * Validate and sanitize email
 */
export function sanitizeEmail(email) {
  if (typeof email !== 'string') {
    return null;
  }
  
  const sanitized = email.trim().toLowerCase();
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  
  if (!emailRegex.test(sanitized)) {
    return null;
  }
  
  // Limit length
  if (sanitized.length > 255) {
    return null;
  }
  
  return sanitized;
}

/**
 * Validate and sanitize URL
 */
export function sanitizeURL(url) {
  if (typeof url !== 'string') {
    return null;
  }
  
  try {
    const parsed = new URL(url);
    // Only allow http and https
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return null;
    }
    return parsed.toString();
  } catch {
    return null;
  }
}

/**
 * Remove script tags and event handlers from HTML
 */
export function sanitizeHTML(html) {
  if (typeof html !== 'string') {
    return '';
  }
  
  // Remove script tags
  let sanitized = html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
  
  // Remove event handlers (onclick, onerror, etc.)
  sanitized = sanitized.replace(/\s*on\w+\s*=\s*["'][^"']*["']/gi, '');
  sanitized = sanitized.replace(/\s*on\w+\s*=\s*[^\s>]*/gi, '');
  
  // Remove javascript: protocol
  sanitized = sanitized.replace(/javascript:/gi, '');
  
  // Remove data: URLs that could contain scripts
  sanitized = sanitized.replace(/data:text\/html/gi, '');
  
  return sanitized;
}

