import dotenv from 'dotenv';
dotenv.config();

import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

async function fixStaffPassword() {
  try {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/tuition-app';
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB');

    const db = mongoose.connection.db;
    if (!db) {
      throw new Error('Database connection not established');
    }
    const usersCollection = db.collection('users');

    // Find and update staff account
    const staff = await usersCollection.findOne({ email: 'staff@test.com' });
    
    if (!staff) {
      console.log('❌ Staff account not found');
      return;
    }

    console.log('🔧 Fixing staff password...');
    
    // Create new password hash
    const newPassword = 'staff123';
    const saltRounds = 12;
    const hashedPassword = await bcrypt.hash(newPassword, saltRounds);
    
    console.log('📝 New password hash created');
    console.log('Hash length:', hashedPassword.length);

    // Update the staff account
    const result = await usersCollection.updateOne(
      { _id: staff._id },
      { 
        $set: { 
          password: hashedPassword,
          isActive: true,
          isVerified: true
        }
      }
    );

    console.log('✅ Staff account updated:', result.modifiedCount, 'documents modified');

    // Test the password
    console.log('\n🔐 TESTING NEW PASSWORD:');
    const updatedStaff = await usersCollection.findOne({ email: 'staff@test.com' });
    
    if (updatedStaff?.password) {
      try {
        const isMatch = await bcrypt.compare('staff123', updatedStaff.password);
        console.log('✅ Password match test:', isMatch);
        
        if (isMatch) {
          console.log('\n🎉 STAFF LOGIN IS NOW READY!');
          console.log('📱 Email: staff@test.com');
          console.log('🔑 Password: staff123');
          console.log('🎯 Status: Ready for login');
        } else {
          console.log('❌ Password still not matching');
        }
      } catch (error: any) {
        console.log('❌ Password comparison error:', error.message);
      }
    }

  } catch (error: any) {
    console.error('💥 Error:', error.message);
  } finally {
    await mongoose.disconnect();
    console.log('\n📦 Disconnected from MongoDB');
  }
}

fixStaffPassword();
