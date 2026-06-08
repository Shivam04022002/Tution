import dotenv from 'dotenv';
dotenv.config();

import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

// Connect to MongoDB
async function connectDB() {
  const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/tuition-app';
  await mongoose.connect(mongoUri);
  console.log('✅ Connected to MongoDB');
}

// Define User schema matching the actual database structure
const userSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  phoneNumber: { type: String, required: false, unique: true, sparse: true },
  mobileNumber: { type: String, required: false, unique: true, sparse: true },
  password: { type: String, required: true, select: false },
  role: { type: String, enum: ['parent', 'teacher', 'admin', 'staff'], required: true },
  profile: {
    firstName: { type: String, required: true },
    lastName: { type: String, required: true },
    department: { type: String }
  },
  isActive: { type: Boolean, default: true },
  isVerified: { type: Boolean, default: false },
  isBlocked: { type: Boolean, default: false },
  profileCompleted: { type: Boolean, default: false },
  onboardingCompleted: { type: Boolean, default: false },
}, { timestamps: true });

const User = mongoose.model('User', userSchema);

async function createStaffAccount() {
  try {
    await connectDB();
    
    console.log('🔧 Creating Staff Account');
    console.log('STAFF_EMAIL:', process.env.STAFF_EMAIL);
    console.log('STAFF_PASSWORD:', process.env.STAFF_PASSWORD ? '***' : 'NOT SET');

    // Check if staff exists
    const existingStaff = await User.findOne({ role: 'staff' });
    if (existingStaff) {
      console.log('✅ Staff already exists:', existingStaff.email);
      console.log('📊 Staff Details:');
      console.log(`  Email: ${existingStaff.email}`);
      console.log(`  Role: ${existingStaff.role}`);
      console.log(`  Department: ${existingStaff.profile?.department}`);
      console.log(`  Active: ${existingStaff.isActive}`);
      return;
    }

    console.log('👤 Creating staff account...');
    const hashedStaffPassword = await bcrypt.hash(process.env.STAFF_PASSWORD!, 12);
    
    const staff = new User({
      email: process.env.STAFF_EMAIL,
      phoneNumber: process.env.STAFF_PHONE, // Use phoneNumber field
      password: hashedStaffPassword,
      role: 'staff',
      profile: {
        firstName: 'Operations',
        lastName: 'Staff',
        department: 'Operations',
      },
      isActive: true,
      isVerified: true,
      isBlocked: false,
      profileCompleted: true,
      onboardingCompleted: true,
    });
    
    await staff.save();
    console.log('✅ Staff created successfully!');
    
    // Verify the staff account
    const createdStaff = await User.findOne({ role: 'staff' });
    console.log('\n📊 Staff Account Summary:');
    console.log(`  Email: ${createdStaff?.email}`);
    console.log(`  Phone: ${createdStaff?.phoneNumber}`);
    console.log(`  Role: ${createdStaff?.role}`);
    console.log(`  Department: ${createdStaff?.profile?.department}`);
    console.log(`  Active: ${createdStaff?.isActive}`);
    console.log(`  Verified: ${createdStaff?.isVerified}`);

  } catch (error: any) {
    console.error('💥 Error:', error.message);
  } finally {
    await mongoose.disconnect();
    console.log('📦 Disconnected from MongoDB');
  }
}

createStaffAccount();
