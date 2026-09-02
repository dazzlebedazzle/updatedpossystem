import { NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth-helper';
import { hasPermission, MODULES, OPERATIONS } from '@/lib/permissions';
import { productDB, purchaseDB, warehouseInventoryDB, subWarehouseDB, shopDB } from '@/lib/database';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function getId(value) {
  if (!value) return '';
  if (typeof value === 'object') {
    return (value._id || value.id || '').toString();
  }
  return value.toString();
}

function buildProductSnapshot(product) {
  return {
    EAN_code: product.EAN_code,
    product_name: product.product_name,
    category: product.category || 'general',
    unit: product.unit || 'kg',
    price: product.price || 0,
    supplier: product.supplier || '',
    expiry_date: product.expiry_date || '',
    date_arrival: product.date_arrival || ''
  };
}

function upsertStock(stockItems, idField, targetId, quantity) {
  const targetIdString = targetId.toString();
  let found = false;

  const updated = (stockItems || []).map((stock) => {
    const stockId = getId(stock[idField]);
    if (stockId === targetIdString) {
      found = true;
      return {
        ...stock,
        [idField]: stock[idField],
        quantity: (Number(stock.quantity) || 0) + quantity
      };
    }
    return stock;
  });

  if (!found) {
    updated.push({
      [idField]: targetId,
      quantity
    });
  }

  return updated;
}

async function getDestinationName(destinationType, destinationId) {
  if (destinationType === 'main') return 'Main Warehouse';

  if (destinationType === 'sub') {
    const subWarehouse = await subWarehouseDB.findById(destinationId);
    return subWarehouse?.name || 'Sub-Warehouse';
  }

  if (destinationType === 'shop') {
    const shop = await shopDB.findById(destinationId);
    return shop?.name || 'Store';
  }

  return '';
}

async function addStockToDestination(product, destinationType, destinationId, quantity) {
  const productId = product._id || product.id;
  const existing = await warehouseInventoryDB.findByProductId(productId);
  const existingObj = existing?.toObject ? existing.toObject() : existing;

  const warehouseData = {
    mainWarehouseQty: Number(existingObj?.mainWarehouseQty) || 0,
    subWarehouseStock: existingObj?.subWarehouseStock || [],
    shopStock: existingObj?.shopStock || [],
    productDetails: buildProductSnapshot(product)
  };

  if (destinationType === 'main') {
    warehouseData.mainWarehouseQty += quantity;
  } else if (destinationType === 'sub') {
    warehouseData.subWarehouseStock = upsertStock(
      warehouseData.subWarehouseStock,
      'subWarehouseId',
      destinationId,
      quantity
    );
  } else if (destinationType === 'shop') {
    warehouseData.shopStock = upsertStock(
      warehouseData.shopStock,
      'shopId',
      destinationId,
      quantity
    );
  }

  return warehouseInventoryDB.createOrUpdate(productId, warehouseData);
}

export async function GET(request) {
  try {
    const session = await getSessionFromRequest(request);

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!hasPermission(session.permissions, MODULES.PURCHASES, OPERATIONS.READ)) {
      return NextResponse.json({ error: 'Permission denied: purchases:read' }, { status: 403 });
    }

    const purchases = await purchaseDB.findAll({ sort: { purchaseDate: -1, createdAt: -1 } });
    return NextResponse.json({ purchases });
  } catch (error) {
    console.error('Get purchases error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const session = await getSessionFromRequest(request);

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!hasPermission(session.permissions, MODULES.PURCHASES, OPERATIONS.CREATE)) {
      return NextResponse.json({ error: 'Permission denied: purchases:create' }, { status: 403 });
    }

    const {
      supplier,
      invoiceNumber,
      purchaseDate,
      destinationType = 'main',
      destinationId,
      items,
      paymentMethod = 'cash',
      paymentStatus = 'paid',
      notes
    } = await request.json();

    if (!supplier || !supplier.trim()) {
      return NextResponse.json({ error: 'Supplier is required' }, { status: 400 });
    }

    if (!['main', 'sub', 'shop'].includes(destinationType)) {
      return NextResponse.json({ error: 'Invalid destination type' }, { status: 400 });
    }

    if (destinationType !== 'main' && !destinationId) {
      return NextResponse.json({ error: 'Destination is required' }, { status: 400 });
    }

    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: 'At least one purchase item is required' }, { status: 400 });
    }

    const destinationName = await getDestinationName(destinationType, destinationId);
    const purchaseItems = [];
    let totalCost = 0;

    for (const item of items) {
      if (!item.productId) {
        return NextResponse.json({ error: 'Product is required for each item' }, { status: 400 });
      }

      const quantity = Number(item.quantity);
      const costPrice = Number(item.costPrice);
      const sellingPrice = Number(item.sellingPrice || 0);

      if (!quantity || quantity <= 0) {
        return NextResponse.json({ error: 'Each item needs a valid quantity' }, { status: 400 });
      }

      if (Number.isNaN(costPrice) || costPrice < 0) {
        return NextResponse.json({ error: 'Each item needs a valid cost price' }, { status: 400 });
      }

      const product = await productDB.findById(item.productId);
      if (!product) {
        return NextResponse.json({ error: `Product ${item.productId} not found` }, { status: 404 });
      }

      const productObj = product.toObject ? product.toObject() : product;
      const lineTotal = quantity * costPrice;
      totalCost += lineTotal;

      purchaseItems.push({
        productId: productObj._id || productObj.id,
        productName: productObj.product_name || productObj.name,
        quantity,
        unit: item.unit || productObj.unit || 'kg',
        costPrice,
        sellingPrice,
        lineTotal
      });
    }

    const purchase = await purchaseDB.create({
      supplier: supplier.trim(),
      invoiceNumber: invoiceNumber || '',
      purchaseDate: purchaseDate ? new Date(purchaseDate) : new Date(),
      destinationType,
      destinationId: destinationType === 'main' ? null : destinationId,
      destinationName,
      items: purchaseItems,
      totalCost,
      paymentMethod,
      paymentStatus,
      notes: notes || '',
      createdBy: session.userId
    });

    for (const item of purchaseItems) {
      const product = await productDB.findById(item.productId);
      if (!product) continue;

      const productObj = product.toObject ? product.toObject() : product;
      const updatedProduct = await productDB.update(item.productId, {
        qty: (Number(productObj.qty) || 0) + item.quantity,
        price: item.sellingPrice > 0 ? item.sellingPrice : productObj.price,
        supplier: supplier.trim()
      });

      const updatedProductObj = updatedProduct?.toObject ? updatedProduct.toObject() : updatedProduct;
      if (updatedProductObj) {
        updatedProductObj.supplier = supplier.trim();
        updatedProductObj.price = item.sellingPrice > 0 ? item.sellingPrice : updatedProductObj.price;
        await addStockToDestination(updatedProductObj, destinationType, destinationId, item.quantity);
      }
    }

    return NextResponse.json({ success: true, purchase });
  } catch (error) {
    console.error('Create purchase error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
