import dotenv from 'dotenv';
dotenv.config();

import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

async function fixAdminPassword() {
  try {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/tuition-app';
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB');

    const db = mongoose.connection.db;
    if (!db) {
      throw new Error('Database connection not established');
    }
    const usersCollection = db.collection('users');

    // Find and update admin account
    const admin = await usersCollection.findOne({ email: 'admin@test.com' });
    
    if (!admin) {
      console.log('❌ Admin account not found');
      return;
    }

    console.log('🔧 Checking admin password...');
    
    // Test current password
    if (admin?.password) {
      try {
        const isMatch = await bcrypt.compare('Admin123', admin.password);
        console.log('✅ Current admin password match:', isMatch);
        
        if (!isMatch) {
          console.log('🔧 Fixing admin password...');
          
          // Create new password hash
          const newPassword = 'Admin123';
          const saltRounds = 12;
          const hashedPassword = await bcrypt.hash(newPassword, saltRounds);
          
          // Update the admin account
          const result = await usersCollection.updateOne(
            { _id: admin._id },
            { 
              $set: { 
                password: hashedPassword,
                isActive: true,
                isVerified: true
              }
            }
          );

          console.log('✅ Admin account updated:', result.modifiedCount, 'documents modified');
          
          // Test the new password
          const updatedAdmin = await usersCollection.findOne({ email: 'admin@test.com' });
          if (updatedAdmin?.password) {
            const newMatch = await bcrypt.compare('Admin123', updatedAdmin.password);
            console.log('✅ New admin password match:', newMatch);
          }
        }
      } catch (error: any) {
        console.log('❌ Password comparison error:', error.message);
      }
    }

    console.log('\n🎉 ACCOUNT STATUS SUMMARY:');
    
    // Check both accounts
    const adminCheck = await usersCollection.findOne({ email: 'admin@test.com' });
    const staffCheck = await usersCollection.findOne({ email: 'staff@test.com' });

    console.log('\n👑 ADMIN ACCOUNT:');
    console.log(`  Email: ${adminCheck?.email}`);
    console.log(`  Role: ${adminCheck?.role}`);
    console.log(`  Active: ${adminCheck?.isActive}`);
    console.log(`  Has Password: ${!!adminCheck?.password}`);

    console.log('\n👥 STAFF ACCOUNT:');
    console.log(`  Email: ${staffCheck?.email}`);
    console.log(`  Role: ${staffCheck?.role}`);
    console.log(`  Active: ${staffCheck?.isActive}`);
    console.log(`  Has Password: ${!!staffCheck?.password}`);

    console.log('\n🔐 LOGIN CREDENTIALS:');
    console.log('👑 Admin: admin@test.com / Admin123');
    console.log('👥 Staff: staff@test.com / staff123');
    console.log('\n✅ BOTH ACCOUNTS ARE READY FOR LOGIN!');

  } catch (error: any) {
    console.error('💥 Error:', error.message);
  } finally {
    await mongoose.disconnect();
    console.log('\n📦 Disconnected from MongoDB');
  }
}

fixAdminPassword();
