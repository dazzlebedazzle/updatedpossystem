import { NextResponse } from 'next/server';
import { customerDB, saleDB, userDB } from '@/lib/database';
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
