import dotenv from 'dotenv';
dotenv.config();

import mongoose from 'mongoose';

async function testLoginFunction() {
  try {
    console.log('🧪 Testing Login Function Directly...');
    
    // Connect to MongoDB
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/tuition-app';
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB');
    
    // Import and test the login function
    const { login } = require('./src/controllers/authController');
    
    // Create mock request and response objects
    const mockReq = {
      body: {
        emailOrMobile: 'admin@test.com',
        password: 'Admin123'
      }
    };
    
    const mockRes = {
      status: (code: number) => ({
        json: (data: any) => {
          console.log(`Response Status: ${code}`);
          console.log(`Response Data:`, JSON.stringify(data, null, 2));
          return { status: code, data };
        }
      })
    };
    
    console.log('\n🔑 Testing login function...');
    await login(mockReq, mockRes);
    
  } catch (error: any) {
    console.error('💥 Login function test failed:', error.message);
    console.error('Stack:', error.stack);
  } finally {
    await mongoose.disconnect();
    console.log('📦 Disconnected from MongoDB');
  }
}

testLoginFunction();
