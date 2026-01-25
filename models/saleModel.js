import mongoose from 'mongoose';

const saleItemSchema = new mongoose.Schema({
  productId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true
  },
  quantity: {
    type: Number,
    required: true,
    min: 0
  },
  unit: {
    type: String,
    enum: ['kg', 'packets', 'pieces'],
    default: 'kg'
  },
  price: {
    type: Number,
    required: true
  },
  name: {
    type: String,
    required: true
  }
}, { _id: false });

const saleSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  customerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Customer',
    default: null
  },
  customerName: {
    type: String,
    default: null
  },
  customerMobile: {
    type: String,
    default: null
  },
  customerAddress: {
    type: String,
    default: null
  },
  items: {
    type: [saleItemSchema],
    required: true
  },
  total: {
    type: Number,
    required: true,
    min: 0
  },
  paymentMethod: {
    type: String,
    enum: ['cash', 'card', 'upi', 'Cash', 'Card', 'UPI'],
    default: 'cash'
  },
  status: {
    type: String,
    enum: ['completed', 'cancelled', 'refunded'],
    default: 'completed'
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

saleSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Add indexes for performance optimization
saleSchema.index({ userId: 1 }); // For filtering by user
saleSchema.index({ customerId: 1 }); // For filtering by customer
saleSchema.index({ createdAt: -1 }); // For sorting by date (most common query)
saleSchema.index({ paymentMethod: 1 }); // For payment method filtering
saleSchema.index({ status: 1 }); // For status filtering
saleSchema.index({ createdAt: 1, userId: 1 }); // Compound index for user sales queries

const Sale = mongoose.models.Sale || mongoose.model('Sale', saleSchema);

export default Sale;

