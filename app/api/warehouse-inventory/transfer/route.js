import { NextResponse } from 'next/server';
import { warehouseInventoryDB } from '@/lib/database';
import { hasPermission, MODULES, OPERATIONS } from '@/lib/permissions';
import { getSessionFromRequest } from '@/lib/auth-helper';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// POST - Transfer stock between warehouses
export async function POST(request) {
  try {
    const session = await getSessionFromRequest(request);
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    if (!hasPermission(session.permissions, MODULES.INVENTORY, OPERATIONS.UPDATE)) {
      return NextResponse.json({ error: 'Permission denied: inventory:update' }, { status: 403 });
    }
    
    const { warehouseInventoryId, from, fromId, to, toId, quantity, notes } = await request.json();
    
    if (!warehouseInventoryId || !from || !to || !quantity) {
      return NextResponse.json(
        { error: 'Warehouse inventory ID, from, to, and quantity are required' },
        { status: 400 }
      );
    }
    
    if (from === to && fromId === toId) {
      return NextResponse.json(
        { error: 'Source and destination cannot be the same' },
        { status: 400 }
      );
    }
    
    // Get current warehouse inventory
    const warehouseInventory = await warehouseInventoryDB.findById(warehouseInventoryId);
    if (!warehouseInventory) {
      return NextResponse.json({ error: 'Warehouse inventory not found' }, { status: 404 });
    }
    
    const warehouseObj = warehouseInventory.toObject ? warehouseInventory.toObject() : warehouseInventory;
    
    let sourceQty = 0;
    let destQty = 0;
    let updates = {};
    
    // Handle source location
    if (from === 'main_warehouse') {
      sourceQty = warehouseObj.mainWarehouseQty || 0;
      if (sourceQty < quantity) {
        return NextResponse.json(
          { error: `Insufficient stock in Main Warehouse. Available: ${sourceQty}` },
          { status: 400 }
        );
      }
      updates.mainWarehouseQty = sourceQty - quantity;
    } else if (from === 'sub_warehouse') {
      if (!fromId) {
        return NextResponse.json({ error: 'Sub-warehouse ID is required' }, { status: 400 });
      }
      const subWarehouseStock = warehouseObj.subWarehouseStock || [];
      const sourceStock = subWarehouseStock.find(s => s.subWarehouseId?.toString() === fromId.toString());
      sourceQty = sourceStock?.quantity || 0;
      if (sourceQty < quantity) {
        return NextResponse.json(
          { error: `Insufficient stock in selected sub-warehouse. Available: ${sourceQty}` },
          { status: 400 }
        );
      }
      // Update sub-warehouse stock array
      updates.$set = updates.$set || {};
      updates.$set['subWarehouseStock'] = subWarehouseStock.map(s => {
        if (s.subWarehouseId?.toString() === fromId.toString()) {
          return { ...s, quantity: s.quantity - quantity };
        }
        return s;
      });
    } else if (from === 'shop') {
      if (!fromId) {
        return NextResponse.json({ error: 'Shop ID is required' }, { status: 400 });
      }
      const shopStock = warehouseObj.shopStock || [];
      const sourceStock = shopStock.find(s => s.shopId?.toString() === fromId.toString());
      sourceQty = sourceStock?.quantity || 0;
      if (sourceQty < quantity) {
        return NextResponse.json(
          { error: `Insufficient stock in selected shop. Available: ${sourceQty}` },
          { status: 400 }
        );
      }
      // Update shop stock array
      updates.$set = updates.$set || {};
      updates.$set['shopStock'] = shopStock.map(s => {
        if (s.shopId?.toString() === fromId.toString()) {
          return { ...s, quantity: s.quantity - quantity };
        }
        return s;
      });
    }
    
    // Handle destination location
    if (to === 'main_warehouse') {
      destQty = (warehouseObj.mainWarehouseQty || 0) + quantity;
      updates.mainWarehouseQty = destQty;
    } else if (to === 'sub_warehouse') {
      if (!toId) {
        return NextResponse.json({ error: 'Sub-warehouse ID is required' }, { status: 400 });
      }
      const subWarehouseStock = updates.$set?.subWarehouseStock || warehouseObj.subWarehouseStock || [];
      const destStock = subWarehouseStock.find(s => s.subWarehouseId?.toString() === toId.toString());
      if (destStock) {
        updates.$set = updates.$set || {};
        updates.$set['subWarehouseStock'] = subWarehouseStock.map(s => {
          if (s.subWarehouseId?.toString() === toId.toString()) {
            return { ...s, quantity: s.quantity + quantity };
          }
          return s;
        });
      } else {
        // Add new sub-warehouse stock entry
        updates.$push = updates.$push || {};
        updates.$push['subWarehouseStock'] = {
          subWarehouseId: toId,
          quantity: quantity
        };
      }
    } else if (to === 'shop') {
      if (!toId) {
        return NextResponse.json({ error: 'Shop ID is required' }, { status: 400 });
      }
      const shopStock = updates.$set?.shopStock || warehouseObj.shopStock || [];
      const destStock = shopStock.find(s => s.shopId?.toString() === toId.toString());
      if (destStock) {
        updates.$set = updates.$set || {};
        updates.$set['shopStock'] = shopStock.map(s => {
          if (s.shopId?.toString() === toId.toString()) {
            return { ...s, quantity: s.quantity + quantity };
          }
          return s;
        });
      } else {
        // Add new shop stock entry
        updates.$push = updates.$push || {};
        updates.$push['shopStock'] = {
          shopId: toId,
          quantity: quantity
        };
      }
    }
    
    // Add transfer record
    updates.$push = updates.$push || {};
    if (!updates.$push.transfers) {
      updates.$push.transfers = [];
    }
    updates.$push.transfers = {
      from,
      fromId: fromId || null,
      to,
      toId: toId || null,
      quantity,
      transferredBy: session.userId,
      transferredAt: new Date(),
      notes: notes || ''
    };
    
    // Convert $set to direct updates for our custom update function
    const finalUpdates = { ...updates };
    if (finalUpdates.$set) {
      Object.assign(finalUpdates, finalUpdates.$set);
      delete finalUpdates.$set;
    }
    
    const updated = await warehouseInventoryDB.update(warehouseInventoryId, finalUpdates);
    
    // Update product qty when stock is transferred to shop
    if (to === 'shop' && toId && quantity > 0) {
      try {
        const { productDB } = await import('@/lib/database');
        const productId = warehouseObj.productId?._id || warehouseObj.productId;
        
        if (productId) {
          const product = await productDB.findById(productId);
          if (product) {
            const productObj = product.toObject ? product.toObject() : product;
            const currentQty = productObj.qty || 0;
            // Increase product qty by transferred quantity
            await productDB.update(productId, {
              qty: currentQty + quantity
            });
          }
        }
      } catch (error) {
        console.error('Error updating product qty:', error);
        // Don't fail the transfer if product update fails
      }
    }
    
    return NextResponse.json({ success: true, warehouseInventory: updated });
  } catch (error) {
    console.error('Transfer stock error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}
