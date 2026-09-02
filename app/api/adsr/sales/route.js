import { NextResponse } from 'next/server';
import mongoose from 'mongoose';
import connectDB from '@/lib/db';
import Sale from '@/models/saleModel';
import Shop from '@/models/shopModel';
import User from '@/models/userModel';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const IST_TIME_ZONE = 'Asia/Kolkata';

function getRequestApiKey(request) {
  const headerKey = request.headers.get('x-api-key');
  if (headerKey) return headerKey.trim();

  const authHeader = request.headers.get('authorization') || '';
  if (authHeader.toLowerCase().startsWith('bearer ')) {
    return authHeader.slice(7).trim();
  }

  return '';
}

function isAuthorized(request) {
  const configuredKey = process.env.ADSR_API_KEY;
  if (!configuredKey) {
    return { ok: false, status: 503, error: 'ADSR API key is not configured' };
  }

  if (getRequestApiKey(request) !== configuredKey) {
    return { ok: false, status: 401, error: 'Unauthorized' };
  }

  return { ok: true };
}

function startOfTodayInIST() {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: IST_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });

  return new Date(`${formatter.format(new Date())}T00:00:00+05:30`);
}

function parseDateParam(value, endOfDay = false) {
  if (!value) return null;

  const hasTime = value.includes('T') || value.includes(' ');
  const normalized = hasTime ? value : `${value}T${endOfDay ? '23:59:59.999' : '00:00:00'}+05:30`;
  const date = new Date(normalized);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date;
}

function formatISTDate(date) {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: IST_TIME_ZONE,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date).replace(/\//g, '-');
}

function formatISTTime(date) {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: IST_TIME_ZONE,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(date);
}

function roundMoney(value) {
  return Number((Number(value) || 0).toFixed(2));
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function findShopByAssignedUserEmail(email) {
  const user = await User.findOne({
    email: new RegExp(`^${escapeRegex(email)}$`, 'i'),
  }).lean();

  if (!user) return null;

  return Shop.findOne({ userId: user._id }).populate('userId', 'name email').lean();
}

async function findShop(storeId, email) {
  if (email) {
    return findShopByAssignedUserEmail(email);
  }

  if (storeId.includes('@')) {
    return findShopByAssignedUserEmail(storeId);
  }

  if (mongoose.Types.ObjectId.isValid(storeId)) {
    return Shop.findById(storeId).populate('userId', 'name email').lean();
  }

  return Shop.findOne({
    name: new RegExp(`^${escapeRegex(storeId)}$`, 'i'),
  }).populate('userId', 'name email').lean();
}

function mapSaleToADSR(sale, shop) {
  const createdAt = sale.createdAt ? new Date(sale.createdAt) : new Date();
  const total = roundMoney(sale.total);
  const discountAmount = roundMoney(sale.discountAmount);
  const taxValue = roundMoney(sale.taxValue || sale.taxAmount);
  const grossSale = roundMoney(sale.grossSale || total + discountAmount);
  const netSale = roundMoney(sale.netSale || total - taxValue);
  const paymentAmount = roundMoney(sale.paymentAmount || total);

  return {
    header: 'SALE',
    storeId: shop._id?.toString(),
    storeName: shop.name || '',
    tillId: process.env.ADSR_TILL_ID || shop.name || 'POS-1',
    date: formatISTDate(createdAt),
    time: formatISTTime(createdAt),
    invoiceNumber: sale.invoiceNumber || sale._id?.toString(),
    grossSale,
    netSale,
    taxValue,
    discountAmount,
    payment: paymentAmount,
    paymentMethod: sale.paymentMethod || '',
    customerName: sale.customerName || sale.customerId?.name || '',
    customerMobileNumber: sale.customerMobile || '',
    salesType: sale.status === 'refunded' ? 'Returns' : 'Sales',
  };
}

export async function GET(request) {
  try {
    const auth = isAuthorized(request);
    if (!auth.ok) {
      return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
    }

    const { searchParams } = new URL(request.url);
    const storeId = searchParams.get('storeId') || searchParams.get('shopId');
    const email = searchParams.get('email');

    if (!storeId && !email) {
      return NextResponse.json(
        { success: false, error: 'storeId, shopId, or email is required' },
        { status: 400 }
      );
    }

    const fromDate = parseDateParam(searchParams.get('fromDate')) || startOfTodayInIST();
    const toDate = parseDateParam(searchParams.get('toDate'), true) || new Date();

    if (fromDate > toDate) {
      return NextResponse.json(
        { success: false, error: 'fromDate must be before or equal to toDate' },
        { status: 400 }
      );
    }

    await connectDB();

    const shop = await findShop(storeId || '', email);
    if (!shop) {
      return NextResponse.json(
        { success: false, error: 'Store/shop not found' },
        { status: 404 }
      );
    }

    const assignedUserId = shop.userId?._id || shop.userId;
    if (!assignedUserId) {
      return NextResponse.json({
        success: true,
        store: {
          id: shop._id?.toString(),
          name: shop.name || '',
        },
        dateRange: {
          fromDate: fromDate.toISOString(),
          toDate: toDate.toISOString(),
        },
        count: 0,
        data: [],
        note: 'No user is assigned to this shop, so no store-wise sales can be returned.',
      });
    }

    const sales = await Sale.find({
      userId: assignedUserId,
      createdAt: {
        $gte: fromDate,
        $lte: toDate,
      },
    })
      .populate('customerId', 'name phone')
      .sort({ createdAt: 1 })
      .lean();

    const data = sales.map((sale) => mapSaleToADSR(sale, shop));

    return NextResponse.json({
      success: true,
      store: {
        id: shop._id?.toString(),
        name: shop.name || '',
      },
      dateRange: {
        fromDate: fromDate.toISOString(),
        toDate: toDate.toISOString(),
      },
      count: data.length,
      data,
      assumptions: {
        taxValue: 'Current sales do not store separate tax; returned as 0 unless taxValue/taxAmount exists.',
        discountAmount: 'Current sales do not store separate discount; returned as 0 unless discountAmount exists.',
        invoiceNumber: 'Uses sale invoiceNumber when present, otherwise sale _id.',
      },
    });
  } catch (error) {
    console.error('ADSR sales export error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
