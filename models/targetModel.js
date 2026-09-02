import mongoose from 'mongoose';

const targetSchema = new mongoose.Schema({
  shopId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Shop',
    required: true
  },
  shopName: {
    type: String,
    required: true,
    trim: true
  },
  period: {
    type: String,
    enum: ['monthly'],
    default: 'monthly'
  },
  targetAmount: {
    type: Number,
    required: true,
    min: 0
  },
  minimumTargetAmount: {
    type: Number,
    default: 0,
    min: 0
  },
  isActive: {
    type: Boolean,
    default: true
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

targetSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

targetSchema.index({ shopId: 1, period: 1 }, { unique: true });
targetSchema.index({ isActive: 1 });
targetSchema.index({ shopName: 'text' });

const Target = mongoose.models.Target || mongoose.model('Target', targetSchema);

export default Target;
