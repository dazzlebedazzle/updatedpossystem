import { NextResponse } from 'next/server';
import { saleDB, productDB, shopDB } from '@/lib/database';
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

    // Check READ permission for sales (for reports) or SALES module
    // If user has reports:read, they can see all sales
    // If user only has sales:read, they can see their own sales
    // Agents with agentToken can always see their own sales (for reports page)
    const hasReportsRead = hasPermission(session.permissions, MODULES.REPORTS, OPERATIONS.READ);
    const hasSalesRead = hasPermission(session.permissions, MODULES.SALES, OPERATIONS.READ);
    const isAgentWithToken = session.token === 'agentToken' && session.role === 'agent';
    
    // Allow agents with agentToken to view their own sales even without explicit permissions
    if (!hasReportsRead && !hasSalesRead && !isAgentWithToken) {
      return NextResponse.json(
        { error: 'Permission denied: reports:read or sales:read required' },
        { status: 403 }
      );
    }
    
    // Fetch all sales from database using saleModel
    // Use lean() and select only needed fields for better performance
    let sales = await saleDB.findAll({ 
      select: '_id userId customerId customerName customerMobile customerAddress items total paymentMethod status createdAt',
      sort: { createdAt: -1 }
    });
    
    // Get shop information for all unique user IDs
    const userIds = [...new Set(sales.map(sale => {
      const saleObj = sale.toObject ? sale.toObject() : sale;
      return saleObj.userId?._id?.toString() || saleObj.userId?.toString() || saleObj.userId;
    }).filter(Boolean))];
    
    // Fetch shops for all users
    const shopsByUserId = {};
    for (const userId of userIds) {
      try {
        const shops = await shopDB.findByUserId(userId);
        if (shops && shops.length > 0) {
          const shopObj = shops[0].toObject ? shops[0].toObject() : shops[0];
          shopsByUserId[userId] = shopObj.name || 'N/A';
        }
      } catch (error) {
        console.error(`Error fetching shop for userId ${userId}:`, error);
      }
    }
    
    // Convert Mongoose documents to plain JSON objects
    sales = sales.map(sale => {
      const saleObj = sale.toObject ? sale.toObject() : sale;
      const userId = saleObj.userId?._id?.toString() || saleObj.userId?.toString() || saleObj.userId;
      const userName = saleObj.userId?.name || null;
      const userEmail = saleObj.userId?.email || null;
      
      return {
        _id: saleObj._id?.toString() || saleObj.id,
        id: saleObj._id?.toString() || saleObj.id,
        userId: userId,
        userName: userName,
        userEmail: userEmail,
        shopName: userId ? (shopsByUserId[userId] || 'N/A') : 'N/A',
        customerId: saleObj.customerId?._id?.toString() || saleObj.customerId?.toString() || saleObj.customerId || null,
        customerName: saleObj.customerName || null,
        customerMobile: saleObj.customerMobile || null,
        customerAddress: saleObj.customerAddress || null,
        items: saleObj.items || [],
        total: saleObj.total || 0,
        paymentMethod: saleObj.paymentMethod || 'cash',
        status: saleObj.status || 'completed',
        createdAt: saleObj.createdAt || saleObj.date || new Date(),
        updatedAt: saleObj.updatedAt || saleObj.createdAt || new Date()
      };
    });
    
    // Filter sales based on user's token
    // If user is an agent (agentToken), they can ONLY see their own sales
    // Agents with agentToken should NEVER see other agents' sales, regardless of permissions
    const sessionUserId = session.userId?.toString();
    
    if (session.token === 'agentToken' && session.role === 'agent') {
      // Agent with agentToken can ONLY see their own sales
      // This is enforced regardless of permissions (reports:read, etc.)
      // This ensures data isolation for agents
      if (sessionUserId) {
        sales = sales.filter(s => {
          const saleUserId = s.userId?.toString();
          // Ensure both are strings and match exactly
          return saleUserId && sessionUserId && saleUserId === sessionUserId;
        });
      } else {
        // If no userId found for agent, return empty array
        console.warn('Agent token found but no userId in session');
        sales = [];
      }
    } else if (hasSalesRead && !hasReportsRead) {
      // User with sales:read but not reports:read can only see their own sales
      if (sessionUserId) {
        sales = sales.filter(s => {
          const saleUserId = s.userId?.toString();
          return saleUserId && sessionUserId && saleUserId === sessionUserId;
        });
      } else {
        sales = [];
      }
    }
    
    return NextResponse.json({ sales });
  } catch (error) {
    console.error('Get sales error:', error);
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
    
    const { items, customerId, customerName, customerMobile, customerAddress, paymentMethod } = await request.json();
    
    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { error: 'Items are required' },
        { status: 400 }
      );
    }
    
    // Calculate total and validate stock
    let total = 0;
    const saleItems = [];
    
    for (const item of items) {
      const product = await productDB.findById(item.productId);
      if (!product) {
        return NextResponse.json(
          { error: `Product ${item.productId} not found` },
          { status: 400 }
        );
      }
      
      // Calculate available stock: qty - qty_sold
      const availableStock = (product.qty || 0) - (product.qty_sold || 0);
      
      // Convert item quantity to stock unit for comparison
      const unit = item.unit || product.unit || 'kg';
      const itemQuantityInStockUnit = unit === 'kg' ? item.quantity / 1000 : item.quantity;
      
      if (availableStock < itemQuantityInStockUnit) {
        return NextResponse.json(
          { error: `Insufficient stock for ${product.product_name || product.name}. Only ${availableStock} ${unit} available` },
          { status: 400 }
        );
      }
      
      // Calculate price based on unit
      const qtyInUnit = unit === 'kg' ? item.quantity / 1000 : item.quantity;
      total += (product.price || 0) * qtyInUnit;
      
      saleItems.push({
        productId: product._id || product.id,
        quantity: item.quantity,
        unit: unit,
        price: product.price || 0,
        name: product.product_name || product.name
      });
    }
    
    // Create sale
    const sale = await saleDB.create({
      userId: session.userId,
      customerId: customerId || null,
      customerName: customerName || null,
      customerMobile: customerMobile || null,
      customerAddress: customerAddress || null,
      items: saleItems,
      total,
      paymentMethod: paymentMethod || 'cash',
      status: 'completed'
    });
    
    // Update product qty_sold and decrease inventory shop stock
    for (const item of saleItems) {
      const product = await productDB.findById(item.productId);
      if (product) {
        const productObj = product.toObject ? product.toObject() : product;
        const currentQtySold = productObj.qty_sold || 0;
        // Convert quantity to stock unit before updating
        const unit = item.unit || productObj.unit || 'kg';
        const quantityInStockUnit = unit === 'kg' ? item.quantity / 1000 : item.quantity;
        
        // Update product qty_sold
        await productDB.update(item.productId, {
          qty_sold: currentQtySold + quantityInStockUnit
        });
        
        // Decrease inventory shop stock if user has a shop
        if (session.userId) {
          try {
            const { warehouseInventoryDB } = await import('@/lib/database');
            const productId = productObj._id || productObj.id;
            const warehouseInventory = await warehouseInventoryDB.findByProductId(productId);
            
            if (warehouseInventory) {
              const warehouseObj = warehouseInventory.toObject ? warehouseInventory.toObject() : warehouseInventory;
              const shopStock = warehouseObj.shopStock || [];
              const userShopStock = shopStock.find(s => {
                const shopId = s.shopId?.toString();
                return shopId === session.userId.toString();
              });
              
              if (userShopStock && userShopStock.quantity >= quantityInStockUnit) {
                // Update shop stock
                const updatedShopStock = shopStock.map(s => {
                  if (s.shopId?.toString() === session.userId.toString()) {
                    return { ...s, quantity: s.quantity - quantityInStockUnit };
                  }
                  return s;
                });
                
                await warehouseInventoryDB.update(warehouseObj._id, {
                  $set: {
                    shopStock: updatedShopStock
                  }
                });
              }
            }
          } catch (error) {
            console.error('Error updating warehouse inventory on sale:', error);
            // Don't fail the sale if inventory update fails
          }
        }
      }
    }
    
    return NextResponse.json({ success: true, sale });
  } catch (error) {
    console.error('Create sale error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
