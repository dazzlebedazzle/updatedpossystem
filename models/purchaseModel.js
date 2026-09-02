import mongoose from 'mongoose';

const purchaseItemSchema = new mongoose.Schema({
  productId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true
  },
  productName: {
    type: String,
    required: true,
    trim: true
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
  costPrice: {
    type: Number,
    required: true,
    min: 0
  },
  sellingPrice: {
    type: Number,
    default: 0,
    min: 0
  },
  lineTotal: {
    type: Number,
    required: true,
    min: 0
  }
}, { _id: false });

const purchaseSchema = new mongoose.Schema({
  supplier: {
    type: String,
    required: true,
    trim: true
  },
  invoiceNumber: {
    type: String,
    default: '',
    trim: true
  },
  purchaseDate: {
    type: Date,
    default: Date.now
  },
  destinationType: {
    type: String,
    enum: ['main', 'sub', 'shop'],
    required: true,
    default: 'main'
  },
  destinationId: {
    type: mongoose.Schema.Types.ObjectId,
    default: null
  },
  destinationName: {
    type: String,
    default: '',
    trim: true
  },
  items: {
    type: [purchaseItemSchema],
    required: true
  },
  totalCost: {
    type: Number,
    required: true,
    min: 0
  },
  paymentMethod: {
    type: String,
    enum: ['cash', 'card', 'upi', 'bank_transfer', 'credit', 'other'],
    default: 'cash'
  },
  paymentStatus: {
    type: String,
    enum: ['paid', 'partial', 'unpaid'],
    default: 'paid'
  },
  notes: {
    type: String,
    default: '',
    trim: true
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
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

purchaseSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

purchaseSchema.index({ supplier: 1 });
purchaseSchema.index({ invoiceNumber: 1 });
purchaseSchema.index({ purchaseDate: -1 });
purchaseSchema.index({ createdBy: 1 });
purchaseSchema.index({ destinationType: 1, destinationId: 1 });

const Purchase = mongoose.models.Purchase || mongoose.model('Purchase', purchaseSchema);

export default Purchase;
