import { NextResponse } from 'next/server';
import { userDB } from '@/lib/database';
import { hashPassword, getTokenByRole } from '@/lib/auth';
import { getDefaultPermissions, hasPermission, MODULES, OPERATIONS } from '@/lib/permissions';
import { safeJsonParse, sanitizeSession } from '@/lib/security-utils';
import { getPasswordPolicyFields } from '@/lib/password-policy';

// Mark this route as dynamic to prevent build-time analysis
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request) {
  try {
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

    // Check READ permission for users
    if (!hasPermission(session.permissions, MODULES.USERS, OPERATIONS.READ)) {
      return NextResponse.json(
        { error: 'Permission denied: users:read' },
        { status: 403 }
      );
    }
    
    const users = await userDB.findAll();
    // Ensure permissions are included in the response
    const usersWithPermissions = users.map(user => {
      const userObj = user.toObject ? user.toObject() : user;
      return {
        ...userObj,
        permissions: userObj.permissions || []
      };
    });
    return NextResponse.json({ users: usersWithPermissions });
  } catch (error) {
    console.error('Get users error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request) {
  try {
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
        { error: 'Only superadmin can create users' },
        { status: 403 }
      );
    }
    
    const { email, password, name, role, permissions, supplier, assignedShopIds } = await request.json();
    const requestedRole = role || 'agent';
    
    if (!email || !password || !name) {
      return NextResponse.json(
        { error: 'Email, password, and name are required' },
        { status: 400 }
      );
    }

    if (!['admin', 'agent', 'manager'].includes(requestedRole)) {
      return NextResponse.json(
        { error: 'Invalid user role' },
        { status: 400 }
      );
    }
    
    // For agents, supplier is required and must be unique
    if (requestedRole === 'agent') {
      if (!supplier || supplier.trim() === '') {
        return NextResponse.json(
          { error: 'Supplier name is required for agents' },
          { status: 400 }
        );
      }
      
      // Check if supplier name already exists (must be unique)
      const users = await userDB.findAll();
      const existingSupplier = users.find(u => 
        u.supplier && u.supplier.toLowerCase().trim() === supplier.toLowerCase().trim()
      );
      
      if (existingSupplier) {
        return NextResponse.json(
          { error: 'Supplier name already exists. Each supplier must be unique.' },
          { status: 400 }
        );
      }
    }

    if (requestedRole === 'manager' && (!Array.isArray(assignedShopIds) || assignedShopIds.length === 0)) {
      return NextResponse.json(
        { error: 'At least one store must be assigned for managers' },
        { status: 400 }
      );
    }
    
    const existingUser = await userDB.findByEmail(email);
    if (existingUser) {
      return NextResponse.json(
        { error: 'User already exists' },
        { status: 400 }
      );
    }

    // Hash password
    const hashedPassword = await hashPassword(password);
    
    // Get token based on role
    const token = getTokenByRole(requestedRole);
    
    // Use provided permissions or default permissions for the role
    const userPermissions = permissions && permissions.length > 0 
      ? permissions 
      : getDefaultPermissions(requestedRole);
    
    const newUser = await userDB.create({
      email,
      password: hashedPassword,
      name,
      role: requestedRole,
      token: token,
      permissions: userPermissions,
      supplier: requestedRole === 'agent' && supplier ? supplier.trim() : '',
      assignedShopIds: requestedRole === 'manager' ? assignedShopIds.map((id) => id.toString()) : [],
      ...getPasswordPolicyFields(requestedRole)
    });
    
    return NextResponse.json({
      success: true,
      user: {
        id: newUser._id || newUser.id,
        email: newUser.email,
        role: newUser.role,
        name: newUser.name,
        token: newUser.token,
        permissions: newUser.permissions,
        assignedShopIds: newUser.assignedShopIds || []
      }
    });
  } catch (error) {
    console.error('Create user error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
