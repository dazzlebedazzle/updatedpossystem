/**
 * Rate Limiter for DDoS Protection
 * Implements sliding window rate limiting with IP-based tracking
 */

// In-memory store for rate limiting
// In production, consider using Redis for distributed systems
const requestStore = new Map();

// Configuration for different endpoint types
const RATE_LIMITS = {
  // Authentication endpoints - stricter limits
  auth: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 5, // 5 requests per 15 minutes
    blockDurationMs: 30 * 60 * 1000, // Block for 30 minutes if exceeded
  },
  // General API endpoints
  api: {
    windowMs: 1 * 60 * 1000, // 1 minute
    maxRequests: 60, // 60 requests per minute
    blockDurationMs: 10 * 60 * 1000, // Block for 10 minutes if exceeded
  },
  // Upload endpoints - very strict
  upload: {
    windowMs: 60 * 60 * 1000, // 1 hour
    maxRequests: 10, // 10 requests per hour
    blockDurationMs: 60 * 60 * 1000, // Block for 1 hour if exceeded
  },
  // Default for unknown endpoints
  default: {
    windowMs: 1 * 60 * 1000, // 1 minute
    maxRequests: 30, // 30 requests per minute
    blockDurationMs: 10 * 60 * 1000, // Block for 10 minutes if exceeded
  },
};

// Cleanup interval to prevent memory leaks
const CLEANUP_INTERVAL = 60 * 60 * 1000; // 1 hour

/**
 * Get client IP address from request
 */
function getClientIP(request) {
  // Check various headers for IP (in case of proxies/load balancers)
  const forwarded = request.headers.get('x-forwarded-for');
  const realIP = request.headers.get('x-real-ip');
  const cfConnectingIP = request.headers.get('cf-connecting-ip'); // Cloudflare
  
  if (forwarded) {
    // x-forwarded-for can contain multiple IPs, take the first one
    return forwarded.split(',')[0].trim();
  }
  
  if (realIP) {
    return realIP.trim();
  }
  
  if (cfConnectingIP) {
    return cfConnectingIP.trim();
  }
  
  // Fallback to connection remote address (if available)
  return request.ip || 'unknown';
}

/**
 * Determine endpoint type from pathname
 */
function getEndpointType(pathname) {
  if (pathname.includes('/auth/')) {
    return 'auth';
  }
  if (pathname.includes('/upload')) {
    return 'upload';
  }
  if (pathname.startsWith('/api/')) {
    return 'api';
  }
  return 'default';
}

/**
 * Clean up old entries from the store
 */
function cleanupStore() {
  const now = Date.now();
  for (const [ip, data] of requestStore.entries()) {
    // Remove entries older than 2 hours
    if (data.lastCleanup && now - data.lastCleanup > 2 * 60 * 60 * 1000) {
      requestStore.delete(ip);
    }
  }
}

// Start cleanup interval
if (typeof setInterval !== 'undefined') {
  setInterval(cleanupStore, CLEANUP_INTERVAL);
}

/**
 * Check if IP is rate limited
 * @param {Request} request - Next.js request object
 * @param {string} pathname - Optional pathname (if not provided, will be extracted from request)
 * @returns {Object} - { allowed: boolean, remaining: number, resetTime: number, retryAfter: number }
 */
export function checkRateLimit(request, pathname = null) {
  const ip = getClientIP(request);
  
  // Get pathname from request if not provided
  if (!pathname) {
    if (request.nextUrl) {
      pathname = request.nextUrl.pathname;
    } else if (request.url) {
      pathname = new URL(request.url).pathname;
    } else {
      pathname = '/';
    }
  }
  
  const endpointType = getEndpointType(pathname);
  const config = RATE_LIMITS[endpointType] || RATE_LIMITS.default;
  
  const now = Date.now();
  
  // Get or create IP entry
  if (!requestStore.has(ip)) {
    requestStore.set(ip, {
      requests: [],
      blockedUntil: null,
      lastCleanup: now,
    });
  }
  
  const ipData = requestStore.get(ip);
  
  // Check if IP is currently blocked
  if (ipData.blockedUntil && now < ipData.blockedUntil) {
    const retryAfter = Math.ceil((ipData.blockedUntil - now) / 1000);
    return {
      allowed: false,
      remaining: 0,
      resetTime: ipData.blockedUntil,
      retryAfter,
      reason: 'blocked',
    };
  }
  
  // Clear block if expired
  if (ipData.blockedUntil && now >= ipData.blockedUntil) {
    ipData.blockedUntil = null;
  }
  
  // Clean old requests outside the window
  const windowStart = now - config.windowMs;
  ipData.requests = ipData.requests.filter(timestamp => timestamp > windowStart);
  
  // Check if limit exceeded
  if (ipData.requests.length >= config.maxRequests) {
    // Block the IP
    ipData.blockedUntil = now + config.blockDurationMs;
    const retryAfter = Math.ceil(config.blockDurationMs / 1000);
    
    // Log suspicious activity
    console.warn(`[RATE LIMIT] IP ${ip} exceeded limit for ${endpointType} endpoint: ${pathname}. Blocked for ${retryAfter}s`);
    
    return {
      allowed: false,
      remaining: 0,
      resetTime: ipData.blockedUntil,
      retryAfter,
      reason: 'limit_exceeded',
    };
  }
  
  // Add current request
  ipData.requests.push(now);
  ipData.lastCleanup = now;
  
  const remaining = config.maxRequests - ipData.requests.length;
  const oldestRequest = ipData.requests[0];
  const resetTime = oldestRequest ? oldestRequest + config.windowMs : now + config.windowMs;
  
  return {
    allowed: true,
    remaining,
    resetTime,
    retryAfter: 0,
    reason: 'ok',
  };
}

/**
 * Get rate limit info for an IP (without incrementing)
 */
export function getRateLimitInfo(request, pathname = null) {
  const ip = getClientIP(request);
  
  // Get pathname from request if not provided
  if (!pathname) {
    if (request.nextUrl) {
      pathname = request.nextUrl.pathname;
    } else if (request.url) {
      pathname = new URL(request.url).pathname;
    } else {
      pathname = '/';
    }
  }
  
  const endpointType = getEndpointType(pathname);
  const config = RATE_LIMITS[endpointType] || RATE_LIMITS.default;
  
  if (!requestStore.has(ip)) {
    return {
      remaining: config.maxRequests,
      resetTime: Date.now() + config.windowMs,
    };
  }
  
  const ipData = requestStore.get(ip);
  const now = Date.now();
  const windowStart = now - config.windowMs;
  const recentRequests = ipData.requests.filter(timestamp => timestamp > windowStart);
  
  return {
    remaining: Math.max(0, config.maxRequests - recentRequests.length),
    resetTime: recentRequests.length > 0 
      ? recentRequests[0] + config.windowMs 
      : now + config.windowMs,
    blocked: ipData.blockedUntil && now < ipData.blockedUntil,
    blockedUntil: ipData.blockedUntil,
  };
}

/**
 * Reset rate limit for an IP (admin function)
 */
export function resetRateLimit(ip) {
  if (requestStore.has(ip)) {
    requestStore.delete(ip);
    return true;
  }
  return false;
}

/**
 * Get all blocked IPs (admin function)
 */
export function getBlockedIPs() {
  const now = Date.now();
  const blocked = [];
  
  for (const [ip, data] of requestStore.entries()) {
    if (data.blockedUntil && now < data.blockedUntil) {
      blocked.push({
        ip,
        blockedUntil: data.blockedUntil,
        retryAfter: Math.ceil((data.blockedUntil - now) / 1000),
      });
    }
  }
  
  return blocked;
}

/**
 * Clear all rate limit data (use with caution)
 */
export function clearAllRateLimits() {
  requestStore.clear();
}

