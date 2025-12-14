import { NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth-helper';
import { userDB } from '@/lib/database';

export async function GET(request) {
  try {
    // Get session from Bearer token or cookie
    const session = await getSessionFromRequest(request);
    
    if (!session) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }
    
    // Always fetch fresh user data from database to get latest permissions
    // This ensures permissions are up-to-date even if they were changed by superadmin
    let freshUser = null;
    try {
      if (session.userId) {
        freshUser = await userDB.findById(session.userId);
      } else if (session.token) {
        // If no userId, try to find by token
        freshUser = await userDB.findByToken(session.token);
      }
    } catch (error) {
      console.error('Error fetching fresh user data:', error);
      // Fallback to session data if database fetch fails
    }
    
    // Use fresh user data if available, otherwise fallback to session
    if (freshUser) {
      const userObj = freshUser.toObject ? freshUser.toObject() : freshUser;
      const { password, ...userWithoutPassword } = userObj;
      
      return NextResponse.json({
        user: {
          id: userObj._id?.toString() || userObj.id,
          email: userObj.email,
          role: userObj.role,
          name: userObj.name,
          token: userObj.token,
          permissions: userObj.permissions || []
        }
      });
    }
    
    // Fallback to session data if database fetch failed
    return NextResponse.json({
      user: {
        id: session.userId,
        email: session.email,
        role: session.role,
        name: session.name,
        token: session.token,
        permissions: session.permissions || []
      }
    });
  } catch (error) {
    console.error('Error in /api/auth/me:', error);
    return NextResponse.json(
      { error: 'Not authenticated' },
      { status: 401 }
    );
  }
}

