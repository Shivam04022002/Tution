import dotenv from 'dotenv';
dotenv.config();

import mongoose from 'mongoose';

async function checkUserData() {
  try {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/tuition-app';
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB');

    const db = mongoose.connection.db;
    if (!db) {
      throw new Error('Database connection not established');
    }
    const usersCollection = db.collection('users');

    // Check admin and staff accounts
    const admin = await usersCollection.findOne({ email: 'admin@test.com' });
    const staff = await usersCollection.findOne({ email: 'staff@test.com' });

    console.log('\n👑 ADMIN ACCOUNT:');
    console.log('Email:', admin?.email);
    console.log('Password exists:', !!admin?.password);
    console.log('Password type:', typeof admin?.password);
    console.log('Password length:', admin?.password?.length);
    console.log('All fields:', Object.keys(admin || {}));

    console.log('\n👥 STAFF ACCOUNT:');
    console.log('Email:', staff?.email);
    console.log('Password exists:', !!staff?.password);
    console.log('Password type:', typeof staff?.password);
    console.log('Password length:', staff?.password?.length);
    console.log('All fields:', Object.keys(staff || {}));

    // Check if the server.js can find the user
    console.log('\n🔍 TESTING SERVER.JS USER FIND:');
    
    // Test the server.js user lookup logic
    const adminLookup = await usersCollection.findOne({
      $or: [
        { email: 'admin@test.com' },
        { mobileNumber: 'admin@test.com' },
      ],
    });
    
    console.log('Admin lookup result:', !!adminLookup);
    if (adminLookup) {
      console.log('Admin lookup password exists:', !!adminLookup.password);
    }

  } catch (error: any) {
    console.error('💥 Error:', error.message);
  } finally {
    await mongoose.disconnect();
    console.log('\n📦 Disconnected from MongoDB');
  }
}

checkUserData();
