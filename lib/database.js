// Database operations using Mongoose models
import connectDB from './db.js';
import User from '../models/userModel.js';
import Product from '../models/productModel.js';
import Sale from '../models/saleModel.js';
import Customer from '../models/customerModel.js';
import Inventory from '../models/inventoryModel.js';

// Ensure database connection
const ensureConnection = async () => {
  await connectDB();
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
  
  findAll: async () => {
    await ensureConnection();
    return await Product.find({});
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
  
  findAll: async () => {
    await ensureConnection();
    return await Sale.find({}).populate('userId', 'name email').populate('customerId', 'name');
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

// Customer Management
export const customerDB = {
  create: async (customerData) => {
    await ensureConnection();
    const customer = new Customer(customerData);
    await customer.save();
    return customer;
  },
  
  findAll: async () => {
    await ensureConnection();
    return await Customer.find({});
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
