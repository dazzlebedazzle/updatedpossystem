import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { getSessionFromRequest } from '@/lib/auth-helper';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const SCANNED_DATA_FILE = path.join(process.cwd(), 'scanned_data_temp.json');

// GET - Retrieve scanned data
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

    if (!fs.existsSync(SCANNED_DATA_FILE)) {
      return NextResponse.json({ scannedData: [] });
    }

    const fileContent = fs.readFileSync(SCANNED_DATA_FILE, 'utf8');
    const scannedData = JSON.parse(fileContent);
    
    return NextResponse.json({ scannedData });
  } catch (error) {
    console.error('Error reading scanned data:', error);
    return NextResponse.json(
      { error: 'Failed to read scanned data' },
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

    const body = await request.json();
    const { barcode, weight, pricePerKg, totalPrice, productName, scannedAt } = body;

    // Read existing data
    let scannedData = [];
    if (fs.existsSync(SCANNED_DATA_FILE)) {
      const fileContent = fs.readFileSync(SCANNED_DATA_FILE, 'utf8');
      scannedData = JSON.parse(fileContent);
    }

    // Add new scanned item
    const newItem = {
      id: Date.now().toString(),
      barcode: barcode || '',
      productName: productName || '',
      weight: weight || '',
      pricePerKg: pricePerKg || '',
      totalPrice: totalPrice || '',
      scannedAt: scannedAt || new Date().toISOString()
    };

    scannedData.push(newItem);

    // Save to file
    fs.writeFileSync(SCANNED_DATA_FILE, JSON.stringify(scannedData, null, 2));

    return NextResponse.json({ 
      success: true, 
      data: newItem,
      message: 'Scanned data saved successfully' 
    });
  } catch (error) {
    console.error('Error saving scanned data:', error);
    return NextResponse.json(
      { error: 'Failed to save scanned data' },
      { status: 500 }
    );
  }
}

// DELETE - Clear all scanned data
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

    if (fs.existsSync(SCANNED_DATA_FILE)) {
      fs.unlinkSync(SCANNED_DATA_FILE);
    }
    return NextResponse.json({ success: true, message: 'Scanned data cleared' });
  } catch (error) {
    console.error('Error clearing scanned data:', error);
    return NextResponse.json(
      { error: 'Failed to clear scanned data' },
      { status: 500 }
    );
  }
}

