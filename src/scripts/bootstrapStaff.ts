import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { User } from '../../src/models/User';
import { initializeFirebase } from '../../src/config/firebase';

// Load environment variables
import dotenv from 'dotenv';
dotenv.config();

// Environment variables for staff bootstrap
const STAFF_NAME = process.env.STAFF_NAME?.trim();
const STAFF_PHONE = process.env.STAFF_PHONE?.trim();
const STAFF_EMAIL = process.env.STAFF_EMAIL?.trim();
const STAFF_PASSWORD = process.env.STAFF_PASSWORD?.trim();

// Validation function
function validateStaffEnv(): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!STAFF_NAME) {
    errors.push('STAFF_NAME environment variable is required');
  } else if (STAFF_NAME.length < 2) {
    errors.push('STAFF_NAME must be at least 2 characters long');
  }

  if (!STAFF_PHONE) {
    errors.push('STAFF_PHONE environment variable is required');
  } else if (!/^\+?[\d\s\-\(\)]+$/.test(STAFF_PHONE)) {
    errors.push('STAFF_PHONE must be a valid phone number');
  }

  if (!STAFF_EMAIL) {
    errors.push('STAFF_EMAIL environment variable is required');
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(STAFF_EMAIL)) {
    errors.push('STAFF_EMAIL must be a valid email address');
  }

  if (!STAFF_PASSWORD) {
    errors.push('STAFF_PASSWORD environment variable is required');
  } else if (STAFF_PASSWORD.length < 8) {
    errors.push('STAFF_PASSWORD must be at least 8 characters long');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

// Main bootstrap function
export async function bootstrapStaff(): Promise<{ success: boolean; message: string; staff?: any }> {
  try {
    console.log('🔧 Starting Staff Bootstrap...');

    // Validate environment variables
    const validation = validateStaffEnv();
    if (!validation.isValid) {
      return {
        success: false,
        message: `Environment validation failed: ${validation.errors.join(', ')}`
      };
    }

    // Check if staff already exists
    console.log('🔍 Checking for existing staff account...');
    const existingStaff = await User.findOne({ role: 'staff' as const });
    
    if (existingStaff) {
      console.log('✅ Staff account already exists');
      return {
        success: true,
        message: 'Staff account already exists',
        staff: {
          id: existingStaff._id,
          name: existingStaff.profile?.firstName || 'Staff',
          email: existingStaff.email,
          phone: existingStaff.phoneNumber,
          role: existingStaff.role,
          department: existingStaff.profile?.department || 'Operations',
          createdAt: existingStaff.createdAt
        }
      };
    }

    // Hash the password
    console.log('🔐 Hashing staff password...');
    const saltRounds = 12;
    if (!STAFF_PASSWORD) {
      throw new Error('STAFF_PASSWORD is required');
    }
    const hashedPassword = await bcrypt.hash(STAFF_PASSWORD, saltRounds);

    // Create staff account
    console.log('👤 Creating staff account...');
    const staffUser = new User({
      email: STAFF_EMAIL!.toLowerCase(),
      phoneNumber: STAFF_PHONE!,
      password: hashedPassword,
      role: 'staff',
      isActive: true,
      isVerified: true,
      isBlocked: false,
      profile: {
        firstName: STAFF_NAME!.split(' ')[0],
        lastName: STAFF_NAME!.split(' ').slice(1).join(' ') || '',
        department: 'Operations', // Default department
      },
      profileCompleted: true,
      onboardingCompleted: true,
    });

    await staffUser.save();

    console.log('✅ Staff account created successfully');
    
    return {
      success: true,
      message: 'Staff account created successfully',
      staff: {
        id: staffUser._id,
        name: staffUser.profile?.firstName || 'Staff',
        email: staffUser.email,
        phone: staffUser.phoneNumber,
        role: staffUser.role,
        department: staffUser.profile?.department || 'Operations',
        createdAt: staffUser.createdAt
      }
    };

  } catch (error: any) {
    console.error('❌ Staff bootstrap failed:', error);
    return {
      success: false,
      message: `Staff bootstrap failed: ${error.message}`
    };
  }
}

// Standalone script execution
if (require.main === module) {
  async function runBootstrap() {
    try {
      // Initialize Firebase (optional for staff bootstrap)
      try {
        initializeFirebase();
      } catch (error) {
        console.log('⚠️ Firebase initialization failed (not required for staff bootstrap)');
      }

      // Connect to MongoDB
      const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/tuition-app';
      await mongoose.connect(mongoUri);
      console.log('📦 Connected to MongoDB');

      // Run bootstrap
      const result = await bootstrapStaff();
      
      if (result.success) {
        console.log('🎉 Bootstrap completed successfully');
        console.log('📊 Staff Details:');
        console.log(`   Name: ${result.staff?.name}`);
        console.log(`   Email: ${result.staff?.email}`);
        console.log(`   Phone: ${result.staff?.phone}`);
        console.log(`   Role: ${result.staff?.role}`);
        console.log(`   Department: ${result.staff?.department}`);
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
