import { NextResponse } from 'next/server';
import { userDB } from '@/lib/database';
import { hashPassword } from '@/lib/auth';
import { safeJsonParse, sanitizeSession } from '@/lib/security-utils';

// Mark this route as dynamic to prevent build-time analysis
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request, { params }) {
  try {
    const { id } = await params;
    const sessionCookie = request.cookies.get('session');
    let session = null;
    
    if (sessionCookie) {
      // Use safe JSON parsing with size limits
      const parsed = safeJsonParse(sessionCookie.value, 10 * 1024); // 10KB max
      if (parsed) {
        session = sanitizeSession(parsed);
      }
      
      if (!session) {
        return NextResponse.json(
          { error: 'Unauthorized' },
          { status: 401 }
        );
      }
    }
    
    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }
    
    const user = await userDB.findById(id);
    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }
    
    const userObj = user.toObject ? user.toObject() : user;
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password, ...userWithoutPassword } = userObj;
    return NextResponse.json({ user: userWithoutPassword });
  } catch (error) {
    console.error('Get user error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PUT(request, { params }) {
  try {
    const { id } = await params;
    const sessionCookie = request.cookies.get('session');
    let session = null;
    
    if (sessionCookie) {
      // Use safe JSON parsing with size limits
      const parsed = safeJsonParse(sessionCookie.value, 10 * 1024); // 10KB max
      if (parsed) {
        session = sanitizeSession(parsed);
      }
      
      if (!session) {
        return NextResponse.json(
          { error: 'Unauthorized' },
          { status: 401 }
        );
      }
    }
    
    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }
    
    // Only superadmin can update users, or users can update themselves
    const userId = session.userId?.toString();
    const paramId = id;
    if (session.role !== 'superadmin' && userId !== paramId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 403 }
      );
    }
    
    const updates = await request.json();
    
    // Check for supplier uniqueness if supplier is being updated for an agent
    if (updates.role === 'agent' && updates.supplier && updates.supplier.trim() !== '') {
      // Get all users to check supplier uniqueness
      const allUsers = await userDB.findAll();
      const existingSupplier = allUsers.find(u => {
        const userId = (u._id || u.id).toString();
        const currentUserId = id.toString();
        // Skip the current user being updated
        if (userId === currentUserId) return false;
        return u.supplier && u.supplier.toLowerCase().trim() === updates.supplier.toLowerCase().trim();
      });
      
      if (existingSupplier) {
        return NextResponse.json(
          { error: 'Supplier name already exists. Each supplier must be unique.' },
          { status: 400 }
        );
      }
    }
    
    // Hash password if it's being updated
    if (updates.password) {
      updates.password = await hashPassword(updates.password);
    }
    
    // Remove newPassword field if it exists (we only use password)
    delete updates.newPassword;
    
    const updatedUser = await userDB.update(id, updates);
    
    if (!updatedUser) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }
    
    const userObj = updatedUser.toObject ? updatedUser.toObject() : updatedUser;
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password, ...userWithoutPassword } = userObj;
    
    // If permissions were updated and this is the current user, update their session
    if (updates.permissions && userId === paramId) {
      const { createSession } = await import('@/lib/auth');
      const { session, token } = createSession(userObj);
      
      const response = NextResponse.json({ 
        user: userWithoutPassword,
        sessionUpdated: true 
      });
      
      // Update session cookie with new permissions
      response.cookies.set('session', JSON.stringify(session), {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 7 // 7 days
      });
      
      // Update JWT token cookie
      response.cookies.set('token', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 7 // 7 days
      });
      
      return response;
    }
    
    return NextResponse.json({ user: userWithoutPassword });
  } catch (error) {
    console.error('Update user error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function DELETE(request, { params }) {
  try {
    const { id } = await params;
    const sessionCookie = request.cookies.get('session');
    let session = null;
    
    if (sessionCookie) {
      // Use safe JSON parsing with size limits
      const parsed = safeJsonParse(sessionCookie.value, 10 * 1024); // 10KB max
      if (parsed) {
        session = sanitizeSession(parsed);
      }
      
      if (!session) {
        return NextResponse.json(
          { error: 'Unauthorized' },
          { status: 401 }
        );
      }
    }
    
    if (!session || session.role !== 'superadmin') {
      return NextResponse.json(
        { error: 'Only superadmin can delete users' },
        { status: 403 }
      );
    }
    
    const deleted = await userDB.delete(id);
    if (!deleted) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete user error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
