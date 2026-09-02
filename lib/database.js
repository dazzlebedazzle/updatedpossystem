// Database operations using Mongoose models
import connectDB from './db.js';
import User from '../models/userModel.js';
import Product from '../models/productModel.js';
import Sale from '../models/saleModel.js';
import Customer from '../models/customerModel.js';
import Inventory from '../models/inventoryModel.js';
import WarehouseInventory from '../models/warehouseInventoryModel.js';
import SubWarehouse from '../models/subWarehouseModel.js';
import Shop from '../models/shopModel.js';
import Purchase from '../models/purchaseModel.js';
import Target from '../models/targetModel.js';

// Ensure database connection
const ensureConnection = async () => {
  // Skip during build time
  if (process.env.NEXT_PHASE === 'phase-production-build') {
    return;
  }
  
  const connection = await connectDB();
  if (!connection) {
    throw new Error('Database connection failed. Please check MONGODB_URI environment variable.');
  }
};

// User Management
export const userDB = {
  create: async (userData) => {
    await ensureConnection();
    const user = new User(userData);
    await user.save();
    return user;
  },
  
  findByEmail: async (email) => {
    await ensureConnection();
    return await User.findOne({ email });
  },
  
  findByToken: async (token) => {
    await ensureConnection();
    return await User.findOne({ token }).select('-password');
  },
  
  findById: async (id) => {
    await ensureConnection();
    return await User.findById(id);
  },
  
  findAll: async () => {
    await ensureConnection();
    return await User.find({}).select('-password');
  },
  
  update: async (id, updates) => {
    await ensureConnection();
    return await User.findByIdAndUpdate(id, updates, { new: true }).select('-password');
  },

  markPasswordChangeRequired: async (id) => {
    await ensureConnection();
    return await User.findByIdAndUpdate(
      id,
      {
        mustChangePassword: true,
        lastAutoPasswordRefreshAt: new Date()
      },
      { new: true }
    );
  },
  
  delete: async (id) => {
    await ensureConnection();
    const result = await User.findByIdAndDelete(id);
    return result !== null;
  }
};

// Product Management
export const productDB = {
  create: async (productData) => {
    await ensureConnection();
    const product = new Product(productData);
    await product.save();
    return product;
  },
  
  findAll: async (options = {}) => {
    await ensureConnection();
    const { limit, skip, sort = { createdAt: -1 }, select } = options;
    let query = Product.find({});
    
    if (select) {
      query = query.select(select);
    }
    
    if (sort) {
      query = query.sort(sort);
    }
    
    if (skip) {
      query = query.skip(skip);
    }
    
    if (limit) {
      query = query.limit(limit);
    }
    
    return await query.lean(); // Use lean() for faster queries when we don't need Mongoose documents
  },
  
  findById: async (id) => {
    await ensureConnection();
    return await Product.findById(id);
  },
  
  update: async (id, updates) => {
    await ensureConnection();
    return await Product.findByIdAndUpdate(id, updates, { new: true });
  },
  
  delete: async (id) => {
    await ensureConnection();
    const result = await Product.findByIdAndDelete(id);
    return result !== null;
  }
};

// Sales Management
export const saleDB = {
  create: async (saleData) => {
    await ensureConnection();
    const sale = new Sale(saleData);
    await sale.save();
    return await Sale.findById(sale._id).populate('userId', 'name email').populate('customerId', 'name');
  },
  
  findAll: async (options = {}) => {
    await ensureConnection();
    const { limit, skip, sort = { createdAt: -1 }, select } = options;
    let query = Sale.find({});
    
    if (select) {
      query = query.select(select);
    }
    
    query = query.populate('userId', 'name email').populate('customerId', 'name');
    
    if (sort) {
      query = query.sort(sort);
    }
    
    if (skip) {
      query = query.skip(skip);
    }
    
    if (limit) {
      query = query.limit(limit);
    }
    
    return await query.lean();
  },
  
  findById: async (id) => {
    await ensureConnection();
    return await Sale.findById(id).populate('userId', 'name email').populate('customerId', 'name');
  },
  
  findByUserId: async (userId) => {
    await ensureConnection();
    return await Sale.find({ userId }).populate('customerId', 'name');
  }
};

// Purchase Management
export const purchaseDB = {
  create: async (purchaseData) => {
    await ensureConnection();
    const purchase = new Purchase(purchaseData);
    await purchase.save();
    return await Purchase.findById(purchase._id)
      .populate('items.productId', 'EAN_code product_name unit price supplier')
      .populate('createdBy', 'name email');
  },

  findAll: async (options = {}) => {
    await ensureConnection();
    const { limit, skip, sort = { purchaseDate: -1 }, select } = options;
    let query = Purchase.find({});

    if (select) {
      query = query.select(select);
    }

    query = query
      .populate('items.productId', 'EAN_code product_name unit price supplier')
      .populate('createdBy', 'name email');

    if (sort) {
      query = query.sort(sort);
    }

    if (skip) {
      query = query.skip(skip);
    }

    if (limit) {
      query = query.limit(limit);
    }

    return await query.lean();
  },

  findById: async (id) => {
    await ensureConnection();
    return await Purchase.findById(id)
      .populate('items.productId', 'EAN_code product_name unit price supplier')
      .populate('createdBy', 'name email');
  }
};

// Target Management
export const targetDB = {
  createOrUpdate: async (targetData) => {
    await ensureConnection();
    return await Target.findOneAndUpdate(
      { shopId: targetData.shopId, period: targetData.period || 'monthly' },
      targetData,
      { new: true, upsert: true, setDefaultsOnInsert: true }
    ).populate('shopId', 'name location');
  },

  findAll: async (options = {}) => {
    await ensureConnection();
    const { sort = { shopName: 1 } } = options;
    return await Target.find({})
      .populate('shopId', 'name location')
      .populate('createdBy', 'name email')
      .sort(sort)
      .lean();
  },

  findActive: async () => {
    await ensureConnection();
    return await Target.find({ isActive: true })
      .populate('shopId', 'name location')
      .sort({ shopName: 1 })
      .lean();
  },

  update: async (id, updates) => {
    await ensureConnection();
    return await Target.findByIdAndUpdate(id, updates, { new: true })
      .populate('shopId', 'name location');
  },

  delete: async (id) => {
    await ensureConnection();
    const result = await Target.findByIdAndDelete(id);
    return result !== null;
  }
};

// Customer Management
export const customerDB = {
  create: async (customerData) => {
    await ensureConnection();
    const customer = new Customer(customerData);
    await customer.save();
    return customer;
  },
  
  findAll: async (options = {}) => {
    await ensureConnection();
    const { limit, skip, sort = { createdAt: -1 } } = options;
    let query = Customer.find({});
    
    if (sort) {
      query = query.sort(sort);
    }
    
    if (skip) {
      query = query.skip(skip);
    }
    
    if (limit) {
      query = query.limit(limit);
    }
    
    return await query.lean();
  },
  
  findById: async (id) => {
    await ensureConnection();
    return await Customer.findById(id);
  },
  
  update: async (id, updates) => {
    await ensureConnection();
    return await Customer.findByIdAndUpdate(id, updates, { new: true });
  },
  
  delete: async (id) => {
    await ensureConnection();
    const result = await Customer.findByIdAndDelete(id);
    return result !== null;
  }
};

// Inventory Management
export const inventoryDB = {
  create: async (inventoryData) => {
    await ensureConnection();
    const inventory = new Inventory(inventoryData);
    await inventory.save();
    return await Inventory.findById(inventory._id).populate('productId', 'name sku').populate('userId', 'name');
  },
  
  findAll: async () => {
    await ensureConnection();
    return await Inventory.find({}).populate('productId', 'name sku stock').populate('userId', 'name');
  },
  
  findById: async (id) => {
    await ensureConnection();
    return await Inventory.findById(id).populate('productId', 'name sku').populate('userId', 'name');
  },
  
  update: async (id, updates) => {
    await ensureConnection();
    return await Inventory.findByIdAndUpdate(id, updates, { new: true });
  }
};

// Warehouse Inventory Management
export const warehouseInventoryDB = {
  create: async (warehouseData) => {
    await ensureConnection();
    const warehouse = new WarehouseInventory(warehouseData);
    await warehouse.save();
    return await WarehouseInventory.findById(warehouse._id)
      .populate('productId')
      .populate('subWarehouseStock.subWarehouseId', 'name location')
      .populate('shopStock.shopId', 'name location')
      .populate('transfers.transferredBy', 'name');
  },
  
  findAll: async (options = {}) => {
    await ensureConnection();
    const { limit, skip, sort = { createdAt: -1 }, select } = options;
    let query = WarehouseInventory.find({});
    
    if (select) {
      query = query.select(select);
    }
    
    query = query
      .populate('productId', 'EAN_code product_name category unit price')
      .populate('subWarehouseStock.subWarehouseId', 'name location')
      .populate('shopStock.shopId', 'name location')
      .populate('transfers.transferredBy', 'name');
    
    if (sort) {
      query = query.sort(sort);
    }
    
    if (skip) {
      query = query.skip(skip);
    }
    
    if (limit) {
      query = query.limit(limit);
    }
    
    return await query.lean();
  },
  
  findByProductId: async (productId) => {
    await ensureConnection();
    return await WarehouseInventory.findOne({ productId })
      .populate('productId')
      .populate('subWarehouseStock.subWarehouseId', 'name location')
      .populate('shopStock.shopId', 'name location')
      .populate('transfers.transferredBy', 'name');
  },
  
  findById: async (id) => {
    await ensureConnection();
    return await WarehouseInventory.findById(id)
      .populate('productId')
      .populate('subWarehouseStock.subWarehouseId', 'name location')
      .populate('shopStock.shopId', 'name location')
      .populate('transfers.transferredBy', 'name');
  },
  
  update: async (id, updates) => {
    await ensureConnection();
    const { $push, $set, ...regularUpdates } = updates;
    const doc = await WarehouseInventory.findById(id);
    if (!doc) return null;
    
    // Apply regular updates
    Object.assign(doc, regularUpdates);

    if ($set) {
      Object.assign(doc, $set);
    }
    
    // Handle $push for transfers and stock arrays
    if ($push) {
      if ($push.transfers) {
        doc.transfers.push($push.transfers);
      }
      if ($push.subWarehouseStock) {
        doc.subWarehouseStock.push($push.subWarehouseStock);
      }
      if ($push.shopStock) {
        doc.shopStock.push($push.shopStock);
      }
    }
    
    await doc.save();
    return await WarehouseInventory.findById(id)
      .populate('productId')
      .populate('subWarehouseStock.subWarehouseId', 'name location')
      .populate('shopStock.shopId', 'name location')
      .populate('transfers.transferredBy', 'name');
  },
  
  createOrUpdate: async (productId, warehouseData) => {
    await ensureConnection();
    let warehouse = await WarehouseInventory.findOne({ productId });
    if (warehouse) {
      return await WarehouseInventory.findByIdAndUpdate(warehouse._id, warehouseData, { new: true })
        .populate('productId')
        .populate('subWarehouseStock.subWarehouseId', 'name location')
        .populate('shopStock.shopId', 'name location')
        .populate('transfers.transferredBy', 'name');
    } else {
      const newWarehouse = new WarehouseInventory({ ...warehouseData, productId });
      await newWarehouse.save();
      return await WarehouseInventory.findById(newWarehouse._id)
        .populate('productId')
        .populate('subWarehouseStock.subWarehouseId', 'name location')
        .populate('shopStock.shopId', 'name location')
        .populate('transfers.transferredBy', 'name');
    }
  }
};

// Sub Warehouse Management
export const subWarehouseDB = {
  create: async (subWarehouseData) => {
    await ensureConnection();
    // Convert empty string userId to null
    if (subWarehouseData.userId === '') {
      subWarehouseData.userId = null;
    }
    const subWarehouse = new SubWarehouse(subWarehouseData);
    await subWarehouse.save();
    const query = SubWarehouse.findById(subWarehouse._id);
    if (subWarehouse.userId) {
      query.populate('userId', 'name email');
    }
    return await query;
  },
  
  findAll: async () => {
    await ensureConnection();
    return await SubWarehouse.find({}).populate('userId', 'name email').sort({ name: 1 });
  },
  
  findById: async (id) => {
    await ensureConnection();
    return await SubWarehouse.findById(id).populate('userId', 'name email');
  },
  
  update: async (id, updates) => {
    await ensureConnection();
    // Convert empty string userId to null
    if (updates.userId === '') {
      updates.userId = null;
    }
    return await SubWarehouse.findByIdAndUpdate(id, updates, { new: true }).populate('userId', 'name email');
  },
  
  delete: async (id) => {
    await ensureConnection();
    const result = await SubWarehouse.findByIdAndDelete(id);
    return result !== null;
  }
};

// Shop Management
export const shopDB = {
  create: async (shopData) => {
    await ensureConnection();
    // Convert empty string userId to null
    if (shopData.userId === '') {
      shopData.userId = null;
    }
    const shop = new Shop(shopData);
    await shop.save();
    return await Shop.findById(shop._id)
      .populate('subWarehouseId', 'name')
      .populate({ path: 'subWarehouseId', populate: { path: 'userId', select: 'name email' } })
      .populate('userId', 'name email');
  },
  
  findAll: async () => {
    await ensureConnection();
    return await Shop.find({})
      .populate('subWarehouseId', 'name')
      .populate({ path: 'subWarehouseId', populate: { path: 'userId', select: 'name email' } })
      .populate('userId', 'name email')
      .sort({ name: 1 });
  },
  
  findBySubWarehouseId: async (subWarehouseId) => {
    await ensureConnection();
    return await Shop.find({ subWarehouseId })
      .populate('subWarehouseId', 'name')
      .populate({ path: 'subWarehouseId', populate: { path: 'userId', select: 'name email' } })
      .populate('userId', 'name email');
  },
  
  findByUserId: async (userId) => {
    await ensureConnection();
    return await Shop.find({ userId })
      .populate('subWarehouseId', 'name location')
      .populate({ path: 'subWarehouseId', populate: { path: 'userId', select: 'name email' } })
      .populate('userId', 'name email');
  },
  
  findById: async (id) => {
    await ensureConnection();
    return await Shop.findById(id)
      .populate('subWarehouseId', 'name')
      .populate({ path: 'subWarehouseId', populate: { path: 'userId', select: 'name email' } })
      .populate('userId', 'name email');
  },
  
  update: async (id, updates) => {
    await ensureConnection();
    // Convert empty string userId to null
    if (updates.userId === '') {
      updates.userId = null;
    }
    return await Shop.findByIdAndUpdate(id, updates, { new: true })
      .populate('subWarehouseId', 'name')
      .populate({ path: 'subWarehouseId', populate: { path: 'userId', select: 'name email' } })
      .populate('userId', 'name email');
  },
  
  delete: async (id) => {
    await ensureConnection();
    const result = await Shop.findByIdAndDelete(id);
    return result !== null;
  }
};
