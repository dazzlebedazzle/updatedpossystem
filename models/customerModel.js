import mongoose from 'mongoose';

const customerSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  email: {
    type: String,
    lowercase: true,
    trim: true,
    default: ''
  },
  phone: {
    type: String,
    trim: true,
    default: ''
  },
  address: {
    type: String,
    default: ''
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
});

customerSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Add indexes for performance optimization
customerSchema.index({ phone: 1 }); // For phone lookups
customerSchema.index({ name: 'text' }); // For text search
customerSchema.index({ createdAt: -1 }); // For sorting by date
customerSchema.index({ isActive: 1 }); // For filtering active customers

const Customer = mongoose.models.Customer || mongoose.model('Customer', customerSchema);

export default Customer;

