import { NextResponse } from 'next/server';
import { productDB, userDB } from '@/lib/database';
import { hasPermission, MODULES, OPERATIONS } from '@/lib/permissions';
import { getSessionFromRequest } from '@/lib/auth-helper';

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
    
    // Check READ permission for products
    // Agents with agentToken can view products (filtered by their name matching supplier)
    // even without explicit products:read permission
    const isAgentWithToken = session.token === 'agentToken' && session.role === 'agent';
    
    if (!hasPermission(session.permissions, MODULES.PRODUCTS, OPERATIONS.READ) && !isAgentWithToken) {
      return NextResponse.json(
        { error: 'Permission denied: products:read' },
        { status: 403 }
      );
    }
    
    let products = await productDB.findAll();
    
    // Filter products based on user's token/name
    // If user is an agent, show only products where product.supplier matches user.name
    // Superadmins and admins see all products
    if (session.token === 'agentToken' && session.role === 'agent') {
      try {
        // Get user details to get user name
        const user = await userDB.findById(session.userId);
        if (user) {
          const userObj = user.toObject ? user.toObject() : user;
          const userName = (userObj.name || '').trim();
          
          if (userName) {
            // Filter products where product.supplier matches user.name
            products = products.filter(product => {
              const productObj = product.toObject ? product.toObject() : product;
              const productSupplier = (productObj.supplier || '').trim();
              // Match user.name with product.supplier (case-insensitive)
              return productSupplier.toLowerCase() === userName.toLowerCase();
            });
          } else {
            // Agent has no name, return empty array
            products = [];
          }
        } else {
          // Agent not found, return empty array
          products = [];
        }
      } catch (error) {
        console.error('Error filtering products by user name:', error);
        // On error, return empty array for agents
        if (session.role === 'agent') {
          products = [];
        }
      }
    }
    
    return NextResponse.json({ products });
  } catch (error) {
    console.error('Get products error:', error);
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
    
    // Check CREATE permission for products
    if (!hasPermission(session.permissions, MODULES.PRODUCTS, OPERATIONS.CREATE)) {
      return NextResponse.json(
        { error: 'Permission denied: products:create' },
        { status: 403 }
      );
    }
    
    const { 
      EAN_code, 
      product_name, 
      images, 
      unit, 
      supplier, 
      qty, 
      qty_sold, 
      expiry_date, 
      date_arrival,
      price,
      category
    } = await request.json();
    
    if (!EAN_code || !product_name || qty === undefined) {
      return NextResponse.json(
        { error: 'EAN_code, product_name, and qty are required' },
        { status: 400 }
      );
    }
    
    const product = await productDB.create({
      EAN_code: parseInt(EAN_code),
      product_name,
      images: images || '',
      unit: unit || 'kg',
      supplier: supplier || '',
      qty: parseInt(qty || 0),
      qty_sold: parseInt(qty_sold || 0),
      expiry_date: expiry_date || '',
      date_arrival: date_arrival || '',
      price: parseFloat(price || 0),
      category: category || 'general'
    });
    
    return NextResponse.json({ success: true, product });
  } catch (error) {
    console.error('Create product error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
