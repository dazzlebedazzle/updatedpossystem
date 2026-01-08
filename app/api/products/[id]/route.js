import { NextResponse } from 'next/server';
import { productDB } from '@/lib/database';
import { hasPermission, MODULES, OPERATIONS } from '@/lib/permissions';
import { getSessionFromRequest } from '@/lib/auth-helper';

// Mark this route as dynamic to prevent build-time analysis
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request, { params }) {
  try {
    const { id } = await params;
    const session = await getSessionFromRequest(request);
    
    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }
    
    // Check READ permission for products
    if (!hasPermission(session.permissions, MODULES.PRODUCTS, OPERATIONS.READ)) {
      return NextResponse.json(
        { error: 'Permission denied: products:read' },
        { status: 403 }
      );
    }
    
    const product = await productDB.findById(id);
    if (!product) {
      return NextResponse.json(
        { error: 'Product not found' },
        { status: 404 }
      );
    }
    
    return NextResponse.json({ product });
  } catch (error) {
    console.error('Get product error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PUT(request, { params }) {
  try {
    const { id } = await params;
    const session = await getSessionFromRequest(request);
    
    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }
    
    // Check UPDATE permission for products
    if (!hasPermission(session.permissions, MODULES.PRODUCTS, OPERATIONS.UPDATE)) {
      return NextResponse.json(
        { error: 'Permission denied: products:update' },
        { status: 403 }
      );
    }
    
    const updates = await request.json();
    const { shopId, qty } = updates;
    
    // Get old product to check if shopId changed
    const oldProduct = await productDB.findById(id);
    const oldProductObj = oldProduct?.toObject ? oldProduct.toObject() : oldProduct;
    const oldShopId = oldProductObj?.shopId;
    
    const updatedProduct = await productDB.update(id, updates);
    
    if (!updatedProduct) {
      return NextResponse.json(
        { error: 'Product not found' },
        { status: 404 }
      );
    }
    
    // If shopId is provided and different from old, or qty changed, update warehouse inventory
    if (shopId && qty !== undefined) {
      try {
        const { warehouseInventoryDB } = await import('@/lib/database');
        const productObj = updatedProduct.toObject ? updatedProduct.toObject() : updatedProduct;
        const productId = productObj._id || productObj.id;
        const quantity = parseInt(qty || 0);
        
        // Get or create warehouse inventory for this product
        let warehouseInventory = await warehouseInventoryDB.findByProductId(productId);
        
        if (!warehouseInventory) {
          // Create new warehouse inventory entry
          const productDetails = {
            EAN_code: productObj.EAN_code,
            product_name: productObj.product_name,
            category: productObj.category || 'general',
            unit: productObj.unit || 'kg',
            price: productObj.price || 0,
            supplier: productObj.supplier || '',
            expiry_date: productObj.expiry_date || '',
            date_arrival: productObj.date_arrival || ''
          };
          
          warehouseInventory = await warehouseInventoryDB.createOrUpdate(productId, {
            mainWarehouseQty: 0,
            subWarehouseStock: [],
            shopStock: [{
              shopId: shopId,
              quantity: quantity
            }],
            productDetails
          });
        } else {
          const warehouseObj = warehouseInventory.toObject ? warehouseInventory.toObject() : warehouseInventory;
          const shopStock = warehouseObj.shopStock || [];
          
          // If shopId changed, remove old shop stock and add new
          if (oldShopId && oldShopId.toString() !== shopId.toString()) {
            const filteredShopStock = shopStock.filter(s => s.shopId?.toString() !== oldShopId.toString());
            filteredShopStock.push({
              shopId: shopId,
              quantity: quantity
            });
            await warehouseInventoryDB.update(warehouseObj._id, {
              $set: {
                shopStock: filteredShopStock
              }
            });
          } else {
            // Update existing shop stock or add new
            const existingShopStock = shopStock.find(s => s.shopId?.toString() === shopId.toString());
            
            if (existingShopStock) {
              // Update quantity
              existingShopStock.quantity = quantity;
              await warehouseInventoryDB.update(warehouseObj._id, {
                $set: {
                  shopStock: shopStock
                }
              });
            } else {
              // Add new shop stock entry
              await warehouseInventoryDB.update(warehouseObj._id, {
                $push: {
                  shopStock: {
                    shopId: shopId,
                    quantity: quantity
                  }
                }
              });
            }
          }
        }
      } catch (error) {
        console.error('Error updating warehouse inventory:', error);
        // Don't fail the product update if inventory update fails
      }
    }
    
    return NextResponse.json({ success: true, product: updatedProduct });
  } catch (error) {
    console.error('Update product error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function DELETE(request, { params }) {
  try {
    const { id } = await params;
    const session = await getSessionFromRequest(request);
    
    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }
    
    // Check DELETE permission for products
    if (!hasPermission(session.permissions, MODULES.PRODUCTS, OPERATIONS.DELETE)) {
      return NextResponse.json(
        { error: 'Permission denied: products:delete' },
        { status: 403 }
      );
    }
    
    const deleted = await productDB.delete(id);
    if (!deleted) {
      return NextResponse.json(
        { error: 'Product not found' },
        { status: 404 }
      );
    }
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete product error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
