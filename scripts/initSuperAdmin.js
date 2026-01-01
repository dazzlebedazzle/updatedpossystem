// Script to initialize superadmin user in the database
// Run this with: node scripts/initSuperAdmin.js

import 'dotenv/config';
import mongoose from 'mongoose';
import connectDB from '../lib/db.js';
import User from '../models/userModel.js';
import { hashPassword } from '../lib/auth.js';


async function initSuperAdmin() {
  try {
    await connectDB();
    
    // Check if superadmin already exists
    const existingSuperAdmin = await User.findOne({ email: 'superadmin@pos.com' });
    
    if (existingSuperAdmin) {
      console.log('Superadmin already exists!');
      process.exit(0);
    }
    
    // Create superadmin
    const hashedPassword = await hashPassword('superadmin123');
    
    const superAdmin = new User({
      name: 'Super Admin',
      email: 'superadmin@pos.com',
      password: hashedPassword,
      role: 'superadmin',
      token: 'superToken',
      permissions: ['all']
    });
    
    await superAdmin.save();
    
    console.log('Superadmin created successfully!');
    console.log('Email: superadmin@pos.com');
    console.log('Password: superadmin123');
    console.log('Token: superToken');
    
    process.exit(0);
  } catch (error) {
    console.error('Error initializing superadmin:', error);
    process.exit(1);
  }
}

initSuperAdmin();

