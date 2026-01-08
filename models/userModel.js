import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  password: {
    type: String,
    required: true
  },
  role: {
    type: String,
    enum: ['superadmin', 'admin', 'agent'],
    required: true,
    default: 'agent'
  },
  token: {
    type: String,
    default: function() {
      // Set token based on role
      if (this.role === 'superadmin') return 'superToken';
      if (this.role === 'admin') return 'adminToken';
      if (this.role === 'agent') return 'agentToken';
      return null;
    }
  },
  permissions: {
    type: [String],
    default: []
  },
  supplier: {
    type: String,
    default: '',
    trim: true,
    unique: true,
    sparse: true // Allows multiple null/empty values but enforces uniqueness for non-empty values
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

// Update the updatedAt field before saving
userSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  // Ensure token is set based on role
  if (this.role === 'superadmin') this.token = 'superToken';
  else if (this.role === 'admin') this.token = 'adminToken';
  else if (this.role === 'agent') this.token = 'agentToken';
  next();
});

// Add indexes for performance optimization
userSchema.index({ email: 1 }); // Already unique, but explicit index helps
userSchema.index({ token: 1 }); // For token-based lookups
userSchema.index({ role: 1 }); // For role filtering
userSchema.index({ supplier: 1 }); // For supplier filtering
userSchema.index({ name: 'text' }); // For text search

const User = mongoose.models.User || mongoose.model('User', userSchema);

export default User;

