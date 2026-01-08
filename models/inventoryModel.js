import mongoose from 'mongoose';

const inventorySchema = new mongoose.Schema({
  productId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true
  },
  quantity: {
    type: Number,
    required: true
  },
  type: {
    type: String,
    enum: ['add', 'remove'],
    required: true
  },
  notes: {
    type: String,
    default: ''
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Add indexes for performance optimization
inventorySchema.index({ productId: 1 }); // For filtering by product
inventorySchema.index({ userId: 1 }); // For filtering by user
inventorySchema.index({ createdAt: -1 }); // For sorting by date
inventorySchema.index({ productId: 1, createdAt: -1 }); // Compound index for product history

const Inventory = mongoose.models.Inventory || mongoose.model('Inventory', inventorySchema);

export default Inventory;

