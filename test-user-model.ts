import dotenv from 'dotenv';
dotenv.config();

try {
  console.log('🔍 Testing User Model Import...');
  
  // Test importing the User model directly
  const { User } = require('./src/models/User');
  
  console.log('✅ User model imported');
  console.log('User type:', typeof User);
  console.log('User functions:', Object.getOwnPropertyNames(User));
  
  // Test if User has findOne method
  if (User.findOne) {
    console.log('✅ User.findOne method found');
  } else {
    console.log('❌ User.findOne method not found');
  }
  
  // Test connecting to MongoDB and using User
  const mongoose = require('mongoose');
  const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/tuition-app';
  
  mongoose.connect(mongoUri).then(async () => {
    console.log('✅ Connected to MongoDB');
    
    try {
      const users = await User.findOne({ role: 'admin' });
      console.log('✅ User.findOne works, found:', !!users);
    } catch (error: any) {
      console.log('❌ User.findOne failed:', error.message);
    }
    
    await mongoose.disconnect();
    console.log('📦 Disconnected from MongoDB');
  }).catch((error: any) => {
    console.log('❌ MongoDB connection failed:', error.message);
  });
  
} catch (error: any) {
  console.error('💥 User model test failed:', error.message);
  console.error('Stack:', error.stack);
}
