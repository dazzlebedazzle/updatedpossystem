import { NextResponse } from 'next/server';
import { saleDB, customerDB } from '@/lib/database';
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

    const { searchParams } = new URL(request.url);
    const period = searchParams.get('period') || 'daily'; // daily, monthly, yearly

    // Fetch all sales and customers
    let sales = await saleDB.findAll();
    let customers = await customerDB.findAll();
    
    // Filter data based on user's token
    // If user is an agent (agentToken), filter by their userId
    if (session.token === 'agentToken' && session.role === 'agent') {
      const sessionUserId = session.userId?.toString();
      
      // Filter sales by agent's userId
      sales = sales.filter(sale => {
        const saleObj = sale.toObject ? sale.toObject() : sale;
        const saleUserId = saleObj.userId?._id?.toString() || saleObj.userId?.toString() || saleObj.userId;
        return saleUserId === sessionUserId;
      });
      
      // Filter customers by agent's sales (same logic as customers API)
      const customerIdentifiers = new Set();
      const customerNameSet = new Set();
      const customerPhoneSet = new Set();
      
      sales.forEach(sale => {
        const saleObj = sale.toObject ? sale.toObject() : sale;
        const customerName = (saleObj.customerName || '').trim().toLowerCase();
        const customerPhone = (saleObj.customerMobile || saleObj.customerPhone || '').trim();
        
        if (customerName) {
          customerNameSet.add(customerName);
        }
        if (customerPhone) {
          const normalizedPhone = customerPhone.replace(/\s+/g, '').replace(/[^\d]/g, '');
          customerPhoneSet.add(normalizedPhone);
          customerPhoneSet.add(customerPhone.trim());
        }
        
        if (customerName || customerPhone) {
          const normalizedPhone = customerPhone.replace(/\s+/g, '').replace(/[^\d]/g, '');
          customerIdentifiers.add(`${customerName}|${normalizedPhone}`);
          if (customerPhone) {
            customerIdentifiers.add(`${customerName}|${customerPhone.trim()}`);
          }
        }
      });
      
      if (customerIdentifiers.size > 0 || customerNameSet.size > 0 || customerPhoneSet.size > 0) {
        customers = customers.filter(customer => {
          const customerObj = customer.toObject ? customer.toObject() : customer;
          const customerName = (customerObj.name || '').trim().toLowerCase();
          const customerPhone = (customerObj.phone || '').trim();
          const normalizedPhone = customerPhone.replace(/\s+/g, '').replace(/[^\d]/g, '');
          
          const customerKey = `${customerName}|${normalizedPhone}`;
          const customerKeyOriginal = `${customerName}|${customerPhone}`;
          
          return customerIdentifiers.has(customerKey) || 
                 customerIdentifiers.has(customerKeyOriginal) ||
                 (customerName && customerNameSet.has(customerName)) ||
                 (customerPhone && (customerPhoneSet.has(normalizedPhone) || customerPhoneSet.has(customerPhone)));
        });
      } else {
        customers = [];
      }
    }

    // Convert Mongoose documents to plain JSON objects
    sales = sales.map(sale => {
      const saleObj = sale.toObject ? sale.toObject() : sale;
      return {
        _id: saleObj._id?.toString() || saleObj.id,
        total: saleObj.total || 0,
        createdAt: saleObj.createdAt || saleObj.date || new Date()
      };
    });

    // Group data by period
    const salesData = {};
    const revenueData = {};
    const customersData = {};

    // Process sales
    sales.forEach(sale => {
      const date = new Date(sale.createdAt);
      let key;

      if (period === 'daily') {
        key = date.toISOString().split('T')[0]; // YYYY-MM-DD
      } else if (period === 'monthly') {
        const month = date.getMonth() + 1;
        const monthStr = month < 10 ? `0${month}` : `${month}`;
        key = `${date.getFullYear()}-${monthStr}`; // YYYY-MM
      } else if (period === 'yearly') {
        key = String(date.getFullYear()); // YYYY
      }

      if (!salesData[key]) {
        salesData[key] = 0;
        revenueData[key] = 0;
      }
      salesData[key]++;
      revenueData[key] += sale.total;
    });

    // Process customers (only for daily view)
    if (period === 'daily') {
      customers.forEach(customer => {
        const date = new Date(customer.createdAt || customer.date || new Date());
        const key = date.toISOString().split('T')[0]; // YYYY-MM-DD

        if (!customersData[key]) {
          customersData[key] = 0;
        }
        customersData[key]++;
      });
    }

    // Convert to arrays sorted by date
    const formatSalesData = Object.keys(salesData)
      .sort()
      .map(key => ({
        date: key,
        sales: salesData[key]
      }));

    const formatRevenueData = Object.keys(revenueData)
      .sort()
      .map(key => ({
        date: key,
        revenue: revenueData[key]
      }));

    const formatCustomersData = Object.keys(customersData)
      .sort()
      .map(key => ({
        date: key,
        customers: customersData[key]
      }));

    return NextResponse.json({
      sales: formatSalesData,
      revenue: formatRevenueData,
      customers: formatCustomersData,
      period
    });
  } catch (error) {
    console.error('Get analytics error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

