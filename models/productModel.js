import mongoose from 'mongoose';

const productSchema = new mongoose.Schema({
  EAN_code: {
    type: Number,
    required: true,
    unique: true
  },
  product_name: {
    type: String,
    required: true,
    trim: true
  },
  images: {
    type: String,
    default: ''
  },
  unit: {
    type: String,
    default: 'kg',
    trim: true
  },
  supplier: {
    type: String,
    default: '',
    trim: true
  },
  qty: {
    type: Number,
    required: true,
    min: 0,
    default: 0
  },
  qty_sold: {
    type: Number,
    default: 0,
    min: 0
  },
  expiry_date: {
    type: String,
    default: ''
  },
  date_arrival: {
    type: String,
    default: ''
  },
  // Keep price for backward compatibility and POS functionality
  price: {
    type: Number,
    default: 0,
    min: 0
  },
  // Keep category for filtering
  category: {
    type: String,
    default: 'general',
    trim: true
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

productSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

const Product = mongoose.models.Product || mongoose.model('Product', productSchema);

export default Product;

