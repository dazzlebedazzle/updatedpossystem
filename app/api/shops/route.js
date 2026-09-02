import { NextResponse } from 'next/server';
import { shopDB } from '@/lib/database';
import { hasPermission, MODULES, OPERATIONS } from '@/lib/permissions';
import { getSessionFromRequest } from '@/lib/auth-helper';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request) {
  try {
    const session = await getSessionFromRequest(request);
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    if (!hasPermission(session.permissions, MODULES.INVENTORY, OPERATIONS.READ)) {
      return NextResponse.json({ error: 'Permission denied' }, { status: 403 });
    }
    
    const { searchParams } = new URL(request.url);
    const subWarehouseId = searchParams.get('subWarehouseId');
    const userId = searchParams.get('userId');
    
    let shops = [];
    
    // Priority: userId > subWarehouseId > all
    if (userId) {
      shops = await shopDB.findByUserId(userId);
    } else if (subWarehouseId) {
      shops = await shopDB.findBySubWarehouseId(subWarehouseId);
    } else {
      // If no filter, check if user wants only their shops
      // For regular users, show only their shops
      if (session.role === 'manager') {
        const assignedShopIds = new Set((session.assignedShopIds || []).map((id) => id.toString()));
        const allShops = await shopDB.findAll();
        shops = allShops.filter((shop) => assignedShopIds.has((shop._id || shop.id).toString()));
      } else if (session.role === 'user' || session.role === 'agent') {
        shops = await shopDB.findByUserId(session.userId);
      } else {
        // Admins and superadmins see all shops
        shops = await shopDB.findAll();
      }
    }
    
    return NextResponse.json({ shops });
  } catch (error) {
    console.error('Get shops error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const session = await getSessionFromRequest(request);
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    if (!hasPermission(session.permissions, MODULES.INVENTORY, OPERATIONS.CREATE)) {
      return NextResponse.json({ error: 'Permission denied' }, { status: 403 });
    }
    
    const data = await request.json();
    const shop = await shopDB.create(data);
    return NextResponse.json({ success: true, shop });
  } catch (error) {
    console.error('Create shop error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

