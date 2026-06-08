import dotenv from 'dotenv';
dotenv.config();

import mongoose from 'mongoose';

async function checkDB() {
  try {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/tuition-app';
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB');

    // Get the users collection
    const db = mongoose.connection.db;
    if (!db) {
      throw new Error('Database connection not established');
    }
    const usersCollection = db.collection('users');

    // Check indexes
    const indexes = await usersCollection.indexes();
    console.log('\n📋 Current Indexes:');
    indexes.forEach((index, i) => {
      console.log(`${i + 1}.`, JSON.stringify(index.key, null, 2));
    });

    // Check existing users
    const users = await usersCollection.find({}).toArray();
    console.log(`\n👥 Total Users: ${users.length}`);
    
    users.forEach((user, i) => {
      console.log(`\nUser ${i + 1}:`);
      console.log(`  _id: ${user._id}`);
      console.log(`  email: ${user.email}`);
      console.log(`  phoneNumber: ${user.phoneNumber}`);
      console.log(`  mobileNumber: ${user.mobileNumber}`);
      console.log(`  role: ${user.role}`);
    });

    // Delete the problematic mobileNumber index if it exists
    try {
      await usersCollection.dropIndex('mobileNumber_1');
      console.log('\n🗑️ Dropped mobileNumber_1 index');
    } catch (error: any) {
      if (error.codeName === 'IndexNotFound') {
        console.log('\n✅ mobileNumber_1 index does not exist');
      } else {
        console.log('\n⚠️ Error dropping index:', error.message);
      }
    }

  } catch (error: any) {
    console.error('💥 Error:', error.message);
  } finally {
    await mongoose.disconnect();
    console.log('📦 Disconnected from MongoDB');
  }
}

checkDB();
