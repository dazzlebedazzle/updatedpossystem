import { NextResponse } from 'next/server';
import { inventoryDB, productDB, userDB } from '@/lib/database';
import { hasPermission, MODULES, OPERATIONS } from '@/lib/permissions';
import { getSessionFromRequest } from '@/lib/auth-helper';

// Mark this route as dynamic to prevent build-time analysis
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request) {
  try {
    // Get session from Bearer token or cookie
    const session = await getSessionFromRequest(request);
    
    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Check READ permission for inventory
    if (!hasPermission(session.permissions, MODULES.INVENTORY, OPERATIONS.READ)) {
      return NextResponse.json(
        { error: 'Permission denied: inventory:read' },
        { status: 403 }
      );
    }
    
    let inventory = await inventoryDB.findAll();
    
    // Filter inventory based on user's token
    // If user is an agent, show only their own inventory updates
    // Superadmins and admins see all inventory
    if (session.token === 'agentToken' && session.role === 'agent') {
      const sessionUserId = session.userId?.toString();
      inventory = inventory.filter(item => {
        const itemObj = item.toObject ? item.toObject() : item;
        const itemUserId = itemObj.userId?._id?.toString() || itemObj.userId?.toString() || itemObj.userId;
        return itemUserId === sessionUserId;
      });
    }
    
    return NextResponse.json({ inventory });
  } catch (error) {
    console.error('Get inventory error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request) {
  try {
    // Get session from Bearer token or cookie
    const session = await getSessionFromRequest(request);
    
    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Check CREATE permission for inventory
    if (!hasPermission(session.permissions, MODULES.INVENTORY, OPERATIONS.CREATE)) {
      return NextResponse.json(
        { error: 'Permission denied: inventory:create' },
        { status: 403 }
      );
    }
    
    const { productId, quantity, type, notes } = await request.json();
    
    if (!productId || !quantity || !type) {
      return NextResponse.json(
        { error: 'Product ID, quantity, and type are required' },
        { status: 400 }
      );
    }
    
    const product = await productDB.findById(productId);
    if (!product) {
      return NextResponse.json(
        { error: 'Product not found' },
        { status: 400 }
      );
    }
    
    // Update product stock based on type
    if (type === 'add') {
      await productDB.update(productId, {
        stock: product.stock + parseInt(quantity)
      });
    } else if (type === 'remove') {
      if (product.stock < quantity) {
        return NextResponse.json(
          { error: 'Insufficient stock' },
          { status: 400 }
        );
      }
      await productDB.update(productId, {
        stock: product.stock - parseInt(quantity)
      });
    }
    
    const inventoryItem = await inventoryDB.create({
      productId,
      quantity: parseInt(quantity),
      type,
      notes: notes || '',
      userId: session.userId
    });
    
    return NextResponse.json({ success: true, inventory: inventoryItem });
  } catch (error) {
    console.error('Update inventory error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
