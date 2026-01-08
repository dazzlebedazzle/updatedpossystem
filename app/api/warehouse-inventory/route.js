import { NextResponse } from 'next/server';
import { warehouseInventoryDB, productDB } from '@/lib/database';
import { hasPermission, MODULES, OPERATIONS } from '@/lib/permissions';
import { getSessionFromRequest } from '@/lib/auth-helper';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const revalidate = 30; // Revalidate every 30 seconds

// GET - Get all warehouse inventory
export async function GET(request) {
  try {
    const session = await getSessionFromRequest(request);
    
    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }
    
    if (!hasPermission(session.permissions, MODULES.INVENTORY, OPERATIONS.READ)) {
      return NextResponse.json(
        { error: 'Permission denied: inventory:read' },
        { status: 403 }
      );
    }
    
    // Use lean() and select only needed fields for better performance
    const warehouseInventory = await warehouseInventoryDB.findAll({ 
      sort: { createdAt: -1 }
    });
    
    return NextResponse.json({ warehouseInventory });
  } catch (error) {
    console.error('Get warehouse inventory error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST - Create or update warehouse inventory
export async function POST(request) {
  try {
    const session = await getSessionFromRequest(request);
    
    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }
    
    if (!hasPermission(session.permissions, MODULES.INVENTORY, OPERATIONS.CREATE)) {
      return NextResponse.json(
        { error: 'Permission denied: inventory:create' },
        { status: 403 }
      );
    }
    
    const { productId, mainWarehouseQty, productDetails } = await request.json();
    
    if (!productId) {
      return NextResponse.json(
        { error: 'Product ID is required' },
        { status: 400 }
      );
    }
    
    // Get product details if not provided
    let productInfo = productDetails;
    if (!productInfo) {
      const product = await productDB.findById(productId);
      if (!product) {
        return NextResponse.json(
          { error: 'Product not found' },
          { status: 404 }
        );
      }
      const productObj = product.toObject ? product.toObject() : product;
      productInfo = {
        EAN_code: productObj.EAN_code,
        product_name: productObj.product_name,
        category: productObj.category,
        unit: productObj.unit,
        price: productObj.price,
        supplier: productObj.supplier,
        expiry_date: productObj.expiry_date,
        date_arrival: productObj.date_arrival
      };
    }
    
    // Get existing warehouse inventory if it exists
    const existing = await warehouseInventoryDB.findByProductId(productId);
    const existingObj = existing?.toObject ? existing.toObject() : existing;
    
    // Create or update warehouse inventory
    const warehouseData = {
      mainWarehouseQty: existingObj 
        ? (existingObj.mainWarehouseQty || 0) + (parseFloat(mainWarehouseQty) || 0)
        : (parseFloat(mainWarehouseQty) || 0),
      subWarehouseStock: existingObj?.subWarehouseStock || [],
      shopStock: existingObj?.shopStock || [],
      productDetails: productInfo
    };
    
    const warehouseInventory = await warehouseInventoryDB.createOrUpdate(productId, warehouseData);
    
    return NextResponse.json({ success: true, warehouseInventory });
  } catch (error) {
    console.error('Create warehouse inventory error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// PUT - Assign stock to warehouse (main warehouse or sub-warehouse)
export async function PUT(request) {
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
    
    const { productId, warehouseType, warehouseId, quantity } = await request.json();
    
    if (!productId) {
      return NextResponse.json(
        { error: 'Product ID is required' },
        { status: 400 }
      );
    }
    
    if (!warehouseType || !['main', 'sub'].includes(warehouseType)) {
      return NextResponse.json(
        { error: 'Warehouse type must be "main" or "sub"' },
        { status: 400 }
      );
    }
    
    if (warehouseType === 'sub' && !warehouseId) {
      return NextResponse.json(
        { error: 'Sub-warehouse ID is required' },
        { status: 400 }
      );
    }
    
    if (!quantity || quantity <= 0) {
      return NextResponse.json(
        { error: 'Valid quantity is required' },
        { status: 400 }
      );
    }
    
    // Get product details
    const product = await productDB.findById(productId);
    if (!product) {
      return NextResponse.json(
        { error: 'Product not found' },
        { status: 404 }
      );
    }
    
    const productObj = product.toObject ? product.toObject() : product;
    const productInfo = {
      EAN_code: productObj.EAN_code,
      product_name: productObj.product_name,
      category: productObj.category,
      unit: productObj.unit,
      price: productObj.price,
      supplier: productObj.supplier,
      expiry_date: productObj.expiry_date,
      date_arrival: productObj.date_arrival
    };
    
    // Get existing warehouse inventory
    let existing = await warehouseInventoryDB.findByProductId(productId);
    const existingObj = existing?.toObject ? existing.toObject() : existing;
    
    let warehouseData;
    
    if (warehouseType === 'main') {
      // Assign to main warehouse
      warehouseData = {
        mainWarehouseQty: (existingObj?.mainWarehouseQty || 0) + parseFloat(quantity),
        subWarehouseStock: existingObj?.subWarehouseStock || [],
        shopStock: existingObj?.shopStock || [],
        productDetails: productInfo
      };
    } else {
      // Assign to sub-warehouse - can reduce from main warehouse OR directly from product qty
      const currentMainWarehouseQty = existingObj?.mainWarehouseQty || 0;
      const assignQuantity = parseFloat(quantity);
      
      // Check if product has enough available quantity
      const productQty = productObj.qty || 0;
      const productQtySold = productObj.qty_sold || 0;
      const availableProductQty = productQty - productQtySold;
      
      if (availableProductQty < assignQuantity) {
        return NextResponse.json(
          { error: `Insufficient product quantity. Available: ${availableProductQty}` },
          { status: 400 }
        );
      }
      
      const subWarehouseStock = existingObj?.subWarehouseStock || [];
      const existingSubWarehouse = subWarehouseStock.find(s => {
        const stockWarehouseId = s.subWarehouseId?._id?.toString() || 
                                 s.subWarehouseId?.toString() || 
                                 s.subWarehouseId;
        return stockWarehouseId === warehouseId.toString();
      });
      
      // Calculate how much to reduce from main warehouse vs product qty
      // If main warehouse has stock, use it first; otherwise use product qty directly
      let newMainWarehouseQty = currentMainWarehouseQty;
      let qtyToReduceFromProduct = assignQuantity;
      
      if (currentMainWarehouseQty >= assignQuantity) {
        // Enough in main warehouse, reduce from there
        newMainWarehouseQty = currentMainWarehouseQty - assignQuantity;
        qtyToReduceFromProduct = 0; // Don't reduce from product since we're using main warehouse stock
      } else if (currentMainWarehouseQty > 0) {
        // Partially available in main warehouse, use what's there and rest from product
        qtyToReduceFromProduct = assignQuantity - currentMainWarehouseQty;
        newMainWarehouseQty = 0; // Use all main warehouse stock
      }
      // If main warehouse qty is 0, use product qty directly (qtyToReduceFromProduct = assignQuantity)
      
      if (existingSubWarehouse) {
        // Update existing sub-warehouse stock
        warehouseData = {
          mainWarehouseQty: newMainWarehouseQty,
          subWarehouseStock: subWarehouseStock.map(s => {
            const stockWarehouseId = s.subWarehouseId?._id?.toString() || 
                                     s.subWarehouseId?.toString() || 
                                     s.subWarehouseId;
            if (stockWarehouseId === warehouseId.toString()) {
              return {
                ...s,
                quantity: (s.quantity || 0) + assignQuantity
              };
            }
            return s;
          }),
          shopStock: existingObj?.shopStock || [],
          productDetails: productInfo
        };
      } else {
        // Add new sub-warehouse stock
        warehouseData = {
          mainWarehouseQty: newMainWarehouseQty,
          subWarehouseStock: [
            ...subWarehouseStock,
            {
              subWarehouseId: warehouseId,
              quantity: assignQuantity
            }
          ],
          shopStock: existingObj?.shopStock || [],
          productDetails: productInfo
        };
      }
      
      // Update product quantity - reduce only the amount taken from product (not from main warehouse)
      if (qtyToReduceFromProduct > 0) {
        const currentProductQty = productObj.qty || 0;
        const newProductQty = Math.max(0, currentProductQty - qtyToReduceFromProduct);
        
        await productDB.update(productId, {
          qty: newProductQty
        });
      }
    }
    
    const warehouseInventory = await warehouseInventoryDB.createOrUpdate(productId, warehouseData);
    
    return NextResponse.json({ success: true, warehouseInventory });
  } catch (error) {
    console.error('Assign stock to warehouse error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

