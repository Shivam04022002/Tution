/**
 * DEMO DATA VERIFICATION SCRIPT
 * =============================
 * 
 * Verifies that all demo data was created correctly.
 * Tests login credentials and data relationships.
 * 
 * Usage: npx ts-node src/scripts/verifyDemoData.ts
 */

import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { config } from 'dotenv';

config();

// Import models
import { User } from '../models/User';
import { ParentRequirement } from '../models/ParentRequirement';
import { TeacherProfile } from '../models/TeacherProfile';
import { TutorMatch } from '../models/TutorMatch';
import { TutorApplication } from '../models/TutorApplication';
import { DemoClass } from '../models/DemoClass';

// Demo credentials
const DEMO_PARENT = {
  email: 'parent@test.com',
  password: 'Parent@123',
};

const DEMO_TEACHER = {
  email: 'teacher@test.com',
  password: 'Teacher@123',
};

// Connect to MongoDB
const connectDB = async (): Promise<void> => {
  const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/tuition_app';
  try {
    await mongoose.connect(mongoURI);
    console.log('✅ MongoDB Connected\n');
  } catch (error) {
    console.error('❌ MongoDB Connection Error:', error);
    process.exit(1);
  }
};

// Test login
const testLogin = async (email: string, password: string, role: string): Promise<boolean> => {
  console.log(`\n🔐 Testing ${role} Login: ${email}`);
  
  const user = await User.findOne({ email: email.toLowerCase() });
  
  if (!user) {
    console.log(`  ❌ User not found: ${email}`);
    return false;
  }
  
  console.log(`  ✅ User found: ${user._id}`);
  console.log(`     Role: ${user.role}`);
  console.log(`     Profile Completed: ${user.profileCompleted}`);
  
  // Verify password
  const isPasswordValid = user.password ? await bcrypt.compare(password, user.password) : false;
  
  if (!isPasswordValid) {
    console.log(`  ❌ Password invalid`);
    console.log(`     Stored hash: ${user.password ? user.password.substring(0, 20) : '(no password set)'}...`);
    return false;
  }
  
  console.log(`  ✅ Password valid`);
  
  // Generate token (simulate login)
  const token = jwt.sign(
    { userId: user._id.toString() },
    process.env.JWT_SECRET!,
    { expiresIn: '7d' }
  );
  
  console.log(`  ✅ Token generated: ${token.substring(0, 30)}...`);
  
  return true;
};

// Verify parent data
const verifyParentData = async (): Promise<boolean> => {
  console.log('\n📋 Verifying Parent Data...');
  
  const user = await User.findOne({ email: DEMO_PARENT.email.toLowerCase() });
  if (!user) {
    console.log('  ❌ Parent user not found');
    return false;
  }
  
  // Check ParentRequirement
  const requirement = await ParentRequirement.findOne({ parentId: user._id });
  if (!requirement) {
    console.log('  ❌ ParentRequirement not found');
    return false;
  }
  
  console.log(`  ✅ ParentRequirement found: ${requirement.requirementId}`);
  console.log(`     Student: ${requirement.studentDetails.studentName}`);
  console.log(`     Grade: ${requirement.studentDetails.grade}`);
  console.log(`     Board: ${requirement.studentDetails.board}`);
  console.log(`     Subjects: ${requirement.subjects.join(', ')}`);
  console.log(`     City: ${requirement.location.city}`);
  console.log(`     Budget: ₹${requirement.budget.minAmount}-₹${requirement.budget.maxAmount}`);
  console.log(`     Status: ${requirement.status}`);
  console.log(`     Total Matches: ${requirement.totalMatches}`);
  
  return true;
};

// Verify teacher data
const verifyTeacherData = async (): Promise<boolean> => {
  console.log('\n👨‍🏫 Verifying Teacher Data...');
  
  const user = await User.findOne({ email: DEMO_TEACHER.email.toLowerCase() });
  if (!user) {
    console.log('  ❌ Teacher user not found');
    return false;
  }
  
  // Check TeacherProfile
  const profile = await TeacherProfile.findOne({ userId: user._id });
  if (!profile) {
    console.log('  ❌ TeacherProfile not found');
    return false;
  }
  
  console.log(`  ✅ TeacherProfile found: ${profile._id}`);
  console.log(`     Name: ${profile.basicDetails.fullName}`);
  console.log(`     Qualification: ${profile.education.highestQualification}`);
  console.log(`     Experience: ${profile.pricingRevenue.experienceYears} years`);
  console.log(`     Subjects: ${profile.teachingDetails.subjects.join(', ')}`);
  console.log(`     Classes: ${profile.teachingDetails.classes.join(', ')}`);
  console.log(`     City: ${profile.locationAvailability.city}`);
  console.log(`     Monthly Rate: ₹${profile.pricingRevenue.monthlyRate}`);
  console.log(`     Verification: ${profile.verificationStatus}`);
  console.log(`     Rating: ${profile.stats.averageRating}/5 (${profile.stats.totalReviews} reviews)`);
  
  return true;
};

// Verify tutor match
const verifyTutorMatch = async (): Promise<boolean> => {
  console.log('\n🔗 Verifying TutorMatch...');
  
  const parentUser = await User.findOne({ email: DEMO_PARENT.email.toLowerCase() });
  const teacherUser = await User.findOne({ email: DEMO_TEACHER.email.toLowerCase() });
  
  if (!parentUser || !teacherUser) {
    console.log('  ❌ Parent or teacher user not found');
    return false;
  }
  
  const match = await TutorMatch.findOne({
    parentId: parentUser._id,
    teacherId: teacherUser._id,
  });
  
  if (!match) {
    console.log('  ❌ TutorMatch not found');
    return false;
  }
  
  console.log(`  ✅ TutorMatch found: ${match.matchId}`);
  console.log(`     Overall Score: ${match.overallScore}%`);
  console.log(`     Status: ${match.status}`);
  console.log(`     Subject Score: ${match.breakdown.subjectScore}%`);
  console.log(`     Location Score: ${match.breakdown.locationScore}%`);
  console.log(`     Budget Score: ${match.breakdown.budgetScore}%`);
  console.log(`     Mode Score: ${match.breakdown.modeScore}%`);
  console.log(`     Timing Score: ${match.breakdown.timingScore}%`);
  
  return true;
};

// Verify tutor application
const verifyTutorApplication = async (): Promise<boolean> => {
  console.log('\n📝 Verifying TutorApplication...');
  
  const parentUser = await User.findOne({ email: DEMO_PARENT.email.toLowerCase() });
  const teacherUser = await User.findOne({ email: DEMO_TEACHER.email.toLowerCase() });
  
  if (!parentUser || !teacherUser) {
    console.log('  ❌ Parent or teacher user not found');
    return false;
  }
  
  const application = await TutorApplication.findOne({
    parentId: parentUser._id,
    teacherId: teacherUser._id,
  });
  
  if (!application) {
    console.log('  ❌ TutorApplication not found');
    return false;
  }
  
  console.log(`  ✅ TutorApplication found: ${application.applicationId}`);
  console.log(`     Status: ${application.status}`);
  console.log(`     Proposed Fee: ₹${application.proposedFee}`);
  console.log(`     Viewed by Parent: ${application.viewedByParent}`);
  console.log(`     Demo Scheduled: ${application.demoScheduled}`);
  console.log(`     Message: "${application.message?.substring(0, 50)}..."`);
  
  return true;
};

// Verify demo class
const verifyDemoClass = async (): Promise<boolean> => {
  console.log('\n📅 Verifying DemoClass...');
  
  const parentUser = await User.findOne({ email: DEMO_PARENT.email.toLowerCase() });
  const teacherUser = await User.findOne({ email: DEMO_TEACHER.email.toLowerCase() });
  
  if (!parentUser || !teacherUser) {
    console.log('  ❌ Parent or teacher user not found');
    return false;
  }
  
  const demoClass = await DemoClass.findOne({
    parentId: parentUser._id,
    teacherId: teacherUser._id,
  });
  
  if (!demoClass) {
    console.log('  ❌ DemoClass not found');
    return false;
  }
  
  console.log(`  ✅ DemoClass found: ${demoClass.demoId}`);
  console.log(`     Student: ${demoClass.studentDetails.studentName}`);
  console.log(`     Subject: ${demoClass.studentDetails.subject}`);
  console.log(`     Date: ${demoClass.scheduledDate.toDateString()}`);
  console.log(`     Time: ${demoClass.scheduledTime}`);
  console.log(`     Duration: ${demoClass.duration} minutes`);
  console.log(`     Mode: ${demoClass.mode}`);
  console.log(`     Status: ${demoClass.status}`);
  
  // Check if scheduled for tomorrow
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const isTomorrow = demoClass.scheduledDate.toDateString() === tomorrow.toDateString();
  
  if (isTomorrow) {
    console.log(`     📌 Scheduled for tomorrow ✓`);
  }
  
  return true;
};

// Run all verifications
const runVerification = async (): Promise<void> => {
  console.log('='.repeat(60));
  console.log('🔍 DEMO DATA VERIFICATION');
  console.log('='.repeat(60));
  
  try {
    await connectDB();
    
    const results = {
      parentLogin: false,
      teacherLogin: false,
      parentData: false,
      teacherData: false,
      tutorMatch: false,
      tutorApplication: false,
      demoClass: false,
    };
    
    // Test logins
    results.parentLogin = await testLogin(DEMO_PARENT.email, DEMO_PARENT.password, 'Parent');
    results.teacherLogin = await testLogin(DEMO_TEACHER.email, DEMO_TEACHER.password, 'Teacher');
    
    // Verify data
    results.parentData = await verifyParentData();
    results.teacherData = await verifyTeacherData();
    results.tutorMatch = await verifyTutorMatch();
    results.tutorApplication = await verifyTutorApplication();
    results.demoClass = await verifyDemoClass();
    
    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('📊 VERIFICATION SUMMARY');
    console.log('='.repeat(60));
    
    const allPassed = Object.values(results).every(r => r);
    
    Object.entries(results).forEach(([key, passed]) => {
      const icon = passed ? '✅' : '❌';
      const label = key
        .replace(/([A-Z])/g, ' $1')
        .replace(/^./, str => str.toUpperCase());
      console.log(`${icon} ${label}`);
    });
    
    console.log('\n' + '='.repeat(60));
    if (allPassed) {
      console.log('✅ ALL VERIFICATIONS PASSED');
      console.log('='.repeat(60));
      console.log('\n🎉 Demo data is ready for testing!');
      console.log('\n🔑 Quick Login Test:');
      console.log('  Parent: parent@test.com / Parent@123');
      console.log('  Teacher: teacher@test.com / Teacher@123');
    } else {
      console.log('❌ SOME VERIFICATIONS FAILED');
      console.log('='.repeat(60));
      console.log('\n⚠️  Please run the seed script again:');
      console.log('   npx ts-node src/scripts/seedDemoAccounts.ts');
    }
    console.log('='.repeat(60));
    
  } catch (error) {
    console.error('\n❌ Verification failed:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n👋 MongoDB Disconnected');
    process.exit(0);
  }
};

// Run if executed directly
if (require.main === module) {
  runVerification();
}

export { runVerification };
