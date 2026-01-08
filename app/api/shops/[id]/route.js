import { NextResponse } from 'next/server';
import { shopDB } from '@/lib/database';
import { hasPermission, MODULES, OPERATIONS } from '@/lib/permissions';
import { getSessionFromRequest } from '@/lib/auth-helper';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function PUT(request, { params }) {
  try {
    const session = await getSessionFromRequest(request);
    const { id } = params;
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    if (!hasPermission(session.permissions, MODULES.INVENTORY, OPERATIONS.UPDATE)) {
      return NextResponse.json({ error: 'Permission denied' }, { status: 403 });
    }
    
    const data = await request.json();
    const shop = await shopDB.update(id, data);
    return NextResponse.json({ success: true, shop });
  } catch (error) {
    console.error('Update shop error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  try {
    const session = await getSessionFromRequest(request);
    const { id } = params;
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    if (!hasPermission(session.permissions, MODULES.INVENTORY, OPERATIONS.DELETE)) {
      return NextResponse.json({ error: 'Permission denied' }, { status: 403 });
    }
    
    const deleted = await shopDB.delete(id);
    return NextResponse.json({ success: deleted });
  } catch (error) {
    console.error('Delete shop error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

