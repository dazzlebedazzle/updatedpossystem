import { NextResponse } from 'next/server';
import { customerDB, saleDB, shopDB } from '@/lib/database';
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

    // Check READ permission for customers
    if (!hasPermission(session.permissions, MODULES.CUSTOMERS, OPERATIONS.READ)) {
      return NextResponse.json(
        { error: 'Permission denied: customers:read' },
        { status: 403 }
      );
    }
    
    // Get token from session
    const userToken = session.token;
    const userRole = session.role;
    
    let customers = await customerDB.findAll();
    
    // Get all sales to find customer-user relationships
    let allSales = await saleDB.findAll({ 
      select: '_id userId customerId customerName customerMobile customerPhone',
      sort: { createdAt: -1 }
    });
    
    // Create a map of customer to user/shop information
    // Match customers by name+phone combination from sales
    const customerToUserMap = new Map();
    const userIds = new Set();
    
    allSales.forEach(sale => {
      const saleObj = sale.toObject ? sale.toObject() : sale;
      const userId = saleObj.userId?._id?.toString() || saleObj.userId?.toString() || saleObj.userId;
      const customerName = (saleObj.customerName || '').trim().toLowerCase();
      const customerPhone = (saleObj.customerMobile || saleObj.customerPhone || '').trim();
      
      if (customerName || customerPhone) {
        const normalizedPhone = customerPhone.replace(/\s+/g, '').replace(/[^\d]/g, '');
        const key = `${customerName}|${normalizedPhone}`;
        
        if (!customerToUserMap.has(key)) {
          customerToUserMap.set(key, {
            userId: userId,
            userName: saleObj.userId?.name || null,
            userEmail: saleObj.userId?.email || null
          });
        }
        
        if (userId) {
          userIds.add(userId);
        }
      }
    });
    
    // Get shop information for all unique user IDs
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
    
    // Add shop and user information to customers
    customers = customers.map(customer => {
      const customerObj = customer.toObject ? customer.toObject() : customer;
      const customerName = (customerObj.name || '').trim().toLowerCase();
      const customerPhone = (customerObj.phone || '').trim();
      const normalizedPhone = customerPhone.replace(/\s+/g, '').replace(/[^\d]/g, '');
      const key = `${customerName}|${normalizedPhone}`;
      
      const userInfo = customerToUserMap.get(key) || {};
      const userId = userInfo.userId;
      
      return {
        ...customerObj,
        _id: customerObj._id?.toString() || customerObj.id,
        id: customerObj._id?.toString() || customerObj.id,
        userId: userId || null,
        userName: userInfo.userName || null,
        userEmail: userInfo.userEmail || null,
        shopName: userId ? (shopsByUserId[userId] || 'N/A') : 'N/A'
      };
    });
    
    // If user is an agent (agentToken), filter customers by that agent's sales
    if (userToken === 'agentToken' && userRole === 'agent') {
      try {
        // Use session userId directly (more efficient than looking up by token)
        const agentId = session.userId?.toString();
        
        if (agentId) {
          
          // Get all sales made by this agent
          const agentSales = await saleDB.findByUserId(agentId);
          
          // Extract unique customer identifiers from sales (name + phone combination)
          const customerIdentifiers = new Set();
          const customerNameSet = new Set();
          const customerPhoneSet = new Set();
          
          agentSales.forEach(sale => {
            const saleObj = sale.toObject ? sale.toObject() : sale;
            const customerName = (saleObj.customerName || '').trim().toLowerCase();
            const customerPhone = (saleObj.customerMobile || saleObj.customerPhone || '').trim();
            
            if (customerName) {
              customerNameSet.add(customerName);
            }
            if (customerPhone) {
              const normalizedPhone = customerPhone.replace(/\s+/g, '').replace(/[^\d]/g, '');
              customerPhoneSet.add(normalizedPhone);
              // Also add original phone for matching
              customerPhoneSet.add(customerPhone.trim());
            }
            
            // Create a unique key for matching (normalize phone numbers)
            if (customerName || customerPhone) {
              const normalizedPhone = customerPhone.replace(/\s+/g, '').replace(/[^\d]/g, '');
              const key = `${customerName}|${normalizedPhone}`;
              customerIdentifiers.add(key);
              // Also add with original phone
              if (customerPhone) {
                customerIdentifiers.add(`${customerName}|${customerPhone.trim()}`);
              }
            }
          });
          
          // Filter customers that match the agent's sales
          if (customerIdentifiers.size > 0 || customerNameSet.size > 0 || customerPhoneSet.size > 0) {
            customers = customers.filter(customer => {
              const customerObj = customer.toObject ? customer.toObject() : customer;
              const customerName = (customerObj.name || '').trim().toLowerCase();
              const customerPhone = (customerObj.phone || '').trim();
              const normalizedPhone = customerPhone.replace(/\s+/g, '').replace(/[^\d]/g, '');
              
              // Match by name+phone combination
              const customerKey = `${customerName}|${normalizedPhone}`;
              const customerKeyOriginal = `${customerName}|${customerPhone}`;
              
              // Check multiple matching strategies
              return customerIdentifiers.has(customerKey) || 
                     customerIdentifiers.has(customerKeyOriginal) ||
                     (customerName && customerNameSet.has(customerName)) ||
                     (customerPhone && (customerPhoneSet.has(normalizedPhone) || customerPhoneSet.has(customerPhone)));
            });
          } else {
            // If no sales found, return empty array
            customers = [];
          }
        } else {
          // Agent not found with this token, return empty array
          customers = [];
        }
      } catch (error) {
        console.error('Error filtering customers by agent token:', error);
        // If there's an error, return empty array to be safe
        customers = [];
      }
    }
    
    return NextResponse.json({ customers });
  } catch (error) {
    console.error('Get customers error:', error);
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

    // Check CREATE permission for customers
    if (!hasPermission(session.permissions, MODULES.CUSTOMERS, OPERATIONS.CREATE)) {
      return NextResponse.json(
        { error: 'Permission denied: customers:create' },
        { status: 403 }
      );
    }
    
    const { name, email, phone, address } = await request.json();
    
    if (!name) {
      return NextResponse.json(
        { error: 'Name is required' },
        { status: 400 }
      );
    }
    
    const customer = await customerDB.create({
      name,
      email: email || '',
      phone: phone || '',
      address: address || ''
    });
    
    return NextResponse.json({ success: true, customer });
  } catch (error) {
    console.error('Create customer error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
