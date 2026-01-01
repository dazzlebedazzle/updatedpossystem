import { NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth-helper';
import { hasPermission, MODULES, OPERATIONS } from '@/lib/permissions';
import connectDB from '@/lib/db.js';
import Scanner from '@/models/scannerModel.js';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// GET - Fetch all scanned data for the user
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

    // Check READ permission for products (scanner is part of product management)
    const isAgentWithToken = session.token === 'agentToken' && session.role === 'agent';
    
    if (!hasPermission(session.permissions, MODULES.PRODUCTS, OPERATIONS.READ) && !isAgentWithToken) {
      return NextResponse.json(
        { error: 'Permission denied: products:read required' },
        { status: 403 }
      );
    }

    // Connect to database
    await connectDB();

    // Find all scanned data for this user
    const scannedData = await Scanner.find({ userId: session.userId })
      .sort({ scannedAt: -1 })
      .lean();

    // Add id field for frontend compatibility
    const formattedData = scannedData.map(item => ({
      ...item,
      id: item._id.toString()
    }));

    return NextResponse.json({ scannedData: formattedData });
  } catch (error) {
    console.error('Get scanned data error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST - Save scanned data
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

    // Check CREATE permission for products (scanner is part of product management)
    const isAgentWithToken = session.token === 'agentToken' && session.role === 'agent';
    
    if (!hasPermission(session.permissions, MODULES.PRODUCTS, OPERATIONS.CREATE) && !isAgentWithToken) {
      return NextResponse.json(
        { error: 'Permission denied: products:create required' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { barcode, productName, weight, pricePerKg, totalPrice, scannedAt } = body;

    // Connect to database
    await connectDB();

    // Create new scanned data entry
    const scannedData = new Scanner({
      barcode: barcode || '',
      productName: productName || '',
      weight: weight || '',
      pricePerKg: pricePerKg || '',
      totalPrice: totalPrice || '',
      userId: session.userId,
      scannedAt: scannedAt ? new Date(scannedAt) : new Date()
    });

    await scannedData.save();

    return NextResponse.json({ 
      success: true, 
      scannedData: scannedData.toObject()
    });
  } catch (error) {
    console.error('Save scanned data error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// DELETE - Clear all scanned data for the user
export async function DELETE(request) {
  try {
    // Get session from Bearer token or cookie
    const session = await getSessionFromRequest(request);
    
    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Check DELETE permission for products
    if (!hasPermission(session.permissions, MODULES.PRODUCTS, OPERATIONS.DELETE)) {
      return NextResponse.json(
        { error: 'Permission denied: products:delete required' },
        { status: 403 }
      );
    }

    // Connect to database
    await connectDB();

    // Delete all scanned data for this user
    await Scanner.deleteMany({ userId: session.userId });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete scanned data error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

