import { NextResponse } from 'next/server';
import { validateRequestSize, addSecurityHeaders } from '@/lib/request-protection';
import { safeJsonParse, sanitizeSession } from '@/lib/security-utils';

export async function middleware(request) {
  const { pathname } = request.nextUrl;
  
  // Apply request protection to all API routes (rate limiting disabled)
  if (pathname.startsWith('/api/')) {
    // Check request size (still enforced for security)
    const sizeValidation = validateRequestSize(request, pathname);
    if (sizeValidation) {
      return addSecurityHeaders(sizeValidation);
    }
    
    // Rate limiting removed - all requests allowed
    // Add security headers to all API responses
    const response = NextResponse.next();
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

