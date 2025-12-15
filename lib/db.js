import mongoose from 'mongoose';

const MONGODB_URI = process.env.MONGODB_URI;

// Don't throw error during build time - only at runtime
if (!MONGODB_URI && typeof window === 'undefined' && process.env.NEXT_PHASE !== 'phase-production-build') {
  console.warn('MONGODB_URI environment variable is not defined');
}

let cached = global.mongoose;

if (!cached) {
  cached = global.mongoose = { conn: null, promise: null };
}

async function connectDB() {
  // Skip database connection during build time
  if (process.env.NEXT_PHASE === 'phase-production-build') {
    return null;
  }

  // If MONGODB_URI is not set, return null (will be handled by API routes)
  if (!MONGODB_URI) {
    return null;
  }

  if (cached.conn) {
    return cached.conn;
  }

  if (!cached.promise) {
    const opts = {
      bufferCommands: false,
    };

    cached.promise = mongoose.connect(MONGODB_URI, opts).then((mongoose) => {
      console.log('MongoDB connected successfully');
      return mongoose;
    }).catch((error) => {
      console.error('MongoDB connection error:', error);
      cached.promise = null;
      throw error;
    });
  }

  try {
    cached.conn = await cached.promise;
  } catch (e) {
    cached.promise = null;
    throw e;
  }

  return cached.conn;
}

export default connectDB;

