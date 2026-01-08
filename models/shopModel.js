import mongoose from 'mongoose';

const shopSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  subWarehouseId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'SubWarehouse',
    required: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  location: {
    type: String,
    default: '',
    trim: true
  },
  contactPerson: {
    type: String,
    default: '',
    trim: true
  },
  contactPhone: {
    type: String,
    default: '',
    trim: true
  },
  isActive: {
    type: Boolean,
    default: true
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
  strictPopulate: false
});

shopSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Delete existing model if it exists to allow schema updates
if (mongoose.models.Shop) {
  delete mongoose.models.Shop;
}

const Shop = mongoose.model('Shop', shopSchema);

export default Shop;
