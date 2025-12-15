import { NextResponse } from 'next/server';
import { productDB } from '@/lib/database';

// Mark this route as dynamic to prevent build-time analysis
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request) {
  try {
    const sessionCookie = request.cookies.get('session');
    let session = null;
    
    if (sessionCookie) {
      try {
        session = JSON.parse(sessionCookie.value);
      } catch (e) {
        return NextResponse.json(
          { error: 'Unauthorized' },
          { status: 401 }
        );
      }
    }
    
    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const products = await productDB.findAll();
    
    // Get unique categories with count
    const categoryMap = {};
    products.forEach(product => {
      const category = product.category || 'general';
      if (!categoryMap[category]) {
        categoryMap[category] = {
          name: category,
          count: 0
        };
      }
      categoryMap[category].count++;
    });

    const categories = Object.values(categoryMap).sort((a, b) => a.name.localeCompare(b.name));
    
    return NextResponse.json({ categories });
  } catch (error) {
    console.error('Get categories error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

