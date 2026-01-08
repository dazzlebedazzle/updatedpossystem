import { NextResponse } from 'next/server';
import { subWarehouseDB } from '@/lib/database';
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
    
    const subWarehouses = await subWarehouseDB.findAll();
    return NextResponse.json({ subWarehouses });
  } catch (error) {
    console.error('Get sub-warehouses error:', error);
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
    const subWarehouse = await subWarehouseDB.create(data);
    return NextResponse.json({ success: true, subWarehouse });
  } catch (error) {
    console.error('Create sub-warehouse error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

