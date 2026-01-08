import { NextResponse } from 'next/server';
import { warehouseInventoryDB, productDB } from '@/lib/database';
import { hasPermission, MODULES, OPERATIONS } from '@/lib/permissions';
import { getSessionFromRequest } from '@/lib/auth-helper';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// POST - Assign stock from sub-warehouse to supplier
export async function POST(request) {
  try {
    const session = await getSessionFromRequest(request);
    
    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }
    
    if (!hasPermission(session.permissions, MODULES.INVENTORY, OPERATIONS.UPDATE)) {
      return NextResponse.json(
        { error: 'Permission denied: inventory:update' },
        { status: 403 }
      );
    }
    
    const { productId, subWarehouseId, supplierName, quantity } = await request.json();
    
    console.log('Assign to supplier request:', { productId, subWarehouseId, supplierName, quantity });
    
    if (!productId || !subWarehouseId || !supplierName || !quantity) {
      return NextResponse.json(
        { error: 'Product ID, sub-warehouse ID, supplier name, and quantity are required' },
        { status: 400 }
      );
    }
    
    if (quantity <= 0) {
      return NextResponse.json(
        { error: 'Quantity must be greater than 0' },
        { status: 400 }
      );
    }
    
    // Normalize IDs to strings for comparison
    const productIdStr = productId.toString();
    const subWarehouseIdStr = subWarehouseId.toString();
    
    // Get warehouse inventory
    const warehouseInventory = await warehouseInventoryDB.findByProductId(productIdStr);
    if (!warehouseInventory) {
      console.log('Warehouse inventory not found for productId:', productIdStr);
      return NextResponse.json(
        { error: 'Warehouse inventory not found for this product' },
        { status: 404 }
      );
    }
    
    const warehouseObj = warehouseInventory.toObject ? warehouseInventory.toObject() : warehouseInventory;
    
    // Find sub-warehouse stock
    const subWarehouseStock = warehouseObj.subWarehouseStock || [];
    console.log('Sub-warehouse stock array:', JSON.stringify(subWarehouseStock, null, 2));
    console.log('Looking for subWarehouseId:', subWarehouseIdStr);
    
    const subWarehouseStockItem = subWarehouseStock.find(s => {
      // Handle both populated and non-populated subWarehouseId
      const stockWarehouseId = s.subWarehouseId?._id?.toString() || 
                               s.subWarehouseId?.toString() || 
                               s.subWarehouseId;
      console.log('Comparing:', stockWarehouseId, 'with', subWarehouseIdStr);
      return stockWarehouseId === subWarehouseIdStr;
    });
    
    console.log('Found stock item:', subWarehouseStockItem);
    
    if (!subWarehouseStockItem) {
      return NextResponse.json(
        { error: `Stock not found in sub-warehouse. Available warehouses: ${subWarehouseStock.map(s => {
          const id = s.subWarehouseId?._id?.toString() || s.subWarehouseId?.toString() || s.subWarehouseId;
          return id;
        }).join(', ')}` },
        { status: 400 }
      );
    }
    
    const availableQuantity = subWarehouseStockItem.quantity || 0;
    if (availableQuantity < quantity) {
      return NextResponse.json(
        { error: `Insufficient stock in sub-warehouse. Available: ${availableQuantity}, Requested: ${quantity}` },
        { status: 400 }
      );
    }
    
    // Get product
    const product = await productDB.findById(productId);
    if (!product) {
      return NextResponse.json(
        { error: 'Product not found' },
        { status: 404 }
      );
    }
    
    const productObj = product.toObject ? product.toObject() : product;
    
    // Update product: increase qty and set supplier
    const updatedQty = (productObj.qty || 0) + quantity;
    const updatedProduct = await productDB.update(productId, {
      qty: updatedQty,
      supplier: supplierName
    });
    
    // Update warehouse inventory: reduce sub-warehouse stock
    const updatedSubWarehouseStock = subWarehouseStock.map(s => {
      // Handle both populated and non-populated subWarehouseId
      const stockWarehouseId = s.subWarehouseId?._id?.toString() || 
                               s.subWarehouseId?.toString() || 
                               s.subWarehouseId;
      if (stockWarehouseId === subWarehouseIdStr) {
        const newQuantity = (s.quantity || 0) - quantity;
        console.log(`Reducing stock: ${s.quantity} - ${quantity} = ${newQuantity}`);
        return {
          ...s,
          quantity: newQuantity
        };
      }
      return s;
    });
    
    // Remove sub-warehouse stock entry if quantity becomes 0
    const filteredSubWarehouseStock = updatedSubWarehouseStock.filter(s => s.quantity > 0);
    
    const warehouseData = {
      mainWarehouseQty: warehouseObj.mainWarehouseQty || 0,
      subWarehouseStock: filteredSubWarehouseStock,
      shopStock: warehouseObj.shopStock || [],
      productDetails: {
        EAN_code: productObj.EAN_code,
        product_name: productObj.product_name,
        category: productObj.category,
        unit: productObj.unit,
        price: productObj.price,
        supplier: supplierName,
        expiry_date: productObj.expiry_date,
        date_arrival: productObj.date_arrival
      }
    };
    
    await warehouseInventoryDB.createOrUpdate(productId, warehouseData);
    
    return NextResponse.json({ 
      success: true, 
      product: updatedProduct,
      message: `Stock assigned to supplier ${supplierName} successfully` 
    });
  } catch (error) {
    console.error('Assign stock to supplier error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

