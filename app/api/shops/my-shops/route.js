import { NextResponse } from 'next/server';
import { shopDB } from '@/lib/database';
import { getSessionFromRequest } from '@/lib/auth-helper';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// GET - Get shops associated with the logged-in user
export async function GET(request) {
  try {
    const session = await getSessionFromRequest(request);
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    if (!session.userId) {
      return NextResponse.json({ error: 'User ID not found in session' }, { status: 400 });
    }
    
    // Get shops associated with the logged-in user
    const shops = await shopDB.findByUserId(session.userId);
    
    return NextResponse.json({ 
      success: true, 
      shops,
      userId: session.userId,
      userName: session.name 
    });
  } catch (error) {
    console.error('Get user shops error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

