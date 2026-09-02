import { NextResponse } from 'next/server';
import { productDB } from '@/lib/database';
import { getSessionFromRequest } from '@/lib/auth-helper';
import { canManagerAccessProduct, getManagerAccess, findManagedShopForProduct } from '@/lib/manager-access';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request) {
  try {
    const session = await getSessionFromRequest(request);

    if (!session || session.role !== 'manager') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { shops, allowedProductShopIds } = await getManagerAccess(session);
    const products = await productDB.findAll({
      select: 'EAN_code product_name images unit supplier qty qty_sold price category shopId createdAt',
      sort: { product_name: 1 }
    });

    const managedProducts = products
      .filter((product) => canManagerAccessProduct(product, allowedProductShopIds))
      .map((product) => {
        const shop = findManagedShopForProduct(product, shops);
        const shopObj = shop?.toObject ? shop.toObject() : shop;

        return {
          ...product,
          managedShop: shopObj
            ? {
                id: shopObj._id?.toString() || shopObj.id,
                name: shopObj.name || 'Assigned Store',
                location: shopObj.location || ''
              }
            : null
        };
      });

    return NextResponse.json({ products: managedProducts });
  } catch (error) {
    console.error('Get manager store products error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
