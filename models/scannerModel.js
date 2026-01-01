import mongoose from 'mongoose';

const scannerSchema = new mongoose.Schema({
  barcode: {
    type: String,
    default: '',
    trim: true
  },
  productName: {
    type: String,
    default: '',
    trim: true
  },
  weight: {
    type: String,
    default: '',
    trim: true
  },
  pricePerKg: {
    type: String,
    default: '',
    trim: true
  },
  totalPrice: {
    type: String,
    default: '',
    trim: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  scannedAt: {
    type: Date,
    default: Date.now
  }
});

const Scanner = mongoose.models.Scanner || mongoose.model('Scanner', scannerSchema);

export default Scanner;

