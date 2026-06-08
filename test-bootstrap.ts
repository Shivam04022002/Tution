import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { bootstrapAdmin, bootstrapStaff } from './src/scripts/bootstrapSystem';

// Load environment variables
dotenv.config();

console.log('🔧 Environment Variables Check:');
console.log('ADMIN_EMAIL:', process.env.ADMIN_EMAIL);
console.log('ADMIN_PASSWORD:', process.env.ADMIN_PASSWORD ? '***' : 'NOT SET');
console.log('STAFF_EMAIL:', process.env.STAFF_EMAIL);
console.log('STAFF_PASSWORD:', process.env.STAFF_PASSWORD ? '***' : 'NOT SET');

async function testBootstrap() {
  try {
    // Connect to MongoDB
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/tuition-app';
    console.log('📦 Connecting to MongoDB...');
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB');

    // Run bootstrap
    console.log('🔧 Running system bootstrap...');
    const adminResult = await bootstrapAdmin();
    console.log('Admin Result:', adminResult);

    const staffResult = await bootstrapStaff();
    console.log('Staff Result:', staffResult);

    if (adminResult.success && staffResult.success) {
      console.log('🎉 Bootstrap completed successfully!');
      console.log('\n📊 Created Accounts:');
      if (adminResult.admin) {
        console.log('Admin:');
        console.log(`  Name: ${adminResult.admin.name}`);
        console.log(`  Email: ${adminResult.admin.email}`);
        console.log(`  Phone: ${adminResult.admin.phone}`);
        console.log(`  Role: ${adminResult.admin.role}`);
      }
      if (staffResult.staff) {
        console.log('Staff:');
        console.log(`  Name: ${staffResult.staff.name}`);
        console.log(`  Email: ${staffResult.staff.email}`);
        console.log(`  Phone: ${staffResult.staff.phone}`);
        console.log(`  Role: ${staffResult.staff.role}`);
        console.log(`  Department: ${staffResult.staff.department}`);
      }
    } else {
      console.log('❌ Bootstrap failed');
    }

  } catch (error: any) {
    console.error('💥 Test failed:', error);
  } finally {
    await mongoose.disconnect();
    console.log('📦 Disconnected from MongoDB');
  }
}

testBootstrap();
