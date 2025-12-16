# DDoS Protection Implementation

This document describes the comprehensive DDoS protection measures implemented in the POS system.

## Overview

The system implements multiple layers of protection against DDoS attacks:

1. **Rate Limiting** - IP-based request throttling
2. **Request Size Limits** - Protection against large payload attacks
3. **Timeout Protection** - Prevents resource exhaustion
4. **Security Headers** - Additional HTTP security headers
5. **IP Blocking** - Automatic blocking of abusive IPs

## Rate Limiting

### Implementation

Rate limiting is implemented using a sliding window algorithm with IP-based tracking. The system tracks requests per IP address and applies different limits based on endpoint type.

### Rate Limit Configuration

| Endpoint Type | Window | Max Requests | Block Duration |
|--------------|--------|--------------|----------------|
| Authentication (`/api/auth/*`) | 15 minutes | 5 requests | 30 minutes |
| Upload (`/api/upload`) | 1 hour | 10 requests | 1 hour |
| General API (`/api/*`) | 1 minute | 60 requests | 10 minutes |
| Default | 1 minute | 30 requests | 10 minutes |

### How It Works

1. Each request is tracked by IP address
2. Requests are stored with timestamps in a sliding window
3. When the limit is exceeded, the IP is temporarily blocked
4. Blocked IPs receive a `429 Too Many Requests` response
5. Rate limit information is included in response headers

### Response Headers

When rate limited, the following headers are included:

```
X-RateLimit-Limit: 60
X-RateLimit-Remaining: 0
X-RateLimit-Reset: 2024-01-01T12:00:00.000Z
Retry-After: 600
```

### IP Detection

The system checks multiple headers to detect the real client IP:
- `x-forwarded-for` (for proxies/load balancers)
- `x-real-ip` (for reverse proxies)
- `cf-connecting-ip` (for Cloudflare)
- Falls back to connection IP if available

## Request Size Limits

### Limits

- **Default endpoints**: 10MB maximum request body size
- **Upload endpoints**: 50MB maximum request body size

### Protection

- Requests exceeding the limit receive a `413 Payload Too Large` response
- Content-Length header is checked before processing
- Prevents memory exhaustion attacks

## Timeout Protection

### Configuration

- Default timeout: 30 seconds per request
- Configurable per endpoint

### Protection

- Requests exceeding the timeout receive a `408 Request Timeout` response
- Prevents resource exhaustion from slow requests
- Automatically cancels long-running operations

## Security Headers

All responses include the following security headers:

```
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
X-XSS-Protection: 1; mode=block
Strict-Transport-Security: max-age=31536000; includeSubDomains
Referrer-Policy: strict-origin-when-cross-origin
```

## Implementation Details

### Files

- `lib/rate-limiter.js` - Rate limiting logic
- `lib/request-protection.js` - Request size and timeout protection
- `lib/api-protection.js` - Wrapper utility for API routes
- `middleware.js` - Middleware that applies protection to all routes

### Middleware Integration

The middleware automatically applies protection to all API routes:

```javascript
// Rate limiting is applied automatically
// Request size validation is applied automatically
// Security headers are added automatically
```

### Manual Usage

For custom protection in API routes:

```javascript
import { withProtection } from '@/lib/api-protection';

export const POST = withProtection(async (request) => {
  // Your handler code
  return NextResponse.json({ success: true });
}, {
  timeout: 30000, // Optional: custom timeout
  validateSize: true, // Optional: enable size validation
});
```

## Monitoring and Management

### View Blocked IPs

```javascript
import { getBlockedIPs } from '@/lib/rate-limiter';

const blockedIPs = getBlockedIPs();
console.log(blockedIPs);
```

### Reset Rate Limit for IP

```javascript
import { resetRateLimit } from '@/lib/rate-limiter';

resetRateLimit('192.168.1.1');
```

### Clear All Rate Limits

```javascript
import { clearAllRateLimits } from '@/lib/rate-limiter';

clearAllRateLimits(); // Use with caution
```

## Production Considerations

### Memory Management

- The rate limiter uses an in-memory store (Map)
- Automatic cleanup runs every hour to prevent memory leaks
- Old entries (>2 hours) are automatically removed

### Scaling

For production with multiple server instances, consider:

1. **Redis-based rate limiting**: Replace in-memory store with Redis
2. **Load balancer rate limiting**: Configure rate limiting at the load balancer level
3. **CDN protection**: Use Cloudflare or similar CDN for DDoS protection
4. **WAF (Web Application Firewall)**: Additional layer of protection

### Recommended Production Setup

1. **CDN/Proxy Level**: Cloudflare or AWS CloudFront with DDoS protection
2. **Load Balancer Level**: Rate limiting at nginx/HAProxy level
3. **Application Level**: This implementation (current)
4. **Database Level**: Connection pooling and query timeouts

## Testing

### Test Rate Limiting

```bash
# Test authentication endpoint (5 requests per 15 minutes)
for i in {1..6}; do
  curl -X POST http://localhost:3000/api/auth/login \
    -H "Content-Type: application/json" \
    -d '{"email":"test@test.com","password":"test"}'
done
```

### Test Request Size Limit

```bash
# Create a large file (11MB)
dd if=/dev/zero of=large.txt bs=1M count=11

# Try to upload it
curl -X POST http://localhost:3000/api/upload \
  -F "file=@large.txt"
```

## Logging

The system logs rate limit violations:

```
[RATE LIMIT] IP 192.168.1.1 exceeded limit for auth endpoint: /api/auth/login. Blocked for 1800s
```

Monitor these logs to identify attack patterns and adjust limits if needed.

## Configuration

To adjust rate limits, edit `lib/rate-limiter.js`:

```javascript
const RATE_LIMITS = {
  auth: {
    windowMs: 15 * 60 * 1000, // Adjust window
    maxRequests: 5, // Adjust max requests
    blockDurationMs: 30 * 60 * 1000, // Adjust block duration
  },
  // ... other configurations
};
```

## Best Practices

1. **Monitor logs regularly** - Watch for rate limit violations
2. **Adjust limits based on usage** - Balance security with usability
3. **Use CDN protection** - Additional layer for production
4. **Implement CAPTCHA** - For authentication endpoints after rate limit
5. **Whitelist trusted IPs** - For internal services
6. **Regular security audits** - Review and update protection measures

## Troubleshooting

### Issue: Legitimate users getting blocked

**Solution**: Increase rate limits or implement user-based rate limiting instead of IP-based

### Issue: Memory usage growing

**Solution**: Ensure cleanup interval is running, consider Redis for distributed systems

### Issue: Rate limits not working

**Solution**: Check middleware configuration, ensure API routes are included in matcher

## Support

For issues or questions about DDoS protection, refer to:
- `lib/rate-limiter.js` - Rate limiting implementation
- `lib/request-protection.js` - Request protection utilities
- `middleware.js` - Middleware configuration

