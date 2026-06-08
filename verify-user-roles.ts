import dotenv from 'dotenv';
dotenv.config();

import mongoose from 'mongoose';

async function verifyUserRoles() {
  try {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/tuition-app';
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB');

    const db = mongoose.connection.db;
    if (!db) {
      throw new Error('Database connection not established');
    }
    const usersCollection = db.collection('users');

    // Verify admin account
    console.log('\n🔍 VERIFYING ADMIN ACCOUNT:');
    const admin = await usersCollection.findOne({ email: 'admin@test.com' });
    
    if (admin) {
      console.log('✅ Admin found');
      console.log('📧 Email:', admin.email);
      console.log('🎭 Role:', admin.role);
      console.log('📱 Phone Number:', admin.phoneNumber);
      console.log('📱 Mobile Number:', admin.mobileNumber);
      console.log('👤 Profile:', admin.profile);
      console.log('✅ Profile Completed:', admin.profileCompleted);
      console.log('🚀 Onboarding Completed:', admin.onboardingCompleted);
    } else {
      console.log('❌ Admin not found');
    }

    // Verify staff account
    console.log('\n🔍 VERIFYING STAFF ACCOUNT:');
    const staff = await usersCollection.findOne({ email: 'staff@test.com' });
    
    if (staff) {
      console.log('✅ Staff found');
      console.log('📧 Email:', staff.email);
      console.log('🎭 Role:', staff.role);
      console.log('📱 Phone Number:', staff.phoneNumber);
      console.log('📱 Mobile Number:', staff.mobileNumber);
      console.log('👤 Profile:', staff.profile);
      console.log('✅ Profile Completed:', staff.profileCompleted);
      console.log('🚀 Onboarding Completed:', staff.onboardingCompleted);
    } else {
      console.log('❌ Staff not found');
    }

    // Test backend login response format
    console.log('\n🔍 TESTING BACKEND RESPONSE FORMAT:');
    
    // Simulate what backend returns for admin
    if (admin) {
      const backendResponse = {
        success: true,
        token: "mock-jwt-token",
        user: {
          id: admin._id,
          email: admin.email,
          phoneNumber: admin.mobileNumber, // BUG: Should be admin.phoneNumber
          role: admin.role,
          profile: admin.profile,
          profileCompleted: admin.profileCompleted,
          onboardingCompleted: admin.onboardingCompleted
        }
      };
      
      console.log('📤 Backend would return for admin:');
      console.log('  - Role:', backendResponse.user.role);
      console.log('  - Phone Number:', backendResponse.user.phoneNumber);
      console.log('  - Profile Completed:', backendResponse.user.profileCompleted);
      console.log('  - Onboarding Completed:', backendResponse.user.onboardingCompleted);
    }

  } catch (error: any) {
    console.error('💥 Error:', error.message);
  } finally {
    await mongoose.disconnect();
    console.log('\n📦 Disconnected from MongoDB');
  }
}

verifyUserRoles();
