import { NextResponse } from 'next/server';

export async function POST(request) {
  try {
    const response = NextResponse.json({ 
      success: true,
      message: 'Logged out successfully' 
    });
    
    // Delete session cookie with proper settings
    response.cookies.set('session', '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 0,
      path: '/'
    });
    
    // Delete token cookie with proper settings
    response.cookies.set('token', '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 0,
      path: '/'
    });
    
    // Also try to delete using delete method (for compatibility)
    response.cookies.delete('session');
    response.cookies.delete('token');
    
    // Add CORS headers if needed
    response.headers.set('Access-Control-Allow-Origin', '*');
    response.headers.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
    response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    
    return response;
  } catch (error) {
    console.error('Logout error:', error);
    // Even if there's an error, try to clear cookies and return success
    const errorResponse = NextResponse.json({ 
      success: true,
      message: 'Logged out successfully' 
    });
    
    errorResponse.cookies.set('session', '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 0,
      path: '/'
    });
    
    errorResponse.cookies.set('token', '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 0,
      path: '/'
    });
    
    return errorResponse;
  }
}

// Handle OPTIONS request for CORS preflight
export async function OPTIONS(request) {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}
