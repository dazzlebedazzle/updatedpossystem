import { NextResponse } from 'next/server';
import { userDB } from '@/lib/database';
import { getBearerToken } from '@/lib/auth-helper';

// Mark this route as dynamic to prevent build-time analysis
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request) {
  try {
    // Get token from Bearer header, cookie, or query parameter
    const bearerToken = getBearerToken(request);
    const agentTokenCookie = request.cookies.get('agentToken');
    const { searchParams } = new URL(request.url);
    const tokenFromQuery = searchParams.get('token');
    
    // Priority: Bearer token > cookie > query parameter
    const token = bearerToken || agentTokenCookie?.value || tokenFromQuery;
    
    if (!token) {
      return NextResponse.json(
        { error: 'Token is required. Provide it as a cookie named "agentToken" or as a query parameter "token"' },
        { status: 400 }
      );
    }
    
    // Find user by token
    const user = await userDB.findByToken(token);
    
    if (!user) {
      return NextResponse.json(
        { error: 'User not found with the provided token' },
        { status: 404 }
      );
    }
    
    // Return user details (excluding password)
    const userObj = user.toObject ? user.toObject() : user;
    return NextResponse.json({
      success: true,
      user: {
        id: userObj._id?.toString() || userObj.id,
        _id: userObj._id?.toString() || userObj.id,
        name: userObj.name,
        email: userObj.email,
        role: userObj.role,
        token: userObj.token,
        supplier: userObj.supplier || null,
        permissions: userObj.permissions || [],
        isActive: userObj.isActive !== undefined ? userObj.isActive : true,
        createdAt: userObj.createdAt,
        updatedAt: userObj.updatedAt
      }
    });
  } catch (error) {
    console.error('Get user by token error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request) {
  try {
    // Get token from Bearer header first, then from request body
    const bearerToken = getBearerToken(request);
    const { token: bodyToken } = await request.json();
    
    const token = bearerToken || bodyToken;
    
    if (!token) {
      return NextResponse.json(
        { error: 'Token is required. Provide it as Bearer token in Authorization header or in request body' },
        { status: 400 }
      );
    }
    
    // Find user by token
    const user = await userDB.findByToken(token);
    
    if (!user) {
      return NextResponse.json(
        { error: 'User not found with the provided token' },
        { status: 404 }
      );
    }
    
    // Return user details (excluding password)
    const userObj = user.toObject ? user.toObject() : user;
    return NextResponse.json({
      success: true,
      user: {
        id: userObj._id?.toString() || userObj.id,
        _id: userObj._id?.toString() || userObj.id,
        name: userObj.name,
        email: userObj.email,
        role: userObj.role,
        token: userObj.token,
        supplier: userObj.supplier || null,
        permissions: userObj.permissions || [],
        isActive: userObj.isActive !== undefined ? userObj.isActive : true,
        createdAt: userObj.createdAt,
        updatedAt: userObj.updatedAt
      }
    });
  } catch (error) {
    console.error('Get user by token error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

