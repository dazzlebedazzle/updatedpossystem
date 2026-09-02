import { NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth-helper';
import { hasPermission, MODULES, OPERATIONS } from '@/lib/permissions';
import { targetDB } from '@/lib/database';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function PUT(request, { params }) {
  try {
    const { id } = await params;
    const session = await getSessionFromRequest(request);

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!hasPermission(session.permissions, MODULES.REPORTS, OPERATIONS.UPDATE)) {
      return NextResponse.json({ error: 'Permission denied: reports:update' }, { status: 403 });
    }

    const updates = await request.json();
    const target = await targetDB.update(id, {
      targetAmount: Number(updates.targetAmount || 0),
      minimumTargetAmount: Number(updates.minimumTargetAmount || 0),
      isActive: updates.isActive !== false
    });

    if (!target) {
      return NextResponse.json({ error: 'Target not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, target });
  } catch (error) {
    console.error('Update target error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  try {
    const { id } = await params;
    const session = await getSessionFromRequest(request);

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!hasPermission(session.permissions, MODULES.REPORTS, OPERATIONS.DELETE)) {
      return NextResponse.json({ error: 'Permission denied: reports:delete' }, { status: 403 });
    }

    const deleted = await targetDB.delete(id);
    return NextResponse.json({ success: deleted });
  } catch (error) {
    console.error('Delete target error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
