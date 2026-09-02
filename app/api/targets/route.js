import { NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth-helper';
import { hasPermission, MODULES, OPERATIONS } from '@/lib/permissions';
import { shopDB, targetDB } from '@/lib/database';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request) {
  try {
    const session = await getSessionFromRequest(request);

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!hasPermission(session.permissions, MODULES.REPORTS, OPERATIONS.READ)) {
      return NextResponse.json({ error: 'Permission denied: reports:read' }, { status: 403 });
    }

    const targets = await targetDB.findAll();
    return NextResponse.json({ targets });
  } catch (error) {
    console.error('Get targets error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const session = await getSessionFromRequest(request);

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!hasPermission(session.permissions, MODULES.REPORTS, OPERATIONS.UPDATE)) {
      return NextResponse.json({ error: 'Permission denied: reports:update' }, { status: 403 });
    }

    const { shopId, targetAmount, minimumTargetAmount, isActive = true } = await request.json();

    if (!shopId) {
      return NextResponse.json({ error: 'Store is required' }, { status: 400 });
    }

    if (!targetAmount || Number(targetAmount) <= 0) {
      return NextResponse.json({ error: 'Target amount must be greater than 0' }, { status: 400 });
    }

    const shop = await shopDB.findById(shopId);
    if (!shop) {
      return NextResponse.json({ error: 'Store not found' }, { status: 404 });
    }

    const shopObj = shop.toObject ? shop.toObject() : shop;
    const target = await targetDB.createOrUpdate({
      shopId,
      shopName: shopObj.name,
      period: 'monthly',
      targetAmount: Number(targetAmount),
      minimumTargetAmount: Number(minimumTargetAmount || 0),
      isActive,
      createdBy: session.userId
    });

    return NextResponse.json({ success: true, target });
  } catch (error) {
    console.error('Save target error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
