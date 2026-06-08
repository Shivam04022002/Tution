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

// Define User schema inline for testing
const userSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  phoneNumber: { type: String, required: true, unique: true, sparse: true },
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

async function createAccounts() {
  try {
    await connectDB();
    
    console.log('🔧 Environment Variables:');
    console.log('ADMIN_EMAIL:', process.env.ADMIN_EMAIL);
    console.log('ADMIN_PASSWORD:', process.env.ADMIN_PASSWORD ? '***' : 'NOT SET');
    console.log('STAFF_EMAIL:', process.env.STAFF_EMAIL);
    console.log('STAFF_PASSWORD:', process.env.STAFF_PASSWORD ? '***' : 'NOT SET');

    // Check if admin exists
    const existingAdmin = await User.findOne({ role: 'admin' });
    if (existingAdmin) {
      console.log('✅ Admin already exists:', existingAdmin.email);
    } else {
      console.log('👤 Creating admin account...');
      const hashedAdminPassword = await bcrypt.hash(process.env.ADMIN_PASSWORD!, 12);
      const admin = new User({
        email: process.env.ADMIN_EMAIL,
        phoneNumber: process.env.ADMIN_PHONE,
        password: hashedAdminPassword,
        role: 'admin',
        profile: {
          firstName: 'System',
          lastName: 'Administrator',
        },
        isActive: true,
        isVerified: true,
        isBlocked: false,
        profileCompleted: true,
        onboardingCompleted: true,
      });
      await admin.save();
      console.log('✅ Admin created:', admin.email);
    }

    // Check if staff exists
    const existingStaff = await User.findOne({ role: 'staff' });
    if (existingStaff) {
      console.log('✅ Staff already exists:', existingStaff.email);
    } else {
      console.log('👤 Creating staff account...');
      const hashedStaffPassword = await bcrypt.hash(process.env.STAFF_PASSWORD!, 12);
      const staff = new User({
        email: process.env.STAFF_EMAIL,
        phoneNumber: process.env.STAFF_PHONE,
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
      console.log('✅ Staff created:', staff.email);
    }

    // Verify accounts
    const admin = await User.findOne({ role: 'admin' });
    const staff = await User.findOne({ role: 'staff' });

    console.log('\n📊 Account Summary:');
    console.log('Admin:');
    console.log(`  Email: ${admin?.email}`);
    console.log(`  Role: ${admin?.role}`);
    console.log(`  Active: ${admin?.isActive}`);
    
    console.log('Staff:');
    console.log(`  Email: ${staff?.email}`);
    console.log(`  Role: ${staff?.role}`);
    console.log(`  Department: ${staff?.profile?.department}`);
    console.log(`  Active: ${staff?.isActive}`);

  } catch (error: any) {
    console.error('💥 Error:', error.message);
  } finally {
    await mongoose.disconnect();
    console.log('📦 Disconnected from MongoDB');
  }
}

createAccounts();
