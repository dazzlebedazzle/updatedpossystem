import { NextResponse } from 'next/server';
import { userDB } from '@/lib/database';
import { createSession, comparePassword } from '@/lib/auth';
import { getPasswordPolicyFields, isPasswordExpired, needsPasswordPolicyBackfill } from '@/lib/password-policy';

// Mark this route as dynamic to prevent build-time analysis
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(request) {
  try {
    const { email, password } = await request.json();
    
    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      );
    }
    
    const user = await userDB.findByEmail(email);
    
    if (!user) {
      return NextResponse.json(
        { error: 'Invalid credentials' },
        { status: 401 }
      );
    }

    // Compare password
    const isPasswordValid = await comparePassword(password, user.password);
    if (!isPasswordValid) {
      return NextResponse.json(
        { error: 'Invalid credentials' },
        { status: 401 }
      );
    }

    let sessionUser = user;
    if (needsPasswordPolicyBackfill(user)) {
      sessionUser = await userDB.update(user._id || user.id, getPasswordPolicyFields(user.role));
    } else if (isPasswordExpired(user)) {
      sessionUser = await userDB.markPasswordChangeRequired(user._id || user.id);
    }
    
    const { session, token } = createSession(sessionUser);
    
    const response = NextResponse.json({
      success: true,
      user: {
        id: sessionUser._id || sessionUser.id,
        email: sessionUser.email,
        role: sessionUser.role,
        name: sessionUser.name,
        token: sessionUser.token,
        assignedShopIds: (sessionUser.assignedShopIds || []).map((id) => id.toString()),
        mustChangePassword: Boolean(sessionUser.mustChangePassword),
        passwordExpiresAt: sessionUser.passwordExpiresAt || null
      },
      jwtToken: token // Include JWT token in response for Bearer authentication
    });
    
    // Set session cookie
    response.cookies.set('session', JSON.stringify(session), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7 // 7 days
    });

    // Set JWT token cookie
    response.cookies.set('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7 // 7 days
    });
    
    return response;
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
