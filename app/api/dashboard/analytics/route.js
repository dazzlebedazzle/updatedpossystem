import { NextResponse } from 'next/server';
import { saleDB, customerDB } from '@/lib/database';
import { getSessionFromRequest } from '@/lib/auth-helper';
import Sale from '@/models/saleModel';
import Customer from '@/models/customerModel';
import connectDB from '@/lib/db';

// Enable caching for better performance
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const revalidate = 60; // Revalidate every 60 seconds

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

    await connectDB();

    // Build match filter for agent users
    const matchFilter = {};
    if (session.token === 'agentToken' && session.role === 'agent') {
      matchFilter.userId = session.userId;
    }

    // Build date grouping based on period
    let dateGroupFormat;
    if (period === 'daily') {
      dateGroupFormat = {
        year: { $year: '$createdAt' },
        month: { $month: '$createdAt' },
        day: { $dayOfMonth: '$createdAt' }
      };
    } else if (period === 'monthly') {
      dateGroupFormat = {
        year: { $year: '$createdAt' },
        month: { $month: '$createdAt' }
      };
    } else {
      dateGroupFormat = {
        year: { $year: '$createdAt' }
      };
    }

    // Use MongoDB aggregation for sales data - much faster than fetching all
    const salesAggregation = [
      { $match: matchFilter },
      {
        $group: {
          _id: dateGroupFormat,
          sales: { $sum: 1 },
          revenue: { $sum: '$total' }
        }
      },
      { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 } }
    ];

    const salesResults = await Sale.aggregate(salesAggregation);

    // Format sales data
    const salesData = [];
    const formatRevenueData = [];
    
    salesResults.forEach(item => {
      let dateKey;
      if (period === 'daily') {
        const month = String(item._id.month).padStart(2, '0');
        const day = String(item._id.day).padStart(2, '0');
        dateKey = `${item._id.year}-${month}-${day}`;
      } else if (period === 'monthly') {
        const month = String(item._id.month).padStart(2, '0');
        dateKey = `${item._id.year}-${month}`;
      } else {
        dateKey = String(item._id.year);
      }
      
      salesData.push({ date: dateKey, sales: item.sales });
      formatRevenueData.push({ date: dateKey, revenue: item.revenue });
    });

    // Process customers only for daily view using aggregation
    let formatCustomersData = [];
    if (period === 'daily') {
      const customerMatchFilter = {};
      if (session.token === 'agentToken' && session.role === 'agent') {
        // For agents, we need to match customers from their sales
        const agentSales = await Sale.find(matchFilter).select('customerName customerMobile').lean();
        const customerIdentifiers = new Set();
        
        agentSales.forEach(sale => {
          const customerName = (sale.customerName || '').trim().toLowerCase();
          const customerPhone = (sale.customerMobile || '').trim();
          if (customerName || customerPhone) {
            customerIdentifiers.add(`${customerName}|${customerPhone}`);
          }
        });

        if (customerIdentifiers.size > 0) {
          // Build OR query for matching customers
          const orConditions = Array.from(customerIdentifiers).map(identifier => {
            const [name, phone] = identifier.split('|');
            const conditions = [];
            if (name) conditions.push({ name: new RegExp(name, 'i') });
            if (phone) conditions.push({ phone: phone });
            return { $or: conditions };
          });
          customerMatchFilter.$or = orConditions;
        } else {
          customerMatchFilter._id = null; // No matching customers
        }
      }

      const customersAggregation = [
        { $match: customerMatchFilter },
        {
          $group: {
            _id: {
              year: { $year: '$createdAt' },
              month: { $month: '$createdAt' },
              day: { $dayOfMonth: '$createdAt' }
            },
            customers: { $sum: 1 }
          }
        },
        { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 } }
      ];

      const customersResults = await Customer.aggregate(customersAggregation);
      formatCustomersData = customersResults.map(item => {
        const month = String(item._id.month).padStart(2, '0');
        const day = String(item._id.day).padStart(2, '0');
        return {
          date: `${item._id.year}-${month}-${day}`,
          customers: item.customers
        };
      });
    }

    return NextResponse.json({
      sales: salesData,
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

