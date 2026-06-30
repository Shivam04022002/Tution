import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { User } from '../models/User';
import { initializeFirebase } from '../config/firebase';

// Load environment variables
import dotenv from 'dotenv';
dotenv.config();

// Environment variables for admin bootstrap
const ADMIN_NAME = process.env.ADMIN_NAME?.trim();
const ADMIN_PHONE = process.env.ADMIN_PHONE?.trim();
const ADMIN_EMAIL = process.env.ADMIN_EMAIL?.trim();
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD?.trim();

// Validation function
function validateAdminEnv(): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!ADMIN_NAME) {
    errors.push('ADMIN_NAME environment variable is required');
  } else if (ADMIN_NAME.length < 2) {
    errors.push('ADMIN_NAME must be at least 2 characters long');
  }

  if (!ADMIN_PHONE) {
    errors.push('ADMIN_PHONE environment variable is required');
  } else if (!/^\+?[\d\s\-\(\)]+$/.test(ADMIN_PHONE)) {
    errors.push('ADMIN_PHONE must be a valid phone number');
  }

  if (!ADMIN_EMAIL) {
    errors.push('ADMIN_EMAIL environment variable is required');
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(ADMIN_EMAIL)) {
    errors.push('ADMIN_EMAIL must be a valid email address');
  }

  if (!ADMIN_PASSWORD) {
    errors.push('ADMIN_PASSWORD environment variable is required');
  } else if (ADMIN_PASSWORD.length < 8) {
    errors.push('ADMIN_PASSWORD must be at least 8 characters long');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

// Main bootstrap function
export async function bootstrapAdmin(): Promise<{ success: boolean; message: string; admin?: any }> {
  try {
    console.log('🔧 Starting Admin Bootstrap...');

    // Validate environment variables
    const validation = validateAdminEnv();
    if (!validation.isValid) {
      return {
        success: false,
        message: `Environment validation failed: ${validation.errors.join(', ')}`
      };
    }

    // Check if admin already exists
    console.log('🔍 Checking for existing admin account...');
    const existingAdmin = await User.findOne({ role: 'admin' });
    
    if (existingAdmin) {
      console.log('✅ Admin account already exists');
      return {
        success: true,
        message: 'Admin account already exists',
        admin: {
          id: existingAdmin._id,
          name: existingAdmin.profile?.firstName || 'Admin',
          email: existingAdmin.email,
          phone: existingAdmin.phoneNumber,
          role: existingAdmin.role,
          createdAt: existingAdmin.createdAt
        }
      };
    }

    // Hash the password
    console.log('🔐 Hashing admin password...');
    const saltRounds = 12;
    if (!ADMIN_PASSWORD) {
      throw new Error('ADMIN_PASSWORD is required');
    }
    const hashedPassword = await bcrypt.hash(ADMIN_PASSWORD, saltRounds);

    // Create admin account
    console.log('👤 Creating admin account...');
    const adminUser = new User({
      email: ADMIN_EMAIL!.toLowerCase(),
      phoneNumber: ADMIN_PHONE!,
      password: hashedPassword,
      role: 'admin',
      isActive: true,
      isVerified: true,
      isBlocked: false,
      profile: {
        firstName: ADMIN_NAME!.split(' ')[0],
        lastName: ADMIN_NAME!.split(' ').slice(1).join(' ') || '',
      },
      profileCompleted: true,
      onboardingCompleted: true,
    });

    await adminUser.save();

    console.log('✅ Admin account created successfully');
    
    return {
      success: true,
      message: 'Admin account created successfully',
      admin: {
        id: adminUser._id,
        name: adminUser.profile?.firstName || 'Admin',
        email: adminUser.email,
        phone: adminUser.phoneNumber,
        role: adminUser.role,
        createdAt: adminUser.createdAt
      }
    };

  } catch (error: any) {
    console.error('❌ Admin bootstrap failed:', error);
    return {
      success: false,
      message: `Admin bootstrap failed: ${error.message}`
    };
  }
}

// Standalone script execution
if (require.main === module) {
  async function runBootstrap() {
    try {
      // Initialize Firebase (optional for admin bootstrap)
      try {
        initializeFirebase();
      } catch (error) {
        console.log('⚠️ Firebase initialization failed (not required for admin bootstrap)');
      }

      // Connect to MongoDB
      const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/tuition-app';
      await mongoose.connect(mongoUri);
      console.log('📦 Connected to MongoDB');

      // Run bootstrap
      const result = await bootstrapAdmin();
      
      if (result.success) {
        console.log('🎉 Bootstrap completed successfully');
        console.log('📊 Admin Details:');
        console.log(`   Name: ${result.admin?.name}`);
        console.log(`   Email: ${result.admin?.email}`);
        console.log(`   Phone: ${result.admin?.phone}`);
        console.log(`   Role: ${result.admin?.role}`);
      } else {
        console.error('💥 Bootstrap failed:', result.message);
        process.exit(1);
      }

    } catch (error: any) {
      console.error('💥 Script execution failed:', error);
      process.exit(1);
    } finally {
      await mongoose.disconnect();
      console.log('📦 Disconnected from MongoDB');
    }
  }

  runBootstrap();
}
