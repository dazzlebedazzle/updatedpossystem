import { shopDB, userDB } from './database';

const getId = (value) => {
  if (!value) return '';
  if (typeof value === 'string') return value;
  if (value._id) return value._id.toString();
  if (value.id) return value.id.toString();
  return value.toString();
};

export async function getManagerAccess(session) {
  if (!session || session.role !== 'manager') {
    return { shops: [], allowedProductShopIds: new Set() };
  }

  let assignedShopIds = session.assignedShopIds || [];

  if (assignedShopIds.length === 0 && session.userId) {
    const user = await userDB.findById(session.userId);
    const userObj = user?.toObject ? user.toObject() : user;
    assignedShopIds = userObj?.assignedShopIds || [];
  }

  const assignedSet = new Set(assignedShopIds.map(getId).filter(Boolean));
  if (assignedSet.size === 0) {
    return { shops: [], allowedProductShopIds: new Set() };
  }

  const allShops = await shopDB.findAll();
  const shops = allShops.filter((shop) => assignedSet.has(getId(shop._id || shop.id)));
  const allowedProductShopIds = new Set();

  shops.forEach((shop) => {
    const shopObj = shop.toObject ? shop.toObject() : shop;
    const shopId = getId(shopObj._id || shopObj.id);
    const shopUserId = getId(shopObj.userId);

    if (shopId) allowedProductShopIds.add(shopId);
    if (shopUserId) allowedProductShopIds.add(shopUserId);
  });

  return { shops, allowedProductShopIds };
}

export function canManagerAccessProduct(product, allowedProductShopIds) {
  const productObj = product?.toObject ? product.toObject() : product;
  const productShopId = getId(productObj?.shopId);
  return Boolean(productShopId && allowedProductShopIds.has(productShopId));
}

export function findManagedShopForProduct(product, shops) {
  const productObj = product?.toObject ? product.toObject() : product;
  const productShopId = getId(productObj?.shopId);

  return shops.find((shop) => {
    const shopObj = shop.toObject ? shop.toObject() : shop;
    return getId(shopObj._id || shopObj.id) === productShopId || getId(shopObj.userId) === productShopId;
  });
}
