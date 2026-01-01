import { NextResponse } from 'next/server';
import { productDB } from '@/lib/database';
import { hasPermission, MODULES, OPERATIONS } from '@/lib/permissions';
import { getSessionFromRequest } from '@/lib/auth-helper';

// Mark this route as dynamic to prevent build-time analysis
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request, { params }) {
  try {
    const { id } = await params;
    const session = await getSessionFromRequest(request);
    
    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }
    
    // Check READ permission for products
    if (!hasPermission(session.permissions, MODULES.PRODUCTS, OPERATIONS.READ)) {
      return NextResponse.json(
        { error: 'Permission denied: products:read' },
        { status: 403 }
      );
    }
    
    const product = await productDB.findById(id);
    if (!product) {
      return NextResponse.json(
        { error: 'Product not found' },
        { status: 404 }
      );
    }
    
    return NextResponse.json({ product });
  } catch (error) {
    console.error('Get product error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PUT(request, { params }) {
  try {
    const { id } = await params;
    const session = await getSessionFromRequest(request);
    
    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }
    
    // Check UPDATE permission for products
    if (!hasPermission(session.permissions, MODULES.PRODUCTS, OPERATIONS.UPDATE)) {
      return NextResponse.json(
        { error: 'Permission denied: products:update' },
        { status: 403 }
      );
    }
    
    const updates = await request.json();
    const updatedProduct = await productDB.update(id, updates);
    
    if (!updatedProduct) {
      return NextResponse.json(
        { error: 'Product not found' },
        { status: 404 }
      );
    }
    
    return NextResponse.json({ success: true, product: updatedProduct });
  } catch (error) {
    console.error('Update product error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function DELETE(request, { params }) {
  try {
    const { id } = await params;
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
        { error: 'Permission denied: products:delete' },
        { status: 403 }
      );
    }
    
    const deleted = await productDB.delete(id);
    if (!deleted) {
      return NextResponse.json(
        { error: 'Product not found' },
        { status: 404 }
      );
    }
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete product error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
