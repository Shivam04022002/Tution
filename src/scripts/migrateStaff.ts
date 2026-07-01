import mongoose from 'mongoose';
import { User } from '../models/User';
import dotenv from 'dotenv';

dotenv.config();

// Generate the next sequential employee ID (STF000001, STF000002, ...)
async function generateNextEmployeeId(): Promise<string> {
  const prefix = 'STF';
  const lastStaff = await User.findOne({ employeeId: { $regex: '^STF' } })
    .sort({ employeeId: -1 })
    .select('employeeId')
    .lean();

  let nextNumber = 1;
  if (lastStaff?.employeeId) {
    const match = lastStaff.employeeId.match(/\d+$/);
    if (match) {
      nextNumber = parseInt(match[0], 10) + 1;
    }
  }

  return `${prefix}${String(nextNumber).padStart(6, '0')}`;
}

export async function migrateStaff(): Promise<{ success: boolean; message: string; migratedCount: number }> {
  try {
    console.log('🔧 Starting Staff Migration...');

    const staffWithoutEmployeeId = await User.find({
      role: 'staff',
      $or: [
        { employeeId: { $exists: false } },
        { employeeId: null },
        { employeeId: '' },
      ],
    }).sort({ createdAt: 1 });

    console.log(`👤 Found ${staffWithoutEmployeeId.length} staff members without employee ID`);

    let migratedCount = 0;
    for (const staff of staffWithoutEmployeeId) {
      const employeeId = await generateNextEmployeeId();

      // Verify uniqueness
      const exists = await User.findOne({ employeeId });
      if (exists) {
        console.warn(`⚠️ Employee ID ${employeeId} already exists, skipping ${staff._id}`);
        continue;
      }

      staff.employeeId = employeeId;

      // Backfill top-level fields from profile for legacy records
      if (!staff.department && staff.profile?.department) {
        staff.department = staff.profile.department;
      }
      if (!staff.dateOfBirth && staff.profile?.dateOfBirth) {
        staff.dateOfBirth = staff.profile.dateOfBirth;
      }
      if (!staff.gender && staff.profile?.gender) {
        staff.gender = staff.profile.gender;
      }

      // Ensure permissions array exists
      if (!staff.permissions) {
        staff.permissions = [];
      }

      await staff.save();
      migratedCount++;
      console.log(`✅ Migrated ${staff.profile?.firstName || ''} ${staff.profile?.lastName || ''} -> ${employeeId}`);
    }

    return {
      success: true,
      message: `Migration completed. ${migratedCount} staff records updated.`,
      migratedCount,
    };
  } catch (error: any) {
    console.error('❌ Staff migration failed:', error);
    return {
      success: false,
      message: `Staff migration failed: ${error.message}`,
      migratedCount: 0,
    };
  }
}

if (require.main === module) {
  async function runMigration() {
    try {
      const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/tuition-app';
      await mongoose.connect(mongoUri);
      console.log('📦 Connected to MongoDB');

      const result = await migrateStaff();
      console.log(result.success ? '🎉' : '💥', result.message);

      if (!result.success) {
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

  runMigration();
}
