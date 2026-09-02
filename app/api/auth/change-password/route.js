import { NextResponse } from 'next/server';
import { userDB } from '@/lib/database';
import { comparePassword, createSession, hashPassword } from '@/lib/auth';
import { getSessionFromRequest } from '@/lib/auth-helper';
import { getPasswordPolicyFields } from '@/lib/password-policy';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(request) {
  try {
    const session = await getSessionFromRequest(request);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { currentPassword, newPassword } = await request.json();

    if (!currentPassword || !newPassword) {
      return NextResponse.json({ error: 'Current password and new password are required' }, { status: 400 });
    }

    if (newPassword.length < 8) {
      return NextResponse.json({ error: 'New password must be at least 8 characters' }, { status: 400 });
    }

    if (currentPassword === newPassword) {
      return NextResponse.json({ error: 'New password must be different from current password' }, { status: 400 });
    }

    const user = await userDB.findById(session.userId);
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const isCurrentPasswordValid = await comparePassword(currentPassword, user.password);
    if (!isCurrentPasswordValid) {
      return NextResponse.json({ error: 'Current password is incorrect' }, { status: 400 });
    }

    const hashedPassword = await hashPassword(newPassword);
    const updatedUser = await userDB.update(session.userId, {
      password: hashedPassword,
      ...getPasswordPolicyFields(user.role)
    });
    const updatedUserObj = updatedUser.toObject ? updatedUser.toObject() : updatedUser;
    const { session: nextSession, token } = createSession(updatedUserObj);

    const response = NextResponse.json({
      success: true,
      user: {
        id: updatedUserObj._id?.toString() || updatedUserObj.id,
        email: updatedUserObj.email,
        role: updatedUserObj.role,
        name: updatedUserObj.name,
        permissions: updatedUserObj.permissions || [],
        assignedShopIds: (updatedUserObj.assignedShopIds || []).map((id) => id.toString()),
        mustChangePassword: Boolean(updatedUserObj.mustChangePassword),
        passwordExpiresAt: updatedUserObj.passwordExpiresAt || null
      }
    });

    response.cookies.set('session', JSON.stringify(nextSession), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7
    });

    response.cookies.set('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7
    });

    return response;
  } catch (error) {
    console.error('Change password error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
