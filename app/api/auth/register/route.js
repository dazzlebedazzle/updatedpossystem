import { NextResponse } from 'next/server';
import { userDB } from '@/lib/database';
import { createSession, hashPassword, getTokenByRole } from '@/lib/auth';
import { getDefaultPermissions } from '@/lib/permissions';
import { safeJsonParse, sanitizeSession } from '@/lib/security-utils';

// Mark this route as dynamic to prevent build-time analysis
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(request) {
  try {
    const { email, password, name, role } = await request.json();
    
    if (!email || !password || !name) {
      return NextResponse.json(
        { error: 'Email, password, and name are required' },
        { status: 400 }
      );
    }
    
    // Check if user already exists
    const existingUser = await userDB.findByEmail(email);
    if (existingUser) {
      return NextResponse.json(
        { error: 'User already exists' },
        { status: 400 }
      );
    }
    
    // Only superadmin can create admin, only admin/superadmin can create agents
    const sessionCookie = request.cookies.get('session');
    let currentUser = null;
    
    if (sessionCookie) {
      try {
        currentUser = JSON.parse(sessionCookie.value);
      } catch (e) {
        currentUser = null;
      }
    }
    
    // Determine default role
    let userRole = role || 'agent';
    
    if (userRole === 'superadmin') {
      return NextResponse.json(
        { error: 'Cannot create superadmin account' },
        { status: 403 }
      );
    }
    
    if (userRole === 'admin' && currentUser?.role !== 'superadmin') {
      return NextResponse.json(
        { error: 'Only superadmin can create admin accounts' },
        { status: 403 }
      );
    }

    // Hash password
    const hashedPassword = await hashPassword(password);
    
    // Get token based on role
    const token = getTokenByRole(userRole);
    
    const newUser = await userDB.create({
      email,
      password: hashedPassword,
      name,
      role: userRole,
      token: token,
      permissions: getDefaultPermissions(userRole)
    });
    
    const { session, token: jwtToken } = createSession(newUser);
    
    const response = NextResponse.json({
      success: true,
      user: {
        id: newUser._id || newUser.id,
        email: newUser.email,
        role: newUser.role,
        name: newUser.name,
        token: newUser.token
      }
    });
    
    response.cookies.set('session', JSON.stringify(session), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7
    });

    response.cookies.set('token', jwtToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7
    });
    
    return response;
  } catch (error) {
    console.error('Register error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
