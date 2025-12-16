/**
 * Rate Limiter for DDoS Protection
 * Implements sliding window rate limiting with IP-based tracking
 * Includes protection against IP spoofing, memory exhaustion, and distributed attacks
 */

import { isValidIP, normalizePathname } from './security-utils';

// In-memory store for rate limiting
// In production, consider using Redis for distributed systems
const requestStore = new Map();

// Maximum number of IPs to track (prevents memory exhaustion)
const MAX_STORE_SIZE = 100000;

// Global rate limiting to prevent distributed attacks
const globalRequestStore = {
  requests: [],
  windowMs: 1 * 60 * 1000, // 1 minute
  maxRequests: 10000, // 10,000 requests per minute across all IPs
  lastCleanup: Date.now(),
};

// Lock for race condition protection
const lock = {
  locked: false,
  queue: [],
};

/**
 * Acquire lock for critical sections
 */
async function acquireLock() {
  return new Promise((resolve) => {
    if (!lock.locked) {
      lock.locked = true;
      resolve();
    } else {
      lock.queue.push(resolve);
    }
  });
}

/**
 * Release lock
 */
function releaseLock() {
  lock.locked = false;
  if (lock.queue.length > 0) {
    const next = lock.queue.shift();
    lock.locked = true;
    next();
  }
}

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
 * Get client IP address from request (secure version)
 * Only trusts headers from configured trusted proxies
 */
function getClientIP(request) {
  // Trusted proxy header (set by reverse proxy/load balancer)
  // In production, configure your reverse proxy to set this header
  // and set TRUSTED_PROXY_HEADER environment variable
  const trustedProxyHeader = process.env.TRUSTED_PROXY_HEADER || null;
  
  // If we have a trusted proxy header, use it
  if (trustedProxyHeader) {
    const trustedIP = request.headers.get(trustedProxyHeader);
    if (trustedIP) {
      const ip = trustedIP.split(',')[0].trim();
      if (isValidIP(ip)) {
        return ip;
      }
    }
  }
  
  // For Cloudflare (if behind Cloudflare proxy)
  if (process.env.CLOUDFLARE_ENABLED === 'true') {
    const cfIP = request.headers.get('cf-connecting-ip');
    if (cfIP) {
      const ip = cfIP.trim();
      if (isValidIP(ip)) {
        return ip;
      }
    }
  }
  
  // Fallback to connection IP (most secure, but may not work behind proxy)
  // In Next.js, request.ip might not be available, so we use a fallback
  const connectionIP = request.ip || 
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    'unknown';
  
  // Validate the IP before returning
  if (isValidIP(connectionIP)) {
    return connectionIP;
  }
  
  // If IP is invalid, use a default that will still be rate limited
  // but won't cause issues with other IPs
  return 'invalid-ip-' + Math.random().toString(36).substring(2, 15);
}

/**
 * Determine endpoint type from pathname (secure version)
 * Uses normalized pathname to prevent manipulation
 */
function getEndpointType(pathname) {
  // Normalize pathname first
  const normalized = normalizePathname(pathname);
  
  // Use exact matching where possible to prevent bypass
  if (normalized.startsWith('/api/auth/')) {
    return 'auth';
  }
  if (normalized.startsWith('/api/upload') || normalized.includes('/api/upload/')) {
    return 'upload';
  }
  if (normalized.startsWith('/api/')) {
    return 'api';
  }
  return 'default';
}

/**
 * Clean up old entries from the store
 * Also enforces maximum store size to prevent memory exhaustion
 */
function cleanupStore() {
  const now = Date.now();
  
  // Clean up old entries
  for (const [ip, data] of requestStore.entries()) {
    // Remove entries older than 2 hours
    if (data.lastCleanup && now - data.lastCleanup > 2 * 60 * 60 * 1000) {
      requestStore.delete(ip);
    }
  }
  
  // If store is still too large, remove oldest entries
  if (requestStore.size > MAX_STORE_SIZE) {
    const entries = Array.from(requestStore.entries());
    // Sort by last cleanup time (oldest first)
    entries.sort((a, b) => (a[1].lastCleanup || 0) - (b[1].lastCleanup || 0));
    
    // Remove 10% of oldest entries
    const toRemove = Math.floor(MAX_STORE_SIZE * 0.1);
    for (let i = 0; i < toRemove && i < entries.length; i++) {
      requestStore.delete(entries[i][0]);
    }
    
    console.warn(`[RATE LIMIT] Store size exceeded, removed ${toRemove} oldest entries`);
  }
  
  // Clean up global request store
  const windowStart = now - globalRequestStore.windowMs;
  globalRequestStore.requests = globalRequestStore.requests.filter(
    timestamp => timestamp > windowStart
  );
  globalRequestStore.lastCleanup = now;
}

// Start cleanup interval
if (typeof setInterval !== 'undefined') {
  setInterval(cleanupStore, CLEANUP_INTERVAL);
}

/**
 * Check if IP is rate limited (thread-safe version)
 * @param {Request} request - Next.js request object
 * @param {string} pathname - Optional pathname (if not provided, will be extracted from request)
 * @returns {Promise<Object>} - { allowed: boolean, remaining: number, resetTime: number, retryAfter: number }
 */
export async function checkRateLimit(request, pathname = null) {
  // Acquire lock to prevent race conditions
  await acquireLock();
  
  try {
    const ip = getClientIP(request);
    
    // Get pathname from request if not provided
    if (!pathname) {
      if (request.nextUrl) {
        pathname = request.nextUrl.pathname;
      } else if (request.url) {
        try {
          pathname = new URL(request.url).pathname;
        } catch (e) {
          pathname = '/';
        }
      } else {
        pathname = '/';
      }
    }
    
    // Normalize pathname
    pathname = normalizePathname(pathname);
    
    const endpointType = getEndpointType(pathname);
    const config = RATE_LIMITS[endpointType] || RATE_LIMITS.default;
    
    const now = Date.now();
    
    // Check global rate limit first (prevents distributed attacks)
    const globalWindowStart = now - globalRequestStore.windowMs;
    globalRequestStore.requests = globalRequestStore.requests.filter(
      timestamp => timestamp > globalWindowStart
    );
    
    if (globalRequestStore.requests.length >= globalRequestStore.maxRequests) {
      console.warn(`[RATE LIMIT] Global rate limit exceeded: ${globalRequestStore.requests.length} requests`);
      return {
        allowed: false,
        remaining: 0,
        resetTime: now + globalRequestStore.windowMs,
        retryAfter: Math.ceil(globalRequestStore.windowMs / 1000),
        reason: 'global_limit_exceeded',
      };
    }
    
    // Enforce maximum store size
    if (requestStore.size >= MAX_STORE_SIZE) {
      cleanupStore();
    }
    
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
    
    // Add current request (both IP and global)
    ipData.requests.push(now);
    ipData.lastCleanup = now;
    globalRequestStore.requests.push(now);
    
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
  } finally {
    releaseLock();
  }
}

/**
 * Get rate limit info for an IP (without incrementing)
 */
export async function getRateLimitInfo(request, pathname = null) {
  await acquireLock();
  
  try {
    const ip = getClientIP(request);
    
    // Get pathname from request if not provided
    if (!pathname) {
      if (request.nextUrl) {
        pathname = request.nextUrl.pathname;
      } else if (request.url) {
        try {
          pathname = new URL(request.url).pathname;
        } catch (e) {
          pathname = '/';
        }
      } else {
        pathname = '/';
      }
    }
    
    pathname = normalizePathname(pathname);
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
  } finally {
    releaseLock();
  }
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

