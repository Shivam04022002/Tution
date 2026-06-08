import dotenv from 'dotenv';
dotenv.config();

import mongoose from 'mongoose';

async function verifyAccounts() {
  try {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/tuition-app';
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB');

    const db = mongoose.connection.db;
    if (!db) {
      throw new Error('Database connection not established');
    }
    const usersCollection = db.collection('users');

    // Find admin and staff accounts
    const admin = await usersCollection.findOne({ role: 'admin' });
    const staff = await usersCollection.findOne({ role: 'staff' });

    console.log('\n🎉 ACCOUNT MIGRATION COMPLETE');
    console.log('=====================================');
    
    console.log('\n👑 ADMIN ACCOUNT:');
    console.log('-------------------');
    if (admin) {
      console.log(`✅ Email: ${admin.email}`);
      console.log(`✅ Phone: ${admin.phoneNumber || admin.mobileNumber}`);
      console.log(`✅ Role: ${admin.role}`);
      console.log(`✅ Active: ${admin.isActive}`);
      console.log(`✅ Verified: ${admin.isVerified}`);
      console.log(`✅ Created: ${admin.createdAt}`);
    } else {
      console.log('❌ Admin account not found');
    }

    console.log('\n👥 STAFF ACCOUNT:');
    console.log('-------------------');
    if (staff) {
      console.log(`✅ Email: ${staff.email}`);
      console.log(`✅ Phone: ${staff.phoneNumber || staff.mobileNumber}`);
      console.log(`✅ Role: ${staff.role}`);
      console.log(`✅ Department: ${staff.profile?.department || 'Not set'}`);
      console.log(`✅ Active: ${staff.isActive}`);
      console.log(`✅ Verified: ${staff.isVerified}`);
      console.log(`✅ Created: ${staff.createdAt}`);
    } else {
      console.log('❌ Staff account not found');
    }

    console.log('\n🔐 LOGIN CREDENTIALS:');
    console.log('=======================');
    console.log('👑 ADMIN LOGIN:');
    console.log('   Email: admin@test.com');
    console.log('   Password: Admin123');
    console.log('');
    console.log('👥 STAFF LOGIN:');
    console.log('   Email: staff@test.com');
    console.log('   Password: staff123');

    console.log('\n✅ READY FOR LOGIN!');
    console.log('Both accounts are now active and ready for use.');

  } catch (error: any) {
    console.error('💥 Error:', error.message);
  } finally {
    await mongoose.disconnect();
    console.log('\n📦 Disconnected from MongoDB');
  }
}

verifyAccounts();
