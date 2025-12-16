import { NextResponse } from 'next/server';
import { checkRateLimit } from '@/lib/rate-limiter';
import { validateRequestSize, addSecurityHeaders } from '@/lib/request-protection';
import { safeJsonParse, sanitizeSession } from '@/lib/security-utils';

export async function middleware(request) {
  const { pathname } = request.nextUrl;
  
  // Apply rate limiting and request protection to all API routes
  if (pathname.startsWith('/api/')) {
    // Check request size
    const sizeValidation = validateRequestSize(request, pathname);
    if (sizeValidation) {
      return addSecurityHeaders(sizeValidation);
    }
    
    // Check rate limit (now async)
    const rateLimitResult = await checkRateLimit(request, pathname);
    
    if (!rateLimitResult.allowed) {
      // Create response with rate limit headers
      const response = NextResponse.json(
        {
          error: 'Too many requests',
          message: 'Rate limit exceeded. Please try again later.',
          retryAfter: rateLimitResult.retryAfter,
        },
        { status: 429 }
      );
      
      // Add rate limit headers
      response.headers.set('X-RateLimit-Limit', '60');
      response.headers.set('X-RateLimit-Remaining', '0');
      response.headers.set('X-RateLimit-Reset', new Date(rateLimitResult.resetTime).toISOString());
      response.headers.set('Retry-After', rateLimitResult.retryAfter.toString());
      
      return addSecurityHeaders(response);
    }
    
    // Add rate limit info headers for allowed requests
    const response = NextResponse.next();
    response.headers.set('X-RateLimit-Limit', '60');
    response.headers.set('X-RateLimit-Remaining', rateLimitResult.remaining.toString());
    response.headers.set('X-RateLimit-Reset', new Date(rateLimitResult.resetTime).toISOString());
    
    return addSecurityHeaders(response);
  }
  
  // Get session from cookies (secure parsing)
  const sessionCookie = request.cookies.get('session');
  let session = null;
  
  if (sessionCookie) {
    // Use safe JSON parsing with size limits
    const parsed = safeJsonParse(sessionCookie.value, 10 * 1024); // 10KB max
    if (parsed) {
      // Sanitize and validate session data
      session = sanitizeSession(parsed);
    }
  }
  
  // Public routes - allow access without authentication
  const publicRoutes = ['/login', '/register'];
  if (publicRoutes.includes(pathname) || pathname === '/') {
    // If already logged in, redirect to appropriate dashboard
    if (session) {
      if (session.role === 'superadmin') {
        return NextResponse.redirect(new URL('/superadmin/dashboard', request.url));
      } else if (session.role === 'admin') {
        return NextResponse.redirect(new URL('/admin/dashboard', request.url));
      } else if (session.role === 'agent') {
        return NextResponse.redirect(new URL('/user/dashboard', request.url));
      }
    }
    return NextResponse.next();
  }
  
  // Protected routes - require authentication
  if (!session) {
    return NextResponse.redirect(new URL('/login', request.url));
  }
  
  // Role-based route protection
  if (pathname.startsWith('/superadmin')) {
    if (session.role !== 'superadmin') {
      return NextResponse.redirect(new URL('/unauthorized', request.url));
    }
  }
  
  if (pathname.startsWith('/admin')) {
    if (!['superadmin', 'admin'].includes(session.role)) {
      return NextResponse.redirect(new URL('/unauthorized', request.url));
    }
  }
  
  if (pathname.startsWith('/user')) {
    if (!['superadmin', 'admin', 'agent'].includes(session.role)) {
      return NextResponse.redirect(new URL('/unauthorized', request.url));
    }
  }
  
  // Add security headers to all responses
  const response = NextResponse.next();
  return addSecurityHeaders(response);
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public files (files in public folder)
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)',
  ],
};

