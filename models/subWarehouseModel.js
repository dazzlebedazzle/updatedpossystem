import mongoose from 'mongoose';

const subWarehouseSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
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

subWarehouseSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Add indexes for performance optimization
subWarehouseSchema.index({ userId: 1 }); // For filtering by user
subWarehouseSchema.index({ isActive: 1 }); // For filtering active warehouses
subWarehouseSchema.index({ name: 'text' }); // For text search

// Delete existing model if it exists to allow schema updates
if (mongoose.models.SubWarehouse) {
  delete mongoose.models.SubWarehouse;
}

const SubWarehouse = mongoose.model('SubWarehouse', subWarehouseSchema);

export default SubWarehouse;
