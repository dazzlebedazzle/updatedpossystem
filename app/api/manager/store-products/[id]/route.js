import { NextResponse } from 'next/server';
import { productDB, warehouseInventoryDB } from '@/lib/database';
import { getSessionFromRequest } from '@/lib/auth-helper';
import { canManagerAccessProduct, findManagedShopForProduct, getManagerAccess } from '@/lib/manager-access';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function PUT(request, { params }) {
  try {
    const { id } = await params;
    const session = await getSessionFromRequest(request);

    if (!session || session.role !== 'manager') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const product = await productDB.findById(id);
    if (!product) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    }

    const { shops, allowedProductShopIds } = await getManagerAccess(session);
    if (!canManagerAccessProduct(product, allowedProductShopIds)) {
      return NextResponse.json({ error: 'Product not found for assigned store' }, { status: 404 });
    }

    const body = await request.json();
    const updates = {};

    if (body.product_name !== undefined) {
      const name = String(body.product_name).trim();
      if (!name) {
        return NextResponse.json({ error: 'Product name is required' }, { status: 400 });
      }
      updates.product_name = name;
    }

    if (body.price !== undefined) {
      const price = Number(body.price);
      if (!Number.isFinite(price) || price < 0) {
        return NextResponse.json({ error: 'Price must be 0 or higher' }, { status: 400 });
      }
      updates.price = price;
    }

    if (body.qty !== undefined) {
      const qty = Number(body.qty);
      if (!Number.isInteger(qty) || qty < 0) {
        return NextResponse.json({ error: 'Quantity must be a whole number 0 or higher' }, { status: 400 });
      }
      updates.qty = qty;
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No allowed fields provided' }, { status: 400 });
    }

    const updatedProduct = await productDB.update(id, updates);

    try {
      const managedShop = findManagedShopForProduct(product, shops);
      const managedShopObj = managedShop?.toObject ? managedShop.toObject() : managedShop;
      const managedShopId = managedShopObj?._id?.toString() || managedShopObj?.id;
      const warehouseInventory = await warehouseInventoryDB.findByProductId(id);

      if (warehouseInventory) {
        const warehouseObj = warehouseInventory.toObject ? warehouseInventory.toObject() : warehouseInventory;
        const productDetails = {
          ...(warehouseObj.productDetails || {}),
          ...(updates.product_name !== undefined ? { product_name: updates.product_name } : {}),
          ...(updates.price !== undefined ? { price: updates.price } : {})
        };
        const nextUpdates = { $set: { productDetails } };

        if (updates.qty !== undefined && managedShopId) {
          const shopStock = warehouseObj.shopStock || [];
          const existingStock = shopStock.find((stock) => stock.shopId?.toString() === managedShopId);

          if (existingStock) {
            nextUpdates.$set.shopStock = shopStock.map((stock) => (
              stock.shopId?.toString() === managedShopId
                ? { ...stock, quantity: updates.qty }
                : stock
            ));
          } else {
            nextUpdates.$push = {
              shopStock: {
                shopId: managedShopId,
                quantity: updates.qty
              }
            };
          }
        }

        await warehouseInventoryDB.update(warehouseObj._id, nextUpdates);
      }
    } catch (error) {
      console.error('Error syncing manager product update to warehouse inventory:', error);
    }

    return NextResponse.json({ success: true, product: updatedProduct });
  } catch (error) {
    console.error('Update manager store product error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
