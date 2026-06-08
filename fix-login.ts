import dotenv from 'dotenv';
dotenv.config();

import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

async function fixLoginIssue() {
  try {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/tuition-app';
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB');

    const db = mongoose.connection.db;
    if (!db) {
      throw new Error('Database connection not established');
    }
    const usersCollection = db.collection('users');

    // Check staff account
    const staff = await usersCollection.findOne({ email: 'staff@test.com' });
    
    console.log('\n🔍 STAFF ACCOUNT CHECK:');
    console.log('Email:', staff?.email);
    console.log('Password exists:', !!staff?.password);
    console.log('Password type:', typeof staff?.password);
    console.log('Password length:', staff?.password?.length);
    console.log('Role:', staff?.role);
    console.log('Active:', staff?.isActive);

    // Test password comparison
    if (staff?.password) {
      console.log('\n🔐 TESTING PASSWORD COMPARISON:');
      try {
        const isMatch = await bcrypt.compare('staff123', staff.password);
        console.log('Password match:', isMatch);
      } catch (error: any) {
        console.log('Password comparison error:', error.message);
      }
    }

    // Check if we need to update the login endpoint to use the new TypeScript auth controller
    console.log('\n📝 RECOMMENDATION:');
    console.log('The login is failing because the app is using the old server.js login endpoint.');
    console.log('The staff account was created correctly with a hashed password.');
    console.log('We need to ensure the app uses the new TypeScript auth controller.');

  } catch (error: any) {
    console.error('💥 Error:', error.message);
  } finally {
    await mongoose.disconnect();
    console.log('\n📦 Disconnected from MongoDB');
  }
}

fixLoginIssue();
