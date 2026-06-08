import dotenv from 'dotenv';
dotenv.config();

import mongoose from 'mongoose';

async function checkUserPassword() {
  try {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/tuition-app';
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB');

    const db = mongoose.connection.db;
    if (!db) {
      throw new Error('Database connection not established');
    }
    const usersCollection = db.collection('users');

    // Check admin account with all fields
    console.log('\n🔍 CHECKING ADMIN ACCOUNT:');
    const admin = await usersCollection.findOne({ email: 'admin@test.com' });
    
    if (admin) {
      console.log('✅ Admin found');
      console.log('📧 Email:', admin.email);
      console.log('🔑 Password exists:', !!admin.password);
      console.log('🔑 Password type:', typeof admin.password);
      console.log('🔑 Password length:', admin.password?.length);
      console.log('📱 Phone Number:', admin.phoneNumber);
      console.log('📱 Mobile Number:', admin.mobileNumber);
      console.log('🎭 Role:', admin.role);
      console.log('📋 All fields:', Object.keys(admin));
      
      // Check if password is actually stored
      if (admin.password) {
        console.log('✅ Password is stored in database');
        console.log('🔑 Password preview:', admin.password.substring(0, 20) + '...');
      } else {
        console.log('❌ Password is NOT stored in database');
      }
    } else {
      console.log('❌ Admin not found');
    }

    // Check staff account
    console.log('\n🔍 CHECKING STAFF ACCOUNT:');
    const staff = await usersCollection.findOne({ email: 'staff@test.com' });
    
    if (staff) {
      console.log('✅ Staff found');
      console.log('📧 Email:', staff.email);
      console.log('🔑 Password exists:', !!staff.password);
      console.log('🔑 Password type:', typeof staff.password);
      console.log('🔑 Password length:', staff.password?.length);
      
      if (staff.password) {
        console.log('✅ Password is stored in database');
        console.log('🔑 Password preview:', staff.password.substring(0, 20) + '...');
      } else {
        console.log('❌ Password is NOT stored in database');
      }
    } else {
      console.log('❌ Staff not found');
    }

  } catch (error: any) {
    console.error('💥 Error:', error.message);
  } finally {
    await mongoose.disconnect();
    console.log('\n📦 Disconnected from MongoDB');
  }
}

checkUserPassword();
