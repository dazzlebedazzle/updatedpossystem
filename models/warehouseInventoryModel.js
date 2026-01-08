import mongoose from 'mongoose';

const warehouseInventorySchema = new mongoose.Schema({
  productId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true
  },
  // Main Warehouse Stock
  mainWarehouseQty: {
    type: Number,
    default: 0,
    min: 0
  },
  // Sub Warehouse Stock - now an array with sub-warehouse IDs
  subWarehouseStock: [{
    subWarehouseId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'SubWarehouse',
      required: true
    },
    quantity: {
      type: Number,
      default: 0,
      min: 0
    }
  }],
  // Shop Stock - now an array with shop IDs
  shopStock: [{
    shopId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Shop',
      required: true
    },
    quantity: {
      type: Number,
      default: 0,
      min: 0
    }
  }],
  // Transfer History
  transfers: [{
    from: {
      type: String,
      required: true
    },
    fromId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null
    },
    to: {
      type: String,
      required: true
    },
    toId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null
    },
    quantity: {
      type: Number,
      required: true,
      min: 0
    },
    transferredBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    transferredAt: {
      type: Date,
      default: Date.now
    },
    notes: {
      type: String,
      default: ''
    }
  }],
  // Product details snapshot (for reference)
  productDetails: {
    EAN_code: Number,
    product_name: String,
    category: String,
    unit: String,
    price: Number,
    supplier: String,
    expiry_date: String,
    date_arrival: String
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  strictPopulate: false // Allow populating paths not explicitly in schema if needed
});

warehouseInventorySchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Index for faster queries
warehouseInventorySchema.index({ productId: 1 });
warehouseInventorySchema.index({ 'productDetails.EAN_code': 1 });

// Delete existing model if it exists to allow schema updates
if (mongoose.models.WarehouseInventory) {
  delete mongoose.models.WarehouseInventory;
}

const WarehouseInventory = mongoose.model('WarehouseInventory', warehouseInventorySchema);

export default WarehouseInventory;
